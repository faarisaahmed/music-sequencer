// Offline rendering and file export (MP3, M4A, FLAC, WAV, OGG, MIDI).
import type { Project } from '../model/types';
import { contentEndBeat } from '../model/defaults';
import { meterOf, tempoOf } from '../model/timeline';
import { formActive, playSpans, type PlaySpan } from '../model/form';
import { Mixer } from './mixer';
import { scheduleRange } from './schedule';
import { encodeWav } from './wav';
import { ensureClips } from './audioStore';
import { projectAudioIds } from '../state/persistence';

export interface RenderOptions {
  start?: number;
  end?: number;
  sampleRate?: number;
  tail?: number; // seconds of reverb tail
  onlyTrackId?: string;
  onProgress?: (f: number) => void;
}

export async function renderProject(p: Project, opts: RenderOptions = {}): Promise<AudioBuffer> {
  await ensureClips(projectAudioIds(p));
  const start = opts.start ?? 0;
  const end = opts.end ?? Math.max(contentEndBeat(p), 4);
  const tm = tempoOf(p);
  const sr = opts.sampleRate ?? 44100;
  const tail = opts.tail ?? 2.5;
  // The bars in play order (repeats, endings, D.S./D.C.), clipped to the range.
  const pieces = renderPieces(p, start, end);
  const pieceSec = pieces.map((pc) => tm.span(pc.from, pc.to));
  const seconds = pieceSec.reduce((a, b) => a + b, 0) + tail;
  // Only build and schedule tracks that can actually be heard (muted/un-soloed tracks
  // cost render time but contribute nothing).
  const anySolo = p.tracks.some((t) => t.solo);
  const proj: Project = opts.onlyTrackId
    ? { ...p, tracks: p.tracks.filter((t) => t.id === opts.onlyTrackId).map((t) => ({ ...t, mute: false, solo: false })) }
    : { ...p, tracks: p.tracks.filter((t) => !t.mute && (!anySolo || t.solo)) };
  const oc = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const mixer = new Mixer(oc);
  mixer.output.connect(oc.destination);
  mixer.sync(proj);
  await mixer.ready();
  const offset = 0.05;
  // When each piece starts in the rendered file.
  const pieceAt: number[] = [];
  pieceSec.reduce((acc, s, i) => ((pieceAt[i] = acc), acc + s), offset);
  // Schedule incrementally (like live playback) instead of all at once: Chrome's offline
  // renderer pays for every pending node on every render quantum, so pre-scheduling a
  // whole song makes long exports many times slower.
  const CHUNK = 1.5; // seconds
  let pi = 0;
  let scheduledTo = pieces[0]?.from ?? start;
  let fresh = true;
  const scheduleUntil = (t: number) => {
    while (pi < pieces.length) {
      const pc = pieces[pi];
      const s0 = tm.sec(pc.from);
      const toTime = (b: number) => pieceAt[pi] + tm.sec(b) - s0;
      const b1 = Math.min(pc.to, Math.max(pc.from, tm.beat(s0 + t - pieceAt[pi])));
      if (b1 > scheduledTo) {
        scheduleRange(proj, mixer, scheduledTo, b1, toTime, { fresh, limit: pc.to });
        fresh = false;
        scheduledTo = b1;
      }
      if (b1 < pc.to - 1e-9) return;
      pi++;
      scheduledTo = pieces[pi]?.from ?? end;
      fresh = true;
    }
  };
  // Firefox can't pause an offline render, so it gets everything scheduled up front.
  const canPause = typeof (oc as OfflineAudioContext & { suspend?: unknown }).suspend === 'function';
  const chunks = canPause ? Math.floor(seconds / CHUNK) : 0;
  if (chunks < 1) scheduleUntil(Infinity);
  else {
    scheduleUntil(CHUNK * 2);
    for (let k = 1; k <= chunks; k++) {
      const t = k * CHUNK;
      if (t >= seconds) break;
      oc.suspend(t).then(() => {
        scheduleUntil(t + CHUNK * 2);
        opts.onProgress?.(Math.min(1, t / seconds));
        void oc.resume();
      });
    }
  }
  // Without pausing there are no progress steps: report from the render's own clock instead.
  let ticker: ReturnType<typeof setInterval> | null = null;
  if (!canPause && opts.onProgress) ticker = setInterval(() => opts.onProgress!(Math.min(0.99, oc.currentTime / seconds)), 200);
  const out = await oc.startRendering().finally(() => ticker && clearInterval(ticker));
  // Fade the tail gently to avoid a cut-off.
  const fadeLen = Math.floor(sr * Math.min(tail, 1));
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < fadeLen; i++) d[d.length - 1 - i] *= i / fadeLen;
  }
  return out;
}

/** How long the song between `start` and `end` plays (tempo changes and repeats included). */
export function playSeconds(p: Project, start: number, end: number): number {
  const tm = tempoOf(p);
  return renderPieces(p, start, end).reduce((a, pc) => a + tm.span(pc.from, pc.to), 0);
}

/** The song between `start` and `end` in play order: one piece, or the repeats unrolled. */
function renderPieces(p: Project, start: number, end: number): PlaySpan[] {
  if (!formActive(p)) return [{ from: start, to: end }];
  const meter = meterOf(p);
  const bars = Math.max(p.lengthBars, Math.ceil(meter.barPos(end) - 1e-6));
  const out: PlaySpan[] = [];
  for (const s of playSpans(p, bars)) {
    const from = Math.max(s.from, start);
    const to = Math.min(s.to, end);
    if (to > from + 1e-9) out.push({ from, to });
  }
  return out.length ? out : [{ from: start, to: end }];
}

export function normalize(buf: AudioBuffer, target = 0.97): void {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak < 1e-6) return;
  const g = target / peak;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
}

export function exportWav(buf: AudioBuffer): Blob {
  return encodeWav(buf);
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim() || 'song';
}

// ---------------------------------------------------------------- codecs (loaded on demand)

export type { AudioFormat, EncodeOptions } from './audioEncode';
export type { MidiExportOptions } from './codecs';

export async function encodeAudio(
  buf: AudioBuffer,
  fmt: import('./audioEncode').AudioFormat,
  p: Project,
  opts: import('./audioEncode').EncodeOptions & { part?: string } = {},
  onProgress?: (f: number) => void,
): Promise<Blob> {
  const m = await import('./audioEncode');
  return m.encodeAudio(buf, fmt, m.songTags(p, opts.part), { ...opts, composer: p.info?.composer }, onProgress);
}

export async function canExport(fmt: import('./audioEncode').AudioFormat): Promise<boolean> {
  return (await import('./audioEncode')).canExport(fmt);
}

export async function projectToMidi(p: Project, opts?: import('./codecs').MidiExportOptions): Promise<Blob> {
  return (await import('./codecs')).projectToMidi(p, opts);
}

export type { ImportedMidi } from './codecs';

export async function parseMidiFile(file: Blob): Promise<import('./codecs').ImportedMidi> {
  return (await import('./codecs')).parseMidiFile(file);
}
