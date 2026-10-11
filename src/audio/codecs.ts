// MIDI files, split into their own chunk.
import { Midi } from '@tonejs/midi';
import type { Project } from '../model/types';
import { placedNotes } from '../model/regions';
import { applyGroove, grooveFor } from '../model/groove';
import { gmProgram } from '../model/gm';
import { meterOf, tempoOf } from '../model/timeline';

export interface MidiExportOptions {
  /** Write swing into the note timing (what you hear) instead of the straight written notes. */
  swing?: boolean;
  /** Only these tracks (default: every instrument and drum track). */
  trackIds?: string[];
}

// Sharps/flats for each major key, indexed by tonic pitch class.
const SF = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
const SF_KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

export function projectToMidi(p: Project, opts: MidiExportOptions = {}): Blob {
  const midi = new Midi();
  const ppq = midi.header.ppq;
  midi.header.setTempo(p.bpm);
  // Tempo changes; gradual ones become a step every eighth note (how MIDI files store them).
  const tm = tempoOf(p);
  for (const c of [...(p.tempoChanges ?? [])].sort((a, b) => a.beat - b.beat)) {
    if (c.ramp) {
      const prevBeat = Math.max(0, ...(p.tempoChanges ?? []).filter((x) => x.beat < c.beat).map((x) => x.beat));
      for (let b = prevBeat + 0.5; b < c.beat - 1e-6; b += 0.5) midi.header.tempos.push({ ticks: Math.round(b * ppq), bpm: tm.bpmAt(b) });
    }
    midi.header.tempos.push({ ticks: Math.round(c.beat * ppq), bpm: c.bpm });
  }
  const meter = meterOf(p);
  for (const seg of meter.segs) midi.header.timeSignatures.push({ ticks: Math.round(seg.beat * ppq), timeSignature: [seg.sig[0], seg.sig[1]] });
  midi.header.name = p.name;
  const minor = p.key.mode === 'minor';
  const sf = SF[(p.key.tonic + (minor ? 3 : 0)) % 12];
  midi.header.keySignatures.push({ ticks: 0, key: SF_KEYS[sf + 7], scale: minor ? 'minor' : 'major' });
  const info = p.info ?? {};
  const credit = [info.artist, info.year].filter(Boolean).join(', ');
  if (credit) midi.header.meta.push({ ticks: 0, type: 'copyrightNotice', text: `(C) ${credit}` });
  for (const [label, v] of [
    ['Artist', info.artist],
    ['Album', info.album],
    ['Composer', info.composer],
    ['Genre', info.genre],
    ['Comment', info.comment],
  ] as const)
    if (v) midi.header.meta.push({ ticks: 0, type: 'text', text: `${label}: ${v}` });
  for (const sec of p.sections ?? []) midi.header.meta.push({ ticks: Math.round(sec.start * ppq), type: 'marker', text: sec.name });
  midi.header.update();

  let channel = 0;
  for (const t of p.tracks) {
    if (t.type === 'audio') continue;
    if (opts.trackIds && !opts.trackIds.includes(t.id)) continue;
    if (!t.regions.some((r) => r.kind === 'midi' && !r.muted && r.notes.length)) continue;
    const mt = midi.addTrack();
    mt.name = t.name;
    if (t.type === 'drums') {
      mt.channel = 9;
    } else {
      if (channel === 9) channel++;
      mt.channel = channel % 16;
      channel++;
      mt.instrument.number = gmProgram(t.instrument);
    }
    for (const r of t.regions) {
      if (r.kind !== 'midi' || r.muted) continue;
      const groove = opts.swing === false ? undefined : grooveFor(p, r);
      for (const pn of placedNotes(r)) {
        const at = groove ? applyGroove(pn.note, pn.start, pn.duration, groove) : pn;
        mt.addNote({
          midi: Math.max(0, Math.min(127, pn.note.pitch + (t.type === 'drums' ? 0 : t.transpose))),
          ticks: Math.max(0, Math.round(at.start * ppq)),
          durationTicks: Math.max(1, Math.round(at.duration * ppq)),
          velocity: pn.note.velocity,
        });
      }
    }
  }
  const bytes = new Uint8Array(midi.toArray());
  // @tonejs/midi writes the key signature's sharps/flats count 14 too high; fix the byte.
  for (let i = 0; i + 4 < bytes.length; i++)
    if (bytes[i] === 0xff && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02) {
      bytes[i + 3] = sf & 0xff;
      break;
    }
  return new Blob([bytes], { type: 'audio/midi' });
}

export interface ImportedMidi {
  bpm: number;
  timeSig: [number, number];
  name: string;
  tracks: { name: string; drums: boolean; program: number; notes: { pitch: number; start: number; duration: number; velocity: number }[] }[];
  /** Every tempo in the file (the first is the opening tempo). */
  tempos: { beat: number; bpm: number }[];
  /** Every time signature, by bar (the first is the opening one). */
  meters: { bar: number; timeSig: [number, number] }[];
}

export async function parseMidiFile(file: Blob): Promise<ImportedMidi> {
  const midi = new Midi(await file.arrayBuffer());
  const ppq = midi.header.ppq;
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const tempos = midi.header.tempos.map((t) => ({ beat: Math.round((t.ticks / ppq) * 1000) / 1000, bpm: Math.round(t.bpm * 100) / 100 }));
  // Bars from time-signature events (they sit on bar lines).
  const meters: { bar: number; timeSig: [number, number] }[] = [];
  let barAcc = 0;
  let lastBeat = 0;
  let lastLen = 4;
  for (const t of [...midi.header.timeSignatures].sort((a, b) => a.ticks - b.ticks)) {
    const beat = t.ticks / ppq;
    barAcc += Math.round((beat - lastBeat) / lastLen);
    meters.push({ bar: barAcc, timeSig: [t.timeSignature[0], t.timeSignature[1]] });
    lastBeat = beat;
    lastLen = t.timeSignature[0] * (4 / t.timeSignature[1]);
  }
  return {
    tempos: tempos.length ? tempos : [{ beat: 0, bpm: 120 }],
    meters: meters.length ? meters : [{ bar: 0, timeSig: [4, 4] }],
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
