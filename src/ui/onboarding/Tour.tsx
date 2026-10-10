// Spotlight overlay that walks through the tour steps.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { endTour, gotoStep, TOURS, useTour } from './tourState';
import './onboarding.css';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;
const CARD_W = 330;

function measure(selector?: string): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  // Clamp very large targets to the viewport.
  const x = Math.max(4, r.left - PAD);
  const y = Math.max(4, r.top - PAD);
  return { x, y, w: Math.min(window.innerWidth - 4, r.right + PAD) - x, h: Math.min(window.innerHeight - 4, r.bottom + PAD) - y };
}

export default function Tour() {
  const tour = useTour((s) => s.tour);
  const index = useTour((s) => s.index);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const step = tour ? TOURS[tour][index] : null;
  const total = tour ? TOURS[tour].length : 0;

  // Track the target (the layout may change as panels open).
  useEffect(() => {
    if (!step) return;
    const update = () =>
      setRect((prev) => {
        const r = measure(step.target);
        if (prev && r && Math.abs(prev.x - r.x) < 0.5 && Math.abs(prev.y - r.y) < 0.5 && Math.abs(prev.w - r.w) < 0.5 && Math.abs(prev.h - r.h) < 0.5) return prev;
        return r;
      });
    update();
    const id = setInterval(update, 250);
    window.addEventListener('resize', update);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', update);
    };
  }, [step]);

  // Place the card next to the spotlight, kept inside the viewport.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !step) return;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = (vw - CARD_W) / 2;
    let y = (vh - ch) / 2;
    if (rect) {
      const gap = 14;
      const fitsBelow = rect.y + rect.h + gap + ch < vh;
      const fitsAbove = rect.y - gap - ch > 0;
      let placement = step.placement ?? 'bottom';
      if (placement === 'bottom' && !fitsBelow && fitsAbove) placement = 'top';
      if (placement === 'top' && !fitsAbove && fitsBelow) placement = 'bottom';
      if (placement === 'bottom') {
        x = rect.x + rect.w / 2 - CARD_W / 2;
        y = rect.y + rect.h + gap;
      } else if (placement === 'top') {
        x = rect.x + rect.w / 2 - CARD_W / 2;
        y = rect.y - gap - ch;
      } else if (placement === 'right') {
        x = rect.x + rect.w + gap;
        y = rect.y + rect.h / 2 - ch / 2;
      } else {
        x = rect.x - gap - CARD_W;
        y = rect.y + rect.h / 2 - ch / 2;
      }
      // Big targets (whole panels): keep the card inside them if there is no room outside.
      if (y < 8 || y + ch > vh - 8) y = Math.min(vh - ch - 16, Math.max(16, rect.y + 16));
    }
    setCardPos({ x: Math.max(12, Math.min(vw - CARD_W - 12, x)), y: Math.max(12, Math.min(vh - ch - 12, y)) });
  }, [rect, step, index]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.key === 'Escape') endTour();
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') gotoStep(useTour.getState().index + 1);
      else if (e.key === 'ArrowLeft') gotoStep(useTour.getState().index - 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour]);

  if (!tour || !step) return null;
  const last = index === total - 1;
  return (
    <div className="tour-root">
      {/* Blocks interaction with the app while touring. */}
      <div className={'tour-shade' + (rect ? '' : ' full')} />
      {rect && <div className="tour-spot" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      <div ref={cardRef} className="tour-card" style={{ left: cardPos.x, top: cardPos.y, width: CARD_W }} key={tour + index}>
        <button className="tour-close" onClick={endTour} title="Skip tour (Esc)">
          <X size={14} />
        </button>
        <div className="tour-step">
          Step {index + 1} of {total}
        </div>
        <div className="tour-title">{step.title}</div>
        <div className="tour-body">{step.body}</div>
        <div className="tour-foot">
          <div className="tour-dots">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i === index ? 'on' : i < index ? 'done' : ''} onClick={() => gotoStep(i)} />
            ))}
          </div>
          <div className="spacer" />
          {index === 0 ? (
            <button className="btn ghost sm" onClick={endTour}>
              Skip
            </button>
          ) : (
            <button className="btn ghost sm" onClick={() => gotoStep(index - 1)}>
              Back
            </button>
          )}
          <button className="btn primary sm" onClick={() => gotoStep(index + 1)} autoFocus>
            {last ? 'Done' : index === 0 ? 'Show me' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
