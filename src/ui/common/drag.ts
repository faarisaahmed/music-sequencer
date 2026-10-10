// Pointer-drag helper: tracks movement until release, works outside the element.

export interface DragInfo {
  dx: number;
  dy: number;
  x: number;
  y: number;
  event: PointerEvent;
}

export function startDrag(
  e: React.PointerEvent | PointerEvent,
  onMove: (d: DragInfo) => void,
  onUp?: (d: DragInfo & { moved: boolean }) => void,
  opts: { threshold?: number } = {},
): void {
  const x0 = e.clientX;
  const y0 = e.clientY;
  const threshold = opts.threshold ?? 0;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - x0;
    const dy = ev.clientY - y0;
    if (!moved && Math.hypot(dx, dy) < threshold) return;
    moved = true;
    onMove({ dx, dy, x: ev.clientX, y: ev.clientY, event: ev });
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    onUp?.({ dx: ev.clientX - x0, dy: ev.clientY - y0, x: ev.clientX, y: ev.clientY, event: ev, moved });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** True when the event target is a text field (so global shortcuts should be ignored). */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
