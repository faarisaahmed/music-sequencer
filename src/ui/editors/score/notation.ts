// Pure conversion of MIDI notes → notated measures (pieces, chords, ties, rests).
import type { KeySignature, MidiRegion } from '../../../model/types';

export const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
export const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B (letter indices)
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

const MAJOR_FIFTHS: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: -6, 5: -1, 10: -2, 3: -3, 8: -4, 1: -5 };
const VF_MAJOR_NAMES: Record<number, string> = {
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
  [-1]: 'F', [-2]: 'Bb', [-3]: 'Eb', [-4]: 'Ab', [-5]: 'Db', [-6]: 'Gb', [-7]: 'Cb',
};

/** Number of sharps (>0) or flats (<0) in the key signature. */
export function keyFifths(key: KeySignature): number {
  const majorPc = key.mode === 'major' ? key.tonic : (key.tonic + 3) % 12;
  return MAJOR_FIFTHS[majorPc];
}

/** VexFlow key signature spec (uses the relative major). */
export function vexKeySpec(key: KeySignature): string {
  return VF_MAJOR_NAMES[keyFifths(key)];
}

/** Alteration of each letter (0..6) implied by the key signature. */
export function keyAlters(key: KeySignature): number[] {
  const f = keyFifths(key);
  const alters = [0, 0, 0, 0, 0, 0, 0];
  if (f > 0) for (let i = 0; i < f; i++) alters[SHARP_ORDER[i]] = 1;
  if (f < 0) for (let i = 0; i < -f; i++) alters[FLAT_ORDER[i]] = -1;
  return alters;
}

export interface Spelled {
  letter: number; // 0..6 (C..B)
  alter: number; // -2..2
  octave: number;
}

/** Spell a MIDI pitch in the given key (diatonic spelling if possible, else sharps in sharp keys / flats in flat keys). */
export function spell(pitch: number, key: KeySignature): Spelled {
  const pc = ((pitch % 12) + 12) % 12;
  const alters = keyAlters(key);
  const fifths = keyFifths(key);
  let best: { letter: number; alter: number } | null = null;
  for (let l = 0; l < 7; l++) {
    if ((((NATURAL_PC[l] + alters[l]) % 12) + 12) % 12 === pc) best = { letter: l, alter: alters[l] };
  }
  if (!best) {
    const prefer = fifths < 0 ? -1 : 1;
    for (const a of [prefer, 0, -prefer]) {
      for (let l = 0; l < 7; l++) {
        if ((((NATURAL_PC[l] + a) % 12) + 12) % 12 === pc) {
          best = { letter: l, alter: a };
          break;
        }
      }
      if (best) break;
    }
  }
  const b = best!;
  const naturalPitch = pitch - b.alter;
  return { letter: b.letter, alter: b.alter, octave: Math.floor(naturalPitch / 12) - 1 };
}

export function diatonicIndex(s: Spelled): number {
  return s.octave * 7 + s.letter;
}

/** Pitch for a diatonic index in the key (key-signature alteration applied). */
export function pitchFromDiatonic(dIdx: number, key: KeySignature, alterOverride?: number | null): number {
  const letter = ((dIdx % 7) + 7) % 7;
  const octave = Math.floor(dIdx / 7);
  const alter = alterOverride ?? keyAlters(key)[letter];
  return (octave + 1) * 12 + NATURAL_PC[letter] + alter;
}

/** Shift a pitch by diatonic steps within the key. */
export function diatonicShift(pitch: number, steps: number, key: KeySignature): number {
  const s = spell(pitch, key);
  return pitchFromDiatonic(diatonicIndex(s) + steps, key);
}

// ------------------------------------------------------------------ durations

export const DUR_CODES: [number, string][] = [
  [4, 'w'],
  [3, 'hd'],
  [2, 'h'],
  [1.5, 'qd'],
  [1, 'q'],
  [0.75, '8d'],
  [0.5, '8'],
  [0.375, '16d'],
  [0.25, '16'],
  [0.125, '32'],
];
const DOTTED = new Set([3, 1.5, 0.75, 0.375]);

const aligned = (x: number, u: number) => Math.abs(x / u - Math.round(x / u)) < 1e-6;

function fits(p: number, v: number, bpb: number): boolean {
  if (v > bpb - p + 1e-6) return false;
  if (v === 4) return p < 1e-6;
  if (v >= 2) return aligned(p, 1);
  if (v === 1) return aligned(p, 1);
  if (v === 1.5) return aligned(p, 0.5);
  const base = DOTTED.has(v) ? v / 1.5 : v;
  return aligned(p, base) && Math.floor(p + 1e-6) === Math.floor(p + v - 1e-6);
}

/** Split a span [p, p+len) (measure-relative) into notatable durations. */
export function decompose(p: number, len: number, bpb: number): [number, number][] {
  const out: [number, number][] = [];
  let pos = p;
  let rem = len;
  let guard = 0;
  while (rem > 1e-6 && guard++ < 64) {
    let v = DUR_CODES.find(([d]) => d <= rem + 1e-6 && fits(pos, d, bpb))?.[0];
    if (v === undefined) v = DUR_CODES.find(([d]) => d <= rem + 1e-6 && !DOTTED.has(d) && aligned(pos, d))?.[0] ?? Math.min(rem, 0.125);
    out.push([pos, v]);
    pos += v;
    rem -= v;
  }
  return out;
}

export function durCode(v: number): string {
  return DUR_CODES.find(([d]) => Math.abs(d - v) < 1e-6)?.[1] ?? '32';
}

// ------------------------------------------------------------------ measures

export interface Piece {
  start: number; // measure-relative beats
  dur: number;
  rest: boolean;
  wholeMeasure?: boolean;
  pitches: number[]; // ascending
  noteIds: string[];
  velocities: number[];
  /** Per pitch: true when this piece continues the same note from an earlier piece (tie into). */
  tied: boolean[];
}

export interface StaffMeasure {
  pieces: Piece[];
}

export interface MeasureModel {
  index: number;
  start: number; // region-view-relative beats
  staves: StaffMeasure[];
}

export type StaffKind = 'treble' | 'bass';

export interface ScoreModel {
  staves: StaffKind[];
  measures: MeasureModel[];
  bpb: number;
  viewStart: number; // content offset of view beat 0
  viewLen: number;
}

export interface QNote {
  id: string;
  pitch: number;
  s: number;
  e: number;
  vel: number;
}

export type ClefMode = 'auto' | 'treble' | 'bass' | 'grand';

export const SPLIT = 60;

/** Region notes visible in the editor, in view-relative quantized beats. */
export function viewNotes(r: MidiRegion, grid: number): { notes: QNote[]; viewStart: number; viewLen: number } {
  const viewStart = r.loop ? 0 : r.offset;
  const viewLen = r.loop ? r.contentLength : r.length;
  const notes: QNote[] = [];
  for (const n of r.notes) {
    const t = n.start - viewStart;
    if (t < -1e-6 || t >= viewLen - 1e-6) continue;
    const s = Math.max(0, Math.round(t / grid) * grid);
    let e = Math.round((t + n.duration) / grid) * grid;
    if (e <= s) e = s + grid;
    notes.push({ id: n.id, pitch: n.pitch, s, e, vel: n.velocity });
  }
  notes.sort((a, b) => a.s - b.s || a.pitch - b.pitch);
  return { notes, viewStart, viewLen };
}

export function chooseStaves(mode: ClefMode, notes: QNote[], rangeHint?: [number, number]): StaffKind[] {
  if (mode === 'treble') return ['treble'];
  if (mode === 'bass') return ['bass'];
  if (mode === 'grand') return ['treble', 'bass'];
  if (!notes.length) {
    if (rangeHint && (rangeHint[0] + rangeHint[1]) / 2 < 52) return ['bass'];
    return ['treble'];
  }
  const lo = Math.min(...notes.map((n) => n.pitch));
  const hi = Math.max(...notes.map((n) => n.pitch));
  if (lo >= 55) return ['treble'];
  if (hi <= 64) return ['bass'];
  return ['treble', 'bass'];
}

export function staffOf(pitch: number, staves: StaffKind[]): number {
  if (staves.length === 1) return 0;
  return pitch >= SPLIT ? 0 : 1;
}

export function buildScore(notes: QNote[], staves: StaffKind[], bpb: number, viewLen: number, viewStart: number, extraMeasures: number): ScoreModel {
  const lastEnd = Math.max(viewLen, ...notes.map((n) => n.e));
  const count = Math.max(1, Math.ceil(lastEnd / bpb - 1e-6)) + extraMeasures;
  const measures: MeasureModel[] = [];
  const perStaff = staves.map((_, i) => notes.filter((n) => staffOf(n.pitch, staves) === i));
  for (let m = 0; m < count; m++) {
    const ms = m * bpb;
    const me = ms + bpb;
    const sm: StaffMeasure[] = perStaff.map((list) => {
      const inM = list.filter((n) => n.s < me - 1e-6 && n.e > ms + 1e-6);
      if (!inM.length) {
        return { pieces: [{ start: 0, dur: bpb, rest: true, wholeMeasure: true, pitches: [], noteIds: [], velocities: [], tied: [] }] };
      }
      const bset = new Set<number>([0, bpb]);
      for (const n of inM) {
        bset.add(Math.max(0, n.s - ms));
        bset.add(Math.min(bpb, n.e - ms));
      }
      const bounds = [...bset].sort((a, b) => a - b);
      // Build slices, merging adjacent empty slices into one rest span.
      const slices: { a: number; b: number; active: QNote[] }[] = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        const a = bounds[i];
        const b = bounds[i + 1];
        if (b - a < 1e-6) continue;
        const seen = new Set<number>();
        const active = inM
          .filter((n) => n.s - ms < b - 1e-6 && n.e - ms > a + 1e-6)
          .filter((n) => (seen.has(n.pitch) ? false : (seen.add(n.pitch), true)))
          .sort((x, y) => x.pitch - y.pitch);
        const prev = slices[slices.length - 1];
        if (!active.length && prev && !prev.active.length) prev.b = b;
        else slices.push({ a, b, active });
      }
      const pieces: Piece[] = [];
      for (const sl of slices) {
        for (const [pos, v] of decompose(sl.a, sl.b - sl.a, bpb)) {
          pieces.push({
            start: pos,
            dur: v,
            rest: !sl.active.length,
            pitches: sl.active.map((n) => n.pitch),
            noteIds: sl.active.map((n) => n.id),
            velocities: sl.active.map((n) => n.vel),
            tied: sl.active.map((n) => n.s < ms + pos - 1e-6),
          });
        }
      }
      return { pieces };
    });
    measures.push({ index: m, start: ms, staves: sm });
  }
  return { staves, measures, bpb, viewStart, viewLen };
}

// ------------------------------------------------------------------ dynamics

export const DYNAMICS: { mark: string; vel: number }[] = [
  { mark: 'pp', vel: 0.25 },
  { mark: 'p', vel: 0.38 },
  { mark: 'mp', vel: 0.5 },
  { mark: 'mf', vel: 0.64 },
  { mark: 'f', vel: 0.8 },
  { mark: 'ff', vel: 0.95 },
];

export function dynamicOf(vel: number): string {
  if (vel < 0.315) return 'pp';
  if (vel < 0.44) return 'p';
  if (vel < 0.57) return 'mp';
  if (vel < 0.72) return 'mf';
  if (vel < 0.875) return 'f';
  return 'ff';
}
