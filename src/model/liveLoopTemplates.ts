// Starter Live Loops grids (GarageBand-style): a set of tracks with loops arranged in scenes.
import type { DrumStyle, StyleId } from './accompaniment';
import { generateDrums, generateMelody, generatePart, layChords, parseProgression } from './accompaniment';
import type { LiveCell, MidiRegion, Note, Project, Track } from './types';
import { createProject, createTrack, uid } from './defaults';
import { beatsPerBar } from './music';
import { getPreset } from '../audio/presets';

interface PartSpec {
  instrument: string;
  type: 'drums' | 'instrument';
  name?: string;
  /** How this row makes its loop in each scene (null = empty cell). */
  scenes: (null | { style: StyleId | 'drums' | 'melody'; bars: number; energy: number; drums?: DrumStyle; fill?: boolean })[];
}

interface GridSpec {
  name: string;
  bpm: number;
  tonic: number;
  mode: 'major' | 'minor';
  progression: string;
  /** Alternate progression used by "B" scenes. */
  progressionB: string;
  sceneNames: string[];
  /** Which scenes use progression B. */
  bScenes: number[];
  parts: PartSpec[];
}

function region(name: string, len: number, notes: Note[]): MidiRegion {
  return { id: uid('r'), kind: 'midi', name, start: 0, length: len, offset: 0, loop: false, contentLength: len, notes: notes.filter((n) => n.start < len).map((n) => ({ ...n, duration: Math.min(n.duration, len - n.start) })) };
}

function buildGrid(spec: GridSpec): Project {
  const p = createProject(spec.name);
  p.bpm = spec.bpm;
  p.key = { tonic: spec.tonic, mode: spec.mode };
  const bpb = beatsPerBar(p.timeSig);
  const cells: LiveCell[] = [];
  const tracks: Track[] = [];
  spec.parts.forEach((part, i) => {
    const preset = getPreset(part.instrument);
    const t = createTrack(part.type, part.instrument, part.name ?? preset.name, i);
    if (part.type === 'instrument' && /pad|pluck|lead|arp/.test(part.instrument)) t.fx.reverb = 0.3;
    if (/pluck|lead/.test(part.instrument)) t.fx.delay = 0.22;
    tracks.push(t);
    part.scenes.forEach((sc, scene) => {
      if (!sc) return;
      const len = sc.bars * bpb;
      const prog = parseProgression(spec.bScenes.includes(scene) ? spec.progressionB : spec.progression, p.key);
      const chords = layChords(prog, 0, len, Math.max(bpb, len / Math.max(1, prog.length)));
      const range = preset.range ?? [36, 84];
      const seed = 11 + i * 31 + scene * 7;
      let notes: Note[];
      if (sc.style === 'drums') notes = generateDrums(sc.drums ?? 'hiphop', 0, sc.bars, p.timeSig, sc.energy, seed, { fillAtEnd: sc.fill });
      else if (sc.style === 'melody') notes = generateMelody({ chords, start: 0, end: len, timeSig: p.timeSig, key: p.key, range: [Math.max(range[0], 60), Math.min(range[1], 84)], energy: sc.energy, seed });
      else notes = generatePart(sc.style, { chords, start: 0, end: len, timeSig: p.timeSig, key: p.key, range: [range[0], range[1]], energy: sc.energy, seed });
      cells.push({ id: uid('l'), trackId: t.id, scene, region: region(`${t.name} ${spec.sceneNames[scene]}`, len, notes) });
    });
  });
  p.tracks = tracks;
  p.liveLoops = { scenes: spec.sceneNames.map((n) => ({ id: uid('s'), name: n })), cells, quantize: bpb };
  p.chords = layChords(parseProgression(spec.progression, p.key), 0, 16, bpb);
  return p;
}

export function buildHipHopGrid(): Project {
  return buildGrid({
    name: 'Live Loops: Hip Hop',
    bpm: 88,
    tonic: 2,
    mode: 'minor',
    progression: 'i7 iv7 VImaj7 V7',
    progressionB: 'VI VII i i',
    sceneNames: ['Intro', 'Beat', 'Verse', 'Hook', 'Break', 'Outro'],
    bScenes: [3, 4],
    parts: [
      {
        instrument: 'kit-808',
        type: 'drums',
        name: 'Drums',
        scenes: [null, { style: 'drums', bars: 2, energy: 0.5, drums: 'hiphop' }, { style: 'drums', bars: 2, energy: 0.6, drums: 'hiphop', fill: true }, { style: 'drums', bars: 2, energy: 1, drums: 'trap' }, { style: 'drums', bars: 2, energy: 0.1, drums: 'hiphop' }, null],
      },
      {
        instrument: 'sub-808',
        type: 'instrument',
        name: '808 Bass',
        scenes: [null, null, { style: 'bass-root', bars: 4, energy: 0.5 }, { style: 'bass-rootfifth', bars: 4, energy: 0.8 }, null, null],
      },
      {
        instrument: 'electric-piano',
        type: 'instrument',
        name: 'Keys',
        scenes: [{ style: 'piano-block', bars: 4, energy: 0.3 }, { style: 'piano-block', bars: 4, energy: 0.4 }, { style: 'piano-pop', bars: 4, energy: 0.5 }, { style: 'piano-pop', bars: 4, energy: 0.8 }, { style: 'piano-ballad', bars: 4, energy: 0.4 }, { style: 'piano-block', bars: 4, energy: 0.2 }],
      },
      {
        instrument: 'warm-pad',
        type: 'instrument',
        name: 'Pad',
        scenes: [{ style: 'pad', bars: 4, energy: 0.3 }, null, null, { style: 'strings-pad', bars: 4, energy: 0.6 }, { style: 'pad', bars: 4, energy: 0.4 }, { style: 'pad', bars: 4, energy: 0.2 }],
      },
      {
        instrument: 'pluck',
        type: 'instrument',
        name: 'Lead',
        scenes: [null, null, { style: 'melody', bars: 4, energy: 0.4 }, { style: 'melody', bars: 4, energy: 0.8 }, { style: 'synth-arp', bars: 4, energy: 0.5 }, null],
      },
    ],
  });
}

export function buildEdmGrid(): Project {
  return buildGrid({
    name: 'Live Loops: EDM',
    bpm: 124,
    tonic: 9,
    mode: 'minor',
    progression: 'i VI III VII',
    progressionB: 'VI VII i i',
    sceneNames: ['Intro', 'Groove', 'Build', 'Drop', 'Breakdown', 'Drop 2'],
    bScenes: [4],
    parts: [
      {
        instrument: 'kit-909',
        type: 'drums',
        name: 'Drums',
        scenes: [{ style: 'drums', bars: 2, energy: 0.1, drums: 'house' }, { style: 'drums', bars: 2, energy: 0.6, drums: 'house' }, { style: 'drums', bars: 2, energy: 0.5, drums: 'synthwave', fill: true }, { style: 'drums', bars: 2, energy: 1, drums: 'house' }, null, { style: 'drums', bars: 2, energy: 1, drums: 'house', fill: true }],
      },
      {
        instrument: 'synth-bass',
        type: 'instrument',
        name: 'Bass',
        scenes: [null, { style: 'bass-pulse', bars: 4, energy: 0.5 }, { style: 'bass-root', bars: 4, energy: 0.6 }, { style: 'bass-octave', bars: 4, energy: 1 }, null, { style: 'bass-pulse', bars: 4, energy: 1 }],
      },
      {
        instrument: 'supersaw',
        type: 'instrument',
        name: 'Chords',
        scenes: [null, null, { style: 'piano-block', bars: 4, energy: 0.5 }, { style: 'piano-pop', bars: 4, energy: 1 }, { style: 'strings-pad', bars: 4, energy: 0.4 }, { style: 'piano-pop', bars: 4, energy: 1 }],
      },
      {
        instrument: 'pluck',
        type: 'instrument',
        name: 'Arp',
        scenes: [{ style: 'synth-arp', bars: 4, energy: 0.3 }, { style: 'synth-arp', bars: 4, energy: 0.5 }, { style: 'synth-arp', bars: 4, energy: 0.8 }, null, { style: 'synth-arp', bars: 4, energy: 0.4 }, { style: 'synth-arp', bars: 4, energy: 0.9 }],
      },
      {
        instrument: 'dream-pad',
        type: 'instrument',
        name: 'Pad',
        scenes: [{ style: 'pad', bars: 4, energy: 0.3 }, null, { style: 'pad', bars: 4, energy: 0.5 }, null, { style: 'pad', bars: 4, energy: 0.6 }, null],
      },
      {
        instrument: 'analog-lead',
        type: 'instrument',
        name: 'Lead',
        scenes: [null, null, null, { style: 'melody', bars: 4, energy: 0.9 }, { style: 'melody', bars: 4, energy: 0.4 }, { style: 'melody', bars: 4, energy: 1 }],
      },
    ],
  });
}
