// Reusable controls: Knob, HSlider, Toggle, NumberField.
import { useRef, useState } from 'react';
import { beginGesture, endGesture } from '../../state/store';
import { clamp, startDrag } from './drag';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
  size?: number;
  color?: string;
  format?: (v: number) => string;
  /** Value restored on double-click. */
  defaultValue?: number;
  bipolar?: boolean;
  step?: number;
  /** Wrap changes in an undo gesture (default true). */
  undoable?: boolean;
}

export function Knob({ value, min, max, onChange, label, size = 40, color = 'var(--accent)', format, defaultValue, bipolar, step, undoable = true }: KnobProps) {
  const norm = (clamp(value, min, max) - min) / (max - min || 1);
  const a0 = -135;
  const a1 = 135;
  const ang = a0 + norm * (a1 - a0);
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const polar = (deg: number, rad = r) => {
    const t = ((deg - 90) * Math.PI) / 180;
    return [cx + rad * Math.cos(t), cy + rad * Math.sin(t)];
  };
  const arc = (from: number, to: number) => {
    const [x0, y0] = polar(from);
    const [x1, y1] = polar(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    const sweep = to > from ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
  };
  const startAng = bipolar ? 0 : a0;
  const [px, py] = polar(ang, r - 5);
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const v0 = value;
    if (undoable) beginGesture();
    startDrag(
      e,
      ({ dy, event }) => {
        const range = max - min;
        const fine = event.shiftKey ? 0.2 : 1;
        let v = clamp(v0 - (dy / 150) * range * fine, min, max);
        if (step) v = Math.round(v / step) * step;
        onChange(v);
      },
      () => {
        if (undoable) endGesture();
      },
    );
  };
  return (
    <div
      className="knob"
      onPointerDown={onPointerDown}
      onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
      title={label}
      onWheel={(e) => {
        const range = max - min;
        let v = clamp(value - Math.sign(e.deltaY) * range * 0.02, min, max);
        if (step) v = Math.round(v / step) * step;
        onChange(v);
      }}
    >
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r - 2} fill="#1a1918" stroke="#0c0c0b" strokeWidth={1} />
        <path d={arc(a0, a1)} stroke="#3f3d3a" strokeWidth={3} fill="none" strokeLinecap="round" />
        {Math.abs(ang - startAng) > 0.5 && (
          <path d={arc(Math.min(startAng, ang), Math.max(startAng, ang))} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
        )}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#ece9e3" strokeWidth={2} strokeLinecap="round" />
      </svg>
      {label && <div className="knob-label">{label}</div>}
      {format && <div className="knob-value">{format(value)}</div>}
    </div>
  );
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  width?: number | string;
  color?: string;
  defaultValue?: number;
  undoable?: boolean;
  title?: string;
}

export function HSlider({ value, min, max, onChange, width = 100, color, defaultValue, undoable = true, title }: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const norm = (clamp(value, min, max) - min) / (max - min || 1);
  const setFromX = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const f = clamp((clientX - rect.left) / rect.width, 0, 1);
    onChange(min + f * (max - min));
  };
  return (
    <div
      ref={ref}
      className="hslider"
      style={{ width }}
      title={title}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (undoable) beginGesture();
        setFromX(e.clientX);
        startDrag(
          e,
          ({ x }) => setFromX(x),
          () => undoable && endGesture(),
        );
      }}
      onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
    >
      <div className="track" />
      <div className="fill" style={{ width: `${norm * 100}%`, background: color }} />
      <div className="thumb" style={{ left: `${norm * 100}%` }} />
    </div>
  );
}

export function Toggle({ on, onChange, title }: { on: boolean; onChange: (v: boolean) => void; title?: string }) {
  return <div className={'toggle' + (on ? ' on' : '')} title={title} onClick={() => onChange(!on)} />;
}

/** Vertical fader used by the mixer. */
export function VFader({ value, min = 0, max = 1.25, onChange, height = 160, defaultValue = 0.8 }: { value: number; min?: number; max?: number; onChange: (v: number) => void; height?: number; defaultValue?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const norm = (clamp(value, min, max) - min) / (max - min);
  return (
    <div
      ref={ref}
      className="vfader"
      style={{ height, position: 'relative', width: 26, cursor: 'ns-resize', touchAction: 'none' }}
      onDoubleClick={() => onChange(defaultValue)}
      onPointerDown={(e) => {
        e.preventDefault();
        const v0 = value;
        beginGesture();
        startDrag(
          e,
          ({ dy, event }) => onChange(clamp(v0 - (dy / height) * (max - min) * (event.shiftKey ? 0.2 : 1), min, max)),
          () => endGesture(),
        );
      }}
    >
      <div style={{ position: 'absolute', left: 11, width: 4, top: 0, bottom: 0, background: '#0c0c0b', borderRadius: 2 }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: 26,
          height: 34,
          bottom: `calc(${norm * 100}% - 17px)`,
          borderRadius: 4,
          background: 'linear-gradient(#605e5a, #3e3c3a 45%, #201f1e 50%, #3e3c3a 55%, #5a5854)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.6)',
        }}
      />
    </div>
  );
}

export function NumberField({
  value,
  onCommit,
  min,
  max,
  width = 60,
  step = 1,
  title,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  width?: number;
  step?: number;
  title?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const commitText = () => {
    if (text === null) return;
    const v = parseFloat(text);
    if (!isNaN(v)) onCommit(clamp(v, min ?? -Infinity, max ?? Infinity));
    setText(null);
  };
  return (
    <input
      type="text"
      title={title}
      style={{ width, textAlign: 'center' }}
      value={text ?? String(value)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commitText}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setText(null);
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'ArrowUp') onCommit(clamp(value + step, min ?? -Infinity, max ?? Infinity));
        if (e.key === 'ArrowDown') onCommit(clamp(value - step, min ?? -Infinity, max ?? Infinity));
        e.stopPropagation();
      }}
    />
  );
}
