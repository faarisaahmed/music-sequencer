// Editing repeats, ending brackets and D.S./D.C. jumps.
import type { NavKind, NavMark } from '../model/types';
import { uid } from '../model/defaults';
import { commit, useStore } from './store';

/** Marks that can appear once per song. */
const SINGLE: NavKind[] = ['segno', 'coda', 'toCoda', 'fine', 'dc', 'ds'];

export function navAt(kind: NavKind, bar: number): NavMark | undefined {
  return useStore.getState().project?.navMarks?.find((m) => m.kind === kind && m.bar === bar);
}

/** Add the mark at `bar`, or take it away if it's already there. */
export function toggleNav(kind: NavKind, bar: number, extra: Partial<NavMark> = {}): void {
  commit((d) => {
    const list = (d.navMarks ??= []);
    const i = list.findIndex((m) => m.kind === kind && m.bar === bar);
    if (i >= 0 && extra.until === undefined) {
      list.splice(i, 1);
      return;
    }
    if (SINGLE.includes(kind)) {
      // One segno, coda, "To Coda", Fine and jump per song; D.C. and D.S. are one jump.
      const same = kind === 'dc' || kind === 'ds' ? ['dc', 'ds'] : [kind];
      d.navMarks = list.filter((m) => !same.includes(m.kind));
    }
    d.navMarks!.push({ id: uid('nv'), kind, bar, ...extra });
  });
}

export function setRepeatTimes(id: string, times: number): void {
  commit((d) => {
    const m = d.navMarks?.find((x) => x.id === id);
    if (m) m.times = Math.max(2, Math.min(8, Math.round(times)));
  });
}

export function deleteNav(id: string): void {
  commit((d) => {
    d.navMarks = (d.navMarks ?? []).filter((m) => m.id !== id);
  });
}

/** `|:` at the first bar and `:|` at the end of the last one (bars are 0-based, inclusive). */
export function repeatBars(first: number, last: number, times = 2): void {
  commit((d) => {
    const list = (d.navMarks ??= []);
    if (!list.some((m) => m.kind === 'repeatStart' && m.bar === first) && first > 0) list.push({ id: uid('nv'), kind: 'repeatStart', bar: first });
    const end = list.find((m) => m.kind === 'repeatEnd' && m.bar === last);
    if (end) end.times = times;
    else list.push({ id: uid('nv'), kind: 'repeatEnd', bar: last, times: times === 2 ? undefined : times });
  });
}

/**
 * 1st and 2nd endings: the 1st ending is `len` bars from `first`, the repeat sign moves to its
 * end, and the 2nd ending follows it.
 */
export function addEndings(first: number, len = 1): void {
  commit((d) => {
    const marks = (d.navMarks ??= []);
    // The repeat this ending belongs to: the nearest :| at or after the ending's start.
    const rep = marks.filter((m) => m.kind === 'repeatEnd' && m.bar >= first).sort((a, b) => a.bar - b.bar)[0];
    if (rep) rep.bar = first + len - 1;
    else marks.push({ id: uid('nv'), kind: 'repeatEnd', bar: first + len - 1 });
    const v = (d.voltas ??= []).filter((x) => x.end <= first || x.start >= first + 2 * len);
    v.push({ id: uid('vt'), start: first, end: first + len, numbers: [1] });
    v.push({ id: uid('vt'), start: first + len, end: first + 2 * len, numbers: [2] });
    d.voltas = v;
  });
}

export function setVoltaNumbers(id: string, numbers: number[]): void {
  commit((d) => {
    const v = d.voltas?.find((x) => x.id === id);
    if (v && numbers.length) v.numbers = [...new Set(numbers)].sort((a, b) => a - b);
  });
}

export function setVoltaLength(id: string, bars: number): void {
  commit((d) => {
    const v = d.voltas?.find((x) => x.id === id);
    if (v) v.end = v.start + Math.max(1, Math.round(bars));
  });
}

export function deleteVolta(id: string): void {
  commit((d) => {
    d.voltas = (d.voltas ?? []).filter((v) => v.id !== id);
  });
}

export function setPlayRepeats(on: boolean): void {
  commit((d) => {
    d.playRepeats = on ? undefined : false;
  });
}

/** The readable name of a mark, for menus and tooltips. */
export function navLabel(m: Pick<NavMark, 'kind' | 'until' | 'times'>): string {
  switch (m.kind) {
    case 'repeatStart':
      return 'Start repeat';
    case 'repeatEnd':
      return `End repeat${(m.times ?? 2) > 2 ? ` (play ${m.times}×)` : ''}`;
    case 'segno':
      return 'Segno';
    case 'coda':
      return 'Coda';
    case 'toCoda':
      return 'To Coda';
    case 'fine':
      return 'Fine';
    case 'dc':
      return m.until === 'fine' ? 'D.C. al Fine' : m.until === 'coda' ? 'D.C. al Coda' : 'D.C.';
    case 'ds':
      return m.until === 'fine' ? 'D.S. al Fine' : m.until === 'coda' ? 'D.S. al Coda' : 'D.S.';
  }
}
