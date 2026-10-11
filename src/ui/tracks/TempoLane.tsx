// Tempo & time-signature lane: the tempo as a line you can drag (sudden or gradual changes)
// and time-signature flags at bar lines. Tap anything to edit it.
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gauge, Plus, Repeat, Trash2 } from 'lucide-react';
import { beginGesture, endGesture, useStore } from '../../state/store';
import { meterOf, tempoOf } from '../../model/timeline';
import { snap } from '../../model/music';
import type { Project } from '../../model/types';
import {
  addTempoChange,
  deleteMeterChange,
  deleteTempoChange,
  moveMeterChange,
  setMeterFrom,
  setTempoAt,
  tempoGesture,
  updateTempoChange,
  MAX_BPM,
  MIN_BPM,
} from '../../state/timelineActions';
import { startDrag } from '../common/drag';
import { showContextMenu, type MenuItem } from '../common/menus';
import { Toggle } from '../common/controls';
import { isPhone } from '../mobile/device';
import { Sheet } from '../mobile/Sheet';
import { hasForm } from '../../model/form';
import { addEndings, deleteNav, deleteVolta, navLabel, repeatBars, setPlayRepeats, setRepeatTimes, setVoltaLength, setVoltaNumbers, toggleNav } from '../../state/formActions';
import type { NavMark, Volta } from '../../model/types';
import { getEngine } from '../../audio/engine';

const LANE_H = 76;
/** Top band: repeats, endings and jumps. */
const FORM_H = 18;
const PAD = FORM_H + 8;
/** Room at the bottom of the lane for the time-signature flags. */
const FLAGS_H = 20;
export const METERS: [number, number][] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 4],
  [7, 4],
  [3, 8],
  [5, 8],
  [6, 8],
  [7, 8],
  [9, 8],
  [12, 8],
  [2, 2],
  [3, 2],
];

type Edit = { kind: 'tempo'; id: string | null; x: number; y: number } | { kind: 'meter'; bar: number; x: number; y: number };

export default function TempoLane({ width, ppb }: { width: number; ppb: number }) {
  const project = useStore((s) => s.project)!;
  const laneRef = useRef<HTMLDivElement>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const tm = tempoOf(project);
  const meter = meterOf(project);

  // Vertical scale: the song's tempo range with some room.
  const all = [project.bpm, ...(project.tempoChanges ?? []).map((c) => c.bpm)];
  let lo = Math.min(...all) - 10;
  let hi = Math.max(...all) + 10;
  if (hi - lo < 40) {
    const mid = (hi + lo) / 2;
    lo = mid - 20;
    hi = mid + 20;
  }
  const yOf = (bpm: number) => PAD + (1 - (bpm - lo) / (hi - lo)) * (LANE_H - PAD - FLAGS_H);
  const bpmFromDrag = (base: number, dy: number) => base - (dy / (LANE_H - PAD - FLAGS_H)) * (hi - lo);

  // The tempo line: flat between points, sloped into gradual changes.
  const changes = [...(project.tempoChanges ?? [])].sort((a, b) => a.beat - b.beat);
  let d = `M0 ${yOf(project.bpm)}`;
  let prevBpm = project.bpm;
  for (const c of changes) {
    const x = c.beat * ppb;
    if (c.ramp) d += ` L${x} ${yOf(c.bpm)}`;
    else d += ` L${x} ${yOf(prevBpm)} L${x} ${yOf(c.bpm)}`;
    prevBpm = c.bpm;
  }
  d += ` L${width} ${yOf(prevBpm)}`;

  const beatAt = (clientX: number) => {
    const r = laneRef.current!.getBoundingClientRect();
    return Math.max(0, (clientX - r.left) / ppb);
  };
  const snapBeat = (b: number, ev?: { ctrlKey?: boolean }) => {
    const g = ev?.ctrlKey ? 0 : useStore.getState().snapGrid || 1;
    return g ? snap(b, g) : b;
  };

  const dragPoint = (e: React.PointerEvent, id: string | null) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p0 = useStore.getState().project!;
    const c0 = id ? p0.tempoChanges?.find((c) => c.id === id) : undefined;
    const base = c0 ? c0.bpm : p0.bpm;
    const beat0 = c0?.beat ?? 0;
    let moved = false;
    startDrag(
      e,
      ({ dx, dy, event }) => {
        if (!moved) {
          moved = true;
          beginGesture();
        }
        const bpm = Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, bpmFromDrag(base, dy))));
        if (id) {
          const vertical = Math.abs(dy) > Math.abs(dx) * 1.5;
          updateTempoChange(id, { bpm, beat: vertical ? beat0 : Math.max(snapBeat(beat0 + dx / ppb, event), 0.25) }, true);
        } else tempoGesture.move(0, bpm);
      },
      ({ moved: m }) => {
        if (m) endGesture();
        else {
          const r = (e.target as Element).getBoundingClientRect();
          setEdit({ kind: 'tempo', id, x: r.left + r.width / 2, y: r.bottom });
        }
      },
      { threshold: 3 },
    );
  };

  const dragMeter = (e: React.PointerEvent, bar: number, id: string | undefined) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    startDrag(
      e,
      () => undefined,
      ({ moved, x }) => {
        if (moved && id) {
          const to = meter.barAt(beatAt(x)).bar;
          if (to !== bar && to > 0) moveMeterChange(id, to);
        } else if (!moved) {
          const r = (e.target as Element).getBoundingClientRect();
          setEdit({ kind: 'meter', bar, x: r.left + r.width / 2, y: r.bottom });
        }
      },
      { threshold: 4 },
    );
  };

  const addHere = (clientX: number) => {
    const b = snapBeat(beatAt(clientX));
    if (b < 0.25) return setEdit({ kind: 'tempo', id: null, x: clientX, y: laneRef.current!.getBoundingClientRect().bottom });
    const id = addTempoChange(b, tm.bpmAt(b));
    setEdit({ kind: 'tempo', id, x: clientX, y: laneRef.current!.getBoundingClientRect().bottom });
  };

  const laneMenu = (clientX: number): MenuItem[] => {
    const b = beatAt(clientX);
    const bar = meter.barAt(b);
    return [
      { label: 'Add Tempo Change Here', onClick: () => addHere(clientX) },
      {
        label: `Time Signature from Bar ${bar.bar + 1}`,
        submenu: METERS.map((m) => ({ label: `${m[0]}/${m[1]}`, onClick: () => setMeterFrom(bar.start, m) })),
      },
      { label: `Repeats & Jumps at Bar ${bar.bar + 1}`, submenu: formMenu(bar.bar) },
    ];
  };

  // Meter flags: the opening one and every change.
  const flags = meter.segs.map((g) => ({ bar: g.bar, beat: g.beat, sig: g.sig, id: (project.meterChanges ?? []).find((c) => c.bar === g.bar)?.id }));

  return (
    <div className="tempo-row">
      <div className="tempo-corner">
        <Gauge size={14} className="dim" />
        <span title="Tempo, time signature, repeats and endings">Tempo &amp; Form</span>
        {hasForm(project) && (
          <button
            className={'btn ghost icon sm' + (project.playRepeats === false ? '' : ' active')}
            title={project.playRepeats === false ? 'Repeats are ignored when playing. Click to follow them' : 'Playing follows the repeats and jumps. Click to play straight through'}
            onClick={() => setPlayRepeats(project.playRepeats === false)}
          >
            <Repeat size={13} />
          </button>
        )}
        <button
          className="btn ghost icon sm"
          title="Add a tempo or time signature change at the playhead"
          onClick={(e) => {
            const r = laneRef.current!.getBoundingClientRect();
            const x = r.left + getEngine().position * ppb;
            showContextMenu({ clientX: e.clientX, clientY: e.clientY }, laneMenu(Math.max(r.left, x)));
          }}
        >
          <Plus size={14} />
        </button>
      </div>
      <div
        ref={laneRef}
        className="tempo-lane"
        style={{ width, height: LANE_H }}
        onDoubleClick={(e) => (e.target === e.currentTarget || (e.target as Element).tagName === 'svg') && addHere(e.clientX)}
        onContextMenu={(e) => showContextMenu(e, laneMenu(e.clientX))}
      >
        <svg width={width} height={LANE_H} className="tempo-svg">
          <line x1={0} x2={width} y1={FORM_H + 0.5} y2={FORM_H + 0.5} className="form-sep" />
          <path d={d} className="tempo-line" />
        </svg>
        <FormMarks ppb={ppb} />
        <div
          className="tempo-pt base"
          style={{ left: 0, top: yOf(project.bpm) }}
          onPointerDown={(e) => dragPoint(e, null)}
          title="Opening tempo: drag up or down, or tap to type"
        >
          <span className={yOf(project.bpm) < 18 ? 'below' : ''}>{fmtBpm(project.bpm)}</span>
        </div>
        {changes.map((c) => (
          <div
            key={c.id}
            className={'tempo-pt' + (c.ramp ? ' ramp' : '')}
            style={{ left: c.beat * ppb, top: yOf(c.bpm) }}
            onPointerDown={(e) => dragPoint(e, c.id)}
            title={`${fmtBpm(c.bpm)} BPM${c.ramp ? ' (gradual)' : ''}: drag to change, tap to edit`}
          >
            <span className={yOf(c.bpm) < 18 ? 'below' : ''}>{fmtBpm(c.bpm)}</span>
          </div>
        ))}
        {flags.map((f) => (
          <div
            key={'m' + f.bar}
            className={'meter-flag' + (f.bar === 0 ? ' base' : '')}
            style={{ left: f.beat * ppb }}
            onPointerDown={(e) => dragMeter(e, f.bar, f.id)}
            title={f.bar === 0 ? 'Opening time signature: tap to change' : `Bar ${f.bar + 1}: ${f.sig[0]}/${f.sig[1]}. Drag to another bar, tap to edit`}
          >
            {f.sig[0]}/{f.sig[1]}
          </div>
        ))}
      </div>
      {edit && <EditPopover edit={edit} project={project} onClose={() => setEdit(null)} />}
    </div>
  );
}

function fmtBpm(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function EditPopover({ edit, project, onClose }: { edit: Edit; project: Project; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: edit.x, top: edit.y + 6 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({ left: Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, edit.x - el.offsetWidth / 2)), top: Math.min(edit.y + 6, window.innerHeight - el.offsetHeight - 8) });
    const close = (e: PointerEvent) => !el.contains(e.target as Node) && onClose();
    const t = setTimeout(() => window.addEventListener('pointerdown', close), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
    };
  }, [edit, onClose]);

  const body =
    edit.kind === 'tempo' ? <TempoEditor id={edit.id} project={project} onClose={onClose} /> : <MeterEditor bar={edit.bar} project={project} onClose={onClose} />;
  if (isPhone()) return <Sheet title={edit.kind === 'tempo' ? 'Tempo' : 'Time Signature'} onClose={onClose}>{body}</Sheet>;
  return createPortal(
    <div ref={ref} className="tempo-pop" style={pos}>
      {body}
    </div>,
    document.body,
  );
}

function TempoEditor({ id, project, onClose }: { id: string | null; project: Project; onClose: () => void }) {
  const c = id ? project.tempoChanges?.find((x) => x.id === id) : undefined;
  const bpm = c ? c.bpm : project.bpm;
  const meter = meterOf(project);
  const save = (v: string) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return;
    if (c) updateTempoChange(c.id, { bpm: n });
    else setTempoAt(0, n);
  };
  return (
    <div className="tempo-edit">
      <div className="tempo-edit-head">{c ? `Tempo change at bar ${meter.format(c.beat).replace(/\.1\.1$/, '')}` : 'Opening tempo'}</div>
      <label className="tempo-edit-row">
        <input
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          step={1}
          defaultValue={bpm}
          key={bpm}
          autoFocus={!isPhone()}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              save((e.target as HTMLInputElement).value);
              onClose();
            }
            if (e.key === 'Escape') onClose();
          }}
        />
        <span>BPM</span>
      </label>
      {c && (
        <>
          <label className="tempo-edit-row toggle-row">
            <Toggle on={!!c.ramp} onChange={(v) => updateTempoChange(c.id, { ramp: v })} />
            <span>Gradual: speed up or slow down into it</span>
          </label>
          <button
            className="btn sm tempo-del"
            onClick={() => {
              deleteTempoChange(c.id);
              onClose();
            }}
          >
            <Trash2 size={13} /> Remove Tempo Change
          </button>
        </>
      )}
    </div>
  );
}

function MeterEditor({ bar, project, onClose }: { bar: number; project: Project; onClose: () => void }) {
  const meter = meterOf(project);
  const start = meter.barStart(bar);
  const sig = meter.sigAt(start);
  const change = (project.meterChanges ?? []).find((c) => c.bar === bar);
  return (
    <div className="tempo-edit">
      <div className="tempo-edit-head">{bar === 0 ? 'Opening time signature' : `From bar ${bar + 1}`}</div>
      <div className="meter-grid">
        {METERS.map((m) => (
          <button
            key={`${m[0]}/${m[1]}`}
            className={'btn sm' + (m[0] === sig[0] && m[1] === sig[1] ? ' active' : '')}
            onClick={() => {
              setMeterFrom(start, m);
              onClose();
            }}
          >
            {m[0]}/{m[1]}
          </button>
        ))}
      </div>
      {change && (
        <button
          className="btn sm tempo-del"
          onClick={() => {
            deleteMeterChange(change.id);
            onClose();
          }}
        >
          <Trash2 size={13} /> Remove Change
        </button>
      )}
      <div className="faint tempo-edit-note">Notes stay where they are; the bar lines move around them.</div>
    </div>
  );
}

/** Everything you can put at a bar: repeats, endings, segno/coda and the jumps. */
export function formMenu(bar: number): MenuItem[] {
  const p = useStore.getState().project!;
  const has = (k: NavMark['kind']) => (p.navMarks ?? []).some((m) => m.kind === k && m.bar === bar);
  const tick = (on: boolean, label: string) => (on ? `${label}  ✓` : label);
  return [
    { label: 'Repeat This Bar', onClick: () => repeatBars(bar, bar) },
    { label: tick(has('repeatStart'), 'Start Repeat (|:) Here'), onClick: () => toggleNav('repeatStart', bar) },
    { label: tick(has('repeatEnd'), 'End Repeat (:|) After This Bar'), onClick: () => toggleNav('repeatEnd', bar) },
    {
      label: '1st & 2nd Endings From Here',
      submenu: [1, 2, 4].map((n) => ({ label: `${n} bar${n > 1 ? 's' : ''} each`, onClick: () => addEndings(bar, n) })),
    },
    { separator: true },
    { label: tick(has('segno'), 'Segno Here'), onClick: () => toggleNav('segno', bar) },
    { label: tick(has('coda'), 'Coda Starts Here'), onClick: () => toggleNav('coda', bar) },
    { label: tick(has('toCoda'), 'To Coda After This Bar'), onClick: () => toggleNav('toCoda', bar) },
    { label: tick(has('fine'), 'Fine After This Bar'), onClick: () => toggleNav('fine', bar) },
    {
      label: 'Jump After This Bar',
      submenu: (
        [
          ['dc', 'end'],
          ['dc', 'fine'],
          ['dc', 'coda'],
          ['ds', 'end'],
          ['ds', 'fine'],
          ['ds', 'coda'],
        ] as const
      ).map(([kind, until]) => ({ label: navLabel({ kind, until }), onClick: () => toggleNav(kind, bar, { until }) })),
    },
  ];
}

/** Repeat signs, jumps and ending brackets in the lane's top band. */
function FormMarks({ ppb }: { ppb: number }) {
  const project = useStore((s) => s.project)!;
  const meter = meterOf(project);
  const marks = project.navMarks ?? [];
  const voltas = project.voltas ?? [];
  const atEnd = (m: NavMark) => m.kind === 'repeatEnd' || m.kind === 'toCoda' || m.kind === 'fine' || m.kind === 'dc' || m.kind === 'ds';
  const markMenu = (m: NavMark): MenuItem[] => [
    { title: navLabel(m) },
    ...(m.kind === 'repeatEnd'
      ? [{ label: 'Play the Passage', submenu: [2, 3, 4, 5, 6].map((n) => ({ label: `${n} times${(m.times ?? 2) === n ? '  ✓' : ''}`, onClick: () => setRepeatTimes(m.id, n) })) }]
      : []),
    { label: 'Remove', icon: <Trash2 size={14} />, onClick: () => deleteNav(m.id) },
  ];
  const voltaMenu = (v: Volta): MenuItem[] => [
    { title: `Ending ${v.numbers.join(', ')}` },
    { label: 'Played On', submenu: [[1], [2], [3], [1, 2], [1, 2, 3], [2, 3]].map((ns) => ({ label: ns.join(', ') + (ns.join() === v.numbers.join() ? '  ✓' : ''), onClick: () => setVoltaNumbers(v.id, ns) })) },
    { label: 'Length', submenu: [1, 2, 3, 4, 8].map((n) => ({ label: `${n} bar${n > 1 ? 's' : ''}${v.end - v.start === n ? '  ✓' : ''}`, onClick: () => setVoltaLength(v.id, n) })) },
    { label: 'Remove', icon: <Trash2 size={14} />, onClick: () => deleteVolta(v.id) },
  ];
  return (
    <>
      {voltas.map((v) => {
        const x0 = meter.barStart(v.start) * ppb;
        const x1 = meter.barStart(v.end) * ppb;
        return (
          <div
            key={v.id}
            className="volta"
            style={{ left: x0 + 1, width: Math.max(14, x1 - x0 - 3) }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => showContextMenu(e, voltaMenu(v))}
            onContextMenu={(e) => showContextMenu(e, voltaMenu(v))}
            title={`Ending ${v.numbers.join(', ')}: played on pass ${v.numbers.join(' and ')}`}
          >
            {v.numbers.join(', ')}.
          </div>
        );
      })}
      {marks.map((m) => {
        const x = meter.barStart(atEnd(m) ? m.bar + 1 : m.bar) * ppb;
        const label = m.kind === 'repeatStart' ? '|:' : m.kind === 'repeatEnd' ? `:|${(m.times ?? 2) > 2 ? ' ×' + m.times : ''}` : navLabel(m);
        return (
          <div
            key={m.id}
            className={'nav-mark ' + m.kind + (atEnd(m) ? ' end' : '')}
            style={{ left: x }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => showContextMenu(e, markMenu(m))}
            onContextMenu={(e) => showContextMenu(e, markMenu(m))}
            title={navLabel(m) + ': click for options'}
          >
            {label}
          </div>
        );
      })}
    </>
  );
}
