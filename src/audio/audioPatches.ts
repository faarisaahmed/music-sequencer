// Ready-made channel patches (effect chains), mainly for audio tracks: guitar & bass
// through amps, vocal chains and creative effects.
import type { InsertFx, TrackFx } from '../model/types';

export interface AudioPatch {
  id: string;
  name: string;
  category: 'Guitar' | 'Bass' | 'Vocals' | 'Creative';
  description: string;
  fx: Omit<TrackFx, 'inserts'> & { inserts: InsertFx };
}

const base: Omit<TrackFx, 'inserts'> = { eqLow: 0, eqMid: 0, eqHigh: 0, compressor: 0.2, drive: 0, chorus: 0, reverb: 0.15, delay: 0, filterCutoff: 1 };

const amp = (model: NonNullable<InsertFx['amp']>['model'], gain: number, bass = 0.5, mid = 0.55, treble = 0.55, presence = 0.5, level = 0.5): InsertFx['amp'] => ({
  on: true,
  model,
  gain,
  bass,
  mid,
  treble,
  presence,
  level,
});

export const AUDIO_PATCHES: AudioPatch[] = [
  {
    id: 'gtr-clean',
    name: 'Clean Guitar',
    category: 'Guitar',
    description: 'Sparkly clean combo with chorus & room',
    fx: { ...base, eqHigh: 2, chorus: 0.3, reverb: 0.25, inserts: { gate: { on: true, threshold: -58 }, amp: amp('clean', 0.35, 0.5, 0.5, 0.65, 0.6) } },
  },
  {
    id: 'gtr-crunch',
    name: 'Classic Crunch',
    category: 'Guitar',
    description: 'Edge-of-breakup rock rhythm tone',
    fx: { ...base, compressor: 0.15, reverb: 0.18, inserts: { gate: { on: true, threshold: -55 }, amp: amp('crunch', 0.6, 0.55, 0.6, 0.55) } },
  },
  {
    id: 'gtr-british',
    name: 'British Lead',
    category: 'Guitar',
    description: 'Singing stack lead with echo',
    fx: { ...base, delay: 0.3, reverb: 0.25, inserts: { gate: { on: true, threshold: -52 }, amp: amp('british', 0.7, 0.5, 0.7, 0.55, 0.6, 0.55) } },
  },
  {
    id: 'gtr-metal',
    name: 'High Gain Metal',
    category: 'Guitar',
    description: 'Tight scooped modern high gain',
    fx: { ...base, compressor: 0, reverb: 0.1, inserts: { gate: { on: true, threshold: -45 }, amp: amp('highgain', 0.8, 0.65, 0.3, 0.6, 0.65, 0.5) } },
  },
  {
    id: 'gtr-funk',
    name: 'Funky Wah',
    category: 'Guitar',
    description: 'Clean amp with envelope auto-wah',
    fx: {
      ...base,
      compressor: 0.5,
      reverb: 0.1,
      inserts: { amp: amp('clean', 0.4), autowah: { on: true, mode: 'envelope', sensitivity: 0.6, rate: 0.3, base: 0.15, q: 0.6, mix: 0.9 } },
    },
  },
  {
    id: 'gtr-surf',
    name: 'Surf Tremolo',
    category: 'Guitar',
    description: 'Vintage tremolo and spring-like reverb',
    fx: { ...base, reverb: 0.5, inserts: { amp: amp('clean', 0.45, 0.4, 0.5, 0.7), tremolo: { on: true, rate: 0.45, depth: 0.6 } } },
  },
  {
    id: 'bass-di',
    name: 'Bass DI',
    category: 'Bass',
    description: 'Clean direct bass, compressed and solid',
    fx: { ...base, eqLow: 3, eqMid: -1, compressor: 0.55, reverb: 0, inserts: {} },
  },
  {
    id: 'bass-amp',
    name: 'Bass Amp',
    category: 'Bass',
    description: 'Warm tube bass amp with grit',
    fx: { ...base, compressor: 0.5, reverb: 0, inserts: { amp: amp('bass', 0.45, 0.65, 0.55, 0.45, 0.4, 0.6) } },
  },
  {
    id: 'bass-fuzz',
    name: 'Fuzz Bass',
    category: 'Bass',
    description: 'Driven, aggressive bass',
    fx: { ...base, compressor: 0.4, reverb: 0, inserts: { amp: amp('bass', 0.9, 0.6, 0.65, 0.6, 0.5, 0.5) } },
  },
  {
    id: 'vox-pop',
    name: 'Pop Vocal',
    category: 'Vocals',
    description: 'Gate → EQ → comp → de-ess → plate',
    fx: { ...base, eqLow: -4, eqMid: 1, eqHigh: 4, compressor: 0.6, reverb: 0.3, delay: 0.12, inserts: { gate: { on: true, threshold: -50 }, deesser: { on: true, amount: 0.55 } } },
  },
  {
    id: 'vox-warm',
    name: 'Warm Vocal',
    category: 'Vocals',
    description: 'Intimate, close and smooth',
    fx: { ...base, eqLow: -2, eqMid: 0, eqHigh: 1, compressor: 0.5, drive: 0.05, reverb: 0.2, inserts: { gate: { on: true, threshold: -55 }, deesser: { on: true, amount: 0.4 } } },
  },
  {
    id: 'vox-big',
    name: 'Big Ballad Vocal',
    category: 'Vocals',
    description: 'Wide, lush with long reverb and echo',
    fx: {
      ...base,
      eqLow: -3,
      eqHigh: 3,
      compressor: 0.55,
      reverb: 0.55,
      delay: 0.3,
      inserts: { gate: { on: true, threshold: -52 }, deesser: { on: true, amount: 0.5 }, widener: { on: true, width: 0.7, haas: 0.25 } },
    },
  },
  {
    id: 'vox-telephone',
    name: 'Telephone',
    category: 'Vocals',
    description: 'Band-limited lo-fi phone voice',
    fx: { ...base, eqLow: -12, eqMid: 8, eqHigh: -10, compressor: 0.6, drive: 0.3, filterCutoff: 0.65, reverb: 0.05, inserts: { lofi: { on: true, bits: 10, tone: 0.35, mix: 0.6 } } },
  },
  {
    id: 'vox-podcast',
    name: 'Spoken Word',
    category: 'Vocals',
    description: 'Clear, dry podcast voice',
    fx: { ...base, eqLow: -3, eqMid: 1, eqHigh: 2, compressor: 0.65, reverb: 0, inserts: { gate: { on: true, threshold: -48 }, deesser: { on: true, amount: 0.5 } } },
  },
  {
    id: 'fx-jet',
    name: 'Jet Flanger',
    category: 'Creative',
    description: 'Swooshing flanger sweep',
    fx: { ...base, reverb: 0.2, inserts: { flanger: { on: true, rate: 0.1, depth: 0.8, feedback: 0.7, mix: 0.7 } } },
  },
  {
    id: 'fx-phase',
    name: 'Phase Shifter',
    category: 'Creative',
    description: 'Classic 70s phaser',
    fx: { ...base, reverb: 0.2, inserts: { phaser: { on: true, rate: 0.2, depth: 0.7, feedback: 0.5, mix: 0.8 } } },
  },
  {
    id: 'fx-8bit',
    name: '8-Bit Crush',
    category: 'Creative',
    description: 'Crunchy retro game console',
    fx: { ...base, reverb: 0.05, inserts: { lofi: { on: true, bits: 5, tone: 0.55, mix: 0.85 } } },
  },
  {
    id: 'fx-wide',
    name: 'Super Wide',
    category: 'Creative',
    description: 'Huge stereo spread',
    fx: { ...base, reverb: 0.3, chorus: 0.2, inserts: { widener: { on: true, width: 0.95, haas: 0.6 } } },
  },
];
