// New-song templates and demo songs.
import type { Note, Project } from './types';
import { createMidiRegion, createProject, createTrack, note, uid } from './defaults';
import { SCALES, chordPitches, diatonicChords } from './music';

/** Build drum notes from step strings, e.g. { 36: 'x...x...x...x...' }. 'X' = accent, 'x' = normal, 'o' = ghost. */
export function drumPattern(lanes: Record<number, string>, stepBeats = 0.25): Note[] {
  const notes: Note[] = [];
  for (const [pitch, pat] of Object.entries(lanes)) {
    [...pat.replace(/\s|\|/g, '')].forEach((ch, i) => {
      if (ch === '.' || ch === '-') return;
      const vel = ch === 'X' ? 1 : ch === 'o' ? 0.45 : 0.78;
      notes.push({ id: uid('n'), pitch: Number(pitch), start: i * stepBeats, duration: stepBeats, velocity: vel });
    });
  }
  return notes;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  build: () => Project;
}

function base(name: string, bpm: number, tonic = 0, mode: 'major' | 'minor' = 'major'): Project {
  const p = createProject(name);
  p.bpm = bpm;
  p.key = { tonic, mode };
  return p;
}

/** Chord progression notes. degrees index into diatonicChords. Each chord lasts `beats`. */
function progression(p: Project, degrees: number[], beats: number, center: number, style: 'block' | 'arp' | 'pulse' = 'block', vel = 0.7): Note[] {
  const chords = diatonicChords(p.key);
  const out: Note[] = [];
  degrees.forEach((deg, i) => {
    const pitches = chordPitches(chords[deg], center);
    const t0 = i * beats;
    if (style === 'block') {
      for (const pt of pitches) out.push(note(pt, t0, beats * 0.98, vel));
    } else if (style === 'pulse') {
      for (let b = 0; b < beats; b += 1) for (const pt of pitches) out.push(note(pt, t0 + b, 0.9, vel * (b % 2 ? 0.8 : 1)));
    } else {
      const seq = [...pitches, pitches[1] + 12, pitches[0] + 12, pitches[2], pitches[1]];
      for (let s = 0; s < beats * 2; s++) out.push(note(seq[s % seq.length], t0 + s * 0.5, 0.48, vel * (s % 2 ? 0.75 : 0.95)));
    }
  });
  return out;
}

function bassline(p: Project, degrees: number[], beats: number, pattern: number[] = [0, 1.5, 2, 3], octave = 36): Note[] {
  const chords = diatonicChords(p.key);
  const out: Note[] = [];
  degrees.forEach((deg, i) => {
    const root = octave + ((chords[deg].root - (octave % 12) + 12) % 12);
    for (let bar = 0; bar < beats / 4; bar++)
      for (const off of pattern) out.push(note(root, i * beats + bar * 4 + off, 0.45, off === 0 ? 0.9 : 0.72));
  });
  return out;
}

export const TEMPLATES: Template[] = [
  {
    id: 'empty',
    name: 'Empty Song',
    description: 'Start from scratch with a piano track',
    icon: 'plus',
    build: () => {
      const p = base('My Song', 110);
      p.tracks.push(createTrack('instrument', 'grand-piano', 'Grand Piano', 0));
      return p;
    },
  },
  {
    id: 'beat',
    name: 'Beat Sequencer',
    description: 'Drum machine with a 2-bar groove',
    icon: 'drums',
    build: () => {
      const p = base('New Beat', 96);
      const d = createTrack('drums', 'kit-808', 'Hip Hop 808', 0);
      const r = createMidiRegion(
        0,
        8,
        drumPattern({
          36: 'X.....x...x.....X.....x.......x.',
          38: '....X.......X.......X.......X...',
          42: 'x.x.x.x.x.x.x.xxx.x.x.x.x.x.x.x.',
          46: '..............x...............x.',
        }),
        'Beat',
      );
      r.loop = true;
      r.length = 32;
      d.regions.push(r);
      p.tracks.push(d);
      p.tracks.push(createTrack('instrument', 'sub-808', '808 Sub Bass', 1));
      return p;
    },
  },
  {
    id: 'band',
    name: 'Band',
    description: 'Drums, bass, keys & guitar ready to go',
    icon: 'band',
    build: () => {
      const p = base('Band Song', 118, 7);
      p.tracks.push(createTrack('drums', 'kit-acoustic', 'Studio Kit', 0));
      p.tracks.push(createTrack('instrument', 'electric-bass', 'Electric Bass', 0));
      p.tracks.push(createTrack('instrument', 'grand-piano', 'Grand Piano', 1));
      p.tracks.push(createTrack('instrument', 'electric-guitar', 'Electric Guitar', 2));
      return p;
    },
  },
  {
    id: 'orchestra',
    name: 'Orchestral',
    description: 'Strings, winds & brass for scoring',
    icon: 'violin',
    build: () => {
      const p = base('Orchestral Sketch', 80, 2, 'minor');
      for (const [i, inst] of ['violin', 'cello', 'flute', 'french-horn', 'harp', 'string-ensemble'].entries()) {
        const t = createTrack('instrument', inst, '', i);
        t.name = { violin: 'Violin', cello: 'Cello', flute: 'Flute', 'french-horn': 'French Horn', harp: 'Harp', 'string-ensemble': 'String Ensemble' }[inst]!;
        t.fx.reverb = 0.4;
        p.tracks.push(t);
      }
      p.reverbType = 'cathedral';
      return p;
    },
  },
  {
    id: 'voice',
    name: 'Voice & Audio',
    description: 'Record vocals or any instrument with a mic',
    icon: 'mic',
    build: () => {
      const p = base('Recording', 100);
      const a = createTrack('audio', '', 'Vocals', 0);
      a.fx.reverb = 0.25;
      a.fx.compressor = 0.45;
      p.tracks.push(a);
      p.tracks.push(createTrack('instrument', 'acoustic-guitar', 'Acoustic Guitar', 0));
      p.metronome = true;
      return p;
    },
  },
  {
    id: 'demo-sunset',
    name: 'Demo: Sunset Drive',
    description: 'A full arranged song to explore',
    icon: 'star',
    build: () => buildDemo(),
  },
  {
    id: 'demo-lofi',
    name: 'Demo: Late Night Lo-Fi',
    description: 'Dusty keys, lazy drums & vinyl warmth',
    icon: 'star',
    build: () => buildLofi(),
  },
  {
    id: 'demo-pop',
    name: 'Demo: Pop Anthem',
    description: 'Verse, build & big chorus',
    icon: 'star',
    build: () => buildPop(),
  },
  {
    id: 'demo-cinematic',
    name: 'Demo: Cinematic Rise',
    description: 'Orchestral swell with horns & harp',
    icon: 'star',
    build: () => buildCinematic(),
  },
  {
    id: 'demo-synthwave',
    name: 'Demo: Neon Synthwave',
    description: '80s drums, arps & analog bass',
    icon: 'star',
    build: () => buildSynthwave(),
  },
];

function buildDemo(): Project {
  const p = base('Sunset Drive', 104, 9, 'minor'); // A minor
  // vi-IV-I-V feel in A minor: i VI III VII → degrees 0,5,2,6
  const prog = [0, 5, 2, 6];
  const drums = createTrack('drums', 'kit-909', 'House 909', 0);
  const groove = drumPattern({
    36: 'X...x...X...x...X...x...X...x.x.',
    39: '....X.......X.......X.......X...',
    42: '..x...x...x...x...x...x...x...xx',
    46: '......x.......x.......x.......x.',
    70: 'xoxoxoxoxoxoxoxoxoxoxoxoxoxoxoxo',
  });
  const intro = createMidiRegion(16, 16, drumPattern({ 36: 'X...x...X...x...X...x...X...x...', 70: 'xoxoxoxoxoxoxoxoxoxoxoxoxoxoxoxo' }), 'Intro Beat');
  intro.contentLength = 8;
  intro.loop = true;
  const verse = createMidiRegion(32, 64, groove, 'Groove');
  verse.contentLength = 8;
  verse.loop = true;
  const fill = createMidiRegion(
    96,
    4,
    drumPattern({ 36: 'X.......X.......', 38: '....x.x.xxxxXXXX', 45: '........x.x.....', 41: '............x.x.', 49: 'X...............' }),
    'Fill',
  );
  const outro = createMidiRegion(100, 28, groove, 'Groove');
  outro.contentLength = 8;
  outro.loop = true;
  drums.regions.push(intro, verse, fill, outro);
  drums.volume = 0.75;

  const bass = createTrack('instrument', 'synth-bass', 'Analog Bass', 0);
  const bassNotes = bassline(p, prog, 4, [0, 0.75, 1.5, 2, 2.75, 3.5], 33);
  const bassReg = createMidiRegion(32, 96, bassNotes, 'Bassline');
  bassReg.contentLength = 16;
  bassReg.loop = true;
  bass.regions.push(bassReg);
  bass.fx.compressor = 0.4;

  const keys = createTrack('instrument', 'electric-piano', 'Electric Piano', 1);
  const keyReg = createMidiRegion(0, 128, progression(p, prog, 4, 62, 'block', 0.55), 'Chords');
  keyReg.contentLength = 16;
  keyReg.loop = true;
  keys.regions.push(keyReg);
  keys.fx.chorus = 0.4;
  keys.fx.reverb = 0.3;
  keys.volume = 0.7;

  const pad = createTrack('instrument', 'warm-pad', 'Warm Pad', 2);
  const padReg = createMidiRegion(48, 64, progression(p, prog, 4, 55, 'block', 0.5), 'Pad');
  padReg.contentLength = 16;
  padReg.loop = true;
  pad.regions.push(padReg);
  pad.volume = 0.55;
  pad.fx.reverb = 0.45;

  const arp = createTrack('instrument', 'pluck', 'Pluck', 3);
  const arpReg = createMidiRegion(64, 32, progression(p, prog, 4, 69, 'arp', 0.6), 'Arp');
  arpReg.contentLength = 16;
  arpReg.loop = true;
  arp.regions.push(arpReg);
  arp.fx.delay = 0.35;
  arp.volume = 0.6;

  const lead = createTrack('instrument', 'analog-lead', 'Analog Lead', 0);
  // A simple A-minor melody over 8 bars.
  const mel: [number, number, number][] = [
    [76, 0, 1.5], [74, 1.5, 0.5], [72, 2, 1], [71, 3, 1],
    [72, 4, 1.5], [69, 5.5, 0.5], [69, 6, 2],
    [67, 8, 1], [69, 9, 0.5], [72, 9.5, 1], [71, 10.5, 0.5], [67, 11, 1],
    [74, 12, 1.5], [72, 13.5, 0.5], [71, 14, 2],
    [76, 16, 1], [79, 17, 1], [77, 18, 1], [76, 19, 1],
    [74, 20, 1.5], [72, 21.5, 0.5], [69, 22, 2],
    [72, 24, 1], [71, 25, 1], [72, 26, 0.5], [74, 26.5, 0.5], [76, 27, 1],
    [74, 28, 1], [71, 29, 1], [69, 30, 2],
  ];
  const leadReg = createMidiRegion(80, 32, mel.map(([pt, s, d]) => note(pt, s, d * 0.95, 0.75)), 'Melody');
  lead.regions.push(leadReg);
  lead.fx.delay = 0.25;
  lead.fx.reverb = 0.3;
  lead.volume = 0.62;
  lead.automation.volume = [
    { beat: 80, value: 0.6 },
    { beat: 96, value: 0.9 },
    { beat: 110, value: 1 },
  ];

  p.tracks.push(drums, bass, keys, pad, arp, lead);
  p.masterAutomation = [
    { beat: 0, value: 0.6 },
    { beat: 16, value: 1 },
    { beat: 116, value: 1 },
    { beat: 128, value: 0 },
  ];
  p.lengthBars = 36;
  p.loop = { enabled: false, start: 32, end: 48 };
  return p;
}

// ------------------------------------------------------------------ extra demo helpers

function loopReg(start: number, length: number, notes: Note[], cycle: number, name: string) {
  const r = createMidiRegion(start, length, notes, name);
  r.contentLength = cycle;
  r.loop = length > cycle;
  return r;
}

/** Scale-degree pitch (0-based degree, may exceed 6 or be negative) in the project key. */
function deg(p: Project, d: number, octaveBase = 60): number {
  const sc = SCALES[p.key.mode];
  const o = Math.floor(d / 7);
  const i = ((d % 7) + 7) % 7;
  return octaveBase + p.key.tonic + sc[i] + 12 * o - (p.key.tonic > 6 ? 12 : 0);
}

function melody(p: Project, items: [number, number, number][], octaveBase = 72, vel = 0.75): Note[] {
  return items.map(([d, s, len]) => note(deg(p, d, octaveBase), s, len * 0.95, vel));
}

/** Diatonic seventh chord on a scale degree. */
function seventh(p: Project, d: number, octaveBase = 48): number[] {
  return [0, 2, 4, 6].map((k) => deg(p, d + k, octaveBase));
}

function buildLofi(): Project {
  const p = base('Late Night Lo-Fi', 78, 5, 'major'); // F major
  p.reverbType = 'plate';
  const drums = createTrack('drums', 'kit-lofi', 'Lo-Fi Kit', 0);
  const groove = drumPattern({
    36: 'X......x..X.....X......x..X..x..',
    38: '....X.......X.......X.......X...',
    42: 'x.xox.xox.xox.xox.xox.xox.xox.xo',
    70: '..x...x...x...x...x...x...x...x.',
  });
  drums.regions.push(loopReg(16, 96, groove, 8, 'Lazy Groove'));
  drums.fx = { ...drums.fx, filterCutoff: 0.75, drive: 0.15, compressor: 0.5 };
  drums.volume = 0.72;

  const keys = createTrack('instrument', 'electric-piano', 'Dusty Keys', 0);
  const prog = [1, 4, 0, 5]; // ii7 V7 Imaj7 vi7
  const chords: Note[] = [];
  prog.forEach((d, i) => seventh(p, d, 55).forEach((pt, j) => chords.push(note(pt, i * 4 + j * 0.05, 3.6, 0.5))));
  keys.regions.push(loopReg(0, 128, chords, 16, 'Sevenths'));
  keys.fx = { ...keys.fx, eqHigh: -6, drive: 0.25, chorus: 0.35, reverb: 0.35, filterCutoff: 0.6 };

  const bass = createTrack('instrument', 'upright-bass', 'Upright Bass', 1);
  const bl: Note[] = [];
  prog.forEach((d, i) => {
    bl.push(note(deg(p, d, 36), i * 4, 1.4, 0.85), note(deg(p, d + 4, 36), i * 4 + 1.5, 0.45, 0.7), note(deg(p, d, 36), i * 4 + 2.5, 1.2, 0.8));
  });
  bass.regions.push(loopReg(16, 96, bl, 16, 'Bass'));

  const bells = createTrack('instrument', 'music-box', 'Music Box', 2);
  bells.regions.push(
    loopReg(
      32,
      64,
      melody(p, [
        [4, 0.5, 0.5], [6, 1, 1], [5, 2, 0.5], [4, 2.5, 1.5],
        [2, 4.5, 0.5], [4, 5, 1], [3, 6, 2],
        [4, 8.5, 0.5], [7, 9, 1], [6, 10, 0.5], [4, 10.5, 1.5],
        [2, 12.5, 0.5], [1, 13, 1], [0, 14, 2],
      ], 72, 0.6),
      16,
      'Theme',
    ),
  );
  bells.fx = { ...bells.fx, reverb: 0.5, delay: 0.3, filterCutoff: 0.8 };
  bells.volume = 0.55;
  p.tracks.push(drums, keys, bass, bells);
  p.masterAutomation = [
    { beat: 0, value: 0 },
    { beat: 8, value: 1 },
    { beat: 112, value: 1 },
    { beat: 128, value: 0 },
  ];
  p.lengthBars = 34;
  return p;
}

function buildPop(): Project {
  const p = base('Pop Anthem', 120, 7, 'major'); // G major
  const prog = [0, 4, 5, 3]; // I V vi IV
  // Sections (beats): intro 0-16, verse 16-48, build 48-64, chorus 64-96, chorus2 96-128, outro 128-144
  const drums = createTrack('drums', 'kit-stark', 'Pop Kit', 0);
  const verseBeat = drumPattern({ 36: 'X.....X...X.....X.....X...X.....', 38: '........X...............X.......', 42: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' });
  const build = drumPattern({ 36: 'X...X...X...X...X...X...X...X...X.X.X.X.X.X.X.X.XXXXXXXXXXXXXXXX', 38: '................................X...X...X...X...x.x.x.x.XXXXXXXX' });
  const chorusBeat = drumPattern({ 36: 'X...X...X...X...X...X...X...X.x.', 38: '....X.......X.......X.......X...', 39: '....X.......X.......X.......X...', 46: '..x...x...x...x...x...x...x...x.' });
  const crash = drumPattern({ 49: 'X' });
  drums.regions.push(loopReg(16, 32, verseBeat, 8, 'Verse Beat'), loopReg(48, 16, build, 16, 'Build'), loopReg(64, 64, chorusBeat, 8, 'Chorus Beat'));
  drums.regions.push(createMidiRegion(64, 4, crash, 'Crash'), createMidiRegion(96, 4, crash, 'Crash'));

  const piano = createTrack('instrument', 'grand-piano', 'Grand Piano', 0);
  piano.regions.push(loopReg(0, 64, progression(p, prog, 4, 62, 'pulse', 0.6), 16, 'Piano'));
  piano.regions.push(loopReg(128, 16, progression(p, prog, 4, 62, 'block', 0.5), 16, 'Outro'));
  piano.fx.reverb = 0.25;

  const bass = createTrack('instrument', 'electric-bass', 'Electric Bass', 1);
  bass.regions.push(loopReg(16, 48, bassline(p, prog, 4, [0, 1.5, 2, 3], 36), 16, 'Verse Bass'));
  bass.regions.push(loopReg(64, 64, bassline(p, prog, 4, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 36), 16, 'Chorus Bass'));

  const synth = createTrack('instrument', 'supersaw', 'Supersaw', 2);
  synth.regions.push(loopReg(64, 64, progression(p, prog, 4, 66, 'block', 0.55), 16, 'Chorus Chords'));
  synth.volume = 0.6;
  synth.fx.reverb = 0.35;
  synth.automation.volume = [
    { beat: 48, value: 0 },
    { beat: 64, value: 0.9 },
  ];
  synth.regions.push(loopReg(48, 16, progression(p, [3, 3, 4, 4], 4, 66, 'pulse', 0.5), 16, 'Riser'));

  const lead = createTrack('instrument', 'analog-lead', 'Lead Synth', 0);
  lead.regions.push(
    loopReg(
      64,
      64,
      melody(p, [
        [4, 0, 1], [4, 1, 0.5], [5, 1.5, 0.5], [4, 2, 1], [2, 3, 1],
        [4, 4, 1], [4, 5, 0.5], [5, 5.5, 0.5], [6, 6, 1], [4, 7, 1],
        [7, 8, 1.5], [6, 9.5, 0.5], [5, 10, 1], [4, 11, 1],
        [5, 12, 1], [4, 13, 1], [3, 14, 1], [2, 15, 1],
      ], 72, 0.8),
      16,
      'Hook',
    ),
  );
  lead.fx.delay = 0.25;
  lead.volume = 0.62;

  const pad = createTrack('instrument', 'warm-pad', 'Warm Pad', 3);
  pad.regions.push(loopReg(16, 112, progression(p, prog, 4, 55, 'block', 0.45), 16, 'Pad'));
  pad.volume = 0.5;
  p.tracks.push(drums, piano, bass, synth, lead, pad);
  p.masterAutomation = [
    { beat: 124, value: 1 },
    { beat: 144, value: 0 },
  ];
  p.lengthBars = 38;
  p.loop = { enabled: false, start: 64, end: 96 };
  return p;
}

function buildCinematic(): Project {
  const p = base('Cinematic Rise', 72, 2, 'minor'); // D minor
  p.reverbType = 'cathedral';
  const prog = [0, 5, 2, 6]; // i VI III VII
  const strings = createTrack('instrument', 'string-ensemble', 'Strings', 0);
  strings.regions.push(loopReg(0, 96, progression(p, prog, 8, 57, 'block', 0.6), 32, 'Sustain'));
  strings.fx.reverb = 0.5;
  strings.automation.volume = [
    { beat: 0, value: 0.3 },
    { beat: 32, value: 0.8 },
    { beat: 64, value: 1.05 },
    { beat: 90, value: 1.05 },
    { beat: 96, value: 0 },
  ];

  const cello = createTrack('instrument', 'cello', 'Cello', 1);
  const ost: Note[] = [];
  prog.forEach((d, i) => {
    for (let s = 0; s < 16; s++) ost.push(note(deg(p, d + (s % 4 === 2 ? 4 : 0), 36) + (s % 4 === 3 ? 12 : 0), i * 8 + s * 0.5, 0.45, s % 4 === 0 ? 0.9 : 0.65));
  });
  cello.regions.push(loopReg(16, 80, ost, 32, 'Ostinato'));
  cello.fx.reverb = 0.4;

  const harp = createTrack('instrument', 'harp', 'Harp', 2);
  harp.regions.push(loopReg(0, 32, progression(p, prog.flatMap((d) => [d, d]), 4, 64, 'arp', 0.55), 32, 'Harp'));
  harp.fx.reverb = 0.45;

  const horn = createTrack('instrument', 'french-horn', 'French Horn', 0);
  horn.regions.push(
    createMidiRegion(
      32,
      64,
      melody(p, [
        [0, 0, 3], [2, 3, 1], [4, 4, 4],
        [5, 8, 3], [4, 11, 1], [2, 12, 4],
        [4, 16, 3], [6, 19, 1], [7, 20, 4],
        [6, 24, 2], [4, 26, 2], [5, 28, 4],
        [7, 32, 3], [9, 35, 1], [8, 36, 4],
        [7, 40, 3], [6, 43, 1], [4, 44, 4],
        [5, 48, 2], [4, 50, 2], [2, 52, 4],
        [1, 56, 2], [-1, 58, 2], [0, 60, 4],
      ], 60, 0.7),
      'Theme',
    ),
  );
  horn.fx.reverb = 0.45;
  horn.volume = 0.75;

  const perc = createTrack('drums', 'kit-acoustic', 'Percussion', 0);
  const boom = drumPattern({ 41: 'X.......x.x.....X.......x.x.x.x.', 49: '................................' });
  perc.regions.push(loopReg(64, 32, boom, 8, 'Toms'));
  perc.regions.push(createMidiRegion(64, 4, drumPattern({ 49: 'X' }), 'Crash'));
  perc.fx.reverb = 0.5;
  p.tracks.push(strings, cello, harp, horn, perc);
  p.lengthBars = 28;
  return p;
}

function buildSynthwave(): Project {
  const p = base('Neon Synthwave', 100, 4, 'minor'); // E minor
  const prog = [0, 5, 2, 6];
  const drums = createTrack('drums', 'kit-linn', 'Linn Drum', 0);
  drums.regions.push(
    loopReg(16, 112, drumPattern({ 36: 'X.......X.X.....X.......X.X.....', 38: '....X.......X.......X.......X...', 42: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', 48: '............................x.x.' }), 8, 'Gated Beat'),
  );
  drums.fx = { ...drums.fx, reverb: 0.35, compressor: 0.6 };

  const bass = createTrack('instrument', 'synth-bass', 'Analog Bass', 0);
  bass.regions.push(loopReg(16, 112, bassline(p, prog, 4, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 28), 16, 'Pulse Bass'));
  bass.fx.compressor = 0.5;

  const arp = createTrack('instrument', 'analog-lead', 'Arp', 1);
  const arpNotes: Note[] = [];
  const ch = diatonicChords(p.key);
  prog.forEach((d, i) => {
    const ps = chordPitches(ch[d], 64);
    const seq = [ps[0], ps[0] + 12, ps[1], ps[2], ps[0] + 12, ps[2], ps[1], ps[0] + 12];
    for (let s = 0; s < 16; s++) arpNotes.push(note(seq[s % 8], i * 4 + s * 0.25, 0.22, 0.6));
  });
  arp.regions.push(loopReg(0, 128, arpNotes, 16, 'Night Arp'));
  arp.fx = { ...arp.fx, delay: 0.35, reverb: 0.3, filterCutoff: 0.75 };
  arp.volume = 0.55;
  arp.automation.volume = [
    { beat: 0, value: 0.2 },
    { beat: 16, value: 0.9 },
  ];

  const pad = createTrack('instrument', 'warm-pad', 'Pad', 2);
  pad.regions.push(loopReg(0, 128, progression(p, prog, 4, 55, 'block', 0.5), 16, 'Pad'));
  pad.fx.chorus = 0.4;
  pad.volume = 0.5;

  const lead = createTrack('instrument', 'square-lead', 'Square Lead', 3);
  lead.regions.push(
    loopReg(
      48,
      64,
      melody(p, [
        [7, 0, 1.5], [6, 1.5, 0.5], [4, 2, 2],
        [5, 4, 1.5], [4, 5.5, 0.5], [2, 6, 2],
        [4, 8, 1], [2, 9, 1], [4, 10, 1], [6, 11, 1],
        [4, 12, 4],
        [7, 16, 1.5], [9, 17.5, 0.5], [7, 18, 2],
        [8, 20, 1.5], [7, 21.5, 0.5], [6, 22, 2],
        [4, 24, 1], [6, 25, 1], [7, 26, 1], [6, 27, 1],
        [4, 28, 4],
      ], 60, 0.75),
      32,
      'Lead',
    ),
  );
  lead.fx = { ...lead.fx, delay: 0.3, reverb: 0.3 };
  lead.volume = 0.6;
  p.tracks.push(drums, bass, arp, pad, lead);
  p.masterAutomation = [
    { beat: 112, value: 1 },
    { beat: 128, value: 0 },
  ];
  p.reverbType = 'plate';
  p.delayTime = '1/8d';
  p.lengthBars = 34;
  return p;
}
