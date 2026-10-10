// Offline rendering and file export (MP3, WAV, MIDI).
import type { Project } from '../model/types';
import { contentEndBeat } from '../model/defaults';
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
  const spb = 60 / p.bpm;
  const sr = opts.sampleRate ?? 44100;
  const tail = opts.tail ?? 2.5;
  const seconds = (end - start) * spb + tail;
  const proj: Project = opts.onlyTrackId
    ? { ...p, tracks: p.tracks.map((t) => (t.id === opts.onlyTrackId ? { ...t, mute: false, solo: false } : { ...t, mute: true, solo: false })) }
    : p;
  const oc = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const mixer = new Mixer(oc);
  mixer.output.connect(oc.destination);
  mixer.sync(proj);
  await mixer.ready();
  const offset = 0.05;
  scheduleRange(proj, mixer, start, end, (b) => offset + (b - start) * spb, { fresh: true, limit: end });
  if (opts.onProgress) {
    // Report progress via suspend points.
    const steps = 20;
    for (let i = 1; i < steps; i++) {
      const t = (seconds * i) / steps;
      oc.suspend(t).then(() => {
        opts.onProgress!(i / steps);
        void oc.resume();
      });
    }
  }
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

export async function encodeMp3(buf: AudioBuffer, kbps = 192, onProgress?: (f: number) => void): Promise<Blob> {
  return (await import('./codecs')).encodeMp3(buf, kbps, onProgress);
}

export async function projectToMidi(p: Project): Promise<Blob> {
  return (await import('./codecs')).projectToMidi(p);
}

export type { ImportedMidi } from './codecs';

export async function parseMidiFile(file: Blob): Promise<import('./codecs').ImportedMidi> {
  return (await import('./codecs')).parseMidiFile(file);
}
