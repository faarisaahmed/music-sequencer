// Music theory helpers.
import type { KeySignature, ScaleType } from './types';

export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Tonics (pitch classes) whose key signatures use flats. */
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb

export interface ScaleInfo {
  id: ScaleType;
  name: string;
  family: 'major' | 'minor';
  /** Semitones from the tonic up to the major key that shares its key signature. */
  parentOffset: number;
  group: 'Common' | 'Modes' | 'Minor variants' | 'Pentatonic & blues';
}

export const SCALE_INFO: ScaleInfo[] = [
  { id: 'major', name: 'Major', family: 'major', parentOffset: 0, group: 'Common' },
  { id: 'minor', name: 'Minor', family: 'minor', parentOffset: 3, group: 'Common' },
  { id: 'dorian', name: 'Dorian', family: 'minor', parentOffset: 10, group: 'Modes' },
  { id: 'phrygian', name: 'Phrygian', family: 'minor', parentOffset: 8, group: 'Modes' },
  { id: 'lydian', name: 'Lydian', family: 'major', parentOffset: 7, group: 'Modes' },
  { id: 'mixolydian', name: 'Mixolydian', family: 'major', parentOffset: 5, group: 'Modes' },
  { id: 'locrian', name: 'Locrian', family: 'minor', parentOffset: 1, group: 'Modes' },
  { id: 'harmonic minor', name: 'Harmonic Minor', family: 'minor', parentOffset: 3, group: 'Minor variants' },
  { id: 'melodic minor', name: 'Melodic Minor', family: 'minor', parentOffset: 3, group: 'Minor variants' },
  { id: 'major pentatonic', name: 'Major Pentatonic', family: 'major', parentOffset: 0, group: 'Pentatonic & blues' },
  { id: 'minor pentatonic', name: 'Minor Pentatonic', family: 'minor', parentOffset: 3, group: 'Pentatonic & blues' },
  { id: 'blues', name: 'Blues', family: 'minor', parentOffset: 3, group: 'Pentatonic & blues' },
];

export function scaleType(key: KeySignature): ScaleType {
  return key.scale ?? key.mode;
}

export function scaleInfo(key: KeySignature): ScaleInfo {
  const id = scaleType(key);
  return SCALE_INFO.find((s) => s.id === id) ?? SCALE_INFO[0];
}

/** Build a key from a tonic and scale, deriving the major/minor family. */
export function makeKey(tonic: number, scale: ScaleType): KeySignature {
  const info = SCALE_INFO.find((s) => s.id === scale) ?? SCALE_INFO[0];
  return scale === 'major' || scale === 'minor' ? { tonic, mode: info.family } : { tonic, mode: info.family, scale };
}

/** Pitch class of the major key whose signature this key uses. */
export function parentMajorPc(key: KeySignature): number {
  return (key.tonic + scaleInfo(key).parentOffset) % 12;
}

export function keyUsesFlats(key: KeySignature): boolean {
  // A key uses flats when the major key sharing its signature does (F, Bb, Eb, Ab, Db, Gb).
  return FLAT_MAJOR.has(parentMajorPc(key));
}

export function pitchClassName(pc: number, flats = false): string {
  return (flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[((pc % 12) + 12) % 12];
}

export function noteName(pitch: number, flats = false): string {
  return pitchClassName(pitch, flats) + (Math.floor(pitch / 12) - 1);
}

export function keyName(key: KeySignature): string {
  const st = scaleType(key);
  if (st === 'major' || st === 'minor') return pitchClassName(key.tonic, keyUsesFlats(key)) + ' ' + st;
  return pitchClassName(key.tonic, keyUsesFlats(key)) + ' ' + scaleInfo(key).name;
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
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'melodic minor': [0, 2, 3, 5, 7, 9, 11],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export function scaleOfKey(key: KeySignature): number[] {
  return (SCALES[scaleType(key)] ?? SCALES[key.mode]).map((s) => (s + key.tonic) % 12);
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
    name: pitchClassName(t + off, flats || (key.mode === 'major' && off === 10)) + (q === 'm' ? 'm' : q === 'dim' ? '°' : q === 'aug' ? '+' : q),
  });
  const st = scaleType(key);
  const steps = SCALES[st];
  if (st !== 'major' && st !== 'minor' && steps && steps.length === 7) {
    // Modes: stack thirds on each scale degree, then add the family's most useful borrowed chord.
    const triads = steps.map((s, i) => {
      const third = (steps[(i + 2) % 7] - s + 12) % 12;
      const fifth = (steps[(i + 4) % 7] - s + 12) % 12;
      const q: ChordDef['quality'] = third === 4 ? (fifth === 8 ? 'aug' : '') : fifth === 6 ? 'dim' : 'm';
      return mk(s, q);
    });
    // Eighth strip: the first common borrowed chord not already in the list.
    const extra = [mk(7, ''), mk(5, ''), mk(10, ''), mk(8, ''), mk(2, '')].find((c) => !triads.some((t) => t.name === c.name)) ?? mk(7, '');
    return [...triads, extra];
  }
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
