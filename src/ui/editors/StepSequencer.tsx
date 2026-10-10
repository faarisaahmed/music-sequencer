// Drum Beat Sequencer: GarageBand-style glowing pads with an FL Studio-style channel
// rack (per-row mute/solo/volume/pan/tune and your own sounds), linked patterns,
// pattern-only loop playback and swing. Step / Velocity / Note Repeat / Chance /
// Loop Length editing modes.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AudioLines, ChevronLeft, ChevronRight, ChevronsRight, CopyPlus, Eraser, Link2, MoreHorizontal, Play, Plus, Square, Unlink } from 'lucide-react';
import type { Draft } from 'immer';
import type { MidiRegion, Note, Project } from '../../model/types';
import { beginGesture, commit, draftRegion, endGesture, findRegion, live, toast, useStore, useTransport } from '../../state/store';
import { DRUM_LANES, DRUM_NAMES, beatsPerBar } from '../../model/music';
import { uid } from '../../model/defaults';
import { PRESETS } from '../../audio/presets';
import { makePatternUnique, newPatternClip, setClipPattern, setTrackInstrument, updateTrack } from '../../state/actions';
import { patternUseCounts } from '../../model/patterns';
import { addClip } from '../../audio/audioStore';
import { Knob, HSlider } from '../common/controls';
import { getEngine } from '../../audio/engine';
import { showContextMenu, type MenuItem } from '../common/menus';
import { clamp } from '../common/drag';
import { DrumIcon } from './steps/drumVisuals';
import { drumColor } from './steps/drumColors';
import { useToolbarSlot } from './useToolbarSlot';
import './steps/steps.css';

type Mode = 'step' | 'velocity' | 'repeat' | 'chance' | 'loop';

const MODES: { id: Mode; label: string }[] = [
  { id: 'step', label: 'Step On/Off' },
  { id: 'velocity', label: 'Velocity' },
  { id: 'repeat', label: 'Note Repeat' },
  { id: 'chance', label: 'Chance' },
  { id: 'loop', label: 'Loop Length' },
];

const RESOLUTIONS = [
  { label: '1/8', value: 0.5 },
  { label: '1/16', value: 0.25 },
  { label: '1/32', value: 0.125 },
  { label: '1/16T', value: 1 / 6 },
];

const DEFAULT_LANES = DRUM_LANES.slice(0, 8);
const HEADER_W = 250;
const GAP = 4;
const GROUP_GAP = 5;
const BAR_GAP = 6;
/** Smallest comfortable pad width before the sequencer switches to pages. */
const MIN_CELL = 30;

/** Remembered extra/hidden rows per track so they survive switching regions. */
const laneMemory = new Map<string, { extra: number[]; hidden: number[] }>();

const stepOf = (n: Note, res: number) => Math.floor(n.start / res + 1e-6);

/** Copied row (steps of one drum piece) for Copy Row / Paste Row. */
let rowClipboard: { notes: Note[]; res: number } | null = null;

/** First free pitch for a row that holds your own sound (above the GM drum map). */
function freeCustomPitch(used: Set<number>): number {
  for (let p = 88; p < 128; p++) if (!used.has(p)) return p;
  return 127;
}

/** Ask for an audio file. */
function pickAudio(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** Load an audio file as a row's sound on a drum track. */
async function setRowSample(trackId: string, pitch: number, file: File): Promise<void> {
  const id = uid('aud');
  try {
    await addClip(id, file, file.name);
  } catch {
    toast('Could not read that audio file', 'error');
    return;
  }
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Sound';
  updateTrack(trackId, (t) => {
    t.drumSamples = { ...(t.drumSamples ?? {}), [pitch]: { audioId: id, name } };
  });
  getEngine().preview(trackId, pitch, 0.9, 0.5);
}

function midiDraft(d: Draft<Project>, id: string): Draft<MidiRegion> | null {
  const r = draftRegion(d, id);
  return r && r.kind === 'midi' ? (r as Draft<MidiRegion>) : null;
}

export default function StepSequencer({ trackId, regionId }: { trackId: string; regionId: string }) {
  const project = useStore((s) => s.project)!;
  const found = findRegion(project, regionId);
  const [mode, setMode] = useState<Mode>('step');
  const [res, setRes] = useState(0.25);
  const mem = laneMemory.get(trackId) ?? { extra: [], hidden: [] };
  const [extra, setExtraState] = useState<number[]>(mem.extra);
  const [hidden, setHiddenState] = useState<number[]>(mem.hidden);
  const slot = useToolbarSlot();
  const [size, setSize] = useState({ w: 900, h: 300 });
  const [page, setPage] = useState(0);
  const [follow, setFollow] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ paintOn: boolean; visited: Set<string> } | null>(null);

  const setExtra = (v: number[]) => {
    setExtraState(v);
    laneMemory.set(trackId, { extra: v, hidden });
  };
  const setHidden = (v: number[]) => {
    setHiddenState(v);
    laneMemory.set(trackId, { extra, hidden: v });
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const region = found?.region.kind === 'midi' ? found.region : null;
  const track = found?.track;
  const notes = useMemo(() => region?.notes ?? [], [region]);
  const customKey = Object.keys(track?.drumSamples ?? {}).join(',');

  const cellMap = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of notes) m.set(`${n.pitch}:${stepOf(n, res)}`, n);
    return m;
  }, [notes, res]);

  const lanes = useMemo(() => {
    const used = new Set(notes.map((n) => n.pitch));
    const custom = customKey ? customKey.split(',').map(Number) : [];
    const set = new Set<number>([...DEFAULT_LANES, ...extra, ...used, ...custom]);
    for (const h of hidden) if (!used.has(h)) set.delete(h);
    const order = (p: number) => {
      const i = DRUM_LANES.indexOf(p);
      return i < 0 ? 100 + p : i;
    };
    return [...set].sort((a, b) => order(a) - order(b));
  }, [notes, extra, hidden, customKey]);

  const patternPlaying = useStore((s) => s.patternPlay === regionId);
  const useCounts = useMemo(() => patternUseCounts(project), [project]);

  if (!region || !track) return null;

  const bpb = beatsPerBar(project.timeSig);
  const cl = region.contentLength;
  const patternSteps = Math.max(1, Math.round(cl / res));
  const displayBars = Math.max(1, Math.ceil(cl / bpb - 1e-6));
  const cols = mode === 'loop' ? Math.max(patternSteps, Math.round((displayBars * bpb) / res)) : patternSteps;
  const group = Math.max(1, Math.round(1 / res)); // steps per beat
  const barSteps = Math.max(1, Math.round(bpb / res));

  // Geometry: show every step if the pads stay comfortably wide, otherwise page through
  // whole bars (or bar fractions) like GarageBand's beat sequencer.
  const availW = size.w - HEADER_W - 24;
  const cellFor = (n: number) =>
    (availW - (n - 1) * GAP - Math.floor((n - 1) / group) * GROUP_GAP - Math.floor((n - 1) / barSteps) * BAR_GAP) / n;
  let pageSize = cols;
  if (cellFor(cols) < MIN_CELL) {
    let bars = Math.floor(cols / barSteps);
    while (bars > 1 && cellFor(bars * barSteps) < MIN_CELL) bars--;
    if (bars >= 1 && cellFor(bars * barSteps) >= MIN_CELL) pageSize = bars * barSteps;
    else {
      let n = Math.min(barSteps, cols);
      while (n > group && cellFor(n) < MIN_CELL) n = Math.ceil(n / 2);
      pageSize = Math.max(1, n);
    }
  }
  const pages = Math.max(1, Math.ceil(cols / pageSize));
  const curPage = Math.min(page, pages - 1);
  const p0 = curPage * pageSize;
  const visCount = Math.min(pageSize, cols - p0);
  const cw = clamp(cellFor(pageSize), 18, 90);
  const rh = clamp((size.h - 44 - lanes.length * GAP) / lanes.length, 26, 64);
  // x of a step index relative to the first step of the current page
  const colX = (j: number) => j * (cw + GAP) + Math.floor(j / group) * GROUP_GAP + Math.floor(j / barSteps) * BAR_GAP;
  const gridW = colX(visCount - 1) + cw;

  const stepCounts = new Array<number>(cols).fill(0);
  for (const n of notes) {
    const st = stepOf(n, res);
    if (st >= 0 && st < patternSteps) stepCounts[st]++;
  }

  const playing = useStore.getState().playing;
  const engine = getEngine();

  // ------------------------------------------------------------------ editing

  const setCell = (d: Draft<Project>, pitch: number, step: number, on: boolean) => {
    const r = midiDraft(d, regionId);
    if (!r) return;
    const existing = r.notes.filter((n) => n.pitch === pitch && stepOf(n as Note, res) === step);
    if (on && !existing.length) r.notes.push({ id: uid('n'), pitch, start: step * res, duration: res, velocity: 0.8 });
    if (!on && existing.length) r.notes = r.notes.filter((n) => !existing.includes(n));
  };

  const applyAt = (x: number, y: number, first: boolean) => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-cell]') as HTMLElement | null;
    if (!el) return;
    const pitch = Number(el.dataset.pitch);
    const step = Number(el.dataset.step);
    const rect = el.getBoundingClientRect();
    const frac = clamp(1 - (y - rect.top) / rect.height, 0, 1);
    const key = `${pitch}:${step}`;
    const drag = dragRef.current;
    if (!drag) return;
    if (mode === 'loop') {
      live((d) => {
        const r = midiDraft(d, regionId);
        if (!r) return;
        r.contentLength = (step + 1) * res;
        r.loop = true;
        if (r.length < r.contentLength) r.length = r.contentLength;
      });
      return;
    }
    if (step >= patternSteps) return;
    if (mode === 'step') {
      if (drag.visited.has(key)) return;
      drag.visited.add(key);
      live((d) => setCell(d, pitch, step, drag.paintOn));
      if (drag.paintOn && !playing) engine.preview(trackId, pitch, 0.8, 0.25);
      return;
    }
    live((d) => {
      const r = midiDraft(d, regionId);
      if (!r) return;
      let n = r.notes.find((n) => n.pitch === pitch && stepOf(n as Note, res) === step);
      if (!n) {
        if (!first) return;
        // Clicking an empty pad in these modes switches it on.
        r.notes.push({ id: uid('n'), pitch, start: step * res, duration: res, velocity: 0.8 });
        n = r.notes[r.notes.length - 1];
      }
      if (mode === 'velocity') n.velocity = Math.max(0.05, Math.round(frac * 100) / 100);
      if (mode === 'repeat') n.repeat = 1 + Math.min(3, Math.floor(frac * 4));
      if (mode === 'chance') n.chance = Math.max(0.05, Math.round(frac * 20) / 20);
    });
  };

  const onGridDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest('[data-cell]') as HTMLElement | null;
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const pitch = Number(el.dataset.pitch);
    const step = Number(el.dataset.step);
    beginGesture();
    dragRef.current = { paintOn: !cellMap.has(`${pitch}:${step}`), visited: new Set() };
    applyAt(e.clientX, e.clientY, true);
    const move = (ev: PointerEvent) => applyAt(ev.clientX, ev.clientY, false);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
      endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const editRegion = (fn: (r: Draft<MidiRegion>) => void) =>
    commit((d) => {
      const r = midiDraft(d, regionId);
      if (r) fn(r);
    });

  const setBars = (bars: number) =>
    editRegion((r) => {
      r.contentLength = bars * bpb;
      r.loop = true;
      if (r.length < r.contentLength) r.length = r.contentLength;
    });

  /** Copy the pattern after itself: 1 bar → 2 bars with the same beat twice, ready to vary. */
  const doublePattern = () =>
    editRegion((r) => {
      const len = r.contentLength;
      if (len * 2 > bpb * 16) return;
      const copies = r.notes.filter((n) => n.start < len).map((n) => ({ ...n, id: uid('n'), start: n.start + len }));
      r.notes.push(...copies);
      r.contentLength = len * 2;
      r.loop = true;
      if (r.length < r.contentLength) r.length = r.contentLength;
    });

  // ---------------------------------------------------------------- channel rack (rows)

  const params = track.instrumentParams;
  const param = (key: string, fallback: number) => params[key] ?? fallback;
  const setParam = (key: string, v: number) =>
    updateTrack(track.id, (t) => {
      t.instrumentParams[key] = v;
    });
  const rowName = (pitch: number) => track.drumSamples?.[pitch]?.name ?? DRUM_NAMES[pitch] ?? `Note ${pitch}`;
  const anySolo = lanes.some((p) => params['solo' + p]);

  const shift = (dir: number) =>
    editRegion((r) => {
      for (const n of r.notes) n.start = (((n.start + dir * res) % r.contentLength) + r.contentLength) % r.contentLength;
    });

  const rowMenu = (pitch: number): MenuItem[] => {
    const rowEdit = (fn: (r: Draft<MidiRegion>) => void) => editRegion(fn);
    const fill = (every: number) =>
      rowEdit((r) => {
        r.notes = r.notes.filter((n) => n.pitch !== pitch);
        for (let i = 0; i < patternSteps; i += every) r.notes.push({ id: uid('n'), pitch, start: i * res, duration: res, velocity: i % group === 0 ? 0.9 : 0.7 });
      });
    const vel = (v: number | 'human') =>
      rowEdit((r) => {
        for (const n of r.notes) if (n.pitch === pitch) n.velocity = v === 'human' ? clamp(n.velocity + (Math.random() - 0.5) * 0.25, 0.15, 1) : v;
      });
    const tune = param('tune' + pitch, 0);
    const own = track.drumSamples?.[pitch];
    return [
      { title: rowName(pitch) },
      { label: 'Audition', onClick: () => engine.preview(trackId, pitch, 0.9, 0.25) },
      {
        label: own ? 'Replace Sound…' : 'Use Your Own Sound…',
        onClick: async () => {
          const f = await pickAudio();
          if (f) await setRowSample(track.id, pitch, f);
        },
      },
      ...(own && pitch < 88
        ? [
            {
              label: 'Back to Kit Sound',
              onClick: () =>
                updateTrack(track.id, (t) => {
                  if (t.drumSamples) delete t.drumSamples[pitch];
                }),
            },
          ]
        : []),
      {
        label: `Tune (${tune > 0 ? '+' : ''}${tune} st)`,
        submenu: [12, 7, 5, 2, 1, 0, -1, -2, -5, -7, -12].map((st) => ({
          label: st === 0 ? 'Original pitch' : `${st > 0 ? '+' : ''}${st} semitone${Math.abs(st) > 1 ? 's' : ''}`,
          onClick: () => {
            setParam('tune' + pitch, st);
            setTimeout(() => engine.preview(trackId, pitch, 0.9, 0.3), 30);
          },
        })),
      },
      { separator: true },
      {
        label: 'Copy Row',
        onClick: () => {
          rowClipboard = { notes: notes.filter((n) => n.pitch === pitch).map((n) => ({ ...n })), res };
        },
      },
      {
        label: 'Paste Row',
        disabled: !rowClipboard,
        onClick: () =>
          rowEdit((r) => {
            if (!rowClipboard) return;
            r.notes = r.notes.filter((n) => n.pitch !== pitch);
            for (const n of rowClipboard.notes) if (n.start < r.contentLength) r.notes.push({ ...n, id: uid('n'), pitch });
          }),
      },
      { separator: true },
      { label: 'Fill Every Step', onClick: () => fill(1) },
      { label: 'Fill Every 2 Steps', onClick: () => fill(2) },
      { label: 'Fill Every Beat', onClick: () => fill(group) },
      { label: 'Fill Every 2 Beats', onClick: () => fill(group * 2) },
      { separator: true },
      {
        label: 'Row Velocity',
        submenu: [
          { label: '100%', onClick: () => vel(1) },
          { label: '80%', onClick: () => vel(0.8) },
          { label: '60%', onClick: () => vel(0.6) },
          { label: '40%', onClick: () => vel(0.4) },
          { label: 'Humanize', onClick: () => vel('human') },
        ],
      },
      { label: 'Clear Row', onClick: () => rowEdit((r) => void (r.notes = r.notes.filter((n) => n.pitch !== pitch))) },
      {
        label: 'Remove Row',
        onClick: () => {
          rowEdit((r) => void (r.notes = r.notes.filter((n) => n.pitch !== pitch)));
          setHidden([...hidden.filter((h) => h !== pitch), pitch]);
          setExtra(extra.filter((x) => x !== pitch));
          if (track.drumSamples?.[pitch])
            updateTrack(track.id, (t) => {
              if (t.drumSamples) delete t.drumSamples[pitch];
              for (const k of ['level', 'pan', 'tune', 'mute', 'solo']) delete t.instrumentParams[k + pitch];
            });
        },
      },
    ];
  };

  const addRowMenu = (e: React.MouseEvent) => {
    const avail = Object.keys(DRUM_NAMES)
      .map(Number)
      .filter((p) => !lanes.includes(p));
    const ownSound: MenuItem = {
      label: 'Your Own Sound…',
      icon: <Plus size={14} />,
      onClick: async () => {
        const f = await pickAudio();
        if (f) await setRowSample(track.id, freeCustomPitch(new Set(lanes)), f);
      },
    };
    showContextMenu(
      e,
      [ownSound, { separator: true }, ...(avail.length
        ? avail.map((p) => ({
            label: DRUM_NAMES[p],
            onClick: () => {
              setExtra([...extra, p]);
              setHidden(hidden.filter((h) => h !== p));
              engine.preview(trackId, p, 0.8, 0.25);
            },
          }))
        : [{ label: 'All kit rows are shown', disabled: true }])],
    );
  };


  const kits = PRESETS.filter((p) => p.kind === 'drums');
  const linkCount = region.patternId && region.loop ? useCounts.get(region.patternId) ?? 0 : 0;
  const currentBars = cl / bpb;

  const toolbar = (
    <div className="ss-toolbar">
      <select value={track.instrument} onChange={(e) => setTrackInstrument(track.id, e.target.value)} title="Drum kit">
        {kits.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      <div className="seg" title="Pattern length">
        {[1, 2, 4, 8].map((b) => (
          <button key={b} className={Math.abs(currentBars - b) < 1e-6 ? 'on' : ''} onClick={() => setBars(b)}>
            {b} bar{b > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <button className="btn sm" title="Double the pattern: copy it after itself so you can vary the second half" onClick={doublePattern} disabled={currentBars >= 16}>
        <CopyPlus size={14} /> Double
      </button>
      <div className="seg" title="Step size">
        {RESOLUTIONS.map((r) => (
          <button key={r.label} className={Math.abs(res - r.value) < 1e-9 ? 'on' : ''} onClick={() => setRes(r.value)}>
            {r.label}
          </button>
        ))}
      </div>
      <button className="btn sm icon" title="Shift pattern left" onClick={() => shift(-1)}>
        <ChevronLeft size={15} />
      </button>
      <button className="btn sm icon" title="Shift pattern right" onClick={() => shift(1)}>
        <ChevronRight size={15} />
      </button>
      <button className="btn sm" title="Clear pattern" onClick={() => editRegion((r) => void (r.notes = []))}>
        <Eraser size={14} /> Clear
      </button>
    </div>
  );

  return (
    <div className="ss" onContextMenu={(e) => e.preventDefault()}>
      {slot ? createPortal(toolbar, slot) : toolbar}
      {pages > 1 && (
        <PageBar
          pages={pages}
          pageSize={pageSize}
          current={curPage}
          counts={stepCounts}
          res={res}
          bpb={bpb}
          region={region}
          cols={patternSteps}
          follow={follow}
          onFollow={() => setFollow(!follow)}
          onAutoPage={setPage}
          onPage={(k) => {
            setPage(k);
            setFollow(false);
          }}
        />
      )}
      <div className="ss-scroll" ref={scrollRef}>
        <div className="ss-grid" style={{ width: HEADER_W + gridW + 12 }} onPointerDown={onGridDown}>
          {lanes.map((pitch) => {
            const color = drumColor(pitch);
            return (
              <div
                key={pitch}
                className={'ss-row' + (params['mute' + pitch] || (anySolo && !params['solo' + pitch]) ? ' silent' : '')}
                style={{ height: rh, ['--c' as string]: color }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onDrop={(e) => {
                  const f = e.dataTransfer.files[0];
                  if (!f) return;
                  e.preventDefault();
                  e.stopPropagation();
                  void setRowSample(track.id, pitch, f);
                }}
              >
                <div className="ss-head" style={{ width: HEADER_W }}>
                  <button
                    className="ss-icon"
                    style={{ color }}
                    title="Audition"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      engine.preview(trackId, pitch, 0.9, 0.25);
                    }}
                  >
                    <DrumIcon pitch={pitch} size={Math.min(26, rh - 6)} />
                  </button>
                  <span className="ss-name" title={track.drumSamples?.[pitch] ? `Your sound: ${rowName(pitch)}` : rowName(pitch)}>
                    {track.drumSamples?.[pitch] && <AudioLines size={11} className="ss-own" />}
                    {rowName(pitch)}

                  </span>
                  <button
                    className={'ss-ms' + (params['mute' + pitch] ? ' on mute' : '')}
                    title="Mute this row"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setParam('mute' + pitch, params['mute' + pitch] ? 0 : 1)}
                  >
                    M
                  </button>
                  <button
                    className={'ss-ms' + (params['solo' + pitch] ? ' on solo' : '')}
                    title="Solo this row"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setParam('solo' + pitch, params['solo' + pitch] ? 0 : 1)}
                  >
                    S
                  </button>
                  <span className="ss-knob" title={`Volume ${Math.round(param('level' + pitch, 1) * 100)}% (double-click to reset)`} onPointerDown={(e) => e.stopPropagation()}>
                    <Knob size={24} value={param('level' + pitch, 1)} min={0} max={1.5} defaultValue={1} color={color} onChange={(v) => setParam('level' + pitch, Math.round(v * 100) / 100)} />
                  </span>
                  <span className="ss-knob" title={`Pan ${panLabel(param('pan' + pitch, 0))} (double-click to centre)`} onPointerDown={(e) => e.stopPropagation()}>
                    <Knob size={24} bipolar value={param('pan' + pitch, 0)} min={-1} max={1} defaultValue={0} color={color} onChange={(v) => setParam('pan' + pitch, Math.round(v * 100) / 100)} />
                  </span>
                  <button
                    className="ss-more"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => showContextMenu(e, rowMenu(pitch))}
                    title="Row options"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
                <div className="ss-cells" style={{ width: gridW }} onContextMenu={(e) => showContextMenu(e, rowMenu(pitch))}>
                  {Array.from({ length: visCount }, (_, j) => {
                    const i = p0 + j;
                    const n = cellMap.get(`${pitch}:${i}`);
                    const outside = i >= patternSteps;
                    const cls = 'ss-cell' + (n && !outside ? ' on' : '') + (outside ? ' outside' : '') + (Math.floor(i / group) % 2 ? ' alt' : '');
                    let inner: React.ReactNode = null;
                    let style: React.CSSProperties = { left: colX(j), width: cw };
                    if (n && !outside) {
                      if (mode === 'step') style = { ...style, opacity: 0.5 + n.velocity * 0.5 };
                      else if (mode === 'velocity') inner = <div className="ss-fill" style={{ height: `${n.velocity * 100}%` }} />;
                      else if (mode === 'chance') {
                        const c = n.chance ?? 1;
                        inner = (
                          <>
                            <div className="ss-fill" style={{ height: `${c * 100}%` }} />
                            {cw > 26 && <span className="ss-val">{Math.round(c * 100)}</span>}
                          </>
                        );
                      } else if (mode === 'repeat') {
                        const rp = n.repeat ?? 1;
                        inner = (
                          <div className="ss-repeat">
                            {Array.from({ length: rp }, (_, k) => (
                              <i key={k} />
                            ))}
                          </div>
                        );
                      }
                    }
                    if (n && !outside && mode === 'step' && ((n.repeat ?? 1) > 1 || (n.chance ?? 1) < 1)) {
                      inner = <span className="ss-badge">{(n.repeat ?? 1) > 1 ? `×${n.repeat}` : '?'}</span>;
                    }
                    return (
                      <div key={i} className={cls + (mode !== 'step' && mode !== 'loop' ? ' detail' : '')} style={style} data-cell="" data-pitch={pitch} data-step={i}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {mode === 'loop' && patternSteps - 1 >= p0 && patternSteps - 1 < p0 + visCount && (
            <div className="ss-loopmark" style={{ left: HEADER_W + colX(patternSteps - 1 - p0) + cw + 2, height: lanes.length * (rh + GAP) }} />
          )}
          <PlayColumn
            region={region}
            res={res}
            cols={patternSteps}
            first={p0}
            count={visCount}
            left={(j) => HEADER_W + colX(j)}
            width={cw}
            height={lanes.length * (rh + GAP) - GAP}
          />
          <button className="ss-addrow" style={{ marginLeft: 4 }} onClick={addRowMenu}>
            <Plus size={13} /> Add Row
          </button>
        </div>
      </div>
      <div className="ss-bottom">
        <button
          className={'btn ss-play' + (patternPlaying ? ' on' : '')}
          title={patternPlaying ? 'Stop (Space)' : 'Loop just this pattern, on its own — the song and its length stay untouched'}
          onClick={() => (patternPlaying ? engine.stop() : void engine.playPattern(regionId))}
        >
          {patternPlaying ? <Square size={13} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          {patternPlaying ? 'Stop' : 'Play Pattern'}
        </button>
        <PatternPicker trackId={track.id} region={region} counts={useCounts} />
        {linkCount > 1 && (
          <button className="btn sm ss-linked" title="This pattern is placed in several spots. Editing it changes all of them. Click to give this spot its own copy." onClick={() => makePatternUnique(regionId)}>
            <Link2 size={13} /> Used {linkCount}× <Unlink size={12} className="faint" />
          </button>
        )}
        <div className="ss-swing" title="Swing: push every other 16th late for a shuffled groove">
          <span className="label">Swing</span>
          <HSlider value={region.swing ?? 0} min={0} max={1} width={80} defaultValue={0} onChange={(v) => editRegion((r) => void (r.swing = Math.round(v * 100) / 100 || undefined))} />
          <span className="mono faint">{Math.round((region.swing ?? 0) * 100)}%</span>
        </div>
        <div className="ss-hint faint">
          {mode === 'step' && 'Click or drag to paint · right-click a row for tune, copy & your own sounds · drop an audio file on a row'}
          {mode === 'velocity' && 'Drag up/down on a step to set how hard it hits'}
          {mode === 'repeat' && 'Drag up/down to play 1–4 quick hits per step (rolls)'}
          {mode === 'chance' && 'Drag up/down to set the chance a step plays'}
          {mode === 'loop' && 'Click a step to end the pattern there'}
        </div>
        <div className="spacer" />
        <div className="ss-modes">
          {MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayColumn({
  region,
  res,
  cols,
  first,
  count,
  left,
  width,
  height,
}: {
  region: MidiRegion;
  res: number;
  cols: number;
  first: number;
  count: number;
  left: (j: number) => number;
  width: number;
  height: number;
}) {
  const pos = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  if (!playing || pos < region.start || pos >= region.start + region.length) return null;
  let rel = pos - region.start + region.offset;
  if (region.loop) rel = ((rel % region.contentLength) + region.contentLength) % region.contentLength;
  const step = Math.floor(rel / res);
  if (step < 0 || step >= cols || step < first || step >= first + count) return null;
  return <div className="ss-playcol" style={{ left: left(step - first), width, height }} />;
}

/** Which step of the region is sounding right now (or -1). */
function usePlayingStep(region: MidiRegion, res: number): number {
  const pos = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  if (!playing || pos < region.start || pos >= region.start + region.length) return -1;
  let rel = pos - region.start + region.offset;
  if (region.loop) rel = ((rel % region.contentLength) + region.contentLength) % region.contentLength;
  return Math.floor(rel / res);
}

/** GarageBand-style page selector with a mini overview of each page's hits. */
function PageBar({
  pages,
  pageSize,
  current,
  counts,
  res,
  bpb,
  region,
  cols,
  follow,
  onFollow,
  onAutoPage,
  onPage,
}: {
  pages: number;
  pageSize: number;
  current: number;
  counts: number[];
  res: number;
  bpb: number;
  region: MidiRegion;
  cols: number;
  follow: boolean;
  onFollow: () => void;
  onAutoPage: (k: number) => void;
  onPage: (k: number) => void;
}) {
  const playStep = usePlayingStep(region, res);
  const playPage = playStep >= 0 && playStep < cols ? Math.min(pages - 1, Math.floor(playStep / pageSize)) : -1;
  // Follow the playing page during playback.
  useEffect(() => {
    if (follow && playPage >= 0 && playPage !== current) onAutoPage(playPage);
  }, [follow, playPage, current, onAutoPage]);
  const maxCount = Math.max(1, ...counts);
  const label = (k: number) => {
    const beat = k * pageSize * res;
    const bar = Math.floor(beat / bpb + 1e-6) + 1;
    const inBar = beat - (bar - 1) * bpb;
    return inBar < 1e-6 ? `${bar}` : `${bar}.${Math.round(inBar) + 1}`;
  };
  return (
    <div className="ss-pages">
      <button className="btn sm icon" title="Previous page" disabled={current === 0} onClick={() => onPage(current - 1)}>
        <ChevronLeft size={14} />
      </button>
      <div className="ss-page-list">
        {Array.from({ length: pages }, (_, k) => {
          const slice = counts.slice(k * pageSize, (k + 1) * pageSize);
          return (
            <button
              key={k}
              className={'ss-page' + (k === current ? ' on' : '') + (k === playPage ? ' playing' : '')}
              onClick={() => onPage(k)}
              title={`Page ${k + 1} (bar ${label(k)})`}
            >
              <span className="ss-page-label">{label(k)}</span>
              <span className="ss-page-map">
                {slice.map((c, i) => (
                  <i key={i} style={{ height: c ? `${25 + (c / maxCount) * 75}%` : undefined }} className={c ? 'hit' : ''} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <button className="btn sm icon" title="Next page" disabled={current >= pages - 1} onClick={() => onPage(current + 1)}>
        <ChevronRight size={14} />
      </button>
      <button className={'btn sm' + (follow ? ' active' : '')} title="Follow the playing page during playback" onClick={onFollow}>
        <ChevronsRight size={14} /> Follow
      </button>
    </div>
  );
}

function panLabel(v: number): string {
  if (Math.abs(v) < 0.01) return 'centre';
  return `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'left' : 'right'}`;
}

/** Pick which pattern this clip plays, rename it, or start a new one (FL Studio's pattern selector). */
function PatternPicker({ trackId, region, counts }: { trackId: string; region: MidiRegion; counts: Map<string, number> }) {
  const project = useStore((s) => s.project)!;
  const [renaming, setRenaming] = useState(false);
  // One representative clip per pattern used anywhere on drum tracks.
  const seen = new Set<string>();
  const options: MidiRegion[] = [];
  for (const t of project.tracks) {
    if (t.type !== 'drums') continue;
    for (const r of t.regions)
      if (r.kind === 'midi' && r.patternId && r.loop && !seen.has(r.patternId)) {
        seen.add(r.patternId);
        options.push(r);
      }
  }
  options.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const rename = (v: string) =>
    commit((d) => {
      const r = draftRegion(d, region.id);
      if (r) r.name = v;
    });
  if (renaming)
    return (
      <input
        className="ss-patname"
        autoFocus
        defaultValue={region.name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== region.name) rename(v);
          setRenaming(false);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setRenaming(false);
        }}
      />
    );
  return (
    <button
      className="btn sm ss-patpick"
      title="Choose which pattern plays here, rename it, or make a new one"
      onClick={(e) =>
        showContextMenu(e, [
          { title: 'Play this pattern here' },
          ...options.map((o) => ({
            label: o.name + ((counts.get(o.patternId!) ?? 0) > 1 ? `  (${counts.get(o.patternId!)}×)` : ''),
            icon: o.patternId === region.patternId ? <Link2 size={13} /> : undefined,
            disabled: o.patternId === region.patternId,
            onClick: () => setClipPattern(region.id, o.id),
          })),
          { separator: true },
          { label: 'New Empty Pattern After This', icon: <Plus size={14} />, onClick: () => newPatternClip(trackId, region.id) },
          { label: 'Rename Pattern…', onClick: () => setRenaming(true) },
        ])
      }
    >
      <span className="ss-patdot" />
      {region.name}
      <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} />
    </button>
  );
}
