// Offline rendering and file export (MP3, WAV, MIDI).
import { Mp3Encoder } from '@breezystack/lamejs';
import { Midi } from '@tonejs/midi';
import type { Project } from '../model/types';
import { contentEndBeat } from '../model/defaults';
import { placedNotes } from '../model/regions';
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

export async function encodeMp3(buf: AudioBuffer, kbps = 192, onProgress?: (f: number) => void): Promise<Blob> {
  const enc = new Mp3Encoder(2, buf.sampleRate, kbps);
  const l = buf.getChannelData(0);
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
  const block = 1152 * 20;
  const parts: BlobPart[] = [];
  const toInt = (src: Float32Array, s: number, e: number) => {
    const out = new Int16Array(e - s);
    for (let i = s; i < e; i++) {
      const v = Math.max(-1, Math.min(1, src[i]));
      out[i - s] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return out;
  };
  for (let i = 0; i < l.length; i += block) {
    const e = Math.min(l.length, i + block);
    const chunk = enc.encodeBuffer(toInt(l, i, e), toInt(r, i, e));
    if (chunk.length) parts.push(new Uint8Array(chunk));
    if ((i / block) % 40 === 0) {
      onProgress?.(i / l.length);
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  const last = enc.flush();
  if (last.length) parts.push(new Uint8Array(last));
  return new Blob(parts, { type: 'audio/mpeg' });
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

// ---------------------------------------------------------------- MIDI files

export function projectToMidi(p: Project): Blob {
  const midi = new Midi();
  midi.header.setTempo(p.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [p.timeSig[0], p.timeSig[1]] });
  midi.header.name = p.name;
  const ppq = midi.header.ppq;
  for (const t of p.tracks) {
    if (t.type === 'audio') continue;
    const mt = midi.addTrack();
    mt.name = t.name;
    if (t.type === 'drums') mt.channel = 9;
    for (const r of t.regions) {
      if (r.kind !== 'midi') continue;
      for (const pn of placedNotes(r)) {
        mt.addNote({
          midi: Math.max(0, Math.min(127, pn.note.pitch + (t.type === 'drums' ? 0 : t.transpose))),
          ticks: Math.round(pn.start * ppq),
          durationTicks: Math.max(1, Math.round(pn.duration * ppq)),
          velocity: pn.note.velocity,
        });
      }
    }
  }
  return new Blob([new Uint8Array(midi.toArray())], { type: 'audio/midi' });
}

export interface ImportedMidi {
  bpm: number;
  timeSig: [number, number];
  name: string;
  tracks: { name: string; drums: boolean; program: number; notes: { pitch: number; start: number; duration: number; velocity: number }[] }[];
}

export async function parseMidiFile(file: Blob): Promise<ImportedMidi> {
  const midi = new Midi(await file.arrayBuffer());
  const ppq = midi.header.ppq;
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  return {
    bpm: Math.round(bpm),
    timeSig: [ts[0], ts[1]],
    name: midi.header.name || 'Imported MIDI',
    tracks: midi.tracks
      .filter((t) => t.notes.length)
      .map((t) => ({
        name: t.name || t.instrument.name || 'Track',
        drums: t.channel === 9 || t.instrument.percussion,
        program: t.instrument.number,
        notes: t.notes.map((n) => ({ pitch: n.midi, start: n.ticks / ppq, duration: n.durationTicks / ppq, velocity: n.velocity })),
      })),
  };
}
