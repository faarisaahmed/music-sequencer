// Live-play router for on-screen keyboard, chord strips, drum pads and musical typing.
// Applies scale lock, sustain and the arpeggiator before notes reach the engine
// (so everything played here is also captured when recording).
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
let arpTimer: ReturnType<typeof setTimeout> | null = null;
let arpIndex = 0;
let arpDir = 1;
let arpOrder = 0;
let arpLast: number | null = null;
let arpNext = 0;
let arpVelocity = 0.8;

function arpSequence(): number[] {
  const st = usePlayer.getState();
  const base = st.arp === 'played' ? [...arpPool].sort((a, b) => a.order - b.order).map((a) => a.pitch) : [...new Set(arpPool.map((a) => a.pitch))].sort((a, b) => a - b);
  const seq: number[] = [];
  for (let o = 0; o < st.arpOctaves; o++) for (const p of base) seq.push(p + 12 * o);
  return seq;
}

function arpStep() {
  const engine = getEngine();
  const st = usePlayer.getState();
  const p = useStore.getState().project;
  if (!arpTrack || !p) return stopArp();
  const seq = arpSequence();
  if (!seq.length) return stopArp();
  let pitch: number;
  if (st.arp === 'random') pitch = seq[Math.floor(Math.random() * seq.length)];
  else if (st.arp === 'down') {
    arpIndex = ((arpIndex % seq.length) + seq.length) % seq.length;
    pitch = seq[seq.length - 1 - arpIndex];
    arpIndex++;
  } else if (st.arp === 'updown') {
    if (seq.length === 1) arpIndex = 0;
    else {
      if (arpIndex >= seq.length - 1) arpDir = -1;
      if (arpIndex <= 0) arpDir = 1;
    }
    arpIndex = Math.max(0, Math.min(seq.length - 1, arpIndex));
    pitch = seq[arpIndex];
    arpIndex += arpDir;
  } else {
    arpIndex = arpIndex % seq.length;
    pitch = seq[arpIndex];
    arpIndex++;
  }
  const stepMs = ((st.arpRate * 60) / p.bpm) * 1000;
  const track = arpTrack;
  if (arpLast !== null) engine.noteOff(track, arpLast);
  engine.noteOn(track, pitch, arpVelocity);
  arpLast = pitch;
  const played = pitch;
  setTimeout(() => {
    if (arpLast === played) {
      engine.noteOff(track, played);
      arpLast = null;
    }
  }, stepMs * st.arpGate);
  // Drift-free scheduling against performance.now().
  arpNext += stepMs;
  arpTimer = setTimeout(arpStep, Math.max(0, arpNext - performance.now()));
}

function startArp(trackId: string) {
  arpTrack = trackId;
  if (arpTimer) return;
  arpIndex = 0;
  arpDir = 1;
  arpNext = performance.now();
  arpStep();
}

function stopArp() {
  if (arpTimer) clearTimeout(arpTimer);
  arpTimer = null;
  if (arpLast !== null && arpTrack) getEngine().noteOff(arpTrack, arpLast);
  arpLast = null;
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
