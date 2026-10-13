// Chromatic tuner: autocorrelation pitch detection on the microphone input.
import './tuner.css';
import { useEffect, useRef, useState } from 'react';
import { getEngine } from '../../audio/engine';
import { noteName } from '../../model/music';

/** Normalised-autocorrelation pitch detector (McLeod-style). Returns Hz or null. */
export function detectPitch(buf: Float32Array, sampleRate: number): { freq: number; clarity: number } | null {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null;
  const minLag = Math.floor(sampleRate / 1400);
  const maxLag = Math.min(Math.floor(sampleRate / 35), Math.floor(n / 2));
  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i < n - lag; i++) {
      acf += buf[i] * buf[i + lag];
      m += buf[i] * buf[i] + buf[i + lag] * buf[i + lag];
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0;
  }
  // Highest peak, but take the first peak within 90% of it (avoids octave errors).
  let maxVal = 0;
  for (let lag = minLag; lag <= maxLag; lag++) maxVal = Math.max(maxVal, nsdf[lag]);
  if (maxVal < 0.5) return null;
  let best = -1;
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1] && nsdf[lag] >= maxVal * 0.9) {
      best = lag;
      break;
    }
  }
  if (best < 0) return null;
  // Parabolic interpolation for sub-sample accuracy.
  const a = nsdf[best - 1];
  const b = nsdf[best];
  const c = nsdf[best + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { freq: sampleRate / (best + shift), clarity: b };
}

export default function Tuner({ active }: { active: boolean }) {
  const [reading, setReading] = useState<{ note: string; cents: number; freq: number } | null>(null);
  const smoothCents = useRef(0);
  useEffect(() => {
    if (!active) return;
    const engine = getEngine();
    const node = engine.micNode;
    if (!node) return;
    const an = engine.ctx.createAnalyser();
    an.fftSize = 4096;
    node.connect(an);
    const buf = new Float32Array(an.fftSize);
    let lost = 0;
    const id = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      const r = detectPitch(buf, engine.ctx.sampleRate);
      if (!r) {
        if (++lost > 6) setReading(null);
        return;
      }
      lost = 0;
      const midi = 69 + 12 * Math.log2(r.freq / 440);
      const nearest = Math.round(midi);
      const cents = (midi - nearest) * 100;
      smoothCents.current = smoothCents.current * 0.6 + cents * 0.4;
      setReading({ note: noteName(nearest), cents: smoothCents.current, freq: r.freq });
    }, 50);
    return () => {
      clearInterval(id);
      try {
        node.disconnect(an);
      } catch {
        /* noop */
      }
    };
  }, [active]);

  const cents = reading?.cents ?? 0;
  const inTune = reading && Math.abs(cents) < 4;
  const angle = Math.max(-50, Math.min(50, cents)) * 0.9; // degrees
  return (
    <div className={'tuner' + (inTune ? ' in-tune' : '')}>
      <div className="label">Tuner</div>
      <svg viewBox="0 0 200 110" width="200" height="110">
        {Array.from({ length: 21 }, (_, i) => {
          const c = (i - 10) * 5;
          const a = ((c * 0.9 - 90) * Math.PI) / 180;
          const r1 = i % 5 === 0 ? 70 : 76;
          return (
            <line key={i} x1={100 + Math.cos(a) * r1} y1={100 + Math.sin(a) * r1} x2={100 + Math.cos(a) * 84} y2={100 + Math.sin(a) * 84} stroke={c === 0 ? '#8fb573' : '#5a5753'} strokeWidth={i % 5 === 0 ? 2 : 1} />
          );
        })}
        <g transform={`rotate(${angle.toFixed(2)} 100 100)`}>
          <line x1={100} y1={100} x2={100} y2={22} stroke={reading ? (inTune ? '#8fb573' : '#e08a3c') : '#3e3c3a'} strokeWidth={3} strokeLinecap="round" />
        </g>
        <circle cx={100} cy={100} r={6} fill="#ddd" />
      </svg>
      <div className="tuner-note">{reading ? reading.note : '—'}</div>
      <div className="tuner-sub mono">{reading ? `${cents > 0 ? '+' : ''}${cents.toFixed(0)}¢ · ${reading.freq.toFixed(1)} Hz` : 'Play a single note'}</div>
    </div>
  );
}
