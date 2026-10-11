// Piano roll MIDI editor: canvas-rendered grid & notes with full mouse/keyboard editing,
// a velocity lane with dynamics tools, and a toolbar portalled into the editor header.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTwoFingerPan } from '../mobile/touchPan';
import { MousePointer2, Pencil, ZoomIn, ZoomOut, Music, BarChart3, Repeat, Magnet, Waves, Shuffle } from 'lucide-react';
import { grooveLabel } from '../../model/groove';
import GroovePanel from '../groove/GroovePanel';
import type { MidiRegion, Note, Track } from '../../model/types';
import { uid } from '../../model/defaults';
import { DRUM_NAMES, GRID_OPTIONS, beatsPerBar, inScale, isBlackKey, noteName, scaleOfKey, snap, snapFloor, snapToScale } from '../../model/music';
import { beginGesture, endGesture, findRegion, useStore, useTransport } from '../../state/store';
import { getEngine } from '../../audio/engine';
import { startDrag, clamp, isTyping } from '../common/drag';
import { comboOf, isKey } from '../keys/keymap';
import { HSlider } from '../common/controls';
import { showContextMenu, showPillMenu, type MenuItem } from '../common/menus';
import {
  applyDynamics,
  copyNotes,
  deleteSelectedNotes,
  duplicateSelectedNotes,
  editRegion,
  legato,
  pasteNotes,
  quantizeNotes,
  selectAllNotes,
  setVelocity,
  songToContent,
  transposeNotes,
  type Dynamics,
} from './pianoroll/ops';
import './pianoroll.css';

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;

const KEYS_W = 70;
const RULER_H = 24;
const VEL_NAMES: [string, number][] = [
  ['ppp', 0.12],
  ['pp', 0.25],
  ['p', 0.4],
  ['mp', 0.55],
  ['mf', 0.7],
  ['f', 0.82],
  ['ff', 0.92],
  ['fff', 1],
];

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [62, 207, 90];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function noteFill(rgb: [number, number, number], vel: number, selected: boolean): string {
  const k = 0.42 + 0.58 * vel;
  let [r, g, b] = rgb.map((c) => c * k);
  if (selected) [r, g, b] = [r, g, b].map((c) => c + (255 - c) * 0.35);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

type Zone = 'move' | 'left' | 'right';

interface Props {
  trackId: string;
  regionId: string;
}

export default function PianoRoll({ trackId, regionId }: Props) {
  const region = useStore((s) => findRegion(s.project, regionId)?.region) as MidiRegion | undefined;
  const track = useStore((s) => s.project?.tracks.find((t) => t.id === trackId));
  const project = useStore((s) => s.project)!;
  const selectedIds = useStore((s) => s.selectedNoteIds);

  if (!region || region.kind !== 'midi' || !track) return <div className="empty-state">Region not found</div>;
  return <PianoRollInner key={regionId} region={region} track={track} bpb={beatsPerBar(project.timeSig)} selectedIds={selectedIds} />;
}

function PianoRollInner({ region, track, bpb, selectedIds }: { region: MidiRegion; track: Track; bpb: number; selectedIds: string[] }) {
  const project = useStore((s) => s.project)!;
  const regionId = region.id;
  const isDrums = track.type === 'drums';
  const scale = useMemo(() => scaleOfKey(project.key), [project.key]);

  const [ppb, setPpb] = useState(64);
  const [rowH, setRowH] = useState(isDrums ? 18 : 14);
  const [tool, setTool] = useState<'pointer' | 'pencil'>('pointer');
  const [swingOpen, setSwingOpen] = useState(false);
  const [grid, setGrid] = useState(0.25);
  const [lenSel, setLenSel] = useState(0);
  const lastLen = useRef(isDrums ? 0.25 : 0.5);
  const [qStrength, setQStrength] = useState(1);
  const [scaleMode, setScaleMode] = useState(false);
  const [velLane, setVelLane] = useState(true);
  const [velH, setVelH] = useState(64);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [velPop, setVelPop] = useState<{ x: number; y: number } | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useTwoFingerPan(scrollRef, { wheelPerLn: 1 / Math.log(1.0018) });
  const gridCanvas = useRef<HTMLCanvasElement>(null);
  const keysCanvas = useRef<HTMLCanvasElement>(null);
  const rulerCanvas = useRef<HTMLCanvasElement>(null);
  const velCanvas = useRef<HTMLCanvasElement>(null);
  const didInit = useRef(false);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rgb = useMemo(() => hexToRgb(track.color), [track.color]);
  const contentEnd = region.loop ? region.contentLength : region.offset + region.length;
  const regionVisibleEnd = region.offset + region.length;
  const maxNoteEnd = region.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
  const totalBeats = Math.ceil((Math.max(contentEnd, regionVisibleEnd, maxNoteEnd) + bpb * 4) / bpb) * bpb;
  const songBase = region.start - region.offset; // absolute beat of content beat 0

  useLayoutEffect(() => setSlot(document.getElementById('editor-toolbar-slot')), []);

  // Resize tracking
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [velLane]);

  // Initial zoom & scroll to the notes.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || didInit.current || size.w === 0) return;
    didInit.current = true;
    const fitPpb = clamp(Math.floor((size.w - 30) / Math.max(bpb, contentEnd - region.offset)), 24, 140);
    setPpb(fitPpb);
    let mid: number;
    if (region.notes.length) {
      const lo = Math.min(...region.notes.map((n) => n.pitch));
      const hi = Math.max(...region.notes.map((n) => n.pitch));
      mid = (lo + hi) / 2;
    } else mid = isDrums ? 42 : 62;
    requestAnimationFrame(() => {
      el.scrollTop = Math.max(0, (127 - mid) * rowH - size.h / 2);
      el.scrollLeft = Math.max(0, region.offset * fitPpb - 10);
      setScroll({ x: el.scrollLeft, y: el.scrollTop });
    });
  }, [size, bpb, contentEnd, region.offset, region.notes, isDrums, rowH]);

  // Live-played notes on the keyboard
  useEffect(
    () =>
      getEngine().onLive((pitch, on, tid) => {
        if (tid !== track.id) return;
        setHeld((h) => {
          const n = new Set(h);
          if (on) n.add(pitch);
          else n.delete(pitch);
          return n;
        });
      }),
    [track.id],
  );

  const audition = useCallback((pitch: number, vel = 0.75) => getEngine().preview(track.id, pitch, vel, 0.4), [track.id]);

  // ------------------------------------------------------------------ drawing

  const prepCanvas = (c: HTMLCanvasElement | null, w: number, h: number) => {
    if (!c || w <= 0 || h <= 0) return null;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = w + 'px';
      c.style.height = h + 'px';
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  // Grid + notes
  useEffect(() => {
    const { w, h } = size;
    const ctx = prepCanvas(gridCanvas.current, w, h);
    if (!ctx) return;
    const sx = scroll.x;
    const sy = scroll.y;
    ctx.clearRect(0, 0, w, h);
    const pTop = Math.min(127, 127 - Math.floor(sy / rowH));
    const pBot = Math.max(0, 127 - Math.ceil((sy + h) / rowH));
    for (let p = pTop; p >= pBot; p--) {
      const y = (127 - p) * rowH - sy;
      const black = isBlackKey(p);
      let fill = black ? '#1d1d22' : '#26262c';
      if (!isDrums && scaleMode && inScale(p, scale)) fill = black ? '#232a33' : '#2a323c';
      if (isDrums && DRUM_NAMES[p]) fill = '#2a2a31';
      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, rowH);
      ctx.fillStyle = p % 12 === 0 ? '#3a3a44' : '#1a1a1e';
      ctx.fillRect(0, y + rowH - 1, w, 1);
    }
    // Inactive (outside region) shading
    const shade = (b0: number, b1: number, a: number) => {
      const x0 = b0 * ppb - sx;
      const x1 = b1 * ppb - sx;
      if (x1 <= 0 || x0 >= w) return;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(Math.max(0, x0), 0, Math.min(w, x1) - Math.max(0, x0), h);
    };
    if (region.loop) {
      shade(region.contentLength, regionVisibleEnd, 0.22);
      shade(Math.max(region.contentLength, regionVisibleEnd), totalBeats, 0.42);
    } else {
      shade(0, region.offset, 0.42);
      shade(regionVisibleEnd, totalBeats, 0.42);
    }
    // Vertical lines
    const b0 = Math.floor(sx / ppb);
    const b1 = Math.ceil((sx + w) / ppb);
    const sub = grid * ppb >= 7 ? grid : grid * ppb * 2 >= 7 ? grid * 2 : 0;
    if (sub && sub < 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let b = Math.floor(b0 / sub) * sub; b <= b1; b += sub) {
        if (Math.abs(b - Math.round(b)) < 1e-6) continue;
        ctx.fillRect(Math.round(b * ppb - sx), 0, 1, h);
      }
    }
    for (let b = b0; b <= b1; b++) {
      const abs = songBase + b;
      const isBar = Math.abs(((abs % bpb) + bpb) % bpb) < 1e-6;
      ctx.fillStyle = isBar ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(Math.round(b * ppb - sx), 0, 1, h);
    }
    // Loop end marker
    if (region.loop) {
      ctx.fillStyle = 'rgba(245,197,24,0.6)';
      ctx.fillRect(Math.round(region.contentLength * ppb - sx), 0, 2, h);
    }

    const drawNote = (n: Note, start: number, alpha: number, sel: boolean) => {
      const x = start * ppb - sx;
      const nw = Math.max(3, n.duration * ppb - 1);
      if (x > w || x + nw < 0) return;
      const y = (127 - n.pitch) * rowH - sy + 1;
      if (y > h || y + rowH < 0) return;
      const nh = rowH - 2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = noteFill(rgb, n.velocity, sel);
      ctx.beginPath();
      ctx.roundRect(x, y, nw, nh, Math.min(3, nh / 3));
      ctx.fill();
      ctx.strokeStyle = sel ? '#ffffff' : 'rgba(0,0,0,0.55)';
      ctx.lineWidth = sel ? 1.5 : 1;
      ctx.stroke();
      if (nh >= 11 && nw > 30 && alpha > 0.5) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = '600 9px -apple-system, sans-serif';
        ctx.fillText(isDrums ? (DRUM_NAMES[n.pitch] ?? noteName(n.pitch)) : noteName(n.pitch), x + 4, y + nh / 2 + 3.2, nw - 6);
      }
      ctx.globalAlpha = 1;
    };
    // Ghost repeats of looped content
    if (region.loop && region.contentLength > 0) {
      for (let k = 1; k * region.contentLength < regionVisibleEnd; k++) {
        const base = k * region.contentLength;
        for (const n of region.notes) {
          if (n.start >= region.contentLength) continue;
          if (base + n.start >= regionVisibleEnd) continue;
          drawNote(n, base + n.start, 0.28, false);
        }
      }
    }
    for (const n of region.notes) {
      const active = region.loop ? n.start < region.contentLength : n.start >= region.offset - 1e-6 && n.start < regionVisibleEnd;
      drawNote(n, n.start, active ? 1 : 0.4, selected.has(n.id));
    }
    if (marquee) {
      const x = Math.min(marquee.x0, marquee.x1) - sx;
      const y = Math.min(marquee.y0, marquee.y1) - sy;
      ctx.fillStyle = 'rgba(47,140,255,0.14)';
      ctx.strokeStyle = 'rgba(90,168,255,0.9)';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0));
      ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0));
    }
  }, [size, scroll, ppb, rowH, region, selected, marquee, grid, scaleMode, scale, rgb, isDrums, bpb, songBase, totalBeats, regionVisibleEnd]);

  // Keyboard
  useEffect(() => {
    const h = size.h;
    const ctx = prepCanvas(keysCanvas.current, KEYS_W, h);
    if (!ctx) return;
    const sy = scroll.y;
    ctx.clearRect(0, 0, KEYS_W, h);
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, KEYS_W, h);
    const pTop = Math.min(127, 127 - Math.floor(sy / rowH));
    const pBot = Math.max(0, 127 - Math.ceil((sy + h) / rowH));
    const accent = `rgb(${rgb.join(',')})`;
    for (let p = pTop; p >= pBot; p--) {
      const y = (127 - p) * rowH - sy;
      const on = held.has(p);
      if (isDrums) {
        const named = DRUM_NAMES[p];
        ctx.fillStyle = on ? accent : named ? '#2c2c33' : '#1f1f24';
        ctx.fillRect(0, y, KEYS_W, rowH);
        ctx.fillStyle = '#111114';
        ctx.fillRect(0, y + rowH - 1, KEYS_W, 1);
        if (rowH >= 10) {
          ctx.fillStyle = on ? '#000' : named ? '#e6e6ea' : '#6e6e78';
          ctx.font = `${named ? 600 : 400} 10px -apple-system, sans-serif`;
          ctx.fillText(named ?? noteName(p), 6, y + rowH / 2 + 3.5, KEYS_W - 10);
        }
        continue;
      }
      const black = isBlackKey(p);
      // white key body behind every row
      ctx.fillStyle = on && !black ? accent : '#ececf0';
      ctx.fillRect(0, y, KEYS_W, rowH);
      if (black) {
        ctx.fillStyle = on ? accent : '#1b1b1f';
        ctx.fillRect(0, y + 1, KEYS_W * 0.62, rowH - 2);
      }
      // separators between white keys (B/C and E/F boundaries, and midpoints of black keys)
      const pc = p % 12;
      if (pc === 0 || pc === 5) {
        ctx.fillStyle = '#9a9aa2';
        ctx.fillRect(0, y + rowH - 1, KEYS_W, 1);
      } else if (black) {
        ctx.fillStyle = '#b4b4bc';
        ctx.fillRect(KEYS_W * 0.62, y + rowH / 2, KEYS_W * 0.38, 1);
      }
      if (pc === 0 && rowH >= 9) {
        ctx.fillStyle = on ? '#000' : '#6a6a72';
        ctx.font = '600 9.5px -apple-system, sans-serif';
        ctx.fillText(noteName(p), KEYS_W - 24, y + rowH / 2 + 3.5);
      }
      if (scaleMode && inScale(p, scale) && !black) {
        ctx.fillStyle = 'rgba(47,140,255,0.9)';
        ctx.fillRect(KEYS_W - 3, y + 1, 3, rowH - 2);
      }
    }
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(KEYS_W - 1, 0, 1, h);
  }, [size, scroll.y, rowH, held, isDrums, rgb, scaleMode, scale]);

  // Ruler
  useEffect(() => {
    const w = size.w;
    const ctx = prepCanvas(rulerCanvas.current, w, RULER_H);
    if (!ctx) return;
    const sx = scroll.x;
    ctx.fillStyle = '#1e1e23';
    ctx.fillRect(0, 0, w, RULER_H);
    // Region extent band
    const bandStart = region.loop ? 0 : region.offset;
    const bandEnd = contentEnd;
    ctx.fillStyle = region.loop ? 'rgba(245,197,24,0.28)' : `rgba(${rgb.join(',')},0.28)`;
    ctx.fillRect(bandStart * ppb - sx, RULER_H - 7, (bandEnd - bandStart) * ppb, 7);
    ctx.fillStyle = region.loop ? '#f5c518' : `rgb(${rgb.join(',')})`;
    const hx = bandEnd * ppb - sx;
    ctx.beginPath();
    ctx.moveTo(hx, RULER_H);
    ctx.lineTo(hx - 7, RULER_H);
    ctx.lineTo(hx, RULER_H - 9);
    ctx.closePath();
    ctx.fill();
    const b0 = Math.floor(sx / ppb);
    const b1 = Math.ceil((sx + w) / ppb);
    ctx.font = '600 10.5px -apple-system, sans-serif';
    for (let b = b0; b <= b1; b++) {
      const abs = songBase + b;
      const x = Math.round(b * ppb - sx);
      const inBar = ((abs % bpb) + bpb) % bpb;
      if (Math.abs(inBar) < 1e-6) {
        ctx.fillStyle = '#7a7a84';
        ctx.fillRect(x, 4, 1, RULER_H - 4);
        ctx.fillStyle = '#d4d4da';
        ctx.fillText(String(Math.floor(abs / bpb) + 1), x + 4, 13);
      } else if (ppb >= 14) {
        ctx.fillStyle = '#4a4a52';
        ctx.fillRect(x, RULER_H - 7, 1, 7);
        if (ppb >= 48) {
          ctx.fillStyle = '#6a6a72';
          ctx.font = '9.5px -apple-system, sans-serif';
          ctx.fillText(`${Math.floor(abs / bpb) + 1}.${Math.round(inBar) + 1}`, x + 3, 13);
          ctx.font = '600 10.5px -apple-system, sans-serif';
        }
      }
    }
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, RULER_H - 1, w, 1);
  }, [size.w, scroll.x, ppb, region, contentEnd, songBase, bpb, rgb]);

  // Velocity lane
  useEffect(() => {
    if (!velLane) return;
    const w = size.w;
    const ctx = prepCanvas(velCanvas.current, w, velH);
    if (!ctx) return;
    const sx = scroll.x;
    ctx.fillStyle = '#1b1b1f';
    ctx.fillRect(0, 0, w, velH);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (const f of [0.25, 0.5, 0.75]) ctx.fillRect(0, Math.round(velH * (1 - f)), w, 1);
    const anySel = selected.size > 0;
    const sorted = [...region.notes].sort((a, b) => a.velocity - b.velocity);
    for (const n of sorted) {
      const x = n.start * ppb - sx;
      if (x < -6 || x > w + 6) continue;
      const hh = Math.max(2, n.velocity * (velH - 8));
      const sel = selected.has(n.id);
      ctx.globalAlpha = anySel && !sel ? 0.35 : 1;
      ctx.fillStyle = noteFill(rgb, n.velocity, sel);
      ctx.fillRect(x, velH - hh, 3, hh);
      ctx.beginPath();
      ctx.arc(x + 1.5, velH - hh, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, [velLane, size.w, velH, scroll.x, ppb, region.notes, selected, rgb]);

  // ------------------------------------------------------------------ helpers

  const getRegion = (): MidiRegion | undefined => {
    const f = findRegion(useStore.getState().project, regionId);
    return f?.region.kind === 'midi' ? f.region : undefined;
  };

  const localXY = (clientX: number, clientY: number) => {
    const el = scrollRef.current!;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    const y = clientY - rect.top + el.scrollTop;
    return { x, y, beat: x / ppb, pitch: clamp(127 - Math.floor(y / rowH), 0, 127) };
  };

  const hitTest = (x: number, y: number): { note: Note; zone: Zone } | null => {
    const r = getRegion();
    if (!r) return null;
    const pitch = 127 - Math.floor(y / rowH);
    for (let i = r.notes.length - 1; i >= 0; i--) {
      const n = r.notes[i];
      if (n.pitch !== pitch) continue;
      const nx = n.start * ppb;
      const nw = Math.max(3, n.duration * ppb - 1);
      if (x < nx - 1 || x > nx + nw + 2) continue;
      const edge = Math.min(7, nw / 3);
      if (x > nx + nw - edge) return { note: n, zone: 'right' };
      if (nw > 14 && x < nx + Math.min(5, nw / 4)) return { note: n, zone: 'left' };
      return { note: n, zone: 'move' };
    }
    return null;
  };

  const setSel = (ids: Iterable<string>) => useStore.setState({ selectedNoteIds: [...ids] });
  const noSnap = (ev: { ctrlKey: boolean; metaKey: boolean }) => ev.ctrlKey || ev.metaKey;
  const fixPitch = (p: number) => clamp(scaleMode && !isDrums ? snapToScale(p, scale) : p, 0, 127);

  const addNoteAt = (e: React.PointerEvent | React.MouseEvent, beat: number, pitch: number, dragToSize: boolean) => {
    const start = Math.max(0, snapFloor(beat, grid));
    const len = lenSel || lastLen.current;
    const n: Note = { id: uid('n'), pitch: fixPitch(pitch), start, duration: len, velocity: useStore.getState().velocity };
    editRegion(regionId, (r) => {
      r.notes.push(n);
    });
    setSel([n.id]);
    audition(n.pitch, n.velocity);
    if (dragToSize && 'pointerId' in e) {
      startDrag(e, ({ dx, event }) => {
        const end = start + len + dx / ppb;
        const d = noSnap(event) ? Math.max(0.03, end - start) : Math.max(grid, snap(end, grid) - start);
        editRegion(
          regionId,
          (r) => {
            const t = r.notes.find((x) => x.id === n.id);
            if (t) t.duration = d;
          },
          'live',
        );
        lastLen.current = d;
      });
    }
  };

  // ------------------------------------------------------------------ pointer on grid

  const onGridPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setVelPop(null);
    const { x, y, beat, pitch } = localXY(e.clientX, e.clientY);
    const hit = hitTest(x, y);
    if (!hit && tool === 'pencil') {
      e.preventDefault();
      addNoteAt(e, beat, pitch, true);
      return;
    }
    if (hit) {
      e.preventDefault();
      const st = useStore.getState();
      let sel = new Set(st.selectedNoteIds);
      const wasSelected = sel.has(hit.note.id);
      if (e.shiftKey) {
        if (wasSelected) sel.delete(hit.note.id);
        else sel.add(hit.note.id);
        setSel(sel);
        if (wasSelected) return;
      } else if (!wasSelected) sel = new Set([hit.note.id]);
      setSel(sel);
      audition(hit.note.pitch, hit.note.velocity);
      if (tool === 'pencil' && hit.zone === 'move' && e.detail >= 2) {
        // double click with pencil deletes the note
        deleteSelectedNotes(regionId);
        return;
      }
      startNoteDrag(e, hit, sel, wasSelected && !e.shiftKey);
      return;
    }
    // Marquee on empty space
    const base = e.shiftKey ? new Set(useStore.getState().selectedNoteIds) : new Set<string>();
    const x0 = x;
    const y0 = y;
    startDrag(
      e,
      ({ x: cx, y: cy }) => {
        const p = localXY(cx, cy);
        setMarquee({ x0, y0, x1: p.x, y1: p.y });
        const r = getRegion();
        if (!r) return;
        const bx0 = Math.min(x0, p.x) / ppb;
        const bx1 = Math.max(x0, p.x) / ppb;
        const pHi = 127 - Math.floor(Math.min(y0, p.y) / rowH);
        const pLo = 127 - Math.floor(Math.max(y0, p.y) / rowH);
        const ids = new Set(base);
        for (const n of r.notes) if (n.pitch >= pLo && n.pitch <= pHi && n.start < bx1 && n.start + n.duration > bx0) ids.add(n.id);
        setSel(ids);
      },
      ({ moved }) => {
        setMarquee(null);
        if (!moved && !e.shiftKey) setSel([]);
      },
      { threshold: 3 },
    );
  };

  const startNoteDrag = (e: React.PointerEvent, hit: { note: Note; zone: Zone }, sel: Set<string>, wasSelectedClick: boolean) => {
    const r = getRegion();
    if (!r) return;
    const orig = new Map<string, Note>();
    for (const n of r.notes) if (sel.has(n.id)) orig.set(n.id, { ...n });
    let moving = new Map<string, Note>(orig); // id being edited → original values
    let hitId = hit.note.id;
    const minStart = Math.min(...[...orig.values()].map((n) => n.start));
    let begun = false;
    let lastP = hit.note.pitch;
    const anchorTop = e.clientY;
    startDrag(
      e,
      ({ dx, dy, event }) => {
        if (!begun) {
          begun = true;
          beginGesture();
          if (event.altKey && hit.zone === 'move') {
            // Option-drag: leave originals, drag copies.
            const copies = new Map<string, Note>();
            const newNotes: Note[] = [];
            for (const [id, o] of orig) {
              const c = { ...o, id: uid('n') };
              copies.set(c.id, o);
              newNotes.push(c);
              if (id === hitId) hitId = c.id;
            }
            moving = copies;
            editRegion(
              regionId,
              (rr) => {
                rr.notes.push(...newNotes);
              },
              'live',
            );
            setSel(copies.keys());
          }
        }
        const ho = moving.get(hitId)!;
        if (hit.zone === 'move') {
          let delta = noSnap(event) ? dx / ppb : snap(ho.start + dx / ppb, grid) - ho.start;
          delta = Math.max(delta, -minStart);
          let dp = -Math.round(dy / rowH);
          dp = fixPitch(ho.pitch + dp) - ho.pitch;
          const maxP = Math.max(...[...moving.values()].map((n) => n.pitch));
          const minP = Math.min(...[...moving.values()].map((n) => n.pitch));
          dp = clamp(dp, -minP, 127 - maxP);
          editRegion(
            regionId,
            (rr) => {
              for (const n of rr.notes) {
                const o = moving.get(n.id);
                if (!o) continue;
                n.start = o.start + delta;
                n.pitch = o.pitch + dp;
              }
            },
            'live',
          );
          if (ho.pitch + dp !== lastP) {
            lastP = ho.pitch + dp;
            audition(lastP, ho.velocity);
          }
        } else if (hit.zone === 'right') {
          editRegion(
            regionId,
            (rr) => {
              for (const n of rr.notes) {
                const o = moving.get(n.id);
                if (!o) continue;
                const end = o.start + o.duration + dx / ppb;
                n.duration = noSnap(event) ? Math.max(0.03, end - o.start) : Math.max(grid, snap(end, grid) - o.start);
              }
            },
            'live',
          );
        } else {
          editRegion(
            regionId,
            (rr) => {
              for (const n of rr.notes) {
                const o = moving.get(n.id);
                if (!o) continue;
                const end = o.start + o.duration;
                let s = o.start + dx / ppb;
                if (!noSnap(event)) s = snap(s, grid);
                s = clamp(s, 0, end - (noSnap(event) ? 0.03 : Math.min(grid, o.duration)));
                n.start = s;
                n.duration = end - s;
              }
            },
            'live',
          );
        }
      },
      ({ moved }) => {
        if (begun) {
          endGesture();
          if (hit.zone !== 'move') {
            const n = getRegion()?.notes.find((x) => x.id === hitId);
            if (n) lastLen.current = n.duration;
          }
        }
        if (!moved && wasSelectedClick) {
          const r2 = getRegion();
          const n = r2?.notes.find((x) => x.id === hitId);
          const el = scrollRef.current!;
          const rect = el.getBoundingClientRect();
          const top = n ? rect.top + (127 - n.pitch) * rowH - el.scrollTop : anchorTop;
          showPillMenu(e.clientX, top, [
            { label: 'Cut', onClick: () => copyNotes(regionId, true) },
            { label: 'Copy', onClick: () => copyNotes(regionId, false) },
            { label: 'Delete', onClick: () => deleteSelectedNotes(regionId) },
            { label: 'Duplicate', onClick: () => duplicateSelectedNotes(regionId) },
            { label: 'Velocity', onClick: () => setVelPop({ x: e.clientX, y: top }) },
          ]);
        }
      },
      { threshold: 3 },
    );
  };

  const onGridHover = (e: React.PointerEvent) => {
    if (e.buttons) return;
    const el = scrollRef.current;
    if (!el) return;
    const { x, y } = localXY(e.clientX, e.clientY);
    const hit = hitTest(x, y);
    el.style.cursor = hit ? (hit.zone === 'move' ? (e.altKey ? 'copy' : 'grab') : hit.zone === 'right' ? 'e-resize' : 'w-resize') : tool === 'pencil' ? 'crosshair' : 'default';
  };

  const onGridDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'pencil') return;
    const { x, y, beat, pitch } = localXY(e.clientX, e.clientY);
    if (hitTest(x, y)) return;
    addNoteAt(e, beat, pitch, false);
  };

  const contextItems = (hitNote?: Note): MenuItem[] => {
    const hasSel = useStore.getState().selectedNoteIds.length > 0;
    const gridLabel = GRID_OPTIONS.find((g) => Math.abs(g.value - grid) < 1e-6)?.label ?? '';
    return [
      { label: 'Cut', cmd: 'edit.cut', disabled: !hasSel, onClick: () => copyNotes(regionId, true) },
      { label: 'Copy', cmd: 'edit.copy', disabled: !hasSel, onClick: () => copyNotes(regionId, false) },
      { label: 'Paste', cmd: 'edit.paste', disabled: useStore.getState().clipboard?.kind !== 'notes', onClick: () => doPaste() },
      { label: 'Duplicate', cmd: 'edit.duplicate', disabled: !hasSel, onClick: () => duplicateSelectedNotes(regionId) },
      { label: 'Delete', cmd: 'edit.delete', disabled: !hasSel, onClick: () => deleteSelectedNotes(regionId) },
      { separator: true },
      { label: `Quantize to ${gridLabel}`, cmd: 'pianoroll.quantize', onClick: () => quantizeNotes(regionId, grid, qStrength) },
      {
        label: 'Transpose',
        submenu: [
          { label: 'Up an Octave', onClick: () => transposeNotes(regionId, 12) },
          { label: 'Up a Semitone', onClick: () => transposeNotes(regionId, 1) },
          { label: 'Down a Semitone', onClick: () => transposeNotes(regionId, -1) },
          { label: 'Down an Octave', onClick: () => transposeNotes(regionId, -12) },
        ],
      },
      {
        label: 'Velocity',
        submenu: VEL_NAMES.map(([name, v]) => ({ label: `${name}  (${Math.round(v * 127)})`, onClick: () => setVelocity(regionId, v) })),
      },
      {
        label: 'Dynamics',
        submenu: [
          { label: 'Crescendo', onClick: () => applyDynamics(regionId, 'crescendo') },
          { label: 'Diminuendo', onClick: () => applyDynamics(regionId, 'diminuendo') },
          { label: 'Fade In', onClick: () => applyDynamics(regionId, 'fadein') },
          { label: 'Fade Out', onClick: () => applyDynamics(regionId, 'fadeout') },
          { label: 'Accent Beats', onClick: () => applyDynamics(regionId, 'accent') },
          { label: 'Humanize', onClick: () => applyDynamics(regionId, 'humanize') },
        ],
      },
      { label: 'Legato', onClick: () => legato(regionId) },
      { separator: true },
      { label: 'Select All', cmd: 'edit.selectAll', onClick: () => selectAllNotes(regionId) },
      ...(hitNote
        ? [{ label: `Select All ${isDrums ? (DRUM_NAMES[hitNote.pitch] ?? noteName(hitNote.pitch)) : noteName(hitNote.pitch)}`, onClick: () => selectAllNotes(regionId, hitNote.pitch) }]
        : []),
    ];
  };

  const onGridContextMenu = (e: React.MouseEvent) => {
    const { x, y } = localXY(e.clientX, e.clientY);
    const hit = hitTest(x, y);
    if (hit && !useStore.getState().selectedNoteIds.includes(hit.note.id)) setSel([hit.note.id]);
    showContextMenu(e, contextItems(hit?.note));
  };

  const doPaste = () => {
    const r = getRegion();
    if (!r) return;
    const c = songToContent(r, getEngine().position);
    const cb = useStore.getState().clipboard;
    pasteNotes(regionId, c !== null ? snapFloor(c, grid) : (cb?.anchor ?? 0));
  };

  // ------------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.focusArea !== 'editor' || s.dockTab !== 'editor' || s.modal || isTyping(e)) return;
      const k = e.key.toLowerCase();
      const hasSel = s.selectedNoteIds.length > 0;
      const combo = comboOf(e);
      const is = (id: string) => isKey(e, id, combo);
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      const move = (beats: number) => {
        const sel = new Set(s.selectedNoteIds);
        editRegion(regionId, (r) => {
          const minS = Math.min(...r.notes.filter((n) => sel.has(n.id)).map((n) => n.start));
          const st = Math.max(beats, -minS);
          for (const n of r.notes) if (sel.has(n.id)) n.start += st;
        });
      };
      const shiftPitch = (semis: number) => {
        transposeNotes(regionId, semis);
        const first = getRegion()?.notes.find((n) => n.id === s.selectedNoteIds[0]);
        if (first) audition(first.pitch);
      };
      if (is('edit.delete') && hasSel) {
        handled();
        deleteSelectedNotes(regionId);
      } else if (k === 'escape' && hasSel) {
        handled();
        setSel([]);
      } else if (hasSel && (is('notes.up') || is('notes.down'))) {
        handled();
        shiftPitch(is('notes.up') ? 1 : -1);
      } else if (hasSel && (is('notes.octaveUp') || is('notes.octaveDown'))) {
        handled();
        shiftPitch(is('notes.octaveUp') ? 12 : -12);
      } else if (hasSel && (is('pianoroll.left') || is('pianoroll.right'))) {
        handled();
        move((is('pianoroll.right') ? 1 : -1) * grid);
      } else if (hasSel && (is('pianoroll.barLeft') || is('pianoroll.barRight'))) {
        handled();
        move((is('pianoroll.barRight') ? 1 : -1) * bpb);
      } else if (is('edit.selectAll')) {
        handled();
        selectAllNotes(regionId);
      } else if (is('edit.copy') && hasSel) {
        handled();
        copyNotes(regionId, false);
      } else if (is('edit.cut') && hasSel) {
        handled();
        copyNotes(regionId, true);
      } else if (is('edit.paste') && s.clipboard?.kind === 'notes') {
        handled();
        doPaste();
      } else if (is('edit.duplicate') && hasSel) {
        handled();
        duplicateSelectedNotes(regionId);
      } else if (is('pianoroll.quantize') && !(s.musicalTyping && !e.metaKey && !e.ctrlKey && k.length === 1)) {
        handled();
        quantizeNotes(regionId, grid, qStrength);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId, grid, qStrength, bpb]);

  // ------------------------------------------------------------------ wheel zoom

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const beatAtMouse = (mx + el.scrollLeft) / ppb;
        const next = clamp(ppb * Math.pow(1.0018, -e.deltaY), 8, 400);
        setPpb(next);
        requestAnimationFrame(() => {
          el.scrollLeft = beatAtMouse * next - mx;
        });
      } else if (e.altKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const my = e.clientY - rect.top;
        const rowAtMouse = (my + el.scrollTop) / rowH;
        const next = clamp(Math.round(rowH * Math.pow(1.002, -e.deltaY)), 7, 34);
        setRowH(next);
        requestAnimationFrame(() => {
          el.scrollTop = rowAtMouse * next - my;
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ppb, rowH]);

  const zoomH = (f: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const center = (el.scrollLeft + el.clientWidth / 2) / ppb;
    const next = clamp(ppb * f, 8, 400);
    setPpb(next);
    requestAnimationFrame(() => (el.scrollLeft = center * next - el.clientWidth / 2));
  };

  // ------------------------------------------------------------------ keys / ruler / velocity interactions

  const onKeysPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current!;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pitchAt = (cy: number) => clamp(127 - Math.floor((cy - rect.top + el.scrollTop) / rowH), 0, 127);
    let p = pitchAt(e.clientY);
    const vel = clamp((e.clientX - rect.left) / KEYS_W, 0.3, 1);
    audition(p, vel);
    if (e.altKey || e.shiftKey) selectAllNotes(regionId, p);
    startDrag(e, ({ y }) => {
      const np = pitchAt(y);
      if (np !== p) {
        p = np;
        audition(p, vel);
      }
    });
  };

  const onRulerPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current!;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left + el.scrollLeft;
    const handleX = contentEnd * ppb;
    if (Math.abs(cx - handleX) < 8) {
      // Drag region / loop length
      const r0 = getRegion();
      if (!r0) return;
      beginGesture();
      startDrag(
        e,
        ({ dx, event }) => {
          let end = contentEnd + dx / ppb;
          end = noSnap(event) ? end : snap(end, grid >= 1 ? grid : 1);
          editRegion(
            regionId,
            (r) => {
              if (r.loop) r.contentLength = Math.max(0.25, end);
              else {
                r.length = Math.max(0.25, end - r.offset);
                r.contentLength = r.offset + r.length;
              }
            },
            'live',
          );
        },
        () => endGesture(),
      );
      return;
    }
    const seekTo = (clientX: number) => {
      const c = Math.max(0, (clientX - rect.left + el.scrollLeft) / ppb);
      getEngine().seek(Math.max(0, songBase + snap(c, grid)));
    };
    seekTo(e.clientX);
    startDrag(e, ({ x }) => seekTo(x));
  };

  const onVelPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = scrollRef.current!;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const toXV = (cx: number, cy: number) => ({ x: cx - rect.left + el.scrollLeft, v: clamp(1 - (cy - rect.top - 4) / (velH - 8), 0.02, 1) });
    const r = getRegion();
    if (!r) return;
    const sel = new Set(useStore.getState().selectedNoteIds);
    const pool = sel.size ? r.notes.filter((n) => sel.has(n.id)) : r.notes;
    let prev = toXV(e.clientX, e.clientY);
    beginGesture();
    const apply = (a: { x: number; v: number }, b: { x: number; v: number }) => {
      const lo = Math.min(a.x, b.x) - 4;
      const hi = Math.max(a.x, b.x) + 4;
      const ids = new Map<string, number>();
      for (const n of pool) {
        const nx = n.start * ppb + 1.5;
        if (nx < lo || nx > hi) continue;
        const t = b.x === a.x ? 1 : clamp((nx - a.x) / (b.x - a.x), 0, 1);
        ids.set(n.id, a.v + (b.v - a.v) * t);
      }
      if (!ids.size) return;
      editRegion(
        regionId,
        (rr) => {
          for (const n of rr.notes) {
            const v = ids.get(n.id);
            if (v !== undefined) n.velocity = v;
          }
        },
        'live',
      );
    };
    apply(prev, prev);
    startDrag(
      e,
      ({ x, y }) => {
        const cur = toXV(x, y);
        apply(prev, cur);
        prev = cur;
      },
      () => endGesture(),
    );
  };

  const onVelResize = (e: React.PointerEvent) => {
    const h0 = velH;
    startDrag(e, ({ dy }) => setVelH(clamp(h0 - dy, 40, 240)));
  };

  // ------------------------------------------------------------------ toolbar

  const selNotes = region.notes.filter((n) => selected.has(n.id));
  const avgVel = selNotes.length ? selNotes.reduce((a, n) => a + n.velocity, 0) / selNotes.length : useStore.getState().velocity;

  const dynMenu = (e: React.MouseEvent) =>
    showContextMenu(e, [
      { title: selNotes.length ? `Selected notes (${selNotes.length})` : 'All notes in region' },
      ...(
        [
          ['Crescendo', 'crescendo'],
          ['Diminuendo', 'diminuendo'],
          ['Fade In', 'fadein'],
          ['Fade Out', 'fadeout'],
          ['Accent Beats', 'accent'],
          ['Humanize', 'humanize'],
        ] as [string, Dynamics][]
      ).map(([label, k]) => ({ label, onClick: () => applyDynamics(regionId, k) })),
      { separator: true },
      ...VEL_NAMES.map(([name, v]) => ({ label: `Set ${name}`, onClick: () => setVelocity(regionId, v) })),
    ]);

  const toolbar = (
    <div className="pr-toolbar">
      <div className="seg">
        <button className={tool === 'pointer' ? 'on' : ''} title="Pointer tool — double-click to add notes" onClick={() => setTool('pointer')}>
          <MousePointer2 size={13} />
        </button>
        <button className={tool === 'pencil' ? 'on' : ''} title="Pencil tool — click to draw notes" onClick={() => setTool('pencil')}>
          <Pencil size={13} />
        </button>
      </div>
      <label className="pr-field" title="Snap grid (hold ⌘ while dragging to bypass)">
        <Magnet size={12} />
        <select value={grid} onChange={(e) => setGrid(parseFloat(e.target.value))}>
          {GRID_OPTIONS.map((g) => (
            <option key={g.label} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="pr-field" title="Length of new notes">
        <span className="faint">Len</span>
        <select value={lenSel} onChange={(e) => setLenSel(parseFloat(e.target.value))}>
          <option value={0}>Last</option>
          {GRID_OPTIONS.map((g) => (
            <option key={g.label} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <div className="row" style={{ gap: 2 }}>
        <button className="btn sm" data-tip="Quantize selected notes" data-cmd="pianoroll.quantize" onClick={() => quantizeNotes(regionId, grid, qStrength)}>
          Quantize
        </button>
        <select className="pr-mini" value={qStrength} title="Quantize strength" onChange={(e) => setQStrength(parseFloat(e.target.value))}>
          {[1, 0.75, 0.5, 0.25].map((v) => (
            <option key={v} value={v}>
              {v * 100}%
            </option>
          ))}
        </select>
      </div>
      {!isDrums && (
        <div className="row" style={{ gap: 2 }} title="Transpose selected (or all) notes">
          <button className="btn sm" onClick={() => transposeNotes(regionId, -12)}>
            −8va
          </button>
          <button className="btn sm" onClick={() => transposeNotes(regionId, -1)}>
            −1
          </button>
          <button className="btn sm" onClick={() => transposeNotes(regionId, 1)}>
            +1
          </button>
          <button className="btn sm" onClick={() => transposeNotes(regionId, 12)}>
            +8va
          </button>
        </div>
      )}
      <div className="row" style={{ gap: 6 }} title={selNotes.length ? 'Velocity of selected notes' : 'Velocity for new notes'}>
        <span className="faint" style={{ fontSize: 11 }}>
          Vel
        </span>
        <HSlider
          value={avgVel}
          min={0.02}
          max={1}
          width={64}
          undoable={selNotes.length > 0}
          onChange={(v) => {
            if (selNotes.length) setVelocity(regionId, v, 'live');
            else useStore.setState({ velocity: v });
          }}
        />
        <span className="mono faint" style={{ fontSize: 10.5, width: 22 }}>
          {Math.round(avgVel * 127)}
        </span>
      </div>
      <button className="btn sm" onClick={dynMenu} title="Dynamics: crescendo, diminuendo, fades…">
        <Waves size={13} /> Dynamics
      </button>
      <div style={{ position: 'relative' }}>
        <button className={'btn sm' + (swingOpen ? ' active' : '')} title="Swing: shuffle the in-between notes for a groovier feel" onClick={() => setSwingOpen(!swingOpen)}>
          <Shuffle size={13} /> Swing{region.groove !== undefined ? `: ${grooveLabel(region.groove)}` : project.groove ? `: Song (${grooveLabel(project.groove)})` : ''}
        </button>
        {swingOpen && <GroovePanel scope={{ kind: 'regions', ids: [regionId] }} placement="down-left" onClose={() => setSwingOpen(false)} />}
      </div>
      {!isDrums && (
        <button className={'btn sm icon' + (scaleMode ? ' active' : '')} title={`Scale: highlight & snap to ${project.key.mode} key`} onClick={() => setScaleMode(!scaleMode)}>
          <Music size={13} />
        </button>
      )}
      <button className={'btn sm icon' + (velLane ? ' active' : '')} title="Velocity lane" onClick={() => setVelLane(!velLane)}>
        <BarChart3 size={13} />
      </button>
      <button
        className={'btn sm icon' + (region.loop ? ' active' : '')}
        title="Loop region content"
        onClick={() =>
          editRegion(regionId, (r) => {
            r.loop = !r.loop;
            if (r.loop) r.contentLength = Math.max(0.25, r.offset + r.length);
          })
        }
      >
        <Repeat size={13} />
      </button>
      <div className="row" style={{ gap: 2 }}>
        <button className="btn sm icon" title="Zoom out (or ⌘ + scroll)" onClick={() => zoomH(1 / 1.3)}>
          <ZoomOut size={13} />
        </button>
        <button className="btn sm icon" title="Zoom in (or ⌘ + scroll)" onClick={() => zoomH(1.3)}>
          <ZoomIn size={13} />
        </button>
      </div>
    </div>
  );

  // ------------------------------------------------------------------ render

  return (
    <div className="pr-root">
      {slot ? createPortal(toolbar, slot) : toolbar}
      <div className="pr-top">
        <div className="pr-corner">
          <span className="faint">{isDrums ? 'Drums' : 'Notes'}</span>
        </div>
        <div className="pr-ruler" onPointerDown={onRulerPointerDown}>
          <canvas ref={rulerCanvas} />
        </div>
      </div>
      <div className="pr-mid">
        <div
          className="pr-keys"
          onPointerDown={onKeysPointerDown}
          onWheel={(e) => {
            if (scrollRef.current) scrollRef.current.scrollTop += e.deltaY;
          }}
        >
          <canvas ref={keysCanvas} />
        </div>
        <div className="pr-gridwrap">
          <canvas ref={gridCanvas} className="pr-gridcanvas" />
          <div
            ref={scrollRef}
            className="pr-scroll"
            onScroll={(e) => {
              const t = e.currentTarget;
              setScroll({ x: t.scrollLeft, y: t.scrollTop });
            }}
            onPointerDown={onGridPointerDown}
            onPointerMove={onGridHover}
            onDoubleClick={onGridDoubleClick}
            onContextMenu={onGridContextMenu}
          >
            <div style={{ width: totalBeats * ppb, height: 128 * rowH }} />
          </div>
          <Playhead region={region} ppb={ppb} scrollX={scroll.x} scrollRef={scrollRef} />
        </div>
      </div>
      {velLane && (
        <div className="pr-vel" style={{ height: velH }}>
          <div className="pr-vel-resize" onPointerDown={onVelResize} />
          <div className="pr-vel-label">
            <span>Velocity</span>
          </div>
          <div className="pr-vel-canvas" onPointerDown={onVelPointerDown}>
            <canvas ref={velCanvas} />
          </div>
        </div>
      )}
      {velPop && <VelocityPopover x={velPop.x} y={velPop.y} regionId={regionId} onClose={() => setVelPop(null)} />}
    </div>
  );
}

function Playhead({ region, ppb, scrollX, scrollRef }: { region: MidiRegion; ppb: number; scrollX: number; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const position = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  const cursor = useStore((s) => s.cursor);
  const pos = playing ? position : cursor;
  const c = songToContent(region, pos);
  const x = c === null ? null : c * ppb - scrollX;
  useEffect(() => {
    const el = scrollRef.current;
    if (!playing || x === null || !el) return;
    if (x > el.clientWidth - 30 || x < 0) el.scrollLeft = Math.max(0, c! * ppb - 40);
  }, [x, playing, c, ppb, scrollRef]);
  if (x === null || x < -2) return null;
  return <div className="pr-playhead" style={{ transform: `translateX(${x}px)` }} />;
}

function VelocityPopover({ x, y, regionId, onClose }: { x: number; y: number; regionId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const region = useStore((s) => findRegion(s.project, regionId)?.region) as MidiRegion | undefined;
  const sel = useStore((s) => s.selectedNoteIds);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', close), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
    };
  }, [onClose]);
  const notes = region?.notes.filter((n) => sel.includes(n.id)) ?? [];
  const v = notes.length ? notes.reduce((a, n) => a + n.velocity, 0) / notes.length : 0.8;
  return (
    <div ref={ref} className="pr-velpop" style={{ left: clamp(x - 110, 6, window.innerWidth - 230), top: Math.max(6, y - 64) }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>Velocity</span>
        <span className="mono dim">{Math.round(v * 127)}</span>
      </div>
      <HSlider value={v} min={0.02} max={1} width={200} onChange={(nv) => setVelocity(regionId, nv, 'live')} />
      <div className="row" style={{ gap: 3, marginTop: 8 }}>
        {VEL_NAMES.map(([name, val]) => (
          <button key={name} className="btn sm" style={{ padding: '0 5px', fontStyle: 'italic', fontFamily: 'Georgia, serif' }} onClick={() => setVelocity(regionId, val)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
