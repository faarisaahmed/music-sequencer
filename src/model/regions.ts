import type { MidiRegion, Note, Region } from './types';

export interface PlacedNote {
  note: Note;
  /** Absolute timeline start (beats). */
  start: number;
  /** Duration after clipping to the region / loop cycle. */
  duration: number;
  /** Loop iteration index (0 = original content). */
  iteration: number;
}

/**
 * Expand a MIDI region into the notes that actually sound on the timeline,
 * honouring offset, looping and the region bounds. Optionally restricted to
 * notes starting within [from, to).
 */
export function placedNotes(r: MidiRegion, from = -Infinity, to = Infinity): PlacedNote[] {
  const out: PlacedNote[] = [];
  if (r.muted) return out;
  const regionEnd = r.start + r.length;
  const lo = Math.max(from, r.start);
  const hi = Math.min(to, regionEnd);
  if (hi <= lo) return out;
  const cl = Math.max(r.contentLength, 1e-6);
  if (!r.loop) {
    const base = r.start - r.offset;
    for (const n of r.notes) {
      const s = base + n.start;
      if (s < lo - 1e-9 || s >= hi - 1e-9) continue;
      out.push({ note: n, start: s, duration: Math.min(n.duration, regionEnd - s), iteration: 0 });
    }
    return out;
  }
  const kFirst = Math.max(0, Math.floor((lo - (r.start - r.offset)) / cl) - 1);
  const kLast = Math.ceil((hi - (r.start - r.offset)) / cl);
  for (let k = kFirst; k <= kLast; k++) {
    const base = r.start - r.offset + k * cl;
    for (const n of r.notes) {
      if (n.start >= cl - 1e-9) continue;
      const s = base + n.start;
      if (s < lo - 1e-9 || s >= hi - 1e-9) continue;
      out.push({
        note: n,
        start: s,
        duration: Math.min(n.duration, regionEnd - s, base + cl - s),
        iteration: k,
      });
    }
  }
  return out;
}

/** Content segments of a (possibly looped) region: [absStart, absEnd) mapped to content offset. */
export function regionSegments(r: Region): { start: number; end: number; contentStart: number }[] {
  const end = r.start + r.length;
  if (!r.loop) return [{ start: r.start, end, contentStart: r.offset }];
  const cl = Math.max(r.contentLength, 1e-6);
  const segs: { start: number; end: number; contentStart: number }[] = [];
  let t = r.start;
  let c = ((r.offset % cl) + cl) % cl;
  while (t < end - 1e-9) {
    const segLen = Math.min(cl - c, end - t);
    segs.push({ start: t, end: t + segLen, contentStart: c });
    t += segLen;
    c = 0;
  }
  return segs;
}

export function pitchRange(notes: Note[]): [number, number] {
  if (!notes.length) return [60, 72];
  let lo = 127;
  let hi = 0;
  for (const n of notes) {
    lo = Math.min(lo, n.pitch);
    hi = Math.max(hi, n.pitch);
  }
  return [lo, hi];
}
