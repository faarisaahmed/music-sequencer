// Sheet-music editor (MuseScore / Flat style) over the same MIDI notes the piano roll edits.
// Works on one region, or on the whole song as a full multi-instrument score.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useToolbarSlot } from './useToolbarSlot';
import { MousePointer2, PenLine, Plus, Minus, Printer, FileDown, ZoomIn, ZoomOut, ArrowUp, ArrowDown, Type, Hash, Eraser } from 'lucide-react';
import type { Articulation, MidiRegion, Note, Project, Track } from '../../model/types';
import { beginGesture, endGesture, findRegion, live, useStore, useTransport, toast } from '../../state/store';
import { noteName } from '../../model/music';
import { meterOf } from '../../model/timeline';
import { formMenu } from '../tracks/TempoLane';
import { showContextMenu } from '../common/menus';
import { placedNotes } from '../../model/regions';
import { getPreset } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import { download, safeFileName } from '../../audio/export';
import { isTyping, startDrag } from '../common/drag';
import { comboOf, isKey } from '../keys/keymap';
import {
  abbreviate,
  buildScore,
  diatonicShift,
  spell,
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
import { measureAt } from './score/notation';
import {
  beatToX,
  emptyLayout,
  planScore,
  renderScore,
  renderSystemInto,
  systemBounds,
  topLineDiatonic,
  xToBeat,
  type ChordLabel,
  type ElemHit,
  type HeadHit,
  type ScoreLayout,
  type ScorePlan,
} from './score/render';
import type { RenderOpts } from './score/render';
import {
  addBars,
  addDynamic,
  addHairpin,
  clearMarks,
  insertNote,
  notesToRests,
  addGraceNotes,
  setRestValue,
  addToChords,
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

const ARTICS: { a: Articulation; glyph: string; label: string }[] = [
  { a: 'staccato', glyph: '•', label: 'Staccato' },
  { a: 'tenuto', glyph: '–', label: 'Tenuto' },
  { a: 'accent', glyph: '>', label: 'Accent' },
  { a: 'marcato', glyph: '^', label: 'Marcato' },
  { a: 'fermata', glyph: '𝄐', label: 'Fermata' },
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
  return { id: n.id, key, regionId, pitch: n.pitch, s, e, vel: n.velocity, voice: n.voice, artic: n.artic, lyric: n.lyric, grace: n.grace };
}

function formFor(project: Project, src: Source): RenderOpts['form'] {
  if (!project.navMarks?.length && !project.voltas?.length) return undefined;
  return { marks: project.navMarks ?? [], voltas: project.voltas ?? [], barOffset: src.firstBar - 1 };
}

/** The song's tempo changes in the score's own beats (only those inside what it shows). */
function tempoMarksFor(project: Project, src: Source): { t: number; bpm: number; ramp?: boolean; faster?: boolean }[] {
  const out: { t: number; bpm: number; ramp?: boolean; faster?: boolean }[] = [];
  let prev = project.bpm;
  let prevBeat = 0;
  for (const c of [...(project.tempoChanges ?? [])].sort((a, b) => a.beat - b.beat)) {
    // A gradual change is marked where it starts ("accel." … to the new tempo).
    const t = src.fromAbs(c.ramp ? prevBeat : c.beat);
    if (t !== null) out.push({ t, bpm: c.bpm, ramp: c.ramp, faster: c.bpm > prev });
    prev = c.bpm;
    prevBeat = c.beat;
  }
  return out;
}

/** Build the notation source for a single region or the whole song. */
function buildSource(project: Project, full: boolean, regionId: string | undefined, grid: number, clefMode: ClefMode, concert: boolean): Source | null {
  const meter = meterOf(project);
  let bpb = meter.lenAt(0);
  const mkPart = (track: Track, raw: RawNote[], marks: DisplayMark[], mode: ClefMode, placementBase: Omit<Placement, 'staffOf'>, splits: PartInput['splits'] = []) => {
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
      splits,
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
    // Bars counted from where this region's score starts.
    const origin = region.start - (region.loop ? region.offset : 0);
    const rm = meter.relativeTo(origin);
    bpb = rm.lenAt(0);
    const raw: RawNote[] = [];
    for (const n of region.notes) {
      const t = n.start - viewStart;
      if (t < -1e-6 || t >= viewLen - 1e-6) continue;
      raw.push(rawFromNote(n, region.id, t, t + n.duration, n.id));
    }
    const marks: DisplayMark[] = (region.marks ?? []).map((m) => ({ kind: m.kind, t: m.beat - viewStart, end: m.end !== undefined ? m.end - viewStart : undefined, value: m.value, staff: m.staff ?? 0, id: m.id, regionId: region.id }));
    const splits = (region.restSplits ?? []).map((x) => ({ t: x.beat - viewStart, staff: x.staff, voice: x.voice })).filter((x) => x.t > 0 && x.t < viewLen + bpb);
    const p = mkPart(track, raw, marks, clefMode, { mode: 'region', trackId: track.id, regionId: region.id }, splits);
    const toAbs = (t: number) => region.start + t - (region.loop ? region.offset : 0);
    const fromAbs = (a: number) => a - region.start + (region.loop ? region.offset : 0);
    const chords: ChordLabel[] = (project.chords ?? [])
      .map((c) => ({ t: fromAbs(c.beat), name: chordName(c, p.meta.writtenKey) }))
      .filter((c) => c.t >= -1e-6 && c.t < viewLen + bpb);
    const model = buildScore([p.input], rm, viewLen, 1, grid);
    return {
      model,
      parts: [p.meta],
      firstBar: meter.barAt(origin + 1e-9).bar + 1,
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
  let total = meter.barStart(4);
  const built = tracks.map((track) => {
    const raw: RawNote[] = [];
    const marks: DisplayMark[] = [];
    const splits: NonNullable<PartInput['splits']> = [];
    for (const r of track.regions) {
      if (r.kind !== 'midi' || r.muted) continue;
      const iters = r.loop ? Math.ceil((r.offset + r.length) / r.contentLength) + 1 : 1;
      for (const sp of r.restSplits ?? [])
        for (let k = 0; k < iters; k++) {
          const t = r.start - r.offset + k * (r.loop ? r.contentLength : 0) + sp.beat;
          if (t > r.start && t < r.start + r.length) splits.push({ t, staff: sp.staff, voice: sp.voice });
        }
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
    return mkPart(track, raw, marks, 'auto', { mode: 'song', trackId: track.id }, splits);
  });
  const model = buildScore(
    built.map((b) => b.input),
    meter,
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

/** Last measured score width, so re-opened editors lay out once at the right size. */
let lastScoreWidth: number | null = null;

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
  const [zoom, setZoom] = useState(full ? 0.85 : 1.15);
  const [showDyn, setShowDyn] = useState(true);
  const [cursor, setCursor] = useState<{ t: number; staff: number }>({ t: 0, staff: 0 });
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** A selected rest (Flat-style): staff, voice and the beat it starts on. */
  const [restSel, setRestSel] = useState<{ gi: number; voice: 1 | 2; t: number } | null>(full ? null : { gi: 0, voice: 1, t: 0 });
  const [overNote, setOverNote] = useState(false);
  const [width, setWidth] = useState<number | null>(lastScoreWidth);
  // Systems are drawn into the (mutable) layout outside React; this tiny store re-renders the overlays.
  const drawnStore = useMemo(() => {
    let version = 0;
    const listeners = new Set<() => void>();
    return {
      get: () => version,
      subscribe: (f: () => void) => {
        listeners.add(f);
        return () => listeners.delete(f);
      },
      bump: () => {
        version++;
        listeners.forEach((f) => f());
      },
    };
  }, []);
  useSyncExternalStore(drawnStore.subscribe, drawnStore.get);
  const virt = useRef<{ plan: ScorePlan; layout: ScoreLayout; drawn: Set<number> } | null>(null);
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
  const velocity = DYNAMICS.find((d) => d.mark === dyn)?.vel ?? 0.64;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      lastScoreWidth = Math.max(500, el.clientWidth - 48);
      setWidth(lastScoreWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = useMemo(() => buildSource(project, full, regionId, grid, clefMode, concert), [project, full, regionId, grid, clefMode, concert]);
  const model = src?.model ?? null;
  const partKeys = useMemo(() => src?.parts.map((p) => p.writtenKey) ?? [], [src]);

  /** Draw the systems inside (or next to) the visible part of the scroll area. */
  const drawVisible = useCallback((withBuffer = true) => {
    const v = virt.current;
    const host = svgRef.current;
    const el = scrollRef.current;
    if (!v || !host || !el) return;
    const hostTop = host.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    const viewTop = (el.scrollTop - hostTop) / v.plan.zoom;
    const viewBottom = (el.scrollTop + el.clientHeight - hostTop) / v.plan.zoom;
    const n = v.plan.lines.length;
    let lo = n;
    let hi = -1;
    for (let li = 0; li < n; li++) {
      const b = systemBounds(v.plan, li);
      if (b.bottom >= viewTop && b.top <= viewBottom) {
        lo = Math.min(lo, li);
        hi = Math.max(hi, li);
      }
    }
    if (hi < 0) return;
    let added = false;
    const pad = withBuffer ? 1 : 0;
    for (let li = Math.max(0, lo - pad); li <= Math.min(n - 1, hi + pad); li++) {
      if (v.drawn.has(li)) continue;
      v.drawn.add(li);
      const div = document.createElement('div');
      div.className = 'score-system';
      div.style.top = `${systemBounds(v.plan, li).top * v.plan.zoom}px`;
      host.appendChild(div);
      try {
        renderSystemInto(div, v.plan, li, v.layout);
      } catch (e) {
        console.error('score system render failed', li, e);
      }
      added = true;
    }
    if (added) drawnStore.bump();
  }, [drawnStore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => drawVisible());
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [drawVisible]);

  // Cheap layout pass (line breaks, system positions); systems are drawn lazily into it.
  const plan = useMemo(() => {
    if (!src || width === null) return null;
    try {
      return planScore(src.model, width, zoom, {
        partKeys,
        timeSig: project.timeSig,
        firstBarNumber: src.firstBar,
        showDynamics: showDyn,
        showNames: full,
        title: full ? project.name : undefined,
        tempo: full ? project.bpm : undefined,
        tempoMarks: tempoMarksFor(project, src),
        form: formFor(project, src),
        chords: src.chords,
        partLabels: src.labels,
      });
    } catch (e) {
      console.error('score layout failed', e);
      return null;
    }
  }, [src, partKeys, width, zoom, project.timeSig, project.name, project.bpm, project.tempoChanges, project.navMarks, project.voltas, showDyn, full]);
  const layout = useMemo(() => (plan ? emptyLayout(plan) : null), [plan]);

  useLayoutEffect(() => {
    const host = svgRef.current;
    if (!host) return;
    // Re-run with the same layout (e.g. StrictMode): its systems are already drawn into the host.
    if (layout && virt.current?.layout === layout) {
      drawVisible();
      return;
    }
    host.innerHTML = '';
    if (!plan || !layout) {
      virt.current = null;
      return;
    }
    host.style.width = `${layout.width}px`;
    host.style.height = `${layout.height}px`;
    virt.current = { plan, layout, drawn: new Set() };
    // Paint what's on screen first; the neighbouring systems follow right after.
    drawVisible(false);
    const raf = requestAnimationFrame(() => setTimeout(() => drawVisible(), 0));
    if (import.meta.env.DEV) (window as unknown as { __scoreLayout: ScoreLayout }).__scoreLayout = layout;
    return () => cancelAnimationFrame(raf);
  }, [plan, layout, drawVisible]);

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
      const mm = model?.measures[mg.index];
      const tm = mm ? mm.start + xToBeat(mg, lx, mm.len) : 0;
      return { lx, ly, sys, sg, staff: sg.index, mg, step, dIdx, tm };
    },
    [layout, model, zoom],
  );



  const headAt = (lx: number, ly: number) => {
    if (!layout) return null;
    let best: HeadHit | null = null;
    let bd = Infinity;
    for (const h of layout.heads) {
      if (lx < h.x0 - 6 || lx > h.x1 + 6) continue;
      const d = Math.abs(ly - h.y);
      if (d < 7 && d < bd) {
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

  /** Notes on staff `gi` shown in the other voice: edits in voice `v` leave them alone. */
  const protectFor = (gi: number, v: 1 | 2): Set<string> => {
    const ref = staffRef(gi);
    if (!model || !ref) return new Set();
    return new Set(model.parts[ref.part].notes.filter((n) => n.staff === ref.staff && n.voice !== v).map((n) => n.id));
  };
  /** For each note id: the ids shown in the same staff & voice (what a longer value may write over). */
  const voiceMates = (ids: string[]): Map<string, Set<string>> => {
    const out = new Map<string, Set<string>>();
    if (!model) return out;
    for (const part of model.parts)
      for (const q of part.notes) {
        if (!ids.includes(q.id) || out.has(q.id)) continue;
        out.set(q.id, new Set(part.notes.filter((n) => n.staff === q.staff && n.voice === q.voice).map((n) => n.id)));
      }
    return out;
  };


  const doInsert = (t: number, pitch: number, gi: number, chord: boolean, d = effDur, vIn?: 1 | 2) => {
    const pl = placementFor(gi);
    const part = partOfStaff(gi);
    if (!pl || !part) return;
    const v: 1 | 2 = part.drums ? (pitch === 35 || pitch === 36 || pitch === 44 ? 2 : 1) : (vIn ?? voice);
    const id = insertNote(pl, t, d, pitch, velocity, v, chord, part.drums ? undefined : protectFor(gi, v));
    getEngine().preview(part.track.id, pitch, velocity, d);
    lastInsert.current = { t, dur: d, pitch, staff: gi };
    // Move on to what follows (usually the next rest), ready for the next note.
    useStore.setState({ selectedNoteIds: [] });
    setRestSel({ gi, voice: v, t: t + d });
    setCursor({ t: t + d, staff: gi });
    setAcc(null);
    void id;
  };

  // ------------------------------------------------------------ elements (notes & rests)

  const voiceForPitch = (gi: number, pitch: number): 1 | 2 => (partOfStaff(gi)?.drums ? (pitch === 35 || pitch === 36 || pitch === 44 ? 2 : 1) : voice);
  /** Elements of one staff & voice, in time order (tied continuations included). */
  const elemsOf = (gi: number, v: 1 | 2): ElemHit[] => (layout?.elems ?? []).filter((e) => e.staff === gi && e.voice === v).sort((a, b) => a.t - b.t);
  const elemAt = (gi: number, v: 1 | 2, t: number): ElemHit | undefined => elemsOf(gi, v).find((e) => Math.abs(e.t - t) < 1e-3);
  /** The note or rest under the pointer in a measure (a voice with nothing there is one whole-bar rest). */
  const elemUnder = (gi: number, v: 1 | 2, measure: number, lx: number): ElemHit | null => {
    const list = elemsOf(gi, v).filter((e) => e.measure === measure);
    if (!list.length) {
      const sys = layout?.systems.find((sy) => sy.measures.some((m) => m.index === measure));
      const mg = sys?.measures.find((m) => m.index === measure);
      if (!mg) return null;
      const mm = model!.measures[measure];
      return { x0: mg.noteX0, x1: mg.noteX1, t: mm.start, t1: mm.start + mm.len, staff: gi, voice: v, system: layout!.systems.indexOf(sys!), measure, rest: true, cont: false, noteIds: [] };
    }
    let pick = list[0];
    for (const e of list) if (e.x0 <= lx + 6) pick = e;
    return pick;
  };
  /** Show a value on the palette (when you select something, its value is shown, like Noteflight). */
  const syncValue = (v: number) => {
    for (const d of DURATIONS) {
      if (Math.abs(d.v - v) < 1e-3) return setDur(d.v), setDotted(false), setTriplet(false);
      if (Math.abs(d.v * 1.5 - v) < 1e-3) return setDur(d.v), setDotted(true), setTriplet(false);
      if (Math.abs((d.v * 2) / 3 - v) < 1e-3) return setDur(d.v), setDotted(false), setTriplet(true);
    }
  };
  const selectElem = (e: ElemHit, sync = true) => {
    if (e.rest) {
      useStore.setState({ selectedNoteIds: [] });
      setRestSel({ gi: e.staff, voice: e.voice, t: e.t });
    } else {
      setRestSel(null);
      // A tied continuation selects the note it belongs to.
      useStore.setState({ selectedNoteIds: [...e.noteIds] });
    }
    setCursor({ t: e.t, staff: e.staff });
    if (sync) {
      const start = e.cont ? (layout?.elems.find((x) => !x.cont && x.noteIds.some((id) => e.noteIds.includes(id))) ?? e) : e;
      syncValue(start.t1 - start.t);
    }
  };
  /** The element that holds the current selection (a rest, or the first selected note). */
  const currentElem = (): ElemHit | undefined => {
    if (restSel) return elemAt(restSel.gi, restSel.voice, restSel.t);
    const ids = useStore.getState().selectedNoteIds;
    return layout?.elems.filter((e) => !e.rest && !e.cont && e.noteIds.some((id) => ids.includes(id))).sort((a, b) => a.t - b.t)[0];
  };
  /** Fill the selected rest (or the given one) with a note of the current value. */
  const fillRest = (gi: number, v: 1 | 2, t: number, pitch: number) => doInsert(t, pitch, gi, false, effDur, v);

  const allNotes = (): Note[] => {
    if (!src) return [];
    const ids = new Set(src.regionIds);
    const out: Note[] = [];
    // Always read the latest song, so a note that was just changed plays its new pitch.
    for (const t of useStore.getState().project?.tracks ?? []) for (const r of t.regions) if (r.kind === 'midi' && ids.has(r.id)) out.push(...r.notes);
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
    ids.slice(0, 6).forEach((id) => preview(id));
  };

  const diatonicSel = (dir: number) => {
    const ids = useStore.getState().selectedNoteIds;
    const h = layout?.heads.find((x) => ids.includes(x.noteId));
    const part = h ? partOfStaff(h.staff) : src?.parts[0];
    if (!part) return;
    transposeSel((p) => diatonicShift(p + part.transpose, dir, part.writtenKey) - part.transpose);
  };

  /** Add a diatonic interval above (steps > 0) or below each selected note — 2 = a 3rd, 4 = a 5th, 7 = an octave. */
  const addInterval = (steps: number) => {
    const ids = useStore.getState().selectedNoteIds;
    if (!ids.length) {
      toast('Select a note first, then add a 3rd, 5th… to build a chord');
      return;
    }
    const h = layout?.heads.find((x) => ids.includes(x.noteId));
    const part = h ? partOfStaff(h.staff) : src?.parts[0];
    if (!part || part.drums) return;
    const newIds = addToChords(ids, (n) => diatonicShift(n.pitch + part.transpose, steps, part.writtenKey) - part.transpose);
    if (newIds.length) {
      useStore.setState({ selectedNoteIds: newIds });
      setTimeout(() => {
        for (const id of [...ids, ...newIds]) preview(id);
      }, 0);
    }
  };

  /** Grace note before each selected note: a step above by default (move it with ↑/↓). */
  const addGrace = () => {
    const ids = useStore.getState().selectedNoteIds;
    if (!ids.length) {
      toast('Select a note first, then add a grace note before it');
      return;
    }
    const h = layout?.heads.find((x) => ids.includes(x.noteId));
    const part = h ? partOfStaff(h.staff) : src?.parts[0];
    if (!part || part.drums) return;
    // About 70 ms, whatever the tempo (but never more than a 32nd note).
    const len = Math.max(0.05, Math.min(0.125, (0.07 * project.bpm) / 60));
    const newIds = addGraceNotes(ids, (n) => diatonicShift(n.pitch + part.transpose, 1, part.writtenKey) - part.transpose, len);
    if (!newIds.length) return;
    setRestSel(null);
    useStore.setState({ selectedNoteIds: newIds });
    const g = allNotes().find((x) => x.id === newIds[0]);
    if (g) getEngine().preview(part.track.id, g.pitch, g.velocity, 0.12);
    setTimeout(() => ids.slice(0, 4).forEach((id) => preview(id)), 90);
  };

  /** Toggle a dot on the selection (or for the next notes). */
  const toggleDot = () => {
    const e = currentElem();
    if (!e) {
      setDotted((d) => !d);
      return;
    }
    const d0 = e.t1 - e.t;
    const isDotted = [3, 1.5, 0.75, 0.375, 0.1875].some((x) => Math.abs(d0 - x) < 1e-3);
    setDotted(!isDotted);
    applyValue(isDotted ? d0 / 1.5 : d0 * 1.5);
  };

  /** Sharp / flat / natural on the selection: ♯ raises, ♭ lowers, ♮ removes the accidental. */
  const accidental = (a: number) => {
    const ids = useStore.getState().selectedNoteIds;
    if (!ids.length) {
      setAcc(acc === a ? null : a);
      return;
    }
    const h = layout?.heads.find((x) => ids.includes(x.noteId));
    const part = h ? partOfStaff(h.staff) : src?.parts[0];
    if (!part) return;
    if (a !== 0) transposeSel((p) => p + a);
    else
      transposeSel((p) => {
        const w = p + part.transpose;
        return w - spell(w, part.writtenKey).alter - part.transpose;
      });
  };

  const applyDynamic = (mark: string) => {
    setDyn(mark);
    const ids = useStore.getState().selectedNoteIds;
    if (ids.length) addDynamic(ids, mark, staffFnForSelection());
  };

  /** Give the selected notes or rest a new value. */
  const applyValue = (val: number) => {
    const ids = useStore.getState().selectedNoteIds;
    if (ids.length) {
      setDuration(ids, val, voiceMates(ids), staffFnForSelection());
      return;
    }
    if (restSel) {
      const pl = placementFor(restSel.gi);
      const ref = staffRef(restSel.gi);
      if (pl && ref) setRestValue(pl, restSel.t, val, ref.staff, restSel.voice, protectFor(restSel.gi, restSel.voice));
    }
  };
  const chooseDuration = (v: number) => {
    setDur(v);
    applyValue(v * (dotted ? 1.5 : 1) * (triplet ? 2 / 3 : 1));
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
    const cands = layout.heads.filter((h) => !h.grace && h.staff === cur.staff && h.voice === cur.voice && h.t > cur.t + 1e-6).sort((a, b) => a.t - b.t || b.pitch - a.pitch);
    return cands[0]?.noteId ?? null;
  };

  const chordGeom = (t: number) => {
    if (!layout) return null;
    if (!model) return null;
    const mm = measureAt(model, t);
    const m = mm.index;
    for (const sys of layout.systems) {
      const mg = sys.measures.find((x) => x.index === m);
      if (mg) {
        const top = sys.staves[0];
        let minY = top.topLineY;
        for (const h of layout.heads) if (h.staff === top.index && layout.systems[h.system] === sys) minY = Math.min(minY, h.y - (h.voice === 2 ? 0 : 34));
        return { x: beatToX(mg, t - mm.start, mm.len), y: Math.min(top.topLineY - 24, minY - 10) - 18 };
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
        const mm = model ? measureAt(model, entry.t) : null;
        const nt = advance === 'bar' ? (mm ? mm.start + mm.len : entry.t + 4) : entry.t + 4 / (mm?.sig[1] ?? 4);
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
      const combo = comboOf(e);
      const is = (id: string) => isKey(e, id, combo);
      const toRests = () => {
        if (!ids.length) return;
        const first = currentElem();
        notesToRests(ids, staffFnForSelection());
        if (first) setRestSel({ gi: first.staff, voice: first.voice, t: first.t });
      };
      const step = (dir: number, extend: boolean) => {
        // Step through the notes and rests of the voice; notes play as you land on them.
        const cur = currentElem();
        if (!cur) return;
        const list = elemsOf(cur.staff, cur.voice).filter((x) => !x.cont);
        const i = list.findIndex((x) => Math.abs(x.t - cur.t) < 1e-3);
        const next = list[i + dir];
        if (!next) return;
        if (extend && !next.rest && !cur.rest) useStore.setState({ selectedNoteIds: [...new Set([...ids, ...next.noteIds])] });
        else selectElem(next);
        if (!next.rest) next.noteIds.forEach((id) => preview(id));
        if (!s.playing) seekTo(next.t);
      };
      const durIdx = DURATIONS.findIndex((d) => is(`score.dur.${d.v}`));

      if (is('score.lyrics')) startLyric();
      else if (is('score.chordSymbol')) startChord();
      else if (is('score.triplet')) setTriplet((v) => !v);
      else if (is('edit.selectAll')) useStore.setState({ selectedNoteIds: allNotes().map((n) => n.id) });
      else if (is('edit.copy')) noteClipboard = selectedNotes().map((n) => ({ ...n }));
      else if (is('edit.cut')) {
        noteClipboard = selectedNotes().map((n) => ({ ...n }));
        toRests();
      } else if (is('edit.paste')) {
        const pl = placementFor(cursor.staff);
        if (pl) {
          const h = layout?.heads.filter((x) => ids.includes(x.noteId)).sort((a, b) => b.t1 - a.t1)[0];
          const at = h ? h.t1 : cursor.t;
          const newIds = pasteNotes(pl, noteClipboard, at);
          useStore.setState({ selectedNoteIds: newIds });
        }
      } else if (is('score.octaveUp') || is('score.octaveDown')) {
        transposeSel((p) => p + (is('score.octaveUp') ? 12 : -12));
      } else if (is('score.sharp') || is('score.flat')) {
        accidental(is('score.sharp') ? 1 : -1);
      } else if (is('score.stepUp') || is('score.stepDown')) {
        diatonicSel(is('score.stepUp') ? 1 : -1);
      } else if (is('score.prev') || is('score.next') || is('score.prevExtend') || is('score.nextExtend')) {
        step(is('score.prev') || is('score.prevExtend') ? -1 : 1, is('score.prevExtend') || is('score.nextExtend'));
      } else if (['score.add3', 'score.add4', 'score.add5', 'score.add6', 'score.add7', 'score.add8'].some(is)) {
        // MuseScore-style: ⌥3 adds a 3rd above, ⌥5 a 5th … ⌥8 an octave.
        const id = ['score.add3', 'score.add4', 'score.add5', 'score.add6', 'score.add7', 'score.add8'].find(is)!;
        addInterval(Number(id.slice(-1)) - 1);
      } else if (is('score.below3')) addInterval(-2);
      else if (is('score.grace')) addGrace();
      else if (is('score.voice1') || is('score.voice2')) {
        const v = is('score.voice1') ? 1 : 2;
        setVoiceNo(v);
        if (ids.length) setVoice(ids, v);
      } else if (['score.staccato', 'score.tenuto', 'score.accent', 'score.marcato'].some(is)) {
        const a = (['staccato', 'tenuto', 'accent', 'marcato'] as const).find((x) => is('score.' + x))!;
        if (ids.length) toggleArticulation(ids, a);
      } else if (is('score.mode')) setMode((m) => (m === 'input' ? 'select' : 'input'));
      else if (key === 'Escape') {
        setMode('select');
        useStore.setState({ selectedNoteIds: [] });
      } else if (durIdx >= 0) chooseDuration(DURATIONS[durIdx].v);
      else if (is('score.dot')) toggleDot();
      else if (is('score.rest') || is('edit.delete')) toRests();
      else if (is('score.tie')) {
        if (ids.length) tieNotes(ids, effDur);
      } else if (mod) {
        handled = false;
      } else if (/^[a-g]$/.test(lower) && !e.altKey && (restSel || ids.length) && (restSel ? partOfStaff(restSel.gi) : curPart) && !(restSel ? partOfStaff(restSel.gi)! : curPart!).drums) {
        const target = restSel ? partOfStaff(restSel.gi)! : curPart!;
        const letter = 'cdefgab'.indexOf(lower);
        const wk = target.writtenKey;
        const tr = target.transpose;
        const nearestWritten = (refW: number, above = false) => {
          let b = refW;
          let bd2 = Infinity;
          for (let oct = 0; oct < 10; oct++) {
            const p = pitchFromDiatonic(oct * 7 + letter, wk, acc);
            const dd = above ? (p > refW ? p - refW : Infinity) : Math.abs(p - refW);
            if (dd < bd2) {
              bd2 = dd;
              b = p;
            }
          }
          return b;
        };
        if (ids.length && e.shiftKey) {
          // ⇧+letter: add that note above each selected note (build a chord).
          const newIds = addToChords(ids, (n) => nearestWritten(n.pitch + tr, true) - tr);
          if (newIds.length) useStore.setState({ selectedNoteIds: newIds });
          setTimeout(() => newIds.forEach((id) => preview(id)), 0);
        } else if (ids.length) {
          // A note is selected: change its pitch, keeping its rhythm.
          mapNotes(ids, (n) => {
            n.pitch = nearestWritten(n.pitch + tr) - tr;
          });
          ids.slice(0, 6).forEach((id) => preview(id));
        } else if (restSel) {
          // A rest is selected: it becomes a note (current value), then we move on.
          const clef = staffRef(restSel.gi)!.clef;
          const li = lastInsert.current;
          const refW = li && li.staff === restSel.gi ? li.pitch + tr : clef === 'bass' ? 50 : clef === 'treble8vb' ? 64 : 67;
          const sounding = nearestWritten(refW) - tr;
          const ref = staffRef(restSel.gi)!;
          const gi = model.parts[ref.part].firstStaff + target.placement.staffOf(sounding);
          fillRest(gi === restSel.gi ? gi : gi, restSel.voice, restSel.t, sounding);
        }
        setAcc(null);
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
    if (e.buttons || entry) {
      if (ghost) setGhost(null);
      return;
    }
    const loc = locate(e.clientX, e.clientY, true);
    const over = !!(loc && headAt(loc.lx, loc.ly));
    if (over !== overNote) setOverNote(over);
    if (mode !== 'input' || over) {
      if (ghost) setGhost(null);
      return;
    }
    if (!loc) return setGhost(null);
    const pitch = soundingAt(loc.staff, loc.dIdx);
    const part = partOfStaff(loc.staff)!;
    // Notes go at the start of the rest or chord under the pointer — never in the middle of a rest.
    const el = elemUnder(loc.staff, voiceForPitch(loc.staff, pitch), loc.mg.index, loc.lx);
    if (!el || el.cont) return setGhost(null);
    const chordPitches = el.rest ? [] : chordPitchesAt(el);
    if (!el.rest && chordPitches.includes(pitch + part.transpose)) return setGhost(null);
    const x = el.rest && el.t1 - el.t >= (model?.measures[loc.mg.index]?.len ?? 4) - 1e-6 ? el.x0 + 2 : el.x0;
    const y = loc.sg.topLineY + loc.step * (loc.sg.spacing / 2);
    const ledger: number[] = [];
    if (loc.step < 0) for (let s = -2; s >= loc.step; s -= 2) ledger.push(loc.sg.topLineY + s * (loc.sg.spacing / 2));
    if (loc.step > 8) for (let s = 10; s <= loc.step; s += 2) ledger.push(loc.sg.topLineY + s * (loc.sg.spacing / 2));
    const label = part.drums ? (({ 36: 'Kick', 35: 'Kick 2', 38: 'Snare', 42: 'Hi-hat', 49: 'Crash', 51: 'Ride', 48: 'High Tom', 45: 'Mid Tom', 41: 'Low Tom', 43: 'Floor Tom', 44: 'Pedal Hat', 70: 'Shaker' }) as Record<number, string>)[pitch] ?? 'Drum' : noteName(pitch + part.transpose, acc === -1);
    setGhost({ x, y, ledger, label: el.rest ? label : e.altKey || part.drums ? `${label} (replace)` : `+ ${label} (add to chord)` });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !model || !src) return;
    if (entry) {
      commitEntry('none');
      return;
    }
    const loc = locate(e.clientX, e.clientY, false);
    if (!loc) {
      if (!e.shiftKey) useStore.setState({ selectedNoteIds: [] });
      return;
    }
    const head = headAt(loc.lx, loc.ly);
    // Clicking a note always selects it (and dragging it changes its pitch), in either mode.
    if (head && !(mode === 'input' && e.altKey)) {
      // Select / drag pitch
      let ids = selectedIds;
      if (e.shiftKey) ids = ids.includes(head.noteId) ? ids.filter((i) => i !== head.noteId) : [...ids, head.noteId];
      else if (!ids.includes(head.noteId)) ids = [head.noteId];
      useStore.setState({ selectedNoteIds: ids });
      setRestSel(null);
      setCursor({ t: head.t, staff: head.staff });
      const own = layout?.elems.find((x) => !x.cont && !x.rest && x.noteIds.includes(head.noteId));
      if (own) syncValue(own.t1 - own.t);
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
    // Empty space: drag = box-select notes; click = write a note (Write) or place the cursor (Select).
    const host = svgRef.current!.getBoundingClientRect();
    const toLocal = (cx: number, cy: number) => ({ x: (cx - host.left) / zoom, y: (cy - host.top) / zoom });
    const p0 = toLocal(e.clientX, e.clientY);
    const before = e.shiftKey ? selectedIds : [];
    startDrag(
      e,
      ({ x, y }) => {
        const p1 = toLocal(x, y);
        const r = { x0: Math.min(p0.x, p1.x), y0: Math.min(p0.y, p1.y), x1: Math.max(p0.x, p1.x), y1: Math.max(p0.y, p1.y) };
        setGhost(null);
        setRestSel(null);
        setBox(r);
        const inside = (layout?.heads ?? []).filter((h) => h.x1 >= r.x0 && h.x0 <= r.x1 && h.y >= r.y0 - 3 && h.y <= r.y1 + 3).map((h) => h.noteId);
        useStore.setState({ selectedNoteIds: [...new Set([...before, ...inside])] });
      },
      ({ moved }) => {
        setBox(null);
        if (moved) {
          const sel = useStore.getState().selectedNoteIds;
          const h = layout?.heads.find((x) => x.noteId === sel[sel.length - 1]);
          if (h) setCursor({ t: h.t1, staff: h.staff });
          return;
        }
        const pitch = soundingAt(loc.staff, loc.dIdx);
        const part = partOfStaff(loc.staff)!;
        const el = elemUnder(loc.staff, voiceForPitch(loc.staff, pitch), loc.mg.index, loc.lx);
        if (!el) return;
        if (mode !== 'input' || el.cont) {
          // Select mode: click picks the note or rest under the pointer (a whole rest is one thing).
          selectElem(el);
          if (!useStore.getState().playing) seekTo(el.t);
          return;
        }
        if (el.rest) {
          // Write mode on a rest: it becomes a note of the chosen value.
          fillRest(loc.staff, el.voice, el.t, pitch);
          return;
        }
        // Write mode on a note: click above/below adds to its chord; ⌥-click replaces it.
        if (chordPitchesAt(el).includes(pitch + part.transpose)) {
          selectElem(el);
          return;
        }
        if (e.altKey || part.drums) {
          doInsert(el.t, pitch, loc.staff, part.drums, el.t1 - el.t, el.voice);
          return;
        }
        const n = allNotes().find((x) => x.id === el.noteIds[0]);
        if (!n) return;
        const pl = placementFor(loc.staff)!;
        const id = insertNote(pl, el.t, n.duration, pitch, n.velocity, (n.voice ?? 1) as 1 | 2, true);
        getEngine().preview(part.track.id, pitch, n.velocity, Math.min(1, n.duration));
        useStore.setState({ selectedNoteIds: [id] });
        setRestSel(null);
        lastInsert.current = { t: el.t, dur: n.duration, pitch, staff: loc.staff };
        setAcc(null);
      },
      { threshold: 5 },
    );
  };

  /** Written pitches of the chord an element shows. */
  const chordPitchesAt = (el: ElemHit) => (layout?.heads ?? []).filter((h) => !h.grace && h.staff === el.staff && h.voice === el.voice && Math.abs(h.t - el.t) < 1e-3).map((h) => h.pitch);

  // ------------------------------------------------------------ cursor geometry


  // Box around the selected rest.
  const restEl = restSel ? elemAt(restSel.gi, restSel.voice, restSel.t) : undefined;
  const restBox = (() => {
    if (!restEl || !restEl.rest || !layout) return null;
    const sg = layout.systems[restEl.system]?.staves.find((x) => x.index === restEl.staff);
    if (!sg) return null;
    return { x0: restEl.x0, x1: restEl.x1, top: sg.topLineY - 6, h: sg.spacing * 4 + 12 };
  })();
  // After writing, the selection moves on; if a note sits where we land, select that note instead.
  useEffect(() => {
    if (!restSel || !layout) return;
    const el = elemAt(restSel.gi, restSel.voice, restSel.t);
    if (el && !el.rest) {
      setRestSel(null);
      useStore.setState({ selectedNoteIds: [...el.noteIds] });
    }
  });

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
      tempoMarks: tempoMarksFor(project, src),
      form: formFor(project, src),
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
    const xml = toMusicXml(src.model, project.name, src.labels, partKeys, project.timeSig, project.bpm, tempoMarksFor(project, src), formFor(project, src));
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
        <button title="Reset zoom" onClick={() => setZoom(full ? 0.85 : 1.15)}>
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
          <button className={mode === 'select' ? 'on' : ''} onClick={() => setMode('select')} data-tip="Select: click notes and rests to edit them" data-cmd="score.mode">
            <MousePointer2 size={13} /> Select
          </button>
          <button className={mode === 'input' ? 'on' : ''} onClick={() => setMode('input')} data-tip="Write: click rests and the staff to add notes" data-cmd="score.mode">
            <PenLine size={13} /> Write
          </button>
        </div>
        <div className="pal-group">
          {DURATIONS.map((d) => (
            <button key={d.v} className={'pal-btn' + (dur === d.v ? ' on' : '')} data-tip={d.label} data-cmd={`score.dur.${d.v}`} onClick={() => chooseDuration(d.v)}>
              <NoteIcon v={d.v} />
            </button>
          ))}
          <button className={'pal-btn' + (dotted ? ' on' : '')} data-tip="Dot — adds or removes the dot on the selection" data-cmd="score.dot" onClick={toggleDot}>
            <span style={{ fontSize: 22, lineHeight: 0.5 }}>•</span>
          </button>
          <button className={'pal-btn txt' + (triplet ? ' on' : '')} data-tip="Triplets — next notes are written as triplets" data-cmd="score.triplet" onClick={() => setTriplet(!triplet)}>
            <span className="tuplet-glyph">3</span>
          </button>
          <button
            className="pal-btn txt"
            data-tip="Turn the selected note into a rest" data-cmd="score.rest"
            onClick={() => {
              const ids = useStore.getState().selectedNoteIds;
              if (!ids.length) {
                toast('Select a note to turn it into a rest');
                return;
              }
              const first = currentElem();
              notesToRests(ids, staffFnForSelection());
              if (first) setRestSel({ gi: first.staff, voice: first.voice, t: first.t });
            }}
          >
            Rest
          </button>
        </div>
        <div className="pal-group" data-tip="Voice — voice 2 has stems down">
          {([1, 2] as const).map((v) => (
            <button
              key={v}
              className={'pal-btn txt voice-btn v' + v + (voice === v ? ' on' : '')}
              data-tip={`Voice ${v}${selectedIds.length ? ' — moves selected notes' : ''}`} data-cmd={`score.voice${v}`}
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
              data-tip={`${x.t} — on the selected notes, or the next note you write`} data-cmd={x.a === 1 ? 'score.sharp' : x.a === -1 ? 'score.flat' : undefined}
              onClick={() => accidental(x.a)}
            >
              {x.s}
            </button>
          ))}
          <button className="pal-btn txt" data-tip="Tie selected notes to the next" data-cmd="score.tie" onClick={() => selectedIds.length && tieNotes(selectedIds, effDur)}>
            <svg width="20" height="12" viewBox="0 0 20 12">
              <path d="M2 4 Q10 12 18 4" stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </button>
        </div>
        <div className="pal-group">
          <button className="pal-btn txt grace-btn" data-tip="Grace note — a quick note just before the selected note (move it with ↑/↓, Delete removes it)" data-cmd="score.grace" onClick={addGrace}>
            <svg width="20" height="22" viewBox="0 0 20 22">
              <ellipse cx="5.5" cy="16" rx="3.3" ry="2.4" transform="rotate(-22 5.5 16)" fill="currentColor" />
              <line x1="8.4" y1="15.5" x2="8.4" y2="4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8.4 4 q 4 2.5 3 6.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <line x1="4" y1="12" x2="13" y2="6" stroke="currentColor" strokeWidth="1.1" />
              <ellipse cx="15.5" cy="18" rx="3.6" ry="2.6" transform="rotate(-22 15.5 18)" fill="currentColor" opacity="0.45" />
            </svg>
          </button>
        </div>
        <div className="pal-group">
          <button
            className="pal-btn txt repeat-btn"
            data-tip="Repeats, 1st/2nd endings, Segno, Coda, D.S. and D.C. for the selected measure"
            onClick={(e) => {
              if (!src) return;
              const measure = currentElem()?.measure ?? 0;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              showContextMenu({ clientX: r.left, clientY: r.bottom + 4 }, [{ title: `Bar ${src.firstBar + measure}` }, ...formMenu(src.firstBar - 1 + measure)]);
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22">
              <line x1="3" y1="4" x2="3" y2="18" stroke="currentColor" strokeWidth="2.4" />
              <line x1="6.5" y1="4" x2="6.5" y2="18" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="10" cy="9" r="1.5" fill="currentColor" />
              <circle cx="10" cy="13" r="1.5" fill="currentColor" />
              <path d="M13 6 h6 M13 6 v4" stroke="currentColor" strokeWidth="1.1" fill="none" />
              <text x="14.2" y="17.5" fontSize="7" fontWeight="700" fill="currentColor">1.</text>
            </svg>
          </button>
        </div>
        <div className="pal-group" title="Build chords: add a note above each selected note">
          {[
            { st: 2, l: '+3', t: 'Add a 3rd above', c: 'score.add3' },
            { st: 4, l: '+5', t: 'Add a 5th above', c: 'score.add5' },
            { st: 5, l: '+6', t: 'Add a 6th above', c: 'score.add6' },
            { st: 7, l: '+8', t: 'Add an octave above', c: 'score.add8' },
            { st: -2, l: '−3', t: 'Add a 3rd below', c: 'score.below3' },
          ].map((x) => (
            <button key={x.l} className="pal-btn txt chord-btn" data-tip={x.t} data-cmd={x.c} onClick={() => addInterval(x.st)}>
              {x.l}
            </button>
          ))}
        </div>
        <div className="pal-group">
          {ARTICS.map((x) => (
            <button key={x.a} className={'pal-btn artic'} data-tip={`${x.label} — on the selected notes`} data-cmd={x.a === 'fermata' ? undefined : `score.${x.a}`} onClick={() => selectedIds.length && toggleArticulation(selectedIds, x.a)}>
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
          <button className="pal-btn txt" data-tip="Lyrics — type a syllable, Space for the next note, - for a hyphen" data-cmd="score.lyrics" onClick={() => startLyric()}>
            <Type size={14} />
          </button>
          <button className="pal-btn txt" data-tip="Chord symbol — type e.g. Am7, Space for the next beat, Tab for the next bar" data-cmd="score.chordSymbol" onClick={() => startChord()}>
            <Hash size={14} />
          </button>
        </div>
        <div className="pal-group">
          <button className="pal-btn txt" data-tip="Move up to the next note in the key" data-cmd="score.stepUp" onClick={() => diatonicSel(1)}>
            <ArrowUp size={14} />
          </button>
          <button className="pal-btn txt" data-tip="Move down to the next note in the key" data-cmd="score.stepDown" onClick={() => diatonicSel(-1)}>
            <ArrowDown size={14} />
          </button>
          <button className="pal-btn txt" data-tip="Up an octave" data-cmd="score.octaveUp" onClick={() => transposeSel((p) => p + 12)}>
            8va
          </button>
          <button className="pal-btn txt" data-tip="Down an octave" data-cmd="score.octaveDown" onClick={() => transposeSel((p) => p - 12)}>
            8vb
          </button>
          <button className="pal-btn txt" data-tip="Delete (leaves a rest)" data-cmd="edit.delete" onClick={() => selectedIds.length && notesToRests(selectedIds, staffFnForSelection())}>
            <Minus size={14} />
          </button>
        </div>
        <div className="score-hint faint">
          {mode === 'input'
            ? 'Click a rest to write a note there · click above/below a note for a chord · A–G types into the selected rest · 2–7 set the value · ⌥3/⌥5 add 3rd/5th'
            : 'Click a note or rest to select it · 2–7 change its value · A–G changes a note or fills a rest · Delete leaves a rest · ←/→ step through · drag to select several'}
        </div>
      </div>
      <div className="score-scroll" ref={scrollRef}>
        <div className="score-page" style={{ width: layout?.width, minHeight: layout?.height }}>
          <div
            ref={svgRef}
            className={'score-svg' + (mode === 'input' ? ' input' : '') + (overNote ? ' over-note' : '')}
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
            {box && <div className="score-box" style={{ left: box.x0, top: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0 }} />}
            {restBox && <div className="score-rest-sel" style={{ left: restBox.x0 - 5, top: restBox.top, width: restBox.x1 - restBox.x0 + 10, height: restBox.h }} />}
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
            <Playhead src={src} layout={layout} scrollRef={scrollRef} zoom={zoom} />
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

function Playhead({ src, layout, scrollRef, zoom }: { src: Source; layout: ScoreLayout | null; scrollRef: React.RefObject<HTMLDivElement | null>; zoom: number }) {
  const position = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  const cursor = useStore((s) => s.cursor);
  const pos = playing ? position : cursor;
  const tView = src.fromAbs(pos);
  let geom: { x: number; top: number; h: number } | null = null;
  if (tView !== null && layout) {
    const mm = measureAt(src.model, tView);
    for (const sys of layout.systems) {
      const mg = sys.measures.find((x) => x.index === mm.index);
      if (mg) {
        geom = { x: beatToX(mg, tView - mm.start, mm.len), top: sys.staves[0].topLineY - 20, h: sys.staves[sys.staves.length - 1].topLineY + 60 - sys.staves[0].topLineY };
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
