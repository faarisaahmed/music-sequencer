// Pure conversion of MIDI notes → notated measures: parts, staves, voices, triplets, ties, rests.
import type { Articulation, KeySignature } from '../../../model/types';
import { parentMajorPc } from '../../../model/music';

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
  const majorPc = parentMajorPc(key);
  return MAJOR_FIFTHS[((majorPc % 12) + 12) % 12];
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

export const C_MAJOR: KeySignature = { tonic: 0, mode: 'major' };

export function transposeKey(key: KeySignature, semis: number): KeySignature {
  return { ...key, tonic: (((key.tonic + semis) % 12) + 12) % 12 };
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

// ------------------------------------------------------------------ percussion staff

/** GM drum pitch → [staff diatonic index (treble/percussion positions), notehead]. */
export const DRUM_STAFF: Record<number, [number, '' | 'x']> = {
  35: [30, ''], // E4 kick 2
  36: [31, ''], // F4 kick
  37: [35, 'x'], // C5 rim
  38: [35, ''], // C5 snare
  39: [36, 'x'], // D5 clap
  40: [35, ''],
  41: [33, ''], // A4 low tom
  42: [39, 'x'], // G5 closed hat
  43: [32, ''], // G4 floor tom
  44: [29, 'x'], // D4 pedal hat
  45: [36, ''], // D5 mid tom
  46: [39, 'x'], // G5 open hat
  47: [36, ''],
  48: [37, ''], // E5 high tom
  49: [40, 'x'], // A5 crash
  50: [37, ''],
  51: [38, 'x'], // F5 ride
  54: [41, 'x'], // B5 tambourine
  56: [37, 'x'], // E5 cowbell
  70: [41, 'x'], // B5 shaker
  75: [33, 'x'], // A4 claves
};

/** Natural MIDI pitch at a diatonic index (C major). */
export function naturalPitch(dIdx: number): number {
  return pitchFromDiatonic(dIdx, C_MAJOR);
}

/** Drum pitch for a percussion-staff position (prefers plain heads on drum lines, x on cymbal lines). */
export function drumAtPosition(dIdx: number): number {
  const prefer = [36, 38, 42, 49, 51, 48, 45, 41, 43, 44, 35, 70];
  for (const p of prefer) if (DRUM_STAFF[p][0] === dIdx) return p;
  for (const [p, [d]] of Object.entries(DRUM_STAFF)) if (d === dIdx) return Number(p);
  // nearest mapped line
  let best = 38;
  let bd = Infinity;
  for (const p of prefer) {
    const d = Math.abs(DRUM_STAFF[p][0] - dIdx);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
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

/** Decompose a span inside a triplet window, in displayed units. */
function decomposeTuplet(p: number, len: number): [number, number][] {
  const out: [number, number][] = [];
  let pos = p;
  let rem = len;
  let guard = 0;
  while (rem > 1e-6 && guard++ < 32) {
    const v =
      DUR_CODES.find(([d]) => d <= rem + 1e-6 && d <= 2 && aligned(pos, DOTTED.has(d) ? d / 1.5 : Math.min(d, 1)))?.[0] ??
      DUR_CODES.find(([d]) => d <= rem + 1e-6 && !DOTTED.has(d) && aligned(pos, d))?.[0] ??
      Math.min(rem, 0.125);
    out.push([pos, v]);
    pos += v;
    rem -= v;
  }
  return out;
}

export function durCode(v: number): string {
  return DUR_CODES.find(([d]) => Math.abs(d - v) < 1e-6)?.[1] ?? '32';
}

// ------------------------------------------------------------------ model types

export type Clef = 'treble' | 'bass' | 'treble8vb' | 'percussion';
export type ClefMode = 'auto' | 'treble' | 'bass' | 'grand';
export type WinKind = 't8' | 't4';

export interface Piece {
  start: number; // measure-relative beats (real time)
  dur: number; // real beats
  disp: number; // displayed value (beats) — differs from dur inside tuplets
  tuplet?: string; // tuplet group id
  tupletKind?: WinKind;
  rest: boolean;
  wholeMeasure?: boolean;
  pitches: number[]; // written (display) pitches, ascending
  heads: string[]; // '' or 'x' per pitch (percussion)
  noteIds: string[]; // original note ids
  keys: string[]; // unique per-instance keys (for ties)
  velocities: number[];
  /** Per pitch: true when this piece continues the same note from an earlier piece (tie into). */
  tied: boolean[];
  artic: Articulation[];
  lyric?: string;
  /** Lyric's note id (for editing). */
  lyricNoteId?: string;
}

export interface StaffMeasure {
  voices: Piece[][]; // 1 or 2 voices
}

export interface MeasureModel {
  index: number;
  start: number; // display beats
  staves: StaffMeasure[]; // indexed by global staff index
}

export interface QNote {
  id: string; // original note id
  key: string; // unique instance key
  regionId: string;
  pitch: number; // sounding pitch
  wpitch: number; // written/display pitch
  head: '' | 'x';
  s: number;
  e: number;
  vel: number;
  voice: 1 | 2;
  staff: number; // staff within part
  artic?: Articulation[];
  lyric?: string;
}

export interface RawNote {
  id: string;
  key: string;
  regionId: string;
  pitch: number;
  s: number;
  e: number;
  vel: number;
  voice?: 1 | 2;
  artic?: Articulation[];
  lyric?: string;
}

export interface DisplayMark {
  kind: 'dyn' | 'cresc' | 'dim';
  t: number;
  end?: number;
  value?: string;
  staff: number; // staff within part
  inferred?: boolean;
  id?: string;
  regionId?: string;
}

export interface PartInput {
  id: string;
  trackId: string;
  name: string;
  abbr: string;
  clefs: Clef[];
  /** Written = sounding + transpose. */
  transpose: number;
  writtenKey: KeySignature;
  drums: boolean;
  notes: RawNote[];
  marks: DisplayMark[];
}

export interface PartModel extends Omit<PartInput, 'notes'> {
  notes: QNote[];
  firstStaff: number; // global index of the part's first staff
  inferredAccents: Set<string>;
}

export interface StaffRef {
  part: number;
  staff: number; // within part
  clef: Clef;
}

export interface ScoreModel {
  parts: PartModel[];
  staves: StaffRef[];
  measures: MeasureModel[];
  bpb: number;
  grid: number;
}

export const SPLIT = 60;

// ------------------------------------------------------------------ instrument → notation

const GRAND = new Set(['grand-piano', 'bright-piano', 'electric-piano', 'organ', 'harmonium', 'clav', 'harp']);
const BASS = new Set(['cello', 'electric-bass', 'upright-bass', 'upright-bass-bowed', 'synth-bass', 'sub-808', 'wobble-bass', 'tuba', 'bassoon', 'trombone']);
const GUITAR = new Set(['acoustic-guitar', 'electric-guitar', 'nylon-guitar']);
/** Written pitch is this many semitones above sounding pitch. */
export const TRANSPOSING: Record<string, { semis: number; label: string }> = {
  trumpet: { semis: 2, label: 'in B♭' },
  clarinet: { semis: 2, label: 'in B♭' },
  saxophone: { semis: 9, label: 'in E♭' },
  'french-horn': { semis: 7, label: 'in F' },
};

export function abbreviate(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.map((w) => w[0].toUpperCase()).join('') + '.';
  return name.length > 5 ? name.slice(0, 4) + '.' : name;
}

/** Clefs & transposition for an instrument, given its sounding notes. */
export function notationFor(
  instrument: string,
  isDrums: boolean,
  sounding: number[],
  mode: ClefMode,
  concert: boolean,
  rangeHint?: [number, number],
): { clefs: Clef[]; transpose: number; transLabel?: string } {
  if (isDrums) return { clefs: ['percussion'], transpose: 0 };
  if (mode === 'treble') return { clefs: ['treble'], transpose: 0 };
  if (mode === 'bass') return { clefs: ['bass'], transpose: 0 };
  if (mode === 'grand') return { clefs: ['treble', 'bass'], transpose: 0 };
  if (GRAND.has(instrument)) return { clefs: ['treble', 'bass'], transpose: 0 };
  if (BASS.has(instrument)) return { clefs: ['bass'], transpose: 0 };
  if (GUITAR.has(instrument)) return { clefs: ['treble8vb'], transpose: 12 };
  const tr = TRANSPOSING[instrument];
  if (tr && !concert) return { clefs: ['treble'], transpose: tr.semis, transLabel: tr.label };
  if (tr) return { clefs: ['treble'], transpose: 0 };
  if (!sounding.length) {
    if (rangeHint && (rangeHint[0] + rangeHint[1]) / 2 < 52) return { clefs: ['bass'], transpose: 0 };
    return { clefs: ['treble'], transpose: 0 };
  }
  const lo = Math.min(...sounding);
  const hi = Math.max(...sounding);
  if (lo >= 55) return { clefs: ['treble'], transpose: 0 };
  if (hi <= 64) return { clefs: ['bass'], transpose: 0 };
  return { clefs: ['treble', 'bass'], transpose: 0 };
}

export function staffForWritten(wpitch: number, clefs: Clef[]): number {
  if (clefs.length === 1) return 0;
  return wpitch >= SPLIT ? 0 : 1;
}

// ------------------------------------------------------------------ quantization with triplet detection

const near = (x: number, g: number) => Math.abs(x - Math.round(x / g) * g);

/** Decide which beats are triplet windows ('t8' = eighth/16th triplets in one beat, 't4' = quarter triplets over two beats). */
export function detectWindows(notes: { s: number; e: number }[], grid: number): Map<number, WinKind> {
  const win = new Map<number, WinKind>();
  const byBeat = new Map<number, number[]>();
  // Detection uses onsets (note ends are often sloppy gate lengths).
  for (const n of notes)
    for (const x of [n.s]) {
      const fr = x - Math.floor(x);
      if (fr < 0.03 || fr > 0.97) continue;
      const b = Math.floor(x);
      const list = byBeat.get(b) ?? [];
      list.push(x);
      byBeat.set(b, list);
    }
  const binG = Math.min(grid, 0.25);
  // Quarter triplets: two-beat windows starting on even beats.
  for (const b of [...byBeat.keys()]) {
    const w0 = b - (((b % 2) + 2) % 2);
    if (win.has(w0)) continue;
    const xs = [...(byBeat.get(w0) ?? []), ...(byBeat.get(w0 + 1) ?? [])];
    if (xs.length < 1) continue;
    const triOk = xs.every((x) => near(x - w0, 2 / 3) < 0.07);
    const binOk = xs.every((x) => near(x, binG) < 0.05);
    const hasMid = xs.some((x) => Math.abs(x - w0 - 1) > 0.1);
    if (triOk && !binOk && hasMid) {
      win.set(w0, 't4');
      win.set(w0 + 1, 't4');
    }
  }
  for (const [b, xs] of byBeat) {
    if (win.has(b)) continue;
    const tg = grid <= 0.25 ? 1 / 6 : 1 / 3;
    const eBin = Math.max(...xs.map((x) => near(x, grid)));
    const eTri = Math.max(...xs.map((x) => near(x - b, tg)));
    if (eTri < 0.07 && eTri < eBin - 0.02) win.set(b, 't8');
  }
  return win;
}

function snapBoundary(x: number, grid: number, win: Map<number, WinKind>, isEnd: boolean): number {
  const b = Math.floor(isEnd ? x - 1e-6 : x + 1e-6);
  const kind = win.get(b);
  if (kind === 't4') {
    const w0 = win.get(b - 1) === 't4' && (((b - 1) % 2) + 2) % 2 === 0 ? b - 1 : b;
    return w0 + Math.round((x - w0) / (2 / 3)) * (2 / 3);
  }
  if (kind === 't8') {
    const tg = grid <= 0.25 ? 1 / 6 : 1 / 3;
    return b + Math.round((x - b) / tg) * tg;
  }
  return Math.round(x / grid) * grid;
}

/** Window bounds [w0, w1) containing beat `b` (triplet windows only). */
function windowOf(b: number, win: Map<number, WinKind>): { w0: number; w1: number; kind: WinKind } | null {
  const kind = win.get(b);
  if (!kind) return null;
  if (kind === 't4') {
    const w0 = (((b % 2) + 2) % 2 === 0 ? b : b - 1);
    return { w0, w1: w0 + 2, kind };
  }
  return { w0: b, w1: b + 1, kind };
}

// ------------------------------------------------------------------ building

/** Infer dynamics markings & hairpins from velocities (used when a part has no stored marks). */
function inferMarks(notes: QNote[], staves: number): { marks: DisplayMark[]; accents: Set<string> } {
  const marks: DisplayMark[] = [];
  const accents = new Set<string>();
  for (let st = 0; st < staves; st++) {
    const byOnset = new Map<number, QNote[]>();
    for (const n of notes) if (n.staff === st) byOnset.set(n.s, [...(byOnset.get(n.s) ?? []), n]);
    const onsets = [...byOnset.entries()].sort((a, b) => a[0] - b[0]).map(([t, ns]) => ({ t, v: Math.max(...ns.map((n) => n.vel)), ns }));
    if (!onsets.length) continue;
    const sortedV = onsets.map((o) => o.v).sort((a, b) => a - b);
    const median = sortedV[Math.floor(sortedV.length / 2)];
    const head = onsets.slice(0, 4).map((o) => o.v).sort((a, b) => a - b);
    let level = dynamicOf(head[Math.floor((head.length - 1) / 2)]);
    marks.push({ kind: 'dyn', t: onsets[0].t, value: level, staff: st, inferred: true });
    onsets.forEach((o, i) => {
      if (i === 0) return;
      const d = dynamicOf(o.v);
      if (d === level) return;
      const next = i + 1 < onsets.length ? dynamicOf(onsets[i + 1].v) : d;
      if (next === d) {
        level = d;
        marks.push({ kind: 'dyn', t: o.t, value: d, staff: st, inferred: true });
      } else if (i + 1 < onsets.length && o.v - Math.max(onsets[i - 1].v, onsets[i + 1].v) >= 0.15 && o.v >= median * 1.3) {
        for (const n of o.ns) if (n.vel === o.v) accents.add(n.key);
      }
    });
    // Hairpins over monotonic runs of 3+ onsets.
    let i0 = 0;
    let dir = 0;
    const flush = (a: number, b: number, d: number) => {
      if (d !== 0 && b - a >= 2) marks.push({ kind: d > 0 ? 'cresc' : 'dim', t: onsets[a].t, end: onsets[b].t, staff: st, inferred: true });
    };
    for (let i = 1; i < onsets.length; i++) {
      const dv = onsets[i].v - onsets[i - 1].v;
      const d = Math.abs(dv) > 0.03 ? Math.sign(dv) : 0;
      if (d !== 0 && (dir === 0 || d === dir)) {
        if (dir === 0) i0 = i - 1;
        dir = d;
        continue;
      }
      flush(i0, i - 1, dir);
      dir = d;
      i0 = i - 1;
    }
    flush(i0, onsets.length - 1, dir);
  }
  return { marks, accents };
}

function buildVoice(list: QNote[], ms: number, bpb: number, win: Map<number, WinKind>, idPrefix: string, accents: Set<string>): Piece[] {
  const me = ms + bpb;
  const inM = list.filter((n) => n.s < me - 1e-6 && n.e > ms + 1e-6);
  const mk = (start: number, dur: number, disp: number, extra: Partial<Piece> = {}): Piece => ({
    start,
    dur,
    disp,
    rest: true,
    pitches: [],
    heads: [],
    noteIds: [],
    keys: [],
    velocities: [],
    tied: [],
    artic: [],
    ...extra,
  });
  if (!inM.length) return [mk(0, bpb, bpb, { wholeMeasure: true })];
  const bset = new Set<number>([0, bpb]);
  for (const n of inM) {
    bset.add(Math.max(0, n.s - ms));
    bset.add(Math.min(bpb, n.e - ms));
  }
  // Break at triplet window edges so tuplet groups never straddle binary time.
  for (let b = 0; b < bpb; b++) {
    const w = windowOf(ms + b, win);
    if (w) {
      bset.add(Math.max(0, w.w0 - ms));
      bset.add(Math.min(bpb, w.w1 - ms));
    }
  }
  const bounds = [...bset].sort((a, b) => a - b);
  const slices: { a: number; b: number; active: QNote[] }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    if (b - a < 1e-6) continue;
    const seen = new Set<number>();
    const active = inM
      .filter((n) => n.s - ms < b - 1e-6 && n.e - ms > a + 1e-6)
      .filter((n) => (seen.has(n.wpitch) ? false : (seen.add(n.wpitch), true)))
      .sort((x, y) => x.wpitch - y.wpitch);
    const prev = slices[slices.length - 1];
    const sameWin = prev && windowOf(ms + Math.floor(prev.a + 1e-6), win)?.w0 === windowOf(ms + Math.floor(a + 1e-6), win)?.w0;
    if (!active.length && prev && !prev.active.length && sameWin) prev.b = b;
    else slices.push({ a, b, active });
  }
  const pieces: Piece[] = [];
  for (const sl of slices) {
    const w = windowOf(ms + Math.floor(sl.a + 1e-6), win);
    const parts: { start: number; dur: number; disp: number; tuplet?: string; kind?: WinKind }[] = [];
    if (w) {
      const w0r = w.w0 - ms;
      for (const [dp, dv] of decomposeTuplet((sl.a - w0r) * 1.5, (sl.b - sl.a) * 1.5)) {
        parts.push({ start: w0r + dp / 1.5, dur: dv / 1.5, disp: dv, tuplet: `${idPrefix}:${w.w0}`, kind: w.kind });
      }
    } else {
      for (const [pos, v] of decompose(sl.a, sl.b - sl.a, bpb)) parts.push({ start: pos, dur: v, disp: v });
    }
    for (const pp of parts) {
      const onsetNotes = sl.active.filter((n) => !(n.s < ms + pp.start - 1e-6));
      const lyricNote = onsetNotes.find((n) => n.lyric);
      const artic = new Set<Articulation>();
      for (const n of onsetNotes) {
        for (const a of n.artic ?? []) artic.add(a);
        if (accents.has(n.key)) artic.add('accent');
      }
      pieces.push({
        start: pp.start,
        dur: pp.dur,
        disp: pp.disp,
        tuplet: pp.tuplet,
        tupletKind: pp.kind,
        rest: !sl.active.length,
        pitches: sl.active.map((n) => n.wpitch),
        heads: sl.active.map((n) => n.head),
        noteIds: sl.active.map((n) => n.id),
        keys: sl.active.map((n) => n.key),
        velocities: sl.active.map((n) => n.vel),
        tied: sl.active.map((n) => n.s < ms + pp.start - 1e-6),
        artic: [...artic],
        lyric: lyricNote?.lyric,
        lyricNoteId: lyricNote?.id,
      });
    }
  }
  return pieces;
}

export function buildScore(inputs: PartInput[], bpb: number, totalBeats: number, extraMeasures: number, grid: number): ScoreModel {
  const parts: PartModel[] = [];
  const staves: StaffRef[] = [];
  for (const [pi, inp] of inputs.entries()) {
    const firstStaff = staves.length;
    inp.clefs.forEach((clef, si) => staves.push({ part: pi, staff: si, clef }));
    // Quantize per voice-group (staff × voice) so triplets in one voice don't disturb another.
    const prelim = inp.notes.map((n) => {
      const drum = inp.drums ? DRUM_STAFF[n.pitch] : undefined;
      const wpitch = drum ? naturalPitch(drum[0]) : n.pitch + inp.transpose;
      const staff = inp.drums ? 0 : staffForWritten(wpitch, inp.clefs);
      const voice: 1 | 2 = inp.drums ? (n.pitch === 35 || n.pitch === 36 || n.pitch === 44 ? 2 : 1) : (n.voice ?? 1);
      return { n, wpitch, staff, voice, head: (drum?.[1] ?? '') as '' | 'x' };
    });
    const notes: QNote[] = [];
    const groups = new Map<string, typeof prelim>();
    for (const p of prelim) {
      const k = `${p.staff}:${p.voice}`;
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    const windows = new Map<string, Map<number, WinKind>>();
    for (const [k, list] of groups) {
      const win = detectWindows(
        list.map((p) => p.n),
        grid,
      );
      windows.set(k, win);
      for (const p of list) {
        const s = Math.max(0, snapBoundary(p.n.s, grid, win, false));
        let e = snapBoundary(p.n.e, grid, win, true);
        if (e <= s + 1e-6) e = s + (win.get(Math.floor(s + 1e-6)) ? (win.get(Math.floor(s + 1e-6)) === 't4' ? 2 / 3 : grid <= 0.25 ? 1 / 6 : 1 / 3) : grid);
        if (inp.drums) e = s + Math.min(grid, 0.25);
        notes.push({
          id: p.n.id,
          key: p.n.key,
          regionId: p.n.regionId,
          pitch: p.n.pitch,
          wpitch: p.wpitch,
          head: p.head,
          s,
          e,
          vel: p.n.vel,
          voice: p.voice,
          staff: p.staff,
          artic: p.n.artic,
          lyric: p.n.lyric,
        });
      }
    }
    notes.sort((a, b) => a.s - b.s || a.wpitch - b.wpitch);
    if (inp.drums) {
      // Drum hits are notated as lasting until the next hit in the same voice (max one beat, within the bar).
      for (const v of [1, 2] as const) {
        const list = notes.filter((n) => n.voice === v);
        const onsets = [...new Set(list.map((n) => n.s))].sort((a, b) => a - b);
        for (const n of list) {
          const next = onsets.find((o) => o > n.s + 1e-6) ?? Infinity;
          const barEnd = (Math.floor(n.s / bpb + 1e-9) + 1) * bpb;
          const beatEnd = Math.floor(n.s + 1e-6) + 1;
          n.e = Math.max(n.e, Math.min(next, barEnd, Math.max(beatEnd, n.s + 0.25), n.s + 1));
        }
      }
    }
    const hasStored = inp.marks.length > 0;
    const inferred = hasStored || inp.drums ? { marks: [], accents: new Set<string>() } : inferMarks(notes, inp.clefs.length);
    parts.push({ ...inp, notes, firstStaff, marks: hasStored ? inp.marks : inferred.marks, inferredAccents: inferred.accents });
    // stash windows on the part for measure building
    (parts[parts.length - 1] as PartModel & { _win?: Map<string, Map<number, WinKind>> })._win = windows;
  }

  const lastEnd = Math.max(totalBeats, ...parts.flatMap((p) => p.notes.map((n) => n.e)));
  const count = Math.max(1, Math.ceil(lastEnd / bpb - 1e-6)) + extraMeasures;
  // Bucket every note into the measures it overlaps, per staff & voice (avoids rescanning all notes per measure).
  const buckets = staves.map((ref) => {
    const per: [QNote[][], QNote[][]] = [[], []];
    for (const n of parts[ref.part].notes) {
      if (n.staff !== ref.staff) continue;
      const lists = per[n.voice === 2 ? 1 : 0];
      const m0 = Math.max(0, Math.floor(n.s / bpb + 1e-9));
      const m1 = Math.min(count - 1, Math.ceil(n.e / bpb - 1e-6) - 1);
      for (let m = m0; m <= m1; m++) (lists[m] ??= []).push(n);
    }
    return per;
  });
  const measures: MeasureModel[] = [];
  for (let m = 0; m < count; m++) {
    const ms = m * bpb;
    const sm: StaffMeasure[] = staves.map((ref, si) => {
      const part = parts[ref.part] as PartModel & { _win?: Map<string, Map<number, WinKind>> };
      const v1 = buckets[si][0][m] ?? [];
      const v2 = buckets[si][1][m] ?? [];
      const win1 = part._win?.get(`${ref.staff}:1`) ?? new Map();
      const win2 = part._win?.get(`${ref.staff}:2`) ?? new Map();
      const has2 = v2.some((n) => n.s < ms + bpb - 1e-6 && n.e > ms + 1e-6);
      const voices = [buildVoice(v1, ms, bpb, win1, `${ref.part}.${ref.staff}.1`, part.inferredAccents)];
      if (has2) voices.push(buildVoice(v2, ms, bpb, win2, `${ref.part}.${ref.staff}.2`, part.inferredAccents));
      return { voices };
    });
    measures.push({ index: m, start: ms, staves: sm });
  }
  return { parts, staves, measures, bpb, grid };
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

export function dynamicVel(mark: string): number {
  return DYNAMICS.find((d) => d.mark === mark)?.vel ?? 0.64;
}

export function dynamicOf(vel: number): string {
  if (vel < 0.315) return 'pp';
  if (vel < 0.44) return 'p';
  if (vel < 0.57) return 'mp';
  if (vel < 0.72) return 'mf';
  if (vel < 0.875) return 'f';
  return 'ff';
}
