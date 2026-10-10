// Music theory helpers.
import type { KeySignature } from './types';

export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Tonics (pitch classes) whose key signatures use flats. */
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]); // Dm Gm Cm Fm Bbm Ebm

export function keyUsesFlats(key: KeySignature): boolean {
  return key.mode === 'major' ? FLAT_MAJOR.has(key.tonic) : FLAT_MINOR.has(key.tonic);
}

export function pitchClassName(pc: number, flats = false): string {
  return (flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[((pc % 12) + 12) % 12];
}

export function noteName(pitch: number, flats = false): string {
  return pitchClassName(pitch, flats) + (Math.floor(pitch / 12) - 1);
}

export function keyName(key: KeySignature): string {
  return pitchClassName(key.tonic, keyUsesFlats(key)) + (key.mode === 'minor' ? ' minor' : ' major');
}

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

export function midiToFreq(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

/** Parse "C#4", "Db3", "A0" → MIDI number. */
export function parseNote(name: string): number {
  const m = /^([A-Ga-g])([#bs]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('Bad note ' + name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase() as 'C'];
  const acc = m[2] === '#' || m[2] === 's' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3]) + 1) * 12 + base + acc;
}

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export function scaleOfKey(key: KeySignature): number[] {
  return SCALES[key.mode].map((s) => (s + key.tonic) % 12);
}

export function inScale(pitch: number, scale: number[]): boolean {
  return scale.includes(((pitch % 12) + 12) % 12);
}

/** Snap a pitch to the nearest pitch in the given pitch-class set (prefers downward on ties). */
export function snapToScale(pitch: number, scale: number[]): number {
  for (let d = 0; d < 12; d++) {
    if (inScale(pitch - d, scale)) return pitch - d;
    if (inScale(pitch + d, scale)) return pitch + d;
  }
  return pitch;
}

export interface ChordDef {
  name: string;
  root: number; // pitch class
  quality: '' | 'm' | 'dim' | '7' | 'maj7' | 'm7' | 'sus4' | 'sus2' | 'aug';
}

const QUALITY_INTERVALS: Record<ChordDef['quality'], number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
};

export function chordIntervals(q: ChordDef['quality']): number[] {
  return QUALITY_INTERVALS[q];
}

/** Voice a chord in a comfortable range around `center`. */
export function chordPitches(chord: ChordDef, center = 60): number[] {
  const ints = QUALITY_INTERVALS[chord.quality];
  let root = center - 6 + (((chord.root - (center - 6)) % 12) + 12) % 12;
  return ints.map((i) => root + i);
}

/** The eight GarageBand-style chord strips for a key (I ii iii IV V vi + bVII, and V/V). */
export function diatonicChords(key: KeySignature): ChordDef[] {
  const flats = keyUsesFlats(key);
  const t = key.tonic;
  const mk = (off: number, q: ChordDef['quality']): ChordDef => ({
    root: (t + off) % 12,
    quality: q,
    name: pitchClassName(t + off, flats) + (q === 'm' ? 'm' : q === 'dim' ? '°' : q),
  });
  if (key.mode === 'major') {
    return [mk(0, ''), mk(2, 'm'), mk(4, 'm'), mk(5, ''), mk(7, ''), mk(9, 'm'), mk(10, ''), mk(2, '')];
  }
  return [mk(0, 'm'), mk(2, 'dim'), mk(3, ''), mk(5, 'm'), mk(7, 'm'), mk(8, ''), mk(10, ''), mk(7, '')];
}

export function beatsPerBar(timeSig: [number, number]): number {
  return timeSig[0] * (4 / timeSig[1]);
}

/** Format a beat position as bar.beat.sixteenth (1-based). */
export function formatPosition(beat: number, timeSig: [number, number]): string {
  const bpb = beatsPerBar(timeSig);
  const beatLen = 4 / timeSig[1];
  const bar = Math.floor(beat / bpb) + 1;
  const inBar = beat - (bar - 1) * bpb;
  const b = Math.floor(inBar / beatLen) + 1;
  const six = Math.floor(((inBar % beatLen) / beatLen) * 4) + 1;
  return `${bar}.${b}.${six}`;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export const GRID_OPTIONS: { label: string; value: number }[] = [
  { label: 'Bar', value: 4 },
  { label: '1/2', value: 2 },
  { label: '1/4', value: 1 },
  { label: '1/8', value: 0.5 },
  { label: '1/16', value: 0.25 },
  { label: '1/32', value: 0.125 },
  { label: '1/8T', value: 1 / 3 },
  { label: '1/16T', value: 1 / 6 },
];

export function snap(value: number, grid: number): number {
  if (!grid) return value;
  return Math.round(value / grid) * grid;
}

export function snapFloor(value: number, grid: number): number {
  if (!grid) return value;
  return Math.floor(value / grid + 1e-9) * grid;
}

/** General MIDI drum map names (subset used by the kits). */
export const DRUM_NAMES: Record<number, string> = {
  35: 'Kick 2',
  36: 'Kick',
  37: 'Rim',
  38: 'Snare',
  39: 'Clap',
  40: 'Snare 2',
  41: 'Low Tom',
  42: 'Closed Hat',
  43: 'Floor Tom',
  44: 'Pedal Hat',
  45: 'Mid Tom',
  46: 'Open Hat',
  47: 'Mid Tom 2',
  48: 'High Tom',
  49: 'Crash',
  50: 'High Tom 2',
  51: 'Ride',
  54: 'Tambourine',
  56: 'Cowbell',
  70: 'Shaker',
  75: 'Claves',
};

/** Lanes shown in the step sequencer, top to bottom. */
export const DRUM_LANES: number[] = [36, 38, 39, 42, 46, 45, 41, 49, 51, 37, 56, 70];
