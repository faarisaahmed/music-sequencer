import { useLayoutEffect, useState, type DependencyList, type RefObject } from 'react';
import { flushSync } from 'react-dom';

export interface Size {
  w: number;
  h: number;
}

/**
 * An element's client size, kept current while the window or a panel resizes.
 * The ResizeObserver callback runs after layout and before paint, and the new size is committed
 * there synchronously, so whatever is drawn from it (canvases, score systems, lane widths) is
 * redrawn in the same frame as the new layout — never one frame at the old size and then a snap.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>, deps: DependencyList = [], initial: Size = { w: 0, h: 0 }): Size {
  const [size, setSize] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = new ResizeObserver(() => {
      // Redrawing at the new size can add or remove a scrollbar, which changes the size again;
      // settle that before paint too (the browser would otherwise report it a frame later).
      for (let i = 0; i < 3; i++) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        flushSync(read);
        if (el.clientWidth === w && el.clientHeight === h) break;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return size;
}
