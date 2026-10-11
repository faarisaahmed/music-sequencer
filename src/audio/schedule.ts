// Event scheduling shared by live playback and offline rendering.
import { tempoOf, type TempoMap } from '../model/timeline';
import type { AudioRegion, AutomationPoint, Project } from '../model/types';
import { placedNotes, regionSegments } from '../model/regions';
import { applyGroove, grooveFor } from '../model/groove';
import { getBuffer } from './audioStore';
import { automationValueAt, type Mixer } from './mixer';

export interface ActiveSource {
  src: AudioBufferSourceNode;
  gain: GainNode;
  end: number;
}

export interface ScheduleOptions {
  /** True for the first window after (re)starting playback at b0: start audio regions mid-way. */
  fresh: boolean;
  /** Hard limit (beats) after which nothing may sound — the loop end while cycling. */
  limit: number;
  /** Collect started audio sources so they can be stopped later. */
  sources?: ActiveSource[];
  /** Pattern preview: only this track plays. */
  onlyTrack?: string;
}

/** Beat Sequencer rows that are muted (or not soloed while another row is). */
export function silentRows(params: Record<string, number>): Set<number> {
  const out = new Set<number>();
  const solo: number[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    if (k.startsWith('mute')) out.add(Number(k.slice(4)));
    else if (k.startsWith('solo')) solo.push(Number(k.slice(4)));
  }
  if (solo.length) for (let p = 0; p < 128; p++) if (!solo.includes(p)) out.add(p);
  return out;
}

/** Schedule everything that starts within [b0, b1). `toTime` maps beats → context seconds. */
export function scheduleRange(p: Project, mixer: Mixer, b0: number, b1: number, toTime: (beat: number) => number, opts: ScheduleOptions): void {
  if (b1 <= b0) return;
  const ctx = mixer.ctx;
  const tm = tempoOf(p);
  for (const t of p.tracks) {
    if (opts.onlyTrack && t.id !== opts.onlyTrack) continue;
    const ch = mixer.channels.get(t.id);
    if (!ch) continue;
    const silent = t.type === 'drums' ? silentRows(t.instrumentParams) : null;
    // Automation
    scheduleAutomation(t.automation.volume, ch.autoGain.gain, b0, b1, toTime, opts.fresh, 1, (v) => v * v);
    if (t.automation.pan.length) scheduleAutomation(t.automation.pan, ch.panner.pan, b0, b1, toTime, opts.fresh, t.pan, (v) => v);

    for (const r of t.regions) {
      if (r.muted) continue;
      if (r.start >= b1 || r.start + r.length <= b0) continue;
      if (r.kind === 'midi') {
        const inst = ch.instrument;
        if (!inst) continue;
        const transpose = t.type === 'drums' ? 0 : t.transpose;
        const groove = grooveFor(p, r);
        for (const pn of placedNotes(r, b0, b1)) {
          const n = pn.note;
          if (silent?.has(n.pitch)) continue;
          if (n.chance !== undefined && n.chance < 1 && Math.random() > n.chance) continue;
          if (groove) {
            const g = applyGroove(n, pn.start, pn.duration, groove);
            if (g.start >= opts.limit) continue;
            pn.start = g.start;
            pn.duration = g.duration;
          }
          let dur = Math.max(0.01, Math.min(pn.duration, opts.limit - pn.start));
          let vel = n.velocity;
          if (n.artic) {
            if (n.artic.includes('staccato')) dur = Math.max(0.01, Math.min(dur * 0.45, 0.5));
            if (n.artic.includes('accent')) vel = Math.min(1, vel * 1.22 + 0.05);
            if (n.artic.includes('marcato')) vel = Math.min(1, vel * 1.32 + 0.08);
          }
          const pitch = n.pitch + transpose;
          if (pitch < 0 || pitch > 127) continue;
          const reps = Math.max(1, n.repeat ?? 1);
          if (reps > 1) {
            const step = dur / reps;
            for (let i = 0; i < reps; i++) {
              const v = vel * (i === 0 ? 1 : 0.8);
              inst.playNote(pitch, v, toTime(pn.start + i * step), tm.span(pn.start + i * step, pn.start + (i + 1) * step) * 0.9);
            }
          } else {
            inst.playNote(pitch, vel, toTime(pn.start), tm.span(pn.start, pn.start + dur));
          }
        }
      } else {
        scheduleAudioRegion(ctx, r, ch.input, b0, b1, toTime, tm, opts);
      }
    }
  }
  scheduleAutomation(p.masterAutomation, mixer.masterAuto.gain, b0, b1, toTime, opts.fresh, 1, (v) => v * v);
}

function scheduleAutomation(
  points: AutomationPoint[],
  param: AudioParam,
  b0: number,
  b1: number,
  toTime: (b: number) => number,
  fresh: boolean,
  fallback: number,
  map: (v: number) => number,
): void {
  if (!points.length) {
    if (fresh) {
      param.cancelScheduledValues(toTime(b0));
      param.setValueAtTime(map(fallback), toTime(b0));
    }
    return;
  }
  if (fresh) {
    param.cancelScheduledValues(toTime(b0));
    param.setValueAtTime(map(automationValueAt(points, b0, fallback)), toTime(b0));
  }
  for (const pt of points) {
    if (pt.beat > b0 && pt.beat <= b1) param.linearRampToValueAtTime(map(pt.value), toTime(pt.beat));
  }
  param.linearRampToValueAtTime(map(automationValueAt(points, b1, fallback)), toTime(b1));
}

function scheduleAudioRegion(
  ctx: BaseAudioContext,
  r: AudioRegion,
  dest: AudioNode,
  b0: number,
  b1: number,
  toTime: (b: number) => number,
  tm: TempoMap,
  opts: ScheduleOptions,
): void {
  const buf = getBuffer(r.audioId, r.reversed);
  if (!buf) return;
  const regionEnd = Math.min(r.start + r.length, opts.limit);
  for (const seg of regionSegments(r)) {
    let startBeat: number;
    if (seg.start >= b0 && seg.start < b1) startBeat = seg.start;
    else if (opts.fresh && seg.start < b0 && seg.end > b0) startBeat = b0;
    else continue;
    const endBeat = Math.min(seg.end, regionEnd);
    if (endBeat <= startBeat) continue;
    // Audio runs in real time from where its content begins, whatever the tempo does.
    const bufOffset = tm.span(seg.start - seg.contentStart, startBeat);
    if (bufOffset >= buf.duration) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    src.connect(g);
    g.connect(dest);
    const t0 = toTime(startBeat);
    const t1 = toTime(endBeat);
    // Region gain envelope with fades (beats → seconds)
    const gainAt = (beat: number) => {
      let v = r.gain;
      if (r.fadeIn > 0 && beat < r.start + r.fadeIn) v *= Math.max(0, (beat - r.start) / r.fadeIn);
      const fadeOutStart = r.start + r.length - r.fadeOut;
      if (r.fadeOut > 0 && beat > fadeOutStart) v *= Math.max(0, (r.start + r.length - beat) / r.fadeOut);
      return v;
    };
    g.gain.setValueAtTime(gainAt(startBeat), t0);
    const fadeInEnd = r.start + r.fadeIn;
    if (r.fadeIn > 0 && fadeInEnd > startBeat && fadeInEnd < endBeat) g.gain.linearRampToValueAtTime(gainAt(fadeInEnd), toTime(fadeInEnd));
    const fadeOutStart = r.start + r.length - r.fadeOut;
    if (r.fadeOut > 0) {
      if (fadeOutStart > startBeat && fadeOutStart < endBeat) g.gain.setValueAtTime(gainAt(fadeOutStart), toTime(fadeOutStart));
      g.gain.linearRampToValueAtTime(gainAt(endBeat), t1);
    }
    // Tiny declick at the end
    if (!(r.fadeOut > 0) && t1 - 0.004 > t0) {
      g.gain.setValueAtTime(gainAt(endBeat), t1 - 0.004);
      g.gain.linearRampToValueAtTime(0, t1);
    }
    src.start(t0, bufOffset);
    src.stop(t1 + 0.01);
    src.onended = () => g.disconnect();
    opts.sources?.push({ src, gain: g, end: t1 });
  }
}
