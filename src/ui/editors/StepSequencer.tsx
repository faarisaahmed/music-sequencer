// GarageBand-style drum Beat Sequencer: rows per drum piece, glowing step pads,
// and Step / Velocity / Note Repeat / Chance / Loop editing modes.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Dices, Eraser, LayoutGrid, MoreHorizontal, Plus } from 'lucide-react';
import type { Draft } from 'immer';
import type { MidiRegion, Note, Project } from '../../model/types';
import { beginGesture, commit, draftRegion, endGesture, findRegion, live, useStore, useTransport } from '../../state/store';
import { DRUM_LANES, DRUM_NAMES, beatsPerBar } from '../../model/music';
import { uid } from '../../model/defaults';
import { drumPattern } from '../../model/templates';
import { PRESETS } from '../../audio/presets';
import { setTrackInstrument } from '../../state/actions';
import { getEngine } from '../../audio/engine';
import { showContextMenu, type MenuItem } from '../common/menus';
import { clamp } from '../common/drag';
import { DrumIcon, drumColor } from './steps/drumVisuals';
import { DRUM_PRESETS, presetSteps, type DrumPreset } from './steps/patterns';
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
const HEADER_W = 158;
const GAP = 4;
const GROUP_GAP = 5;
const BAR_GAP = 6;

/** Remembered extra/hidden rows per track so they survive switching regions. */
const laneMemory = new Map<string, { extra: number[]; hidden: number[] }>();

const stepOf = (n: Note, res: number) => Math.floor(n.start / res + 1e-6);

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
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ w: 900, h: 300 });
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
    setSlot(document.getElementById('editor-toolbar-slot'));
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const region = found?.region.kind === 'midi' ? found.region : null;
  const track = found?.track;
  const notes = useMemo(() => region?.notes ?? [], [region]);

  const cellMap = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of notes) m.set(`${n.pitch}:${stepOf(n, res)}`, n);
    return m;
  }, [notes, res]);

  const lanes = useMemo(() => {
    const used = new Set(notes.map((n) => n.pitch));
    const set = new Set<number>([...DEFAULT_LANES, ...extra, ...used]);
    for (const h of hidden) if (!used.has(h)) set.delete(h);
    const order = (p: number) => {
      const i = DRUM_LANES.indexOf(p);
      return i < 0 ? 100 + p : i;
    };
    return [...set].sort((a, b) => order(a) - order(b));
  }, [notes, extra, hidden]);

  if (!region || !track) return null;

  const bpb = beatsPerBar(project.timeSig);
  const cl = region.contentLength;
  const patternSteps = Math.max(1, Math.round(cl / res));
  const displayBars = Math.max(1, Math.ceil(cl / bpb - 1e-6));
  const cols = mode === 'loop' ? Math.max(patternSteps, Math.round((displayBars * bpb) / res)) : patternSteps;
  const group = Math.max(1, Math.round(1 / res)); // steps per beat
  const barSteps = Math.max(1, Math.round(bpb / res));

  // Geometry
  const nGroups = Math.floor((cols - 1) / group);
  const nBars = Math.floor((cols - 1) / barSteps);
  const availW = size.w - HEADER_W - 24;
  const cw = clamp((availW - (cols - 1) * GAP - nGroups * GROUP_GAP - nBars * BAR_GAP) / cols, 18, 90);
  const rh = clamp((size.h - 44 - lanes.length * GAP) / lanes.length, 26, 64);
  const colX = (i: number) => i * (cw + GAP) + Math.floor(i / group) * GROUP_GAP + Math.floor(i / barSteps) * BAR_GAP;
  const gridW = colX(cols - 1) + cw;

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

  const applyPreset = (p: DrumPreset) => {
    const steps = presetSteps(p);
    // Fit the preset to the current pattern length by repeating it.
    const targetSteps = Math.max(steps, Math.round(cl / 0.25));
    const lanesRep: Record<number, string> = {};
    for (const [pitch, pat] of Object.entries(p.lanes)) {
      const clean = pat.replace(/\s|\|/g, '').padEnd(steps, '.');
      lanesRep[Number(pitch)] = clean.repeat(Math.ceil(targetSteps / steps)).slice(0, targetSteps);
    }
    setRes(0.25);
    editRegion((r) => {
      r.notes = drumPattern(lanesRep, 0.25);
      r.contentLength = targetSteps * 0.25;
      r.loop = true;
      r.name = p.name;
      if (r.length < r.contentLength) r.length = r.contentLength;
    });
    const newExtra = Object.keys(p.lanes).map(Number).filter((x) => !DEFAULT_LANES.includes(x) && !extra.includes(x));
    if (newExtra.length) setExtra([...extra, ...newExtra]);
  };

  const randomize = () => {
    const beatsInBar = Math.round(bpb / (4 / project.timeSig[1]));
    const out: Note[] = [];
    const add = (pitch: number, step: number, vel: number) => out.push({ id: uid('n'), pitch, start: step * res, duration: res, velocity: clamp(vel, 0.1, 1) });
    const half = Math.max(1, Math.round(group / 2));
    const lastBarStart = Math.floor((patternSteps - 1) / barSteps) * barSteps;
    const opened = new Set<number>();
    for (const pitch of lanes) {
      for (let i = 0; i < patternSteps; i++) {
        const pos = i % group;
        const beat = Math.floor(i / group) % beatsInBar;
        const onBeat = pos === 0;
        const r = Math.random();
        const accent = onBeat ? 0.95 : 0.7 + Math.random() * 0.15;
        switch (pitch) {
          case 36:
          case 35: {
            const p = onBeat ? (beat === 0 ? 1 : beat === 2 ? 0.7 : 0.2) : pos === half ? 0.22 : 0.1;
            if (r < p) add(pitch, i, accent);
            break;
          }
          case 38:
          case 40:
            if (onBeat && beat % 2 === 1) add(pitch, i, 0.95);
            else if (!onBeat && r < 0.07) add(pitch, i, 0.4);
            break;
          case 39:
            if (onBeat && beat % 2 === 1 && r < 0.45) add(pitch, i, 0.85);
            break;
          case 42:
          case 44:
            if (pos % Math.max(1, half) === 0 ? r < 0.88 : r < 0.3) add(pitch, i, onBeat ? 0.85 : 0.55 + Math.random() * 0.2);
            break;
          case 46:
            if (pos === half && beat === beatsInBar - 1 && r < 0.55) {
              add(pitch, i, 0.75);
              opened.add(i);
            }
            break;
          case 49:
            if (i === 0 && r < 0.6) add(pitch, i, 0.9);
            break;
          case 51:
            if (pos % half === 0 && r < 0.4) add(pitch, i, 0.6);
            break;
          case 41:
          case 43:
          case 45:
          case 47:
          case 48:
          case 50:
            if (i >= lastBarStart + barSteps - group && r < 0.45) add(pitch, i, 0.8);
            break;
          default:
            if (r < (onBeat ? 0.18 : 0.1)) add(pitch, i, 0.5 + Math.random() * 0.4);
        }
      }
    }
    // Open hats choke closed hats on the same step.
    const final = out.filter((n) => !(n.pitch === 42 && opened.has(Math.round(n.start / res))));
    editRegion((r) => {
      r.notes = final;
      r.name = 'Random Beat';
    });
  };

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
    return [
      { title: DRUM_NAMES[pitch] ?? `Note ${pitch}` },
      { label: 'Audition', onClick: () => engine.preview(trackId, pitch, 0.9, 0.25) },
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
        },
      },
    ];
  };

  const addRowMenu = (e: React.MouseEvent) => {
    const avail = Object.keys(DRUM_NAMES)
      .map(Number)
      .filter((p) => !lanes.includes(p));
    showContextMenu(
      e,
      avail.length
        ? avail.map((p) => ({
            label: DRUM_NAMES[p],
            onClick: () => {
              setExtra([...extra, p]);
              setHidden(hidden.filter((h) => h !== p));
              engine.preview(trackId, p, 0.8, 0.25);
            },
          }))
        : [{ label: 'All rows are shown', disabled: true }],
    );
  };

  const presetMenu = (e: React.MouseEvent) =>
    showContextMenu(e, [{ title: 'Pattern Presets' }, ...DRUM_PRESETS.map((p) => ({ label: p.name, onClick: () => applyPreset(p) }))]);

  const kits = PRESETS.filter((p) => p.kind === 'drums');
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
        {[1, 2, 4].map((b) => (
          <button key={b} className={Math.abs(currentBars - b) < 1e-6 ? 'on' : ''} onClick={() => setBars(b)}>
            {b} bar{b > 1 ? 's' : ''}
          </button>
        ))}
      </div>
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
      <div className="ss-scroll" ref={scrollRef}>
        <div className="ss-grid" style={{ width: HEADER_W + gridW + 12 }} onPointerDown={onGridDown}>
          {lanes.map((pitch) => {
            const color = drumColor(pitch);
            return (
              <div key={pitch} className="ss-row" style={{ height: rh, ['--c' as string]: color }}>
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
                  <span className="ss-name">{DRUM_NAMES[pitch] ?? `Note ${pitch}`}</span>
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
                  {Array.from({ length: cols }, (_, i) => {
                    const n = cellMap.get(`${pitch}:${i}`);
                    const outside = i >= patternSteps;
                    const cls = 'ss-cell' + (n && !outside ? ' on' : '') + (outside ? ' outside' : '') + (Math.floor(i / group) % 2 ? ' alt' : '');
                    let inner: React.ReactNode = null;
                    let style: React.CSSProperties = { left: colX(i), width: cw };
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
          {mode === 'loop' && (
            <div className="ss-loopmark" style={{ left: HEADER_W + colX(patternSteps - 1) + cw + 2, height: lanes.length * (rh + GAP) }} />
          )}
          <PlayColumn region={region} res={res} cols={patternSteps} left={(i) => HEADER_W + colX(i)} width={cw} height={lanes.length * (rh + GAP) - GAP} />
          <button className="ss-addrow" style={{ marginLeft: 4 }} onClick={addRowMenu}>
            <Plus size={13} /> Add Row
          </button>
        </div>
      </div>
      <div className="ss-bottom">
        <input
          className="ss-patname"
          key={region.name}
          defaultValue={region.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== region.name) editRegion((r) => void (r.name = v));
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button className="btn ss-bbtn" title="Pattern presets" onClick={presetMenu}>
          <LayoutGrid size={17} />
        </button>
        <button className="btn ss-bbtn" title="Randomize pattern" onClick={randomize}>
          <Dices size={18} />
        </button>
        <div className="ss-hint faint">
          {mode === 'step' && 'Click or drag to paint steps · right-click a row for more'}
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

function PlayColumn({ region, res, cols, left, width, height }: { region: MidiRegion; res: number; cols: number; left: (i: number) => number; width: number; height: number }) {
  const pos = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  if (!playing || pos < region.start || pos >= region.start + region.length) return null;
  let rel = pos - region.start + region.offset;
  if (region.loop) rel = ((rel % region.contentLength) + region.contentLength) % region.contentLength;
  const step = Math.floor(rel / res);
  if (step < 0 || step >= cols) return null;
  return <div className="ss-playcol" style={{ left: left(step), width, height }} />;
}
