// Sheet-music editor (MuseScore / Flat style) over the same MIDI notes the piano roll edits.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer2, PenLine, Plus, Minus, Printer, FileDown, ZoomIn, ZoomOut, ArrowUp, ArrowDown } from 'lucide-react';
import type { MidiRegion, Note } from '../../model/types';
import { beginGesture, endGesture, findRegion, live, draftRegion, useStore, useTransport } from '../../state/store';
import { beatsPerBar, noteName } from '../../model/music';
import { getPreset } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import { download, safeFileName } from '../../audio/export';
import { isTyping, startDrag } from '../common/drag';
import { buildScore, chooseStaves, diatonicShift, pitchFromDiatonic, staffOf, viewNotes, DYNAMICS, type ClefMode } from './score/notation';
import { beatToX, renderScore, topLineDiatonic, xToBeat, type ScoreLayout } from './score/render';
import { addBars, deleteNotes, insertNote, insertRest, mapNotes, pasteNotes, rampVelocity, setDuration, tieNotes, viewOf } from './score/edits';
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
  pitch: number;
  ledger: number[];
  label: string;
}

export default function ScoreEditor({ trackId, regionId }: { trackId: string; regionId: string }) {
  const project = useStore((s) => s.project)!;
  const selectedIds = useStore((s) => s.selectedNoteIds);
  const found = findRegion(project, regionId);
  const region = found?.region as MidiRegion | undefined;
  const track = found?.track ?? project.tracks.find((t) => t.id === trackId);

  const [mode, setMode] = useState<'select' | 'input'>('input');
  const [dur, setDur] = useState(1);
  const [dotted, setDotted] = useState(false);
  const [acc, setAcc] = useState<number | null>(null);
  const [dyn, setDyn] = useState('mf');
  const [grid, setGrid] = useState(0.25);
  const [clefMode, setClefMode] = useState<ClefMode>('auto');
  const [zoom, setZoom] = useState(1);
  const [showDyn, setShowDyn] = useState(true);
  const [cursor, setCursor] = useState<{ t: number; staff: number }>({ t: 0, staff: 0 });
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [width, setWidth] = useState(900);
  const [layout, setLayout] = useState<ScoreLayout | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const lastInsert = useRef<{ t: number; dur: number; pitch: number } | null>(null);

  const effDur = dotted ? dur * 1.5 : dur;
  const bpb = beatsPerBar(project.timeSig);
  const velocity = DYNAMICS.find((d) => d.mark === dyn)?.vel ?? 0.64;

  useEffect(() => {
    setSlot(document.getElementById('editor-toolbar-slot'));
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(500, el.clientWidth - 48)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const model = useMemo(() => {
    if (!region) return null;
    const v = viewNotes(region, grid);
    const preset = track ? getPreset(track.instrument) : undefined;
    const staves = chooseStaves(clefMode, v.notes, preset?.range);
    return buildScore(v.notes, staves, bpb, v.viewLen, v.viewStart, 1);
  }, [region, grid, clefMode, bpb, track]);

  const selKey = selectedIds.join(',');
  const firstBar = region ? Math.floor(region.start / bpb + 1e-6) + 1 : 1;
  useLayoutEffect(() => {
    if (!model || !svgRef.current) return;
    try {
      const l = renderScore(svgRef.current, model, width, zoom, {
        key: project.key,
        timeSig: project.timeSig,
        selected: new Set(selKey ? selKey.split(',') : []),
        firstBarNumber: firstBar,
        showDynamics: showDyn,
      });
      setLayout(l);
    } catch (e) {
      console.error('score render failed', e);
    }
  }, [model, width, zoom, selKey, project.key, project.timeSig, firstBar, showDyn]);

  // ------------------------------------------------------------ geometry helpers

  const locate = useCallback(
    (clientX: number, clientY: number) => {
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
      if (b.d > 80) return null;
      const sys = layout.systems[b.si];
      const sg = sys.staves[b.st];
      const mg = sys.measures.find((m) => lx >= m.x && lx < m.x + m.w) ?? (lx < sys.measures[0].x ? sys.measures[0] : sys.measures[sys.measures.length - 1]);
      const step = Math.round((ly - sg.topLineY) / (sg.spacing / 2));
      const dIdx = topLineDiatonic(sg.kind) - step;
      const tm = xToBeat(mg, lx, bpb);
      return { lx, ly, sys, sg, staff: b.st, mg, step, dIdx, tm };
    },
    [layout, model, zoom, bpb],
  );

  const snapInput = (tm: number) => {
    const g = Math.min(effDur, 1);
    let t = Math.floor(tm / g + 0.3) * g;
    t = Math.max(0, Math.min(t, bpb - Math.min(effDur, bpb)));
    return t;
  };

  const headAt = (lx: number, ly: number) => {
    if (!layout) return null;
    let best: (typeof layout.heads)[number] | null = null;
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

  // ------------------------------------------------------------ editing

  const doInsert = (t: number, pitch: number, staff: number, chord: boolean, d = effDur) => {
    if (!model || !track) return;
    const id = insertNote(regionId, t, d, pitch, velocity, model.staves, chord);
    getEngine().preview(track.id, pitch, velocity, d);
    useStore.setState({ selectedNoteIds: [id] });
    lastInsert.current = { t, dur: d, pitch };
    setCursor({ t: t + d, staff });
    setAcc(null);
  };

  const selectedNotes = (): Note[] => (region ? region.notes.filter((n) => selectedIds.includes(n.id)) : []);

  const transposeSel = (fn: (p: number) => number) => {
    const ids = useStore.getState().selectedNoteIds;
    if (!ids.length) return;
    mapNotes(regionId, ids, (n) => {
      n.pitch = Math.max(0, Math.min(127, fn(n.pitch)));
    });
    const first = useStore.getState().project && findRegion(useStore.getState().project, regionId)?.region;
    if (first?.kind === 'midi' && track) {
      const n = first.notes.find((x) => x.id === ids[0]);
      if (n) getEngine().preview(track.id, n.pitch, n.velocity, Math.min(n.duration, 1));
    }
  };

  const applyDynamic = (mark: string) => {
    setDyn(mark);
    const v = DYNAMICS.find((d) => d.mark === mark)!.vel;
    const ids = useStore.getState().selectedNoteIds;
    if (ids.length)
      mapNotes(regionId, ids, (n) => {
        n.velocity = v;
      });
  };

  const chooseDuration = (v: number) => {
    setDur(v);
    const ids = useStore.getState().selectedNoteIds;
    if (mode === 'select' && ids.length) setDuration(regionId, ids, dotted ? v * 1.5 : v);
  };

  // ------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.focusArea !== 'editor' || s.modal || isTyping(e) || !region || !model || !track) return;
      const key = e.key;
      const lower = key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      const ids = s.selectedNoteIds;
      let handled = true;

      if (mod && lower === 'a') {
        useStore.setState({ selectedNoteIds: region.notes.map((n) => n.id) });
      } else if (mod && lower === 'c') {
        noteClipboard = selectedNotes().map((n) => ({ ...n }));
      } else if (mod && lower === 'x') {
        noteClipboard = selectedNotes().map((n) => ({ ...n }));
        deleteNotes(regionId, ids);
      } else if (mod && lower === 'v') {
        const sel = selectedNotes();
        const { viewStart } = viewOf(region);
        const at = sel.length ? Math.max(...sel.map((n) => n.start + n.duration)) - viewStart : cursor.t;
        const newIds = pasteNotes(regionId, noteClipboard, at);
        useStore.setState({ selectedNoteIds: newIds });
      } else if (mod && (key === 'ArrowUp' || key === 'ArrowDown')) {
        transposeSel((p) => p + (key === 'ArrowUp' ? 12 : -12));
      } else if (mod) {
        handled = false;
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
        if (mode === 'input') {
          insertRest(regionId, cursor.t, effDur, cursor.staff, model.staves);
          setCursor({ t: cursor.t + effDur, staff: cursor.staff });
        } else if (ids.length) deleteNotes(regionId, ids);
      } else if (key === '+' || key === '=') {
        if (ids.length) tieNotes(regionId, ids, effDur);
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        const dir = key === 'ArrowUp' ? 1 : -1;
        if (e.altKey) transposeSel((p) => diatonicShift(p, dir, project.key));
        else transposeSel((p) => p + dir);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const dir = key === 'ArrowLeft' ? -1 : 1;
        const sorted = [...region.notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
        if (ids.length) {
          const cur = sorted.findIndex((n) => n.id === ids[ids.length - 1]);
          const next = sorted[Math.max(0, Math.min(sorted.length - 1, cur + dir))];
          if (next) {
            const extend = e.shiftKey ? ids.filter((i) => i !== next.id) : [];
            useStore.setState({ selectedNoteIds: [...extend, next.id] });
            const { viewStart } = viewOf(region);
            setCursor({ t: next.start - viewStart + next.duration, staff: staffOf(next.pitch, model.staves) });
          }
        } else setCursor({ t: Math.max(0, cursor.t + dir * effDur), staff: cursor.staff });
      } else if (key === 'Delete' || key === 'Backspace') {
        if (ids.length) deleteNotes(regionId, ids);
        else if (mode === 'input') {
          const { viewStart } = viewOf(region);
          const prev = region.notes
            .filter((n) => n.start - viewStart < cursor.t - 1e-6 && staffOf(n.pitch, model.staves) === cursor.staff)
            .sort((a, b) => b.start - a.start)[0];
          if (prev) {
            deleteNotes(regionId, [prev.id]);
            setCursor({ t: prev.start - viewStart, staff: cursor.staff });
          }
        }
      } else if (/^[a-g]$/.test(lower) && !e.altKey) {
        const letter = 'cdefgab'.indexOf(lower);
        const nearest = (ref: number) => {
          let b = ref;
          let bd2 = Infinity;
          for (let oct = 0; oct < 10; oct++) {
            const p = pitchFromDiatonic(oct * 7 + letter, project.key, acc);
            if (Math.abs(p - ref) < bd2) {
              bd2 = Math.abs(p - ref);
              b = p;
            }
          }
          return b;
        };
        if (mode === 'select' && ids.length && !e.shiftKey) {
          // Re-pitch the selected notes, keeping their rhythm.
          mapNotes(regionId, ids, (n) => {
            n.pitch = nearest(n.pitch);
          });
          const first = region.notes.find((n) => n.id === ids[0]);
          if (first) getEngine().preview(track.id, nearest(first.pitch), first.velocity, 0.5);
          setAcc(null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (mode === 'select') setMode('input');
        const ref = lastInsert.current?.pitch ?? (model.staves[cursor.staff] === 'bass' ? 50 : 67);
        let best = 0;
        let bd = Infinity;
        for (let oct = 0; oct < 10; oct++) {
          const p = pitchFromDiatonic(oct * 7 + letter, project.key, acc);
          const d = e.shiftKey ? (p > ref ? p - ref : Infinity) : Math.abs(p - ref);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (e.shiftKey && lastInsert.current) {
          const li = lastInsert.current;
          const id = insertNote(regionId, li.t, li.dur, best, velocity, model.staves, true);
          getEngine().preview(track.id, best, velocity, li.dur);
          useStore.setState({ selectedNoteIds: [id] });
          lastInsert.current = { ...li, pitch: best };
          setAcc(null);
        } else {
          doInsert(cursor.t, best, staffOf(best, model.staves), false);
        }
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
    if (mode !== 'input' || e.buttons) {
      if (ghost) setGhost(null);
      return;
    }
    const loc = locate(e.clientX, e.clientY);
    if (!loc) return setGhost(null);
    const t = snapInput(loc.tm);
    const pitch = pitchFromDiatonic(loc.dIdx, project.key, acc);
    const x = beatToX(loc.mg, t, bpb);
    const y = loc.sg.topLineY + loc.step * (loc.sg.spacing / 2);
    const ledger: number[] = [];
    if (loc.step < 0) for (let s = -2; s >= loc.step; s -= 2) ledger.push(loc.sg.topLineY + s * (loc.sg.spacing / 2));
    if (loc.step > 8) for (let s = 10; s <= loc.step; s += 2) ledger.push(loc.sg.topLineY + s * (loc.sg.spacing / 2));
    setGhost({ x, y, pitch, ledger, label: noteName(pitch, acc === -1) });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !model || !track || !region) return;
    const loc = locate(e.clientX, e.clientY);
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
      const n0 = region.notes.find((n) => n.id === head.noteId);
      if (n0) getEngine().preview(track.id, n0.pitch, n0.velocity, Math.min(1, n0.duration));
      const orig = new Map(region.notes.filter((n) => ids.includes(n.id)).map((n) => [n.id, n.pitch]));
      let lastSteps = 0;
      let began = false;
      const half = (loc.sg.spacing / 2) * zoom;
      startDrag(
        e,
        ({ dy }) => {
          const steps = Math.round(-dy / half);
          if (steps === lastSteps) return;
          if (!began) {
            beginGesture();
            began = true;
          }
          lastSteps = steps;
          live((d) => {
            const r = draftRegion(d, regionId);
            if (r?.kind !== 'midi') return;
            for (const n of r.notes) {
              const o = orig.get(n.id);
              if (o !== undefined) n.pitch = Math.max(0, Math.min(127, diatonicShift(o, steps, project.key)));
            }
          });
          const o = orig.get(head.noteId);
          if (o !== undefined) getEngine().preview(track.id, diatonicShift(o, steps, project.key), 0.7, 0.4);
        },
        () => began && endGesture(),
        { threshold: 3 },
      );
      return;
    }
    if (mode === 'input') {
      const t = loc.mg.index * bpb + snapInput(loc.tm);
      const pitch = pitchFromDiatonic(loc.dIdx, project.key, acc);
      doInsert(t, pitch, loc.staff, e.shiftKey);
    } else {
      if (!e.shiftKey) useStore.setState({ selectedNoteIds: [] });
      setCursor({ t: loc.mg.index * bpb + snapInput(loc.tm), staff: loc.staff });
    }
  };

  // ------------------------------------------------------------ cursor geometry

  const geomFor = (t: number, staff: number) => {
    if (!layout) return null;
    const m = Math.floor(t / bpb + 1e-9);
    for (const sys of layout.systems) {
      const mg = sys.measures.find((x) => x.index === m);
      if (!mg) continue;
      const sg = sys.staves[Math.min(staff, sys.staves.length - 1)];
      return { x: beatToX(mg, t - m * bpb, bpb), top: sg.topLineY - 12, h: sg.spacing * 4 + 24, sys };
    }
    return null;
  };
  const cursorGeom = mode === 'input' ? geomFor(cursor.t, cursor.staff) : null;

  // ------------------------------------------------------------ export

  const title = `${project.name} — ${track?.name ?? ''}`;
  const printScore = () => {
    if (!model) return;
    const tmp = document.createElement('div');
    renderScore(tmp, model, 760, 1, { key: project.key, timeSig: project.timeSig, selected: new Set(), firstBarNumber: firstBar, showDynamics: showDyn, title });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>${title}</title><style>body{margin:0;padding:24px;background:white}svg{width:100%;height:auto}@page{margin:12mm}</style></head><body>${tmp.innerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  const exportXml = () => {
    if (!model) return;
    const xml = toMusicXml(model, project.name, track?.name ?? 'Part', project.key, project.timeSig);
    download(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }), `${safeFileName(project.name)} - ${safeFileName(track?.name ?? 'part')}.musicxml`);
  };

  if (!region || !model) return <div className="empty-state">Region not found</div>;

  const toolbar = (
    <div className="score-tools">
      <select value={clefMode} onChange={(e) => setClefMode(e.target.value as ClefMode)} title="Staff / clef">
        <option value="auto">Auto staff</option>
        <option value="treble">Treble clef</option>
        <option value="bass">Bass clef</option>
        <option value="grand">Grand staff</option>
      </select>
      <select value={grid} onChange={(e) => setGrid(parseFloat(e.target.value))} title="Display quantization">
        <option value={0.5}>Quantize 1/8</option>
        <option value={0.25}>Quantize 1/16</option>
        <option value={0.125}>Quantize 1/32</option>
      </select>
      <label className="row" style={{ gap: 4, fontSize: 12 }} title="Show dynamics & hairpins">
        <input type="checkbox" checked={showDyn} onChange={(e) => setShowDyn(e.target.checked)} /> Dynamics
      </label>
      <div className="seg">
        <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>
          <ZoomOut size={14} />
        </button>
        <button title="Reset zoom" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button title="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
          <ZoomIn size={14} />
        </button>
      </div>
      <button className="btn sm" onClick={() => addBars(regionId, 4)} title="Add 4 measures to this region">
        <Plus size={13} /> Bars
      </button>
      <button className="btn sm" onClick={printScore} title="Print or save as PDF">
        <Printer size={13} /> Print / PDF
      </button>
      <button className="btn sm" onClick={exportXml} title="Export MusicXML (open in MuseScore, Sibelius, Finale…)">
        <FileDown size={13} /> MusicXML
      </button>
    </div>
  );

  return (
    <div className="score-editor">
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
          <button
            className="pal-btn txt"
            title="Rest (0)"
            onClick={() => {
              insertRest(regionId, cursor.t, effDur, cursor.staff, model.staves);
              setCursor({ t: cursor.t + effDur, staff: cursor.staff });
            }}
          >
            Rest
          </button>
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
          <button className="pal-btn txt" title="Tie selected notes to the next (+)" onClick={() => selectedIds.length && tieNotes(regionId, selectedIds, effDur)}>
            <svg width="20" height="12" viewBox="0 0 20 12">
              <path d="M2 4 Q10 12 18 4" stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </button>
        </div>
        <div className="pal-group">
          {DYNAMICS.map((d) => (
            <button key={d.mark} className={'pal-btn dyn' + (dyn === d.mark ? ' on' : '')} title={`Dynamic ${d.mark} — selected notes & new notes`} onClick={() => applyDynamic(d.mark)}>
              {d.mark}
            </button>
          ))}
          <button className="pal-btn txt" title="Crescendo across selected notes" onClick={() => rampVelocity(regionId, selectedIds, 1)}>
            <svg width="22" height="12" viewBox="0 0 22 12">
              <path d="M20 1 L2 6 L20 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          <button className="pal-btn txt" title="Diminuendo across selected notes" onClick={() => rampVelocity(regionId, selectedIds, -1)}>
            <svg width="22" height="12" viewBox="0 0 22 12">
              <path d="M2 1 L20 6 L2 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
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
          <button className="pal-btn txt" title="Delete selected (Delete)" onClick={() => selectedIds.length && deleteNotes(regionId, selectedIds)}>
            <Minus size={14} />
          </button>
        </div>
        <div className="score-hint faint">
          {mode === 'input' ? 'Click the staff or type A–G to write · Shift+letter adds to chord · 2–7 durations · ↑↓ transpose' : 'Click notes to select · drag to change pitch · ⌘A select all'}
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
            {cursorGeom && <div className="score-cursor" style={{ left: cursorGeom.x - 3, top: cursorGeom.top, height: cursorGeom.h }} />}
            {ghost && (
              <>
                {ghost.ledger.map((y, i) => (
                  <div key={i} className="score-ghost-ledger" style={{ left: ghost.x - 4, top: y }} />
                ))}
                <div className="score-ghost" style={{ left: ghost.x, top: ghost.y - 4.5 }} />
                <div className="score-ghost-label" style={{ left: ghost.x + 16, top: ghost.y - 9 }}>
                  {ghost.label}
                </div>
              </>
            )}
            <Playhead region={region} layout={layout} bpb={bpb} scrollRef={scrollRef} zoom={zoom} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Playhead({ region, layout, bpb, scrollRef, zoom }: { region: MidiRegion; layout: ScoreLayout | null; bpb: number; scrollRef: React.RefObject<HTMLDivElement | null>; zoom: number }) {
  const position = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  const cursor = useStore((s) => s.cursor);
  const pos = playing ? position : cursor;
  let tView: number | null = null;
  const rel = pos - region.start;
  if (rel >= 0 && rel < region.length) {
    tView = region.loop ? (((rel + region.offset) % region.contentLength) + region.contentLength) % region.contentLength : rel;
  }
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
  const top = geom?.top;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || top === undefined || !playing) return;
    const y = top * zoom;
    if (y < el.scrollTop || y > el.scrollTop + el.clientHeight - 120) el.scrollTo({ top: Math.max(0, y - 30), behavior: 'smooth' });
  }, [top, playing, scrollRef, zoom]);
  if (!geom) return null;
  return <div className="score-playhead" style={{ left: geom.x, top: geom.top, height: geom.h }} />;
}
