// Audio graph: per-track channel strips, effect buses and master bus.
// Context-agnostic so the same graph renders live and offline (export).
import { DEFAULT_SAMPLER, type AutomationParam, type AutomationPoint, type MasteringSettings, type Project, type Track } from '../model/types';
import { DRUM_LANES } from '../model/music';
import { makeImpulse } from './context';
import { getBuffer } from './audioStore';
import { DrumKitInstrument, SamplerInstrument, SynthInstrument, UserSamplerInstrument, driveCurve, type Instrument } from './instruments';
import { getPreset } from './presets';
import { InsertChain, MID_INSERTS, POST_INSERTS, PRE_INSERTS, STEREO_INSERTS } from './effects';
import { filterHz } from '../model/automation';

/** Send levels at full reverb / echo (shared with automation). */
export const REVERB_SEND = 0.9;
export const DELAY_SEND = 0.8;

function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 4096;
  const c = new Float32Array(n);
  const knee = 0.85;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 4 - 2; // input range ±2
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
    c[i] = Math.sign(x) * Math.min(y, 0.995);
  }
  return c;
}

export const DEFAULT_MASTERING: MasteringSettings = { preset: 'Clean', low: 0, mid: 0, high: 0, glue: 0.3, ceiling: -1, loudness: 0 };

export const MASTERING_PRESETS: MasteringSettings[] = [
  DEFAULT_MASTERING,
  { preset: 'Loud', low: 1.5, mid: 0, high: 1.5, glue: 0.7, ceiling: -0.5, loudness: 5 },
  { preset: 'Warm', low: 2.5, mid: -0.5, high: -2, glue: 0.5, ceiling: -1, loudness: 2 },
  { preset: 'Bright', low: -0.5, mid: 0.5, high: 3.5, glue: 0.45, ceiling: -1, loudness: 2.5 },
  { preset: 'Lo-Fi', low: 2, mid: 2, high: -7, glue: 0.8, ceiling: -2, loudness: 3 },
  { preset: 'Gentle', low: 0.5, mid: 0, high: 0.8, glue: 0.2, ceiling: -1.5, loudness: 0 },
];

export function faderGain(v: number): number {
  return Math.pow(Math.max(0, v) / 0.8, 2);
}

export function automationValueAt(points: AutomationPoint[], beat: number, fallback: number): number {
  if (!points.length) return fallback;
  if (beat <= points[0].beat) return points[0].value;
  const last = points[points.length - 1];
  if (beat >= last.beat) return last.value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (beat <= b.beat) {
      const t = b.beat === a.beat ? 1 : (beat - a.beat) / (b.beat - a.beat);
      return a.value + (b.value - a.value) * t;
    }
  }
  return last.value;
}

const DELAY_DIV: Record<Project['delayTime'], number> = { '1/4': 1, '1/8': 0.5, '1/8d': 0.75, '1/16': 0.25, '1/4d': 1.5 };
const REVERB: Record<Project['reverbType'], [number, number, number, number]> = {
  // seconds, decay power, predelay, brightness
  room: [1.1, 3.2, 0.005, 0.7],
  plate: [2.0, 2.6, 0.01, 0.95],
  hall: [3.0, 2.4, 0.025, 0.6],
  cathedral: [5.5, 2.0, 0.04, 0.45],
};

export class Channel {
  readonly input: GainNode;
  readonly filter: BiquadFilterNode;
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  private comp: DynamicsCompressorNode;
  private compMakeup: GainNode;
  private driveDry: GainNode;
  private driveWet: GainNode;
  private shaper: WaveShaperNode;
  private chorusWet: GainNode;
  private chorusL: DelayNode;
  private chorusR: DelayNode;
  private chorusLfo: OscillatorNode;
  readonly autoGain: GainNode;
  readonly fader: GainNode;
  readonly panner: StereoPannerNode;
  readonly muteGain: GainNode;
  readonly analyser: AnalyserNode;
  /** Parameters currently driven by automation lanes. */
  private automated = new Set<AudioParam>();
  readonly reverbSend: GainNode;
  readonly delaySend: GainNode;
  instrument: Instrument | null = null;
  instrumentKey = '';
  private lastDrive = -1;
  /** Optional connections that are only made while the stage is in use (saves CPU). */
  private links = new Map<string, boolean>();
  private preOut!: AudioNode;
  private postOut!: AudioNode;
  private ctx: BaseAudioContext;
  private chains: InsertChain[];

  constructor(ctx: BaseAudioContext, mixer: Mixer) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 220;
    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1200;
    this.eqMid.Q.value = 0.8;
    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 5000;
    this.comp = ctx.createDynamicsCompressor();
    this.compMakeup = ctx.createGain();
    this.driveDry = ctx.createGain();
    this.driveWet = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '2x';
    const driveSum = ctx.createGain();
    const chorusSum = ctx.createGain();
    this.chorusWet = ctx.createGain();
    this.chorusWet.gain.value = 0;
    this.chorusL = ctx.createDelay(0.05);
    this.chorusR = ctx.createDelay(0.05);
    this.chorusL.delayTime.value = 0.012;
    this.chorusR.delayTime.value = 0.017;
    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.frequency.value = 0.8;
    const lfoL = ctx.createGain();
    lfoL.gain.value = 0.003;
    const lfoR = ctx.createGain();
    lfoR.gain.value = -0.003;
    this.chorusLfo.connect(lfoL);
    this.chorusLfo.connect(lfoR);
    lfoL.connect(this.chorusL.delayTime);
    lfoR.connect(this.chorusR.delayTime);
    this.chorusLfo.start();
    const merger = ctx.createChannelMerger(2);
    this.autoGain = ctx.createGain();
    this.fader = ctx.createGain();
    this.panner = ctx.createStereoPanner();
    this.muteGain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.reverbSend = ctx.createGain();
    this.delaySend = ctx.createGain();

    const pre = new InsertChain(ctx, PRE_INSERTS);
    const mid = new InsertChain(ctx, MID_INSERTS);
    const post = new InsertChain(ctx, POST_INSERTS);
    const stereo = new InsertChain(ctx, STEREO_INSERTS);
    this.chains = [pre, mid, post, stereo];
    this.input.connect(pre.input);
    this.preOut = pre.output;
    this.filter.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(mid.input);
    mid.output.connect(this.comp);
    this.comp.connect(this.compMakeup);
    this.compMakeup.connect(this.driveDry);
    this.shaper.connect(this.driveWet);
    this.driveDry.connect(driveSum);
    this.driveWet.connect(driveSum);
    driveSum.connect(post.input);
    post.output.connect(chorusSum);
    this.postOut = post.output;
    this.chorusL.connect(merger, 0, 0);
    this.chorusR.connect(merger, 0, 1);
    merger.connect(this.chorusWet);
    this.chorusWet.connect(chorusSum);
    chorusSum.connect(stereo.input);
    stereo.output.connect(this.autoGain);
    this.autoGain.connect(this.fader);
    this.fader.connect(this.panner);
    this.panner.connect(this.muteGain);
    this.muteGain.connect(mixer.masterIn);
    this.muteGain.connect(this.analyser);
    this.muteGain.connect(this.reverbSend);
    this.muteGain.connect(this.delaySend);
    this.reverbSend.connect(mixer.reverbIn);
    this.delaySend.connect(mixer.delayIn);
  }

  apply(t: Track, audible: boolean): void {
    const now = this.ctx.currentTime;
    const smooth = (p: AudioParam, v: number) => p.setTargetAtTime(v, now, 0.02);
    const fx = t.fx;
    // Automated parameters are driven by the scheduler instead.
    const auto = (k: AutomationParam) => (t.automation[k]?.length ?? 0) > 0;
    // Back to the knob: when a lane was just cleared, drop what its automation had scheduled.
    const rest = (p: AudioParam, v: number) => {
      if (this.automated.has(p)) {
        this.automated.delete(p);
        p.cancelScheduledValues(now);
      }
      smooth(p, v);
    };
    if (auto('filter')) this.automated.add(this.filter.frequency);
    if (auto('pan')) this.automated.add(this.panner.pan);
    if (auto('reverb')) this.automated.add(this.reverbSend.gain);
    if (auto('delay')) this.automated.add(this.delaySend.gain);
    if (!auto('filter')) rest(this.filter.frequency, filterHz(fx.filterCutoff));
    smooth(this.eqLow.gain, fx.eqLow);
    smooth(this.eqMid.gain, fx.eqMid);
    smooth(this.eqHigh.gain, fx.eqHigh);
    smooth(this.comp.threshold, -fx.compressor * 32);
    smooth(this.comp.ratio, 1 + fx.compressor * 7);
    this.comp.attack.value = 0.008;
    this.comp.release.value = 0.15;
    smooth(this.compMakeup.gain, 1 + fx.compressor * 0.9);
    if (fx.drive !== this.lastDrive) {
      this.shaper.curve = driveCurve(1 + fx.drive * 30);
      this.lastDrive = fx.drive;
    }
    smooth(this.driveWet.gain, fx.drive * 0.6);
    smooth(this.driveDry.gain, 1 - fx.drive * 0.7);
    smooth(this.chorusWet.gain, fx.chorus * 0.9);
    // Bypass idle stages entirely: an open filter, zero drive or zero chorus cost nothing.
    const filterOn = fx.filterCutoff < 0.999 || auto('filter');
    this.link('filter', this.preOut, this.filter, filterOn);
    this.link('nofilter', this.preOut, this.eqLow, !filterOn);
    this.link('drive', this.compMakeup, this.shaper, fx.drive > 0.001);
    this.link('chorusL', this.postOut, this.chorusL, fx.chorus > 0.001);
    this.link('chorusR', this.postOut, this.chorusR, fx.chorus > 0.001);
    smooth(this.fader.gain, faderGain(t.volume));
    if (!auto('pan')) rest(this.panner.pan, t.pan);
    smooth(this.muteGain.gain, audible ? 1 : 0);
    if (!auto('reverb')) rest(this.reverbSend.gain, fx.reverb * REVERB_SEND);
    if (!auto('delay')) rest(this.delaySend.gain, fx.delay * DELAY_SEND);
    for (const c of this.chains) c.update(fx.inserts);
  }

  private link(id: string, from: AudioNode, to: AudioNode, on: boolean): void {
    if ((this.links.get(id) ?? false) === on) return;
    this.links.set(id, on);
    if (on) from.connect(to);
    else
      try {
        from.disconnect(to);
      } catch {
        /* not connected */
      }
  }

  setInstrument(inst: Instrument | null, key: string): void {
    if (this.instrument) {
      const old = this.instrument;
      old.allNotesOff(this.ctx.currentTime);
      setTimeout(() => old.dispose(), 3000);
    }
    this.instrument = inst;
    this.instrumentKey = key;
    if (inst) inst.output.connect(this.input);
  }

  dispose(): void {
    this.setInstrument(null, '');
    for (const c of this.chains) c.dispose();
    this.chorusLfo.stop();
    this.muteGain.disconnect();
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
  }
}

export class Mixer {
  readonly ctx: BaseAudioContext;
  readonly masterIn: GainNode;
  readonly masterAuto: GainNode;
  readonly masterVol: GainNode;
  readonly analyserL: AnalyserNode;
  readonly analyserR: AnalyserNode;
  readonly reverbIn: GainNode;
  readonly delayIn: GainNode;
  private convolver: ConvolverNode;
  private delayL: DelayNode;
  private delayR: DelayNode;
  private delayFb: GainNode;
  readonly channels = new Map<string, Channel>();
  private reverbKey = '';
  private mEqLow: BiquadFilterNode;
  private mEqMid: BiquadFilterNode;
  private mEqHigh: BiquadFilterNode;
  private glue: DynamicsCompressorNode;
  private loud: GainNode;
  private limiter: DynamicsCompressorNode;
  private ceiling: GainNode;
  /** Output node (connect to destination). */
  readonly output: AudioNode;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.masterIn = ctx.createGain();
    this.masterAuto = ctx.createGain();
    this.mEqLow = ctx.createBiquadFilter();
    this.mEqLow.type = 'lowshelf';
    this.mEqLow.frequency.value = 110;
    this.mEqMid = ctx.createBiquadFilter();
    this.mEqMid.type = 'peaking';
    this.mEqMid.frequency.value = 900;
    this.mEqMid.Q.value = 0.6;
    this.mEqHigh = ctx.createBiquadFilter();
    this.mEqHigh.type = 'highshelf';
    this.mEqHigh.frequency.value = 7000;
    const glue = (this.glue = ctx.createDynamicsCompressor());
    glue.threshold.value = -14;
    glue.ratio.value = 2;
    glue.attack.value = 0.02;
    glue.release.value = 0.25;
    glue.knee.value = 8;
    const limiter = (this.limiter = ctx.createDynamicsCompressor());
    limiter.threshold.value = -1.5;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.08;
    limiter.knee.value = 0;
    this.masterVol = ctx.createGain();
    this.masterIn.connect(this.masterAuto);
    this.masterAuto.connect(this.mEqLow);
    this.mEqLow.connect(this.mEqMid);
    this.mEqMid.connect(this.mEqHigh);
    this.mEqHigh.connect(glue);
    glue.connect(this.masterVol);
    this.loud = ctx.createGain();
    this.masterVol.connect(this.loud);
    this.loud.connect(limiter);
    // Soft clipper after the limiter: transparent below ~-1 dBFS, rounds off overs.
    const clipper = ctx.createWaveShaper();
    clipper.curve = softClipCurve();
    // The shaper's input domain is ±1, the curve spans ±2, so halve the signal going in.
    const clipIn = ctx.createGain();
    clipIn.gain.value = 0.5;
    limiter.connect(clipIn);
    clipIn.connect(clipper);
    this.ceiling = ctx.createGain();
    clipper.connect(this.ceiling);
    const splitter = ctx.createChannelSplitter(2);
    this.ceiling.connect(splitter);
    this.analyserL = ctx.createAnalyser();
    this.analyserR = ctx.createAnalyser();
    this.analyserL.fftSize = 1024;
    this.analyserR.fftSize = 1024;
    splitter.connect(this.analyserL, 0);
    splitter.connect(this.analyserR, 1);
    this.output = this.ceiling;

    // Reverb bus
    this.reverbIn = ctx.createGain();
    this.convolver = ctx.createConvolver();
    const revHp = ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 180;
    const revRet = ctx.createGain();
    revRet.gain.value = 0.9;
    this.reverbIn.connect(revHp);
    revHp.connect(this.convolver);
    this.convolver.connect(revRet);
    revRet.connect(this.masterIn);

    // Stereo ping-pong delay bus
    this.delayIn = ctx.createGain();
    this.delayL = ctx.createDelay(4);
    this.delayR = ctx.createDelay(4);
    this.delayFb = ctx.createGain();
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 4500;
    const dMerge = ctx.createChannelMerger(2);
    const dRet = ctx.createGain();
    dRet.gain.value = 0.8;
    this.delayIn.connect(dlp);
    dlp.connect(this.delayL);
    this.delayL.connect(this.delayR);
    this.delayR.connect(this.delayFb);
    this.delayFb.connect(dlp);
    this.delayL.connect(dMerge, 0, 0);
    this.delayR.connect(dMerge, 0, 1);
    dMerge.connect(dRet);
    dRet.connect(this.masterIn);
  }

  /** Bring the graph in line with the project. */
  sync(p: Project): void {
    const now = this.ctx.currentTime;
    const anySolo = p.tracks.some((t) => t.solo);
    const seen = new Set<string>();
    for (const t of p.tracks) {
      seen.add(t.id);
      let ch = this.channels.get(t.id);
      if (!ch) {
        ch = new Channel(this.ctx, this);
        this.channels.set(t.id, ch);
      }
      const audible = !t.mute && (!anySolo || t.solo);
      ch.apply(t, audible);
      const key = instrumentKey(t);
      if (ch.instrumentKey !== key) ch.setInstrument(createInstrument(this.ctx, t), key);
      ch.instrument?.setParams(t.instrumentParams);
      if (ch.instrument && t.type === 'drums') applyDrumSamples(ch.instrument, t);
    }
    for (const [id, ch] of this.channels) {
      if (!seen.has(id)) {
        ch.dispose();
        this.channels.delete(id);
      }
    }
    this.masterVol.gain.setTargetAtTime(faderGain(p.masterVolume), now, 0.02);
    const spb = 60 / p.bpm;
    const dt = Math.min(3.9, DELAY_DIV[p.delayTime] * spb);
    this.delayL.delayTime.setTargetAtTime(dt / 2, now, 0.05);
    this.delayR.delayTime.setTargetAtTime(dt / 2, now, 0.05);
    this.delayFb.gain.setTargetAtTime(Math.min(0.85, p.delayFeedback), now, 0.02);
    const m = { ...DEFAULT_MASTERING, ...p.mastering };
    const tc = 0.05;
    this.mEqLow.gain.setTargetAtTime(m.low, now, tc);
    this.mEqMid.gain.setTargetAtTime(m.mid, now, tc);
    this.mEqHigh.gain.setTargetAtTime(m.high, now, tc);
    this.glue.threshold.setTargetAtTime(-8 - m.glue * 18, now, tc);
    this.glue.ratio.setTargetAtTime(1.5 + m.glue * 2.5, now, tc);
    this.loud.gain.setTargetAtTime(Math.pow(10, m.loudness / 20), now, tc);
    const ceilLin = Math.pow(10, Math.min(0, m.ceiling) / 20);
    this.limiter.threshold.setTargetAtTime(Math.min(-0.5, m.ceiling - 0.8), now, tc);
    // The soft clipper tops out at 0.995, so scale its output to the ceiling.
    this.ceiling.gain.setTargetAtTime(ceilLin / 0.995, now, tc);
    if (this.reverbKey !== p.reverbType) {
      this.reverbKey = p.reverbType;
      const [s, d, pre, br] = REVERB[p.reverbType];
      this.convolver.buffer = makeImpulse(this.ctx, s, d, pre, br);
    }
  }

  async ready(): Promise<void> {
    await Promise.all([...this.channels.values()].map((c) => c.instrument?.ready));
  }

  dispose(): void {
    for (const ch of this.channels.values()) ch.dispose();
    this.channels.clear();
    this.output.disconnect();
  }
}

export function instrumentKey(t: Track): string {
  if (t.type === 'audio') return 'audio';
  return t.instrument + (t.instrument === 'user-sampler' ? ':' + (t.samplerAudioId ?? '') + ':' + (t.samplerRoot ?? 60) + ':' + (t.samplerAudioId && getBuffer(t.samplerAudioId) ? 1 : 0) + ':' + JSON.stringify(t.sampler ?? null) : '');
}

/** Put the track's own row samples (once loaded) into its drum kit. */
function applyDrumSamples(inst: Instrument, t: Track): void {
  if (!(inst instanceof DrumKitInstrument)) return;
  const map = new Map<number, AudioBuffer>();
  for (const [pitch, d] of Object.entries(t.drumSamples ?? {})) {
    const buf = getBuffer(d.audioId);
    if (buf) map.set(Number(pitch), buf);
  }
  inst.setOverrides(map);
}

export function createInstrument(ctx: BaseAudioContext, t: Track): Instrument | null {
  if (t.type === 'audio') return null;
  const preset = getPreset(t.instrument);
  let inst: Instrument | null = null;
  switch (preset.kind) {
    case 'sampler':
      inst = new SamplerInstrument(ctx, preset.sampler);
      break;
    case 'synth':
      inst = new SynthInstrument(ctx, preset.synth);
      break;
    case 'drums':
      inst = new DrumKitInstrument(ctx, preset.kit, DRUM_LANES);
      applyDrumSamples(inst, t);
      break;
    case 'user-sampler': {
      const id = t.samplerAudioId;
      const settings = t.sampler ?? DEFAULT_SAMPLER;
      const buf = id ? (getBuffer(id) ?? null) : null;
      const rev = id && settings.reverse ? (getBuffer(id, true) ?? null) : null;
      inst = new UserSamplerInstrument(ctx, buf, rev, t.samplerRoot ?? 60, settings);
      break;
    }
  }
  inst?.setParams(t.instrumentParams);
  return inst;
}
