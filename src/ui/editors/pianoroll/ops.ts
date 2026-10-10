// Note-editing operations used by the piano roll (and usable by other editors).
import type { Draft } from 'immer';
import type { MidiRegion, Note } from '../../../model/types';
import { uid } from '../../../model/defaults';
import { beatsPerBar, snap } from '../../../model/music';
import { commit, draftRegion, findRegion, live, toast, useStore } from '../../../state/store';

export type DraftRegion = Draft<MidiRegion>;

/** Grow the region so that every note fits inside it. */
export function fitRegion(r: DraftRegion, bpb: number): void {
  let maxEnd = 0;
  for (const n of r.notes) maxEnd = Math.max(maxEnd, n.start + n.duration);
  if (r.loop) {
    if (maxEnd > r.contentLength + 1e-6) {
      r.contentLength = Math.ceil(maxEnd / bpb - 1e-6) * bpb;
      r.length = Math.max(r.length, r.contentLength - r.offset);
    }
  } else if (maxEnd > r.offset + r.length + 1e-6) {
    r.length = Math.ceil(maxEnd / bpb - 1e-6) * bpb - r.offset;
    r.contentLength = Math.max(r.contentLength, r.offset + r.length);
  }
}

/** Edit a MIDI region's notes (undoable unless `mode` is 'live'). */
export function editRegion(regionId: string, recipe: (r: DraftRegion) => void, mode: 'commit' | 'live' = 'commit'): void {
  const apply = mode === 'commit' ? commit : live;
  apply((d) => {
    const r = draftRegion(d, regionId);
    if (r?.kind !== 'midi') return;
    recipe(r);
    fitRegion(r, beatsPerBar(d.timeSig));
  });
}

export function selectedSet(): Set<string> {
  return new Set(useStore.getState().selectedNoteIds);
}

/** Selected notes, or every note when nothing is selected. */
function targets(r: DraftRegion, sel: Set<string>, allIfNone = true): DraftRegion['notes'] {
  const picked = r.notes.filter((n) => sel.has(n.id));
  return picked.length || !allIfNone ? picked : r.notes;
}

export function transposeNotes(regionId: string, semis: number): void {
  const sel = selectedSet();
  editRegion(regionId, (r) => {
    for (const n of targets(r, sel)) n.pitch = Math.max(0, Math.min(127, n.pitch + semis));
  });
}

export function quantizeNotes(regionId: string, grid: number, strength = 1): void {
  const sel = selectedSet();
  editRegion(regionId, (r) => {
    for (const n of targets(r, sel)) {
      const q = Math.max(0, snap(n.start, grid));
      n.start = n.start + (q - n.start) * strength;
      const qe = Math.max(grid, snap(n.duration, grid));
      n.duration = Math.max(0.01, n.duration + (qe - n.duration) * strength);
    }
  });
}

export function setVelocity(regionId: string, v: number, mode: 'commit' | 'live' = 'commit'): void {
  const sel = selectedSet();
  editRegion(
    regionId,
    (r) => {
      for (const n of targets(r, sel)) n.velocity = Math.max(0.02, Math.min(1, v));
    },
    mode,
  );
}

export type Dynamics = 'crescendo' | 'diminuendo' | 'fadein' | 'fadeout' | 'humanize' | 'accent';

/** Shape velocities over time — the "dynamics" tools. */
export function applyDynamics(regionId: string, kind: Dynamics): void {
  const sel = selectedSet();
  editRegion(regionId, (r) => {
    const ns = [...targets(r, sel)].sort((a, b) => a.start - b.start);
    if (!ns.length) return;
    const t0 = ns[0].start;
    const t1 = ns[ns.length - 1].start;
    const span = Math.max(1e-6, t1 - t0);
    for (const n of ns) {
      const f = ns.length === 1 ? 1 : (n.start - t0) / span;
      switch (kind) {
        case 'crescendo':
          n.velocity = 0.3 + 0.7 * f;
          break;
        case 'diminuendo':
          n.velocity = 1 - 0.7 * f;
          break;
        case 'fadein':
          n.velocity = Math.max(0.05, n.velocity * (0.08 + 0.92 * f));
          break;
        case 'fadeout':
          n.velocity = Math.max(0.05, n.velocity * (1 - 0.92 * f));
          break;
        case 'humanize':
          n.velocity = Math.max(0.05, Math.min(1, n.velocity + (Math.random() - 0.5) * 0.16));
          n.start = Math.max(0, n.start + (Math.random() - 0.5) * 0.03);
          break;
        case 'accent': {
          const onBeat = Math.abs(n.start - Math.round(n.start)) < 1e-3;
          n.velocity = onBeat ? Math.min(1, n.velocity * 1.2 + 0.05) : n.velocity * 0.8;
          break;
        }
      }
    }
  });
}

/** Extend each note until the next note start (per pitch-independent timeline). */
export function legato(regionId: string): void {
  const sel = selectedSet();
  editRegion(regionId, (r) => {
    const ns = [...targets(r, sel)].sort((a, b) => a.start - b.start);
    const starts = [...new Set(ns.map((n) => n.start))].sort((a, b) => a - b);
    for (const n of ns) {
      const next = starts.find((s) => s > n.start + 1e-6);
      if (next !== undefined) n.duration = next - n.start;
    }
  });
}

export function deleteSelectedNotes(regionId: string): void {
  const sel = selectedSet();
  if (!sel.size) return;
  editRegion(regionId, (r) => {
    r.notes = r.notes.filter((n) => !sel.has(n.id));
  });
  useStore.setState({ selectedNoteIds: [] });
}

export function duplicateSelectedNotes(regionId: string): void {
  const sel = selectedSet();
  const p = useStore.getState().project;
  const f = findRegion(p, regionId);
  if (!f || f.region.kind !== 'midi' || !sel.size) return;
  const picked = f.region.notes.filter((n) => sel.has(n.id));
  const lo = Math.min(...picked.map((n) => n.start));
  const hi = Math.max(...picked.map((n) => n.start + n.duration));
  const bpb = p ? beatsPerBar(p.timeSig) : 4;
  // Shift by the selection span rounded up to a beat (bar if it is long).
  const span = hi - lo;
  const shift = span >= bpb ? Math.ceil(span / bpb - 1e-6) * bpb : Math.max(0.25, Math.ceil(span / 0.25 - 1e-6) * 0.25);
  const copies: Note[] = picked.map((n) => ({ ...n, id: uid('n'), start: n.start + shift }));
  editRegion(regionId, (r) => {
    r.notes.push(...copies);
  });
  useStore.setState({ selectedNoteIds: copies.map((n) => n.id) });
}

export function copyNotes(regionId: string, cut: boolean): void {
  const sel = selectedSet();
  const f = findRegion(useStore.getState().project, regionId);
  if (!f || f.region.kind !== 'midi' || !sel.size) return;
  const notes = f.region.notes.filter((n) => sel.has(n.id)).map((n) => ({ ...n }));
  const anchor = Math.min(...notes.map((n) => n.start));
  useStore.setState({ clipboard: { kind: 'notes', notes, anchor } });
  if (cut) deleteSelectedNotes(regionId);
  toast(`${cut ? 'Cut' : 'Copied'} ${notes.length} note${notes.length > 1 ? 's' : ''}`);
}

export function pasteNotes(regionId: string, at: number): void {
  const cb = useStore.getState().clipboard;
  if (!cb || cb.kind !== 'notes' || !cb.notes?.length) return;
  const copies = cb.notes.map((n) => ({ ...n, id: uid('n'), start: Math.max(0, at + n.start - cb.anchor) }));
  editRegion(regionId, (r) => {
    r.notes.push(...copies);
  });
  useStore.setState({ selectedNoteIds: copies.map((n) => n.id) });
}

export function selectAllNotes(regionId: string, pitch?: number): void {
  const f = findRegion(useStore.getState().project, regionId);
  if (!f || f.region.kind !== 'midi') return;
  useStore.setState({ selectedNoteIds: f.region.notes.filter((n) => pitch === undefined || n.pitch === pitch).map((n) => n.id) });
}

/** Content-beat of an absolute song position, if it lies within the region. */
export function songToContent(r: MidiRegion | { start: number; length: number; offset: number; loop: boolean; contentLength: number }, abs: number): number | null {
  const rel = abs - r.start;
  if (rel < 0 || rel >= r.length) return null;
  let c = r.offset + rel;
  if (r.loop && r.contentLength > 0) c = ((c % r.contentLength) + r.contentLength) % r.contentLength;
  return c;
}
