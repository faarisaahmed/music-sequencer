// Sheet-music editor (MuseScore / Flat style) over the same MIDI notes the piano roll edits.
// Works on one region, or on the whole song as a full multi-instrument score.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToolbarSlot } from './useToolbarSlot';
import { MousePointer2, PenLine, Plus, Minus, Printer, FileDown, ZoomIn, ZoomOut, ArrowUp, ArrowDown, Type, Hash, Eraser } from 'lucide-react';
import type { Articulation, MidiRegion, Note, Project, Track } from '../../model/types';
import { beginGesture, endGesture, findRegion, live, useStore, useTransport, toast } from '../../state/store';
import { beatsPerBar, noteName } from '../../model/music';
import { placedNotes } from '../../model/regions';
import { getPreset } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import { download, safeFileName } from '../../audio/export';
import { isTyping, startDrag } from '../common/drag';
import {
  abbreviate,
  buildScore,
  diatonicShift,
  drumAtPosition,
  notationFor,
  pitchFromDiatonic,
  staffForWritten,
  transposeKey,
  DYNAMICS,
  type ClefMode,
  type DisplayMark,
  type PartInput,
  type RawNote,
  type ScoreModel,
} from './score/notation';
import { beatToX, renderScore, topLineDiatonic, xToBeat, type ChordLabel, type HeadHit, type ScoreLayout } from './score/render';
import {
  addBars,
  addDynamic,
  addHairpin,
  clearMarks,
  deleteNotes,
  insertNote,
  insertRest,
  mapNotes,
  pasteNotes,
  setDuration,
  setLyric,
  setVoice,
  tieNotes,
  toggleArticulation,
  viewOf,
  type Placement,
} from './score/edits';
import { chordAt, chordName, setChordAt } from './score/chords';
import { toMusicXml } from './score/musicxml';
import './score.css';

const DURATIONS: { v: number; key: string; label: string }[] = [
  { v: 0.125, key: '2', label: '32nd' },
  { v: 0.25, key: '3', label: '16th' },
  { v: 0.5, key: '4', label: 'Eighth' },
  { v: 1, key: '5', label: 'Quarter' },
  { v: 2, key: '6', label: 'Half' },
  { v: 4, key: '7', label: 'Whole' },
];

const ARTICS: { a: Articulation; glyph: string; label: string; key: string }[] = [
  { a: 'staccato', glyph: '•', label: 'Staccato', key: '⇧S' },
  { a: 'tenuto', glyph: '–', label: 'Tenuto', key: '⇧N' },
  { a: 'accent', glyph: '>', label: 'Accent', key: '⇧V' },
  { a: 'marcato', glyph: '^', label: 'Marcato', key: '⇧O' },
  { a: 'fermata', glyph: '𝄐', label: 'Fermata', key: 'palette' },
];

function NoteIcon({ v }: { v: number }) {
  const hollow = v >= 2;
  const stem = v < 4;
  const flags = v === 0.5 ? 1 : v === 0.25 ? 2 : v === 0.125 ? 3 : 0;
  return (
    <svg width="16" height="22" viewBox="0 0 16 22">
      <ellipse cx="6" cy="17" rx="4.6" ry="3.3" transform="rotate(-22 6 17)" fill={hollow ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={hollow ? 1.6 : 0} />
      {stem && <line x1="10.2" y1="16" x2="10.2" y2="2" stroke="currentColor" strokeWidth="1.4" />}
      {Array.from({ length: flags }, (_, i) => (
        <path key={i} d={`M10.2 ${2 + i * 4} q 5 3 4 8`} stroke="currentColor" strokeWidth="1.4" fill="none" />
      ))}
    </svg>
  );
}

let noteClipboard: Note[] = [];

// Dev/test hook for driving the editor from automated screenshots.
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;

interface Ghost {
  x: number;
  y: number;
  ledger: number[];
  label: string;
}

interface PartMeta {
  track: Track;
  placement: Placement;
  transpose: number;
  writtenKey: Project['key'];
  drums: boolean;
}

interface Source {
  model: ScoreModel;
  parts: PartMeta[];
  firstBar: number;
  chords: ChordLabel[];
  toAbs: (t: number) => number;
  fromAbs: (abs: number) => number | null;
  region?: MidiRegion;
  labels: string[];
  regionIds: string[];
}

function rawFromNote(n: Note, regionId: string, s: number, e: number, key: string): RawNote {
  return { id: n.id, key, regionId, pitch: n.pitch, s, e, vel: n.velocity, voice: n.voice, artic: n.artic, lyric: n.lyric };
}

/** Build the notation source for a single region or the whole song. */
function buildSource(project: Project, full: boolean, regionId: string | undefined, grid: number, clefMode: ClefMode, concert: boolean): Source | null {
  const bpb = beatsPerBar(project.timeSig);
  const mkPart = (track: Track, raw: RawNote[], marks: DisplayMark[], mode: ClefMode, placementBase: Omit<Placement, 'staffOf'>) => {
    const drums = track.type === 'drums';
    const preset = getPreset(track.instrument);
    const nt = notationFor(track.instrument, drums, raw.map((n) => n.pitch), mode, concert, preset.range);
    const writtenKey = transposeKey(project.key, nt.transpose);
    const staffOf = (p: number) => (drums ? 0 : staffForWritten(p + nt.transpose, nt.clefs));
    const input: PartInput = {
      id: track.id,
      trackId: track.id,
      name: track.name,
      abbr: abbreviate(track.name),
      clefs: nt.clefs,
      transpose: nt.transpose,
      writtenKey,
      drums,
      notes: raw,
      marks,
    };
    const meta: PartMeta = { track, placement: { ...placementBase, staffOf }, transpose: nt.transpose, writtenKey, drums };
    return { input, meta, label: track.name + (nt.transLabel ? ` ${nt.transLabel}` : '') };
  };

  if (!full) {
    const found = findRegion(project, regionId ?? null);
    if (!found || found.region.kind !== 'midi') return null;
    const region = found.region;
    const track = found.track;
    const { viewStart, viewLen } = viewOf(region);
    const raw: RawNote[] = [];
    for (const n of region.notes) {
      const t = n.start - viewStart;
      if (t < -1e-6 || t >= viewLen - 1e-6) continue;
      raw.push(rawFromNote(n, region.id, t, t + n.duration, n.id));
    }
    const marks: DisplayMark[] = (region.marks ?? []).map((m) => ({ kind: m.kind, t: m.beat - viewStart, end: m.end !== undefined ? m.end - viewStart : undefined, value: m.value, staff: m.staff ?? 0, id: m.id, regionId: region.id }));
    const p = mkPart(track, raw, marks, clefMode, { mode: 'region', trackId: track.id, regionId: region.id });
    const toAbs = (t: number) => region.start + t - (region.loop ? region.offset : 0);
    const fromAbs = (a: number) => a - region.start + (region.loop ? region.offset : 0);
    const chords: ChordLabel[] = (project.chords ?? [])
      .map((c) => ({ t: fromAbs(c.beat), name: chordName(c, p.meta.writtenKey) }))
      .filter((c) => c.t >= -1e-6 && c.t < viewLen + bpb);
    const model = buildScore([p.input], bpb, viewLen, 1, grid);
    return {
      model,
      parts: [p.meta],
      firstBar: Math.floor(region.start / bpb + 1e-6) + 1,
      chords,
      toAbs,
      fromAbs: (a) => {
        const rel = a - region.start;
        if (rel < 0 || rel >= region.length) return null;
        return region.loop ? (((rel + region.offset) % region.contentLength) + region.contentLength) % region.contentLength : rel;
      },
      region,
      labels: [p.label],
      regionIds: [region.id],
    };
  }

  const tracks = project.tracks.filter((t) => t.type !== 'audio');
  if (!tracks.length) return null;
  let total = 4 * bpb;
  const built = tracks.map((track) => {
    const raw: RawNote[] = [];
    const marks: DisplayMark[] = [];
    for (const r of track.regions) {
      if (r.kind !== 'midi' || r.muted) continue;
      total = Math.max(total, r.start + r.length);
      for (const pn of placedNotes(r)) raw.push(rawFromNote(pn.note, r.id, pn.start, pn.start + pn.duration, `${pn.note.id}@${pn.iteration}`));
      for (const m of r.marks ?? []) {
        const iters = r.loop ? Math.ceil((r.offset + r.length) / r.contentLength) + 1 : 1;
        for (let k = 0; k < iters; k++) {
          const base = r.start - r.offset + k * (r.loop ? r.contentLength : 0);
          const t = base + m.beat;
          if (t < r.start - 1e-6 || t >= r.start + r.length) continue;
          marks.push({ kind: m.kind, t, end: m.end !== undefined ? Math.min(base + m.end, r.start + r.length) : undefined, value: m.value, staff: m.staff ?? 0, id: m.id, regionId: r.id });
        }
      }
    }
    return mkPart(track, raw, marks, 'auto', { mode: 'song', trackId: track.id });
  });
  const model = buildScore(
    built.map((b) => b.input),
    bpb,
    total,
    1,
    grid,
  );
  return {
    model,
    parts: built.map((b) => b.meta),
    firstBar: 1,
    chords: (project.chords ?? []).map((c) => ({ t: c.beat, name: chordName(c, project.key) })),
    toAbs: (t) => t,
    fromAbs: (a) => a,
    labels: built.map((b) => b.label),
    regionIds: tracks.flatMap((t) => t.regions.map((r) => r.id)),
  };
}

interface TextEntry {
  kind: 'lyric' | 'chord';
  x: number;
  y: number;
  value: string;
  noteId?: string;
  staff?: number;
  t?: number; // display beat (chords)
}

export default function ScoreEditor({ regionId, full = false }: { trackId?: string; regionId?: string; full?: boolean }) {
  const project = useStore((s) => s.project)!;
  const selectedIds = useStore((s) => s.selectedNoteIds);

  const [mode, setMode] = useState<'select' | 'input'>(full ? 'select' : 'input');
  const [dur, setDur] = useState(1);
  const [dotted, setDotted] = useState(false);
  const [triplet, setTriplet] = useState(false);
  const [voice, setVoiceNo] = useState<1 | 2>(1);
  const [acc, setAcc] = useState<number | null>(null);
  const [dyn, setDyn] = useState('mf');
  const [grid, setGrid] = useState(0.25);
  const [clefMode, setClefMode] = useState<ClefMode>('auto');
  const [concert, setConcert] = useState(false);
  const [zoom, setZoom] = useState(full ? 0.85 : 1);
  const [showDyn, setShowDyn] = useState(true);
  const [cursor, setCursor] = useState<{ t: number; staff: number }>({ t: 0, staff: 0 });
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [width, setWidth] = useState(900);
  const [layout, setLayout] = useState<ScoreLayout | null>(null);
  const slot = useToolbarSlot();
  const [entry, setEntry] = useState<TextEntry | null>(null);
  const entryRef = useRef<TextEntry | null>(null);
  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const lastInsert = useRef<{ t: number; dur: number; pitch: number; staff: number } | null>(null);

  const effDur = dur * (dotted ? 1.5 : 1) * (triplet ? 2 / 3 : 1);
  const bpb = beatsPerBar(project.timeSig);
  const velocity = DYNAMICS.find((d) => d.mark === dyn)?.vel ?? 0.64;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(500, el.clientWidth - 48)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = useMemo(() => buildSource(project, full, regionId, grid, clefMode, concert), [project, full, regionId, grid, clefMode, concert]);
  const model = src?.model ?? null;
  const partKeys = useMemo(() => src?.parts.map((p) => p.writtenKey) ?? [], [src]);

  useLayoutEffect(() => {
    if (!src || !svgRef.current) return;
    try {
      const l = renderScore(svgRef.current, src.model, width, zoom, {
        partKeys,
        timeSig: project.timeSig,
        firstBarNumber: src.firstBar,
        showDynamics: showDyn,
        showNames: full,
        title: full ? project.name : undefined,
        tempo: full ? project.bpm : undefined,
        chords: src.chords,
        partLabels: src.labels,
      });
      setLayout(l);
      if (import.meta.env.DEV) (window as unknown as { __scoreLayout: ScoreLayout }).__scoreLayout = l;
    } catch (e) {
      console.error('score render failed', e);
    }
  }, [src, partKeys, width, zoom, project.timeSig, project.name, project.bpm, showDyn, full]);

  const staffRef = (gi: number) => model?.staves[Math.max(0, Math.min(model.staves.length - 1, gi))];
  const partOfStaff = (gi: number) => (model && src ? src.parts[staffRef(gi)!.part] : undefined);

  // ------------------------------------------------------------ geometry helpers

  const locate = useCallback(
    (clientX: number, clientY: number, strict: boolean) => {
      const el = svgRef.current;
      if (!el || !layout || !model) return null;
      const rect = el.getBoundingClientRect();
      const lx = (clientX - rect.left) / zoom;
      const ly = (clientY - rect.top) / zoom;
      let best: { si: number; st: number; d: number } | null = null;
      layout.systems.forEach((sys, si) =>
        sys.staves.forEach((sg, st) => {
          const center = sg.topLineY + sg.spacing * 2;
          const d = Math.abs(ly - center);
          if (!best || d < best.d) best = { si, st, d };
        }),
      );
      if (!best) return null;
      const b = best as { si: number; st: number; d: number };
      const sys = layout.systems[b.si];
      const sg = sys.staves[b.st];
      const step = Math.round((ly - sg.topLineY) / (sg.spacing / 2));
      // Ignore clicks beyond ~5 ledger lines above/below the staff.
      if (strict && (step < -11 || step > 19)) return null;
      if (b.d > 120) return null;
      const mg = sys.measures.find((m) => lx >= m.x && lx < m.x + m.w) ?? (lx < sys.measures[0].x ? sys.measures[0] : sys.measures[sys.measures.length - 1]);
      const dIdx = topLineDiatonic(sg.clef) - step;
      const tm = xToBeat(mg, lx, bpb);
      return { lx, ly, sys, sg, staff: sg.index, mg, step, dIdx, tm };
    },
    [layout, model, zoom, bpb],
  );

  const snapInput = (tm: number) => {
    const g = triplet ? effDur : Math.min(effDur, 1);
    let t = Math.floor(tm / g + 0.3) * g;
    t = Math.max(0, Math.min(t, bpb - Math.min(effDur, bpb)));
    return Math.round(t * 1e6) / 1e6;
  };

  const headAt = (lx: number, ly: number) => {
    if (!layout) return null;
    let best: HeadHit | null = null;
    let bd = Infinity;
    for (const h of layout.heads) {
      if (lx < h.x0 - 4 || lx > h.x1 + 4) continue;
      const d = Math.abs(ly - h.y);
      if (d < 6 && d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  };

  /** Written pitch at a staff position → sounding pitch for that part. */
  const soundingAt = (gi: number, dIdx: number): number => {
    const part = partOfStaff(gi)!;
    if (part.drums) return drumAtPosition(dIdx);
    return pitchFromDiatonic(dIdx, part.writtenKey, acc) - part.transpose;
  };

  // ------------------------------------------------------------ editing

  const placementFor = (gi: number): Placement | null => partOfStaff(gi)?.placement ?? null;

  const doInsert = (t: number, pitch: number, gi: number, chord: boolean, d = effDur) => {
    const pl = placementFor(gi);
    const part = partOfStaff(gi);
    if (!pl || !part) return;
    const id = insertNote(pl, t, d, pitch, velocity, part.drums ? (pitch === 35 || pitch === 36 || pitch === 44 ? 2 : 1) : voice, chord);
    getEngine().preview(part.track.id, pitch, velocity, d);
    useStore.setState({ selectedNoteIds: [id] });
    lastInsert.current = { t, dur: d, pitch, staff: gi };
    setCursor({ t: t + d, staff: gi });
    setAcc(null);
  };

  const allNotes = (): Note[] => {
    if (!src) return [];
    const ids = new Set(src.regionIds);
    const out: Note[] = [];
    for (const t of project.tracks) for (const r of t.regions) if (r.kind === 'midi' && ids.has(r.id)) out.push(...r.notes);
    return out;
  };
  const selectedNotes = (): Note[] => allNotes().filter((n) => selectedIds.includes(n.id));

  /** Staff-of for any note id (for marks). */
  const staffOfNote = (p: number) => (src?.parts.length === 1 ? src.parts[0].placement.staffOf(p) : 0);
  const staffFnForSelection = (): ((p: number) => number) => {
    if (!src) return () => 0;
    if (src.parts.length === 1) return src.parts[0].placement.staffOf;
    const id = useStore.getState().selectedNoteIds[0];
    const h = layout?.heads.find((x) => x.noteId === id);
    const part = h ? partOfStaff(h.staff) : undefined;
    return part?.placement.staffOf ?? staffOfNote;
  };

  const preview = (noteId: string) => {
    const h = layout?.heads.find((x) => x.noteId === noteId);
    const part = h ? partOfStaff(h.staff) : undefined;
    const n = allNotes().find((x) => x.id === noteId);
    if (part && n) getEngine().preview(part.track.id, n.pitch, n.velocity, Math.min(1, n.duration));
  };

  const transposeSel = (fn: (p: number) => number) => {
    const ids = useStore.getState().selectedNoteIds;
    if (!ids.length) return;
    mapNotes(ids, (n) => {
      n.pitch = Math.max(0, Math.min(127, fn(n.pitch)));
    });
    setTimeout(() => preview(ids[0]), 0);
  };

  const diatonicSel = (dir: number) => {
    const ids = useStore.getState().selectedNoteIds;
    const h = layout?.heads.find((x) => ids.includes(x.noteId));
    const part = h ? partOfStaff(h.staff) : src?.parts[0];
    if (!part) return;
    transposeSel((p) => diatonicShift(p + part.transpose, dir, part.writtenKey) - part.transpose);
  };

  const applyDynamic = (mark: string) => {
    setDyn(mark);
    const ids = useStore.getState().selectedNoteIds;
    if (ids.length) addDynamic(ids, mark, staffFnForSelection());
  };

  const chooseDuration = (v: number) => {
    setDur(v);
    const ids = useStore.getState().selectedNoteIds;
    if (mode === 'select' && ids.length) setDuration(ids, v * (dotted ? 1.5 : 1) * (triplet ? 2 / 3 : 1));
  };

  const seekTo = (t: number) => {
    if (!src) return;
    getEngine().seek(Math.max(0, src.toAbs(t)));
  };

  // ------------------------------------------------------------ lyrics & chord entry

  const headGeom = (noteId: string) => {
    if (!layout) return null;
    const h = layout.heads.find((x) => x.noteId === noteId);
    if (!h) return null;
    const sys = layout.systems[h.system];
    const sg = sys.staves.find((s) => s.index === h.staff)!;
    return { h, x: (h.x0 + h.x1) / 2, yBelow: Math.max(sg.topLineY + sg.spacing * 4 + 22, h.y + 18), sg, sys };
  };

  const startLyric = (noteId?: string) => {
    const id = noteId ?? useStore.getState().selectedNoteIds[0];
    if (!id) {
      toast('Select a note to add lyrics (⌘L)');
      return;
    }
    const g = headGeom(id);
    if (!g) return;
    const n = allNotes().find((x) => x.id === id);
    setEntry({ kind: 'lyric', x: g.x, y: g.yBelow, value: n?.lyric ?? '', noteId: id, staff: g.h.staff });
    useStore.setState({ selectedNoteIds: [id] });
  };

  const nextLyricNote = (noteId: string): string | null => {
    if (!layout) return null;
    const cur = layout.heads.find((x) => x.noteId === noteId);
    if (!cur) return null;
    const cands = layout.heads.filter((h) => h.staff === cur.staff && h.voice === cur.voice && h.t > cur.t + 1e-6).sort((a, b) => a.t - b.t || b.pitch - a.pitch);
    return cands[0]?.noteId ?? null;
  };

  const chordGeom = (t: number) => {
    if (!layout) return null;
    const m = Math.floor(t / bpb + 1e-9);
    for (const sys of layout.systems) {
      const mg = sys.measures.find((x) => x.index === m);
      if (mg) {
        const top = sys.staves[0];
        let minY = top.topLineY;
        for (const h of layout.heads) if (h.staff === top.index && layout.systems[h.system] === sys) minY = Math.min(minY, h.y - (h.voice === 2 ? 0 : 34));
        return { x: beatToX(mg, t - m * bpb, bpb), y: Math.min(top.topLineY - 24, minY - 10) - 18 };
      }
    }
    return null;
  };

  const startChord = (t?: number) => {
    if (!src) return;
    const ids = useStore.getState().selectedNoteIds;
    let beat = t;
    if (beat === undefined) {
      const h = layout?.heads.find((x) => ids.includes(x.noteId));
      beat = h ? h.t : cursor.t;
    }
    const g = chordGeom(beat);
    if (!g) return;
    const existing = chordAt(project.chords, src.toAbs(beat));
    setEntry({ kind: 'chord', x: g.x, y: g.y, value: existing ? chordName(existing, src.parts[0]?.writtenKey ?? project.key) : '', t: beat });
  };

  const commitEntry = (advance: 'none' | 'next' | 'hyphen' | 'bar') => {
    if (!entry || !src) return;
    if (entry.kind === 'lyric' && entry.noteId) {
      const v = entry.value.trim();
      setLyric(entry.noteId, advance === 'hyphen' && v ? v.replace(/-$/, '') + '-' : v);
      if (advance === 'next' || advance === 'hyphen') {
        const next = nextLyricNote(entry.noteId);
        if (next) {
          startLyric(next);
          return;
        }
      }
      setEntry(null);
      return;
    }
    if (entry.kind === 'chord' && entry.t !== undefined) {
      if (!setChordAt(src.toAbs(entry.t), entry.value)) {
        toast(`Couldn't read chord "${entry.value}" — try C, Am7, F#dim, Bb/D`, 'error');
        return;
      }
      if (advance === 'next' || advance === 'bar') {
        const nt = advance === 'bar' ? (Math.floor(entry.t / bpb + 1e-9) + 1) * bpb : entry.t + 4 / project.timeSig[1];
        startChord(nt);
        return;
      }
      setEntry(null);
    }
  };

  // ------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.focusArea !== 'editor' || s.modal || isTyping(e) || !model || !src) return;
      const key = e.key;
      const lower = key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      const ids = s.selectedNoteIds;
      const curPart = partOfStaff(cursor.staff);
      let handled = true;

      if (mod && lower === 'l') {
        startLyric();
      } else if (mod && lower === 'k') {
        startChord();
      } else if (mod && e.code === 'Digit3') {
        setTriplet((v) => !v);
      } else if (mod && lower === 'a') {
        useStore.setState({ selectedNoteIds: allNotes().map((n) => n.id) });
      } else if (mod && lower === 'c') {
        noteClipboard = selectedNotes().map((n) => ({ ...n }));
      } else if (mod && lower === 'x') {
        noteClipboard = selectedNotes().map((n) => ({ ...n }));
        deleteNotes(ids);
      } else if (mod && lower === 'v') {
        const pl = placementFor(cursor.staff);
        if (pl) {
          const h = layout?.heads.filter((x) => ids.includes(x.noteId)).sort((a, b) => b.t1 - a.t1)[0];
          const at = h ? h.t1 : cursor.t;
          const newIds = pasteNotes(pl, noteClipboard, at);
          useStore.setState({ selectedNoteIds: newIds });
        }
      } else if (mod && (key === 'ArrowUp' || key === 'ArrowDown')) {
        transposeSel((p) => p + (key === 'ArrowUp' ? 12 : -12));
      } else if (mod) {
        handled = false;
      } else if (e.altKey && (e.code === 'Digit1' || e.code === 'Digit2')) {
        const v = e.code === 'Digit1' ? 1 : 2;
        setVoiceNo(v);
        if (ids.length) setVoice(ids, v);
      } else if (e.shiftKey && ['S', 'N', 'V', 'O'].includes(key.toUpperCase())) {
        const a = ({ S: 'staccato', N: 'tenuto', V: 'accent', O: 'marcato' } as const)[key.toUpperCase() as 'S'];
        if (ids.length) toggleArticulation(ids, a);
      } else if (lower === 'n') {
        setMode((m) => (m === 'input' ? 'select' : 'input'));
      } else if (key === 'Escape') {
        setMode('select');
        useStore.setState({ selectedNoteIds: [] });
      } else if (DURATIONS.some((d) => d.key === key)) {
        chooseDuration(DURATIONS.find((d) => d.key === key)!.v);
      } else if (key === '.') {
        setDotted((d) => !d);
      } else if (key === '0') {
        const pl = placementFor(cursor.staff);
        if (mode === 'input' && pl) {
          insertRest(pl, cursor.t, effDur, staffRef(cursor.staff)!.staff, voice);
          setCursor({ t: cursor.t + effDur, staff: cursor.staff });
        } else if (ids.length) deleteNotes(ids);
      } else if (key === '+' || key === '=') {
        if (ids.length) tieNotes(ids, effDur);
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        const dir = key === 'ArrowUp' ? 1 : -1;
        if (e.altKey) diatonicSel(dir);
        else transposeSel((p) => p + dir);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const dir = key === 'ArrowLeft' ? -1 : 1;
        const heads = [...(layout?.heads ?? [])].sort((a, b) => a.t - b.t || a.staff - b.staff || b.pitch - a.pitch);
        const uniq = heads.filter((h, i) => heads.findIndex((x) => x.noteId === h.noteId) === i);
        if (ids.length) {
          const cur = uniq.findIndex((h) => h.noteId === ids[ids.length - 1]);
          const curH = uniq[cur];
          const sameStaff = uniq.filter((h) => !curH || h.staff === curH.staff);
          const ci = sameStaff.findIndex((h) => h.noteId === ids[ids.length - 1]);
          const next = sameStaff[Math.max(0, Math.min(sameStaff.length - 1, ci + dir))];
          if (next) {
            const extend = e.shiftKey ? ids.filter((i) => i !== next.noteId) : [];
            useStore.setState({ selectedNoteIds: [...extend, next.noteId] });
            setCursor({ t: next.t1, staff: next.staff });
            if (!s.playing) seekTo(next.t);
          }
        } else setCursor({ t: Math.max(0, cursor.t + dir * effDur), staff: cursor.staff });
      } else if (key === 'Delete' || key === 'Backspace') {
        if (ids.length) deleteNotes(ids);
        else if (mode === 'input' && layout) {
          const prev = layout.heads.filter((h) => h.staff === cursor.staff && h.t < cursor.t - 1e-6).sort((a, b) => b.t - a.t)[0];
          if (prev) {
            deleteNotes([prev.noteId]);
            setCursor({ t: prev.t, staff: cursor.staff });
          }
        }
      } else if (/^[a-g]$/.test(lower) && !e.altKey && curPart && !curPart.drums) {
        const letter = 'cdefgab'.indexOf(lower);
        const wk = curPart.writtenKey;
        const tr = curPart.transpose;
        const nearestWritten = (refW: number) => {
          let b = refW;
          let bd2 = Infinity;
          for (let oct = 0; oct < 10; oct++) {
            const p = pitchFromDiatonic(oct * 7 + letter, wk, acc);
            if (Math.abs(p - refW) < bd2) {
              bd2 = Math.abs(p - refW);
              b = p;
            }
          }
          return b;
        };
        if (mode === 'select' && ids.length && !e.shiftKey) {
          // Re-pitch the selected notes, keeping their rhythm.
          mapNotes(ids, (n) => {
            n.pitch = nearestWritten(n.pitch + tr) - tr;
          });
          setTimeout(() => preview(ids[0]), 0);
          setAcc(null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (mode === 'select') setMode('input');
        const clef = staffRef(cursor.staff)!.clef;
        const refW = (lastInsert.current && lastInsert.current.staff === cursor.staff ? lastInsert.current.pitch + tr : clef === 'bass' ? 50 : clef === 'treble8vb' ? 64 : 67);
        let best = 0;
        let bd = Infinity;
        for (let oct = 0; oct < 10; oct++) {
          const p = pitchFromDiatonic(oct * 7 + letter, wk, acc);
          const d = e.shiftKey ? (p > refW ? p - refW : Infinity) : Math.abs(p - refW);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        const sounding = best - tr;
        if (e.shiftKey && lastInsert.current) {
          const li = lastInsert.current;
          const pl = placementFor(li.staff);
          if (pl) {
            const id = insertNote(pl, li.t, li.dur, sounding, velocity, voice, true);
            getEngine().preview(curPart.track.id, sounding, velocity, li.dur);
            useStore.setState({ selectedNoteIds: [id] });
            lastInsert.current = { ...li, pitch: sounding };
          }
          setAcc(null);
        } else {
          // Grand staff: letters go to the staff the pitch belongs to, within the cursor's part.
          const ref = staffRef(cursor.staff)!;
          const partFirst = model.parts[ref.part].firstStaff;
          const gi = partFirst + curPart.placement.staffOf(sounding);
          doInsert(cursor.t, sounding, gi, false);
        }
      } else if (/^[a-z]$/i.test(key) && !e.altKey) {
        // Swallow other plain letters so typing in the score never fires global
        // shortcuts (W/X/P would switch panels away mid-entry).
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // ------------------------------------------------------------ mouse

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode !== 'input' || e.buttons || entry) {
      if (ghost) setGhost(null);
      return;
    }
    const loc = locate(e.clientX, e.clientY, true);
    if (!loc) return setGhost(null);
    const t = snapInput(loc.tm);
    const pitch = soundingAt(loc.staff, loc.dIdx);
    const part = partOfStaff(loc.staff)!;
    const x = beatToX(loc.mg, t, bpb);
    const y = loc.sg.topLineY + loc.step * (loc.sg.spacing / 2);
    const ledger: number[] = [];
    if (loc.step < 0) for (let s = -2; s >= loc.step; s -= 2) ledger.push(loc.sg.topLineY + s * (loc.sg.spacing / 2));
    if (loc.step > 8) for (let s = 10; s <= loc.step; s += 2) ledger.push(loc.sg.topLineY + s * (loc.sg.spacing / 2));
    const label = part.drums ? (({ 36: 'Kick', 35: 'Kick 2', 38: 'Snare', 42: 'Hi-hat', 49: 'Crash', 51: 'Ride', 48: 'High Tom', 45: 'Mid Tom', 41: 'Low Tom', 43: 'Floor Tom', 44: 'Pedal Hat', 70: 'Shaker' }) as Record<number, string>)[pitch] ?? 'Drum' : noteName(pitch + part.transpose, acc === -1);
    setGhost({ x, y, ledger, label });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !model || !src) return;
    if (entry) {
      commitEntry('none');
      return;
    }
    const loc = locate(e.clientX, e.clientY, mode === 'input');
    if (!loc) {
      if (!e.shiftKey) useStore.setState({ selectedNoteIds: [] });
      return;
    }
    const head = headAt(loc.lx, loc.ly);
    if (head && (mode === 'select' || e.altKey || selectedIds.includes(head.noteId))) {
      // Select / drag pitch
      let ids = selectedIds;
      if (e.shiftKey) ids = ids.includes(head.noteId) ? ids.filter((i) => i !== head.noteId) : [...ids, head.noteId];
      else if (!ids.includes(head.noteId)) ids = [head.noteId];
      useStore.setState({ selectedNoteIds: ids });
      setCursor({ t: head.t1, staff: head.staff });
      preview(head.noteId);
      const part = partOfStaff(head.staff)!;
      const notes = allNotes();
      const orig = new Map(notes.filter((n) => ids.includes(n.id)).map((n) => [n.id, n.pitch]));
      let lastSteps = 0;
      let began = false;
      const half = (loc.sg.spacing / 2) * zoom;
      startDrag(
        e,
        ({ dy }) => {
          if (part.drums) return;
          const steps = Math.round(-dy / half);
          if (steps === lastSteps) return;
          if (!began) {
            beginGesture();
            began = true;
          }
          lastSteps = steps;
          live((d) => {
            for (const t of d.tracks)
              for (const r of t.regions) {
                if (r.kind !== 'midi') continue;
                for (const n of r.notes) {
                  const o = orig.get(n.id);
                  if (o !== undefined) n.pitch = Math.max(0, Math.min(127, diatonicShift(o + part.transpose, steps, part.writtenKey) - part.transpose));
                }
              }
          });
          const o = orig.get(head.noteId);
          if (o !== undefined) getEngine().preview(part.track.id, diatonicShift(o + part.transpose, steps, part.writtenKey) - part.transpose, 0.7, 0.4);
        },
        ({ moved }) => {
          if (began) endGesture();
          else if (!moved && !useStore.getState().playing) seekTo(head.t);
        },
        { threshold: 3 },
      );
      return;
    }
    if (mode === 'input') {
      const t = loc.mg.index * bpb + snapInput(loc.tm);
      doInsert(t, soundingAt(loc.staff, loc.dIdx), loc.staff, e.shiftKey);
    } else {
      if (!e.shiftKey) useStore.setState({ selectedNoteIds: [] });
      setCursor({ t: loc.mg.index * bpb + snapInput(loc.tm), staff: loc.staff });
    }
  };

  // ------------------------------------------------------------ cursor geometry

  const geomFor = (t: number, gi: number) => {
    if (!layout) return null;
    const m = Math.floor(t / bpb + 1e-9);
    for (const sys of layout.systems) {
      const mg = sys.measures.find((x) => x.index === m);
      if (!mg) continue;
      const sg = sys.staves.find((s) => s.index === gi) ?? sys.staves[0];
      return { x: beatToX(mg, t - m * bpb, bpb), top: sg.topLineY - 12, h: sg.spacing * 4 + 24, sys };
    }
    return null;
  };
  const cursorGeom = mode === 'input' ? geomFor(cursor.t, cursor.staff) : null;

  // ------------------------------------------------------------ export

  const title = full ? project.name : `${project.name} — ${src?.parts[0]?.track.name ?? ''}`;
  const printScore = () => {
    if (!src) return;
    const W = 760;
    const tmp = document.createElement('div');
    const l = renderScore(tmp, src.model, W, 1, {
      partKeys,
      timeSig: project.timeSig,
      firstBarNumber: src.firstBar,
      showDynamics: showDyn,
      showNames: full,
      title,
      tempo: project.bpm,
      chords: src.chords,
      partLabels: src.labels,
    });
    const svg = tmp.querySelector('svg');
    if (!svg) return;
    // Paginate between systems (A4 portrait proportions).
    const pageH = Math.round(W * 1.42);
    const pages: [number, number][] = [];
    let start = 0;
    for (const sys of l.systems) {
      if (sys.y1 - start > pageH && sys.y0 > start + 1) {
        pages.push([start, sys.y0 - 16]);
        start = sys.y0 - 16;
      }
    }
    pages.push([start, l.height]);
    const html = pages
      .map(([y0, y1]) => {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('viewBox', `0 ${y0} ${W} ${y1 - y0}`);
        clone.setAttribute('width', '100%');
        clone.removeAttribute('height');
        clone.style.cssText = '';
        return `<div class="page">${clone.outerHTML}</div>`;
      })
      .join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>${title}</title><style>
        body{margin:0;background:#888}
        .page{background:white;width:186mm;margin:12px auto;padding:0;box-shadow:0 2px 12px rgba(0,0,0,.4)}
        .page svg{display:block;width:100%;height:auto}
        @page{size:A4 portrait;margin:12mm}
        @media print{body{background:white}.page{margin:0;box-shadow:none;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
      </style></head><body>${html}</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };
  const exportXml = () => {
    if (!src) return;
    const xml = toMusicXml(src.model, project.name, src.labels, partKeys, project.timeSig, project.bpm);
    download(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }), `${safeFileName(project.name)}${full ? '' : ' - ' + safeFileName(src.parts[0]?.track.name ?? 'part')}.musicxml`);
  };

  if (!src || !model) return <div className="empty-state">{full ? 'Add an instrument track to see the full score' : 'Region not found'}</div>;

  const hasTransposing = src.parts.some((p) => ['trumpet', 'clarinet', 'saxophone', 'french-horn'].includes(p.track.instrument));

  const toolbar = (
    <div className="score-tools">
      {!full && (
        <select value={clefMode} onChange={(e) => setClefMode(e.target.value as ClefMode)} title="Staff / clef">
          <option value="auto">Auto staff</option>
          <option value="treble">Treble clef</option>
          <option value="bass">Bass clef</option>
          <option value="grand">Grand staff</option>
        </select>
      )}
      <select value={grid} onChange={(e) => setGrid(parseFloat(e.target.value))} title="Display quantization (triplets are detected automatically)">
        <option value={0.5}>Quantize 1/8</option>
        <option value={0.25}>Quantize 1/16</option>
        <option value={0.125}>Quantize 1/32</option>
      </select>
      {hasTransposing && (
        <label className="row" style={{ gap: 4, fontSize: 12 }} title="Show transposing instruments (B♭ trumpet, E♭ sax, F horn…) at sounding pitch">
          <input type="checkbox" checked={concert} onChange={(e) => setConcert(e.target.checked)} /> Concert pitch
        </label>
      )}
      <label className="row" style={{ gap: 4, fontSize: 12 }} title="Show dynamics & hairpins">
        <input type="checkbox" checked={showDyn} onChange={(e) => setShowDyn(e.target.checked)} /> Dynamics
      </label>
      <div className="seg">
        <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
          <ZoomOut size={14} />
        </button>
        <button title="Reset zoom" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button title="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
          <ZoomIn size={14} />
        </button>
      </div>
      {!full && src.region && (
        <button className="btn sm" onClick={() => addBars(src.region!.id, 4)} title="Add 4 measures to this region">
          <Plus size={13} /> Bars
        </button>
      )}
      <button className="btn sm" onClick={printScore} title="Print or save as PDF">
        <Printer size={13} /> Print / PDF
      </button>
      <button className="btn sm" onClick={exportXml} title="Export MusicXML (open in MuseScore, Sibelius, Finale…)">
        <FileDown size={13} /> MusicXML
      </button>
    </div>
  );

  return (
    <div className={'score-editor' + (full ? ' full' : '')}>
      {slot ? createPortal(toolbar, slot) : toolbar}
      <div className="score-palette">
        <div className="seg">
          <button className={mode === 'select' ? 'on' : ''} onClick={() => setMode('select')} title="Select & edit (Esc)">
            <MousePointer2 size={13} /> Select
          </button>
          <button className={mode === 'input' ? 'on' : ''} onClick={() => setMode('input')} title="Note input (N)">
            <PenLine size={13} /> Write
          </button>
        </div>
        <div className="pal-group">
          {DURATIONS.map((d) => (
            <button key={d.v} className={'pal-btn' + (dur === d.v ? ' on' : '')} title={`${d.label} (${d.key})`} onClick={() => chooseDuration(d.v)}>
              <NoteIcon v={d.v} />
            </button>
          ))}
          <button className={'pal-btn' + (dotted ? ' on' : '')} title="Dotted (.)" onClick={() => setDotted(!dotted)}>
            <span style={{ fontSize: 22, lineHeight: 0.5 }}>•</span>
          </button>
          <button className={'pal-btn txt' + (triplet ? ' on' : '')} title="Triplet (⌘3) — next notes are written as triplets" onClick={() => setTriplet(!triplet)}>
            <span className="tuplet-glyph">3</span>
          </button>
          <button
            className="pal-btn txt"
            title="Rest (0)"
            onClick={() => {
              const pl = placementFor(cursor.staff);
              if (!pl) return;
              insertRest(pl, cursor.t, effDur, staffRef(cursor.staff)!.staff, voice);
              setCursor({ t: cursor.t + effDur, staff: cursor.staff });
            }}
          >
            Rest
          </button>
        </div>
        <div className="pal-group" title="Voice (⌥1 / ⌥2) — voice 2 has stems down">
          {([1, 2] as const).map((v) => (
            <button
              key={v}
              className={'pal-btn txt voice-btn v' + v + (voice === v ? ' on' : '')}
              title={`Voice ${v} (⌥${v})${selectedIds.length ? ' — moves selected notes' : ''}`}
              onClick={() => {
                setVoiceNo(v);
                if (selectedIds.length) setVoice(selectedIds, v);
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="pal-group">
          {[
            { a: 1, s: '♯', t: 'Sharp' },
            { a: -1, s: '♭', t: 'Flat' },
            { a: 0, s: '♮', t: 'Natural' },
          ].map((x) => (
            <button
              key={x.a}
              className={'pal-btn acc' + (acc === x.a ? ' on' : '')}
              title={`${x.t} — next note (or raise/lower selected)`}
              onClick={() => {
                const ids = useStore.getState().selectedNoteIds;
                if (ids.length && x.a !== 0) transposeSel((p) => p + x.a);
                else setAcc(acc === x.a ? null : x.a);
              }}
            >
              {x.s}
            </button>
          ))}
          <button className="pal-btn txt" title="Tie selected notes to the next (+)" onClick={() => selectedIds.length && tieNotes(selectedIds, effDur)}>
            <svg width="20" height="12" viewBox="0 0 20 12">
              <path d="M2 4 Q10 12 18 4" stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </button>
        </div>
        <div className="pal-group">
          {ARTICS.map((x) => (
            <button key={x.a} className={'pal-btn artic'} title={`${x.label} (${x.key}) — selected notes`} onClick={() => selectedIds.length && toggleArticulation(selectedIds, x.a)}>
              {x.glyph}
            </button>
          ))}
        </div>
        <div className="pal-group">
          {DYNAMICS.map((d) => (
            <button key={d.mark} className={'pal-btn dyn' + (dyn === d.mark ? ' on' : '')} title={`Dynamic ${d.mark} — marks the first selected note; sets new notes`} onClick={() => applyDynamic(d.mark)}>
              {d.mark}
            </button>
          ))}
          <button className="pal-btn txt" title="Crescendo hairpin across selected notes" onClick={() => addHairpin(selectedIds, 'cresc', staffFnForSelection())}>
            <svg width="22" height="12" viewBox="0 0 22 12">
              <path d="M20 1 L2 6 L20 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          <button className="pal-btn txt" title="Diminuendo hairpin across selected notes" onClick={() => addHairpin(selectedIds, 'dim', staffFnForSelection())}>
            <svg width="22" height="12" viewBox="0 0 22 12">
              <path d="M2 1 L20 6 L2 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          <button className="pal-btn txt" title="Remove dynamics & hairpins from the selection (or the whole part)" onClick={() => clearMarks(selectedIds, src.regionIds)}>
            <Eraser size={14} />
          </button>
        </div>
        <div className="pal-group">
          <button className="pal-btn txt" title="Lyrics (⌘L) — type a syllable, Space for next note, - for hyphen" onClick={() => startLyric()}>
            <Type size={14} />
          </button>
          <button className="pal-btn txt" title="Chord symbol (⌘K) — type e.g. Am7, Space for next beat, Tab for next bar" onClick={() => startChord()}>
            <Hash size={14} />
          </button>
        </div>
        <div className="pal-group">
          <button className="pal-btn txt" title="Transpose selected up a semitone (↑)" onClick={() => transposeSel((p) => p + 1)}>
            <ArrowUp size={14} />
          </button>
          <button className="pal-btn txt" title="Transpose selected down a semitone (↓)" onClick={() => transposeSel((p) => p - 1)}>
            <ArrowDown size={14} />
          </button>
          <button className="pal-btn txt" title="Octave up (⌘↑)" onClick={() => transposeSel((p) => p + 12)}>
            8va
          </button>
          <button className="pal-btn txt" title="Octave down (⌘↓)" onClick={() => transposeSel((p) => p - 12)}>
            8vb
          </button>
          <button className="pal-btn txt" title="Delete selected (Delete)" onClick={() => selectedIds.length && deleteNotes(selectedIds)}>
            <Minus size={14} />
          </button>
        </div>
        <div className="score-hint faint">
          {mode === 'input' ? 'Click the staff or type A–G · ⇧+letter adds to chord · 2–7 durations · ⌘3 triplet · ⌥1/⌥2 voice' : 'Click a note to select & jump there · drag to change pitch · ⌘L lyrics · ⌘K chords'}
        </div>
      </div>
      <div className="score-scroll" ref={scrollRef}>
        <div className="score-page" style={{ width: layout?.width, minHeight: layout?.height }}>
          <div
            ref={svgRef}
            className={'score-svg' + (mode === 'input' ? ' input' : '')}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setGhost(null)}
            onPointerDown={onPointerDown}
          />
          <div className="score-overlay" style={{ transform: `scale(${zoom})` }}>
            {layout?.heads
              .filter((h) => selectedIds.includes(h.noteId))
              .map((h) => (
                <div key={'sel' + h.key + h.t} className="score-sel" style={{ left: h.x0 - 2, top: h.y - 6, width: h.x1 - h.x0 + 4 }} />
              ))}
            {cursorGeom && <div className="score-cursor" style={{ left: cursorGeom.x - 3, top: cursorGeom.top, height: cursorGeom.h }} />}
            {ghost && (
              <>
                {ghost.ledger.map((y, i) => (
                  <div key={i} className="score-ghost-ledger" style={{ left: ghost.x - 4, top: y }} />
                ))}
                <div className="score-ghost" style={{ left: ghost.x, top: ghost.y - 4.5 }} />
                <div className="score-ghost-label" style={{ left: ghost.x + 16, top: ghost.y - 9 }}>
                  {ghost.label}
                  {triplet ? ' (3)' : ''}
                  {voice === 2 ? ' · v2' : ''}
                </div>
              </>
            )}
            <Playhead src={src} layout={layout} bpb={bpb} scrollRef={scrollRef} zoom={zoom} />
            {entry && (
              <input
                autoFocus
                key={entry.kind + (entry.noteId ?? '') + (entry.t ?? '')}
                className={'score-entry ' + entry.kind}
                style={{ left: entry.x - (entry.kind === 'lyric' ? 40 : 4), top: entry.y }}
                value={entry.value}
                placeholder={entry.kind === 'lyric' ? 'lyric' : 'Am7'}
                onChange={(e) => setEntry({ ...entry, value: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => e.currentTarget.isConnected && entryRef.current?.noteId === entry.noteId && entryRef.current?.t === entry.t && entryRef.current?.kind === entry.kind && commitEntry('none')}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitEntry('none');
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEntry(null);
                  } else if (e.key === ' ') {
                    e.preventDefault();
                    commitEntry('next');
                  } else if (e.key === '-' && entry.kind === 'lyric') {
                    e.preventDefault();
                    commitEntry('hyphen');
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    commitEntry(entry.kind === 'chord' ? 'bar' : 'next');
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Playhead({ src, layout, bpb, scrollRef, zoom }: { src: Source; layout: ScoreLayout | null; bpb: number; scrollRef: React.RefObject<HTMLDivElement | null>; zoom: number }) {
  const position = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  const cursor = useStore((s) => s.cursor);
  const pos = playing ? position : cursor;
  const tView = src.fromAbs(pos);
  let geom: { x: number; top: number; h: number } | null = null;
  if (tView !== null && layout) {
    const m = Math.floor(tView / bpb + 1e-9);
    for (const sys of layout.systems) {
      const mg = sys.measures.find((x) => x.index === m);
      if (mg) {
        geom = { x: beatToX(mg, tView - m * bpb, bpb), top: sys.staves[0].topLineY - 20, h: sys.staves[sys.staves.length - 1].topLineY + 60 - sys.staves[0].topLineY };
        break;
      }
    }
  }
  // Notes sounding right now glow (only while playing).
  const sounding = playing && tView !== null && layout ? layout.heads.filter((h) => h.t <= tView + 1e-6 && tView < h.t1 - 1e-6) : [];
  const top = geom?.top;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || top === undefined || !playing) return;
    const y = top * zoom;
    if (y < el.scrollTop || y > el.scrollTop + el.clientHeight - 120) el.scrollTo({ top: Math.max(0, y - 30), behavior: 'smooth' });
  }, [top, playing, scrollRef, zoom]);
  return (
    <>
      {sounding.map((h) => (
        <div key={'pl' + h.key + h.t} className="score-sounding" style={{ left: h.x0 - 3, top: h.y - 7, width: h.x1 - h.x0 + 6 }} />
      ))}
      {geom && <div className="score-playhead" style={{ left: geom.x, top: geom.top, height: geom.h }} />}
    </>
  );
}
