// Instrument implementations built on raw Web Audio so they run identically
// in the live AudioContext and in an OfflineAudioContext (for export).
import { midiToFreq } from '../model/music';
import { loadBuffer } from './context';

export interface Instrument {
  readonly output: AudioNode;
  ready: Promise<void>;
  noteOn(pitch: number, velocity: number, time: number): void;
  noteOff(pitch: number, time: number): void;
  playNote(pitch: number, velocity: number, time: number, duration: number): void;
  allNotesOff(time: number): void;
  setParams(params: Record<string, number>): void;
  dispose(): void;
}

export interface Voice {
  release(time: number): void;
  stopHard(time: number): void;
  endTime: number;
}

/** Velocity → gain with a musical curve. */
export function velGain(v: number): number {
  return Math.pow(Math.max(0, Math.min(1, v)), 1.6) * 0.95 + 0.05;
}

abstract class BaseInstrument implements Instrument {
  readonly output: GainNode;
  ready: Promise<void> = Promise.resolve();
  protected ctx: BaseAudioContext;
  protected held = new Map<number, Voice[]>();
  protected all = new Set<Voice>();
  protected params: Record<string, number> = {};

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.output = ctx.createGain();
  }

  protected abstract startVoice(pitch: number, velocity: number, time: number): Voice | null;

  noteOn(pitch: number, velocity: number, time: number): void {
    const v = this.startVoice(pitch, velocity, time);
    if (!v) return;
    const list = this.held.get(pitch) ?? [];
    list.push(v);
    this.held.set(pitch, list);
    this.track(v);
  }

  noteOff(pitch: number, time: number): void {
    const list = this.held.get(pitch);
    if (!list || !list.length) return;
    const v = list.shift()!;
    v.release(time);
    if (!list.length) this.held.delete(pitch);
  }

  playNote(pitch: number, velocity: number, time: number, duration: number): void {
    const v = this.startVoice(pitch, velocity, time);
    if (!v) return;
    v.release(time + Math.max(0.01, duration));
    this.track(v);
  }

  protected track(v: Voice): void {
    this.all.add(v);
    // Garbage-collect finished voices occasionally.
    if (this.all.size > 64) {
      const now = this.ctx.currentTime;
      for (const x of this.all) if (x.endTime < now) this.all.delete(x);
    }
  }

  allNotesOff(time: number): void {
    for (const v of this.all) v.stopHard(time);
    this.all.clear();
    this.held.clear();
  }

  setParams(params: Record<string, number>): void {
    this.params = { ...params };
  }

  protected p(name: string, def: number): number {
    const v = this.params[name];
    return v === undefined ? def : v;
  }

  dispose(): void {
    this.allNotesOff(this.ctx.currentTime);
    this.output.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Sampler
// ---------------------------------------------------------------------------

export interface SamplerDef {
  /** MIDI pitch → URL */
  samples: Record<number, string>;
  attack?: number;
  release?: number;
  gain?: number;
  /** Velocity-dependent lowpass for more natural dynamics. */
  velocityFilter?: boolean;
  /** If true notes ring out for the full sample even after release (plucked/struck). */
  oneShot?: boolean;
  /** Loop the sustain portion of samples (for organs / bowed strings). */
  loop?: { start: number; end: number };
  minPitch?: number;
  maxPitch?: number;
  /** Pan notes across the stereo field by pitch (0..1), like sitting at a piano. */
  spread?: number;
}

export class SamplerInstrument extends BaseInstrument {
  private buffers = new Map<number, AudioBuffer>();
  private def: SamplerDef;
  private sortedRoots: number[] = [];

  constructor(ctx: BaseAudioContext, def: SamplerDef, preloaded?: Map<number, AudioBuffer>) {
    super(ctx);
    this.def = def;
    this.output.gain.value = def.gain ?? 1;
    if (preloaded) {
      this.buffers = preloaded;
      this.sortedRoots = [...preloaded.keys()].sort((a, b) => a - b);
    } else {
      this.ready = Promise.all(
        Object.entries(def.samples).map(async ([p, url]) => {
          try {
            this.buffers.set(Number(p), await loadBuffer(url));
          } catch (e) {
            console.warn('sample failed', url, e);
          }
        }),
      ).then(() => {
        this.sortedRoots = [...this.buffers.keys()].sort((a, b) => a - b);
      });
    }
  }

  private nearest(pitch: number): number | null {
    const roots = this.sortedRoots;
    if (!roots.length) return null;
    let best = roots[0];
    let bestD = Infinity;
    for (const r of roots) {
      // Prefer pitching samples down slightly (sounds more natural than up).
      const d = Math.abs(pitch - r) + (r < pitch ? 0.1 : 0);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  protected startVoice(pitch: number, velocity: number, time: number): Voice | null {
    const root = this.nearest(pitch);
    if (root === null) return null;
    const buf = this.buffers.get(root)!;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Round-robin humanisation: tiny random detune so repeated notes don't sound machine-gunned.
    const humanCents = (Math.random() - 0.5) * 6;
    src.playbackRate.value = Math.pow(2, (pitch - root + this.p('tune', 0) + humanCents / 100) / 12);
    if (this.def.loop) {
      src.loop = true;
      src.loopStart = Math.min(this.def.loop.start, buf.duration * 0.5);
      src.loopEnd = Math.min(this.def.loop.end, buf.duration - 0.02);
    }
    const g = ctx.createGain();
    const attack = this.p('attack', this.def.attack ?? 0.002);
    const release = this.p('release', this.def.release ?? 0.4);
    const peak = velGain(velocity) * (1 + (Math.random() - 0.5) * 0.18);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + Math.max(0.002, attack));
    let last: AudioNode = src;
    if (this.def.velocityFilter !== false) {
      const tone = this.p('tone', 0.5);
      const cutoff = 900 + Math.pow(velocity, 1.5) * 9000 * (0.4 + tone * 1.2) + tone * 3000;
      // Skip the per-note filter when it would be inaudible (saves CPU on dense parts).
      if (cutoff < 14000) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        f.Q.value = 0.3;
        src.connect(f);
        last = f;
      }
    }
    last.connect(g);
    if (this.def.spread) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, ((pitch - 64) / 36) * this.def.spread));
      g.connect(pan);
      pan.connect(this.output);
    } else {
      g.connect(this.output);
    }
    src.start(time);
    const naturalEnd = this.def.loop ? Infinity : time + buf.duration / src.playbackRate.value;
    let ended = false;
    const voice: Voice = {
      endTime: naturalEnd,
      release: (t: number) => {
        if (ended) return;
        ended = true;
        if (this.def.oneShot) return;
        const at = Math.max(t, time + attack);
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(peak, at);
        g.gain.setTargetAtTime(0, at, release / 4);
        const stopAt = at + release * 1.25 + 0.05; // ≈ -43 dB
        voice.endTime = Math.min(naturalEnd, stopAt);
        try {
          src.stop(stopAt);
        } catch {
          /* already stopped */
        }
      },
      stopHard: (t: number) => {
        ended = true;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.015);
        try {
          src.stop(t + 0.1);
        } catch {
          /* noop */
        }
      },
    };
    src.onended = () => {
      g.disconnect();
    };
    return voice;
  }
}

// ---------------------------------------------------------------------------
// Synth
// ---------------------------------------------------------------------------

export interface OscDef {
  type: OscillatorType;
  octave?: number;
  detune?: number; // cents
  gain?: number;
  /** Unison voices for this oscillator (supersaw style). */
  unison?: number;
  spread?: number; // cents
}

export interface Env {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface SynthDef {
  oscs: OscDef[];
  noise?: number; // gain of white-noise layer
  filter: { type: BiquadFilterType; cutoff: number; q: number; envAmount: number; env: Env; keyTrack?: number };
  amp: Env;
  fm?: { ratio: number; index: number; decay: number; sustain?: number };
  vibrato?: { rate: number; depth: number; delay?: number };
  gain?: number;
  mono?: boolean;
  glide?: number;
}

let noiseBufferCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBufferCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufferCache.set(ctx, b);
  }
  return b;
}
export function resetNoiseCache(): void {
  noiseBufferCache = new WeakMap();
}

export class SynthInstrument extends BaseInstrument {
  private def: SynthDef;
  constructor(ctx: BaseAudioContext, def: SynthDef) {
    super(ctx);
    this.def = def;
    this.output.gain.value = def.gain ?? 0.5;
  }

  protected startVoice(pitch: number, velocity: number, time: number): Voice | null {
    const ctx = this.ctx;
    const def = this.def;
    const freq = midiToFreq(pitch + this.p('tune', 0));
    const amp = {
      ...def.amp,
      attack: this.p('attack', def.amp.attack),
      release: this.p('release', def.amp.release),
    };
    const cutoffMul = Math.pow(2, (this.p('cutoff', 0.5) - 0.5) * 6); // ±3 octaves
    const resonance = def.filter.q * (0.25 + this.p('resonance', 0.5) * 1.5);
    const detuneAmt = this.p('detune', 0.5) * 2;

    const vca = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = def.filter.type;
    filter.Q.value = resonance;
    const keyTrack = def.filter.keyTrack ?? 0.5;
    const baseCut = Math.min(18000, def.filter.cutoff * cutoffMul * Math.pow(freq / 261.6, keyTrack));
    const envTop = Math.min(18000, baseCut * Math.pow(2, def.filter.envAmount * (0.4 + velocity * 0.6)));
    const fe = def.filter.env;
    filter.frequency.setValueAtTime(baseCut, time);
    filter.frequency.linearRampToValueAtTime(envTop, time + Math.max(0.003, fe.attack));
    filter.frequency.setTargetAtTime(baseCut + (envTop - baseCut) * fe.sustain, time + fe.attack, Math.max(0.01, fe.decay / 3));

    const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
    const mix = ctx.createGain();
    mix.connect(filter);
    filter.connect(vca);
    vca.connect(this.output);

    // Vibrato LFO
    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    const vibDepth = (def.vibrato?.depth ?? 0) + this.p('vibrato', 0) * 30;
    if (vibDepth > 0) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = def.vibrato?.rate ?? 5.5;
      lfoGain = ctx.createGain();
      const delay = def.vibrato?.delay ?? 0.25;
      lfoGain.gain.setValueAtTime(0, time);
      lfoGain.gain.linearRampToValueAtTime(vibDepth, time + delay + 0.3);
      lfo.connect(lfoGain);
      lfo.start(time);
      sources.push(lfo);
    }

    // FM modulator
    let mod: OscillatorNode | null = null;
    let modGain: GainNode | null = null;
    if (def.fm) {
      mod = ctx.createOscillator();
      mod.frequency.value = freq * def.fm.ratio;
      modGain = ctx.createGain();
      const idx = def.fm.index * freq * (0.4 + velocity * 0.8);
      modGain.gain.setValueAtTime(idx, time);
      modGain.gain.setTargetAtTime(idx * (def.fm.sustain ?? 0.1), time, def.fm.decay / 3);
      mod.connect(modGain);
      mod.start(time);
      sources.push(mod);
    }

    for (const o of def.oscs) {
      const n = o.unison ?? 1;
      const spread = (o.spread ?? 0) * detuneAmt;
      const og = ctx.createGain();
      og.gain.value = (o.gain ?? 1) / Math.sqrt(n);
      og.connect(mix);
      // Unison voices alternate hard left/right for a wide stereo image.
      let stereo: ChannelMergerNode | null = null;
      if (n > 1) {
        stereo = ctx.createChannelMerger(2);
        stereo.connect(og);
      }
      for (let i = 0; i < n; i++) {
        const osc = ctx.createOscillator();
        osc.type = o.type;
        osc.frequency.value = freq * Math.pow(2, o.octave ?? 0);
        const spreadOff = n > 1 ? (i / (n - 1) - 0.5) * 2 * spread : 0;
        osc.detune.value = (o.detune ?? 0) * (o.unison ? 1 : detuneAmt) + spreadOff;
        if (modGain) modGain.connect(osc.frequency);
        if (lfoGain) lfoGain.connect(osc.detune);
        if (stereo) osc.connect(stereo, 0, i % 2);
        else osc.connect(og);
        osc.start(time);
        sources.push(osc);
      }
    }
    if (def.noise) {
      const ns = ctx.createBufferSource();
      ns.buffer = noiseBuffer(ctx);
      ns.loop = true;
      const ng = ctx.createGain();
      ng.gain.value = def.noise;
      ns.connect(ng);
      ng.connect(mix);
      ns.start(time, Math.random());
      sources.push(ns);
    }

    const peak = velGain(velocity);
    const a = Math.max(0.002, amp.attack);
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(peak, time + a);
    vca.gain.setTargetAtTime(peak * amp.sustain, time + a, Math.max(0.005, amp.decay / 3));

    let ended = false;
    const stopAll = (t: number) => {
      for (const s of sources) {
        try {
          s.stop(t);
        } catch {
          /* noop */
        }
      }
    };
    const voice: Voice = {
      endTime: Infinity,
      release: (t: number) => {
        if (ended) return;
        ended = true;
        const at = Math.max(t, time + 0.005);
        // Compute the envelope value at release time approximately.
        vca.gain.cancelScheduledValues(at);
        const elapsed = at - time;
        const lvl =
          elapsed < a ? (peak * elapsed) / a : peak * amp.sustain + (peak - peak * amp.sustain) * Math.exp(-(elapsed - a) / Math.max(0.005, amp.decay / 3));
        vca.gain.setValueAtTime(lvl, at);
        vca.gain.setTargetAtTime(0, at, Math.max(0.005, amp.release / 4));
        filter.frequency.cancelScheduledValues(at);
        filter.frequency.setTargetAtTime(baseCut, at, Math.max(0.01, fe.release / 4));
        const end = at + amp.release * 1.25 + 0.05; // ≈ -43 dB
        voice.endTime = end;
        stopAll(end);
      },
      stopHard: (t: number) => {
        ended = true;
        vca.gain.cancelScheduledValues(t);
        vca.gain.setTargetAtTime(0, t, 0.01);
        stopAll(t + 0.08);
        voice.endTime = t + 0.08;
      },
    };
    sources[sources.length - 1].onended = () => {
      vca.disconnect();
    };
    return voice;
  }
}

// ---------------------------------------------------------------------------
// Drum kit
// ---------------------------------------------------------------------------

export type DrumSynthFlavor = '808' | '909' | 'acoustic' | 'lofi';

export interface DrumKitDef {
  /** pitch → sample URL for sampled pieces */
  samples?: Record<number, string>;
  /** flavour used to synthesise pieces that are not sampled */
  synth: DrumSynthFlavor;
  gain?: number;
}

const synthDrumCache = new Map<string, Promise<AudioBuffer>>();

export function synthDrum(flavor: DrumSynthFlavor, pitch: number): Promise<AudioBuffer> {
  const key = flavor + ':' + pitch;
  let p = synthDrumCache.get(key);
  if (!p) {
    p = renderDrum(flavor, pitch);
    synthDrumCache.set(key, p);
  }
  return p;
}

async function renderDrum(flavor: DrumSynthFlavor, pitch: number): Promise<AudioBuffer> {
  const dur = [49, 51, 46, 57].includes(pitch) ? 2.2 : pitch === 36 || pitch === 35 ? 1.4 : 0.9;
  const rate = 44100;
  const c = new OfflineAudioContext(1, Math.floor(rate * dur), rate);
  const out = c.createGain();
  out.connect(c.destination);
  const noise = () => {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c);
    return s;
  };
  const env = (g: GainNode, peak: number, decay: number, t0 = 0, attack = 0.001) => {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + attack + decay);
  };
  const is808 = flavor === '808';
  const is909 = flavor === '909';
  const lofi = flavor === 'lofi';

  switch (pitch) {
    case 35:
    case 36: {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      const f0 = is808 ? 52 : is909 ? 55 : 60;
      o.frequency.setValueAtTime(is808 ? 170 : 230, 0);
      o.frequency.exponentialRampToValueAtTime(f0, is808 ? 0.07 : 0.04);
      env(g, 1, is808 ? 1.1 : is909 ? 0.45 : 0.35);
      const shaper = c.createWaveShaper();
      shaper.curve = driveCurve(is909 ? 2.5 : 1.4);
      o.connect(g);
      g.connect(shaper);
      shaper.connect(out);
      o.start(0);
      // click
      const n = noise();
      const nf = c.createBiquadFilter();
      nf.type = 'highpass';
      nf.frequency.value = is909 ? 1500 : 3000;
      const ng = c.createGain();
      env(ng, is808 ? 0.15 : 0.45, 0.012);
      n.connect(nf);
      nf.connect(ng);
      ng.connect(out);
      n.start(0);
      break;
    }
    case 37: {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 1700;
      const g = c.createGain();
      env(g, 0.8, 0.035);
      const n = noise();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500;
      const ng = c.createGain();
      env(ng, 0.6, 0.025);
      o.connect(g);
      g.connect(out);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(out);
      o.start(0);
      n.start(0);
      break;
    }
    case 38:
    case 40: {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(is808 ? 240 : 200, 0);
      o.frequency.exponentialRampToValueAtTime(is808 ? 170 : 150, 0.05);
      const g = c.createGain();
      env(g, 0.7, is808 ? 0.12 : 0.1);
      const n = noise();
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = is808 ? 1800 : 1200;
      const bp = c.createBiquadFilter();
      bp.type = 'peaking';
      bp.frequency.value = 5000;
      bp.gain.value = 6;
      const ng = c.createGain();
      env(ng, is909 ? 0.9 : 0.75, is808 ? 0.16 : lofi ? 0.2 : 0.24);
      o.connect(g);
      g.connect(out);
      n.connect(hp);
      hp.connect(bp);
      bp.connect(ng);
      ng.connect(out);
      o.start(0);
      n.start(0);
      break;
    }
    case 39: {
      const n = noise();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 1.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0, 0);
      for (let i = 0; i < 3; i++) {
        g.gain.setValueAtTime(0.9, i * 0.011);
        g.gain.exponentialRampToValueAtTime(0.1, i * 0.011 + 0.009);
      }
      g.gain.setValueAtTime(0.9, 0.034);
      g.gain.exponentialRampToValueAtTime(0.001, 0.034 + (lofi ? 0.25 : 0.2));
      n.connect(bp);
      bp.connect(g);
      g.connect(out);
      n.start(0);
      break;
    }
    case 42:
    case 44:
    case 46:
    case 49:
    case 51: {
      // Metallic: 6 square oscillators at inharmonic ratios (TR-808 style)
      const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
      const base = pitch === 51 ? 60 : 40;
      const mix = c.createGain();
      mix.gain.value = 0.25;
      for (const r of ratios) {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = base * r;
        o.connect(mix);
        o.start(0);
      }
      const n = noise();
      const ng = c.createGain();
      ng.gain.value = pitch === 49 ? 0.9 : 0.5;
      n.connect(ng);
      ng.connect(mix);
      n.start(0);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = pitch === 51 ? 5000 : pitch === 49 ? 4000 : 7000;
      const bp = c.createBiquadFilter();
      bp.type = 'peaking';
      bp.frequency.value = pitch === 51 ? 3500 : 10000;
      bp.gain.value = 6;
      const g = c.createGain();
      const decay = pitch === 42 ? 0.06 : pitch === 44 ? 0.09 : pitch === 46 ? 0.45 : pitch === 49 ? 1.8 : 1.4;
      env(g, pitch === 51 ? 0.5 : 0.75, decay * (lofi ? 0.8 : 1));
      mix.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(out);
      break;
    }
    case 41:
    case 43:
    case 45:
    case 47:
    case 48:
    case 50: {
      const f = { 41: 85, 43: 75, 45: 115, 47: 130, 48: 160, 50: 190 }[pitch]!;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.6, 0);
      o.frequency.exponentialRampToValueAtTime(f, 0.08);
      const g = c.createGain();
      env(g, 0.9, is808 ? 0.6 : 0.4);
      o.connect(g);
      g.connect(out);
      o.start(0);
      const n = noise();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3000;
      const ng = c.createGain();
      env(ng, 0.25, 0.04);
      n.connect(lp);
      lp.connect(ng);
      ng.connect(out);
      n.start(0);
      break;
    }
    case 54:
    case 70: {
      const n = noise();
      const bp = c.createBiquadFilter();
      bp.type = pitch === 70 ? 'highpass' : 'bandpass';
      bp.frequency.value = pitch === 70 ? 6000 : 7000;
      const g = c.createGain();
      env(g, 0.6, pitch === 70 ? 0.07 : 0.18, 0, 0.015);
      n.connect(bp);
      bp.connect(g);
      g.connect(out);
      n.start(0);
      if (pitch === 54) {
        const mix = c.createGain();
        mix.gain.value = 0.08;
        for (const fr of [5200, 7400, 9800]) {
          const o = c.createOscillator();
          o.type = 'square';
          o.frequency.value = fr;
          o.connect(mix);
          o.start(0);
        }
        mix.connect(g);
      }
      break;
    }
    case 56: {
      const mix = c.createGain();
      for (const fr of [540, 800]) {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = fr;
        o.connect(mix);
        o.start(0);
      }
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800;
      bp.Q.value = 2;
      const g = c.createGain();
      env(g, 0.5, 0.3);
      mix.connect(bp);
      bp.connect(g);
      g.connect(out);
      break;
    }
    case 75: {
      const o = c.createOscillator();
      o.frequency.value = 2500;
      const g = c.createGain();
      env(g, 0.6, 0.05);
      o.connect(g);
      g.connect(out);
      o.start(0);
      break;
    }
    default: {
      const o = c.createOscillator();
      o.frequency.value = midiToFreq(pitch);
      const g = c.createGain();
      env(g, 0.5, 0.2);
      o.connect(g);
      g.connect(out);
      o.start(0);
    }
  }
  if (lofi) {
    // Gentle lowpass for a dusty character.
    out.gain.value = 0.9;
  }
  return c.startRendering();
}

export function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  const k = Math.max(0.0001, amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return curve;
}

/** Pitches that are choked (cut off) by others: open hat is choked by closed/pedal hats. */
const CHOKES: Record<number, number[]> = { 42: [46], 44: [46] };

export class DrumKitInstrument extends BaseInstrument {
  private buffers = new Map<number, AudioBuffer>();
  private def: DrumKitDef;
  /** Ringing voices that can be choked (open hats), with their start times. */
  private chokeable: { pitch: number; start: number; voice: Voice }[] = [];

  constructor(ctx: BaseAudioContext, def: DrumKitDef, pitches: number[]) {
    super(ctx);
    this.def = def;
    this.output.gain.value = def.gain ?? 0.9;
    this.ready = Promise.all(
      pitches.map(async (p) => {
        const url = def.samples?.[p];
        try {
          this.buffers.set(p, url ? await loadBuffer(url) : await synthDrum(def.synth, p));
        } catch {
          this.buffers.set(p, await synthDrum(def.synth, p));
        }
      }),
    ).then(() => undefined);
  }

  protected startVoice(pitch: number, velocity: number, time: number): Voice | null {
    const buf = this.buffers.get(pitch);
    if (!buf) {
      // Lazily synthesise unknown pieces.
      synthDrum(this.def.synth, pitch).then((b) => this.buffers.set(pitch, b));
      return null;
    }
    const victims = CHOKES[pitch];
    if (victims) {
      // Notes may be scheduled out of time order (offline export), so only choke
      // voices that have actually started and are still ringing at `time`.
      for (const c of this.chokeable)
        if (victims.includes(c.pitch) && c.start < time && c.voice.endTime > time) {
          c.voice.stopHard(time);
          c.voice.endTime = time + 0.06;
        }
    }
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const tune = this.p('tune', 0) + this.p('tune' + pitch, 0);
    src.playbackRate.value = Math.pow(2, tune / 12);
    const g = ctx.createGain();
    g.gain.value = velGain(velocity) * (this.p('level' + pitch, 1));
    src.connect(g);
    g.connect(this.output);
    src.start(time);
    src.onended = () => g.disconnect();
    const voice: Voice = {
      endTime: time + buf.duration,
      release: () => {
        /* drums ring out */
      },
      stopHard: (t: number) => {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.01);
        try {
          src.stop(t + 0.06);
        } catch {
          /* noop */
        }
      },
    };
    if (pitch === 46) {
      const now = ctx.currentTime;
      this.chokeable = this.chokeable.filter((c) => c.voice.endTime > now);
      this.chokeable.push({ pitch, start: time, voice });
    }
    return voice;
  }
}
