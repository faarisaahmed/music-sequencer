// Song form: the order bars are played in when the song has repeats, 1st/2nd endings and
// D.S./D.C. jumps. The song is written once; playback, export and MIDI follow this order.
import type { NavMark, Project, Volta } from './types';
import { meterOf } from './timeline';

/** A run of bars played straight through, in song beats. */
export interface PlaySpan {
  from: number;
  to: number;
}

export function hasForm(p: Pick<Project, 'navMarks' | 'voltas'>): boolean {
  return !!(p.navMarks?.length || p.voltas?.length);
}

export function formActive(p: Pick<Project, 'navMarks' | 'voltas' | 'playRepeats'>): boolean {
  return hasForm(p) && p.playRepeats !== false;
}

/**
 * Bars in the order they're played. Standard rules:
 * - `:|` goes back to the last `|:` (or the start) until the passage has played `times` times;
 * - ending brackets play only on their passes;
 * - D.C. goes to the start, D.S. to the segno; afterwards repeats aren't taken again, the last
 *   ending is used, "To Coda" jumps to the coda and "Fine" ends the song.
 */
export function barOrder(marks: NavMark[], voltas: Volta[], totalBars: number): number[] {
  const at = (kind: NavMark['kind'], bar: number) => marks.find((m) => m.kind === kind && m.bar === bar);
  const starts = marks.filter((m) => m.kind === 'repeatStart').map((m) => m.bar);
  const segno = marks.find((m) => m.kind === 'segno')?.bar ?? 0;
  const coda = marks.find((m) => m.kind === 'coda')?.bar;
  const vlist = [...voltas].sort((a, b) => a.start - b.start);
  // A volta is "last" in its chain when no other bracket starts where it ends.
  const isLastVolta = (v: Volta) => !vlist.some((w) => w.start === v.end);

  const out: number[] = [];
  const passes = new Map<number, number>(); // repeatEnd bar → passes played so far
  let pass = 1;
  let jumped: null | 'end' | 'fine' | 'coda' = null;
  let b = 0;
  for (let guard = 0; b < totalBars && guard < 20000; guard++) {
    // Playing into a repeat start (rather than jumping back to it) begins pass 1.
    const prev = out[out.length - 1];
    if (!jumped && starts.includes(b) && (prev === undefined || prev < b)) pass = 1;
    const v = vlist.find((x) => x.start === b);
    if (v) {
      const play = jumped ? isLastVolta(v) : v.numbers.includes(pass);
      if (!play) {
        b = v.end;
        continue;
      }
    }
    out.push(b);
    // Marks at the end of this bar.
    if (jumped === 'coda' && at('toCoda', b) && coda !== undefined && coda > b) {
      b = coda;
      jumped = 'end';
      continue;
    }
    if (jumped === 'fine' && at('fine', b)) break;
    const rep = at('repeatEnd', b);
    if (rep && !jumped) {
      const done = passes.get(b) ?? 1;
      if (done < (rep.times ?? 2)) {
        passes.set(b, done + 1);
        pass = done + 1;
        b = Math.max(0, ...starts.filter((s) => s <= b));
        continue;
      }
      passes.delete(b);
    }
    const jump = at('dc', b) ?? at('ds', b);
    if (jump && !jumped) {
      jumped = jump.until ?? 'end';
      pass = Number.MAX_SAFE_INTEGER;
      b = jump.kind === 'dc' ? 0 : segno;
      continue;
    }
    b++;
  }
  return out;
}

/** Bars → spans of song beats (consecutive bars merged). */
export function playSpans(p: Project, totalBars: number): PlaySpan[] {
  const meter = meterOf(p);
  if (!formActive(p)) return [{ from: 0, to: meter.barStart(totalBars) }];
  const order = barOrder(p.navMarks ?? [], p.voltas ?? [], totalBars);
  const spans: PlaySpan[] = [];
  for (const bar of order) {
    const from = meter.barStart(bar);
    const to = meter.barStart(bar + 1);
    const last = spans[spans.length - 1];
    if (last && Math.abs(last.to - from) < 1e-9) last.to = to;
    else spans.push({ from, to });
  }
  return spans;
}

/** Where playback goes after `beat` reaches the end of its span (null = keep going / stop). */
export function nextSpanAfter(spans: PlaySpan[], spanIndex: number): PlaySpan | null {
  return spans[spanIndex + 1] ?? null;
}

/** The span a playback starting at `beat` is in (the first one containing it). */
export function spanIndexAt(spans: PlaySpan[], beat: number): number {
  const i = spans.findIndex((s) => beat >= s.from - 1e-9 && beat < s.to - 1e-9);
  return i < 0 ? spans.length - 1 : i;
}
