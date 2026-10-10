// New-song templates and demo songs.
import type { Note, Project } from './types';
import { createMidiRegion, createProject, createTrack, note, uid } from './defaults';
import { chordPitches, diatonicChords } from './music';

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
