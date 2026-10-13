// Compact ways to write the musical examples in the guides.
//
//   line('E4:1 D4 C4 D4 E4 E4 E4:2')        a melody; ":beats" sets a length that carries forward, "r" is a rest
//   line('C4+E4+G4:4')                        "+" stacks notes into a chord
//   chords('C G Am F')                        block chords, 4 beats each, smoothly voice-led around middle C
//   chords('C:2 G:2 Am F', { style: 'pulse' }) per-chord lengths and a rhythm style
//   bass('C G Am F')                          the roots, low
//   drums({ k: 'x...x...', s: '....x...', h: 'x.x.x.x.' })   one character per 16th note

export interface GNote {
  /** MIDI pitch */
  p: number;
  /** start, in beats */
  t: number;
  /** length, in beats */
  d: number;
  /** velocity 0–1 */
  v?: number;
}

export interface PartFx {
  /** reverb send 0–1 */
  reverb?: number;
  /** echo send 0–1 (dotted-eighth echo) */
  delay?: number;
  /** low-pass cutoff in Hz (cuts highs) */
  lowpass?: number;
  /** high-pass cutoff in Hz (cuts lows) */
  highpass?: number;
  /** -1 left … 1 right */
  pan?: number;
  /** squash dynamics with a compressor */
  comp?: boolean;
  /** saturation 0–1 */
  drive?: number;
}

export interface Part {
  /** instrument preset id, e.g. 'grand-piano', 'string-ensemble', 'kit-acoustic' */
  inst: string;
  notes: GNote[];
  /** legend label, e.g. "Melody" */
  label?: string;
  /** CSS colour; defaults by position */
  color?: string;
  /** 0–1.5, default 1 */
  vol?: number;
  fx?: PartFx;
}

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4", "Bb3", "F##2" → MIDI number (C4 = 60). */
export function n(name: string): number {
  const m = /^([A-Ga-g])([#b]*)(-?\d)$/.exec(name.trim());
  if (!m) throw new Error('Bad note ' + name);
  let acc = 0;
  for (const c of m[2]) acc += c === '#' ? 1 : -1;
  return (parseInt(m[3]) + 1) * 12 + LETTER[m[1].toUpperCase()] + acc;
}

/** Pitch class of a note letter with accidentals: "F#" → 6. */
export function pc(name: string): number {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name.trim());
  if (!m) throw new Error('Bad pitch class ' + name);
  let acc = 0;
  for (const c of m[2]) acc += c === '#' ? 1 : -1;
  return (((LETTER[m[1].toUpperCase()] + acc) % 12) + 12) % 12;
}

export interface LineOpts {
  /** beat to start at (default 0) */
  at?: number;
  /** velocity (default 0.8) */
  v?: number;
  /** fraction of each note's length that actually sounds (default 0.95) */
  gate?: number;
  /** semitones to shift everything */
  transpose?: number;
}

/**
 * A melody or rhythm in text. Tokens are separated by spaces:
 *   "E4:1"  E4 for one beat (the length carries to following tokens until changed)
 *   "r:2"   two beats of rest
 *   "C4+E4+G4:2" a chord
 *   "E4!"   accent (louder), "E4?" ghost (softer)
 *   "|"     ignored, use it to mark bar lines for readability
 */
export function line(src: string, opts: LineOpts = {}): GNote[] {
  const out: GNote[] = [];
  let t = opts.at ?? 0;
  let d = 1;
  const gate = opts.gate ?? 0.95;
  const baseV = opts.v ?? 0.8;
  for (const raw of src.trim().split(/\s+/)) {
    if (!raw || raw === '|') continue;
    let tok = raw;
    let v = baseV;
    if (tok.endsWith('!')) {
      v = Math.min(1, baseV + 0.18);
      tok = tok.slice(0, -1);
    } else if (tok.endsWith('?')) {
      v = baseV * 0.55;
      tok = tok.slice(0, -1);
    }
    const [pitches, len] = tok.split(':');
    if (len) d = evalLen(len);
    if (pitches !== 'r') for (const p of pitches.split('+')) out.push({ p: n(p) + (opts.transpose ?? 0), t, d: d * gate, v });
    t += d;
  }
  return out;
}

/** "1", "0.5", "1/2", "3/4", "1.5" → beats */
function evalLen(s: string): number {
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return a / b;
  }
  return Number(s);
}

// ------------------------------------------------------------------ chords

const QUALITIES: [RegExp, number[]][] = [
  [/^maj9$/, [0, 4, 7, 11, 14]],
  [/^(maj7|M7|Δ7?)$/, [0, 4, 7, 11]],
  [/^m(aj|M)7$/, [0, 3, 7, 11]],
  [/^m9$/, [0, 3, 7, 10, 14]],
  [/^(m7b5|ø7?)$/, [0, 3, 6, 10]],
  [/^(m7|min7|-7)$/, [0, 3, 7, 10]],
  [/^(dim7|°7)$/, [0, 3, 6, 9]],
  [/^(dim|°)$/, [0, 3, 6]],
  [/^(aug|\+)$/, [0, 4, 8]],
  [/^m6$/, [0, 3, 7, 9]],
  [/^(m|min|-)$/, [0, 3, 7]],
  [/^madd9$/, [0, 3, 7, 14]],
  [/^add9$/, [0, 4, 7, 14]],
  [/^9$/, [0, 4, 7, 10, 14]],
  [/^7sus4$/, [0, 5, 7, 10]],
  [/^7$/, [0, 4, 7, 10]],
  [/^6$/, [0, 4, 7, 9]],
  [/^sus2$/, [0, 2, 7]],
  [/^sus4?$/, [0, 5, 7]],
  [/^5$/, [0, 7]],
  [/^$/, [0, 4, 7]],
];

export interface ChordShape {
  root: number;
  /** semitones above the root */
  intervals: number[];
  /** slash-chord bass pitch class, if any */
  bass?: number;
}

/** "Am7", "F#dim", "C/E", "Bbmaj7", "G7sus4" → root pitch class + intervals. */
export function parseChord(sym: string): ChordShape {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym.trim());
  if (!m) throw new Error('Bad chord ' + sym);
  const q = QUALITIES.find(([re]) => re.test(m[2]));
  if (!q) throw new Error('Unknown chord quality ' + sym);
  return { root: pc(m[1]), intervals: q[1], bass: m[3] ? pc(m[3]) : undefined };
}

/** All the voicings of a chord's tones inside [lo, hi], sorted low → high. */
function voicingsIn(shape: ChordShape, lo: number, hi: number): number[][] {
  const pcs = [...new Set(shape.intervals.map((i) => (shape.root + i) % 12))];
  const out: number[][] = [];
  for (let base = lo; base <= hi; base++) {
    // Stack each chord tone once, upward from a chord tone.
    if (!pcs.includes(base % 12)) continue;
    const v = [base];
    let cur = base;
    const remaining = pcs.filter((p) => p !== base % 12);
    const order = remaining.map((p) => ({ p, up: (p - (cur % 12) + 12) % 12 })).sort((a, b) => a.up - b.up);
    for (const o of order) {
      cur = base + o.up;
      v.push(cur);
    }
    if (v[v.length - 1] <= hi) out.push(v);
  }
  return out;
}

/** Closest voicing to the previous one (least total movement): how players connect chords smoothly. */
export function voiceLead(prev: number[] | null, shape: ChordShape, center = 62): number[] {
  const opts = voicingsIn(shape, center - 9, center + 12);
  if (!opts.length) return shape.intervals.map((i) => center - 2 + ((shape.root - center + 120) % 12) + i);
  const target = prev ?? [center - 3, center, center + 4];
  const cost = (v: number[]) => {
    const avgV = v.reduce((a, b) => a + b, 0) / v.length;
    const avgT = target.reduce((a, b) => a + b, 0) / target.length;
    let c = Math.abs(avgV - avgT) * 0.6;
    for (const p of v) c += Math.min(...target.map((q) => Math.abs(p - q)));
    return c;
  };
  return opts.reduce((best, v) => (cost(v) < cost(best) ? v : best));
}

export type ChordStyle = 'block' | 'pulse' | 'arp' | 'broken' | 'offbeat' | 'stabs';

export interface ChordOpts {
  /** beats per chord when a token has no ":len" (default 4) */
  beats?: number;
  /** start beat (default 0) */
  at?: number;
  style?: ChordStyle;
  /** smooth voice leading (default true); false = every chord in root position */
  lead?: boolean;
  /** middle of the voicing range (default D4 = 62) */
  center?: number;
  v?: number;
  /** also play each chord's root an octave below the voicing */
  withRoot?: boolean;
}

/** Turn a progression like "C G Am F" or "Dm7:2 G7:2 Cmaj7" into notes. */
export function chords(src: string, opts: ChordOpts = {}): GNote[] {
  const out: GNote[] = [];
  let t = opts.at ?? 0;
  let prev: number[] | null = null;
  const v = opts.v ?? 0.7;
  const style = opts.style ?? 'block';
  for (const raw of src.trim().split(/\s+/)) {
    if (!raw || raw === '|') continue;
    const [sym, len] = raw.split(':');
    const d = len ? evalLen(len) : (opts.beats ?? 4);
    if (sym === 'r' || sym === 'N.C.') {
      t += d;
      continue;
    }
    const shape = parseChord(sym);
    const center = opts.center ?? 62;
    const voicing: number[] =
      opts.lead === false ? shape.intervals.map((i) => center - 5 + ((shape.root - (center - 5) + 120) % 12) + i) : voiceLead(prev, shape, center);
    prev = voicing;
    const low = voicing[0] - 12 - ((voicing[0] - 12 - (shape.bass ?? shape.root) + 120) % 12);
    if (opts.withRoot || shape.bass !== undefined) out.push({ p: low, t, d: d * 0.97, v });
    pushStyle(out, voicing, t, d, style, v);
    t += d;
  }
  return out;
}

function pushStyle(out: GNote[], vc: number[], t: number, d: number, style: ChordStyle, v: number): void {
  if (style === 'block') {
    for (const p of vc) out.push({ p, t, d: d * 0.97, v });
  } else if (style === 'pulse') {
    for (let b = 0; b < d; b++) for (const p of vc) out.push({ p, t: t + b, d: 0.85, v: b % 2 ? v * 0.8 : v });
  } else if (style === 'offbeat') {
    for (let b = 0; b < d; b++) for (const p of vc) out.push({ p, t: t + b + 0.5, d: 0.35, v });
  } else if (style === 'stabs') {
    for (const p of vc) out.push({ p, t, d: 0.4, v }, { p, t: t + 1.5, d: 0.4, v: v * 0.9 });
  } else if (style === 'arp') {
    const seq = [...vc, vc[1] + 12, vc[0] + 12, ...vc.slice(1).reverse()].slice(0, 8);
    for (let i = 0; i < d * 2; i++) out.push({ p: seq[i % seq.length], t: t + i / 2, d: 0.5, v: i % 2 ? v * 0.8 : v });
  } else {
    // broken: low, high, middle, high (an "Alberti"-like figure)
    const fig = [vc[0], vc[vc.length - 1], vc[1], vc[vc.length - 1]];
    for (let i = 0; i < d * 2; i++) out.push({ p: fig[i % 4], t: t + i / 2, d: 0.5, v: i % 4 === 0 ? v : v * 0.75 });
  }
}

export interface BassOpts {
  beats?: number;
  at?: number;
  /** 'whole' holds each root; 'eighths' pumps steady eighths; 'root5' plays root then fifth; 'walk' walks up toward the next chord */
  style?: 'whole' | 'eighths' | 'root5' | 'quarters' | 'walk';
  /** octave of the roots (default 2 → around C2) */
  octave?: number;
  v?: number;
}

/** A simple bass line from the chord roots (or slash basses). */
export function bass(src: string, opts: BassOpts = {}): GNote[] {
  const toks = src.trim().split(/\s+/).filter((x) => x && x !== '|');
  const out: GNote[] = [];
  let t = opts.at ?? 0;
  const base = ((opts.octave ?? 2) + 1) * 12;
  const v = opts.v ?? 0.85;
  const rootOf = (sym: string) => {
    const s = parseChord(sym);
    const r = s.bass ?? s.root;
    return base + (r >= 8 ? r - 12 : r);
  };
  toks.forEach((raw, i) => {
    const [sym, len] = raw.split(':');
    const d = len ? evalLen(len) : (opts.beats ?? 4);
    if (sym === 'r') {
      t += d;
      return;
    }
    const r = rootOf(sym);
    const style = opts.style ?? 'whole';
    if (style === 'whole') out.push({ p: r, t, d: d * 0.95, v });
    else if (style === 'eighths') for (let k = 0; k < d * 2; k++) out.push({ p: r, t: t + k / 2, d: 0.42, v: k % 2 ? v * 0.8 : v });
    else if (style === 'quarters') for (let k = 0; k < d; k++) out.push({ p: r, t: t + k, d: 0.9, v });
    else if (style === 'root5') for (let k = 0; k < d; k++) out.push({ p: k % 2 ? r + 7 : r, t: t + k, d: 0.9, v });
    else {
      const next = toks[i + 1] ? rootOf(toks[i + 1].split(':')[0]) : r;
      const s = parseChord(sym);
      const third = r + s.intervals[1];
      const fifth = r + 7;
      const approach = next > r ? next - 1 : next + 1;
      const walk = [r, third, fifth, approach];
      for (let k = 0; k < d; k++) out.push({ p: walk[k % 4], t: t + k, d: 0.9, v });
    }
    t += d;
  });
  return out;
}

// ------------------------------------------------------------------ drums

/** Drum lane letters → General MIDI drum notes (what BandForge's kits use). */
export const DRUM_LANE: Record<string, number> = {
  k: 36, // kick
  s: 38, // snare
  cl: 39, // clap
  h: 42, // closed hi-hat
  o: 46, // open hi-hat
  t1: 45, // mid tom
  t2: 41, // low tom
  c: 49, // crash
  r: 51, // ride
  rim: 37, // side stick
  sh: 70, // shaker
};

export const DRUM_LABEL: Record<number, string> = { 36: 'Kick', 38: 'Snare', 39: 'Clap', 42: 'Hat', 46: 'Open hat', 45: 'Tom', 41: 'Low tom', 49: 'Crash', 51: 'Ride', 37: 'Rim', 70: 'Shaker' };

export interface DrumOpts {
  /** how many times to repeat the pattern (default 1) */
  bars?: number;
  /** beats per character (default 0.25 = 16ths) */
  step?: number;
  at?: number;
  /** delay every second 8th by this fraction of a 16th (0–1) for swing */
  swing?: number;
}

/** Drum grid: 'x' hit, 'X' accent, 'g' ghost, '.' rest. One character per step. */
export function drums(lanes: Record<string, string>, opts: DrumOpts = {}): GNote[] {
  const out: GNote[] = [];
  const step = opts.step ?? 0.25;
  const reps = opts.bars ?? 1;
  for (const [lane, pat] of Object.entries(lanes)) {
    const p = DRUM_LANE[lane] ?? Number(lane);
    const chars = pat.replace(/[\s|]/g, '');
    const len = chars.length * step;
    for (let r = 0; r < reps; r++)
      [...chars].forEach((ch, i) => {
        if (ch === '.') return;
        const v = ch === 'X' ? 1 : ch === 'g' ? 0.35 : 0.75;
        const swung = opts.swing && i % 2 === 1 ? opts.swing * step : 0;
        out.push({ p, t: (opts.at ?? 0) + r * len + i * step + swung, d: step * 0.9, v });
      });
  }
  return out;
}

/** Shift notes later by `beats` (to chain phrases). */
export function at(notes: GNote[], beats: number): GNote[] {
  return notes.map((x) => ({ ...x, t: x.t + beats }));
}

/** Repeat a phrase `times` times, every `every` beats. */
export function repeat(notes: GNote[], times: number, every: number): GNote[] {
  const out: GNote[] = [];
  for (let i = 0; i < times; i++) out.push(...at(notes, i * every));
  return out;
}

/** Shift every pitch by semitones. */
export function transpose(notes: GNote[], semis: number): GNote[] {
  return notes.map((x) => ({ ...x, p: x.p + semis }));
}

export function isDrumInst(inst: string): boolean {
  return inst.startsWith('kit-');
}
