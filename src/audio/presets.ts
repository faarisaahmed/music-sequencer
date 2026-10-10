// Instrument catalogue: sampled acoustic instruments, synth patches and drum kits.
import { parseNote, DRUM_LANES } from '../model/music';
import type { DrumKitDef, SamplerDef, SynthDef } from './instruments';

export type InstrumentCategory = 'Keyboards' | 'Guitars & Bass' | 'Strings' | 'Winds & Brass' | 'Mallets & Bells' | 'Synths' | 'Drums' | 'Sampler';

export interface SmartControl {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
}

interface PresetBase {
  id: string;
  name: string;
  category: InstrumentCategory;
  icon: string; // key into the icon set
  description: string;
  controls: SmartControl[];
  /** Typical comfortable range for the on-screen keyboard. */
  range?: [number, number];
}

export type InstrumentPreset =
  | (PresetBase & { kind: 'sampler'; sampler: SamplerDef })
  | (PresetBase & { kind: 'synth'; synth: SynthDef })
  | (PresetBase & { kind: 'drums'; kit: DrumKitDef })
  | (PresetBase & { kind: 'user-sampler' });

const TONEJS_INST = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const SALAMANDER = 'https://tonejs.github.io/audio/salamander/';
const DRUMS = 'https://tonejs.github.io/audio/drum-samples/';

function nbSamples(inst: string, notes: string[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const n of notes) out[parseNote(n)] = `${TONEJS_INST}${inst}/${n.replace('#', 's')}.mp3`;
  return out;
}

const SOUNDFONT = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/';

/** Samples from the MusyngKite General MIDI soundfont (note names use flats, e.g. "Bb1"). */
function soundfont(inst: string, notes: string[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const n of notes) out[parseNote(n)] = `${SOUNDFONT}${inst}-mp3/${n}.mp3`;
  return out;
}

function salamander(): Record<number, string> {
  const out: Record<number, string> = {};
  const names = ['A', 'C', 'Ds', 'Fs'];
  for (let oct = 0; oct <= 8; oct++) {
    for (const nm of names) {
      if (oct === 0 && nm !== 'A') continue;
      if (oct === 8 && nm !== 'C') continue;
      out[parseNote(nm.replace('s', '#') + oct)] = `${SALAMANDER}${nm}${oct}.mp3`;
    }
  }
  return out;
}

const SAMPLER_CONTROLS: SmartControl[] = [
  { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5, step: 0.01 },
  { key: 'attack', label: 'Attack', min: 0.001, max: 1.5, default: 0.003, step: 0.001 },
  { key: 'release', label: 'Release', min: 0.05, max: 4, default: 0.6, step: 0.01 },
  { key: 'tune', label: 'Tune', min: -12, max: 12, default: 0, step: 1 },
];

const SYNTH_CONTROLS: SmartControl[] = [
  { key: 'cutoff', label: 'Cutoff', min: 0, max: 1, default: 0.5, step: 0.01 },
  { key: 'resonance', label: 'Resonance', min: 0, max: 1, default: 0.5, step: 0.01 },
  { key: 'attack', label: 'Attack', min: 0.001, max: 2, default: 0.01, step: 0.001 },
  { key: 'release', label: 'Release', min: 0.01, max: 4, default: 0.3, step: 0.01 },
  { key: 'detune', label: 'Detune', min: 0, max: 1, default: 0.5, step: 0.01 },
  { key: 'vibrato', label: 'Vibrato', min: 0, max: 1, default: 0, step: 0.01 },
];

const DRUM_CONTROLS: SmartControl[] = [
  { key: 'tune', label: 'Tune', min: -12, max: 12, default: 0, step: 1 },
  { key: 'level36', label: 'Kick', min: 0, max: 1.5, default: 1, step: 0.01 },
  { key: 'level38', label: 'Snare', min: 0, max: 1.5, default: 1, step: 0.01 },
  { key: 'level42', label: 'Hi-Hat', min: 0, max: 1.5, default: 1, step: 0.01 },
  { key: 'level39', label: 'Clap', min: 0, max: 1.5, default: 1, step: 0.01 },
  { key: 'level49', label: 'Cymbals', min: 0, max: 1.5, default: 1, step: 0.01 },
];

function sampler(
  id: string,
  name: string,
  category: InstrumentCategory,
  icon: string,
  description: string,
  sampler: SamplerDef,
  range: [number, number],
  releaseDefault = 0.6,
): InstrumentPreset {
  return {
    id,
    name,
    category,
    icon,
    description,
    kind: 'sampler',
    sampler,
    range,
    controls: SAMPLER_CONTROLS.map((c) =>
      c.key === 'release' ? { ...c, default: releaseDefault } : c.key === 'attack' ? { ...c, default: sampler.attack ?? 0.003 } : c,
    ),
  };
}

/** Make a sampler preset's Tone knob start at a given value. */
function withTone(p: InstrumentPreset, tone: number): InstrumentPreset {
  return { ...p, controls: p.controls.map((c) => (c.key === 'tone' ? { ...c, default: tone } : c)) };
}

function synth(id: string, name: string, icon: string, description: string, synth: SynthDef, range: [number, number] = [36, 96]): InstrumentPreset {
  return {
    id,
    name,
    category: 'Synths',
    icon,
    description,
    kind: 'synth',
    synth,
    range,
    controls: SYNTH_CONTROLS.map((c) =>
      c.key === 'attack' ? { ...c, default: synth.amp.attack } : c.key === 'release' ? { ...c, default: synth.amp.release } : c,
    ),
  };
}

function kit(id: string, name: string, description: string, folder: string | null, flavor: DrumKitDef['synth'], gain = 0.9): InstrumentPreset {
  const samples: Record<number, string> = {};
  if (folder) {
    const f = DRUMS + folder + '/';
    samples[36] = f + 'kick.mp3';
    samples[38] = f + 'snare.mp3';
    samples[42] = f + 'hihat.mp3';
    samples[41] = f + 'tom3.mp3';
    samples[45] = f + 'tom2.mp3';
    samples[48] = f + 'tom1.mp3';
  }
  return {
    id,
    name,
    category: 'Drums',
    icon: 'drums',
    description,
    kind: 'drums',
    kit: { samples, synth: flavor, gain },
    controls: DRUM_CONTROLS,
  };
}

const env = (attack: number, decay: number, sustain: number, release: number) => ({ attack, decay, sustain, release });

export const PRESETS: InstrumentPreset[] = [
  // ---------------- Keyboards
  sampler('grand-piano', 'Grand Piano', 'Keyboards', 'piano', 'Concert grand (Salamander samples)', { samples: salamander(), release: 0.9, gain: 1.1, spread: 0.55 }, [21, 108], 0.9),
  sampler(
    'bright-piano',
    'Bright Piano',
    'Keyboards',
    'piano',
    'Punchy upright piano',
    { samples: nbSamples('piano', ['A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7']), release: 0.7, gain: 1, spread: 0.45 },
    [21, 108],
    0.7,
  ),
  {
    ...synth('electric-piano', 'Electric Piano', 'epiano', 'Classic tine electric piano (FM)', {
      oscs: [{ type: 'sine', gain: 1 }],
      fm: { ratio: 1, index: 1.6, decay: 1.2, sustain: 0.05 },
      filter: { type: 'lowpass', cutoff: 5000, q: 0.5, envAmount: 0.5, env: env(0.005, 0.8, 0.4, 0.4) },
      amp: env(0.003, 2.2, 0.25, 0.45),
      vibrato: { rate: 4.5, depth: 0, delay: 0.2 },
      gain: 0.55,
    }),
    category: 'Keyboards',
  },
  sampler(
    'organ',
    'Classic Organ',
    'Keyboards',
    'organ',
    'Drawbar organ',
    { samples: nbSamples('organ', ['C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6']), release: 0.12, gain: 0.7, velocityFilter: false },
    [36, 96],
    0.12,
  ),
  sampler(
    'harmonium',
    'Harmonium',
    'Keyboards',
    'organ',
    'Reed pump organ',
    { samples: nbSamples('harmonium', ['C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F4', 'G4', 'A4', 'C5']), release: 0.3, attack: 0.05, gain: 0.8 },
    [36, 84],
    0.3,
  ),
  {
    ...synth('clav', 'Funk Clav', 'epiano', 'Plucky clavinet', {
      oscs: [
        { type: 'square', gain: 0.5 },
        { type: 'sawtooth', gain: 0.4, octave: 1 },
      ],
      filter: { type: 'bandpass', cutoff: 1800, q: 2, envAmount: 1.6, env: env(0.002, 0.25, 0.1, 0.1) },
      amp: env(0.002, 0.6, 0.2, 0.08),
      gain: 0.45,
    }),
    category: 'Keyboards',
  },
  withTone(sampler('felt-piano', 'Felt Piano', 'Keyboards', 'piano', 'Soft, muted upright with felt dampers', { samples: salamander(), release: 1.4, gain: 1.25, spread: 0.4, tone: 0.08 }, [21, 108], 1.4), 0.08),
  withTone(sampler('honky-tonk', 'Honky-Tonk Piano', 'Keyboards', 'piano', 'Bright, jangly saloon upright', { samples: nbSamples('piano', ['A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7']), release: 0.6, gain: 1, spread: 0.3, tone: 0.95 }, [21, 108], 0.6), 0.95),
  {
    ...synth('suitcase-ep', 'Suitcase Electric Piano', 'epiano', 'Warm tine piano with stereo tremolo shimmer', {
      oscs: [{ type: 'sine', gain: 1 }, { type: 'sine', octave: 1, gain: 0.08 }],
      fm: { ratio: 1, index: 1.1, decay: 1.6, sustain: 0.08 },
      filter: { type: 'lowpass', cutoff: 3800, q: 0.5, envAmount: 0.3, env: env(0.005, 1, 0.5, 0.5) },
      amp: env(0.003, 3, 0.2, 0.5),
      vibrato: { rate: 5.2, depth: 4, delay: 0.05 },
      gain: 0.55,
    }),
    category: 'Keyboards',
  },
  {
    ...synth('wurli', 'Wurly Electric Piano', 'epiano', 'Reedy, barky 70s electric piano', {
      oscs: [{ type: 'triangle', gain: 1 }, { type: 'square', gain: 0.12, octave: 1 }],
      fm: { ratio: 2, index: 0.9, decay: 0.35, sustain: 0.05 },
      filter: { type: 'lowpass', cutoff: 2600, q: 1.2, envAmount: 1, env: env(0.003, 0.4, 0.3, 0.3) },
      amp: env(0.003, 1.6, 0.3, 0.3),
      gain: 0.45,
    }),
    category: 'Keyboards',
  },
  {
    ...synth('harpsichord', 'Harpsichord', 'piano', 'Baroque plucked harpsichord', {
      oscs: [
        { type: 'sawtooth', gain: 0.6 },
        { type: 'square', gain: 0.25, octave: 1 },
        { type: 'sawtooth', gain: 0.2, octave: -1, detune: 3 },
      ],
      filter: { type: 'highpass', cutoff: 220, q: 0.7, envAmount: 0, env: env(0.001, 0.2, 1, 0.2) },
      amp: env(0.001, 1.8, 0, 0.25),
      gain: 0.32,
    }, [29, 89]),
    category: 'Keyboards',
  },
  {
    ...synth('celesta', 'Celesta', 'bell', 'Sparkling orchestral celesta', {
      oscs: [{ type: 'sine', gain: 1 }, { type: 'sine', octave: 2, gain: 0.1 }],
      fm: { ratio: 4, index: 0.8, decay: 0.25, sustain: 0.02 },
      filter: { type: 'lowpass', cutoff: 9000, q: 0.5, envAmount: 0, env: env(0.001, 0.2, 1, 0.2) },
      amp: env(0.001, 1.6, 0, 0.9),
      gain: 0.5,
    }, [60, 108]),
    category: 'Keyboards',
  },
  {
    ...synth('toy-piano', 'Toy Piano', 'piano', 'Plinky, metallic toy piano', {
      oscs: [{ type: 'sine', gain: 1 }],
      fm: { ratio: 5.4, index: 1.8, decay: 0.15, sustain: 0.05 },
      filter: { type: 'highpass', cutoff: 400, q: 0.5, envAmount: 0, env: env(0.001, 0.2, 1, 0.2) },
      amp: env(0.001, 0.9, 0, 0.4),
      gain: 0.45,
    }, [60, 96]),
    category: 'Keyboards',
  },
  {
    ...synth('accordion', 'Accordion', 'organ', 'Musette accordion with detuned reeds', {
      oscs: [
        { type: 'sawtooth', gain: 0.45, detune: -9 },
        { type: 'sawtooth', gain: 0.45, detune: 9 },
        { type: 'square', gain: 0.25, octave: -1 },
      ],
      filter: { type: 'lowpass', cutoff: 2200, q: 1, envAmount: 0.2, env: env(0.04, 0.3, 0.9, 0.1) },
      amp: env(0.04, 0.2, 0.95, 0.12),
      gain: 0.28,
    }, [41, 89]),
    category: 'Keyboards',
  },
  {
    ...synth('church-organ', 'Pipe Organ', 'organ', 'Majestic cathedral pipe organ', {
      oscs: [
        { type: 'sine', gain: 0.6, octave: -1 },
        { type: 'sine', gain: 0.6 },
        { type: 'triangle', gain: 0.35, octave: 1 },
        { type: 'sine', gain: 0.2, octave: 2 },
      ],
      noise: 0.006,
      filter: { type: 'lowpass', cutoff: 5000, q: 0.5, envAmount: 0, env: env(0.05, 0.2, 1, 0.3) },
      amp: env(0.06, 0.2, 1, 0.35),
      gain: 0.3,
    }),
    category: 'Keyboards',
  },
  {
    ...synth('rock-organ', 'Rock Organ', 'organ', 'Overdriven tonewheel organ with percussion click', {
      oscs: [
        { type: 'sine', gain: 0.7, octave: -1 },
        { type: 'sine', gain: 0.7 },
        { type: 'sine', gain: 0.5, octave: 1 },
        { type: 'square', gain: 0.08, octave: 2 },
      ],
      fm: { ratio: 3, index: 0.4, decay: 0.08, sustain: 0 },
      filter: { type: 'lowpass', cutoff: 4500, q: 0.7, envAmount: 0.3, env: env(0.002, 0.1, 0.8, 0.1) },
      amp: env(0.004, 0.2, 0.95, 0.06),
      vibrato: { rate: 6.5, depth: 6, delay: 0 },
      gain: 0.3,
    }),
    category: 'Keyboards',
  },

  // ---------------- Guitars & Bass
  sampler(
    'acoustic-guitar',
    'Acoustic Guitar',
    'Guitars & Bass',
    'guitar',
    'Steel-string acoustic',
    { samples: nbSamples('guitar-acoustic', ['D2', 'F2', 'A2', 'C3', 'E3', 'G3', 'A#3', 'D4', 'F4', 'A4', 'C5', 'D5']), release: 0.6, oneShot: false, gain: 1.1 },
    [40, 84],
  ),
  sampler(
    'electric-guitar',
    'Electric Guitar',
    'Guitars & Bass',
    'guitar',
    'Clean electric guitar',
    { samples: nbSamples('guitar-electric', ['E2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6']), release: 0.5, gain: 1.1 },
    [40, 88],
  ),
  sampler(
    'nylon-guitar',
    'Nylon Guitar',
    'Guitars & Bass',
    'guitar',
    'Classical nylon-string',
    { samples: nbSamples('guitar-nylon', ['B1', 'D2', 'E2', 'F#2', 'A2', 'B2', 'C#3', 'E3', 'G3', 'A3', 'B3', 'C#4', 'E4', 'A4', 'C#5', 'E5', 'G5', 'A5']), release: 0.7, gain: 1.2 },
    [40, 84],
  ),
  sampler(
    'electric-bass',
    'Electric Bass',
    'Guitars & Bass',
    'bass',
    'Finger-picked electric bass',
    { samples: nbSamples('bass-electric', ['E1', 'G1', 'A#1', 'C#2', 'E2', 'G2', 'A#2', 'C#3', 'E3', 'G3', 'A#3', 'C#4']), release: 0.25, gain: 1.1 },
    [28, 67],
    0.25,
  ),
  sampler(
    'upright-bass',
    'Upright Bass',
    'Guitars & Bass',
    'bass',
    'Plucked double bass (pizzicato) for jazz, pop & folk',
    { samples: soundfont('acoustic_bass', ['E1', 'G1', 'Bb1', 'Db2', 'E2', 'G2', 'Bb2', 'Db3', 'E3', 'G3', 'Bb3', 'Db4']), release: 0.18, gain: 3.6 },
    [28, 67],
    0.18,
  ),
  sampler(
    'upright-bass-bowed',
    'Upright Bass (Bowed)',
    'Guitars & Bass',
    'bass',
    'Bowed (arco) double bass',
    { samples: nbSamples('contrabass', ['F#1', 'A#1', 'C2', 'E2', 'G#2', 'C#3', 'E3', 'G#3', 'B3']), attack: 0.04, release: 0.35, gain: 1.2 },
    [28, 64],
    0.35,
  ),
  {
    ...synth('synth-bass', 'Analog Bass', 'bass', 'Fat analog synth bass', {
      oscs: [
        { type: 'sawtooth', gain: 0.7 },
        { type: 'square', gain: 0.5, octave: -1 },
      ],
      filter: { type: 'lowpass', cutoff: 380, q: 4, envAmount: 2.6, env: env(0.003, 0.22, 0.15, 0.1) },
      amp: env(0.003, 0.4, 0.8, 0.08),
      gain: 0.5,
    }, [24, 60]),
    category: 'Guitars & Bass',
  },
  {
    ...synth('sub-808', '808 Sub Bass', 'bass', 'Booming 808-style sub', {
      oscs: [{ type: 'sine', gain: 1 }, { type: 'triangle', gain: 0.2, octave: 1 }],
      filter: { type: 'lowpass', cutoff: 900, q: 0.7, envAmount: 0.4, env: env(0.002, 0.2, 0.5, 0.2) },
      amp: env(0.004, 1.6, 0.35, 0.25),
      gain: 0.75,
    }, [24, 60]),
    category: 'Guitars & Bass',
  },

  // ---------------- Strings
  sampler(
    'violin',
    'Violin',
    'Strings',
    'violin',
    'Solo violin',
    { samples: nbSamples('violin', ['A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6', 'A6', 'C7']), attack: 0.06, release: 0.5, gain: 0.9 },
    [55, 100],
    0.5,
  ),
  sampler(
    'cello',
    'Cello',
    'Strings',
    'violin',
    'Solo cello',
    { samples: nbSamples('cello', ['C2', 'D2', 'E2', 'F2', 'A2', 'C3', 'D3', 'E3', 'F#3', 'A3', 'C4', 'D4', 'E4', 'F#4', 'A4', 'C5']), attack: 0.06, release: 0.5, gain: 1 },
    [36, 76],
    0.5,
  ),
  sampler(
    'pizzicato-strings',
    'Pizzicato Strings',
    'Strings',
    'violin',
    'Plucked string section',
    { samples: soundfont('pizzicato_strings', ['G2', 'C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6']), release: 0.25, gain: 5, spread: 0.35 },
    [36, 96],
    0.25,
  ),
  sampler(
    'harp',
    'Harp',
    'Strings',
    'harp',
    'Concert harp',
    { samples: nbSamples('harp', ['E1', 'G1', 'B1', 'D2', 'F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5', 'D6', 'F6', 'A6', 'D7']), release: 1.2, gain: 1.1, spread: 0.4 },
    [28, 100],
    1.2,
  ),
  {
    ...synth('string-ensemble', 'String Ensemble', 'violin', 'Lush ensemble strings', {
      oscs: [
        { type: 'sawtooth', gain: 0.6, unison: 5, spread: 18 },
        { type: 'sawtooth', gain: 0.25, octave: -1, unison: 3, spread: 12 },
      ],
      filter: { type: 'lowpass', cutoff: 2600, q: 0.6, envAmount: 0.6, env: env(0.4, 1, 0.6, 0.8) },
      amp: env(0.35, 0.8, 0.85, 0.9),
      vibrato: { rate: 5.2, depth: 6, delay: 0.3 },
      gain: 0.35,
    }),
    category: 'Strings',
  },

  // ---------------- Winds & Brass
  sampler('flute', 'Flute', 'Winds & Brass', 'flute', 'Concert flute', { samples: nbSamples('flute', ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6', 'E6', 'A6', 'C7']), attack: 0.03, release: 0.3, gain: 0.9 }, [60, 96], 0.3),
  sampler('clarinet', 'Clarinet', 'Winds & Brass', 'flute', 'B♭ clarinet', { samples: nbSamples('clarinet', ['D3', 'F3', 'A#3', 'D4', 'F4', 'A#4', 'D5', 'F5', 'A#5', 'D6']), attack: 0.02, release: 0.25, gain: 0.9 }, [50, 91], 0.25),
  sampler('saxophone', 'Saxophone', 'Winds & Brass', 'sax', 'Alto saxophone', { samples: nbSamples('saxophone', ['C#3', 'E3', 'G3', 'A#3', 'C#4', 'E4', 'G4', 'A#4', 'C#5', 'E5', 'G5']), attack: 0.02, release: 0.25, gain: 0.9 }, [49, 81], 0.25),
  sampler('trumpet', 'Trumpet', 'Winds & Brass', 'trumpet', 'Bright trumpet', { samples: nbSamples('trumpet', ['F3', 'A3', 'C4', 'D#4', 'G4', 'A#4', 'D5', 'F5', 'A5', 'C6']), attack: 0.015, release: 0.2, gain: 0.85 }, [52, 84], 0.2),
  sampler('trombone', 'Trombone', 'Winds & Brass', 'trumpet', 'Tenor trombone', { samples: nbSamples('trombone', ['A#1', 'D#2', 'F2', 'G#2', 'A#2', 'C3', 'D3', 'F3', 'A#3', 'C4', 'D4', 'F4']), attack: 0.02, release: 0.2, gain: 0.85 }, [34, 72], 0.2),
  sampler('french-horn', 'French Horn', 'Winds & Brass', 'trumpet', 'Warm french horn', { samples: nbSamples('french-horn', ['A1', 'C2', 'D#2', 'G2', 'D3', 'F3', 'A3', 'C4', 'D5', 'F5']), attack: 0.04, release: 0.35, gain: 0.95 }, [34, 77], 0.35),
  sampler('tuba', 'Tuba', 'Winds & Brass', 'trumpet', 'Tuba', { samples: nbSamples('tuba', ['F1', 'A#1', 'D#2', 'A#2', 'D3', 'F3', 'A#3', 'D4']), attack: 0.03, release: 0.25, gain: 1 }, [28, 58], 0.25),
  sampler('bassoon', 'Bassoon', 'Winds & Brass', 'flute', 'Bassoon', { samples: nbSamples('bassoon', ['G2', 'A2', 'C3', 'G3', 'A3', 'C4', 'E4', 'G4', 'A4', 'C5']), attack: 0.03, release: 0.25, gain: 0.95 }, [34, 75], 0.25),
  {
    ...synth('brass-section', 'Synth Brass', 'trumpet', 'Punchy 80s brass section', {
      oscs: [
        { type: 'sawtooth', gain: 0.6, unison: 3, spread: 10 },
        { type: 'sawtooth', gain: 0.3, detune: 7 },
      ],
      filter: { type: 'lowpass', cutoff: 900, q: 1, envAmount: 2.2, env: env(0.06, 0.4, 0.5, 0.2) },
      amp: env(0.04, 0.3, 0.85, 0.25),
      vibrato: { rate: 5, depth: 5, delay: 0.4 },
      gain: 0.35,
    }),
    category: 'Winds & Brass',
  },

  // ---------------- Mallets & Bells
  sampler('xylophone', 'Xylophone', 'Mallets & Bells', 'mallet', 'Wooden xylophone', { samples: nbSamples('xylophone', ['G4', 'C5', 'G5', 'C6', 'G6', 'C7', 'G7', 'C8']), release: 0.8, gain: 1, spread: 0.35 }, [65, 108], 0.8),
  {
    ...synth('marimba', 'Marimba', 'mallet', 'Soft marimba', {
      oscs: [{ type: 'sine', gain: 1 }, { type: 'sine', octave: 2, gain: 0.12 }],
      fm: { ratio: 4, index: 0.6, decay: 0.08, sustain: 0 },
      filter: { type: 'lowpass', cutoff: 4000, q: 0.5, envAmount: 0, env: env(0.001, 0.2, 1, 0.2) },
      amp: env(0.002, 0.9, 0, 0.5),
      gain: 0.7,
    }),
    category: 'Mallets & Bells',
  },
  {
    ...synth('bells', 'Crystal Bells', 'bell', 'Glassy FM bells', {
      oscs: [{ type: 'sine', gain: 1 }],
      fm: { ratio: 3.5, index: 2.2, decay: 1.5, sustain: 0.1 },
      filter: { type: 'lowpass', cutoff: 9000, q: 0.5, envAmount: 0, env: env(0.001, 0.2, 1, 0.2) },
      amp: env(0.002, 2.5, 0, 1.8),
      gain: 0.45,
    }),
    category: 'Mallets & Bells',
  },
  {
    ...synth('music-box', 'Music Box', 'bell', 'Tiny music box', {
      oscs: [{ type: 'sine', gain: 1 }, { type: 'triangle', octave: 1, gain: 0.2 }],
      fm: { ratio: 7, index: 0.9, decay: 0.3, sustain: 0 },
      filter: { type: 'highpass', cutoff: 300, q: 0.5, envAmount: 0, env: env(0.001, 0.2, 1, 0.2) },
      amp: env(0.001, 1.4, 0, 1),
      gain: 0.45,
    }),
    category: 'Mallets & Bells',
  },

  // ---------------- Synths
  synth('analog-lead', 'Analog Lead', 'synth', 'Classic mono-style saw lead', {
    oscs: [
      { type: 'sawtooth', gain: 0.6, detune: 6 },
      { type: 'sawtooth', gain: 0.6, detune: -6 },
      { type: 'square', gain: 0.3, octave: -1 },
    ],
    filter: { type: 'lowpass', cutoff: 1400, q: 3, envAmount: 2, env: env(0.005, 0.3, 0.4, 0.2) },
    amp: env(0.005, 0.2, 0.8, 0.15),
    vibrato: { rate: 5.5, depth: 8, delay: 0.35 },
    gain: 0.32,
  }),
  synth('supersaw', 'Supersaw', 'synth', 'Huge detuned trance saw', {
    oscs: [{ type: 'sawtooth', gain: 1, unison: 7, spread: 28 }],
    filter: { type: 'lowpass', cutoff: 3500, q: 1, envAmount: 1, env: env(0.01, 0.5, 0.6, 0.3) },
    amp: env(0.01, 0.3, 0.85, 0.35),
    gain: 0.3,
  }),
  synth('warm-pad', 'Warm Pad', 'pad', 'Slow evolving pad', {
    oscs: [
      { type: 'sawtooth', gain: 0.5, unison: 4, spread: 14 },
      { type: 'triangle', gain: 0.5, octave: -1 },
    ],
    filter: { type: 'lowpass', cutoff: 900, q: 1.2, envAmount: 1.4, env: env(1.2, 1.5, 0.5, 1.5) },
    amp: env(0.9, 1, 0.9, 1.8),
    vibrato: { rate: 0.4, depth: 6, delay: 0 },
    gain: 0.35,
  }),
  synth('dream-pad', 'Dream Pad', 'pad', 'Airy, glassy pad', {
    oscs: [
      { type: 'sine', gain: 0.6, unison: 3, spread: 10 },
      { type: 'triangle', gain: 0.3, octave: 1, unison: 2, spread: 8 },
    ],
    noise: 0.03,
    filter: { type: 'lowpass', cutoff: 2400, q: 0.8, envAmount: 0.8, env: env(1.5, 2, 0.6, 2) },
    amp: env(1.2, 1, 0.9, 2.5),
    gain: 0.4,
  }),
  synth('pluck', 'Pluck', 'synth', 'Bright synth pluck', {
    oscs: [
      { type: 'sawtooth', gain: 0.6, unison: 3, spread: 12 },
      { type: 'square', gain: 0.3, octave: 1 },
    ],
    filter: { type: 'lowpass', cutoff: 500, q: 2, envAmount: 3.6, env: env(0.001, 0.18, 0, 0.15) },
    amp: env(0.001, 0.5, 0, 0.3),
    gain: 0.4,
  }),
  synth('square-lead', 'Square Lead', 'synth', 'Hollow square-wave lead', {
    oscs: [{ type: 'square', gain: 0.7 }, { type: 'square', gain: 0.4, detune: 9 }],
    filter: { type: 'lowpass', cutoff: 2600, q: 1.5, envAmount: 0.8, env: env(0.005, 0.3, 0.6, 0.2) },
    amp: env(0.005, 0.1, 0.9, 0.12),
    vibrato: { rate: 6, depth: 10, delay: 0.25 },
    gain: 0.28,
  }),
  synth('chiptune', 'Retro Chip', 'game', '8-bit console voice', {
    oscs: [{ type: 'square', gain: 0.8 }],
    filter: { type: 'lowpass', cutoff: 12000, q: 0.3, envAmount: 0, env: env(0.001, 0.1, 1, 0.05) },
    amp: env(0.001, 0.12, 0.7, 0.04),
    gain: 0.22,
  }),
  synth('wobble-bass', 'Wobble Bass', 'bass', 'Gritty dubstep-style growl', {
    oscs: [
      { type: 'sawtooth', gain: 0.6, unison: 3, spread: 15 },
      { type: 'square', gain: 0.5, octave: -1 },
    ],
    filter: { type: 'lowpass', cutoff: 600, q: 8, envAmount: 2.5, env: env(0.08, 0.25, 0.3, 0.2) },
    amp: env(0.005, 0.3, 0.9, 0.12),
    vibrato: { rate: 4, depth: 0, delay: 0 },
    gain: 0.35,
  }, [24, 60]),
  synth('choir', 'Synth Choir', 'pad', 'Breathy "aah" voices', {
    oscs: [
      { type: 'sawtooth', gain: 0.4, unison: 5, spread: 14 },
      { type: 'sine', gain: 0.4 },
    ],
    noise: 0.04,
    filter: { type: 'bandpass', cutoff: 900, q: 1.4, envAmount: 0.5, env: env(0.4, 1, 0.8, 1) },
    amp: env(0.35, 0.6, 0.9, 1),
    vibrato: { rate: 5, depth: 7, delay: 0.3 },
    gain: 0.5,
  }),

  // ---------------- Drums
  kit('kit-acoustic', 'Studio Kit', 'Natural acoustic drum kit', 'acoustic-kit', 'acoustic'),
  kit('kit-808', 'Hip Hop 808', 'Booming TR-808 style kit', null, '808'),
  kit('kit-909', 'House 909', 'Punchy TR-909 style kit', null, '909'),
  kit('kit-linn', 'Linn Drum', '80s LinnDrum machine', 'LINN', '909'),
  kit('kit-cr78', 'Vintage CR-78', 'Retro rhythm box', 'CR78', 'lofi'),
  kit('kit-techno', 'Techno Kit', 'Hard techno drums', 'Techno', '909'),
  kit('kit-lofi', 'Lo-Fi Kit', 'Dusty boom-bap kit', 'Kit8', 'lofi'),
  kit('kit-stark', 'Stark Kit', 'Crisp electronic kit', 'Stark', '808'),
  kit('kit-fm', 'FM Kit', 'Digital FM percussion', '4OP-FM', '909'),
  kit('kit-r8', 'R8 Kit', 'Late-80s drum machine', 'R8', 'acoustic'),
  kit('kit-bongos', 'Percussion', 'Bongos & hand percussion', 'Bongos', 'acoustic'),

  // ---------------- Sampler
  {
    id: 'user-sampler',
    name: 'Sampler',
    category: 'Sampler',
    icon: 'sampler',
    description: 'Record or import any sound and play it chromatically',
    kind: 'user-sampler',
    controls: SAMPLER_CONTROLS,
    range: [36, 96],
  },
];

export const PRESET_MAP: Record<string, InstrumentPreset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

export function getPreset(id: string): InstrumentPreset {
  return PRESET_MAP[id] ?? PRESET_MAP['grand-piano'];
}

export const CATEGORIES: InstrumentCategory[] = ['Keyboards', 'Guitars & Bass', 'Strings', 'Winds & Brass', 'Mallets & Bells', 'Synths', 'Drums', 'Sampler'];

export const DRUM_KIT_PITCHES = DRUM_LANES;
