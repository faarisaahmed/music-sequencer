// Ready-made MIDI loops (generated in code, key-aware) for the Library.
import type { KeySignature, Note, TrackType } from '../../model/types';
import { createMidiRegion, createTrack, note } from '../../model/defaults';
import { SCALES, beatsPerBar, chordPitches, diatonicChords } from '../../model/music';
import { drumPattern } from '../../model/templates';
import { commit, useStore, toast } from '../../state/store';
import { growSong } from '../../state/actions';
import { getPreset } from '../../audio/presets';
import { getAudioContext, resumeAudio } from '../../audio/context';
import { createInstrument } from '../../audio/mixer';
import { getEngine } from '../../audio/engine';
import type { Instrument } from '../../audio/instruments';

export type LoopKind = 'Drums' | 'Bass' | 'Chords' | 'Arp' | 'Melody';

export interface LoopDef {
  id: string;
  name: string;
  genre: string;
  kind: LoopKind;
  instrument: string;
  bars: number;
  build: (key: KeySignature) => Note[];
}

/** Diatonic chord (triad or 7th) built by stacking scale thirds from `degree` (0-based). */
function stacked(key: KeySignature, degree: number, size: 3 | 4, center = 60): number[] {
  const steps = SCALES[key.mode];
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const idx = degree + i * 2;
    out.push(key.tonic + steps[idx % 7] + 12 * Math.floor(idx / 7));
  }
  // Move into range around center.
  const shift = Math.round((center - out[0]) / 12) * 12;
  return out.map((p) => p + shift);
}

function rootOf(key: KeySignature, degree: number, octaveBase = 36): number {
  const pc = (key.tonic + SCALES[key.mode][degree % 7]) % 12;
  return octaveBase + ((pc - (octaveBase % 12) + 12) % 12);
}

/** Major-ish pop progression degrees: in major I V vi IV, in minor i VI III VII. */
function popDegrees(key: KeySignature): number[] {
  return key.mode === 'major' ? [0, 4, 5, 3] : [0, 5, 2, 6];
}

const drums = (id: string, name: string, genre: string, instrument: string, lanes: Record<number, string>, bars = 1): LoopDef => ({
  id,
  name,
  genre,
  kind: 'Drums',
  instrument,
  bars,
  build: () => drumPattern(lanes),
});

export const LOOPS: LoopDef[] = [
  // -------------------------------------------------------------- drums
  drums('d-rock', 'Rock Steady', 'Rock', 'kit-acoustic', { 36: 'X.....x.X.......', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' }),
  drums('d-rock-fill', 'Rock Crash Groove', 'Rock', 'kit-acoustic', { 36: 'X.......X.x.....X.......X.x.....', 38: '....X.......X.......X.......X.xx', 42: '..x.x.x.x.x.x.x...x.x.x.x.x.x.x.', 49: 'X...............................' }, 2),
  drums('d-boom', 'Boom Bap', 'Hip Hop', 'kit-lofi', { 36: 'X.......X.x.....X.........x.....', 38: '....X.......X.......X.......X...', 42: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.xo' }, 2),
  drums('d-trap', 'Trap Hats', 'Trap', 'kit-808', { 36: 'X.........X.......X.....X.......', 38: '........X...............X.......', 42: 'x.x.x.x.xxx.x.x.x.x.x.xxxxx.x.x.', 46: '..............x...............x.' }, 2),
  drums('d-house', 'Four on the Floor', 'House', 'kit-909', { 36: 'X...X...X...X...', 39: '....X.......X...', 42: '..x...x...x...x.', 46: '..x...x...x...x.' }),
  drums('d-disco', 'Disco Hats', 'Disco', 'kit-909', { 36: 'X...X...X...X...', 38: '....X.......X...', 46: '..X...X...X...X.', 42: 'x.o.x.o.x.o.x.o.' }),
  drums('d-funk', 'Funky Drummer', 'Funk', 'kit-acoustic', { 36: 'X.x...x...x..x..', 38: '....X..o.o..X..o', 42: 'x.x.x.x.x.x.xxx.' }),
  drums('d-lofi', 'Lazy Lo-Fi', 'Lo-Fi', 'kit-lofi', { 36: 'X......x..X.....', 38: '....X.......X...', 42: 'x.xox.xox.xox.xo', 70: '..x...x...x...x.' }),
  drums('d-reggaeton', 'Dembow', 'Latin', 'kit-808', { 36: 'X...X...X...X...', 38: '...X..X....X..X.', 42: 'x.x.x.x.x.x.x.x.' }),
  drums('d-half', 'Half-Time Groove', 'Pop', 'kit-stark', { 36: 'X.....X...X.....', 38: '........X.......', 42: 'x.x.x.x.x.x.x.x.', 39: '........X.......' }),
  drums('d-break', 'Amen-ish Break', 'Breakbeat', 'kit-acoustic', { 36: 'X.X.......XX....X.X.......X.....', 38: '....X..x.x..X..x....X..x.x..X..x', 42: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' }, 2),
  drums('d-shuffle', 'Swing Ride', 'Jazz', 'kit-acoustic', { 51: 'x..x.xx..x.xx..x', 44: '....x.......x...', 36: 'o.......o.......' }),
  drums('d-afro', 'Afrobeat Perc', 'World', 'kit-bongos', { 36: 'X..x..X...X..x..', 38: '..x....x..x....x', 42: 'x.xxx.xxx.xxx.xx', 56: 'x..x..x...x.x...' }),
  drums('d-synthwave', 'Gated 80s', 'Synthwave', 'kit-linn', { 36: 'X.......X.X.....', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.', 49: 'X...............' }),

  // -------------------------------------------------------------- bass
  {
    id: 'b-root8',
    name: 'Driving Eighths',
    genre: 'Rock',
    kind: 'Bass',
    instrument: 'electric-bass',
    bars: 4,
    build: (k) => popDegrees(k).flatMap((d, i) => Array.from({ length: 8 }, (_, s) => note(rootOf(k, d), i * 4 + s * 0.5, 0.45, s % 2 ? 0.7 : 0.9))),
  },
  {
    id: 'b-octave',
    name: 'Disco Octaves',
    genre: 'Disco',
    kind: 'Bass',
    instrument: 'synth-bass',
    bars: 4,
    build: (k) => popDegrees(k).flatMap((d, i) => Array.from({ length: 8 }, (_, s) => note(rootOf(k, d) + (s % 2 ? 12 : 0), i * 4 + s * 0.5, 0.4, 0.85))),
  },
  {
    id: 'b-funk',
    name: 'Funk Slap',
    genre: 'Funk',
    kind: 'Bass',
    instrument: 'electric-bass',
    bars: 2,
    build: (k) => {
      const r = rootOf(k, 0);
      const s7 = rootOf(k, 6) - 12;
      const pat: [number, number, number][] = [
        [r, 0, 0.3], [r + 12, 0.75, 0.2], [r, 1.5, 0.25], [s7 + 12, 2, 0.4], [r, 2.75, 0.2], [r + 12, 3.5, 0.3],
        [r, 4, 0.3], [r + 7, 4.75, 0.2], [r + 12, 5.5, 0.25], [r, 6, 0.3], [rootOf(k, 4), 6.75, 0.3], [rootOf(k, 3), 7.5, 0.4],
      ];
      return pat.map(([p, s, d]) => note(p, s, d, 0.88));
    },
  },
  {
    id: 'b-808',
    name: '808 Glide',
    genre: 'Trap',
    kind: 'Bass',
    instrument: 'sub-808',
    bars: 4,
    build: (k) => {
      const d = popDegrees(k);
      return d.flatMap((deg, i) => [note(rootOf(k, deg, 24), i * 4, 1.5, 1), note(rootOf(k, deg, 24), i * 4 + 2.5, 0.5, 0.8), note(rootOf(k, deg, 24) + 12, i * 4 + 3, 0.75, 0.85)]);
    },
  },
  {
    id: 'b-walk',
    name: 'Walking Bass',
    genre: 'Jazz',
    kind: 'Bass',
    instrument: 'upright-bass',
    bars: 4,
    build: (k) => {
      const degs = [1, 4, 0, 0];
      const out: Note[] = [];
      degs.forEach((d, i) => {
        const r = rootOf(k, d);
        const line = [r, r + (k.mode === 'major' ? 4 : 3), r + 7, r + 9 - (i === 3 ? 0 : 1)];
        line.forEach((p, s) => out.push(note(p, i * 4 + s, 0.9, s === 0 ? 0.9 : 0.75)));
      });
      return out;
    },
  },
  {
    id: 'b-house',
    name: 'Offbeat House',
    genre: 'House',
    kind: 'Bass',
    instrument: 'synth-bass',
    bars: 4,
    build: (k) => popDegrees(k).flatMap((d, i) => [0.5, 1.5, 2.5, 3.5].map((o) => note(rootOf(k, d), i * 4 + o, 0.35, 0.9))),
  },

  // -------------------------------------------------------------- chords
  {
    id: 'c-pop',
    name: 'Pop Progression',
    genre: 'Pop',
    kind: 'Chords',
    instrument: 'grand-piano',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      return popDegrees(k).flatMap((d, i) => chordPitches(ch[d], 62).map((p) => note(p, i * 4, 3.9, 0.7)));
    },
  },
  {
    id: 'c-pulse',
    name: 'Pulsing Piano',
    genre: 'Pop',
    kind: 'Chords',
    instrument: 'bright-piano',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      return popDegrees(k).flatMap((d, i) =>
        Array.from({ length: 8 }, (_, s) => chordPitches(ch[d], 62).map((p) => note(p, i * 4 + s * 0.5, 0.45, s % 2 ? 0.55 : 0.75))).flat(),
      );
    },
  },
  {
    id: 'c-lofi',
    name: 'Lo-Fi Sevenths',
    genre: 'Lo-Fi',
    kind: 'Chords',
    instrument: 'electric-piano',
    bars: 4,
    build: (k) => [1, 4, 0, 5].flatMap((d, i) => stacked(k, d, 4, 58).map((p, j) => note(p, i * 4 + j * 0.04, 3.7, 0.55))),
  },
  {
    id: 'c-jazz',
    name: 'ii–V–I Comping',
    genre: 'Jazz',
    kind: 'Chords',
    instrument: 'electric-piano',
    bars: 4,
    build: (k) => {
      const out: Note[] = [];
      [1, 4, 0, 0].forEach((d, i) => {
        for (const o of [0, 1.5, 2.5]) for (const p of stacked(k, d, 4, 58)) out.push(note(p, i * 4 + o, o === 0 ? 0.9 : 0.4, 0.6));
      });
      return out;
    },
  },
  {
    id: 'c-pad',
    name: 'Cinematic Pad',
    genre: 'Cinematic',
    kind: 'Chords',
    instrument: 'string-ensemble',
    bars: 8,
    build: (k) => {
      const ch = diatonicChords(k);
      const prog = k.mode === 'major' ? [0, 5, 3, 4] : [0, 5, 3, 6];
      return prog.flatMap((d, i) => [...chordPitches(ch[d], 60), rootOf(k, d, 36)].map((p) => note(p, i * 8, 7.9, 0.6)));
    },
  },
  {
    id: 'c-organ',
    name: 'Gospel Organ',
    genre: 'Soul',
    kind: 'Chords',
    instrument: 'organ',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      return [0, 3, 0, 4].flatMap((d, i) => chordPitches(ch[d], 64).flatMap((p) => [note(p, i * 4, 1.4, 0.7), note(p, i * 4 + 1.5, 2.4, 0.65)]));
    },
  },
  {
    id: 'c-guitar',
    name: 'Strummed Guitar',
    genre: 'Acoustic',
    kind: 'Chords',
    instrument: 'acoustic-guitar',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      const strums = [0, 1, 1.5, 2.5, 3, 3.5];
      return popDegrees(k).flatMap((d, i) => {
        const ps = [rootOf(k, d, 40), ...chordPitches(ch[d], 58)];
        return strums.flatMap((o, si) => ps.map((p, j) => note(p, i * 4 + o + (si % 2 ? (ps.length - j) : j) * 0.015, 0.45, si % 2 ? 0.5 : 0.75)));
      });
    },
  },

  // -------------------------------------------------------------- arps & melody
  {
    id: 'a-up',
    name: 'Rising Arp',
    genre: 'Electronic',
    kind: 'Arp',
    instrument: 'pluck',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      return popDegrees(k).flatMap((d, i) => {
        const ps = chordPitches(ch[d], 67);
        const seq = [ps[0], ps[1], ps[2], ps[0] + 12];
        return Array.from({ length: 16 }, (_, s) => note(seq[s % 4], i * 4 + s * 0.25, 0.22, s % 4 === 0 ? 0.85 : 0.6));
      });
    },
  },
  {
    id: 'a-trance',
    name: 'Trance Gate',
    genre: 'Electronic',
    kind: 'Arp',
    instrument: 'supersaw',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      const gate = 'x.xx.xx.x.xx.x.x';
      return popDegrees(k).flatMap((d, i) =>
        [...gate].flatMap((g, s) => (g === 'x' ? chordPitches(ch[d], 64).map((p) => note(p, i * 4 + s * 0.25, 0.2, 0.7)) : [])),
      );
    },
  },
  {
    id: 'a-synthwave',
    name: 'Night Drive Arp',
    genre: 'Synthwave',
    kind: 'Arp',
    instrument: 'analog-lead',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      return popDegrees(k).flatMap((d, i) => {
        const ps = chordPitches(ch[d], 60);
        const seq = [ps[0], ps[0] + 12, ps[1], ps[2], ps[0] + 12, ps[2], ps[1], ps[0] + 12];
        return Array.from({ length: 16 }, (_, s) => note(seq[s % 8], i * 4 + s * 0.25, 0.22, 0.65));
      });
    },
  },
  {
    id: 'a-harp',
    name: 'Harp Cascade',
    genre: 'Cinematic',
    kind: 'Arp',
    instrument: 'harp',
    bars: 4,
    build: (k) => {
      const ch = diatonicChords(k);
      return popDegrees(k).flatMap((d, i) => {
        const ps = chordPitches(ch[d], 60);
        const seq = [ps[0] - 12, ps[0], ps[1], ps[2], ps[0] + 12, ps[1] + 12, ps[2] + 12, ps[0] + 24];
        return seq.map((p, s) => note(p, i * 4 + s * 0.5, 1.5, 0.6));
      });
    },
  },
  {
    id: 'm-penta',
    name: 'Pentatonic Hook',
    genre: 'Pop',
    kind: 'Melody',
    instrument: 'square-lead',
    bars: 2,
    build: (k) => {
      const pent = k.mode === 'major' ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
      const base = 72 + k.tonic - (k.tonic > 5 ? 12 : 0);
      const idx: [number, number, number][] = [
        [2, 0, 0.5], [3, 0.5, 0.5], [4, 1, 1], [3, 2, 0.5], [2, 2.5, 0.5], [1, 3, 1],
        [0, 4, 0.75], [1, 4.75, 0.25], [2, 5, 1], [4, 6, 0.5], [3, 6.5, 1.5],
      ];
      return idx.map(([i, s, d]) => note(base + pent[i], s, d * 0.95, 0.75));
    },
  },
  {
    id: 'm-bells',
    name: 'Music Box Theme',
    genre: 'Cinematic',
    kind: 'Melody',
    instrument: 'music-box',
    bars: 4,
    build: (k) => {
      const sc = SCALES[k.mode];
      const base = 72 + k.tonic - (k.tonic > 5 ? 12 : 0);
      const deg = [4, 2, 0, 2, 4, 4, 4, 3, 1, 1, 3, 2, 0, 1, 2, 0];
      return deg.map((d, i) => note(base + sc[d], i, 0.9, 0.7));
    },
  },
];

export const LOOP_KINDS: LoopKind[] = ['Drums', 'Bass', 'Chords', 'Arp', 'Melody'];

/** Add a loop to the song: on a fitting track (selected or new) at `beat` (default: cursor). */
export function addLoopToSong(loopId: string, beat?: number, trackId?: string): void {
  const s = useStore.getState();
  const p = s.project;
  const loop = LOOPS.find((l) => l.id === loopId);
  if (!p || !loop) return;
  const bpb = beatsPerBar(p.timeSig);
  const at = Math.max(0, Math.floor((beat ?? s.cursor) / bpb + 1e-6) * bpb);
  const type: TrackType = loop.kind === 'Drums' ? 'drums' : 'instrument';
  let target = p.tracks.find((t) => t.id === (trackId ?? s.selectedTrackId));
  if (!target || target.type !== type || (type === 'instrument' && target.instrument !== loop.instrument && !trackId)) {
    target = p.tracks.find((t) => t.type === type && t.instrument === loop.instrument);
  }
  const notes = loop.build(p.key);
  const len = loop.bars * 4;
  const region = createMidiRegion(at, Math.max(len, bpb * 4), notes, loop.name);
  region.contentLength = len;
  region.loop = true;
  let newTrackId: string | null = null;
  commit((d) => {
    let t = target ? d.tracks.find((x) => x.id === target!.id) : undefined;
    if (!t) {
      const nt = createTrack(type, loop.instrument, getPreset(loop.instrument).name, d.tracks.filter((x) => x.type === type).length);
      d.tracks.push(nt);
      t = d.tracks[d.tracks.length - 1];
      newTrackId = nt.id;
    }
    t.regions.push(region);
    growSong(d, region.start + region.length);
  });
  useStore.setState({ selectedTrackId: newTrackId ?? target?.id ?? s.selectedTrackId, selectedRegionIds: [region.id] });
  toast(`Added “${loop.name}”`, 'success');
}

// ------------------------------------------------------------------ audition

let previewInst: Instrument | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

export function stopLoopPreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  if (previewInst) {
    const inst = previewInst;
    inst.allNotesOff(getAudioContext().currentTime);
    setTimeout(() => inst.dispose(), 500);
    previewInst = null;
  }
}

/** Play one cycle of a loop (no track needed). Resolves to the duration in ms. */
export async function previewLoop(loopId: string): Promise<number> {
  stopLoopPreview();
  const p = useStore.getState().project;
  const loop = LOOPS.find((l) => l.id === loopId);
  if (!p || !loop) return 0;
  const ctx = await resumeAudio();
  const fake = createTrack(loop.kind === 'Drums' ? 'drums' : 'instrument', loop.instrument, 'preview');
  const inst = createInstrument(ctx, fake);
  if (!inst) return 0;
  previewInst = inst;
  inst.output.connect(getEngine().mixer.masterIn);
  await inst.ready;
  if (previewInst !== inst) return 0;
  const spb = 60 / p.bpm;
  const t0 = ctx.currentTime + 0.08;
  for (const n of loop.build(p.key)) inst.playNote(n.pitch, n.velocity, t0 + n.start * spb, n.duration * spb);
  const ms = loop.bars * 4 * spb * 1000 + 300;
  previewTimer = setTimeout(stopLoopPreview, ms);
  return ms;
}
