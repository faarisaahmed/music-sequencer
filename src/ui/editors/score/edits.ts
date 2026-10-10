// Note edits issued by the score editor (all undoable).
import type { Draft } from 'immer';
import type { MidiRegion, Note, Project } from '../../../model/types';
import { uid } from '../../../model/defaults';
import { beatsPerBar } from '../../../model/music';
import { commit, draftRegion, useStore } from '../../../state/store';
import { growSong } from '../../../state/actions';
import { staffOf, type StaffKind } from './notation';

function midi(d: Draft<Project>, regionId: string): Draft<MidiRegion> | null {
  const r = draftRegion(d, regionId);
  return r && r.kind === 'midi' ? (r as Draft<MidiRegion>) : null;
}

export function viewOf(r: { loop: boolean; offset: number; contentLength: number; length: number }): { viewStart: number; viewLen: number } {
  return r.loop ? { viewStart: 0, viewLen: r.contentLength } : { viewStart: r.offset, viewLen: r.length };
}

/** Make sure the region can hold content up to view beat `end`. */
function ensureLength(d: Draft<Project>, r: Draft<MidiRegion>, end: number): void {
  const { viewLen } = viewOf(r);
  if (end <= viewLen + 1e-6) return;
  const bpb = beatsPerBar(d.timeSig);
  const newLen = Math.ceil(end / bpb - 1e-6) * bpb;
  if (r.loop) {
    r.contentLength = newLen;
    r.length = Math.max(r.length, newLen);
  } else {
    r.length = newLen;
    r.contentLength = Math.max(r.contentLength, r.offset + newLen);
  }
  growSong(d, r.start + r.length);
}

export function addBars(regionId: string, bars: number): void {
  commit((d) => {
    const r = midi(d, regionId);
    if (!r) return;
    const bpb = beatsPerBar(d.timeSig);
    ensureLength(d, r, viewOf(r).viewLen + bars * bpb);
  });
}

/** Insert a note at view beat t. Unless `chord`, notes in the same staff overlapping the span are replaced/trimmed. */
export function insertNote(regionId: string, t: number, dur: number, pitch: number, velocity: number, staves: StaffKind[], chord: boolean): string {
  const id = uid('n');
  commit((d) => {
    const r = midi(d, regionId);
    if (!r) return;
    ensureLength(d, r, t + dur);
    const cT = viewOf(r).viewStart + t;
    if (!chord) clearSpan(r, cT, dur, staffOf(pitch, staves), staves);
    r.notes.push({ id, pitch, start: cT, duration: dur, velocity });
  });
  return id;
}

function clearSpan(r: Draft<MidiRegion>, cT: number, dur: number, staff: number, staves: StaffKind[]): void {
  const eps = 1e-3;
  r.notes = r.notes.filter((n) => {
    if (staffOf(n.pitch, staves) !== staff) return true;
    return !(n.start >= cT - eps && n.start < cT + dur - eps);
  });
  for (const n of r.notes) {
    if (staffOf(n.pitch, staves) !== staff) continue;
    if (n.start < cT - eps && n.start + n.duration > cT + eps) n.duration = cT - n.start;
  }
}

/** Replace a span with silence (a rest). */
export function insertRest(regionId: string, t: number, dur: number, staff: number, staves: StaffKind[]): void {
  commit((d) => {
    const r = midi(d, regionId);
    if (!r) return;
    ensureLength(d, r, t + dur);
    clearSpan(r, viewOf(r).viewStart + t, dur, staff, staves);
  });
}

export function deleteNotes(regionId: string, ids: string[]): void {
  const set = new Set(ids);
  commit((d) => {
    const r = midi(d, regionId);
    if (r) r.notes = r.notes.filter((n) => !set.has(n.id));
  });
  useStore.setState((s) => ({ selectedNoteIds: s.selectedNoteIds.filter((i) => !set.has(i)) }));
}

export function mapNotes(regionId: string, ids: string[], fn: (n: Draft<Note>) => void): void {
  const set = new Set(ids);
  commit((d) => {
    const r = midi(d, regionId);
    if (r) for (const n of r.notes) if (set.has(n.id)) fn(n);
  });
}

export function setDuration(regionId: string, ids: string[], dur: number): void {
  commit((d) => {
    const r = midi(d, regionId);
    if (!r) return;
    const set = new Set(ids);
    let end = 0;
    for (const n of r.notes)
      if (set.has(n.id)) {
        n.duration = dur;
        end = Math.max(end, n.start - viewOf(r).viewStart + dur);
      }
    ensureLength(d, r, end);
  });
}

/** Ramp velocities linearly across the notes (by start time). */
export function rampVelocity(regionId: string, ids: string[], dir: 1 | -1): void {
  commit((d) => {
    const r = midi(d, regionId);
    if (!r) return;
    const sel = r.notes.filter((n) => ids.includes(n.id)).sort((a, b) => a.start - b.start);
    if (sel.length < 2) return;
    const t0 = sel[0].start;
    const t1 = sel[sel.length - 1].start;
    const v0 = sel[0].velocity;
    const v1 = Math.max(0.15, Math.min(1, v0 + dir * 0.35));
    for (const n of sel) n.velocity = t1 > t0 ? v0 + ((n.start - t0) / (t1 - t0)) * (v1 - v0) : v1;
  });
}

/** Tie each selected note to the next note of the same pitch (merging them), or lengthen it. */
export function tieNotes(regionId: string, ids: string[], extend: number): void {
  commit((d) => {
    const r = midi(d, regionId);
    if (!r) return;
    for (const id of ids) {
      const n = r.notes.find((x) => x.id === id);
      if (!n) continue;
      const end = n.start + n.duration;
      const next = r.notes
        .filter((x) => x.id !== n.id && x.pitch === n.pitch && x.start >= end - 0.13 && x.start <= end + 0.13)
        .sort((a, b) => a.start - b.start)[0];
      if (next) {
        n.duration = next.start + next.duration - n.start;
        r.notes = r.notes.filter((x) => x.id !== next.id);
      } else {
        n.duration += extend;
        ensureLength(d, r, n.start - viewOf(r).viewStart + n.duration);
      }
    }
  });
}

export function pasteNotes(regionId: string, notes: Note[], t: number): string[] {
  const ids: string[] = [];
  commit((d) => {
    const r = midi(d, regionId);
    if (!r || !notes.length) return;
    const t0 = Math.min(...notes.map((n) => n.start));
    const base = viewOf(r).viewStart + t;
    let end = 0;
    for (const n of notes) {
      const id = uid('n');
      ids.push(id);
      r.notes.push({ ...n, id, start: base + n.start - t0 });
      end = Math.max(end, t + n.start - t0 + n.duration);
    }
    ensureLength(d, r, end);
  });
  return ids;
}
