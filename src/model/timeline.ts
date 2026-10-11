// The song's timeline: where bars fall (time-signature changes) and how beats map to seconds
// (tempo changes, sudden or gradual). Every part of BandForge that turns beats into bars or
// seconds goes through here, so a song with no changes behaves exactly as before.
import { isDraft } from 'immer';
import type { MeterChange, Project, TempoChange } from './types';

// ---------------------------------------------------------------- meter

export interface MeterSeg {
  /** First bar (0-based) of this run of bars. */
  bar: number;
  /** Beat where that bar starts. */
  beat: number;
  sig: [number, number];
  /** Bar length in beats (quarter notes). */
  len: number;
}

export interface BarInfo {
  bar: number;
  start: number;
  len: number;
  sig: [number, number];
}

export function barLen(sig: [number, number]): number {
  return sig[0] * (4 / sig[1]);
}

export class Meter {
  readonly segs: MeterSeg[];
  constructor(timeSig: [number, number], changes: MeterChange[] = []) {
    const segs: MeterSeg[] = [{ bar: 0, beat: 0, sig: timeSig, len: barLen(timeSig) }];
    for (const c of [...changes].filter((c) => c.bar > 0).sort((a, b) => a.bar - b.bar)) {
      const prev = segs[segs.length - 1];
      if (c.bar === prev.bar) {
        segs[segs.length - 1] = { ...prev, sig: c.timeSig, len: barLen(c.timeSig) };
        continue;
      }
      const beat = prev.beat + (c.bar - prev.bar) * prev.len;
      if (c.timeSig[0] === prev.sig[0] && c.timeSig[1] === prev.sig[1]) continue;
      segs.push({ bar: c.bar, beat, sig: c.timeSig, len: barLen(c.timeSig) });
    }
    this.segs = segs;
  }
  get simple(): boolean {
    return this.segs.length === 1;
  }
  private segForBeat(beat: number): MeterSeg {
    const s = this.segs;
    let i = s.length - 1;
    while (i > 0 && s[i].beat > beat + 1e-9) i--;
    return s[i];
  }
  private segForBar(bar: number): MeterSeg {
    const s = this.segs;
    let i = s.length - 1;
    while (i > 0 && s[i].bar > bar) i--;
    return s[i];
  }
  /** Beat where `bar` (0-based) starts. */
  barStart(bar: number): number {
    const g = this.segForBar(bar);
    return g.beat + (bar - g.bar) * g.len;
  }
  /** The bar containing `beat`. */
  barAt(beat: number): BarInfo {
    const g = this.segForBeat(beat);
    const bar = g.bar + Math.floor((beat - g.beat) / g.len + 1e-9);
    return { bar, start: g.beat + (bar - g.bar) * g.len, len: g.len, sig: g.sig };
  }
  sigAt(beat: number): [number, number] {
    return this.segForBeat(beat).sig;
  }
  /** Length of the bar at `beat`. */
  lenAt(beat: number): number {
    return this.segForBeat(beat).len;
  }
  /** Fractional bar number at `beat` (0-based). */
  barPos(beat: number): number {
    const b = this.barAt(beat);
    return b.bar + (beat - b.start) / b.len;
  }
  /** Bars overlapping [from, to). */
  *bars(from: number, to: number): Generator<BarInfo> {
    let b = this.barAt(Math.max(from, -1e9));
    while (b.start < to - 1e-9) {
      yield b;
      b = this.barAt(b.start + b.len + 1e-9);
    }
  }
  /** Nearest bar line to `beat`. */
  snapToBar(beat: number): number {
    const b = this.barAt(beat);
    return beat - b.start < b.len / 2 ? b.start : b.start + b.len;
  }
  /** Bar start at or before `beat`. */
  floorBar(beat: number): number {
    return this.barAt(beat + 1e-6).start;
  }
  /** Bar line at or after `beat`. */
  ceilBar(beat: number): number {
    const b = this.barAt(beat - 1e-6);
    return Math.abs(beat - b.start) < 1e-6 ? b.start : b.start + b.len;
  }
  /** `n` whole bars from `beat` (negative goes back), following the meter. */
  addBars(beat: number, n: number): number {
    const p = this.barPos(beat);
    const target = p + n;
    const bar = Math.floor(target + 1e-9);
    const len = this.barAt(this.barStart(bar)).len;
    return this.barStart(bar) + (target - bar) * len;
  }
  /**
   * The same bars seen from `origin` (a region's start): beat 0 is the bar containing it.
   * Used by the score, which counts beats from the start of what it shows.
   */
  relativeTo(origin: number): Meter {
    if (Math.abs(origin) < 1e-9) return this;
    const b0 = this.barAt(origin + 1e-9);
    const later = this.segs.filter((g) => g.bar > b0.bar).map((g) => ({ id: '', bar: g.bar - b0.bar, timeSig: g.sig }));
    return new Meter(b0.sig, later);
  }
  /** Bar.beat.sixteenth (1-based) for the LCD and tooltips. */
  format(beat: number): string {
    const b = this.barAt(beat);
    const beatLen = 4 / b.sig[1];
    const inBar = beat - b.start;
    const bt = Math.floor(inBar / beatLen + 1e-9) + 1;
    const six = Math.floor(((inBar % beatLen) / beatLen) * 4 + 1e-9) + 1;
    return `${b.bar + 1}.${bt}.${six}`;
  }
}

// ---------------------------------------------------------------- tempo

interface TempoSeg {
  beat: number;
  sec: number;
  bpm: number;
  /** Tempo change per beat inside this segment (0 = steady). */
  k: number;
}

export class TempoMap {
  readonly segs: TempoSeg[];
  constructor(bpm: number, changes: TempoChange[] = []) {
    const pts = [{ beat: 0, bpm, ramp: false }, ...[...changes].filter((c) => c.beat > 0).sort((a, b) => a.beat - b.beat).map((c) => ({ beat: c.beat, bpm: c.bpm, ramp: !!c.ramp }))];
    const segs: TempoSeg[] = [];
    let sec = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const k = b && b.ramp ? (b.bpm - a.bpm) / (b.beat - a.beat) : 0;
      segs.push({ beat: a.beat, sec, bpm: a.bpm, k });
      if (b) sec += segSeconds(a.bpm, k, b.beat - a.beat);
    }
    this.segs = segs;
  }
  get simple(): boolean {
    return this.segs.length === 1;
  }
  private segForBeat(beat: number): TempoSeg {
    const s = this.segs;
    let i = s.length - 1;
    while (i > 0 && s[i].beat > beat) i--;
    return s[i];
  }
  private segForSec(sec: number): TempoSeg {
    const s = this.segs;
    let i = s.length - 1;
    while (i > 0 && s[i].sec > sec) i--;
    return s[i];
  }
  /** Seconds from the start of the song to `beat` (negative beats use the opening tempo). */
  sec(beat: number): number {
    const g = this.segForBeat(beat);
    return g.sec + segSeconds(g.bpm, g.k, beat - g.beat);
  }
  /** The beat `sec` seconds into the song. */
  beat(sec: number): number {
    const g = this.segForSec(sec);
    const t = sec - g.sec;
    if (Math.abs(g.k) < 1e-9 || t <= 0) return g.beat + (t * g.bpm) / 60;
    return g.beat + (g.bpm * Math.exp((g.k * t) / 60) - g.bpm) / g.k;
  }
  /** Seconds between two beats. */
  span(b0: number, b1: number): number {
    return this.sec(b1) - this.sec(b0);
  }
  bpmAt(beat: number): number {
    const g = this.segForBeat(beat);
    return g.bpm + g.k * Math.max(0, beat - g.beat);
  }
}

function segSeconds(bpm: number, k: number, beats: number): number {
  if (Math.abs(k) < 1e-9 || beats <= 0) return (beats * 60) / bpm;
  return (60 / k) * Math.log((bpm + k * beats) / bpm);
}

// ---------------------------------------------------------------- cached access

let meterMemo: { sig: [number, number]; ch: MeterChange[] | undefined; m: Meter } | null = null;
let tempoMemo: { bpm: number; ch: TempoChange[] | undefined; t: TempoMap } | null = null;

/** The song's bars. */
export function meterOf(p: Pick<Project, 'timeSig' | 'meterChanges'>): Meter {
  // Edits run on immer drafts, which die after the edit: never cache them.
  if (isDraft(p)) return new Meter([p.timeSig[0], p.timeSig[1]], p.meterChanges?.map((c) => ({ ...c, timeSig: [c.timeSig[0], c.timeSig[1]] })));
  const m = meterMemo;
  if (m && m.ch === p.meterChanges && m.sig[0] === p.timeSig[0] && m.sig[1] === p.timeSig[1]) return m.m;
  const meter = new Meter(p.timeSig, p.meterChanges);
  meterMemo = { sig: p.timeSig, ch: p.meterChanges, m: meter };
  return meter;
}

/** The song's beats ↔ seconds. */
export function tempoOf(p: Pick<Project, 'bpm' | 'tempoChanges'>): TempoMap {
  if (isDraft(p)) return new TempoMap(p.bpm, p.tempoChanges?.map((c) => ({ ...c })));
  const t = tempoMemo;
  if (t && t.ch === p.tempoChanges && t.bpm === p.bpm) return t.t;
  const map = new TempoMap(p.bpm, p.tempoChanges);
  tempoMemo = { bpm: p.bpm, ch: p.tempoChanges, t: map };
  return map;
}

/** Song length in seconds up to `beat`. */
export function secondsAt(p: Project, beat: number): number {
  return tempoOf(p).sec(beat);
}
