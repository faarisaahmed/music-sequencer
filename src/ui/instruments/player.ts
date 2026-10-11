// Live-play router for on-screen keyboard, chord strips, drum pads and musical typing.
// Applies scale lock, sustain and the arpeggiator before notes reach the engine
// (so everything played here is also captured when recording).
import { tempoOf } from '../../model/timeline';
import { create } from 'zustand';
import { getEngine } from '../../audio/engine';
import { findTrack, useStore } from '../../state/store';
import { scaleOfKey, snapToScale } from '../../model/music';

export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random' | 'played';

export const usePlayer = create(() => ({
  sustain: false,
  scaleLock: false,
  arp: 'off' as ArpMode,
  arpRate: 0.25, // beats per step
  arpOctaves: 1,
  arpGate: 0.8,
  /** Notes currently sounding from this panel, per track (for key highlighting). */
  version: 0,
}));

interface Sounding {
  trackId: string;
  pitches: number[];
}

const sources = new Map<string, Sounding>();
const sustained: Sounding[] = [];

// ------------------------------------------------------------------ arpeggiator
interface ArpNote {
  pitch: number;
  source: string;
  order: number;
}
let arpPool: ArpNote[] = [];
let arpTrack: string | null = null;
let arpTimer: ReturnType<typeof setInterval> | null = null;
let arpIndex = 0;
let arpDir = 1;
let arpOrder = 0;
/** Audio-context time of the next arpeggiator step. */
let arpNextTime = 0;
let arpVelocity = 0.8;

const ARP_LOOKAHEAD = 0.1; // seconds scheduled ahead of the audio clock
const ARP_TICK_MS = 20;

function arpSequence(): number[] {
  const st = usePlayer.getState();
  const base = st.arp === 'played' ? [...arpPool].sort((a, b) => a.order - b.order).map((a) => a.pitch) : [...new Set(arpPool.map((a) => a.pitch))].sort((a, b) => a - b);
  const seq: number[] = [];
  for (let o = 0; o < st.arpOctaves; o++) for (const p of base) seq.push(p + 12 * o);
  return seq;
}

function nextArpPitch(seq: number[]): number {
  const st = usePlayer.getState();
  if (st.arp === 'random') return seq[Math.floor(Math.random() * seq.length)];
  if (st.arp === 'down') {
    arpIndex = ((arpIndex % seq.length) + seq.length) % seq.length;
    return seq[seq.length - 1 - arpIndex++];
  }
  if (st.arp === 'updown') {
    if (seq.length === 1) arpIndex = 0;
    else {
      if (arpIndex >= seq.length - 1) arpDir = -1;
      if (arpIndex <= 0) arpDir = 1;
    }
    arpIndex = Math.max(0, Math.min(seq.length - 1, arpIndex));
    const p = seq[arpIndex];
    arpIndex += arpDir;
    return p;
  }
  arpIndex = arpIndex % seq.length;
  return seq[arpIndex++];
}

/** Lookahead scheduler: queue every step that falls inside the next ARP_LOOKAHEAD seconds. */
function arpTick() {
  const engine = getEngine();
  const st = usePlayer.getState();
  const p = useStore.getState().project;
  if (!arpTrack || !p) return stopArp();
  const seq = arpSequence();
  if (!seq.length) return stopArp();
  const stepSec = (st.arpRate * 60) / tempoOf(p).bpmAt(engine.position);
  const now = engine.ctx.currentTime;
  if (arpNextTime < now - stepSec) arpNextTime = now; // fell behind (tab hidden) — resync
  while (arpNextTime < now + ARP_LOOKAHEAD) {
    engine.playScheduled(arpTrack, nextArpPitch(seq), arpVelocity, Math.max(arpNextTime, now), stepSec * st.arpGate);
    arpNextTime += stepSec;
  }
}

function startArp(trackId: string) {
  arpTrack = trackId;
  if (arpTimer) return;
  arpIndex = 0;
  arpDir = 1;
  const engine = getEngine();
  const now = engine.ctx.currentTime + 0.01;
  arpNextTime = now;
  // While the song plays, lock the pattern to the beat grid.
  const p = useStore.getState().project;
  if (engine.isPlaying && p) {
    const rate = usePlayer.getState().arpRate;
    const pos = engine.position;
    const nextStep = Math.ceil(pos / rate - 0.05) * rate;
    arpNextTime = Math.max(engine.ctx.currentTime + 0.002, engine.ctx.currentTime + tempoOf(p).span(pos, nextStep));
  }
  arpTick();
  arpTimer = setInterval(arpTick, ARP_TICK_MS);
}

function stopArp() {
  if (arpTimer) clearInterval(arpTimer);
  arpTimer = null;
  arpPool = [];
}

// ------------------------------------------------------------------ public API

function bump() {
  usePlayer.setState((s) => ({ version: s.version + 1 }));
}

/** Start notes for a source (pointer, key, chord zone…). `raw` bypasses scale lock and arp. */
export function press(source: string, pitches: number[], velocity: number, opts: { raw?: boolean } = {}): void {
  const s = useStore.getState();
  const trackId = s.selectedTrackId;
  const track = findTrack(s.project, trackId);
  if (!trackId || !track || !s.project) return;
  if (sources.has(source)) release(source);
  const st = usePlayer.getState();
  const isDrums = track.type === 'drums';
  let ps = pitches;
  if (!opts.raw && !isDrums && st.scaleLock) {
    const scale = scaleOfKey(s.project.key);
    ps = pitches.map((p) => snapToScale(p, scale));
  }
  ps = ps.filter((p) => p >= 0 && p <= 127);
  if (!opts.raw && !isDrums && st.arp !== 'off') {
    // Starting a fresh chord while nothing is held (and not latched) replaces the pool.
    if (!sources.size && !st.sustain) arpPool = [];
    for (const p of ps) arpPool.push({ pitch: p, source, order: arpOrder++ });
    arpVelocity = velocity;
    sources.set(source, { trackId, pitches: [] });
    startArp(trackId);
    bump();
    return;
  }
  const engine = getEngine();
  for (const p of ps) engine.noteOn(trackId, p, velocity);
  sources.set(source, { trackId, pitches: ps });
  bump();
}

export function release(source: string): void {
  const snd = sources.get(source);
  if (!snd) return;
  sources.delete(source);
  const st = usePlayer.getState();
  if (st.arp !== 'off' && !snd.pitches.length) {
    // Arp notes: drop them unless sustain is latching the pattern.
    if (!st.sustain) {
      arpPool = arpPool.filter((a) => a.source !== source);
      if (!arpPool.length) stopArp();
    }
    bump();
    return;
  }
  if (st.sustain) sustained.push(snd);
  else {
    const engine = getEngine();
    for (const p of snd.pitches) engine.noteOff(snd.trackId, p);
  }
  bump();
}

export function isPressed(source: string): boolean {
  return sources.has(source);
}

export function setSustain(on: boolean): void {
  usePlayer.setState({ sustain: on });
  if (!on) {
    const engine = getEngine();
    for (const snd of sustained.splice(0)) for (const p of snd.pitches) engine.noteOff(snd.trackId, p);
    // Release latched arp notes whose keys are no longer held.
    const held = new Set(sources.keys());
    arpPool = arpPool.filter((a) => held.has(a.source));
    if (!arpPool.length) stopArp();
  }
}

export function setArp(mode: ArpMode): void {
  usePlayer.setState({ arp: mode });
  if (mode === 'off') stopArp();
}

export function releaseAll(): void {
  for (const k of [...sources.keys()]) release(k);
  setSustain(false);
  stopArp();
}

export function velocityFromY(e: { clientY: number }, rect: DOMRect, min = 0.3): number {
  const f = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  return Math.round((min + (1 - min) * f) * 100) / 100;
}
