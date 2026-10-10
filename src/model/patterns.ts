// Linked Beat Sequencer patterns (FL Studio-style): drum clips that share a
// patternId play the same pattern, so editing one clip edits every copy.
import { produce, type Draft } from 'immer';
import type { MidiRegion, Project, Region } from './types';

/** The fields that make up a pattern (everything else is per clip). */
const PATTERN_FIELDS = ['notes', 'contentLength', 'name', 'swing'] as const;

function midiRegions(p: Project): Map<string, MidiRegion> {
  const m = new Map<string, MidiRegion>();
  for (const t of p.tracks) for (const r of t.regions) if (r.kind === 'midi') m.set(r.id, r);
  return m;
}

/** A clip only stays linked while it loops its pattern. */
export function isLinkedClip(r: Region): r is MidiRegion & { patternId: string } {
  return r.kind === 'midi' && !!r.patternId && r.loop;
}

/** How many clips play each pattern. */
export function patternUseCounts(p: Project): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of p.tracks) for (const r of t.regions) if (isLinkedClip(r)) m.set(r.patternId, (m.get(r.patternId) ?? 0) + 1);
  return m;
}

/**
 * After an edit, copy any changed pattern content to the other clips of the same
 * pattern. Clips whose loop was switched off become standalone (structural edits
 * like split rewrite the notes of non-looping regions).
 */
export function syncLinkedPatterns(prev: Project, next: Project): Project {
  if (prev.tracks === next.tracks) return next;
  const before = midiRegions(prev);
  const changed = new Map<string, MidiRegion>(); // patternId → edited clip
  let unlink = false;
  for (const t of next.tracks) {
    if (t.regions === prev.tracks.find((x) => x.id === t.id)?.regions) continue;
    for (const r of t.regions) {
      if (r.kind !== 'midi' || !r.patternId) continue;
      if (!r.loop) {
        unlink = true;
        continue;
      }
      const old = before.get(r.id);
      if (!old || old.patternId !== r.patternId || changed.has(r.patternId)) continue;
      if (PATTERN_FIELDS.some((f) => old[f] !== r[f])) changed.set(r.patternId, r);
    }
  }
  if (!changed.size && !unlink) return next;
  return produce(next, (d) => {
    for (const t of d.tracks) {
      for (const r of t.regions) {
        if (r.kind !== 'midi' || !r.patternId) continue;
        if (!r.loop) {
          delete r.patternId;
          continue;
        }
        const src = changed.get(r.patternId);
        if (!src || src.id === r.id) continue;
        const oldCl = r.contentLength;
        r.notes = src.notes as Draft<MidiRegion>['notes'];
        r.name = src.name;
        r.swing = src.swing;
        r.contentLength = src.contentLength;
        // A clip that showed exactly one pass of the pattern follows its new length,
        // as long as that does not run into the next clip on the track.
        if (Math.abs(r.length - oldCl) < 1e-6 && src.contentLength > oldCl) {
          const end = r.start + src.contentLength;
          const blocked = t.regions.some((o) => o.id !== r.id && o.start > r.start + 1e-6 && o.start < end - 1e-6);
          if (!blocked) r.length = src.contentLength;
        }
      }
    }
  });
}
