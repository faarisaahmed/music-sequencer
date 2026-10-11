// One tooltip style for the whole app. Any element with `title` (or `data-tip`) gets it;
// `data-cmd="transport.play"` adds that command's current shortcut, so changed keys show everywhere.
import { useEffect, useRef, useState } from 'react';
import { COMMAND_BY_ID, keysFor, formatCombo } from './keymap';
import './keys.css';

interface Tip {
  text: string;
  keys: string[];
  x: number;
  y: number;
  below: boolean;
}

const DELAY = 450;

function targetOf(el: EventTarget | null): HTMLElement | null {
  return el instanceof Element ? (el.closest('[title],[data-tip],[data-cmd]') as HTMLElement | null) : null;
}

/** Move a native `title` into data-tip so the browser's own tooltip never doubles up. */
function adopt(el: HTMLElement): void {
  const t = el.getAttribute('title');
  if (t === null) return;
  el.removeAttribute('title');
  if (t) el.dataset.tip = t;
  if (t && !el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', t);
}

export default function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: HTMLElement | null = null;
    const hide = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      current = null;
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = targetOf(e.target);
      if (el === current) return;
      hide();
      if (!el) return;
      adopt(el);
      current = el;
      timer = setTimeout(() => {
        if (!current || !current.isConnected) return;
        const cmd = current.dataset.cmd;
        const text = current.dataset.tip || (cmd ? COMMAND_BY_ID.get(cmd)?.label ?? '' : '');
        const keys = cmd ? keysFor(cmd).map(formatCombo) : [];
        if (!text && !keys.length) return;
        const r = current.getBoundingClientRect();
        const below = r.bottom + 44 < window.innerHeight;
        setTip({ text, keys, x: r.left + r.width / 2, y: below ? r.bottom + 7 : r.top - 7, below });
      }, DELAY);
    };
    const out = (e: PointerEvent) => {
      if (current && !current.contains(e.relatedTarget as Node | null)) hide();
    };
    window.addEventListener('pointerover', over, true);
    window.addEventListener('pointerout', out, true);
    window.addEventListener('pointerdown', hide, true);
    window.addEventListener('keydown', hide, true);
    window.addEventListener('wheel', hide, { capture: true, passive: true });
    window.addEventListener('blur', hide);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointerover', over, true);
      window.removeEventListener('pointerout', out, true);
      window.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('keydown', hide, true);
      window.removeEventListener('wheel', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Keep it inside the window.
  useEffect(() => {
    const el = ref.current;
    if (!tip || !el) return setPos(null);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(6, Math.min(window.innerWidth - w - 6, tip.x - w / 2));
    setPos({ left, top: tip.below ? tip.y : tip.y - h });
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={ref} className="bf-tip" role="tooltip" style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
      {tip.text && <span>{tip.text}</span>}
      {tip.keys.length > 0 && (
        <span className="bf-tip-keys">
          {tip.keys.map((k) => (
            <kbd key={k}>{k}</kbd>
          ))}
        </span>
      )}
    </div>
  );
}
