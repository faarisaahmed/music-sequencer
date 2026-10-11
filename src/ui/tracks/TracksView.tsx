import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, ZoomIn, ZoomOut, Maximize, Magnet, Crown, LayoutList, Gauge } from 'lucide-react';
import { beginGesture, commit, endGesture, live, openModal, useStore, useTransport } from '../../state/store';
import { GRID_OPTIONS, snap } from '../../model/music';
import { contentEndBeat } from '../../model/defaults';
import { getEngine } from '../../audio/engine';
import { startDrag } from '../common/drag';
import TrackRow, { useArmedMic } from './TrackRow';
import AutomationLane from './AutomationLane';
import ArrangementLane from './ArrangementLane';
import TempoLane from './TempoLane';
import ChordLane, { ChordToggleButton } from '../assistant/ChordLane';
import { HEADER_W, RULER_H, useTracksUi } from './tracksUi';
import { meterOf, type Meter } from '../../model/timeline';
import { useTwoFingerPan } from '../mobile/touchPan';
import { shortcutLabel } from '../keys/keymap';
import './tracks.css';
import { PeerPlayheads } from '../collab/presence';

const CYCLE_H = 13;

/** Calls `cb` with the playhead beat whenever it changes (without re-rendering). */
function usePlayhead(cb: (beat: number) => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const read = () => {
      const s = useStore.getState();
      cbRef.current(s.playing ? useTransport.getState().position : s.cursor);
    };
    read();
    const u1 = useTransport.subscribe(read);
    const u2 = useStore.subscribe((s, p) => {
      if (s.cursor !== p.cursor || s.playing !== p.playing || s.pxPerBeat !== p.pxPerBeat) read();
    });
    return () => {
      u1();
      u2();
    };
  }, []);
}

function Playhead({ ppb }: { ppb: number }) {
  const ref = useRef<HTMLDivElement>(null);
  usePlayhead((b) => {
    if (ref.current) ref.current.style.transform = `translateX(${HEADER_W + Math.max(0, b) * ppb}px)`;
  });
  return <div ref={ref} className="tv-playhead" />;
}

function Ruler({ width, ppb }: { width: number; ppb: number }) {
  const project = useStore((s) => s.project)!;
  const ref = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  usePlayhead((b) => {
    if (headRef.current) headRef.current.style.transform = `translateX(${Math.max(0, b) * ppb}px)`;
  });
  const meter = meterOf(project);
  const minBar = Math.min(...meter.segs.map((g) => g.len)) * ppb;
  const every = [1, 2, 4, 8, 16, 32].find((n) => n * minBar >= 34) ?? 64;
  const ticks: React.ReactNode[] = [];
  let prevSig = '';
  for (const b of meter.bars(0, width / ppb)) {
    const { bar, len, sig } = b;
    const x = b.start * ppb;
    const sigText = `${sig[0]}/${sig[1]}`;
    const changed = bar > 0 && sigText !== prevSig;
    prevSig = sigText;
    const labeled = bar % every === 0 || changed;
    ticks.push(<line key={'b' + bar} x1={x + 0.5} x2={x + 0.5} y1={labeled ? CYCLE_H + 2 : RULER_H - 10} y2={RULER_H} className="rt-bar" />);
    if (labeled)
      ticks.push(
        <text key={'t' + bar} x={x + 4} y={CYCLE_H + 13} className="rt-num">
          {bar + 1}
          {changed && <tspan className="rt-sig"> {sigText}</tspan>}
        </text>,
      );
    const beatLen = 4 / sig[1];
    if (beatLen * ppb >= 7)
      for (let k = 1; k * beatLen < len - 1e-9; k++) {
        const bx = x + k * beatLen * ppb;
        ticks.push(<line key={`k${bar}_${k}`} x1={bx + 0.5} x2={bx + 0.5} y1={RULER_H - 6} y2={RULER_H} className="rt-beat" />);
      }
    if (ppb >= 60)
      for (let s = 0.25; s < len - 1e-9; s += 0.25) {
        if (Math.abs(s % beatLen) < 1e-6) continue;
        const sx = x + s * ppb;
        ticks.push(<line key={`s${bar}_${s}`} x1={sx + 0.5} x2={sx + 0.5} y1={RULER_H - 3} y2={RULER_H} className="rt-beat" />);
      }
  }
  const loop = project.loop;

  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const snapB = (b: number, ev: { ctrlKey: boolean }) => {
    const g = ev.ctrlKey ? 0 : useStore.getState().snapGrid || 1;
    return Math.max(0, g ? snap(b, g) : b);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    useStore.setState({ focusArea: 'tracks' });
    const { x, y } = local(e);
    const beat = x / ppb;
    const engine = getEngine();
    if (y < CYCLE_H + 2) {
      const lx0 = loop.start * ppb;
      const lx1 = loop.end * ppb;
      const inside = x > lx0 + 6 && x < lx1 - 6;
      const mode = Math.abs(x - lx0) <= 6 ? 'start' : Math.abs(x - lx1) <= 6 ? 'end' : inside ? 'move' : 'create';
      const o = { ...loop };
      const anchor = snapB(beat, e);
      beginGesture();
      startDrag(
        e,
        ({ x: cx, event }) => {
          const b = snapB(local({ clientX: cx, clientY: 0 }).x / ppb, event);
          live((d) => {
            if (mode === 'start') d.loop.start = Math.min(b, o.end - 0.25);
            else if (mode === 'end') d.loop.end = Math.max(b, o.start + 0.25);
            else if (mode === 'move') {
              const len = o.end - o.start;
              const ns = Math.max(0, snapB(o.start + (b - anchor), event));
              d.loop.start = ns;
              d.loop.end = ns + len;
            } else {
              const lo = Math.min(anchor, b);
              d.loop.start = lo;
              d.loop.end = Math.max(lo + 0.25, Math.max(anchor, b));
              d.loop.enabled = true;
            }
          });
        },
        ({ moved }) => {
          if (!moved && (mode === 'move' || mode === 'start' || mode === 'end')) {
            live((d) => {
              d.loop.enabled = !d.loop.enabled;
            });
          }
          if (!moved && mode === 'create') {
            // Click outside the brace: move the cycle to start at this bar.
            const bar = meter.floorBar(beat);
            const len = o.end - o.start;
            live((d) => {
              d.loop.start = bar;
              d.loop.end = bar + len;
              d.loop.enabled = true;
            });
          }
          endGesture();
        },
        { threshold: 3 },
      );
      return;
    }
    engine.seek(snapB(beat, e));
    startDrag(
      e,
      ({ x: cx, event }) => {
        const b = snapB(local({ clientX: cx, clientY: 0 }).x / ppb, event);
        if (!engine.isPlaying) engine.seek(b);
        else useStore.setState({ cursor: b });
      },
      ({ x: cx, event, moved }) => {
        if (moved && engine.isPlaying) engine.seek(snapB(local({ clientX: cx, clientY: 0 }).x / ppb, event));
      },
    );
  };

  return (
    <div
      ref={ref}
      className="tv-ruler"
      style={{ width }}
      onPointerDown={onPointerDown}
      title="Click to move the playhead · drag along the top strip to loop bars · double-click a bar to loop it"
      onDoubleClick={(e) => {
        // Double-click a bar: loop just that bar for review.
        const { x } = local(e);
        const b = meter.barAt(x / ppb);
        commit((d) => {
          d.loop.start = b.start;
          d.loop.end = b.start + b.len;
          d.loop.enabled = true;
        });
      }}
    >
      <svg width={width} height={RULER_H} className="rt-svg">
        <rect x={0} y={0} width={width} height={CYCLE_H + 1} className="rt-cycle-strip" />
        <rect
          x={loop.start * ppb}
          y={1}
          width={Math.max(2, (loop.end - loop.start) * ppb)}
          height={CYCLE_H - 1}
          rx={3}
          className={'rt-cycle' + (loop.enabled ? ' on' : '')}
        />
        {ticks}
      </svg>
      <div ref={headRef} className="tv-playhead-head" />
    </div>
  );
}

function Toolbar({ viewW }: { viewW: number }) {
  const ppb = useStore((s) => s.pxPerBeat);
  const grid = useStore((s) => s.snapGrid);
  const th = useStore((s) => s.trackHeight);
  const showMaster = useTracksUi((s) => s.showMaster);
  const showArrangement = useTracksUi((s) => s.showArrangement);
  const zoomTo = (v: number) => useStore.setState({ pxPerBeat: Math.max(3, Math.min(240, v)) });
  const fit = () => {
    const p = useStore.getState().project!;
    const end = Math.max(contentEndBeat(p), meterOf(p).barStart(4));
    zoomTo((viewW - HEADER_W - 40) / end);
  };
  return (
    <div className="tv-toolbar">
      <div className="row" title="Snap regions & edits to this grid (hold Ctrl to bypass)">
        <Magnet size={14} className={grid ? '' : 'faint'} />
        <select value={grid} onChange={(e) => useStore.setState({ snapGrid: Number(e.target.value) })}>
          <option value={0}>Off</option>
          {GRID_OPTIONS.map((g) => (
            <option key={g.label} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      <div className="row" style={{ gap: 2 }}>
        <button className="btn ghost icon sm" title="Zoom out (⌘−)" onClick={() => zoomTo(ppb / 1.3)}>
          <ZoomOut size={15} />
        </button>
        <input
          type="range"
          className="tv-zoom"
          min={0}
          max={1000}
          value={Math.round((Math.log(ppb / 3) / Math.log(80)) * 1000)}
          onChange={(e) => zoomTo(3 * Math.pow(80, Number(e.target.value) / 1000))}
          title="Zoom"
        />
        <button className="btn ghost icon sm" title="Zoom in (⌘=)" onClick={() => zoomTo(ppb * 1.3)}>
          <ZoomIn size={15} />
        </button>
        <button className="btn ghost sm" title="Zoom to fit the song" onClick={fit}>
          <Maximize size={13} /> Fit
        </button>
      </div>
      <div className="seg" title="Track height">
        {[
          ['S', 56],
          ['M', 84],
          ['L', 124],
        ].map(([l, h]) => (
          <button key={l} className={th === h ? 'on' : ''} onClick={() => useStore.setState({ trackHeight: h as number })}>
            {l}
          </button>
        ))}
      </div>
      <button className={'btn sm' + (showMaster ? ' active' : '')} onClick={() => useTracksUi.setState({ showMaster: !showMaster })} title="Show the master track (song volume automation, fade-outs)">
        <Crown size={13} /> Master Track
      </button>
      <button className={'btn sm' + (showArrangement ? ' active' : '')} onClick={() => useTracksUi.setState({ showArrangement: !showArrangement })} title="Show the arrangement track (song sections)">
        <LayoutList size={13} /> Arrangement
      </button>
      <TempoToggleButton />
      <ChordToggleButton />
      <div className="spacer" />
      <div className="tv-hint faint">
        Double-click empty space for a new region (on drums: places the current pattern) · <kbd>⌥</kbd> drag copies · drag the top-right corner to loop · <kbd>{shortcutLabel('region.split')}</kbd> split
      </div>
    </div>
  );
}

export default function TracksView() {
  const project = useStore((s) => s.project)!;
  const ppb = useStore((s) => s.pxPerBeat);
  const trackHeight = useStore((s) => s.trackHeight);
  const showMaster = useTracksUi((s) => s.showMaster);
  const showArrangement = useTracksUi((s) => s.showArrangement);
  const showTempo = useTracksUi((s) => s.showTempo);
  const marquee = useTracksUi((s) => s.marquee);
  const dropIndicator = useTracksUi((s) => s.dropIndicator);
  const snapLine = useTracksUi((s) => s.snapLine);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useTwoFingerPan(scrollRef, { wheelPerLn: 100 });
  const [viewW, setViewW] = useState(1200);
  useArmedMic(project.tracks);

  const meter = meterOf(project);
  const songBars = Math.max(project.lengthBars, Math.ceil(meter.barPos(contentEndBeat(project)) - 1e-6) + 4);
  const width = Math.max(viewW - HEADER_W, meter.barStart(songBars + 8) * ppb);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Ctrl/⌘ + wheel zooms around the mouse.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const s = useStore.getState();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left - HEADER_W;
      const beat = (el.scrollLeft + mx) / s.pxPerBeat;
      const next = Math.max(3, Math.min(240, s.pxPerBeat * Math.exp(-e.deltaY * 0.01)));
      useStore.setState({ pxPerBeat: next });
      requestAnimationFrame(() => {
        el.scrollLeft = beat * next - mx;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Follow the playhead while playing.
  useEffect(
    () =>
      useTransport.subscribe((t) => {
        const el = scrollRef.current;
        if (!el || !useStore.getState().playing) return;
        const x = Math.max(0, t.position) * useStore.getState().pxPerBeat;
        const visW = el.clientWidth - HEADER_W;
        if (x > el.scrollLeft + visW - 40) el.scrollLeft = x - 60;
        else if (x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 60);
      }),
    [],
  );

  const onMarquee = useCallback((e: React.PointerEvent) => {
    const content = contentRef.current;
    if (!content) return;
    const s = useStore.getState();
    const base = e.shiftKey || e.metaKey ? s.selectedRegionIds : [];
    if (!e.shiftKey && !e.metaKey) useStore.setState({ selectedRegionIds: [] });
    const cr = () => content.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;
    startDrag(
      e,
      ({ x, y }) => {
        const c = cr();
        useTracksUi.setState({ marquee: { x0: x0 - c.left, y0: y0 - c.top, x1: x - c.left, y1: y - c.top } });
        const L = Math.min(x0, x);
        const R = Math.max(x0, x);
        const T = Math.min(y0, y);
        const B = Math.max(y0, y);
        const hits: string[] = [];
        content.querySelectorAll<HTMLElement>('[data-region-id]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > L && r.left < R && r.bottom > T && r.top < B) hits.push(el.dataset.regionId!);
        });
        useStore.setState({ selectedRegionIds: [...new Set([...base, ...hits])] });
      },
      () => useTracksUi.setState({ marquee: null }),
      { threshold: 4 },
    );
  }, []);

  const loop = project.loop;
  const gridVars = useMemo(() => laneGrid(meter, ppb, width), [meter, ppb, width]);

  return (
    <div className="tv-root" onPointerDownCapture={() => useStore.setState({ focusArea: 'tracks' })}>
      <Toolbar viewW={viewW} />
      <div
        className="tv-scroll"
        ref={scrollRef}
        onScroll={(e) => contentRef.current?.style.setProperty('--sx', `${(e.currentTarget as HTMLElement).scrollLeft}px`)}
      >
        <div className={'tv-content' + (meter.simple ? '' : ' custom-grid')} ref={contentRef} style={{ width: HEADER_W + width, ...gridVars }}>
          <div className="tv-toprow">
            <div className="tv-corner">
              <button className="btn sm ghost" onClick={() => openModal('newTrack')} title="New track (⌥⌘N)">
                <Plus size={14} /> Track
              </button>
              <span className="faint" style={{ fontSize: 11 }}>
                {project.tracks.length} track{project.tracks.length === 1 ? '' : 's'}
              </span>
            </div>
            <Ruler width={width} ppb={ppb} />
          </div>

          {showArrangement && <ArrangementLane width={width} ppb={ppb} />}
          {(showTempo || (project.tempoChanges?.length ?? 0) > 0 || (project.meterChanges?.length ?? 0) > 0) && <TempoLane width={width} ppb={ppb} />}
          <ChordLane width={width} ppb={ppb} />

          {showMaster && (
            <div className="track-block master-block">
              <div className="track-row auto-row master-row">
                <div className="auto-header master-header">
                  <Crown size={15} />
                  <div>
                    <div className="th-name">Master Track</div>
                    <div className="faint" style={{ fontSize: 11 }}>
                      Song volume · fade-ins & fade-outs
                    </div>
                  </div>
                </div>
                <AutomationLane trackId={null} param="volume" points={project.masterAutomation} fallback={1} width={width} ppb={ppb} color="#c9a7ff" />
              </div>
            </div>
          )}

          {project.tracks.map((t) => (
            <TrackRow key={t.id} track={t} width={width} ppb={ppb} height={t.height ?? trackHeight} bpm={project.bpm} onMarquee={onMarquee} />
          ))}

          <div className="track-row add-row">
            <div className="add-header">
              <button className="add-track-btn" onClick={() => openModal('newTrack')}>
                <Plus size={16} /> Add Track
              </button>
            </div>
            <div
              className="add-lane"
              style={{ width }}
              onPointerDown={(e) => {
                if (e.button === 0) onMarquee(e);
              }}
              onDoubleClick={() => openModal('newTrack')}
            >
              {project.tracks.length === 0 && <div className="tv-empty">Double-click here or press “Add Track” to start your song</div>}
            </div>
          </div>

          {loop.enabled && <div className="tv-cycle-shade" style={{ left: HEADER_W + loop.start * ppb, width: (loop.end - loop.start) * ppb }} />}
          {snapLine !== null && <div className="tv-snapline" style={{ left: HEADER_W + snapLine * ppb }} />}
          <Playhead ppb={ppb} />
          <PeerPlayheads ppb={ppb} />
          {marquee && (
            <div
              className="tv-marquee"
              style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
              }}
            />
          )}
          {dropIndicator !== null && <div className="tv-drop" style={{ top: dropIndicator - 1 }} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Lane grid lines. One time signature: a repeating CSS background. With changes: an image of
 * the exact bar and beat lines.
 */
function laneGrid(meter: Meter, ppb: number, width: number): Record<string, string> {
  if (meter.simple) {
    const g = meter.segs[0];
    const beatLen = 4 / g.sig[1];
    return { ['--bar']: `${g.len * ppb}px`, ['--beat']: `${(beatLen * ppb >= 8 ? beatLen : g.len) * ppb}px` };
  }
  const W = Math.ceil(width);
  let rects = '';
  for (const b of meter.bars(0, width / ppb)) {
    rects += `<rect x='${Math.round(b.start * ppb)}' width='1' height='10' fill='rgba(255,255,255,0.075)'/>`;
    const beatLen = 4 / b.sig[1];
    if (beatLen * ppb >= 8) for (let k = 1; k * beatLen < b.len - 1e-9; k++) rects += `<rect x='${Math.round((b.start + k * beatLen) * ppb)}' width='1' height='10' fill='rgba(255,255,255,0.028)'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='10' viewBox='0 0 ${W} 10' preserveAspectRatio='none'>${rects}</svg>`;
  return { ['--lane-grid']: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, ['--grid-w']: `${W}px` };
}

function TempoToggleButton() {
  const project = useStore((s) => s.project)!;
  const show = useTracksUi((s) => s.showTempo);
  const has = (project.tempoChanges?.length ?? 0) > 0 || (project.meterChanges?.length ?? 0) > 0;
  return (
    <button
      className={'btn sm' + (show || has ? ' active' : '')}
      onClick={() => !has && useTracksUi.setState({ showTempo: !show })}
      title={has ? 'This song changes tempo or time signature, so the lane stays visible' : 'Show the tempo & time signature lane: speed up, slow down or change meter during the song'}
    >
      <Gauge size={13} /> Tempo
    </button>
  );
}
