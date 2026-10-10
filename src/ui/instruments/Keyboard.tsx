// Realistic on-screen piano keyboard with glissando / scroll dragging.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { noteName } from '../../model/music';
import { getEngine } from '../../audio/engine';
import { useStore } from '../../state/store';
import { press, release, velocityFromY } from './player';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const HAS_BLACK_AFTER = new Set([0, 2, 5, 7, 9]);

/** Pitches lit because the engine is playing them live on the given track. */
export function useLiveNotes(trackId: string | null): Set<number> {
  const [lit, setLit] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!trackId) return;
    const counts = new Map<number, number>();
    const off = getEngine().onLive((pitch, on, tid) => {
      if (tid !== trackId) return;
      counts.set(pitch, Math.max(0, (counts.get(pitch) ?? 0) + (on ? 1 : -1)));
      setLit(new Set([...counts].filter(([, c]) => c > 0).map(([p]) => p)));
    });
    return () => {
      off();
      setLit(new Set());
    };
  }, [trackId]);
  return lit;
}

export interface KeyboardProps {
  /** First visible note (should be a C). */
  start: number;
  whiteWidth: number;
  mode: 'glissando' | 'scroll';
  /** Optional per-pitch label (musical typing legend). */
  legend?: Record<number, string>;
  /** Pitches to mark (e.g. scale notes) */
  dimOutside?: Set<number> | null;
  onScrollOctaves?: (octaves: number) => void;
  range?: [number, number];
}

export default function Keyboard({ start, whiteWidth, mode, legend, dimOutside, onScrollOctaves, range }: KeyboardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const trackId = useStore((s) => s.selectedTrackId);
  const lit = useLiveNotes(trackId);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const nWhite = Math.max(7, Math.ceil(width / whiteWidth));
  const whites: number[] = [];
  for (let i = 0; i < nWhite; i++) whites.push(start + 12 * Math.floor(i / 7) + WHITE_PCS[i % 7]);
  const blackW = whiteWidth * 0.6;

  const pitchAt = (x: number, y: number): { pitch: number; rect: DOMRect } | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-pitch]') as HTMLElement | null;
    if (!el || !ref.current?.contains(el)) return null;
    return { pitch: Number(el.dataset.pitch), rect: el.getBoundingClientRect() };
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const hit = pitchAt(e.clientX, e.clientY);
    const source = `kb:${e.pointerId}`;
    const baseVel = () => useStore.getState().velocity;
    const vel = (ev: { clientY: number }, rect: DOMRect) => Math.max(0.08, Math.min(1, baseVel() * velocityFromY(ev, rect, 0.55) * 1.15));
    let current = hit?.pitch ?? null;
    if (hit) press(source, [hit.pitch], vel(e, hit.rect));
    const x0 = e.clientX;
    let scrolled = 0;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (mode === 'scroll') {
        const octs = Math.trunc((x0 - ev.clientX) / (whiteWidth * 5));
        if (octs !== scrolled) {
          onScrollOctaves?.(octs - scrolled);
          scrolled = octs;
          if (current !== null) {
            release(source);
            current = null;
          }
        }
        return;
      }
      const h = pitchAt(ev.clientX, ev.clientY);
      if (h && h.pitch !== current) {
        current = h.pitch;
        press(source, [h.pitch], vel(ev, h.rect));
      } else if (!h && current !== null) {
        release(source);
        current = null;
      }
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      release(source);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const outOfRange = (p: number) => !!range && (p < range[0] || p > range[1]);

  return (
    <div className="kb" ref={ref} onPointerDown={onDown} onContextMenu={(e) => e.preventDefault()}>
      {whites.map((p, i) => (
        <div
          key={p}
          data-pitch={p}
          className={'kb-white' + (lit.has(p) ? ' down' : '') + (dimOutside && !dimOutside.has(p % 12) ? ' off-scale' : '') + (outOfRange(p) ? ' oor' : '')}
          style={{ left: i * whiteWidth, width: whiteWidth }}
        >
          {legend?.[p] && <span className="kb-legend">{legend[p].toUpperCase()}</span>}
          {p % 12 === 0 && <span className="kb-label">{noteName(p)}</span>}
        </div>
      ))}
      {whites.map((p, i) =>
        HAS_BLACK_AFTER.has(p % 12) && i < whites.length - 1 ? (
          <div
            key={p + 1}
            data-pitch={p + 1}
            className={'kb-black' + (lit.has(p + 1) ? ' down' : '') + (dimOutside && !dimOutside.has((p + 1) % 12) ? ' off-scale' : '')}
            style={{ left: (i + 1) * whiteWidth - blackW / 2, width: blackW }}
          >
            {legend?.[p + 1] && <span className="kb-legend">{legend[p + 1].toUpperCase()}</span>}
          </div>
        ) : null,
      )}
    </div>
  );
}
