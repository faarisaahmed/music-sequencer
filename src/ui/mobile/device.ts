// Phone detection: phones get their own layout (not a squeezed desktop). Tablets keep the
// desktop layout with touch-friendly sizes.
import { useSyncExternalStore } from 'react';
import { setCompactHeaders } from '../tracks/tracksUi';

const PHONE_QUERY = '(max-width: 760px), (max-height: 500px) and (pointer: coarse)';
const TOUCH_QUERY = '(pointer: coarse)';

const phoneMq = typeof matchMedia === 'function' ? matchMedia(PHONE_QUERY) : null;
const touchMq = typeof matchMedia === 'function' ? matchMedia(TOUCH_QUERY) : null;

function apply() {
  const phone = !!phoneMq?.matches;
  setCompactHeaders(phone);
  const cl = document.documentElement.classList;
  cl.toggle('phone', phone);
  cl.toggle('touch', !!touchMq?.matches);
  cl.toggle('standalone', matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}
apply();
phoneMq?.addEventListener('change', apply);
touchMq?.addEventListener('change', apply);

function subscribe(cb: () => void) {
  phoneMq?.addEventListener('change', cb);
  return () => phoneMq?.removeEventListener('change', cb);
}

export function isPhone(): boolean {
  return !!phoneMq?.matches;
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone, () => false);
}

export function isTouch(): boolean {
  return !!touchMq?.matches;
}

// ---------------------------------------------------------------- touch gestures
// Everything in BandForge that has a right-click menu or a double-click action gets the
// touch equivalents: press and hold opens the menu, double-tap acts like a double-click.
// Browsers that already do this natively (Android Chrome) aren't doubled up.

const HOLD_MS = 520;
const MOVE_TOL = 10;
let hold: { timer: ReturnType<typeof setTimeout>; x: number; y: number; target: EventTarget | null; fired: boolean; native: boolean } | null = null;
let lastTap: { t: number; x: number; y: number; target: EventTarget | null } | null = null;
let nativeDbl = 0;
let swallowClickUntil = 0;
let heldAt = 0;

/** True right after a press-and-hold, so the finger lifting isn't also treated as a tap. */
export function heldRecently(): boolean {
  return Date.now() - heldAt < 900;
}

function isEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
}

window.addEventListener(
  'pointerdown',
  (e) => {
    if (e.pointerType !== 'touch' || isEditable(e.target)) return;
    if (hold) clearTimeout(hold.timer);
    const h = {
      x: e.clientX,
      y: e.clientY,
      target: e.target,
      fired: false,
      native: false,
      timer: setTimeout(() => {
        if (!hold || hold !== h || h.native) return;
        h.fired = true;
        heldAt = Date.now();
        swallowClickUntil = Date.now() + 600;
        navigator.vibrate?.(8);
        h.target?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: h.x, clientY: h.y, button: 2 }));
      }, HOLD_MS),
    };
    hold = h;
  },
  true,
);
window.addEventListener(
  'pointermove',
  (e) => {
    if (hold && e.pointerType === 'touch' && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > MOVE_TOL) {
      clearTimeout(hold.timer);
      hold = null;
    }
  },
  true,
);
const endHold = (e: PointerEvent) => {
  if (e.pointerType !== 'touch') return;
  const h = hold;
  if (h) clearTimeout(h.timer);
  hold = null;
  if (e.type !== 'pointerup' || h?.fired || isEditable(e.target)) return;
  // Double-tap → dblclick (unless the browser sends its own).
  const now = Date.now();
  if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) {
    const target = e.target;
    const x = e.clientX;
    const y = e.clientY;
    const asked = now;
    lastTap = null;
    setTimeout(() => {
      if (nativeDbl >= asked) return;
      target?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 2 }));
    }, 90);
  } else lastTap = { t: now, x: e.clientX, y: e.clientY, target: e.target };
};
window.addEventListener('pointerup', endHold, true);
window.addEventListener('pointercancel', endHold, true);
window.addEventListener(
  'contextmenu',
  (e) => {
    if (e.isTrusted && hold) {
      hold.native = true;
      swallowClickUntil = Date.now() + 600;
    }
  },
  true,
);
window.addEventListener('dblclick', (e) => e.isTrusted && (nativeDbl = Date.now()), true);
// The finger lifting after a long press shouldn't also "click" what's under it.
window.addEventListener(
  'click',
  (e) => {
    if (Date.now() < swallowClickUntil) {
      e.stopPropagation();
      e.preventDefault();
      swallowClickUntil = 0;
    }
  },
  true,
);
