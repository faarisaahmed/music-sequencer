// Two-finger pan and pinch-zoom for the editors, where one finger edits (draws notes,
// paints steps, drags regions). Zoom is sent as a ctrl+wheel event so each view zooms
// around the fingers exactly the way it already does for a trackpad pinch.
import { useEffect, type RefObject } from 'react';

interface Opts {
  /** Wheel deltaY that changes the view's zoom by a factor of e (matches its wheel handler). */
  wheelPerLn?: number;
}

export function useTwoFingerPan(ref: RefObject<HTMLElement | null>, opts: Opts = {}): void {
  const k = opts.wheelPerLn;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let g: { cx: number; cy: number; d: number; sl: number; st: number } | null = null;
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) });
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      // A second finger turns whatever the first one started into a pan.
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch', bubbles: true }));
      const m = mid(e.touches);
      g = { cx: m.x, cy: m.y, d: m.d, sl: el.scrollLeft, st: el.scrollTop };
    };
    const move = (e: TouchEvent) => {
      if (!g || e.touches.length !== 2) return;
      e.preventDefault();
      const m = mid(e.touches);
      el.scrollLeft = g.sl - (m.x - g.cx);
      el.scrollTop = g.st - (m.y - g.cy);
      if (k && g.d > 30 && m.d > 30) {
        const ratio = m.d / g.d;
        if (Math.abs(Math.log(ratio)) > 0.02) {
          el.dispatchEvent(new WheelEvent('wheel', { deltaY: -Math.log(ratio) * k, ctrlKey: true, clientX: m.x, clientY: m.y, bubbles: true, cancelable: true }));
          g.d = m.d;
        }
      }
      // Re-anchor after the zoom handler moves the scroll position.
      requestAnimationFrame(() => {
        if (!g) return;
        g.sl = el.scrollLeft + (m.x - g.cx);
        g.st = el.scrollTop + (m.y - g.cy);
      });
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) g = null;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [ref, k]);
}

// The page itself never pinch-zooms: the editors handle pinches.
document.addEventListener('gesturestart', (e) => e.preventDefault());
