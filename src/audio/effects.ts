// Insert effects for channel strips. Built from native Web Audio nodes only, so they
// run identically in the live AudioContext and in OfflineAudioContext (export).
// Effects are only instantiated while switched on, keeping big sessions cheap.
import type { AmpModel, InsertFx } from '../model/types';

export type InsertKey = keyof InsertFx;

export interface Effect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Apply parameters (smoothly where possible). */
  update(params: unknown): void;
  dispose(): void;
}

/** Order the inserts run in within each slot of the channel. */
export const PRE_INSERTS: InsertKey[] = ['gate', 'amp'];
export const MID_INSERTS: InsertKey[] = ['deesser'];
export const POST_INSERTS: InsertKey[] = ['autowah', 'phaser', 'flanger', 'tremolo', 'lofi'];
export const STEREO_INSERTS: InsertKey[] = ['widener'];

// ------------------------------------------------------------------ helpers

function smooth(ctx: BaseAudioContext, p: AudioParam, v: number, tc = 0.02): void {
  if (!Number.isFinite(v)) return;
  p.setTargetAtTime(v, ctx.currentTime, tc);
}

const curveCache = new Map<string, Float32Array<ArrayBuffer>>();
function cachedCurve(key: string, make: () => Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  let c = curveCache.get(key);
  if (!c) {
    c = make();
    curveCache.set(key, c);
  }
  return c;
}

/** |x| — used to rectify a signal for envelope following. */
function absCurve(): Float32Array<ArrayBuffer> {
  return cachedCurve('abs', () => {
    const n = 2049;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.abs((i / (n - 1)) * 2 - 1);
    return c;
  });
}

/** Envelope follower: rectifier → lowpass. Output ≈ signal amplitude (0..1). */
function envelope(ctx: BaseAudioContext, src: AudioNode, cutoff: number): { node: BiquadFilterNode; nodes: AudioNode[] } {
  const rect = ctx.createWaveShaper();
  rect.curve = absCurve();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  lp.Q.value = 0.5;
  src.connect(rect);
  rect.connect(lp);
  return { node: lp, nodes: [rect, lp] };
}

function dryWet(ctx: BaseAudioContext): { input: GainNode; output: GainNode; dry: GainNode; wet: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry);
  dry.connect(output);
  wet.connect(output);
  return { input, output, dry, wet };
}

function setMix(ctx: BaseAudioContext, dry: GainNode, wet: GainNode, mix: number): void {
  // Equal-power crossfade.
  smooth(ctx, dry.gain, Math.cos((mix * Math.PI) / 2));
  smooth(ctx, wet.gain, Math.sin((mix * Math.PI) / 2));
}

function disconnectAll(nodes: AudioNode[]): void {
  for (const n of nodes) {
    try {
      n.disconnect();
    } catch {
      /* noop */
    }
    if (n instanceof OscillatorNode) {
      try {
        n.stop();
      } catch {
        /* noop */
      }
    }
  }
}

// ------------------------------------------------------------------ Noise gate

class Gate implements Effect {
  input: GainNode;
  output: GainNode;
  private shaper: WaveShaperNode;
  private nodes: AudioNode[];
  private lastThr = NaN;
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.output.gain.value = 0; // driven entirely by the sidechain
    const env = envelope(ctx, this.input, 25);
    // Boost the envelope into the shaper's ±1 domain range for more resolution at low levels.
    const boost = ctx.createGain();
    boost.gain.value = 1;
    this.shaper = ctx.createWaveShaper();
    const smoothLp = ctx.createBiquadFilter();
    smoothLp.type = 'lowpass';
    smoothLp.frequency.value = 18; // ~release smoothing
    env.node.connect(boost);
    boost.connect(this.shaper);
    this.shaper.connect(smoothLp);
    smoothLp.connect(this.output.gain);
    this.input.connect(this.output);
    this.nodes = [...env.nodes, boost, this.shaper, smoothLp, this.input, this.output];
  }
  update(p: NonNullable<InsertFx['gate']>): void {
    if (p.threshold === this.lastThr) return;
    this.lastThr = p.threshold;
    const thr = Math.pow(10, p.threshold / 20);
    this.shaper.curve = cachedCurve('gate' + p.threshold.toFixed(1), () => {
      const n = 4097;
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = Math.abs((i / (n - 1)) * 2 - 1);
        // Soft knee: fully open above threshold, steep fall-off below (-∞ by 1/4 thr).
        const r = x / thr;
        c[i] = r >= 1 ? 1 : Math.pow(Math.max(0, (r - 0.25) / 0.75), 2);
      }
      return c;
    });
  }
  dispose(): void {
    disconnectAll(this.nodes);
    void this.ctx;
  }
}

// ------------------------------------------------------------------ Amp simulator

interface AmpVoicing {
  drive: [number, number]; // pre-gain range (linear)
  stages: number;
  asym: number; // asymmetric clipping amount (tube-like even harmonics)
  hp: number;
  bassF: number;
  midF: number;
  trebleF: number;
  cab: number; // speaker cutoff
  cabRes: number;
  level: number;
}

const AMPS: Record<AmpModel, AmpVoicing> = {
  clean: { drive: [1, 4], stages: 1, asym: 0.05, hp: 70, bassF: 120, midF: 800, trebleF: 3200, cab: 6200, cabRes: 1.2, level: 0.9 },
  crunch: { drive: [3, 18], stages: 1, asym: 0.15, hp: 90, bassF: 110, midF: 700, trebleF: 3000, cab: 5200, cabRes: 2, level: 0.6 },
  british: { drive: [6, 40], stages: 2, asym: 0.2, hp: 110, bassF: 100, midF: 650, trebleF: 2800, cab: 4800, cabRes: 2.4, level: 0.45 },
  highgain: { drive: [15, 110], stages: 2, asym: 0.1, hp: 130, bassF: 90, midF: 500, trebleF: 2600, cab: 4400, cabRes: 2.8, level: 0.35 },
  bass: { drive: [1, 10], stages: 1, asym: 0.12, hp: 35, bassF: 80, midF: 500, trebleF: 2500, cab: 4200, cabRes: 0.9, level: 0.8 },
};

function tubeCurve(asym: number): Float32Array<ArrayBuffer> {
  return cachedCurve('tube' + asym, () => {
    const n = 4096;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const xs = x + asym * x * x; // asymmetry → even harmonics
      c[i] = Math.tanh(2.2 * xs) / Math.tanh(2.2);
    }
    return c;
  });
}

class Amp implements Effect {
  input: GainNode;
  output: GainNode;
  private pre: GainNode;
  private stages: WaveShaperNode[] = [];
  private bass: BiquadFilterNode;
  private mid: BiquadFilterNode;
  private treble: BiquadFilterNode;
  private presence: BiquadFilterNode;
  private cab1: BiquadFilterNode;
  private cab2: BiquadFilterNode;
  private cabPeak: BiquadFilterNode;
  private hp: BiquadFilterNode;
  private level: GainNode;
  private nodes: AudioNode[] = [];
  private model: AmpModel | null = null;
  private ctx: BaseAudioContext;
  private interStage: AudioNode[] = [];

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.pre = ctx.createGain();
    this.bass = ctx.createBiquadFilter();
    this.bass.type = 'lowshelf';
    this.mid = ctx.createBiquadFilter();
    this.mid.type = 'peaking';
    this.mid.Q.value = 0.7;
    this.treble = ctx.createBiquadFilter();
    this.treble.type = 'highshelf';
    this.presence = ctx.createBiquadFilter();
    this.presence.type = 'peaking';
    this.presence.frequency.value = 3800;
    this.presence.Q.value = 1;
    this.cab1 = ctx.createBiquadFilter();
    this.cab1.type = 'lowpass';
    this.cab2 = ctx.createBiquadFilter();
    this.cab2.type = 'lowpass';
    this.cabPeak = ctx.createBiquadFilter();
    this.cabPeak.type = 'peaking';
    this.cabPeak.frequency.value = 2200;
    this.cabPeak.Q.value = 1.4;
    this.cabPeak.gain.value = 3;
    const cabHp = ctx.createBiquadFilter();
    cabHp.type = 'highpass';
    cabHp.frequency.value = 75;
    this.level = ctx.createGain();
    // Tone stack → cabinet → level (the preamp segment is wired in setModel).
    this.bass.connect(this.mid);
    this.mid.connect(this.treble);
    this.treble.connect(this.presence);
    this.presence.connect(cabHp);
    cabHp.connect(this.cab1);
    this.cab1.connect(this.cab2);
    this.cab2.connect(this.cabPeak);
    this.cabPeak.connect(this.level);
    this.level.connect(this.output);
    this.input.connect(this.hp);
    this.hp.connect(this.pre);
    this.nodes = [this.input, this.output, this.hp, this.pre, this.bass, this.mid, this.treble, this.presence, cabHp, this.cab1, this.cab2, this.cabPeak, this.level];
  }

  private setModel(model: AmpModel): void {
    this.model = model;
    const v = AMPS[model];
    try {
      this.pre.disconnect();
    } catch {
      /* noop */
    }
    disconnectAll([...this.stages, ...this.interStage]);
    this.stages = [];
    this.interStage = [];
    let last: AudioNode = this.pre;
    for (let i = 0; i < v.stages; i++) {
      const sh = this.ctx.createWaveShaper();
      sh.curve = tubeCurve(v.asym);
      sh.oversample = '4x';
      last.connect(sh);
      last = sh;
      this.stages.push(sh);
      if (i < v.stages - 1) {
        // Coupling filter + gain between stages tightens the low end like a real preamp.
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 160;
        const g = this.ctx.createGain();
        g.gain.value = 3;
        last.connect(f);
        f.connect(g);
        last = g;
        this.interStage.push(f, g);
      }
    }
    last.connect(this.bass);
    this.hp.frequency.value = v.hp;
    this.bass.frequency.value = v.bassF;
    this.mid.frequency.value = v.midF;
    this.treble.frequency.value = v.trebleF;
    this.cab1.frequency.value = v.cab;
    this.cab1.Q.value = v.cabRes;
    this.cab2.frequency.value = v.cab * 1.4;
    this.cab2.Q.value = 0.7;
  }

  update(p: NonNullable<InsertFx['amp']>): void {
    if (p.model !== this.model) this.setModel(p.model);
    const v = AMPS[p.model];
    const ctx = this.ctx;
    const drive = v.drive[0] * Math.pow(v.drive[1] / v.drive[0], p.gain);
    smooth(ctx, this.pre.gain, drive);
    smooth(ctx, this.bass.gain, (p.bass - 0.5) * 24);
    smooth(ctx, this.mid.gain, (p.mid - 0.5) * 20);
    smooth(ctx, this.treble.gain, (p.treble - 0.5) * 22);
    smooth(ctx, this.presence.gain, (p.presence - 0.5) * 14);
    // Compensate output so higher gain doesn't blow up the level.
    smooth(ctx, this.level.gain, v.level * (0.3 + p.level * 1.4) / Math.pow(drive, 0.15));
  }

  dispose(): void {
    disconnectAll([...this.nodes, ...this.stages, ...this.interStage]);
  }
}

// ------------------------------------------------------------------ De-esser

class DeEsser implements Effect {
  input: GainNode;
  output: GainNode;
  private amt: GainNode;
  private nodes: AudioNode[];
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    const lo = ctx.createBiquadFilter();
    lo.type = 'lowpass';
    lo.frequency.value = 5500;
    lo.Q.value = 0.5;
    const hi = ctx.createBiquadFilter();
    hi.type = 'highpass';
    hi.frequency.value = 5500;
    hi.Q.value = 0.5;
    const hiGain = ctx.createGain();
    hiGain.gain.value = 1;
    this.input.connect(lo);
    this.input.connect(hi);
    lo.connect(this.output);
    hi.connect(hiGain);
    hiGain.connect(this.output);
    // Sidechain: sibilance band envelope reduces the high band.
    const sc = ctx.createBiquadFilter();
    sc.type = 'bandpass';
    sc.frequency.value = 7000;
    sc.Q.value = 1.2;
    this.input.connect(sc);
    const env = envelope(ctx, sc, 40);
    this.amt = ctx.createGain();
    const clamp = ctx.createWaveShaper();
    clamp.curve = cachedCurve('deessclamp', () => {
      const n = 1025;
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        c[i] = -Math.min(0.85, Math.max(0, x)); // reduction amount (negative gain offset)
      }
      return c;
    });
    env.node.connect(this.amt);
    this.amt.connect(clamp);
    clamp.connect(hiGain.gain);
    this.nodes = [this.input, this.output, lo, hi, hiGain, sc, ...env.nodes, this.amt, clamp];
  }
  update(p: NonNullable<InsertFx['deesser']>): void {
    smooth(this.ctx, this.amt.gain, p.amount * 12);
  }
  dispose(): void {
    disconnectAll(this.nodes);
  }
}

// ------------------------------------------------------------------ Auto-wah / auto-filter

class AutoWah implements Effect {
  input: GainNode;
  output: GainNode;
  private filter: BiquadFilterNode;
  private envAmt: GainNode;
  private lfo: OscillatorNode;
  private lfoAmt: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private nodes: AudioNode[];
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const dw = dryWet(ctx);
    this.input = dw.input;
    this.output = dw.output;
    this.dry = dw.dry;
    this.wet = dw.wet;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    const makeup = ctx.createGain();
    makeup.gain.value = 2.2;
    this.input.connect(this.filter);
    this.filter.connect(makeup);
    makeup.connect(this.wet);
    const env = envelope(ctx, this.input, 14);
    this.envAmt = ctx.createGain();
    env.node.connect(this.envAmt);
    this.envAmt.connect(this.filter.frequency);
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoAmt = ctx.createGain();
    this.lfo.connect(this.lfoAmt);
    this.lfoAmt.connect(this.filter.frequency);
    this.lfo.start();
    this.nodes = [this.input, this.output, this.dry, this.wet, this.filter, makeup, ...env.nodes, this.envAmt, this.lfo, this.lfoAmt];
  }
  update(p: NonNullable<InsertFx['autowah']>): void {
    const ctx = this.ctx;
    const base = 250 * Math.pow(12, p.base); // 250 Hz … 3 kHz
    smooth(ctx, this.filter.frequency, base);
    smooth(ctx, this.filter.Q, 1 + p.q * 12);
    const env = p.mode === 'envelope';
    smooth(ctx, this.envAmt.gain, env ? p.sensitivity * 9000 : 0);
    smooth(ctx, this.lfoAmt.gain, env ? 0 : base * 0.9 * p.sensitivity + 200);
    smooth(ctx, this.lfo.frequency, 0.1 + p.rate * 8);
    setMix(ctx, this.dry, this.wet, p.mix);
  }
  dispose(): void {
    disconnectAll(this.nodes);
  }
}

// ------------------------------------------------------------------ Phaser

class Phaser implements Effect {
  input: GainNode;
  output: GainNode;
  private stages: BiquadFilterNode[] = [];
  private lfo: OscillatorNode;
  private lfoAmt: GainNode;
  private fb: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private nodes: AudioNode[];
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const dw = dryWet(ctx);
    this.input = dw.input;
    this.output = dw.output;
    this.dry = dw.dry;
    this.wet = dw.wet;
    this.lfo = ctx.createOscillator();
    this.lfoAmt = ctx.createGain();
    this.lfo.connect(this.lfoAmt);
    const sum = ctx.createGain();
    this.input.connect(sum);
    let last: AudioNode = sum;
    const base = [400, 900, 1600, 2600, 3800, 5200];
    for (const f of base) {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      ap.frequency.value = f;
      ap.Q.value = 0.6;
      this.lfoAmt.connect(ap.detune);
      last.connect(ap);
      last = ap;
      this.stages.push(ap);
    }
    last.connect(this.wet);
    // Feedback loop needs a delay node to be legal in the Web Audio graph.
    this.fb = ctx.createGain();
    const fbDelay = ctx.createDelay(0.01);
    fbDelay.delayTime.value = 0.0005;
    last.connect(this.fb);
    this.fb.connect(fbDelay);
    fbDelay.connect(sum);
    this.lfo.start();
    this.nodes = [this.input, this.output, this.dry, this.wet, this.lfo, this.lfoAmt, sum, ...this.stages, this.fb, fbDelay];
  }
  update(p: NonNullable<InsertFx['phaser']>): void {
    const ctx = this.ctx;
    smooth(ctx, this.lfo.frequency, 0.05 + p.rate * 4);
    smooth(ctx, this.lfoAmt.gain, 300 + p.depth * 2100); // cents of sweep
    smooth(ctx, this.fb.gain, p.feedback * 0.7);
    setMix(ctx, this.dry, this.wet, p.mix * 0.5 + 0.0001);
  }
  dispose(): void {
    disconnectAll(this.nodes);
  }
}

// ------------------------------------------------------------------ Flanger

class Flanger implements Effect {
  input: GainNode;
  output: GainNode;
  private delay: DelayNode;
  private lfo: OscillatorNode;
  private lfoAmt: GainNode;
  private fb: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private nodes: AudioNode[];
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const dw = dryWet(ctx);
    this.input = dw.input;
    this.output = dw.output;
    this.dry = dw.dry;
    this.wet = dw.wet;
    this.delay = ctx.createDelay(0.03);
    this.delay.delayTime.value = 0.004;
    this.lfo = ctx.createOscillator();
    this.lfoAmt = ctx.createGain();
    this.lfo.connect(this.lfoAmt);
    this.lfoAmt.connect(this.delay.delayTime);
    this.fb = ctx.createGain();
    this.input.connect(this.delay);
    this.delay.connect(this.wet);
    this.delay.connect(this.fb);
    this.fb.connect(this.delay);
    this.lfo.start();
    this.nodes = [this.input, this.output, this.dry, this.wet, this.delay, this.lfo, this.lfoAmt, this.fb];
  }
  update(p: NonNullable<InsertFx['flanger']>): void {
    const ctx = this.ctx;
    smooth(ctx, this.lfo.frequency, 0.05 + p.rate * 3);
    smooth(ctx, this.lfoAmt.gain, 0.0005 + p.depth * 0.0033);
    smooth(ctx, this.fb.gain, p.feedback * 0.85);
    setMix(ctx, this.dry, this.wet, p.mix * 0.5 + 0.0001);
  }
  dispose(): void {
    disconnectAll(this.nodes);
  }
}

// ------------------------------------------------------------------ Tremolo

class Tremolo implements Effect {
  input: GainNode;
  output: GainNode;
  private lfo: OscillatorNode;
  private lfoAmt: GainNode;
  private nodes: AudioNode[];
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoAmt = ctx.createGain();
    this.lfo.connect(this.lfoAmt);
    this.lfoAmt.connect(this.output.gain);
    this.input.connect(this.output);
    this.lfo.start();
    this.nodes = [this.input, this.output, this.lfo, this.lfoAmt];
  }
  update(p: NonNullable<InsertFx['tremolo']>): void {
    const ctx = this.ctx;
    smooth(ctx, this.lfo.frequency, 0.5 + p.rate * 11.5);
    smooth(ctx, this.output.gain, 1 - p.depth / 2);
    smooth(ctx, this.lfoAmt.gain, p.depth / 2);
  }
  dispose(): void {
    disconnectAll(this.nodes);
  }
}

// ------------------------------------------------------------------ Lo-fi / bitcrusher

class LoFi implements Effect {
  input: GainNode;
  output: GainNode;
  private shaper: WaveShaperNode;
  private tone: BiquadFilterNode;
  private dry: GainNode;
  private wet: GainNode;
  private nodes: AudioNode[];
  private lastBits = -1;
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const dw = dryWet(ctx);
    this.input = dw.input;
    this.output = dw.output;
    this.dry = dw.dry;
    this.wet = dw.wet;
    this.shaper = ctx.createWaveShaper();
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.Q.value = 0.9;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 150;
    this.input.connect(this.shaper);
    this.shaper.connect(this.tone);
    this.tone.connect(hp);
    hp.connect(this.wet);
    this.nodes = [this.input, this.output, this.dry, this.wet, this.shaper, this.tone, hp];
  }
  update(p: NonNullable<InsertFx['lofi']>): void {
    const bits = Math.round(Math.max(2, Math.min(16, p.bits)));
    if (bits !== this.lastBits) {
      this.lastBits = bits;
      this.shaper.curve = cachedCurve('crush' + bits, () => {
        const n = 16384;
        const c = new Float32Array(n);
        const steps = Math.pow(2, bits - 1);
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * 2 - 1;
          c[i] = Math.round(x * steps) / steps;
        }
        return c;
      });
    }
    smooth(this.ctx, this.tone.frequency, 1200 * Math.pow(12, p.tone));
    setMix(this.ctx, this.dry, this.wet, p.mix);
  }
  dispose(): void {
    disconnectAll(this.nodes);
  }
}

// ------------------------------------------------------------------ Stereo widener

class Widener implements Effect {
  input: GainNode;
  output: GainNode;
  private sideAmt: GainNode;
  private haasDelay: DelayNode;
  private haasAmt: GainNode;
  private nodes: AudioNode[];
  private ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.input.channelCount = 2;
    this.input.channelCountMode = 'explicit';
    this.output = ctx.createGain();
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const mid = ctx.createGain();
    const side = ctx.createGain();
    const lToMid = ctx.createGain();
    lToMid.gain.value = 0.5;
    const rToMid = ctx.createGain();
    rToMid.gain.value = 0.5;
    const lToSide = ctx.createGain();
    lToSide.gain.value = 0.5;
    const rToSide = ctx.createGain();
    rToSide.gain.value = -0.5;
    this.sideAmt = ctx.createGain();
    const sideNeg = ctx.createGain();
    sideNeg.gain.value = -1;
    this.input.connect(split);
    split.connect(lToMid, 0);
    split.connect(rToMid, 1);
    split.connect(lToSide, 0);
    split.connect(rToSide, 1);
    lToMid.connect(mid);
    rToMid.connect(mid);
    lToSide.connect(side);
    rToSide.connect(side);
    // Haas: a short delayed copy of the mid added to the side creates width from mono sources.
    this.haasDelay = ctx.createDelay(0.05);
    this.haasAmt = ctx.createGain();
    mid.connect(this.haasDelay);
    this.haasDelay.connect(this.haasAmt);
    this.haasAmt.connect(side);
    side.connect(this.sideAmt);
    mid.connect(merge, 0, 0);
    mid.connect(merge, 0, 1);
    this.sideAmt.connect(merge, 0, 0);
    this.sideAmt.connect(sideNeg);
    sideNeg.connect(merge, 0, 1);
    merge.connect(this.output);
    this.nodes = [this.input, this.output, split, merge, mid, side, lToMid, rToMid, lToSide, rToSide, this.sideAmt, sideNeg, this.haasDelay, this.haasAmt];
  }
  update(p: NonNullable<InsertFx['widener']>): void {
    smooth(this.ctx, this.sideAmt.gain, p.width * 2); // 0.5 → unchanged, 1 → double width
    smooth(this.ctx, this.haasDelay.delayTime, 0.004 + p.haas * 0.018);
    smooth(this.ctx, this.haasAmt.gain, p.haas * 0.45);
  }
  dispose(): void {
    disconnectAll(this.nodes);
  }
}

// ------------------------------------------------------------------ factory & chain

export function createEffect(ctx: BaseAudioContext, key: InsertKey): Effect {
  switch (key) {
    case 'gate':
      return new Gate(ctx);
    case 'amp':
      return new Amp(ctx);
    case 'deesser':
      return new DeEsser(ctx);
    case 'autowah':
      return new AutoWah(ctx);
    case 'phaser':
      return new Phaser(ctx);
    case 'flanger':
      return new Flanger(ctx);
    case 'tremolo':
      return new Tremolo(ctx);
    case 'lofi':
      return new LoFi(ctx);
    case 'widener':
      return new Widener(ctx);
  }
}

/**
 * A slot between two fixed nodes holding zero or more insert effects in a fixed order.
 * The graph is only rewired when the set of enabled effects changes.
 */
export class InsertChain {
  private ctx: BaseAudioContext;
  /** Dedicated entry/exit nodes so rewiring never touches other connections. */
  readonly input: GainNode;
  readonly output: GainNode;
  private order: InsertKey[];
  private active = new Map<InsertKey, Effect>();
  private signature = '';

  constructor(ctx: BaseAudioContext, order: InsertKey[]) {
    this.ctx = ctx;
    this.order = order;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.input.connect(this.output);
  }

  update(inserts: InsertFx | undefined): void {
    const enabled = this.order.filter((k) => inserts?.[k]?.on);
    const sig = enabled.join(',');
    if (sig !== this.signature) {
      this.signature = sig;
      for (const [k, fx] of this.active) {
        if (!enabled.includes(k)) {
          fx.dispose();
          this.active.delete(k);
        }
      }
      for (const k of enabled) if (!this.active.has(k)) this.active.set(k, createEffect(this.ctx, k));
      this.input.disconnect();
      for (const fx of this.active.values()) fx.output.disconnect();
      let last: AudioNode = this.input;
      for (const k of enabled) {
        const fx = this.active.get(k)!;
        last.connect(fx.input);
        last = fx.output;
      }
      last.connect(this.output);
    }
    for (const k of enabled) this.active.get(k)!.update(inserts![k]);
  }

  get activeCount(): number {
    return this.active.size;
  }

  dispose(): void {
    for (const fx of this.active.values()) fx.dispose();
    this.active.clear();
    this.input.disconnect();
    this.output.disconnect();
  }
}

// ------------------------------------------------------------------ defaults & presets

export const INSERT_DEFAULTS: { [K in InsertKey]-?: NonNullable<InsertFx[K]> } = {
  gate: { on: true, threshold: -50 },
  amp: { on: true, model: 'crunch', gain: 0.5, bass: 0.5, mid: 0.55, treble: 0.55, presence: 0.5, level: 0.5 },
  deesser: { on: true, amount: 0.5 },
  autowah: { on: true, mode: 'envelope', sensitivity: 0.5, rate: 0.3, base: 0.25, q: 0.5, mix: 0.8 },
  phaser: { on: true, rate: 0.2, depth: 0.6, feedback: 0.4, mix: 0.7 },
  flanger: { on: true, rate: 0.15, depth: 0.6, feedback: 0.5, mix: 0.6 },
  tremolo: { on: true, rate: 0.4, depth: 0.5 },
  lofi: { on: true, bits: 8, tone: 0.4, mix: 0.7 },
  widener: { on: true, width: 0.75, haas: 0.3 },
};

export const INSERT_LABELS: Record<InsertKey, string> = {
  gate: 'Noise Gate',
  amp: 'Amp',
  deesser: 'De-Esser',
  autowah: 'Auto-Wah',
  phaser: 'Phaser',
  flanger: 'Flanger',
  tremolo: 'Tremolo',
  lofi: 'Bitcrusher',
  widener: 'Stereo Width',
};

export const AMP_MODELS: { id: AmpModel; label: string }[] = [
  { id: 'clean', label: 'Clean Combo' },
  { id: 'crunch', label: 'Crunch' },
  { id: 'british', label: 'British Stack' },
  { id: 'highgain', label: 'High Gain' },
  { id: 'bass', label: 'Bass Amp' },
];
