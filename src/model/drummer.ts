// Virtual Drummer: deterministic, style-aware groove generation (GarageBand "Drummer" style).
// A drummer region's notes are fully derived from its DrummerSettings + length + context,
// so playback, export and every editor treat it as a normal MIDI region.
import type { DrummerSettings, DrummerStyle, MidiRegion, Note, Project } from './types';
import { beatsPerBar } from './music';
import { placedNotes } from './regions';
import { uid } from './defaults';

// GM drum pitches
const KICK = 36;
const RIM = 37;
const SNARE = 38;
const CLAP = 39;
const CHH = 42;
const PHH = 44;
const OHH = 46;
const LTOM = 41;
const FTOM = 43;
const MTOM = 45;
const HTOM = 48;
const CRASH = 49;
const RIDE = 51;
const TAMB = 54;
const COWBELL = 56;
const SHAKER = 70;

export interface DrummerCharacter {
  style: DrummerStyle;
  genre: string;
  name: string;
  bio: string;
  kit: string;
  color: string;
}

export const DRUMMERS: DrummerCharacter[] = [
  { style: 'rock', genre: 'Rock', name: 'Logan', bio: 'Big-room rock with a heavy right foot and crashing fills.', kit: 'kit-acoustic', color: '#ff6b4a' },
  { style: 'pop', genre: 'Pop', name: 'Maya', bio: 'Tight, polished modern pop grooves that sit right in the pocket.', kit: 'kit-linn', color: '#ff4fa3' },
  { style: 'songwriter', genre: 'Songwriter', name: 'Theo', bio: 'Gentle cross-stick and shaker — perfect under acoustic guitar and vocals.', kit: 'kit-acoustic', color: '#d9a35b' },
  { style: 'hiphop', genre: 'Hip Hop', name: 'Dez', bio: 'Dusty boom-bap with lazy swing and knocking kicks.', kit: 'kit-808', color: '#ffb02e' },
  { style: 'trap', genre: 'Trap', name: 'Nova', bio: 'Half-time snares, rattling hi-hat rolls and booming 808s.', kit: 'kit-808', color: '#b26bff' },
  { style: 'rnb', genre: 'R&B', name: 'Jasmine', bio: 'Smooth, syncopated R&B with layered claps and ghost notes.', kit: 'kit-stark', color: '#ff7ac8' },
  { style: 'funk', genre: 'Funk', name: 'Curtis', bio: 'Busy sixteenth-note hats and snappy ghost notes — all about the one.', kit: 'kit-acoustic', color: '#ffd23e' },
  { style: 'house', genre: 'House', name: 'Kai', bio: 'Four-on-the-floor kicks, offbeat open hats and snare-roll build-ups.', kit: 'kit-909', color: '#3ad1ff' },
  { style: 'lofi', genre: 'Lo-Fi', name: 'Juniper', bio: 'Laid-back, swung and soft — beats to study to.', kit: 'kit-lofi', color: '#9fd17a' },
  { style: 'jazz', genre: 'Jazz', name: 'Ella', bio: 'Swinging ride cymbal, feathered kick and conversational snare comping.', kit: 'kit-acoustic', color: '#5ac8a8' },
  { style: 'reggae', genre: 'Reggae', name: 'Marley', bio: 'One-drop and steppers grooves with a relaxed lope.', kit: 'kit-acoustic', color: '#43c463' },
  { style: 'latin', genre: 'Latin', name: 'Sofia', bio: 'Clave-driven grooves with cowbell, shaker and tumbao kicks.', kit: 'kit-acoustic', color: '#ff8f3a' },
];

export function drummerFor(style: DrummerStyle): DrummerCharacter {
  return DRUMMERS.find((d) => d.style === style) ?? DRUMMERS[0];
}

export interface DrummerPreset {
  name: string;
  values: Partial<DrummerSettings>;
}

export const DRUMMER_PRESETS: DrummerPreset[] = [
  { name: 'Intro', values: { complexity: 0.2, loudness: 0.35, fills: 0.25, kickVar: 0.3, hatVar: 0.2, percVar: 0.2 } },
  { name: 'Verse', values: { complexity: 0.35, loudness: 0.5, fills: 0.35, kickVar: 0.5, hatVar: 0.3, percVar: 0.3 } },
  { name: 'Pre-Chorus', values: { complexity: 0.5, loudness: 0.62, fills: 0.6, kickVar: 0.55, hatVar: 0.45, percVar: 0.45 } },
  { name: 'Chorus', values: { complexity: 0.62, loudness: 0.82, fills: 0.55, kickVar: 0.65, hatVar: 0.6, percVar: 0.6 } },
  { name: 'Bridge', values: { complexity: 0.45, loudness: 0.55, fills: 0.4, kickVar: 0.4, hatVar: 0.75, percVar: 0.35 } },
  { name: 'Breakdown', values: { complexity: 0.15, loudness: 0.3, fills: 0.15, kickVar: 0.2, hatVar: 0.1, percVar: 0.1 } },
  { name: 'Big Finish', values: { complexity: 0.85, loudness: 0.95, fills: 0.9, kickVar: 0.8, hatVar: 0.8, percVar: 0.7 } },
];

export function defaultDrummerSettings(style: DrummerStyle): DrummerSettings {
  const swing: Partial<Record<DrummerStyle, number>> = { hiphop: 0.45, lofi: 0.55, jazz: 0.85, reggae: 0.5, rnb: 0.25, funk: 0.1 };
  return {
    style,
    complexity: 0.4,
    loudness: 0.55,
    fills: 0.45,
    swing: swing[style] ?? 0,
    pieces: { kit: true, hats: true, cymbals: true, toms: true, perc: style === 'songwriter' || style === 'latin' || style === 'house' },
    kickVar: 0.5,
    hatVar: style === 'jazz' ? 0.9 : 0.3,
    percVar: 0.4,
    followTrackId: null,
    seed: Math.floor(Math.random() * 1e9),
  };
}

// ------------------------------------------------------------------ RNG

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ style templates (4/4, 16 steps)

interface StyleDef {
  kick: [string, string, string]; // per complexity level
  snare: string; // main backbeat
  snarePiece?: number; // rim for cross-stick styles
  hatsRes: [8 | 16, 8 | 16, 8 | 16];
  /** Use ride instead of hats as timekeeper (jazz). */
  ride?: string;
  ghosts: number; // ghost-note tendency 0..1
  swingUnit: 8 | 16;
  /** Offbeat open hats (house). */
  openOffbeats?: boolean;
  /** Layer clap on the backbeat. */
  clap?: boolean;
  perc: { piece: number; pattern: [string, string, string] }[];
  fill: 'toms' | 'snareRoll' | 'trap' | 'jazz';
  halfTime?: boolean;
  /** Velocity scale (soft styles). */
  dyn?: number;
}

const S: Record<DrummerStyle, StyleDef> = {
  rock: {
    kick: ['x.......x.......', 'x.......x.x.....', 'x..x....x.x...x.'],
    snare: '....x.......x...',
    hatsRes: [8, 8, 16],
    ghosts: 0.25,
    swingUnit: 16,
    perc: [{ piece: TAMB, pattern: ['....x.......x...', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.'] }],
    fill: 'toms',
  },
  pop: {
    kick: ['x.......x.......', 'x.....x.x.......', 'x.....x.x..x....'],
    snare: '....x.......x...',
    hatsRes: [8, 16, 16],
    ghosts: 0.15,
    swingUnit: 16,
    clap: true,
    perc: [{ piece: TAMB, pattern: ['....x.......x...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] }],
    fill: 'toms',
  },
  songwriter: {
    kick: ['x.......x.......', 'x.......x..x....', 'x..x....x..x....'],
    snare: '....x.......x...',
    snarePiece: RIM,
    hatsRes: [8, 8, 8],
    ghosts: 0.1,
    swingUnit: 16,
    perc: [{ piece: SHAKER, pattern: ['x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx'] }],
    fill: 'toms',
    dyn: 0.8,
  },
  hiphop: {
    kick: ['x.........x.....', 'x......x..x.....', 'x.x....x..x..x..'],
    snare: '....x.......x...',
    hatsRes: [8, 8, 16],
    ghosts: 0.3,
    swingUnit: 16,
    perc: [{ piece: TAMB, pattern: ['....x.......x...', '....x.......x...', '..x.x...x.x.x...'] }],
    fill: 'snareRoll',
  },
  trap: {
    kick: ['x.........x.....', 'x......x..x...x.', 'x..x...x.xx...x.'],
    snare: '........x.......',
    hatsRes: [8, 16, 16],
    ghosts: 0.05,
    swingUnit: 16,
    clap: true,
    perc: [{ piece: RIM, pattern: ['...........x....', '...x.......x..x.', '.x.x...x.x.x..x.'] }],
    fill: 'trap',
    halfTime: true,
  },
  rnb: {
    kick: ['x......x..x.....', 'x..x...x..x.....', 'x..x...x..x..x.x'],
    snare: '....x.......x...',
    hatsRes: [16, 16, 16],
    ghosts: 0.35,
    swingUnit: 16,
    clap: true,
    perc: [{ piece: SHAKER, pattern: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'] }],
    fill: 'snareRoll',
  },
  funk: {
    kick: ['x.........x.....', 'x.x.......x..x..', 'x.x...x...x..x.x'],
    snare: '....x.......x...',
    hatsRes: [16, 16, 16],
    ghosts: 0.6,
    swingUnit: 16,
    perc: [{ piece: COWBELL, pattern: ['x.......x.......', 'x...x...x...x...', 'x..x..x.x..x..x.'] }],
    fill: 'toms',
  },
  house: {
    kick: ['x...x...x...x...', 'x...x...x...x...', 'x...x...x...x..x'],
    snare: '....x.......x...',
    hatsRes: [8, 16, 16],
    ghosts: 0,
    swingUnit: 16,
    openOffbeats: true,
    clap: true,
    perc: [{ piece: SHAKER, pattern: ['..x...x...x...x.', 'x.xxx.xxx.xxx.xx', 'xxxxxxxxxxxxxxxx'] }],
    fill: 'snareRoll',
  },
  lofi: {
    kick: ['x......x..x.....', 'x......x..x..x..', 'x.x....x..x..x..'],
    snare: '....x.......x...',
    hatsRes: [8, 8, 16],
    ghosts: 0.35,
    swingUnit: 16,
    perc: [{ piece: SHAKER, pattern: ['....x.......x...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] }],
    fill: 'snareRoll',
    dyn: 0.85,
  },
  jazz: {
    kick: ['x...............', 'x.......x.......', 'x...x...x...x...'],
    snare: '................',
    hatsRes: [8, 8, 8],
    ride: 'x...x.x.x...x.x.',
    ghosts: 0.45,
    swingUnit: 8,
    perc: [],
    fill: 'jazz',
    dyn: 0.75,
  },
  reggae: {
    kick: ['........x.......', '........x.......', 'x...x...x...x...'],
    snare: '........x.......',
    snarePiece: RIM,
    hatsRes: [8, 8, 16],
    ghosts: 0.15,
    swingUnit: 8,
    perc: [{ piece: SHAKER, pattern: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'] }],
    fill: 'toms',
  },
  latin: {
    kick: ['x..x....x..x....', 'x..x....x..x....', 'x..x..x.x..x..x.'],
    snare: '..........x.x...',
    snarePiece: RIM,
    hatsRes: [8, 8, 16],
    ghosts: 0.15,
    swingUnit: 16,
    perc: [
      { piece: COWBELL, pattern: ['x...x...x...x...', 'x...x.x.x...x.x.', 'x.x.x.xxx.x.x.xx'] },
      { piece: SHAKER, pattern: ['x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx'] },
    ],
    fill: 'toms',
  },
};

// ------------------------------------------------------------------ generation

export interface DrummerContext {
  /** Absolute start (beats) of the region on the timeline. */
  regionStart: number;
  timeSig: [number, number];
  /** Absolute beats where a new section starts (fills lead into these). */
  sectionStarts: number[];
  /** Absolute beats of notes from the followed track (bass etc.). */
  followOnsets?: number[];
}

/** Resample a 16-step pattern to `steps` steps (for non-4/4 meters). */
function fitPattern(p: string, steps: number): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < steps; i++) out.push(i < 16 ? p[i] === 'x' : p[i % 16] === 'x' && i % 4 === 0);
  return out;
}

/** Generic patterns for odd / compound meters. */
function meterPatterns(steps: number, compound: boolean, level: number) {
  const pulse = compound ? 6 : 4;
  const kick = Array<boolean>(steps).fill(false);
  const snare = Array<boolean>(steps).fill(false);
  const pulses = Math.floor(steps / pulse);
  for (let p = 0; p < pulses; p++) {
    const s = p * pulse;
    if (p === 0) kick[s] = true;
    else if (p % 2 === 1) snare[s] = true;
    else if (level > 0 || pulses <= 3) kick[s] = true;
    if (level > 1 && p % 2 === 0 && s + pulse - 2 < steps) kick[s + pulse - 2] = true;
  }
  return { kick, snare };
}

export function generateDrummerNotes(st: DrummerSettings, lengthBeats: number, ctx: DrummerContext): Note[] {
  const rnd = mulberry32(st.seed);
  const def = S[st.style];
  const notes: Note[] = [];
  const bpb = beatsPerBar(ctx.timeSig);
  const steps = Math.round(bpb * 4);
  const is44 = steps === 16;
  const compound = ctx.timeSig[1] === 8 && ctx.timeSig[0] % 3 === 0;
  const level = st.complexity < 0.34 ? 0 : st.complexity < 0.67 ? 1 : 2;
  const kickLevel = Math.max(0, Math.min(2, level + Math.round((st.kickVar - 0.5) * 2)));
  const dyn = (def.dyn ?? 1) * (0.42 + st.loudness * 0.55);
  const nBars = Math.max(1, Math.ceil(lengthBeats / bpb - 1e-6));
  const swingAmt = st.swing * (def.swingUnit === 8 ? 1 / 6 : 1 / 12);

  const add = (pitch: number, beat: number, vel: number, extra: Partial<Note> = {}) => {
    if (beat < -0.05 || beat >= lengthBeats - 1e-6) return;
    const v = Math.max(0.08, Math.min(1, vel * dyn + (rnd() - 0.5) * 0.08));
    notes.push({ id: uid('n'), pitch, start: Math.max(0, beat), duration: 0.25, velocity: v, ...extra });
  };
  // Swing + subtle human timing
  const timeOf = (barStart: number, step: number, anchor = false) => {
    let b = barStart + step * 0.25;
    if (def.swingUnit === 16 && step % 2 === 1) b += swingAmt;
    if (def.swingUnit === 8 && step % 4 === 2) b += swingAmt;
    if (!anchor) b += (rnd() - 0.5) * 0.012;
    return b;
  };

  // Fill bars: bars that end at a phrase boundary.
  const regionEnd = ctx.regionStart + lengthBeats;
  const boundaries = new Set<number>();
  for (const s of ctx.sectionStarts) if (s > ctx.regionStart + 1e-6 && s <= regionEnd + 1e-6) boundaries.add(Math.round((s - ctx.regionStart) / bpb));
  boundaries.add(nBars);
  const phrase = st.fills > 0.6 ? 4 : 8;
  for (let b = 1; b <= nBars; b++) {
    const absBar = Math.round((ctx.regionStart + b * bpb) / bpb);
    if (absBar % phrase === 0) boundaries.add(b);
  }
  const crashBars = new Set<number>();
  if (st.fills > 0.25 && ctx.sectionStarts.some((s) => Math.abs(s - ctx.regionStart) < 1e-6)) crashBars.add(0);

  // Kick positions following another track, per bar (absolute onsets → steps).
  const followByBar = new Map<number, Set<number>>();
  if (ctx.followOnsets?.length) {
    for (const on of ctx.followOnsets) {
      const rel = on - ctx.regionStart;
      if (rel < 0 || rel >= lengthBeats) continue;
      const bar = Math.floor(rel / bpb + 1e-9);
      const step = Math.round((rel - bar * bpb) * 4);
      if (step >= steps) continue;
      let set = followByBar.get(bar);
      if (!set) followByBar.set(bar, (set = new Set()));
      set.add(step);
    }
  }

  for (let bar = 0; bar < nBars; bar++) {
    const bs = bar * bpb;
    const barLen = Math.min(bpb, lengthBeats - bs);
    const barSteps = Math.round(barLen * 4);
    const isFill = boundaries.has(bar + 1) && st.fills > 0.08;
    const fillSteps = !isFill ? 0 : Math.min(barSteps, Math.round(st.fills < 0.35 ? 4 : st.fills < 0.7 ? 8 : st.fills < 0.9 ? 12 : 16) * (steps / 16));
    const fillFrom = barSteps - fillSteps;

    // --- groove patterns
    let kick: boolean[];
    let snare: boolean[];
    if (is44) {
      kick = fitPattern(def.kick[kickLevel], steps);
      snare = fitPattern(def.snare, steps);
    } else {
      const m = meterPatterns(steps, compound, kickLevel);
      kick = m.kick;
      snare = st.style === 'jazz' ? Array(steps).fill(false) : m.snare;
    }
    const follow = followByBar.get(bar);
    if (follow) {
      kick = Array(steps).fill(false);
      for (const s of follow) kick[s] = true;
      kick[0] = true;
    }
    // Bar-to-bar variation: alternate bars get a pickup, plus random mutations.
    if (!follow && bar % 2 === 1 && kickLevel > 0 && st.style !== 'house' && is44 && !kick[14]) kick[rnd() < 0.5 ? 14 : 15] = true;
    if (!follow && rnd() < 0.12 + st.complexity * 0.3 + st.kickVar * 0.15 && st.style !== 'house') {
      const cand = [3, 6, 7, 10, 11, 14, 15].filter((s) => s < steps && !snare[s]);
      const s = cand[Math.floor(rnd() * cand.length)];
      if (s !== undefined) kick[s] = !kick[s] || s % 4 === 0 ? true : false;
    }

    if (st.pieces.kit) {
      for (let s = 0; s < barSteps; s++) {
        if (s >= fillFrom && s % 4 !== 0) continue; // only downbeat kicks under fills
        if (kick[s]) add(KICK, timeOf(bs, s, s % 4 === 0), s === 0 ? 1 : s % 4 === 0 ? 0.9 : 0.8);
        if (snare[s] && s < fillFrom) {
          add(def.snarePiece ?? SNARE, timeOf(bs, s, true), def.snarePiece ? 0.8 : 0.97);
          if (def.clap && st.pieces.perc !== false && (st.percVar > 0.3 || st.style === 'house' || st.style === 'trap')) add(CLAP, timeOf(bs, s, true), 0.8);
        }
      }
      // Ghost notes on weak sixteenths
      const ghostP = def.ghosts * (0.25 + st.complexity * 1.1);
      for (let s = 1; s < fillFrom; s++) {
        if (s % 4 === 0 || snare[s] || snare[s - 1] || (s + 1 < steps && snare[s + 1] && s % 2 === 1 && rnd() < 0.5)) continue;
        if (rnd() < ghostP * (s % 2 === 1 ? 1 : 0.6)) add(def.snarePiece ?? SNARE, timeOf(bs, s), 0.24 + rnd() * 0.08);
      }
      // Jazz comping: snare "conversation" on swung offbeats
      if (st.style === 'jazz') {
        for (let s = 2; s < fillFrom; s += 4) if (rnd() < 0.15 + st.complexity * 0.35) add(SNARE, timeOf(bs, s), 0.35 + rnd() * 0.25);
      }
    }

    // --- timekeeping (hats / ride)
    if (st.pieces.hats) {
      const useRide = !!def.ride || st.hatVar > 0.72;
      const res = def.hatsRes[level];
      const every = res === 16 ? 1 : 2;
      for (let s = 0; s < fillFrom; s++) {
        if (useRide) {
          const pat = def.ride ? fitPattern(def.ride, steps) : null;
          const on = pat ? pat[s] || (st.complexity > 0.7 && s % 4 === 3 && rnd() < 0.3) : s % 2 === 0;
          if (on) add(RIDE, timeOf(bs, s), s % 4 === 0 ? 0.75 : 0.6);
          continue;
        }
        if (s % every !== 0) continue;
        const openHere = (def.openOffbeats && s % 4 === 2) || (st.hatVar > 0.4 && s === steps - 2 && bar % 2 === 1) || (st.hatVar > 0.6 && s === steps / 2 - 2 && rnd() < 0.5);
        if (openHere) {
          add(OHH, timeOf(bs, s), 0.7);
          continue;
        }
        const acc = s % 4 === 0 ? 0.72 : s % 2 === 0 ? 0.55 : 0.42;
        const extra: Partial<Note> = {};
        if (st.style === 'trap' && level >= 1 && s % 4 === 3 && rnd() < 0.25 + st.complexity * 0.4) extra.repeat = rnd() < 0.5 ? 2 : 3;
        add(CHH, timeOf(bs, s), acc, extra);
      }
      // Jazz / reggae pedal hat on 2 & 4
      if (st.style === 'jazz' || useRide)
        for (let s = 4; s < fillFrom; s += 8) add(PHH, timeOf(bs, s, true), 0.55);
    }

    // --- percussion layer
    if (st.pieces.perc) {
      const pl = st.percVar < 0.34 ? 0 : st.percVar < 0.67 ? 1 : 2;
      for (const layer of def.perc) {
        const pat = fitPattern(layer.pattern[pl], steps);
        for (let s = 0; s < fillFrom; s++) if (pat[s]) add(layer.piece, timeOf(bs, s), layer.piece === SHAKER ? (s % 2 === 0 ? 0.5 : 0.35) : 0.55);
      }
    }

    // --- crash on downbeat after a fill / section start
    if (st.pieces.cymbals && crashBars.has(bar)) {
      add(CRASH, bs, 0.9);
      if (st.pieces.kit && !kick[0]) add(KICK, bs, 0.95);
    }

    // --- fill
    if (isFill && fillSteps > 0) {
      writeFill(def.fill, st, bs + fillFrom * 0.25, fillSteps, add, rnd);
      if (bar + 1 < nBars) crashBars.add(bar + 1);
    }
  }

  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  // Merge duplicate hits of the same piece (groove + fill overlap), keeping the louder one.
  const out: Note[] = [];
  const last = new Map<number, Note>();
  for (const n of notes) {
    const prev = last.get(n.pitch);
    if (prev && n.start - prev.start < 0.06) {
      if (n.velocity > prev.velocity) prev.velocity = n.velocity;
      continue;
    }
    last.set(n.pitch, n);
    out.push(n);
  }
  return out;
}

function writeFill(
  kind: StyleDef['fill'],
  st: DrummerSettings,
  start: number,
  steps: number,
  add: (pitch: number, beat: number, vel: number, extra?: Partial<Note>) => void,
  rnd: () => number,
) {
  const toms = st.pieces.toms ? [SNARE, HTOM, MTOM, LTOM, FTOM] : [SNARE];
  const dense = st.fills > 0.55 || st.complexity > 0.6;
  for (let i = 0; i < steps; i++) {
    const t = start + i * 0.25;
    const prog = i / Math.max(1, steps - 1);
    const vel = 0.55 + prog * 0.4;
    switch (kind) {
      case 'snareRoll': {
        // Classic build: 8ths → 16ths crescendo, maybe 32nd rolls at the end.
        const sixteenths = prog > 0.5 || dense;
        if (sixteenths || i % 2 === 0) add(SNARE, t, 0.4 + prog * 0.6, prog > 0.8 && dense ? { repeat: 2 } : {});
        if (i % 4 === 0 && st.pieces.kit) add(KICK, t, 0.8);
        break;
      }
      case 'trap': {
        if (i % 2 === 0 || dense) add(CHH, t, 0.5 + prog * 0.3, { repeat: rnd() < 0.5 ? 3 : 2 });
        if (i % 4 === 2 || (prog > 0.6 && i % 2 === 1)) add(SNARE, t, vel);
        if (i % 4 === 0 && st.pieces.kit) add(KICK, t, 0.85);
        break;
      }
      case 'jazz': {
        if (i % 2 === 0 || (dense && rnd() < 0.5)) add(i % 3 === 0 && st.pieces.toms ? MTOM : SNARE, t, 0.45 + prog * 0.4);
        if (i % 4 === 0) add(RIDE, t, 0.6);
        break;
      }
      default: {
        // Descending around the kit.
        if (!dense && i % 2 === 1) continue;
        const idx = Math.min(toms.length - 1, Math.floor(prog * toms.length));
        const pitch = steps <= 4 ? (i < 2 ? SNARE : toms[Math.min(toms.length - 1, 1 + i)]) : toms[idx];
        add(pitch, t, vel);
        if (i % 4 === 0 && st.pieces.kit && rnd() < 0.7) add(KICK, t, 0.75);
      }
    }
  }
}

/** Absolute section start beats of a project (for fill placement). */
export function sectionStartsOf(p: Project): number[] {
  return (p.sections ?? []).map((s) => s.start);
}

export function followOnsetsOf(p: Project, trackId: string | null | undefined, from: number, to: number): number[] | undefined {
  if (!trackId) return undefined;
  const t = p.tracks.find((x) => x.id === trackId);
  if (!t) return undefined;
  const out: number[] = [];
  for (const r of t.regions) if (r.kind === 'midi') for (const pn of placedNotes(r, from, to)) out.push(pn.start);
  return out;
}

/** Regenerate the notes of a drummer region in place (draft or plain object). */
export function regenerateDrummerRegion(p: Project, r: MidiRegion): void {
  const st = r.drummer;
  if (!st) return;
  const notes = generateDrummerNotes(st, r.length, {
    regionStart: r.start,
    timeSig: p.timeSig,
    sectionStarts: sectionStartsOf(p),
    followOnsets: followOnsetsOf(p, st.followTrackId, r.start, r.start + r.length),
  });
  r.notes = notes;
  r.offset = 0;
  r.loop = false;
  r.contentLength = r.length;
  st.generatedFor = r.length;
  st.sig = drummerSig(p, r);
}

/** Everything outside the settings that affects generation. */
export function drummerSig(p: Project, r: MidiRegion): string {
  const st = r.drummer;
  const follow = followOnsetsOf(p, st?.followTrackId, r.start, r.start + r.length);
  const fsum = follow ? follow.length + ':' + follow.reduce((a, b) => a + b, 0).toFixed(3) : '-';
  return [r.start, r.length, p.timeSig.join('/'), sectionStartsOf(p).join(','), fsum].join('|');
}
