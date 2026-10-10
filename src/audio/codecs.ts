// Heavy file codecs (MP3 encoder, MIDI files), split into their own chunk.
import { Mp3Encoder } from '@breezystack/lamejs';
import { Midi } from '@tonejs/midi';
import type { Project } from '../model/types';
import { placedNotes } from '../model/regions';
import { applyGroove, grooveFor } from '../model/groove';

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
      const groove = grooveFor(p, r);
      for (const pn of placedNotes(r)) {
        // Export what you hear: swing is written into the note timing.
        const at = groove ? applyGroove(pn.note, pn.start, pn.duration, groove) : pn;
        mt.addNote({
          midi: Math.max(0, Math.min(127, pn.note.pitch + (t.type === 'drums' ? 0 : t.transpose))),
          ticks: Math.round(at.start * ppq),
          durationTicks: Math.max(1, Math.round(at.duration * ppq)),
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
