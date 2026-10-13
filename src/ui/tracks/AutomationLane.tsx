import { memo, useState } from 'react';
import type { Draft } from 'immer';
import type { AutomationParam, AutomationPoint, Project } from '../../model/types';
import { AUTOMATION_RANGE, filterHz } from '../../model/automation';
import { snap } from '../../model/music';
import { beginGesture, commit, endGesture, live, useStore } from '../../state/store';
import { startDrag } from '../common/drag';
import { showContextMenu } from '../common/menus';
import { AUTOMATION_H } from './tracksUi';

type Param = AutomationParam;

interface Props {
  /** Track id, or null for the master track. */
  trackId: string | null;
  param: Param;
  points: AutomationPoint[];
  fallback: number;
  width: number;
  ppb: number;
  color: string;
}

const PAD = 7;

function pointsOf(d: Draft<Project>, trackId: string | null, param: Param): Draft<AutomationPoint>[] | null {
  if (trackId === null) return d.masterAutomation;
  const t = d.tracks.find((x) => x.id === trackId);
  if (!t) return null;
  return (t.automation[param] ??= []);
}

export function formatAutomation(param: Param, v: number): string {
  if (param === 'filter') {
    const hz = filterHz(v);
    return v >= 0.999 ? 'Open' : hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;
  }
  if (param === 'reverb' || param === 'delay') return `${Math.round(v * 100)}%`;
  if (param === 'pan') return v === 0 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`;
  if (v <= 0.0001) return '−∞ dB';
  return `${(20 * Math.log10(v * v)).toFixed(1)} dB`;
}

function AutomationLane({ trackId, param, points, fallback, width, ppb, color }: Props) {
  const H = AUTOMATION_H;
  const [min, max] = AUTOMATION_RANGE[param];
  const [hint, setHint] = useState<{ x: number; y: number; text: string } | null>(null);
  const toY = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const fromY = (y: number) => Math.max(min, Math.min(max, min + (1 - (y - PAD) / (H - PAD * 2)) * (max - min)));

  const dragPoint = (e: React.PointerEvent, index: number, svg: SVGSVGElement, fresh: boolean) => {
    const rect = svg.getBoundingClientRect();
    if (!fresh) beginGesture();
    startDrag(
      e,
      ({ x, y, event }) => {
        const grid = event.ctrlKey ? 0 : useStore.getState().snapGrid;
        let beat = (x - rect.left) / ppb;
        if (grid) beat = snap(beat, grid / 2);
        let v = fromY(y - rect.top);
        if (param === 'volume' && Math.abs(v - 1) < 0.03) v = 1; // detent at unity
        if (param === 'pan' && Math.abs(v) < 0.04) v = 0;
        live((d) => {
          const pts = pointsOf(d, trackId, param);
          if (!pts || !pts[index]) return;
          const lo = index > 0 ? pts[index - 1].beat : 0;
          const hi = index < pts.length - 1 ? pts[index + 1].beat : Infinity;
          pts[index].beat = Math.max(lo, Math.min(hi, Math.max(0, beat)));
          pts[index].value = v;
        });
        setHint({ x: x - rect.left, y: y - rect.top, text: formatAutomation(param, v) });
      },
      () => {
        setHint(null);
        endGesture();
      },
    );
  };

  const onBgDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const grid = e.ctrlKey ? 0 : useStore.getState().snapGrid;
    let beat = Math.max(0, (e.clientX - rect.left) / ppb);
    if (grid) beat = snap(beat, grid / 2);
    const value = fromY(e.clientY - rect.top);
    let index = points.findIndex((p) => p.beat > beat);
    if (index < 0) index = points.length;
    beginGesture();
    live((d) => {
      const pts = pointsOf(d, trackId, param);
      pts?.splice(index, 0, { beat, value });
    });
    dragPoint(e, index, svg, true);
  };

  const removePoint = (i: number) =>
    commit((d) => {
      pointsOf(d, trackId, param)?.splice(i, 1);
    });

  let path = '';
  let area = '';
  if (points.length) {
    const xs = points.map((p) => p.beat * ppb);
    const ys = points.map((p) => toY(p.value));
    path = `M0 ${ys[0]} ` + xs.map((x, i) => `L${x} ${ys[i]}`).join(' ') + ` L${width} ${ys[ys.length - 1]}`;
    area = path + ` L${width} ${H} L0 ${H} Z`;
  }

  return (
    <div className="automation-lane" style={{ width, height: H, ['--c' as string]: color }}>
      <svg
        width={width}
        height={H}
        onPointerDown={onBgDown}
        onContextMenu={(e) =>
          showContextMenu(e, [
            {
              label: 'Clear All Points',
              disabled: !points.length,
              onClick: () =>
                commit((d) => {
                  const pts = pointsOf(d, trackId, param);
                  if (pts) pts.splice(0, pts.length);
                }),
            },
          ])
        }
      >
        {param === 'pan' && <line x1={0} x2={width} y1={toY(0)} y2={toY(0)} className="auto-center" />}
        {param === 'volume' && <line x1={0} x2={width} y1={toY(1)} y2={toY(1)} className="auto-center" />}
        {points.length ? (
          <>
            {param !== 'pan' && <path d={area} className="auto-area" />}
            <path d={path} className="auto-line" />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.beat * ppb}
                cy={toY(p.value)}
                r={4.5}
                className="auto-pt"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  dragPoint(e, i, e.currentTarget.ownerSVGElement!, false);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  removePoint(i);
                }}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  showContextMenu(e, [{ label: 'Delete Point', onClick: () => removePoint(i) }]);
                }}
              >
                <title>{formatAutomation(param, p.value)}</title>
              </circle>
            ))}
          </>
        ) : (
          <line x1={0} x2={width} y1={toY(fallback)} y2={toY(fallback)} className="auto-line idle" />
        )}
      </svg>
      {hint && (
        <div className="auto-hint" style={{ left: hint.x + 10, top: Math.max(0, hint.y - 22) }}>
          {hint.text}
        </div>
      )}
    </div>
  );
}

export default memo(AutomationLane);
