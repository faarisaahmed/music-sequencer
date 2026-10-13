// Interactive building blocks for guide lessons: playable examples, keyboards, chord cards,
// the circle of fifths, callouts and small charts.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Headphones, Lightbulb, Loader2, Play, Repeat, Sparkles, Square, Wand2, Volume2, VolumeX, X } from 'lucide-react';
import { BrandMark } from '../common/icons';
import { useElementSize } from '../common/useElementSize';
import { getAudioContext } from '../../audio/context';
import { getPreset } from '../../audio/presets';
import { colorForName } from '../../model/sections';
import { DRUM_LABEL, isDrumInst, line, n, type GNote, type Part } from './notation';
import { partsLength, playExample, playNow, stopExample, useGuidePlayer } from './audio';
import { chordsOfKey, PART_COLORS, pretty, CIRCLE_MAJOR, CIRCLE_MINOR, CIRCLE_SIG, FN_LABEL, pianoVoicing, sigLabel, type Mode } from './theory';

const DRUM_COLOR = '#d99a3a';
/** Each drum gets its own colour in the roll, like the step sequencer rows. */
const DRUM_HIT_COLOR: Record<number, string> = { 36: '#e0607f', 38: '#e08a3c', 39: '#e3c35a', 37: '#e3c35a', 42: '#45b8c4', 46: '#7fd3dc', 70: '#45b8c4', 45: '#a07ae0', 41: '#8a6fd0', 49: '#5b9be0', 51: '#7a86e6' };
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const pname = (p: number) => NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);

function partColor(p: Part, i: number): string {
  return p.color ?? (isDrumInst(p.inst) ? DRUM_COLOR : PART_COLORS[i % PART_COLORS.length]);
}

// ------------------------------------------------------------------ playhead

function usePlayhead(id: string, apply: (beat: number | null) => void): void {
  const playing = useGuidePlayer((s) => s.id === id);
  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    if (!playing) {
      applyRef.current(null);
      return;
    }
    let raf = 0;
    const frame = () => {
      const s = useGuidePlayer.getState();
      const ctx = getAudioContext();
      let beat = (ctx.currentTime - s.start) / s.spb;
      if (s.loop) beat = ((beat % s.length) + s.length) % s.length;
      applyRef.current(beat < 0 ? 0 : Math.min(beat, s.length));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

function PlayButton({ id, onPlay, size = 34, label }: { id: string; onPlay: () => void; size?: number; label?: string }) {
  const playing = useGuidePlayer((s) => s.id === id);
  const loading = useGuidePlayer((s) => s.loading === id);
  return (
    <button
      className={'g-play' + (playing ? ' on' : '')}
      style={{ width: size, height: size }}
      onClick={() => (playing ? stopExample() : onPlay())}
      aria-label={playing ? 'Stop' : label ?? 'Play'}
      title={playing ? 'Stop' : label ?? 'Play'}
    >
      {loading ? <Loader2 size={size * 0.45} className="g-spin" /> : playing ? <Square size={size * 0.36} fill="currentColor" /> : <Play size={size * 0.44} fill="currentColor" style={{ marginLeft: 2 }} />}
    </button>
  );
}

// ------------------------------------------------------------------ example (mini piano roll)

export interface ExampleProps {
  parts: Part[];
  bpm?: number;
  title?: ReactNode;
  caption?: ReactNode;
  /** loop playback until stopped */
  loop?: boolean;
  /** length in beats (defaults to the last note, rounded to whole bars) */
  length?: number;
  /** show note names on the notes */
  names?: boolean;
  /** chord symbols above the roll: "C G Am F" (4 beats each) or [[beat, 'C'], …] */
  chordsAbove?: string | [number, string][];
  /** beats per bar for the grid (default 4) */
  meter?: number;
  /** max height of the pitched area in px (default 170) */
  height?: number;
  /** highlight a span of beats: [from, to, label] */
  mark?: [number, number, string?][];
}

export function Example({ parts, bpm = 100, title, caption, loop, length, names, chordsAbove, meter = 4, height = 170, mark }: ExampleProps) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const { w } = useElementSize(wrap, [], { w: 640, h: 0 });
  const [muted, setMuted] = useState<Set<number>>(new Set());
  const total = length ?? partsLength(parts);

  const pitched = parts.flatMap((p, i) => (isDrumInst(p.inst) ? [] : p.notes.map((x) => ({ ...x, i }))));
  const drumHits = parts.flatMap((p, i) => (isDrumInst(p.inst) ? p.notes.map((x) => ({ ...x, i })) : []));
  const lanes = [...new Set(drumHits.map((x) => x.p))].sort((a, b) => laneOrder(a) - laneOrder(b));

  const lo = pitched.length ? Math.min(...pitched.map((x) => x.p)) - 1 : 60;
  let hi = pitched.length ? Math.max(...pitched.map((x) => x.p)) + 1 : 72;
  if (hi - lo < 11) hi = lo + 11;
  const rows = hi - lo + 1;
  const rowH = Math.max(3, Math.min(13, height / rows));
  const pitchH = pitched.length ? rows * rowH : 0;
  const laneH = 13;
  const drumH = lanes.length * laneH;
  const chordH = chordsAbove ? 20 : 0;
  const gutter = lanes.length ? 56 : 38;
  const innerW = Math.max(100, w - gutter);
  const bx = (beat: number) => gutter + (beat / total) * innerW;
  const H = chordH + pitchH + (pitchH && drumH ? 6 : 0) + drumH;
  const drumTop = chordH + pitchH + (pitchH && drumH ? 6 : 0);

  const chordList: [number, string][] = useMemo(() => {
    if (!chordsAbove) return [];
    if (Array.isArray(chordsAbove)) return chordsAbove;
    let t = 0;
    return chordsAbove
      .trim()
      .split(/\s+/)
      .filter((x) => x !== '|')
      .map((tok) => {
        const [sym, len] = tok.split(':');
        const at = t;
        t += len ? Number(len) : 4;
        return [at, sym] as [number, string];
      });
  }, [chordsAbove]);

  usePlayhead(id, (beat) => {
    const el = head.current;
    if (!el) return;
    if (beat === null) el.style.opacity = '0';
    else {
      el.style.opacity = '1';
      el.style.transform = `translateX(${bx(beat)}px)`;
    }
  });

  const play = (m = muted) => void playExample(id, parts, { bpm, loop, length: total, muted: m });
  const toggleMute = (i: number) => {
    const next = new Set(muted);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setMuted(next);
    if (useGuidePlayer.getState().id === id) play(next);
  };

  return (
    <figure className="g-example">
      <div className="g-ex-head">
        <PlayButton id={id} onPlay={() => play()} />
        <div className="g-ex-title">
          {title && <div className="g-ex-name">{title}</div>}
          <div className="g-ex-meta">
            <span>{bpm} BPM</span>
            {loop && (
              <span>
                <Repeat size={11} /> loops
              </span>
            )}
          </div>
        </div>
        <div className="g-legend">
          {parts.map((p, i) => (
            <button key={i} className={'g-chip' + (muted.has(i) ? ' off' : '')} onClick={() => toggleMute(i)} title={muted.has(i) ? 'Unmute' : 'Mute this part'}>
              <i style={{ background: partColor(p, i) }} />
              {p.label ?? getPreset(p.inst).name}
              {parts.length > 1 && (muted.has(i) ? <VolumeX size={11} /> : <Volume2 size={11} className="g-chip-ic" />)}
            </button>
          ))}
        </div>
      </div>
      <div className="g-roll" ref={wrap} style={{ height: H }}>
        <svg width={w} height={H} style={{ display: 'block' }}>
          {/* pitch rows */}
          {pitched.length > 0 &&
            Array.from({ length: rows }, (_, r) => {
              const p = hi - r;
              return (
                <g key={p}>
                  <rect x={gutter} y={chordH + r * rowH} width={innerW} height={rowH} fill={isBlack(p) ? 'var(--g-row-b)' : 'var(--g-row-w)'} />
                  {p % 12 === 0 && rowH >= 3 && (
                    <text x={gutter - 6} y={chordH + r * rowH + rowH / 2 + 3.5} className="g-roll-label" textAnchor="end">
                      {pname(p)}
                    </text>
                  )}
                </g>
              );
            })}
          {/* drum lanes */}
          {lanes.map((p, k) => (
            <g key={p}>
              <rect x={gutter} y={drumTop + k * laneH} width={innerW} height={laneH - 1} fill={k % 2 ? 'var(--g-row-b)' : 'var(--g-row-w)'} />
              <text x={gutter - 6} y={drumTop + k * laneH + 9.5} className="g-roll-label" textAnchor="end">
                {DRUM_LABEL[p] ?? p}
              </text>
            </g>
          ))}
          {/* marks */}
          {mark?.map(([a, b, label], k) => (
            <g key={k}>
              <rect x={bx(a)} y={chordH} width={bx(b) - bx(a)} height={H - chordH} className="g-mark" />
              {label && (
                <text x={bx(a) + 4} y={chordH + 11} className="g-mark-label">
                  {label}
                </text>
              )}
            </g>
          ))}
          {/* beat & bar lines */}
          {Array.from({ length: Math.floor(total) + 1 }, (_, b) => (
            <line key={b} x1={bx(b)} x2={bx(b)} y1={chordH} y2={H} className={b % meter === 0 ? 'g-bar' : 'g-beat'} />
          ))}
          {/* chord symbols */}
          {chordList.map(([t, sym], k) => (
            <g key={k}>
              <rect x={bx(t) + 1} y={2} width={Math.max(0, bx(chordList[k + 1]?.[0] ?? total) - bx(t) - 2)} height={16} rx={2} className="g-chordbox" />
              <text x={bx(t) + 6} y={14} className="g-chordsym">
                {sym}
              </text>
            </g>
          ))}
          {/* notes */}
          {pitched.map((x, k) => {
            const y = chordH + (hi - x.p) * rowH;
            const x0 = bx(x.t);
            const wd = Math.max(2, bx(x.t + x.d) - x0 - 1);
            const c = partColor(parts[x.i], x.i);
            return (
              <g key={k} opacity={muted.has(x.i) ? 0.18 : 0.6 + 0.4 * (x.v ?? 0.8)}>
                <rect x={x0} y={y + 0.5} width={wd} height={Math.max(2, rowH - 1)} rx={Math.min(2, rowH / 3)} fill={c} />
                {names && rowH >= 9 && wd > 18 && (
                  <text x={x0 + 3} y={y + rowH - 2.5} className="g-note-name">
                    {pname(x.p).replace(/-?\d+$/, '')}
                  </text>
                )}
              </g>
            );
          })}
          {drumHits.map((x, k) => {
            const lane = lanes.indexOf(x.p);
            const cy = drumTop + lane * laneH + (laneH - 1) / 2;
            const r = 2.2 + 2 * (x.v ?? 0.75);
            return <circle key={'d' + k} cx={bx(x.t) + r + 0.5} cy={cy} r={r} fill={parts[x.i].color ?? DRUM_HIT_COLOR[x.p] ?? DRUM_COLOR} opacity={muted.has(x.i) ? 0.18 : 0.55 + 0.45 * (x.v ?? 0.75)} />;
          })}
        </svg>
        <div className="g-playhead" ref={head} style={{ height: H - chordH, top: chordH }} />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

const LANE_ORDER = [49, 51, 46, 42, 70, 39, 38, 37, 45, 41, 36];
function laneOrder(p: number): number {
  const i = LANE_ORDER.indexOf(p);
  return i < 0 ? 50 + p : i;
}

/** Two or more versions of the same idea, side by side (stacked on narrow screens). */
export function Compare({ items }: { items: (ExampleProps & { label: string; verdict?: 'worse' | 'better' })[] }) {
  return (
    <div className="g-compare">
      {items.map(({ label, verdict, ...ex }, i) => (
        <div key={i} className={'g-compare-item' + (verdict ? ' ' + verdict : '')}>
          <div className="g-compare-label">{label}</div>
          <Example {...ex} />
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ inline play chip

/**
 * An inline play button inside prose.
 *   <Play notes="C4 E4 G4">major chord</Play>                (together)
 *   <Play notes="C4 G4" mode="apart">a fifth</Play>          (one after another)
 *   <Play melody="E4:1 D4 C4 D4 E4 E4 E4:2" bpm={110}>…</Play>
 *   <Play chords="C G Am F">…</Play>
 */
export function PlayChip({ notes, melody, chords: prog, mode = 'together', inst = 'grand-piano', bpm = 100, children }: { notes?: string; melody?: string; chords?: string; mode?: 'together' | 'apart'; inst?: string; bpm?: number; children: ReactNode }) {
  const id = useId();
  const playing = useGuidePlayer((s) => s.id === id);
  const onClick = () => {
    if (playing) return stopExample();
    if (notes) {
      const ps = notes.trim().split(/\s+/).map(n);
      void playNow(ps, inst, { arpeggio: mode === 'apart' ? 0.42 : 0, dur: mode === 'apart' ? 0.9 : 1.6 });
    } else if (melody) void playExample(id, [{ inst, notes: line(melody) }], { bpm });
    else if (prog) {
      let prev: number[] | null = null;
      let t = 0;
      const out: GNote[] = [];
      for (const tok of prog.trim().split(/\s+/)) {
        const [sym, len] = tok.split(':');
        const d = len ? Number(len) : 2;
        const v = pianoVoicing(sym, prev);
        prev = v.slice(1);
        for (const p of v) out.push({ p, t, d: d * 0.96, v: 0.7 });
        t += d;
      }
      void playExample(id, [{ inst, notes: out }], { bpm, length: t });
    }
  };
  return (
    <button className={'g-inline-play' + (playing ? ' on' : '')} onClick={onClick}>
      {playing ? <Square size={9} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ keyboard diagram

type Mark = string | { label?: string; color?: string };

/**
 * A piano keyboard with marked keys. Click any key to hear it.
 *   <Keys from="C4" to="C5" marks={{ C4: 'R', E4: '3', G4: '5' }} />
 */
export function Keys({ from = 'C4', to = 'B4', marks = {}, inst = 'grand-piano', caption, color = 'var(--accent)', buttons = true }: { from?: string; to?: string; marks?: Record<string, Mark>; inst?: string; caption?: ReactNode; color?: string; buttons?: boolean }) {
  const lo = n(from);
  const hi = n(to);
  const [hit, setHit] = useState<number | null>(null);
  const marked = new Map<number, { label?: string; color?: string }>();
  for (const [k, v] of Object.entries(marks)) marked.set(n(k), typeof v === 'string' ? { label: v } : v);
  const whites: number[] = [];
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites.push(p);
  const WW = 30;
  const WH = 104;
  const BW = 18;
  const BH = 64;
  const W = whites.length * WW;
  const xOfWhite = (p: number) => whites.indexOf(p) * WW;
  const press = (p: number) => {
    setHit(p);
    setTimeout(() => setHit((h) => (h === p ? null : h)), 220);
    void playNow([p], inst, { dur: 1.1 });
  };
  const markedPitches = [...marked.keys()].sort((a, b) => a - b);
  return (
    <figure className="g-keys">
      <svg viewBox={`-1 -1 ${W + 2} ${WH + 2}`} style={{ width: '100%', maxWidth: Math.min(W * 1.25, 760) }}>
        {whites.map((p) => {
          const m = marked.get(p);
          return (
            <g key={p} onPointerDown={() => press(p)} className="g-key">
              <rect x={xOfWhite(p)} y={0} width={WW - 1} height={WH} rx={3} className={'g-white' + (hit === p ? ' hit' : '')} style={m ? { fill: m.color ?? color } : undefined} />
              {m?.label && (
                <text x={xOfWhite(p) + WW / 2 - 0.5} y={WH - 10} textAnchor="middle" className="g-key-label">
                  {m.label}
                </text>
              )}
              {!m && p % 12 === 0 && (
                <text x={xOfWhite(p) + WW / 2 - 0.5} y={WH - 9} textAnchor="middle" className="g-key-c">
                  {pname(p)}
                </text>
              )}
            </g>
          );
        })}
        {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
          .filter(isBlack)
          .map((p) => {
            const m = marked.get(p);
            const left = xOfWhite(p - 1) + WW - BW / 2 - 0.5;
            return (
              <g key={p} onPointerDown={() => press(p)} className="g-key">
                <rect x={left} y={0} width={BW} height={BH} rx={2.5} className={'g-black' + (hit === p ? ' hit' : '')} style={m ? { fill: m.color ?? color } : undefined} />
                {m?.label && (
                  <text x={left + BW / 2} y={BH - 8} textAnchor="middle" className="g-key-label sm">
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
      {buttons && markedPitches.length > 1 && (
        <div className="g-keys-btns">
          <button className="btn sm" onClick={() => void playNow(markedPitches, inst, { dur: 1.8 })}>
            <Play size={11} fill="currentColor" /> Together
          </button>
          <button className="btn sm" onClick={() => void playNow(markedPitches, inst, { arpeggio: 0.32, dur: 0.8 })}>
            <Play size={11} fill="currentColor" /> One by one
          </button>
        </div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// ------------------------------------------------------------------ chords of a key

/** The seven chords of a key as cards: click to hear, coloured by job (home / away / tension). */
export function ChordsInKey({ tonic = 'C', mode = 'major', sevenths = false, onPick, caption }: { tonic?: string; mode?: Mode; sevenths?: boolean; onPick?: (sym: string, numeral: string) => void; caption?: ReactNode }) {
  const list = chordsOfKey(tonic, mode, sevenths);
  return (
    <figure className="g-chordrow-fig">
      <div className="g-chordrow">
        {list.map((c) => (
          <button
            key={c.degree}
            className={'g-chordcard fn-' + c.fn}
            onClick={() => {
              void playNow(pianoVoicing(c.symbol), 'grand-piano', { dur: 1.6 });
              onPick?.(c.symbol, c.numeral);
            }}
          >
            <span className="g-cc-num">{c.numeral}</span>
            <span className="g-cc-sym">{pretty(c.symbol)}</span>
            <span className="g-cc-fn">{FN_LABEL[c.fn]}</span>
          </button>
        ))}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** A scratch pad: click chords of a key to line them up, then loop what you picked. Nothing is added to your song. */
export function ProgressionPad({ tonic = 'C', mode = 'major', sevenths = false }: { tonic?: string; mode?: Mode; sevenths?: boolean }) {
  const id = useId();
  const [seq, setSeq] = useState<{ sym: string; num: string }[]>([]);
  const [key, setKey] = useState({ tonic, mode });
  const playing = useGuidePlayer((s) => s.id === id);
  const head = useRef<HTMLDivElement>(null);
  const parts = useMemo((): Part[] => {
    let prev: number[] | null = null;
    const notes: GNote[] = [];
    seq.forEach((c, i) => {
      const v = pianoVoicing(c.sym, prev);
      prev = v.slice(1);
      for (const p of v) notes.push({ p, t: i * 4, d: 3.9, v: 0.7 });
    });
    return [{ inst: 'grand-piano', notes }];
  }, [seq]);
  usePlayhead(id, (beat) => {
    if (!head.current) return;
    const idx = beat === null ? -1 : Math.floor(beat / 4);
    head.current.querySelectorAll('.g-pad-slot').forEach((el, i) => el.classList.toggle('now', i === idx));
  });
  const start = () => seq.length && void playExample(id, parts, { bpm: 92, loop: true, length: seq.length * 4 });
  // Keep looping with the new chords when the progression changes mid-play.
  const wasPlaying = useRef(false);
  useLayoutEffect(() => {
    wasPlaying.current = playing;
  });
  useEffect(() => {
    if (wasPlaying.current && seq.length) void playExample(id, parts, { bpm: 92, loop: true, length: seq.length * 4 });
  }, [id, parts, seq.length]);
  return (
    <figure className="g-pad">
      <div className="g-pad-top">
        <select value={key.tonic} onChange={(e) => (setKey({ ...key, tonic: e.target.value }), setSeq([]), stopExample())}>
          {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((t) => (
            <option key={t} value={t}>
              {pretty(t)}
            </option>
          ))}
        </select>
        <div className="seg">
          {(['major', 'minor'] as Mode[]).map((m) => (
            <button key={m} className={key.mode === m ? 'on' : ''} onClick={() => (setKey({ ...key, mode: m }), setSeq([]), stopExample())}>
              {m === 'major' ? 'Major' : 'Minor'}
            </button>
          ))}
        </div>
        <span className="g-pad-hint">Click chords to line them up, then press play.</span>
      </div>
      <ChordsInKey tonic={key.tonic} mode={key.mode} sevenths={sevenths} onPick={(sym, num) => seq.length < 8 && setSeq([...seq, { sym, num }])} />
      <div className="g-pad-strip" ref={head}>
        <PlayButton id={id} onPlay={start} />
        {seq.length === 0 && <span className="g-pad-empty">Your progression shows up here (up to 8 chords).</span>}
        {seq.map((c, i) => (
          <div key={i} className="g-pad-slot">
            <b>{pretty(c.sym)}</b>
            <span>{c.num}</span>
            <button
              className="g-pad-x"
              title="Remove"
              onClick={() => {
                const s = seq.filter((_, k) => k !== i);
                setSeq(s);
                if (!s.length) stopExample();
              }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {seq.length > 0 && (
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => (setSeq([]), stopExample())}>
            Clear
          </button>
        )}
      </div>
    </figure>
  );
}

// ------------------------------------------------------------------ circle of fifths

export function CircleOfFifths({ caption }: { caption?: ReactNode }) {
  const [sel, setSel] = useState(0);
  const [minor, setMinor] = useState(false);
  const R = 150;
  const C = 165;
  const pos = (i: number, r: number) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  };
  const wedge = (i: number, r0: number, r1: number) => {
    const a0 = ((i - 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    const p = (a: number, r: number) => `${C + Math.cos(a) * r} ${C + Math.sin(a) * r}`;
    return `M ${p(a0, r0)} L ${p(a0, r1)} A ${r1} ${r1} 0 0 1 ${p(a1, r1)} L ${p(a1, r0)} A ${r0} ${r0} 0 0 0 ${p(a0, r0)} Z`;
  };
  const near = (i: number) => i === sel || i === (sel + 1) % 12 || i === (sel + 11) % 12;
  const tonic = minor ? CIRCLE_MINOR[sel].replace('m', '') : CIRCLE_MAJOR[sel];
  return (
    <figure className="g-circle">
      <div className="g-circle-wrap">
        <svg viewBox="0 0 330 330" className="g-circle-svg">
          {CIRCLE_MAJOR.map((k, i) => (
            <g key={k} onClick={() => (setSel(i), setMinor(false), void playNow(pianoVoicing(k), 'grand-piano'))} className="g-wedge-g">
              <path d={wedge(i, 98, R + 12)} className={'g-wedge' + (i === sel && !minor ? ' sel' : near(i) ? ' near' : '')} />
              <text x={pos(i, 128)[0]} y={pos(i, 128)[1] + 5} textAnchor="middle" className="g-wedge-maj">
                {pretty(k)}
              </text>
            </g>
          ))}
          {CIRCLE_MINOR.map((k, i) => (
            <g key={k} onClick={() => (setSel(i), setMinor(true), void playNow(pianoVoicing(k), 'grand-piano'))} className="g-wedge-g">
              <path d={wedge(i, 56, 96)} className={'g-wedge minor' + (i === sel && minor ? ' sel' : near(i) ? ' near' : '')} />
              <text x={pos(i, 77)[0]} y={pos(i, 77)[1] + 4} textAnchor="middle" className="g-wedge-min">
                {pretty(k)}
              </text>
            </g>
          ))}
          <text x={C} y={C - 4} textAnchor="middle" className="g-circle-center">
            {pretty(minor ? CIRCLE_MINOR[sel] : CIRCLE_MAJOR[sel])}
          </text>
          <text x={C} y={C + 14} textAnchor="middle" className="g-circle-sub">
            {sigLabel(CIRCLE_SIG[sel])}
          </text>
        </svg>
        <div className="g-circle-side">
          <div className="g-circle-k">
            {pretty(tonic)} {minor ? 'minor' : 'major'}
          </div>
          <p>
            Its neighbours on the circle (lit up) differ by just one note, so moving between them sounds smooth. Its <b>relative {minor ? 'major' : 'minor'}</b>, {pretty(minor ? CIRCLE_MAJOR[sel] : CIRCLE_MINOR[sel])}, uses exactly the same notes.
          </p>
          <div className="g-circle-chords">The chords of this key, click to hear them:</div>
          <ChordsInKey tonic={tonic} mode={minor ? 'minor' : 'major'} />
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// ------------------------------------------------------------------ callouts

function Callout({ kind, icon, title, children }: { kind: string; icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <aside className={'g-callout ' + kind}>
      <div className="g-callout-head">
        {icon}
        <span>{title}</span>
      </div>
      <div className="g-callout-body">{children}</div>
    </aside>
  );
}

/** "Do it in BandForge": concrete steps in the app. */
export const Try = ({ title = 'Do it in BandForge', children }: { title?: ReactNode; children: ReactNode }) => (
  <Callout kind="try" icon={<BrandMark size={16} />} title={title}>
    {children}
  </Callout>
);
export const Tip = ({ title = 'Tip', children }: { title?: ReactNode; children: ReactNode }) => (
  <Callout kind="tip" icon={<Lightbulb size={15} />} title={title}>
    {children}
  </Callout>
);
export const Watch = ({ title = 'Common mistake', children }: { title?: ReactNode; children: ReactNode }) => (
  <Callout kind="watch" icon={<AlertTriangle size={15} />} title={title}>
    {children}
  </Callout>
);
export const Listen = ({ title = 'Listen for it', children }: { title?: ReactNode; children: ReactNode }) => (
  <Callout kind="listen" icon={<Headphones size={15} />} title={title}>
    {children}
  </Callout>
);
export const Why = ({ title = 'Why it works', children }: { title?: ReactNode; children: ReactNode }) => (
  <Callout kind="why" icon={<Sparkles size={15} />} title={title}>
    {children}
  </Callout>
);
export const Pro = ({ title = 'What pros do', children }: { title?: ReactNode; children: ReactNode }) => (
  <Callout kind="pro" icon={<Wand2 size={15} />} title={title}>
    {children}
  </Callout>
);

// ------------------------------------------------------------------ text helpers

export const Lead = ({ children }: { children: ReactNode }) => <p className="g-lead">{children}</p>;

/** Numbered steps. Pass <li> children. */
export const Steps = ({ children }: { children: ReactNode }) => <ol className="g-steps">{children}</ol>;

/** A keyboard key: <K>⌘</K><K>Z</K> */
export const K = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

/** A button or panel name in BandForge's interface: <Ui>Chord Track</Ui> */
export const Ui = ({ children }: { children: ReactNode }) => <span className="g-ui">{children}</span>;

/** A term with a short definition on hover. */
export const Term = ({ def, children }: { def: string; children: ReactNode }) => (
  <span className="g-term" title={def}>
    {children}
  </span>
);

/** Key facts as a two-column table: <Spec rows={[['Tempo', '70–90 BPM'], …]} /> */
export function Spec({ title, rows }: { title?: ReactNode; rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="g-spec">
      {title && <div className="g-spec-title">{title}</div>}
      {rows.map(([a, b], i) => (
        <div key={i} className="g-spec-row">
          <div className="g-spec-k">{a}</div>
          <div className="g-spec-v">{b}</div>
        </div>
      ))}
    </div>
  );
}

/** A grid of small cards: <Cards items={[{ title, body, color? }]} /> */
export function Cards({ items, cols }: { items: { title: ReactNode; body: ReactNode; color?: string; tag?: ReactNode }[]; cols?: number }) {
  return (
    <div className="g-cards" style={cols ? { gridTemplateColumns: `repeat(auto-fill, minmax(${cols > 2 ? 180 : 240}px, 1fr))` } : undefined}>
      {items.map((it, i) => (
        <div key={i} className="g-card" style={it.color ? { ['--cc' as string]: it.color } : undefined}>
          {it.tag && <div className="g-card-tag">{it.tag}</div>}
          <div className="g-card-title">{it.title}</div>
          <div className="g-card-body">{it.body}</div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ charts

/**
 * Horizontal ranges on a shared axis: instrument ranges (unit 'pitch', values as note names)
 * or frequency bands (unit 'hz').
 */
export function RangeChart({ rows, unit = 'pitch', caption, sweet }: { rows: { label: string; lo: string | number; hi: string | number; color?: string; note?: string }[]; unit?: 'pitch' | 'hz'; caption?: ReactNode; sweet?: boolean }) {
  const val = (x: string | number) => (unit === 'pitch' ? (typeof x === 'string' ? n(x) : x) : Math.log10(Number(x)));
  const all = rows.flatMap((r) => [val(r.lo), val(r.hi)]);
  const min = unit === 'hz' ? Math.log10(20) : Math.min(...all) - 2;
  const max = unit === 'hz' ? Math.log10(20000) : Math.max(...all) + 2;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const ticks =
    unit === 'hz'
      ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map((f) => ({ at: pct(Math.log10(f)), label: f >= 1000 ? f / 1000 + 'k' : String(f) }))
      : Array.from({ length: 9 }, (_, o) => (o + 1) * 12 + 12).filter((p) => p >= min && p <= max).map((p) => ({ at: pct(p), label: 'C' + (p / 12 - 1) }));
  return (
    <figure className="g-range">
      <div className="g-range-rows">
        {rows.map((r, i) => (
          <div key={i} className="g-range-row">
            <div className="g-range-label">{r.label}</div>
            <div className="g-range-track">
              {ticks.map((t, k) => (
                <i key={k} className="g-range-tick" style={{ left: t.at + '%' }} />
              ))}
              <div className="g-range-bar" style={{ left: pct(val(r.lo)) + '%', width: Math.max(1, pct(val(r.hi)) - pct(val(r.lo))) + '%', background: r.color ?? PART_COLORS[i % PART_COLORS.length] }}>
                {r.note && <span>{r.note}</span>}
              </div>
            </div>
          </div>
        ))}
        <div className="g-range-row axis">
          <div className="g-range-label" />
          <div className="g-range-track">
            {ticks.map((t, k) => (
              <span key={k} style={{ left: t.at + '%' }}>
                {t.label}
              </span>
            ))}
            {sweet && unit === 'pitch' && <b className="g-range-sweet" style={{ left: pct(n('C4')) + '%' }} />}
          </div>
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** A song's sections as blocks whose height shows energy: <SectionMap sections={[{ name: 'Verse', bars: 8, energy: 2 }]} /> */
export function SectionMap({ sections, caption }: { sections: { name: string; bars: number; energy: number; note?: string; color?: string }[]; caption?: ReactNode }) {
  const total = sections.reduce((a, s) => a + s.bars, 0);
  const maxE = Math.max(5, ...sections.map((s) => s.energy));
  const colorOf = (name: string) => colorForName(name.replace(/\s*\d+$/, ''));
  return (
    <figure className="g-sections">
      <div className="g-sec-row">
        {sections.map((s, i) => (
          <div key={i} className="g-sec" style={{ flex: s.bars }}>
            <div className="g-sec-bar" style={{ height: `${(s.energy / maxE) * 100}%`, background: s.color ?? colorOf(s.name) }} />
            <div className="g-sec-name">{s.name}</div>
            <div className="g-sec-bars">{s.bars} bars</div>
            {s.note && <div className="g-sec-note">{s.note}</div>}
          </div>
        ))}
      </div>
      <div className="g-sec-axis">
        <span>start</span>
        <span>{total} bars</span>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
