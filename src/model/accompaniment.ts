// Songwriting engine: chord progressions, voice-led accompaniment styles,
// drum grooves and a motif-based melody generator. Pure functions — no UI, no audio.
import type { ChordQuality, ChordSymbol, KeySignature, Note } from './types';
import { keyUsesFlats, pitchClassName, scaleOfKey } from './music';
import { uid } from './defaults';

// ------------------------------------------------------------------ random

/** Small seeded PRNG (mulberry32) so generated parts are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

function weighted<T>(r: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x <= 0) return v;
  }
  return items[items.length - 1][0];
}

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

// ------------------------------------------------------------------ voicing

/** Lowest pitch ≥ lo with the given pitch class. */
function atOrAbove(pc: number, lo: number): number {
  return lo + ((((pc - lo) % 12) + 12) % 12);
}

/**
 * Choose a voicing of the chord's pitch classes with `n` voices inside [lo, hi],
 * minimising movement from the previous voicing (smooth voice leading).
 */
export function voiceLead(pcs: number[], prev: number[] | null, lo: number, hi: number, n = 4): number[] {
  const tones = [...pcs];
  while (tones.length < n) tones.push(tones[tones.length === pcs.length ? 0 : tones.length % pcs.length]);
  const center = prev && prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : (lo + hi) / 2 - 3;
  let best: number[] | null = null;
  let bestCost = Infinity;
  for (let inv = 0; inv < pcs.length; inv++) {
    const order = [...tones.slice(inv), ...tones.slice(0, inv)].slice(0, n);
    for (let base = lo; base < lo + 12; base++) {
      if (base % 12 !== order[0]) continue;
      const v: number[] = [base];
      for (let i = 1; i < order.length; i++) {
        let p = atOrAbove(order[i], v[i - 1] + 1);
        if (order[i] === order[0] && i > 0) p = Math.max(p, base + 12);
        v.push(p);
      }
      for (let oct = 0; oct < 4; oct++) {
        const cand = v.map((p) => p + 12 * oct);
        if (cand[cand.length - 1] > hi) break;
        if (cand[0] < lo) continue;
        let cost = 0;
        if (prev && prev.length === cand.length) for (let i = 0; i < cand.length; i++) cost += Math.abs(cand[i] - prev[i]);
        else cost = Math.abs(cand.reduce((a, b) => a + b, 0) / cand.length - center) * 2;
        cost += (cand[cand.length - 1] - cand[0]) * 0.15; // prefer reasonably close voicings
        if (cost < bestCost) {
          bestCost = cost;
          best = cand;
        }
      }
    }
  }
  return best ?? pcs.map((pc) => atOrAbove(pc, lo));
}

/** Guitar-like spread voicing (root in the bass, 5–6 strings). */
export function guitarVoicing(c: { root: number; quality: ChordQuality }): number[] {
  const ints = QUALITY_INTERVALS[c.quality];
  const third = ints.find((i) => i === 3 || i === 4 || i === 2 || i === 5) ?? 4;
  const fifth = ints.find((i) => i >= 6 && i <= 8) ?? 7;
  const sev = ints.find((i) => i === 9 || i === 10 || i === 11);
  const r = atOrAbove(c.root, 40); // E2..D#3
  const shape = [0, fifth, 12, 12 + third, 12 + (sev ?? fifth), 24];
  return shape.map((i) => r + i).filter((p) => p <= 79);
}

function bassRoot(pc: number, lo: number): number {
  return atOrAbove(pc, Math.max(33, lo));
}

/** A scale neighbour that leads into `target` (whole step below if diatonic, else above, else half step). */
function approach(target: number, scale: Set<number>): number {
  for (const d of [-2, 2, -1, 1]) if (scale.has((((target + d) % 12) + 12) % 12)) return target + d;
  return target - 1;
}

// ------------------------------------------------------------------ styles

export type StyleId =
  | 'piano-block'
  | 'piano-ballad'
  | 'piano-pop'
  | 'piano-stride'
  | 'guitar-strum'
  | 'guitar-pick'
  | 'bass-root'
  | 'bass-rootfifth'
  | 'bass-walking'
  | 'bass-octave'
  | 'bass-pulse'
  | 'strings-pad'
  | 'strings-staccato'
  | 'synth-arp'
  | 'pad'
  | 'melody';

export type Family = 'piano' | 'guitar' | 'bass' | 'strings' | 'synth' | 'pad' | 'lead' | 'drums';

export const STYLES: { id: StyleId; name: string; family: Family[]; description: string }[] = [
  { id: 'piano-block', name: 'Block Chords', family: ['piano', 'strings', 'synth', 'pad'], description: 'Chords on the beat, smooth voice leading' },
  { id: 'piano-ballad', name: 'Ballad Arpeggio', family: ['piano', 'guitar'], description: 'Flowing left-hand arpeggios under held chords' },
  { id: 'piano-pop', name: 'Pop Rhythm', family: ['piano', 'synth'], description: 'Syncopated eighth-note comping' },
  { id: 'piano-stride', name: 'Stride', family: ['piano'], description: 'Bass on 1 & 3, chords on 2 & 4' },
  { id: 'guitar-strum', name: 'Strumming', family: ['guitar'], description: 'Down-up strum pattern with realistic string spread' },
  { id: 'guitar-pick', name: 'Fingerpicking', family: ['guitar', 'piano'], description: 'Travis-style alternating bass with melody fingers' },
  { id: 'bass-root', name: 'Root Notes', family: ['bass'], description: 'Solid quarter-note roots' },
  { id: 'bass-rootfifth', name: 'Root & Fifth', family: ['bass'], description: 'Root–fifth bounce with pickups' },
  { id: 'bass-walking', name: 'Walking Bass', family: ['bass'], description: 'Jazz walking line with chromatic approaches' },
  { id: 'bass-octave', name: 'Octave Disco', family: ['bass'], description: 'Eighth-note octave jumps' },
  { id: 'bass-pulse', name: 'Synth Pulse', family: ['bass'], description: 'Driving eighth-note pulse' },
  { id: 'strings-pad', name: 'Sustained Pads', family: ['strings', 'pad', 'synth'], description: 'Long legato chords' },
  { id: 'strings-staccato', name: 'Staccato Ostinato', family: ['strings', 'synth'], description: 'Cinematic eighth-note ostinato' },
  { id: 'synth-arp', name: 'Arpeggio', family: ['synth', 'piano', 'strings', 'lead'], description: 'Sixteenth-note arpeggio up the chord' },
  { id: 'pad', name: 'Ambient Pad', family: ['pad', 'synth', 'strings'], description: 'Wide open voicings that swell' },
  { id: 'melody', name: 'Melody', family: ['lead', 'piano', 'synth', 'strings', 'guitar'], description: 'A singable melody that follows the chords' },
];

/** Classify an instrument preset into an accompaniment family. */
export function familyOf(presetId: string, category: string, trackType: string): Family {
  if (trackType === 'drums') return 'drums';
  if (/bass|808|wobble/.test(presetId)) return 'bass';
  if (/guitar/.test(presetId)) return 'guitar';
  if (/pad|choir/.test(presetId)) return 'pad';
  if (/lead|chip|flute|clarinet|sax|trumpet|violin|music-box|bells|xylophone|marimba/.test(presetId)) return 'lead';
  if (/pluck|supersaw/.test(presetId)) return 'synth';
  if (category === 'Strings' || category === 'Winds & Brass') return 'strings';
  if (category === 'Synths') return 'synth';
  return 'piano';
}

export function defaultStyleFor(f: Family): StyleId {
  return ({ piano: 'piano-pop', guitar: 'guitar-strum', bass: 'bass-rootfifth', strings: 'strings-pad', synth: 'synth-arp', pad: 'pad', lead: 'melody', drums: 'piano-block' } as Record<Family, StyleId>)[f];
}

export interface GenOptions {
  chords: ChordSymbol[];
  start: number;
  end: number;
  timeSig: [number, number];
  key: KeySignature;
  /** Instrument comfortable range. */
  range: [number, number];
  energy?: number; // 0..1
  seed?: number;
}

function humanize(r: () => number, v: number, amt = 0.06): number {
  return Math.max(0.05, Math.min(1, v + (r() * 2 - 1) * amt));
}

function N(pitch: number, start: number, duration: number, velocity: number): Note {
  return { id: uid('n'), pitch, start, duration: Math.max(0.05, duration), velocity };
}

/** Times (beats) within [s,e) at the given offsets of each bar. */
function barHits(s: number, e: number, bpb: number, offsets: number[]): number[] {
  const out: number[] = [];
  for (let bar = Math.floor(s / bpb) * bpb; bar < e; bar += bpb)
    for (const o of offsets) {
      const t = bar + o;
      if (t >= s - 1e-6 && t < e - 1e-6) out.push(t);
    }
  return out;
}

export function generatePart(style: StyleId, o: GenOptions): Note[] {
  if (style === 'melody') return generateMelody(o);
  const r = rng(o.seed ?? 1);
  const energy = o.energy ?? 0.6;
  const bpb = o.timeSig[0] * (4 / o.timeSig[1]);
  const compound = o.timeSig[1] === 8 && o.timeSig[0] % 3 === 0;
  const half = compound ? 1.5 : bpb / 2;
  const notes: Note[] = [];
  const [lo, hi] = o.range;
  const midLo = Math.max(lo, 52);
  const midHi = Math.min(hi, 79);
  let prev: number[] | null = null;
  const segs = chordSegments(o.chords, o.start, o.end);
  const baseVel = 0.55 + energy * 0.3;
  const scaleSet = new Set(scaleOfKey(o.key));

  segs.forEach(({ chord, s, e }, si) => {
    const pcs = chordPcs(chord);
    const bassPc = chord.bass ?? chord.root;
    const nextChord = segs[si + 1]?.chord;
    switch (style) {
      case 'piano-block': {
        const v = voiceLead(pcs, prev, midLo, midHi, 4);
        prev = v;
        const hits = barHits(s, e, bpb, energy > 0.55 ? [0, half] : [0]);
        if (!hits.length || hits[0] > s + 1e-6) hits.unshift(s);
        hits.forEach((t, i) => {
          const nt = hits[i + 1] ?? e;
          for (const p of v) notes.push(N(p, t, (nt - t) * 0.96, humanize(r, baseVel * (i === 0 ? 1 : 0.85))));
        });
        const b = bassRoot(bassPc, Math.max(lo, 36));
        if (b < v[0]) notes.push(N(b, s, (e - s) * 0.98, humanize(r, baseVel)));
        break;
      }
      case 'piano-ballad': {
        const v = voiceLead(pcs, prev, Math.max(lo, 60), midHi, 3);
        prev = v;
        for (const p of v) notes.push(N(p, s, (e - s) * 0.98, humanize(r, baseVel * 0.7)));
        const root = bassRoot(bassPc, Math.max(lo, 36));
        const third = pcs[1] ?? pcs[0];
        const fifth = pcs[2] ?? pcs[0];
        const fig = [root, atOrAbove(fifth, root + 1), root + 12, atOrAbove(third, root + 13), root + 12, atOrAbove(fifth, root + 1)];
        let i = 0;
        for (let t = s; t < e - 1e-6; t += 0.5, i++) notes.push(N(fig[i % fig.length], t, Math.min(1.2, e - t), humanize(r, baseVel * (i % 2 ? 0.6 : 0.75))));
        break;
      }
      case 'piano-pop': {
        const v = voiceLead(pcs, prev, midLo, midHi, 4);
        prev = v;
        const pattern = compound ? [0, 1, 1.5, 2.5] : [0, 1, 1.5, 2.5, 3];
        const hits = barHits(s, e, bpb, pattern.filter((x) => x < bpb));
        if (!hits.length || hits[0] > s + 1e-6) hits.unshift(s);
        hits.forEach((t, i) => {
          const nt = hits[i + 1] ?? e;
          const onBeat = Math.abs(((t % bpb) + bpb) % bpb) < 1e-6;
          for (const p of v) notes.push(N(p, t, Math.min(nt - t, 0.9) * 0.9, humanize(r, baseVel * (onBeat ? 1 : 0.8))));
        });
        const b = bassRoot(bassPc, Math.max(lo, 36));
        for (const t of barHits(s, e, bpb, [0, half])) notes.push(N(b, t, Math.min(half, e - t) * 0.95, humanize(r, baseVel * 0.9)));
        break;
      }
      case 'piano-stride': {
        const v = voiceLead(pcs, prev, Math.max(lo, 55), Math.min(hi, 74), 3);
        prev = v;
        const root = bassRoot(bassPc, Math.max(lo, 33));
        const fifthPc = pcs[2] ?? pcs[0];
        const beat = 4 / o.timeSig[1];
        let k = 0;
        for (let t = s; t < e - 1e-6; t += beat, k++) {
          if (k % 2 === 0) notes.push(N(k % 4 === 0 ? root : atOrAbove(fifthPc, root - 7), t, beat * 0.9, humanize(r, baseVel)));
          else for (const p of v) notes.push(N(p, t, beat * 0.6, humanize(r, baseVel * 0.8)));
        }
        break;
      }
      case 'guitar-strum': {
        const v = guitarVoicing({ root: bassPc === chord.root ? chord.root : bassPc, quality: chord.quality }).filter((p) => p >= lo - 5);
        // D . D U . U D U  (eighths)
        const pat = compound ? ['D', 'U', 'D', 'D', 'U', 'D'] : energy > 0.7 ? ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'] : ['D', '.', 'D', 'U', '.', 'U', 'D', 'U'];
        const step = compound ? 0.5 : 0.5;
        const strokes: { t: number; up: boolean }[] = [];
        for (let bar = Math.floor(s / bpb) * bpb; bar < e; bar += bpb)
          pat.forEach((c, i) => {
            const t = bar + i * step;
            if (c !== '.' && t >= s - 1e-6 && t < e - 1e-6 && i * step < bpb) strokes.push({ t, up: c === 'U' });
          });
        strokes.forEach((st, i) => {
          const nt = strokes[i + 1]?.t ?? e;
          const strings = st.up ? [...v].slice(-4).reverse() : v;
          strings.forEach((p, j) => {
            const off = j * 0.018;
            notes.push(N(p, st.t + off, Math.max(0.1, nt - st.t - off) * 0.95, humanize(r, baseVel * (st.up ? 0.62 : 0.85) * (1 - j * 0.02))));
          });
        });
        break;
      }
      case 'guitar-pick': {
        const v = guitarVoicing(chord);
        const root = v[0];
        const alt = v[1];
        const tops = v.slice(-3);
        const beat = compound ? 1.5 : 4 / o.timeSig[1];
        let k = 0;
        for (let t = s; t < e - 1e-6; t += beat, k++) {
          notes.push(N(k % 2 === 0 ? root : alt, t, beat * 0.95, humanize(r, baseVel * 0.85)));
          if (k % 2 === 0) notes.push(N(tops[2] ?? tops[0], t, beat * 0.9, humanize(r, baseVel * 0.65)));
          const off = t + beat / 2;
          if (off < e - 1e-6) notes.push(N(k % 2 === 0 ? tops[0] : tops[1] ?? tops[0], off, beat * 0.9, humanize(r, baseVel * 0.6)));
        }
        break;
      }
      case 'bass-root':
      case 'bass-pulse':
      case 'bass-octave': {
        const root = bassRoot(bassPc, lo);
        const step = style === 'bass-root' ? 4 / o.timeSig[1] : 0.5;
        let k = 0;
        for (let t = s; t < e - 1e-6; t += step, k++) {
          const p = style === 'bass-octave' && k % 2 === 1 ? root + 12 : root;
          const onBeat = Math.abs(t - Math.round(t)) < 1e-6;
          notes.push(N(p, t, step * (style === 'bass-pulse' ? 0.55 : 0.9), humanize(r, baseVel * (onBeat ? 1 : 0.78))));
        }
        break;
      }
      case 'bass-rootfifth': {
        const root = bassRoot(bassPc, lo);
        const fifth = root + 7 <= hi ? root + 7 : root - 5;
        const nextRoot = nextChord ? bassRoot(nextChord.bass ?? nextChord.root, lo) : root;
        for (const bar of barHits(s, e, bpb, [0])) {
          const barEnd = Math.min(e, bar + bpb);
          const hits: [number, number, number][] = compound
            ? [[0, root, 1.2], [1.5, fifth, 1.2]]
            : [[0, root, 1.4], [1.5, root, 0.45], [2, fifth, 0.9], [3, root + 12 <= hi ? root + 12 : root, 0.45], [3.5, approach(nextRoot, scaleSet), 0.45]];
          for (const [off, p, d] of hits) {
            const t = bar + off;
            if (t < barEnd - 1e-6 && t >= s - 1e-6) notes.push(N(off === 3.5 && barEnd < e - 1e-6 ? root + 7 : p, t, Math.min(d, barEnd - t), humanize(r, baseVel * (off === 0 ? 1 : 0.8))));
          }
        }
        break;
      }
      case 'bass-walking': {
        const root = bassRoot(bassPc, lo);
        const nextRoot = nextChord ? bassRoot(nextChord.bass ?? nextChord.root, lo) : root;
        const ints = QUALITY_INTERVALS[chord.quality];
        const beat = 4 / o.timeSig[1];
        const tones = [root, root + (ints[1] ?? 4), root + (ints[2] ?? 7), root + 12];
        let k = 0;
        for (let t = s; t < e - 1e-6; t += beat, k++) {
          const last = t + beat >= e - 1e-6;
          let p = k === 0 ? root : last ? (r() < 0.5 ? approach(nextRoot, scaleSet) : nextRoot + (r() < 0.5 ? 1 : -1)) : pick(r, tones.slice(1));
          while (p > hi) p -= 12;
          while (p < lo) p += 12;
          notes.push(N(p, t, beat * 0.92, humanize(r, baseVel * (k % 2 ? 0.8 : 0.95))));
        }
        break;
      }
      case 'strings-pad':
      case 'pad': {
        const n = style === 'pad' ? 4 : 4;
        const v = voiceLead(pcs, prev, Math.max(lo, style === 'pad' ? 48 : 50), Math.min(hi, style === 'pad' ? 84 : 79), n);
        prev = v;
        for (const p of v) notes.push(N(p, s, e - s + 0.05, humanize(r, baseVel * (style === 'pad' ? 0.65 : 0.75), 0.03)));
        if (style === 'pad' && v[0] - 12 >= lo) notes.push(N(v[0] - 12, s, e - s + 0.05, baseVel * 0.5));
        break;
      }
      case 'strings-staccato': {
        const v = voiceLead(pcs, prev, Math.max(lo, 48), Math.min(hi, 76), 3);
        prev = v;
        const fig = [v[0], v[2], v[1], v[2]];
        let k = 0;
        for (let t = s; t < e - 1e-6; t += 0.5, k++) notes.push(N(fig[k % fig.length], t, 0.3, humanize(r, baseVel * (k % 2 ? 0.7 : 0.9))));
        break;
      }
      case 'synth-arp': {
        const v = voiceLead(pcs, prev, Math.max(lo, 57), Math.min(hi, 81), 3);
        prev = v;
        const fig = [v[0], v[1], v[2], v[0] + 12, v[2], v[1]];
        let k = 0;
        for (let t = s; t < e - 1e-6; t += 0.25, k++) notes.push(N(fig[k % fig.length], t, 0.22, humanize(r, baseVel * (k % 4 === 0 ? 0.95 : 0.7))));
        break;
      }
    }
  });
  return notes.filter((n) => n.pitch >= 0 && n.pitch <= 127);
}

// ------------------------------------------------------------------ melody

const RHYTHMS: Record<'low' | 'mid' | 'high', [number, number][][]> = {
  low: [
    [[0, 2], [2, 2]],
    [[0, 3], [3, 1]],
    [[0, 1.5], [1.5, 0.5], [2, 2]],
    [[1, 1], [2, 2]],
    [[0, 1], [1, 1], [2, 2]],
  ],
  mid: [
    [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]],
    [[0, 0.5], [0.5, 0.5], [1, 1], [2, 1], [3, 1]],
    [[0, 1.5], [1.5, 1], [2.5, 0.5], [3, 1]],
    [[0.5, 0.5], [1, 0.5], [1.5, 1], [2.5, 1.5]],
    [[0, 1], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1]],
    [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 2]],
  ],
  high: [
    [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]],
    [[0, 0.25], [0.25, 0.25], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]],
    [[0, 0.75], [0.75, 0.25], [1, 0.5], [1.5, 0.5], [2, 0.75], [2.75, 0.25], [3, 1]],
    [[0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]],
  ],
};

const CADENCE: [number, number][][] = [
  [[0, 1], [1, 3]],
  [[0, 0.5], [0.5, 0.5], [1, 3]],
  [[0, 4]],
  [[0, 1.5], [1.5, 2.5]],
];

/** Generate a singable, chord-aware melody over [start, end). */
export function generateMelody(o: GenOptions & { density?: number }): Note[] {
  const r = rng((o.seed ?? 7) * 7919 + 13);
  const bpb = o.timeSig[0] * (4 / o.timeSig[1]);
  const density = o.density ?? o.energy ?? 0.5;
  const tier: 'low' | 'mid' | 'high' = density < 0.35 ? 'low' : density < 0.72 ? 'mid' : 'high';
  const lo = Math.max(o.range[0], 55);
  const hi = Math.min(o.range[1], 84);
  const center = Math.round((lo + hi) / 2);
  const scale = new Set(scaleOfKey(o.key));
  const scaleDegreesIn = (allowed: Set<number>) => {
    const out: number[] = [];
    for (let p = lo; p <= hi; p++) if (allowed.has(p % 12)) out.push(p);
    return out;
  };
  const fitBar = (rh: [number, number][]) => {
    const scaleF = bpb / 4;
    return rh.map(([s, d]) => [s * scaleF, d * scaleF] as [number, number]).filter(([s]) => s < bpb - 1e-6);
  };

  // Motif: rhythm + interval steps (in scale steps)
  const rhythmA = fitBar(pick(r, RHYTHMS[tier]));
  const rhythmB = fitBar(pick(r, RHYTHMS[tier]));
  const stepsA = rhythmA.map(() => weighted(r, [[1, 4], [-1, 4], [2, 2], [-2, 2], [0, 1.5], [3, 0.6], [-3, 0.6]] as [number, number][]));
  const stepsB = rhythmB.map(() => weighted(r, [[1, 4], [-1, 4], [2, 2], [-2, 2], [0, 1]] as [number, number][]));

  const notes: Note[] = [];
  let pitch = center;
  const totalBars = Math.max(1, Math.round((o.end - o.start) / bpb));
  const phraseLen = totalBars >= 4 ? 4 : totalBars;
  for (let b = 0; b < totalBars; b++) {
    const barStart = o.start + b * bpb;
    const inPhrase = b % phraseLen;
    const lastOfPhrase = inPhrase === phraseLen - 1;
    const lastOfSection = b === totalBars - 1;
    const motifIsA = inPhrase % 2 === 0;
    let rhythm = lastOfPhrase && phraseLen > 1 ? fitBar(pick(r, CADENCE)) : motifIsA ? rhythmA : rhythmB;
    // Second phrase varies the rhythm slightly.
    if (Math.floor(b / phraseLen) % 2 === 1 && !lastOfPhrase && r() < 0.35) rhythm = fitBar(pick(r, RHYTHMS[tier]));
    const steps = motifIsA ? stepsA : stepsB;
    rhythm.forEach(([off, dur], i) => {
      const t = barStart + off;
      if (t >= o.end - 1e-6) return;
      const chord = chordAt(o.chords, t);
      const ct = new Set(chord ? chordPcs(chord) : [o.key.tonic]);
      const allowed = new Set([...scale, ...ct]);
      const ladder = scaleDegreesIn(allowed);
      let idx = ladder.findIndex((p) => p >= pitch);
      if (idx < 0) idx = ladder.length - 1;
      const step = i === 0 ? 0 : steps[i % steps.length] ?? 0;
      idx = Math.max(0, Math.min(ladder.length - 1, idx + step));
      let p = ladder[idx];
      // Keep the line near the middle of the range.
      if (p > hi - 2 && step > 0) p = ladder[Math.max(0, idx - 2)];
      if (p < lo + 2 && step < 0) p = ladder[Math.min(ladder.length - 1, idx + 2)];
      const strong = Math.abs(off) < 1e-6 || Math.abs(off - bpb / 2) < 1e-6;
      const isLast = i === rhythm.length - 1 && lastOfPhrase;
      if (strong || isLast || dur >= 1.5) {
        // Land on the nearest chord tone (root for the section's final note).
        const targets = isLast && lastOfSection && chord ? new Set([chord.root]) : ct;
        let bestP = p;
        let bestD = Infinity;
        for (let q = p - 6; q <= p + 6; q++) {
          if (q < lo || q > hi || !targets.has(((q % 12) + 12) % 12)) continue;
          const d = Math.abs(q - p) + (q === pitch ? 0.5 : 0);
          if (d < bestD) {
            bestD = d;
            bestP = q;
          }
        }
        p = bestP;
      } else if (!scale.has(p % 12) && !ct.has(p % 12)) {
        p += 1;
      }
      pitch = p;
      const accent = strong ? 0.82 : 0.68;
      const arc = 0.06 * Math.sin((inPhrase / phraseLen) * Math.PI);
      const d = Math.min(dur * (isLast ? 0.98 : 0.92), o.end - t);
      notes.push(N(p, t, d, humanize(r, accent + arc, 0.05)));
    });
  }
  return notes;
}

// ------------------------------------------------------------------ drums

export type DrumStyle = 'pop' | 'rock' | 'hiphop' | 'trap' | 'lofi' | 'house' | 'rnb' | 'synthwave' | 'funk' | 'country' | 'cinematic' | 'ballad' | 'jazz';

const GROOVES: Record<DrumStyle, Record<number, string>> = {
  pop: { 36: 'X.....x.X.......', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' },
  rock: { 36: 'X.....x.X.x.....', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' },
  hiphop: { 36: 'X......x..X.....', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.xo' },
  trap: { 36: 'X.......x.x.....', 39: '........X.......', 42: 'x.x.x.x.xxx.x.xx', 46: '...............x' },
  lofi: { 36: 'X.....x...x.....', 38: '....x.......x...', 42: 'xoxoxoxoxoxoxoxo' },
  house: { 36: 'X...X...X...X...', 39: '....X.......X...', 46: '..x...x...x...x.', 42: 'x.o.x.o.x.o.x.o.' },
  rnb: { 36: 'X..x....x.x.....', 38: '....X.......X...', 42: 'x.xxx.x.x.xxx.x.' },
  synthwave: { 36: 'X...X...X...X...', 38: '....X.......X...', 42: 'xoxoxoxoxoxoxoxo' },
  funk: { 36: 'X..x..x...x..x..', 38: '....X..o.o..X..o', 42: 'xxxxxxxxxxxxxxxx' },
  country: { 36: 'X.......X.......', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' },
  cinematic: { 36: 'X.......X..X....', 41: '..x...x...x...x.', 45: '....x.......x...' },
  ballad: { 36: 'X.......x.......', 37: '....x.......x...', 42: 'x...x...x...x...' },
  jazz: { 51: 'x..xx..xx..xx..x', 36: 'o.......o.......', 44: '....x.......x...' },
};

const LIGHT: Record<number, string> = { 36: 'X.......X.......', 42: 'x.x.x.x.x.x.x.x.' };
const FILL_A: Record<number, string> = { 36: 'X.......', 38: 'x.x.x...', 48: '.....x..', 45: '......x.', 41: '.......X' };
const FILL_B: Record<number, string> = { 36: 'X...X...', 38: 'x.xxx.xX' };

function strToNotes(lanes: Record<number, string>, start: number, steps: number, step = 0.25, velScale = 1): Note[] {
  const out: Note[] = [];
  for (const [pitch, pat] of Object.entries(lanes)) {
    const chars = [...pat];
    for (let i = 0; i < steps; i++) {
      const c = chars[i % chars.length];
      if (c === '.' || c === undefined) continue;
      const v = (c === 'X' ? 1 : c === 'o' ? 0.42 : 0.76) * velScale;
      out.push(N(Number(pitch), start + i * step, step, Math.min(1, v)));
    }
  }
  return out;
}

/**
 * Drum part for a section. intensity: 0 = intro/outro (sparse), 0.5 = verse, 1 = chorus.
 */
export function generateDrums(style: DrumStyle, start: number, bars: number, timeSig: [number, number], intensity: number, seed = 1, opts: { fillAtEnd?: boolean; crashAtStart?: boolean } = {}): Note[] {
  const r = rng(seed);
  const bpb = timeSig[0] * (4 / timeSig[1]);
  const steps = Math.round(bpb * 4);
  const notes: Note[] = [];
  const compound = timeSig[1] === 8 && timeSig[0] % 3 === 0;
  for (let b = 0; b < bars; b++) {
    const t = start + b * bpb;
    let lanes: Record<number, string>;
    if (compound) {
      lanes = { 36: 'X.....' + (timeSig[0] >= 12 ? 'x.....X.....' : '') + 'x.....', 38: '......X.....', 42: 'x.x.x.x.x.x.x.x.x.x.x.x.' };
    } else if (timeSig[0] === 3) {
      lanes = { 36: 'X...........', 38: '....x...x...', 42: 'x.x.x.x.x.x.' };
    } else lanes = intensity < 0.25 ? LIGHT : GROOVES[style];
    if (intensity < 0.25 && !compound && style !== 'cinematic') lanes = style === 'house' || style === 'synthwave' ? { ...LIGHT, 36: 'X...X...X...X...' } : LIGHT;
    const last = b === bars - 1;
    if (last && opts.fillAtEnd && intensity >= 0.4 && steps >= 16) {
      // Groove for the first half, fill in the second half.
      const firstHalf: Record<number, string> = {};
      for (const [p, s] of Object.entries(lanes)) firstHalf[Number(p)] = s.slice(0, 8);
      notes.push(...strToNotes(firstHalf, t, 8));
      notes.push(...strToNotes(r() < 0.6 ? FILL_A : FILL_B, t + 2, Math.min(8, steps - 8), 0.25, 0.95));
      continue;
    }
    const velScale = 0.85 + intensity * 0.15;
    notes.push(...strToNotes(lanes, t, steps, 0.25, velScale));
    // Chorus lift: open hat on the last off-beat every other bar.
    if (intensity > 0.8 && b % 2 === 1 && !lanes[46] && steps >= 16) notes.push(N(46, t + bpb - 0.5, 0.5, 0.7));
    if (b === 0 && opts.crashAtStart) notes.push(N(49, t, 1, 0.9));
  }
  // Light humanisation of velocities.
  for (const n of notes) n.velocity = humanize(r, n.velocity, 0.04);
  return notes;
}
