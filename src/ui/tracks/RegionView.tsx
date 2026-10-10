import { drummerFor } from '../../model/drummer';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Repeat } from 'lucide-react';
import type { AudioRegion, MidiRegion, Region, TrackType } from '../../model/types';
import { placedNotes, regionSegments } from '../../model/regions';
import { DRUM_LANES } from '../../model/music';
import { commit, draftRegion, useStore } from '../../state/store';
import { getPeaks, getBuffer, onAudioChange } from '../../audio/audioStore';
import { closeMenus, showContextMenu, showPillMenu } from '../common/menus';

let pillTimer: ReturnType<typeof setTimeout> | null = null;
import { dragFade, dragLoop, dragMove, dragResizeLeft, dragResizeRight } from './regionOps';
import { openRegionEditor, regionMenu, regionPillItems } from './menus';
import { useTracksUi } from './tracksUi';

const NAME_H = 16;

interface Props {
  region: Region;
  trackId: string;
  trackType: TrackType;
  color: string;
  ppb: number;
  height: number;
  bpm: number;
}

/** One shared observer: previews only redraw while (nearly) on screen. */
const visibleCbs = new WeakMap<Element, (v: boolean) => void>();
let observer: IntersectionObserver | null = null;
function observe(el: Element, cb: (v: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    cb(true);
    return () => {};
  }
  observer ??= new IntersectionObserver((entries) => entries.forEach((e) => visibleCbs.get(e.target)?.(e.isIntersecting)), { rootMargin: '300px' });
  visibleCbs.set(el, cb);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    visibleCbs.delete(el);
  };
}

/** Resolved note colours, keyed by region colour + state (avoids a style recalc per canvas). */
const fillCache = new Map<string, string>();
const geoId = new WeakMap<object, number>();
let geoSeq = 0;

/** Canvas preview of a MIDI region's notes (thousands of notes stay cheap to redraw on zoom). */
function MidiPreview({ r, ppb, h, drums, tone }: { r: MidiRegion; ppb: number; h: number; drums: boolean; tone: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Geometry in beats / normalised pitch rows — independent of zoom.
  const geo = useMemo(() => {
    const notes = placedNotes(r);
    const segs = regionSegments(r);
    const rects: number[] = []; // [beatX, row0..1, beatW, rowH, alpha] per note
    if (drums) {
      const lanes = [...DRUM_LANES];
      for (const n of r.notes) if (!lanes.includes(n.pitch)) lanes.push(n.pitch);
      const rowH = 1 / lanes.length;
      for (const pn of notes) {
        const li = lanes.indexOf(pn.note.pitch);
        rects.push(pn.start - r.start, li * rowH + rowH * 0.1, -1, rowH * 0.8, (pn.iteration > 0 ? 0.6 : 1) * (0.45 + pn.note.velocity * 0.55));
      }
    } else {
      let lo = 127;
      let hi = 0;
      for (const n of r.notes) {
        lo = Math.min(lo, n.pitch);
        hi = Math.max(hi, n.pitch);
      }
      if (lo > hi) {
        lo = 60;
        hi = 72;
      }
      lo -= 1;
      hi += 1;
      const span = Math.max(8, hi - lo);
      lo = (lo + hi) / 2 - span / 2;
      for (const pn of notes) rects.push(pn.start - r.start, (lo + span - pn.note.pitch) / span, pn.duration, span, pn.iteration > 0 ? 0.62 : 1);
    }
    return { rects, notches: segs.slice(1).map((sg) => sg.start - r.start), length: r.length };
  }, [r, drums]);

  const cssW = Math.max(1, geo.length * ppb);
  const visible = useRef(false);
  const draw = useRef<() => void>(() => {});
  const drawn = useRef('');
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    return observe(cv, (v) => {
      visible.current = v;
      if (v) draw.current();
    });
  }, []);
  useLayoutEffect(() => {
    draw.current = () => {
    const cv = ref.current;
    if (!cv) return;
    const key = cssW + '|' + h + '|' + tone;
    if (drawn.current === key && cv.dataset.geo === String(geoId.get(geo))) return;
    drawn.current = key;
    cv.dataset.geo = String(geoId.get(geo));
    const dpr = window.devicePixelRatio || 1;
    // Browsers cap canvas size; very long regions get a slightly softer backing store.
    const sx = Math.min(dpr, 16000 / cssW);
    const W = Math.max(1, Math.floor(cssW * sx));
    const H = Math.max(1, Math.floor(h * dpr));
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.setTransform(sx, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, h);
    const ck = (cv.parentElement?.parentElement?.className ?? '') + '|' + tone + '|' + (cv.parentElement?.parentElement?.style.getPropertyValue('--c') ?? '');
    let fill = fillCache.get(ck);
    if (!fill) {
      fill = getComputedStyle(cv).fill || '#fff';
      fillCache.set(ck, fill);
    }
    g.fillStyle = fill;
    const bodyH = Math.max(6, h - 6);
    const R = geo.rects;
    if (drums) {
      const hitW = Math.max(2, Math.min(ppb * 0.18, 6));
      for (let i = 0; i < R.length; i += 5) {
        g.globalAlpha = R[i + 4];
        g.fillRect(R[i] * ppb, 3 + R[i + 1] * bodyH, hitW, Math.max(1.5, R[i + 3] * bodyH));
      }
    } else {
      for (let i = 0; i < R.length; i += 5) {
        const noteH = Math.max(1.5, Math.min(5, bodyH / R[i + 3]));
        g.globalAlpha = R[i + 4];
        g.fillRect(R[i] * ppb, 3 + R[i + 1] * (bodyH - noteH), Math.max(1.5, R[i + 2] * ppb - 0.6), noteH);
      }
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1.5;
    for (const nx of geo.notches) {
      g.beginPath();
      g.moveTo(nx * ppb, 0);
      g.lineTo(nx * ppb, h);
      g.stroke();
    }
    };
    if (!geoId.has(geo)) geoId.set(geo, ++geoSeq);
    if (visible.current) draw.current();
  }, [geo, ppb, h, drums, cssW, tone]);
  return <canvas ref={ref} className="region-notes" style={{ width: cssW, height: h }} />;
}

function AudioWave({ r, ppb, h, bpm }: { r: AudioRegion; ppb: number; h: number; bpm: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ver, setVer] = useState(0);
  useEffect(() => onAudioChange(() => setVer((v) => v + 1)), []);
  const widthPx = Math.max(1, r.length * ppb);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const buf = getBuffer(r.audioId);
    const bins = 6000;
    const peaks = getPeaks(r.audioId, bins);
    const scale = Math.min(1, 16000 / widthPx) * (window.devicePixelRatio > 1 ? 2 : 1);
    const W = Math.max(1, Math.floor(widthPx * Math.min(scale, 2)));
    const H = Math.max(1, Math.floor(h * (window.devicePixelRatio || 1)));
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    if (!buf || !peaks) return;
    const spb = 60 / bpm;
    const dur = buf.duration;
    const segs = regionSegments(r);
    const mid = H / 2;
    const amp = (H / 2) * 0.95 * Math.min(2, r.gain);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    let si = 0;
    for (let x = 0; x < W; x++) {
      const beat0 = r.start + (x / W) * r.length;
      const beat1 = r.start + ((x + 1) / W) * r.length;
      while (si < segs.length - 1 && beat0 >= segs[si].end) si++;
      const seg = segs[si];
      const c0 = seg.contentStart + (beat0 - seg.start);
      const c1 = seg.contentStart + (Math.min(beat1, seg.end) - seg.start);
      let b0 = Math.floor(((c0 * spb) / dur) * bins);
      let b1 = Math.max(b0 + 1, Math.ceil(((c1 * spb) / dur) * bins));
      if (r.reversed) {
        const t = b0;
        b0 = bins - b1;
        b1 = bins - t;
      }
      let lo = 0;
      let hi = 0;
      for (let b = Math.max(0, b0); b < Math.min(bins, b1); b++) {
        if (peaks[b * 2] < lo) lo = peaks[b * 2];
        if (peaks[b * 2 + 1] > hi) hi = peaks[b * 2 + 1];
      }
      // fades shape the drawn amplitude
      let f = 1;
      const rel = beat0 - r.start;
      if (r.fadeIn > 0 && rel < r.fadeIn) f *= rel / r.fadeIn;
      if (r.fadeOut > 0 && rel > r.length - r.fadeOut) f *= Math.max(0, (r.length - rel) / r.fadeOut);
      const y0 = mid - hi * amp * f;
      const y1 = mid - lo * amp * f;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
  }, [r, ppb, h, bpm, ver, widthPx]);
  const segs = regionSegments(r);
  return (
    <>
      <canvas ref={ref} className="region-wave" style={{ width: widthPx, height: h }} />
      <svg className="region-notes" width={widthPx} height={h} style={{ pointerEvents: 'none' }}>
        {segs.slice(1).map((s, i) => {
          const x = (s.start - r.start) * ppb;
          return <line key={i} x1={x} x2={x} y1={0} y2={h} className="loop-notch" />;
        })}
        {r.fadeIn > 0 && <path d={`M0 0 L${r.fadeIn * ppb} 0 L0 ${h} Z`} className="fade-shade" />}
        {r.fadeOut > 0 && <path d={`M${widthPx} 0 L${widthPx - r.fadeOut * ppb} 0 L${widthPx} ${h} Z`} className="fade-shade" />}
        {r.fadeIn > 0 && <line x1={0} y1={h} x2={r.fadeIn * ppb} y2={0} className="fade-line" />}
        {r.fadeOut > 0 && <line x1={widthPx} y1={h} x2={widthPx - r.fadeOut * ppb} y2={0} className="fade-line" />}
      </svg>
    </>
  );
}

function RegionView({ region: r, trackId, trackType, color, ppb, height, bpm }: Props) {
  const selected = useStore((s) => s.selectedRegionIds.includes(r.id));
  const editing = useStore((s) => s.editingRegionId === r.id);
  const renaming = useTracksUi((s) => s.renamingRegionId === r.id);
  const left = r.start * ppb;
  const width = Math.max(4, r.length * ppb);
  const bodyH = height - NAME_H - 4;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = useStore.getState();
    const wasSelected = s.selectedRegionIds.includes(r.id);
    const additive = e.shiftKey || e.metaKey;
    if (additive) {
      useStore.setState({
        selectedRegionIds: wasSelected ? s.selectedRegionIds.filter((x) => x !== r.id) : [...s.selectedRegionIds, r.id],
        selectedTrackId: trackId,
        focusArea: 'tracks',
      });
      if (wasSelected) return;
    } else if (!wasSelected) {
      useStore.setState({ selectedRegionIds: [r.id], selectedTrackId: trackId, focusArea: 'tracks' });
    } else {
      useStore.setState({ selectedTrackId: trackId, focusArea: 'tracks' });
    }
    // If the editor is open, follow the clicked region.
    if (s.dockTab === 'editor' && s.editingRegionId !== r.id) useStore.setState({ editingRegionId: r.id });
    const target = e.currentTarget as HTMLElement;
    dragMove(e, r.id, () => {
      if (wasSelected && !additive) {
        const rect = target.getBoundingClientRect();
        const x = e.clientX;
        // Delay so a double-click (open editor) can cancel the pill menu.
        if (pillTimer) clearTimeout(pillTimer);
        pillTimer = setTimeout(() => showPillMenu(x, rect.top, regionPillItems(r.id)), 260);
      }
    });
  };

  const handle = (fn: (e: React.PointerEvent, id: string) => void) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useStore.setState({ selectedRegionIds: [r.id], selectedTrackId: trackId, focusArea: 'tracks' });
    fn(e, r.id);
  };

  const cls = ['region', r.kind, trackType === 'drums' ? 'drums' : '', r.kind === 'midi' && r.drummer ? 'drummer' : '', selected ? 'selected' : '', editing ? 'editing' : '', r.muted ? 'muted' : '', r.loop ? 'looped' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      data-region-id={r.id}
      style={{ left, width, height: height - 4, ['--c' as string]: color, ['--rl' as string]: `${left}px`, ['--rw' as string]: `${width}px` }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (pillTimer) clearTimeout(pillTimer);
        pillTimer = null;
        closeMenus();
        openRegionEditor(r.id);
      }}
      onContextMenu={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        showContextMenu(e, regionMenu(r.id, r.start + (e.clientX - rect.left) / ppb));
      }}
    >
      <div className="region-name">
        {r.loop && <Repeat size={10} style={{ flexShrink: 0 }} />}
        {r.kind === 'midi' && r.drummer && <span className="drummer-badge">{drummerFor(r.drummer.style).name}</span>}
        {renaming ? (
          <input
            autoFocus
            className="region-rename"
            defaultValue={r.name}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== r.name)
                commit((d) => {
                  const x = draftRegion(d, r.id);
                  if (x) x.name = v;
                });
              useTracksUi.setState({ renamingRegionId: null });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') useTracksUi.setState({ renamingRegionId: null });
            }}
          />
        ) : (
          <span>{r.name}</span>
        )}
      </div>
      <div className="region-body" style={{ height: bodyH }}>
        {r.kind === 'midi' ? <MidiPreview r={r} ppb={ppb} h={bodyH} drums={trackType === 'drums'} tone={selected ? 'sel' : editing ? 'edit' : ''} /> : <AudioWave r={r} ppb={ppb} h={bodyH} bpm={bpm} />}
      </div>
      {/* Edge handles */}
      <div className="rh rh-left" onPointerDown={handle(dragResizeLeft)} title="Trim start" />
      <div className="rh rh-right" onPointerDown={handle(dragResizeRight)} title="Trim / extend" />
      <div className="rh rh-loop" onPointerDown={handle(dragLoop)} title="Drag to loop" />
      {r.kind === 'audio' && (
        <>
          <div className="fade-handle" style={{ left: Math.max(2, r.fadeIn * ppb - 5) }} onPointerDown={handle((e, id) => dragFade(e, id, 'in'))} title="Fade in" />
          <div className="fade-handle" style={{ left: Math.min(width - 20, width - r.fadeOut * ppb - 5) }} onPointerDown={handle((e, id) => dragFade(e, id, 'out'))} title="Fade out" />
        </>
      )}
    </div>
  );
}

export default memo(RegionView);
