// Song Wizard: builds a complete, arranged, editable song from a few choices.
import type { ChordSymbol, KeySignature, Project, Section, Track } from '../../model/types';
import { createMidiRegion, createProject, createTrack, uid } from '../../model/defaults';
import { beatsPerBar } from '../../model/music';
import { generateDrums, generateMelody, generatePart, layChords, parseProgression, rng, pick, type DrumStyle, type StyleId } from '../../model/accompaniment';
import { getPreset } from '../../audio/presets';

export type SectionKind = 'Intro' | 'Verse' | 'Pre-Chorus' | 'Chorus' | 'Bridge' | 'Drop' | 'Outro';

export interface SectionPlan {
  kind: SectionKind;
  bars: number;
}

export type Mood = 'Happy' | 'Sad' | 'Energetic' | 'Chill' | 'Dark' | 'Epic' | 'Romantic';

export interface PartChoice {
  preset: string;
  style: StyleId;
}

export interface Genre {
  id: string;
  name: string;
  bpm: [number, number];
  mode: 'major' | 'minor';
  drums: { kit: string; style: DrumStyle };
  bass: PartChoice;
  chords: PartChoice;
  pad?: PartChoice;
  lead: PartChoice;
  arp?: PartChoice;
  /** Roman progressions per section kind, per mode. */
  prog: { major: Partial<Record<SectionKind | 'default', string[]>>; minor: Partial<Record<SectionKind | 'default', string[]>> };
  /** Beats per chord (default one bar). */
  chordBars?: number;
  reverb?: Project['reverbType'];
}

const POP_PROG = {
  major: { default: ['I V vi IV', 'I vi IV V'], Verse: ['I V vi IV', 'vi IV I V', 'I IV vi V'], Chorus: ['IV V iii vi', 'I V vi IV', 'vi IV I V'], Bridge: ['ii IV vi V', 'bVI bVII I I'], 'Pre-Chorus': ['ii iii IV V'] },
  minor: { default: ['i VI III VII'], Verse: ['i VI III VII', 'i iv VI V'], Chorus: ['VI VII i i', 'VI III VII i'], Bridge: ['iv v VI VII'], 'Pre-Chorus': ['iv VI VII VII'] },
};

export const GENRES: Genre[] = [
  {
    id: 'pop',
    name: 'Pop',
    bpm: [100, 124],
    mode: 'major',
    drums: { kit: 'kit-acoustic', style: 'pop' },
    bass: { preset: 'electric-bass', style: 'bass-rootfifth' },
    chords: { preset: 'grand-piano', style: 'piano-pop' },
    pad: { preset: 'string-ensemble', style: 'strings-pad' },
    lead: { preset: 'analog-lead', style: 'melody' },
    arp: { preset: 'pluck', style: 'synth-arp' },
    prog: POP_PROG,
  },
  {
    id: 'rock',
    name: 'Rock',
    bpm: [110, 140],
    mode: 'major',
    drums: { kit: 'kit-acoustic', style: 'rock' },
    bass: { preset: 'electric-bass', style: 'bass-pulse' },
    chords: { preset: 'electric-guitar', style: 'guitar-strum' },
    pad: { preset: 'organ', style: 'strings-pad' },
    lead: { preset: 'electric-guitar', style: 'melody' },
    prog: {
      major: { default: ['I bVII IV I', 'I V vi IV'], Verse: ['I bVII IV I', 'I IV I V'], Chorus: ['IV I V vi', 'I V vi IV'], Bridge: ['vi IV I V', 'bVI bVII I I'] },
      minor: { default: ['i VII VI V'], Verse: ['i VII VI VII'], Chorus: ['VI VII i i', 'i VII VI V'], Bridge: ['iv v VI VII'] },
    },
  },
  {
    id: 'hiphop',
    name: 'Hip Hop',
    bpm: [84, 96],
    mode: 'minor',
    drums: { kit: 'kit-808', style: 'hiphop' },
    bass: { preset: 'sub-808', style: 'bass-root' },
    chords: { preset: 'electric-piano', style: 'piano-block' },
    pad: { preset: 'warm-pad', style: 'pad' },
    lead: { preset: 'bells', style: 'melody' },
    prog: {
      major: { default: ['IVmaj7 iii7 ii7 Imaj7', 'vi IV I V'] },
      minor: { default: ['i7 iv7 VImaj7 V7', 'i iv v i', 'i VI III VII'] },
    },
  },
  {
    id: 'trap',
    name: 'Trap',
    bpm: [130, 150],
    mode: 'minor',
    drums: { kit: 'kit-808', style: 'trap' },
    bass: { preset: 'sub-808', style: 'bass-root' },
    chords: { preset: 'bells', style: 'synth-arp' },
    pad: { preset: 'choir', style: 'pad' },
    lead: { preset: 'square-lead', style: 'melody' },
    prog: { major: { default: ['vi IV I V'] }, minor: { default: ['i VI III VII', 'i iv VI V', 'i VII VI VII'] } },
    chordBars: 2,
  },
  {
    id: 'lofi',
    name: 'Lo-Fi',
    bpm: [72, 88],
    mode: 'major',
    drums: { kit: 'kit-lofi', style: 'lofi' },
    bass: { preset: 'upright-bass', style: 'bass-root' },
    chords: { preset: 'electric-piano', style: 'piano-block' },
    pad: { preset: 'dream-pad', style: 'pad' },
    lead: { preset: 'nylon-guitar', style: 'melody' },
    prog: {
      major: { default: ['IVmaj7 iii7 ii7 Imaj7', 'Imaj7 vi7 ii7 V7', 'IVmaj7 V7 iii7 vi'] },
      minor: { default: ['i7 iv7 VImaj7 V7', 'i7 VImaj7 iv7 v7'] },
    },
    reverb: 'room',
  },
  {
    id: 'house',
    name: 'House / EDM',
    bpm: [120, 128],
    mode: 'minor',
    drums: { kit: 'kit-909', style: 'house' },
    bass: { preset: 'synth-bass', style: 'bass-octave' },
    chords: { preset: 'supersaw', style: 'piano-pop' },
    pad: { preset: 'warm-pad', style: 'pad' },
    lead: { preset: 'pluck', style: 'melody' },
    arp: { preset: 'pluck', style: 'synth-arp' },
    prog: { major: { default: ['vi IV I V', 'I V vi IV'] }, minor: { default: ['i VI III VII', 'VI VII i i', 'i VII VI VII'] } },
  },
  {
    id: 'rnb',
    name: 'R&B / Soul',
    bpm: [70, 92],
    mode: 'major',
    drums: { kit: 'kit-808', style: 'rnb' },
    bass: { preset: 'synth-bass', style: 'bass-rootfifth' },
    chords: { preset: 'electric-piano', style: 'piano-ballad' },
    pad: { preset: 'string-ensemble', style: 'strings-pad' },
    lead: { preset: 'saxophone', style: 'melody' },
    prog: { major: { default: ['Imaj7 vi7 ii7 V7', 'IVmaj7 iii7 ii7 Imaj7'] }, minor: { default: ['i7 iv7 VImaj7 V7', 'i iv VI V'] } },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    bpm: [96, 112],
    mode: 'minor',
    drums: { kit: 'kit-linn', style: 'synthwave' },
    bass: { preset: 'synth-bass', style: 'bass-pulse' },
    chords: { preset: 'brass-section', style: 'piano-block' },
    pad: { preset: 'warm-pad', style: 'pad' },
    lead: { preset: 'square-lead', style: 'melody' },
    arp: { preset: 'pluck', style: 'synth-arp' },
    prog: { major: { default: ['I V vi IV'] }, minor: { default: ['i VII VI VII', 'i VI III VII', 'VI VII i i'] } },
    reverb: 'plate',
  },
  {
    id: 'funk',
    name: 'Funk',
    bpm: [100, 116],
    mode: 'minor',
    drums: { kit: 'kit-acoustic', style: 'funk' },
    bass: { preset: 'electric-bass', style: 'bass-octave' },
    chords: { preset: 'clav', style: 'piano-pop' },
    pad: { preset: 'brass-section', style: 'strings-staccato' },
    lead: { preset: 'trumpet', style: 'melody' },
    prog: { major: { default: ['I7 IV7 I7 V7'] }, minor: { default: ['i7 iv7 i7 v7', 'i7 IV7 i7 IV7'] } },
    chordBars: 2,
  },
  {
    id: 'folk',
    name: 'Folk / Country',
    bpm: [88, 116],
    mode: 'major',
    drums: { kit: 'kit-acoustic', style: 'country' },
    bass: { preset: 'upright-bass', style: 'bass-rootfifth' },
    chords: { preset: 'acoustic-guitar', style: 'guitar-strum' },
    pad: { preset: 'harmonium', style: 'strings-pad' },
    lead: { preset: 'violin', style: 'melody' },
    prog: { major: { default: ['I IV I V', 'I V vi IV', 'I IV vi V'] }, minor: { default: ['i VII VI VII', 'i iv i V'] } },
  },
  {
    id: 'ballad',
    name: 'Piano Ballad',
    bpm: [64, 80],
    mode: 'major',
    drums: { kit: 'kit-acoustic', style: 'ballad' },
    bass: { preset: 'upright-bass', style: 'bass-root' },
    chords: { preset: 'grand-piano', style: 'piano-ballad' },
    pad: { preset: 'string-ensemble', style: 'strings-pad' },
    lead: { preset: 'cello', style: 'melody' },
    prog: POP_PROG,
    reverb: 'hall',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    bpm: [80, 100],
    mode: 'minor',
    drums: { kit: 'kit-acoustic', style: 'cinematic' },
    bass: { preset: 'cello', style: 'bass-root' },
    chords: { preset: 'string-ensemble', style: 'strings-staccato' },
    pad: { preset: 'choir', style: 'pad' },
    lead: { preset: 'french-horn', style: 'melody' },
    arp: { preset: 'harp', style: 'synth-arp' },
    prog: { major: { default: ['I V vi IV', 'bVI bVII I I'] }, minor: { default: ['i VI III VII', 'VI III VII i', 'i VII VI V'] } },
    reverb: 'cathedral',
  },
  {
    id: 'jazz',
    name: 'Jazz',
    bpm: [110, 150],
    mode: 'major',
    drums: { kit: 'kit-acoustic', style: 'jazz' },
    bass: { preset: 'upright-bass', style: 'bass-walking' },
    chords: { preset: 'grand-piano', style: 'piano-stride' },
    lead: { preset: 'saxophone', style: 'melody' },
    prog: { major: { default: ['ii7 V7 Imaj7 Imaj7', 'Imaj7 vi7 ii7 V7'] }, minor: { default: ['i7 iv7 v7 i7', 'iv7 VII7 IIImaj7 VImaj7'] } },
    reverb: 'room',
  },
];

export const MOODS: { id: Mood; mode: 'major' | 'minor' | null; tempo: number; energy: number }[] = [
  { id: 'Happy', mode: 'major', tempo: 0.7, energy: 0.65 },
  { id: 'Energetic', mode: null, tempo: 1, energy: 0.9 },
  { id: 'Chill', mode: null, tempo: 0.2, energy: 0.4 },
  { id: 'Romantic', mode: 'major', tempo: 0.3, energy: 0.45 },
  { id: 'Sad', mode: 'minor', tempo: 0.15, energy: 0.4 },
  { id: 'Dark', mode: 'minor', tempo: 0.5, energy: 0.6 },
  { id: 'Epic', mode: 'minor', tempo: 0.6, energy: 0.85 },
];

export const STRUCTURES: { name: string; plan: SectionPlan[] }[] = [
  {
    name: 'Standard song',
    plan: [
      { kind: 'Intro', bars: 4 },
      { kind: 'Verse', bars: 8 },
      { kind: 'Chorus', bars: 8 },
      { kind: 'Verse', bars: 8 },
      { kind: 'Chorus', bars: 8 },
      { kind: 'Bridge', bars: 8 },
      { kind: 'Chorus', bars: 8 },
      { kind: 'Outro', bars: 4 },
    ],
  },
  {
    name: 'Short (≈1 min)',
    plan: [
      { kind: 'Intro', bars: 2 },
      { kind: 'Verse', bars: 8 },
      { kind: 'Chorus', bars: 8 },
      { kind: 'Outro', bars: 4 },
    ],
  },
  {
    name: 'With pre-chorus',
    plan: [
      { kind: 'Intro', bars: 4 },
      { kind: 'Verse', bars: 8 },
      { kind: 'Pre-Chorus', bars: 4 },
      { kind: 'Chorus', bars: 8 },
      { kind: 'Verse', bars: 8 },
      { kind: 'Pre-Chorus', bars: 4 },
      { kind: 'Chorus', bars: 8 },
      { kind: 'Outro', bars: 4 },
    ],
  },
  {
    name: 'EDM build & drop',
    plan: [
      { kind: 'Intro', bars: 8 },
      { kind: 'Verse', bars: 8 },
      { kind: 'Pre-Chorus', bars: 8 },
      { kind: 'Drop', bars: 16 },
      { kind: 'Bridge', bars: 8 },
      { kind: 'Drop', bars: 16 },
      { kind: 'Outro', bars: 8 },
    ],
  },
  { name: 'Loop sketch (8 bars)', plan: [{ kind: 'Verse', bars: 8 }] },
];

export const SECTION_COLORS: Record<SectionKind, string> = {
  Intro: '#6e7bff',
  Verse: '#3ecf8e',
  'Pre-Chorus': '#f5c518',
  Chorus: '#ff6b6b',
  Bridge: '#bf5af2',
  Drop: '#ff2d92',
  Outro: '#5ac8fa',
};

export interface WizardOptions {
  title: string;
  genre: string;
  mood: Mood;
  key: KeySignature;
  bpm: number;
  plan: SectionPlan[];
  parts: { drums: boolean; bass: boolean; chords: boolean; pad: boolean; lead: boolean; arp: boolean };
  seed: number;
}

/** Roles active per section kind, and their energy. */
const ARRANGEMENT: Record<SectionKind, { energy: number; drums: number; bass: boolean; chords: boolean; pad: boolean; lead: boolean; arp: boolean }> = {
  Intro: { energy: 0.35, drums: 0.1, bass: false, chords: true, pad: true, lead: false, arp: true },
  Verse: { energy: 0.5, drums: 0.5, bass: true, chords: true, pad: false, lead: true, arp: false },
  'Pre-Chorus': { energy: 0.65, drums: 0.6, bass: true, chords: true, pad: true, lead: false, arp: true },
  Chorus: { energy: 0.85, drums: 1, bass: true, chords: true, pad: true, lead: true, arp: true },
  Drop: { energy: 1, drums: 1, bass: true, chords: true, pad: false, lead: true, arp: true },
  Bridge: { energy: 0.55, drums: 0.4, bass: true, chords: true, pad: true, lead: false, arp: false },
  Outro: { energy: 0.3, drums: 0.1, bass: true, chords: true, pad: true, lead: false, arp: false },
};

export function suggestedBpm(g: Genre, mood: Mood): number {
  const m = MOODS.find((x) => x.id === mood)!;
  return Math.round(g.bpm[0] + (g.bpm[1] - g.bpm[0]) * m.tempo);
}

export function suggestedMode(g: Genre, mood: Mood): 'major' | 'minor' {
  return MOODS.find((x) => x.id === mood)?.mode ?? g.mode;
}

function progressionFor(g: Genre, kind: SectionKind, mode: 'major' | 'minor', r: () => number): string {
  const bank = g.prog[mode];
  const list = bank[kind] ?? (kind === 'Drop' ? bank.Chorus : kind === 'Outro' || kind === 'Intro' ? bank.Verse : undefined) ?? bank.default ?? POP_PROG[mode].default!;
  return pick(r, list);
}

/** Build the whole song. */
export function buildSong(o: WizardOptions): Project {
  const g = GENRES.find((x) => x.id === o.genre) ?? GENRES[0];
  const r = rng(o.seed);
  const mood = MOODS.find((m) => m.id === o.mood) ?? MOODS[0];
  const p = createProject(o.title || `${g.name} Song`);
  p.bpm = o.bpm;
  p.key = o.key;
  p.reverbType = g.reverb ?? 'hall';
  const bpb = beatsPerBar(p.timeSig);
  const chordBeats = (g.chordBars ?? 1) * bpb;

  // ---- sections & chord track (same kind ⇒ same progression, so choruses repeat)
  const progByKind = new Map<SectionKind, string>();
  const sections: Section[] = [];
  const chords: ChordSymbol[] = [];
  let beat = 0;
  for (const sp of o.plan) {
    if (!progByKind.has(sp.kind)) progByKind.set(sp.kind, progressionFor(g, sp.kind, o.key.mode, r));
    let prog = parseProgression(progByKind.get(sp.kind)!, o.key);
    if (!prog.length) prog = parseProgression(o.key.mode === 'major' ? 'I V vi IV' : 'i VI III VII', o.key);
    const len = sp.bars * bpb;
    let laid = layChords(prog, beat, len, chordBeats);
    if (sp.kind === 'Outro' && len > chordBeats) {
      // End on the tonic.
      const tonic = parseProgression(o.key.mode === 'major' ? 'I' : 'i', o.key);
      laid = [...layChords(prog, beat, len - chordBeats, chordBeats), ...layChords(tonic, beat + len - chordBeats, chordBeats, chordBeats)];
    }
    chords.push(...laid);
    sections.push({ id: uid('s'), name: sp.kind, start: beat, length: len, color: SECTION_COLORS[sp.kind] });
    beat += len;
  }
  p.chords = chords;
  p.sections = sections;
  const total = beat;
  p.lengthBars = Math.ceil(total / bpb) + 4;

  // ---- tracks
  const mk = (type: 'instrument' | 'drums', preset: string, idx: number): Track => createTrack(type, preset, getPreset(preset).name, idx);
  const drums = o.parts.drums ? mk('drums', g.drums.kit, 0) : null;
  const bass = o.parts.bass ? mk('instrument', g.bass.preset, 0) : null;
  const keys = o.parts.chords ? mk('instrument', g.chords.preset, 1) : null;
  const pad = o.parts.pad && g.pad ? mk('instrument', g.pad.preset, 2) : null;
  const arp = o.parts.arp && g.arp ? mk('instrument', g.arp.preset, 3) : null;
  const lead = o.parts.lead ? mk('instrument', g.lead.preset, 0) : null;
  if (lead) {
    lead.name = 'Melody · ' + lead.name;
    lead.fx.reverb = 0.3;
    lead.fx.delay = 0.18;
    lead.volume = 0.72;
  }
  if (pad) {
    pad.volume = 0.55;
    pad.fx.reverb = 0.45;
  }
  if (arp) {
    arp.volume = 0.5;
    arp.fx.delay = 0.3;
  }
  if (keys) keys.volume = 0.7;
  if (bass) bass.fx.compressor = 0.4;

  const melodySeedByKind = new Map<SectionKind, number>();
  const sectionSeed = (k: SectionKind) => {
    if (!melodySeedByKind.has(k)) melodySeedByKind.set(k, Math.floor(r() * 1e6));
    return melodySeedByKind.get(k)!;
  };

  sections.forEach((sec, i) => {
    const kind = sec.name as SectionKind;
    const arr = ARRANGEMENT[kind];
    const energy = Math.min(1, arr.energy * (0.6 + mood.energy * 0.6));
    const s = sec.start;
    const e = sec.start + sec.length;
    const bars = Math.round(sec.length / bpb);
    const seed = sectionSeed(kind);
    const base = { chords, start: s, end: e, timeSig: p.timeSig, key: p.key, energy, seed };
    const next = sections[i + 1];
    const add = (t: Track | null, notes: ReturnType<typeof generatePart>) => {
      if (!t || !notes.length) return;
      const reg = createMidiRegion(s, sec.length, notes.map((n) => ({ ...n, start: n.start - s })), kind);
      t.regions.push(reg);
    };
    if (drums && arr.drums > 0) {
      const intensity = kind === 'Intro' || kind === 'Outro' ? 0.1 : arr.drums * (0.7 + mood.energy * 0.3);
      const notes = generateDrums(g.drums.style, 0, bars, p.timeSig, intensity, seed + 3, {
        fillAtEnd: !!next && ARRANGEMENT[next.name as SectionKind].energy > arr.energy - 0.05 && bars >= 4,
        crashAtStart: kind === 'Chorus' || kind === 'Drop',
      });
      drums.regions.push(createMidiRegion(s, sec.length, notes, kind));
    }
    if (bass && arr.bass) add(bass, generatePart(kind === 'Bridge' && g.bass.style === 'bass-pulse' ? 'bass-root' : g.bass.style, { ...base, range: getPreset(g.bass.preset).range ?? [28, 55] }));
    if (keys && arr.chords) {
      const st: StyleId = kind === 'Intro' || kind === 'Outro' ? (g.chords.style.startsWith('guitar') ? 'guitar-pick' : g.chords.style === 'synth-arp' ? 'synth-arp' : 'piano-block') : g.chords.style;
      add(keys, generatePart(st, { ...base, range: getPreset(g.chords.preset).range ?? [36, 96] }));
    }
    if (pad && arr.pad) add(pad, generatePart(g.pad!.style, { ...base, range: getPreset(g.pad!.preset).range ?? [36, 96] }));
    if (arp && arr.arp) add(arp, generatePart('synth-arp', { ...base, range: getPreset(g.arp!.preset).range ?? [48, 96] }));
    if (lead && arr.lead) {
      const range = getPreset(g.lead.preset).range ?? [55, 84];
      add(lead, generateMelody({ ...base, range, density: kind === 'Chorus' || kind === 'Drop' ? 0.6 + mood.energy * 0.3 : 0.35 + mood.energy * 0.25 }));
    }
  });

  const tracks = [drums, bass, keys, pad, arp, lead].filter((t): t is Track => !!t);
  p.tracks = tracks;
  // Song-wide fades: gentle intro swell and outro fade.
  const outro = sections[sections.length - 1];
  if (outro && outro.name === 'Outro') {
    p.masterAutomation = [
      { beat: 0, value: 0.85 },
      { beat: Math.min(sections[0].length, 4 * bpb), value: 1 },
      { beat: outro.start, value: 1 },
      { beat: total, value: 0 },
    ];
  }
  p.loop = { enabled: false, start: sections[1]?.start ?? 0, end: (sections[1]?.start ?? 0) + (sections[1]?.length ?? 4 * bpb) };
  return p;
}
