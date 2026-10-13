// Spelling and harmony helpers for the guides' interactive figures.
import { n, parseChord, pc, voiceLead } from './notation';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export type Mode = 'major' | 'minor';

/** Correctly spelled scale: spellScale('Eb','major') → Eb F G Ab Bb C D. */
export function spellScale(tonic: string, mode: Mode = 'major'): string[] {
  const steps = mode === 'major' ? MAJOR : MINOR;
  const li = LETTERS.indexOf(tonic[0].toUpperCase());
  const t = pc(tonic);
  return steps.map((s, i) => {
    const L = (li + i) % 7;
    const want = (t + s) % 12;
    let diff = (want - LETTER_PC[L] + 12) % 12;
    if (diff > 6) diff -= 12;
    return LETTERS[L] + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
  });
}

const MAJ_Q = ['', 'm', 'm', '', '', 'm', 'dim'];
const MIN_Q = ['m', 'dim', '', 'm', 'm', '', ''];
const MAJ_Q7 = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
const MIN_Q7 = ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'];
const MAJ_RN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MIN_RN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

export type ChordFunction = 'home' | 'away' | 'tension';
const MAJ_FN: ChordFunction[] = ['home', 'away', 'home', 'away', 'tension', 'home', 'tension'];
const MIN_FN: ChordFunction[] = ['home', 'away', 'home', 'away', 'tension', 'away', 'tension'];

export interface DiatonicChord {
  degree: number;
  numeral: string;
  symbol: string;
  fn: ChordFunction;
}

/** The seven chords built from a key's own notes. */
export function chordsOfKey(tonic: string, mode: Mode = 'major', sevenths = false): DiatonicChord[] {
  const scale = spellScale(tonic, mode);
  const q = sevenths ? (mode === 'major' ? MAJ_Q7 : MIN_Q7) : mode === 'major' ? MAJ_Q : MIN_Q;
  const rn = mode === 'major' ? MAJ_RN : MIN_RN;
  const fn = mode === 'major' ? MAJ_FN : MIN_FN;
  return scale.map((root, i) => ({
    degree: i + 1,
    numeral: sevenths ? rn[i].replace('°', 'ø') + '7' : rn[i],
    symbol: root + q[i],
    fn: fn[i],
  }));
}

/** A piano voicing for a chord symbol (root in the bass, chord around middle C). */
export function pianoVoicing(sym: string, prev: number[] | null = null): number[] {
  const shape = parseChord(sym);
  const upper = voiceLead(prev, shape, 64);
  const root = n('C3') + shape.root - (shape.root > 6 ? 12 : 0);
  const bassPc = shape.bass ?? shape.root;
  const bass = n('C3') + bassPc - (bassPc > 6 ? 12 : 0);
  return [shape.bass !== undefined ? bass : root, ...upper];
}

export const CIRCLE_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
export const CIRCLE_MINOR = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
/** Sharps (+) or flats (−) in each circle position's key signature. */
export const CIRCLE_SIG = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];

export function sigLabel(count: number): string {
  if (count === 0) return 'no sharps or flats';
  const k = Math.abs(count);
  return `${k} ${count > 0 ? 'sharp' : 'flat'}${k > 1 ? 's' : ''}`;
}

export const FN_LABEL: Record<ChordFunction, string> = { home: 'Home', away: 'Away', tension: 'Tension' };

/** Default colours for example parts (amber is kept for drums). */
export const PART_COLORS = ['#5dbb7a', '#5b9be0', '#a07ae0', '#45b8c4', '#e06a8f', '#8cc265'];

/** Chord symbols with real ♯/♭ and ° signs. */
export function pretty(sym: string): string {
  return sym.replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭').replace(/\/([A-G])#/, '/$1♯').replace(/\/([A-G])b/, '/$1♭').replace('m7b5', 'ø7').replace('dim', '°');
}
