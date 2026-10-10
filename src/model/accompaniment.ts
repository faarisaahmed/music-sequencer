// Chord theory for the chord track: chord names, diatonic chords, progressions
// and next-chord suggestions. Pure functions — no UI, no audio.
import type { ChordQuality, ChordSymbol, KeySignature } from './types';
import { keyUsesFlats, pitchClassName, scaleOfKey } from './music';
import { uid } from './defaults';

// ------------------------------------------------------------------ chords

export const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  add9: [0, 4, 7, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  m9: [0, 3, 7, 10, 14],
  '9': [0, 4, 7, 10, 14],
};

export const QUALITY_LABEL: Record<ChordQuality, string> = {
  '': '',
  m: 'm',
  dim: '°',
  aug: '+',
  '7': '7',
  maj7: 'maj7',
  m7: 'm7',
  sus4: 'sus4',
  sus2: 'sus2',
  add9: 'add9',
  '6': '6',
  m6: 'm6',
  m9: 'm9',
  '9': '9',
};

export const ALL_QUALITIES: ChordQuality[] = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'dim', 'aug', 'add9', '6', 'm6', '9', 'm9'];

/** Spell a chord root sensibly for the key (flats for flat keys and borrowed ♭ chords). */
export function rootName(pc: number, key: KeySignature): string {
  const rel = (((pc - key.tonic) % 12) + 12) % 12;
  const borrowedFlat = key.mode === 'major' ? [1, 3, 8, 10].includes(rel) : rel === 1;
  return pitchClassName(pc, keyUsesFlats(key) || borrowedFlat);
}

export function chordName(c: { root: number; quality: ChordQuality; bass?: number }, key: KeySignature): string {
  const base = rootName(c.root, key) + QUALITY_LABEL[c.quality];
  return c.bass !== undefined && c.bass !== c.root ? `${base}/${rootName(c.bass, key)}` : base;
}

export function chordPcs(c: { root: number; quality: ChordQuality }): number[] {
  return QUALITY_INTERVALS[c.quality].map((i) => (c.root + i) % 12);
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_QUALS: ChordQuality[] = ['', 'm', 'm', '', '', 'm', 'dim'];
const MINOR_QUALS: ChordQuality[] = ['m', 'dim', '', 'm', 'm', '', ''];
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

/** Diatonic triad (and 7th) on a scale degree 0..6. */
export function diatonic(key: KeySignature, degree: number, seventh = false): { root: number; quality: ChordQuality } {
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const quals = key.mode === 'major' ? MAJOR_QUALS : MINOR_QUALS;
  const d = ((degree % 7) + 7) % 7;
  let q = quals[d];
  const root = (key.tonic + steps[d]) % 12;
  if (seventh) {
    const third = q === 'm' || q === 'dim' ? 3 : 4;
    const pcs = new Set(scaleOfKey(key));
    const sev = (root + 10) % 12;
    if (q === 'dim') q = 'm7'; // approximate half-diminished as m7 colour
    else if (third === 3) q = 'm7';
    else q = pcs.has(sev) ? '7' : 'maj7';
  }
  return { root, quality: q };
}

/**
 * Parse a roman-numeral progression relative to the key, e.g. "I V vi IV", "i bVI bVII",
 * "ii7 V7 Imaj7", "IVsus2". Upper case = major, lower = minor, ° = dim, + = aug.
 */
export function parseProgression(text: string, key: KeySignature): { root: number; quality: ChordQuality }[] {
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const out: { root: number; quality: ChordQuality }[] = [];
  for (const tok of text.trim().split(/[\s,–-]+/)) {
    const m = /^([b#]?)([ivIV]+)(°|\+)?(maj7|m7|7|sus4|sus2|add9|6|9)?$/.exec(tok);
    if (!m) continue;
    const [, acc, numeral, mark, suffix] = m;
    const idx = ROMAN.indexOf(numeral.toLowerCase());
    if (idx < 0) continue;
    const upper = numeral === numeral.toUpperCase();
    const root = (key.tonic + steps[idx] + (acc === 'b' ? -1 : acc === '#' ? 1 : 0) + 12) % 12;
    let q: ChordQuality = upper ? '' : 'm';
    if (mark === '°') q = 'dim';
    if (mark === '+') q = 'aug';
    if (suffix === '7') q = upper ? '7' : 'm7';
    else if (suffix === 'maj7') q = 'maj7';
    else if (suffix === 'm7') q = 'm7';
    else if (suffix === 'sus4') q = 'sus4';
    else if (suffix === 'sus2') q = 'sus2';
    else if (suffix === 'add9') q = upper ? 'add9' : 'm';
    else if (suffix === '6') q = upper ? '6' : 'm6';
    else if (suffix === '9') q = upper ? '9' : 'm9';
    out.push({ root, quality: q });
  }
  return out;
}

/** Lay a list of chords along the timeline, `beatsEach` beats per chord, repeating to fill. */
export function layChords(chords: { root: number; quality: ChordQuality }[], start: number, length: number, beatsEach: number): ChordSymbol[] {
  const out: ChordSymbol[] = [];
  if (!chords.length) return out;
  let i = 0;
  for (let b = start; b < start + length - 1e-6; b += beatsEach, i++) {
    const c = chords[i % chords.length];
    const len = Math.min(beatsEach, start + length - b);
    const prev = out[out.length - 1];
    // Merge identical consecutive chords into one longer symbol.
    if (prev && prev.root === c.root && prev.quality === c.quality && Math.abs(prev.beat + prev.length - b) < 1e-6) prev.length += len;
    else out.push({ id: uid('c'), beat: b, length: len, root: c.root, quality: c.quality });
  }
  return out;
}

export interface ProgressionPreset {
  name: string;
  roman: string;
  mode: 'major' | 'minor';
  tags: string[];
}

export const PROGRESSIONS: ProgressionPreset[] = [
  { name: 'Axis (Pop)', roman: 'I V vi IV', mode: 'major', tags: ['pop', 'rock', 'verse', 'chorus'] },
  { name: 'Sensitive', roman: 'vi IV I V', mode: 'major', tags: ['pop', 'edm', 'chorus'] },
  { name: "'50s", roman: 'I vi IV V', mode: 'major', tags: ['pop', 'ballad', 'verse'] },
  { name: 'Uplift', roman: 'IV V iii vi', mode: 'major', tags: ['pop', 'chorus'] },
  { name: 'Anthem', roman: 'I IV vi V', mode: 'major', tags: ['pop', 'rock', 'chorus'] },
  { name: 'Classic Rock', roman: 'I bVII IV I', mode: 'major', tags: ['rock'] },
  { name: 'Folk', roman: 'I IV I V', mode: 'major', tags: ['country', 'verse'] },
  { name: 'Jazz ii–V–I', roman: 'ii7 V7 Imaj7 Imaj7', mode: 'major', tags: ['jazz'] },
  { name: 'Turnaround', roman: 'Imaj7 vi7 ii7 V7', mode: 'major', tags: ['jazz', 'rnb'] },
  { name: 'Neo-Soul', roman: 'IVmaj7 iii7 ii7 Imaj7', mode: 'major', tags: ['lofi', 'rnb'] },
  { name: 'Royal Road', roman: 'IVmaj7 V7 iii7 vi', mode: 'major', tags: ['lofi', 'pop'] },
  { name: 'Bridge Lift', roman: 'ii IV vi V', mode: 'major', tags: ['bridge'] },
  { name: 'Borrowed', roman: 'bVI bVII I I', mode: 'major', tags: ['bridge', 'cinematic'] },
  { name: 'Epic Minor', roman: 'i VI III VII', mode: 'minor', tags: ['pop', 'edm', 'cinematic', 'verse'] },
  { name: 'Andalusian', roman: 'i VII VI V', mode: 'minor', tags: ['rock', 'cinematic'] },
  { name: 'Dark Pop', roman: 'i iv VI V', mode: 'minor', tags: ['pop', 'rnb', 'verse'] },
  { name: 'Lament', roman: 'i VII VI VII', mode: 'minor', tags: ['synthwave', 'edm'] },
  { name: 'Minor Lift', roman: 'VI VII i i', mode: 'minor', tags: ['chorus'] },
  { name: 'Heroic', roman: 'VI III VII i', mode: 'minor', tags: ['chorus', 'cinematic'] },
  { name: 'Minor Blues', roman: 'i iv v i', mode: 'minor', tags: ['hiphop', 'verse'] },
  { name: 'Lo-Fi Minor', roman: 'i7 iv7 VImaj7 V7', mode: 'minor', tags: ['lofi', 'hiphop', 'rnb'] },
  { name: 'Minor Bridge', roman: 'iv v VI VII', mode: 'minor', tags: ['bridge'] },
];

/** Common next-chord suggestions after a given chord (functional harmony heuristics). */
export function suggestNext(prev: { root: number; quality: ChordQuality } | null, key: KeySignature): { root: number; quality: ChordQuality; why: string }[] {
  const deg = (d: number, w: string, seventh = false) => ({ ...diatonic(key, d, seventh), why: w });
  if (!prev) return [deg(0, 'Start on home'), deg(5, 'Start moody'), deg(3, 'Start open')];
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const rel = (((prev.root - key.tonic) % 12) + 12) % 12;
  const d = steps.indexOf(rel);
  const table: Record<number, [number, string][]> = {
    0: [[3, 'Lift to IV'], [4, 'Tension to V'], [5, 'Turn to vi'], [1, 'Gentle ii']],
    1: [[4, 'ii → V (classic)'], [3, 'Back to IV'], [6, 'Lead tone']],
    2: [[5, 'Down to vi'], [3, 'Up to IV'], [0, 'Home']],
    3: [[4, 'IV → V'], [0, 'Plagal home'], [1, 'ii colour'], [5, 'Deceptive feel']],
    4: [[0, 'Resolve home'], [5, 'Deceptive cadence'], [3, 'Back to IV']],
    5: [[3, 'vi → IV'], [1, 'vi → ii'], [4, 'Push to V']],
    6: [[0, 'Resolve'], [2, 'Step down']],
  };
  const opts = d >= 0 ? table[d] : [[0, 'Back home'], [4, 'Dominant']];
  const out = (opts as [number, string][]).map(([x, w]) => deg(x, w));
  if (key.mode === 'minor' && d >= 0) out.push({ root: (key.tonic + 7) % 12, quality: '7', why: 'Strong V7 (harmonic minor)' });
  return out;
}

export function chordAt(chords: ChordSymbol[], beat: number): ChordSymbol | undefined {
  let best: ChordSymbol | undefined;
  for (const c of chords) {
    if (c.beat <= beat + 1e-6 && (!best || c.beat > best.beat)) best = c;
  }
  return best;
}

/** Chord segments overlapping [start, end), clipped. */
export function chordSegments(chords: ChordSymbol[], start: number, end: number): { chord: ChordSymbol; s: number; e: number }[] {
  const sorted = [...chords].sort((a, b) => a.beat - b.beat);
  const out: { chord: ChordSymbol; s: number; e: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const next = sorted[i + 1];
    const cEnd = Math.min(c.beat + c.length, next ? next.beat : Infinity);
    const s = Math.max(start, c.beat);
    const e = Math.min(end, cEnd);
    if (e - s > 1e-6) out.push({ chord: c, s, e });
  }
  return out;
}
