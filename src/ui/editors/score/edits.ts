// Note edits issued by the score editor (all undoable). Work on one region or across a whole song.
import type { Draft } from 'immer';
import type { Articulation, MidiRegion, Note, Project, ScoreMark } from '../../../model/types';
import { createMidiRegion, uid } from '../../../model/defaults';
import { beatsPerBar } from '../../../model/music';
import { commit, draftRegion, useStore } from '../../../state/store';
import { growSong } from '../../../state/actions';
import { dynamicVel } from './notation';

type DRegion = Draft<MidiRegion>;

function midi(d: Draft<Project>, regionId: string): DRegion | null {
  const r = draftRegion(d, regionId);
  return r && r.kind === 'midi' ? (r as DRegion) : null;
}

export function viewOf(r: { loop: boolean; offset: number; contentLength: number; length: number }): { viewStart: number; viewLen: number } {
  return r.loop ? { viewStart: 0, viewLen: r.contentLength } : { viewStart: r.offset, viewLen: r.length };
}

/** Where a score edit lands. `t` is a display beat (view-relative for one region, absolute for the full score). */
export interface Placement {
  mode: 'region' | 'song';
  trackId: string;
  regionId?: string; // region mode
  /** Staff (within the part) a sounding pitch is notated on. */
  staffOf: (pitch: number) => number;
}

/** Make sure a region can hold content up to view beat `end`. */
function ensureLength(d: Draft<Project>, r: DRegion, end: number): void {
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

/** Resolve a display beat to (region, content beat), creating or extending a region in song mode. */
function resolve(d: Draft<Project>, pl: Placement, t: number, dur: number): { r: DRegion; cT: number } | null {
  if (pl.mode === 'region') {
    const r = midi(d, pl.regionId!);
    if (!r) return null;
    ensureLength(d, r, t + dur);
    return { r, cT: viewOf(r).viewStart + t };
  }
  const track = d.tracks.find((x) => x.id === pl.trackId);
  if (!track || track.type === 'audio') return null;
  const bpb = beatsPerBar(d.timeSig);
  const regions = track.regions.filter((r) => r.kind === 'midi') as DRegion[];
  const host = regions.find((r) => !r.muted && r.start <= t + 1e-6 && t < r.start + r.length - 1e-6);
  if (host) {
    if (host.loop) {
      const cl = host.contentLength;
      const cT = ((((t - host.start + host.offset) % cl) + cl) % cl);
      return { r: host, cT };
    }
    const end = t + dur;
    if (end > host.start + host.length + 1e-6) {
      host.length = Math.ceil((end - host.start) / bpb - 1e-6) * bpb;
      host.contentLength = Math.max(host.contentLength, host.offset + host.length);
      growSong(d, host.start + host.length);
    }
    return { r: host, cT: t - host.start + host.offset };
  }
  // Extend a region that ends earlier in the same bar (or exactly where we write).
  const barStart = Math.floor(t / bpb + 1e-9) * bpb;
  const prev = regions
    .filter((r) => !r.loop && r.start + r.length <= t + 1e-6 && r.start + r.length >= barStart - 1e-6)
    .sort((a, b) => b.start + b.length - (a.start + a.length))[0];
  if (prev) {
    prev.length = Math.ceil((t + dur - prev.start) / bpb - 1e-6) * bpb;
    prev.contentLength = Math.max(prev.contentLength, prev.offset + prev.length);
    growSong(d, prev.start + prev.length);
    return { r: prev, cT: t - prev.start + prev.offset };
  }
  const next = regions.filter((r) => r.start > t).sort((a, b) => a.start - b.start)[0];
  let len = Math.max(bpb, Math.ceil((t + dur - barStart) / bpb - 1e-6) * bpb);
  if (next) len = Math.max(Math.min(len, next.start - barStart), t + dur - barStart);
  const r = createMidiRegion(barStart, len, [], track.name);
  track.regions.push(r);
  growSong(d, r.start + r.length);
  return { r: track.regions[track.regions.length - 1] as DRegion, cT: t - barStart };
}

function clearSpan(r: DRegion, cT: number, dur: number, staff: number, voice: 1 | 2, staffOf: (p: number) => number, protect?: Set<string>): void {
  const eps = 1e-3;
  // `protect`: notes shown in the other voice (e.g. a held note split off automatically) stay untouched.
  const same = (n: Note) => staffOf(n.pitch) === staff && (n.voice ?? 1) === voice && !protect?.has(n.id);
  r.notes = r.notes.filter((n) => !same(n) || !(n.start >= cT - eps && n.start < cT + dur - eps));
  for (const n of r.notes) {
    if (!same(n)) continue;
    if (n.start < cT - eps && n.start + n.duration > cT + eps) n.duration = cT - n.start;
  }
}

/** Insert a note at display beat t. Unless `chord`, notes in the same staff & voice overlapping the span are replaced. */
export function insertNote(pl: Placement, t: number, dur: number, pitch: number, velocity: number, voice: 1 | 2, chord: boolean, protect?: Set<string>): string {
  const id = uid('n');
  commit((d) => {
    const res = resolve(d, pl, t, dur);
    if (!res) return;
    const { r, cT } = res;
    if (!chord) clearSpan(r, cT, dur, pl.staffOf(pitch), voice, pl.staffOf, protect);
    const n: Note = { id, pitch, start: cT, duration: dur, velocity };
    if (voice === 2) n.voice = 2;
    r.notes.push(n);
    if (r.marks?.length) applyMarks(r, pl.staffOf);
  });
  return id;
}

/** Replace a span with silence (a rest). */
export function insertRest(pl: Placement, t: number, dur: number, staff: number, voice: 1 | 2, protect?: Set<string>): void {
  commit((d) => {
    const res = resolve(d, pl, t, dur);
    if (res) clearSpan(res.r, res.cT, dur, staff, voice, pl.staffOf, protect);
  });
}

function eachNote(d: Draft<Project>, ids: Set<string>, fn: (n: Draft<Note>, r: DRegion) => void): void {
  for (const t of d.tracks)
    for (const r of t.regions) if (r.kind === 'midi') for (const n of r.notes) if (ids.has(n.id)) fn(n, r as DRegion);
}

export function deleteNotes(ids: string[]): void {
  const set = new Set(ids);
  commit((d) => {
    for (const t of d.tracks) for (const r of t.regions) if (r.kind === 'midi' && r.notes.some((n) => set.has(n.id))) r.notes = r.notes.filter((n) => !set.has(n.id));
  });
  useStore.setState((s) => ({ selectedNoteIds: s.selectedNoteIds.filter((i) => !set.has(i)) }));
}

export function mapNotes(ids: string[], fn: (n: Draft<Note>) => void): void {
  commit((d) => eachNote(d, new Set(ids), (n) => fn(n)));
}

/**
 * Change note values like Flat/MuseScore: the selected notes (and the rest of their chords)
 * get the new duration; making a note longer writes over the notes that follow it in the
 * same voice, making it shorter leaves a rest. `sameVoice` = ids of the notes shown in the
 * same staff & voice as each selected note (keyed by selected id).
 */
export function setDuration(ids: string[], dur: number, sameVoice?: Map<string, Set<string>>): void {
  const eps = 1e-3;
  commit((d) => {
    for (const t of d.tracks)
      for (const reg of t.regions) {
        if (reg.kind !== 'midi') continue;
        const r = reg as DRegion;
        const sel = r.notes.filter((n) => ids.includes(n.id));
        if (!sel.length) continue;
        const remove = new Set<string>();
        for (const n of sel) {
          const voiceIds = sameVoice?.get(n.id);
          const inVoice = (x: Note) => (voiceIds ? voiceIds.has(x.id) : (x.voice ?? 1) === (n.voice ?? 1));
          const oldDur = n.duration;
          // Chord-mates (same onset & value, same voice) change with it.
          const chord = r.notes.filter((x) => x.id === n.id || (inVoice(x) && Math.abs(x.start - n.start) < eps && Math.abs(x.duration - oldDur) < 0.05));
          for (const c of chord) c.duration = dur;
          const end = n.start + dur;
          for (const x of r.notes) {
            if (!inVoice(x) || chord.includes(x) || ids.includes(x.id)) continue;
            if (x.start > n.start + eps && x.start < end - eps) {
              // Starts inside the longer note: overwritten, unless it rings on past the end — then it's shortened.
              if (x.start + x.duration > end + eps) {
                x.duration = x.start + x.duration - end;
                x.start = end;
              } else remove.add(x.id);
            }
          }
          if (!r.loop) ensureLength(d, r, n.start - viewOf(r).viewStart + dur);
        }
        if (remove.size) r.notes = r.notes.filter((x) => !remove.has(x.id));
      }
  });
}

/** Add a note to each selected note's chord at `pitchOf(note)` (skips pitches already there). Returns the new ids. */
export function addToChords(ids: string[], pitchOf: (n: Note) => number): string[] {
  const out: string[] = [];
  commit((d) => {
    for (const t of d.tracks)
      for (const reg of t.regions) {
        if (reg.kind !== 'midi') continue;
        const r = reg as DRegion;
        for (const n of r.notes.filter((x) => ids.includes(x.id))) {
          const p = Math.max(0, Math.min(127, pitchOf(n as Note)));
          if (r.notes.some((x) => x.pitch === p && Math.abs(x.start - n.start) < 1e-3)) continue;
          const id = uid('n');
          const c: Note = { id, pitch: p, start: n.start, duration: n.duration, velocity: n.velocity };
          if (n.voice) c.voice = n.voice;
          r.notes.push(c);
          out.push(id);
        }
      }
  });
  return out;
}

export function setVoice(ids: string[], voice: 1 | 2): void {
  mapNotes(ids, (n) => {
    if (voice === 2) n.voice = 2;
    else delete n.voice;
  });
}

export function toggleArticulation(ids: string[], a: Articulation): void {
  const p = useStore.getState().project;
  if (!p) return;
  const set = new Set(ids);
  let allHave = true;
  for (const t of p.tracks) for (const r of t.regions) if (r.kind === 'midi') for (const n of r.notes) if (set.has(n.id) && !n.artic?.includes(a)) allHave = false;
  mapNotes(ids, (n) => {
    const cur = (n.artic ?? []).filter((x) => x !== a && !(a === 'accent' && x === 'marcato') && !(a === 'marcato' && x === 'accent') && !(a === 'staccato' && x === 'tenuto') && !(a === 'tenuto' && x === 'staccato'));
    if (!allHave) cur.push(a);
    if (cur.length) n.artic = cur;
    else delete n.artic;
  });
}

export function setLyric(id: string, text: string): void {
  mapNotes([id], (n) => {
    const v = text.trim();
    if (v) n.lyric = v;
    else delete n.lyric;
  });
}

/** Tie each selected note to the next note of the same pitch (merging them), or lengthen it. */
export function tieNotes(ids: string[], extend: number): void {
  commit((d) => {
    for (const t of d.tracks)
      for (const reg of t.regions) {
        if (reg.kind !== 'midi') continue;
        const r = reg as DRegion;
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
            if (!r.loop) ensureLength(d, r, n.start - viewOf(r).viewStart + n.duration);
          }
        }
      }
  });
}

export function pasteNotes(pl: Placement, notes: Note[], t: number): string[] {
  const ids: string[] = [];
  if (!notes.length) return ids;
  commit((d) => {
    const t0 = Math.min(...notes.map((n) => n.start));
    const span = Math.max(...notes.map((n) => n.start + n.duration)) - t0;
    const res = resolve(d, pl, t, span);
    if (!res) return;
    for (const n of notes) {
      const id = uid('n');
      ids.push(id);
      res.r.notes.push({ ...n, id, start: res.cT + n.start - t0 });
    }
  });
  return ids;
}

export function addBars(regionId: string, bars: number): void {
  commit((d) => {
    const r = midi(d, regionId);
    if (!r) return;
    ensureLength(d, r, viewOf(r).viewLen + bars * beatsPerBar(d.timeSig));
  });
}

// ------------------------------------------------------------------ dynamics marks

/** Recompute note velocities from the region's dynamics markings and hairpins. */
export function applyMarks(r: DRegion, staffOf: (p: number) => number): void {
  const marks = r.marks ?? [];
  if (!marks.length) return;
  const dyns = marks.filter((m) => m.kind === 'dyn').sort((a, b) => a.beat - b.beat);
  const pins = marks.filter((m) => m.kind !== 'dyn');
  const levelAt = (beat: number, staff: number): number | null => {
    let v: number | null = null;
    for (const m of dyns) if (m.beat <= beat + 1e-6 && (m.staff ?? 0) === staff) v = dynamicVel(m.value ?? 'mf');
    return v;
  };
  for (const n of r.notes) {
    const staff = staffOf(n.pitch);
    const lvl = levelAt(n.start, staff);
    if (lvl !== null) n.velocity = lvl;
  }
  for (const hp of pins) {
    const staff = hp.staff ?? 0;
    const end = hp.end ?? hp.beat + 1;
    const inside = r.notes.filter((n) => staffOf(n.pitch) === staff && n.start >= hp.beat - 1e-6 && n.start <= end + 1e-6);
    if (!inside.length) continue;
    const v0 = levelAt(hp.beat, staff) ?? inside.sort((a, b) => a.start - b.start)[0].velocity;
    const after = dyns.find((m) => (m.staff ?? 0) === staff && m.beat >= end - 1e-6);
    const target = after ? dynamicVel(after.value ?? 'mf') : Math.max(0.12, Math.min(1, v0 + (hp.kind === 'cresc' ? 0.28 : -0.28)));
    for (const n of inside) {
      const f = end > hp.beat ? (n.start - hp.beat) / (end - hp.beat) : 1;
      n.velocity = Math.max(0.05, Math.min(1, v0 + (target - v0) * f));
    }
  }
}

function findNote(d: Draft<Project>, id: string): { r: DRegion; n: Draft<Note> } | null {
  for (const t of d.tracks)
    for (const r of t.regions) {
      if (r.kind !== 'midi') continue;
      const n = r.notes.find((x) => x.id === id);
      if (n) return { r: r as DRegion, n };
    }
  return null;
}

/** Put a dynamic marking at the first selected note (per region) and re-apply velocities. */
export function addDynamic(ids: string[], value: string, staffOf: (p: number) => number): void {
  commit((d) => {
    const byRegion = new Map<DRegion, Draft<Note>[]>();
    for (const id of ids) {
      const f = findNote(d, id);
      if (f) byRegion.set(f.r, [...(byRegion.get(f.r) ?? []), f.n]);
    }
    for (const [r, notes] of byRegion) {
      const first = notes.sort((a, b) => a.start - b.start)[0];
      const staff = staffOf(first.pitch);
      const marks: ScoreMark[] = (r.marks ?? []).filter((m) => !(m.kind === 'dyn' && Math.abs(m.beat - first.start) < 1e-3 && (m.staff ?? 0) === staff));
      marks.push({ id: uid('m'), kind: 'dyn', beat: first.start, value, staff });
      r.marks = marks;
      applyMarks(r, staffOf);
    }
  });
}

/** Add a crescendo/diminuendo hairpin spanning the selected notes. */
export function addHairpin(ids: string[], kind: 'cresc' | 'dim', staffOf: (p: number) => number): void {
  commit((d) => {
    const byRegion = new Map<DRegion, Draft<Note>[]>();
    for (const id of ids) {
      const f = findNote(d, id);
      if (f) byRegion.set(f.r, [...(byRegion.get(f.r) ?? []), f.n]);
    }
    for (const [r, notes] of byRegion) {
      if (notes.length < 2) continue;
      notes.sort((a, b) => a.start - b.start);
      const staff = staffOf(notes[0].pitch);
      const beat = notes[0].start;
      const end = notes[notes.length - 1].start;
      const marks: ScoreMark[] = (r.marks ?? []).filter((m) => !(m.kind !== 'dyn' && (m.staff ?? 0) === staff && m.beat < end && (m.end ?? m.beat) > beat));
      marks.push({ id: uid('m'), kind, beat, end, staff });
      r.marks = marks;
      applyMarks(r, staffOf);
    }
  });
}

/** Remove dynamics/hairpins in the span covered by the selected notes (or the whole region when none). */
export function clearMarks(ids: string[], regionIds: string[]): void {
  commit((d) => {
    const spans = new Map<DRegion, [number, number]>();
    for (const id of ids) {
      const f = findNote(d, id);
      if (!f) continue;
      const s = spans.get(f.r) ?? [Infinity, -Infinity];
      spans.set(f.r, [Math.min(s[0], f.n.start), Math.max(s[1], f.n.start + f.n.duration)]);
    }
    if (!ids.length)
      for (const rid of regionIds) {
        const r = midi(d, rid);
        if (r) spans.set(r, [-Infinity, Infinity]);
      }
    for (const [r, [a, b]] of spans) {
      if (!r.marks) continue;
      r.marks = r.marks.filter((m) => (m.end ?? m.beat) < a - 1e-6 || m.beat > b + 1e-6);
      if (!r.marks.length) delete r.marks;
    }
  });
}
