// Offline rendering and file export (MP3, M4A, FLAC, WAV, OGG, MIDI).
import type { Project } from '../model/types';
import { contentEndBeat } from '../model/defaults';
import { tempoOf } from '../model/timeline';
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
  const seconds = tm.span(start, end) + tail;
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
  const s0 = tm.sec(start);
  const toTime = (b: number) => offset + tm.sec(b) - s0;
  const beatAt = (t: number) => Math.min(end, Math.max(start, tm.beat(s0 + t - offset)));
  // Schedule incrementally (like live playback) instead of all at once: Chrome's offline
  // renderer pays for every pending node on every render quantum, so pre-scheduling a
  // whole song makes long exports many times slower.
  const CHUNK = 1.5; // seconds
  let scheduledTo = start;
  const scheduleUntil = (t: number) => {
    const b1 = beatAt(t);
    if (b1 <= scheduledTo) return;
    scheduleRange(proj, mixer, scheduledTo, b1, toTime, { fresh: scheduledTo === start, limit: end });
    scheduledTo = b1;
  };
  scheduleUntil(CHUNK * 2);
  const chunks = Math.floor(seconds / CHUNK);
  for (let k = 1; k <= chunks; k++) {
    const t = k * CHUNK;
    if (t >= seconds) break;
    oc.suspend(t).then(() => {
      scheduleUntil(t + CHUNK * 2);
      opts.onProgress?.(Math.min(1, t / seconds));
      void oc.resume();
    });
  }
  if (chunks < 1) scheduleUntil(Infinity);
  const out = await oc.startRendering();
  // Fade the tail gently to avoid a cut-off.
  const fadeLen = Math.floor(sr * Math.min(tail, 1));
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < fadeLen; i++) d[d.length - 1 - i] *= i / fadeLen;
  }
  return out;
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
