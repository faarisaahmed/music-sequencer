// Playback for the guides' examples: its own small mixer (per-part filters, pan, compression,
// shared reverb and echo) on top of the app's real instruments, independent of any open song.
import { create } from 'zustand';
import { getAudioContext, makeImpulse, resumeAudio } from '../../audio/context';
import type { Instrument } from '../../audio/instruments';
import { createInstrument } from '../../audio/mixer';
import { getPreset } from '../../audio/presets';
import type { Track } from '../../model/types';
import { getEngine } from '../../audio/engine';
import { useStore } from '../../state/store';
import { driveCurve } from '../../audio/instruments';
import { isDrumInst, type GNote, type Part } from './notation';

/** What is playing right now (one example at a time). */
export const useGuidePlayer = create<{ id: string | null; start: number; spb: number; length: number; loop: boolean; loading: string | null }>(() => ({
  id: null,
  start: 0,
  spb: 0.5,
  length: 0,
  loop: false,
  loading: null,
}));

interface Bus {
  input: GainNode;
  verb: GainNode;
  echo: GainNode;
}
let bus: Bus | null = null;

function getBus(ctx: AudioContext): Bus {
  if (bus) return bus;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(ctx.destination);
  const verb = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, 2.6, 2.8, 0.02, 0.7);
  verb.connect(conv).connect(master);
  const echo = ctx.createGain();
  const dl = ctx.createDelay(2);
  dl.delayTime.value = 0.375;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3500;
  echo.connect(dl);
  dl.connect(tone).connect(fb).connect(dl);
  tone.connect(master);
  bus = { input: master, verb, echo };
  (bus as Bus & { delay: DelayNode }).delay = dl;
  return bus;
}

const insts = new Map<string, Promise<Instrument | null>>();

/** One instrument per (preset, slot) so two parts with the same sound can have different effects. */
function getInst(ctx: AudioContext, id: string, slot: number): Promise<Instrument | null> {
  const key = id + '#' + slot;
  let p = insts.get(key);
  if (!p) {
    const preset = getPreset(id);
    const track = { type: preset.kind === 'drums' ? 'drums' : 'instrument', instrument: id, instrumentParams: {} } as unknown as Track;
    const inst = createInstrument(ctx, track);
    p = inst ? inst.ready.then(() => inst).catch(() => inst) : Promise.resolve(null);
    insts.set(key, p);
  }
  return p;
}

interface Running {
  id: string;
  timer: ReturnType<typeof setInterval>;
  chains: AudioNode[];
  used: Instrument[];
  outGain: GainNode;
}
let running: Running | null = null;

function stopSong(): void {
  if (useStore.getState().playing) getEngine().stop();
}

export function stopExample(): void {
  if (!running) return;
  const ctx = getAudioContext();
  const r = running;
  running = null;
  clearInterval(r.timer);
  const now = ctx.currentTime;
  r.outGain.gain.setTargetAtTime(0, now, 0.03);
  for (const i of r.used) i.allNotesOff(now + 0.12);
  setTimeout(() => {
    for (const i of r.used) {
      try {
        i.output.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    for (const n of r.chains) n.disconnect();
  }, 250);
  useGuidePlayer.setState({ id: null });
}

export interface PlayOpts {
  bpm?: number;
  loop?: boolean;
  /** total length in beats (defaults to the end of the last note, rounded up to a bar) */
  length?: number;
  /** part indexes to leave out */
  muted?: Set<number>;
}

export function partsLength(parts: Part[]): number {
  const end = Math.max(0, ...parts.flatMap((p) => p.notes.map((x) => x.t + x.d)));
  return Math.max(4, Math.ceil(end / 4 - 0.02) * 4);
}

export async function playExample(id: string, parts: Part[], opts: PlayOpts = {}): Promise<void> {
  stopExample();
  stopSong();
  const ctx = await resumeAudio();
  const b = getBus(ctx);
  const bpm = opts.bpm ?? 100;
  const spb = 60 / bpm;
  (b as Bus & { delay: DelayNode }).delay.delayTime.value = Math.min(1.9, spb * 0.75);
  useGuidePlayer.setState({ loading: id });
  const loaded = await Promise.all(parts.map((p, i) => getInst(ctx, p.inst, i)));
  if (useGuidePlayer.getState().loading !== id) return; // another example started meanwhile
  useGuidePlayer.setState({ loading: null });

  const outGain = ctx.createGain();
  outGain.connect(b.input);
  const chains: AudioNode[] = [outGain];
  const used: Instrument[] = [];
  const live: { inst: Instrument; notes: GNote[]; drums: boolean }[] = [];
  parts.forEach((part, i) => {
    const inst = loaded[i];
    if (!inst || opts.muted?.has(i)) return;
    try {
      inst.output.disconnect();
    } catch {
      /* fresh */
    }
    let node: AudioNode = inst.output;
    const fx = part.fx ?? {};
    const add = (n: AudioNode) => {
      node.connect(n);
      node = n;
      chains.push(n);
    };
    if (fx.drive) {
      const ws = ctx.createWaveShaper();
      ws.curve = driveCurve(fx.drive);
      ws.oversample = '2x';
      add(ws);
    }
    if (fx.highpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = fx.highpass;
      add(f);
    }
    if (fx.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = fx.lowpass;
      add(f);
    }
    if (fx.comp) {
      const c = ctx.createDynamicsCompressor();
      c.threshold.value = -28;
      c.ratio.value = 6;
      c.attack.value = 0.005;
      c.release.value = 0.15;
      add(c);
      const makeup = ctx.createGain();
      makeup.gain.value = 1.9;
      add(makeup);
    }
    const g = ctx.createGain();
    g.gain.value = (part.vol ?? 1) * (isDrumInst(part.inst) ? 0.9 : 0.75);
    add(g);
    const pan = ctx.createStereoPanner();
    pan.pan.value = fx.pan ?? 0;
    add(pan);
    pan.connect(outGain);
    if (fx.reverb) {
      const s = ctx.createGain();
      s.gain.value = fx.reverb;
      pan.connect(s).connect(b.verb);
      chains.push(s);
    }
    if (fx.delay) {
      const s = ctx.createGain();
      s.gain.value = fx.delay;
      pan.connect(s).connect(b.echo);
      chains.push(s);
    }
    used.push(inst);
    live.push({ inst, notes: [...part.notes].sort((a, c) => a.t - c.t), drums: isDrumInst(part.inst) });
  });

  const length = opts.length ?? partsLength(parts);
  const start = ctx.currentTime + 0.08;
  let pass = 0;
  const cursors = live.map(() => 0);
  const LOOK = 0.18;
  const tick = () => {
    if (!running || running.id !== id) return;
    const horizon = ctx.currentTime + LOOK;
    for (;;) {
      const passStart = start + pass * length * spb;
      let pending = false;
      live.forEach((l, k) => {
        while (cursors[k] < l.notes.length) {
          const x = l.notes[cursors[k]];
          const when = passStart + x.t * spb;
          if (when > horizon) {
            pending = true;
            return;
          }
          if (when >= ctx.currentTime - 0.02) l.inst.playNote(x.p, x.v ?? 0.8, when, Math.max(0.05, x.d * spb));
          cursors[k]++;
        }
      });
      if (pending) return;
      const passEnd = passStart + length * spb;
      if (!opts.loop) {
        if (ctx.currentTime > passEnd + 0.3) stopExample();
        return;
      }
      if (passEnd > horizon) return;
      pass++;
      cursors.fill(0);
    }
  };
  running = { id, timer: setInterval(tick, 25), chains, used, outGain };
  useGuidePlayer.setState({ id, start, spb, length, loop: !!opts.loop });
  tick();
}

type NowOpts = { arpeggio?: number; dur?: number; v?: number };

/** Play a few notes right now (keyboard diagrams, inline play chips). Doesn't stop a running example. */
export async function playNow(pitches: number[], inst = 'grand-piano', opts: NowOpts = {}): Promise<void> {
  stopSong();
  await sound(pitches, inst, 99, opts);
}

let lastPreview: Instrument | null = null;

/**
 * Hear a sound from the library without changing any track. The song keeps playing (so you can
 * try it against the music), and starting another preview cuts this one off.
 */
export async function previewNotes(pitches: number[], inst: string, opts: NowOpts = {}): Promise<void> {
  lastPreview?.allNotesOff(getAudioContext().currentTime);
  lastPreview = await sound(pitches, inst, 98, opts);
}

async function sound(pitches: number[], inst: string, slot: number, opts: NowOpts): Promise<Instrument | null> {
  const ctx = await resumeAudio();
  const b = getBus(ctx);
  const i = await getInst(ctx, inst, slot);
  if (!i) return null;
  try {
    i.output.disconnect();
  } catch {
    /* fresh */
  }
  const g = ctx.createGain();
  g.gain.value = 0.75;
  i.output.connect(g).connect(b.input);
  const v = ctx.createGain();
  v.gain.value = 0.18;
  g.connect(v).connect(b.verb);
  const now = ctx.currentTime + 0.02;
  const step = opts.arpeggio ?? 0;
  const dur = opts.dur ?? 1.4;
  pitches.forEach((p, k) => i.playNote(p, opts.v ?? 0.75, now + k * step, dur + (pitches.length - 1 - k) * step));
  return i;
}
