// Arrangement sections (Intro / Verse / Chorus …): structural edits that move whole song parts.
import type { Draft } from 'immer';
import type { AutomationPoint, MidiRegion, Project, Region, Section } from '../model/types';
import { uid } from '../model/defaults';
import { NAME_SEQUENCE, makeSection } from '../model/sections';
export { SECTION_COLORS } from '../model/sections';
import { beatsPerBar } from '../model/music';
import { commit, useStore } from './store';
import { cloneRegion, growSong } from './actions';

const EPS = 1e-6;

// ------------------------------------------------------------------ draft-level helpers

/** Split every region that straddles `beat`. */
function splitAll(d: Draft<Project>, beat: number): void {
  for (const t of d.tracks) {
    const next: Draft<Region>[] = [];
    for (const r of t.regions) {
      if (!(beat > r.start + EPS && beat < r.start + r.length - EPS)) {
        next.push(r);
        continue;
      }
      const leftLen = beat - r.start;
      const right = cloneRegion(r as Region) as Draft<Region>;
      right.start = beat;
      right.length = r.length - leftLen;
      right.offset = r.offset + leftLen;
      if (r.kind === 'midi' && !r.loop) {
        const cut = r.offset + leftLen;
        (right as Draft<MidiRegion>).notes = (right as Draft<MidiRegion>).notes.filter((n) => n.start >= cut - EPS);
        r.notes = r.notes.filter((n) => n.start < cut - EPS);
        for (const n of r.notes) n.duration = Math.min(n.duration, cut - n.start);
      }
      if (r.kind === 'audio') {
        // Fades belong to the outer edges.
        if (right.kind === 'audio') right.fadeIn = 0;
        r.fadeOut = 0;
      }
      r.length = leftLen;
      next.push(r, right);
    }
    t.regions = next;
  }
}

function eachPointList(d: Draft<Project>, fn: (pts: Draft<AutomationPoint>[], set: (p: Draft<AutomationPoint>[]) => void, key: string) => void): void {
  fn(d.masterAutomation, (p) => (d.masterAutomation = p), 'master');
  for (const t of d.tracks) {
    fn(t.automation.volume, (p) => (t.automation.volume = p), t.id + ':volume');
    fn(t.automation.pan, (p) => (t.automation.pan = p), t.id + ':pan');
  }
}

interface ChordLike {
  beat: number;
}
function chordsOf(d: Draft<Project>): ChordLike[] | undefined {
  return (d as unknown as { chords?: ChordLike[] }).chords;
}

/** Move everything at or after `beat` by `delta` beats. */
function shiftFrom(d: Draft<Project>, beat: number, delta: number, skipSection?: string): void {
  for (const t of d.tracks) for (const r of t.regions) if (r.start >= beat - EPS) r.start += delta;
  eachPointList(d, (pts) => {
    for (const p of pts) if (p.beat >= beat - EPS) p.beat += delta;
  });
  for (const s of d.sections ?? []) if (s.id !== skipSection && s.start >= beat - EPS) s.start += delta;
  for (const c of chordsOf(d) ?? []) if (c.beat >= beat - EPS) c.beat += delta;
}

interface Content {
  regions: { trackId: string; region: Region }[];
  points: { key: string; point: AutomationPoint }[];
  chords: ChordLike[];
}

/** Collect (clone) everything inside [s, e), relative to s. Optionally removing it. */
function collect(d: Draft<Project>, s: number, e: number, remove: boolean): Content {
  splitAll(d, s);
  splitAll(d, e);
  const out: Content = { regions: [], points: [], chords: [] };
  for (const t of d.tracks) {
    const keep: Draft<Region>[] = [];
    for (const r of t.regions) {
      if (r.start >= s - EPS && r.start < e - EPS) {
        const plain = JSON.parse(JSON.stringify(r)) as Region;
        out.regions.push({ trackId: t.id, region: remove ? { ...plain, start: plain.start - s } : cloneRegion(plain, { start: plain.start - s }) });
        if (!remove) keep.push(r);
      } else keep.push(r);
    }
    t.regions = keep;
  }
  eachPointList(d, (pts, set, key) => {
    const keep: Draft<AutomationPoint>[] = [];
    for (const p of pts) {
      if (p.beat >= s - EPS && p.beat < e - EPS) {
        out.points.push({ key, point: { beat: p.beat - s, value: p.value } });
        if (!remove) keep.push(p);
      } else keep.push(p);
    }
    if (remove) set(keep);
  });
  const chords = chordsOf(d);
  if (chords) {
    const inside = chords.filter((c) => c.beat >= s - EPS && c.beat < e - EPS);
    for (const c of inside) out.chords.push({ ...JSON.parse(JSON.stringify(c)), beat: c.beat - s, id: uid('c') });
    if (remove) (d as unknown as { chords: ChordLike[] }).chords = chords.filter((c) => !inside.includes(c));
  }
  return out;
}

function place(d: Draft<Project>, at: number, content: Content): void {
  for (const { trackId, region } of content.regions) {
    const t = d.tracks.find((x) => x.id === trackId);
    if (t) t.regions.push({ ...region, start: region.start + at } as Draft<Region>);
  }
  eachPointList(d, (pts, set, key) => {
    const add = content.points.filter((p) => p.key === key).map((p) => ({ beat: p.point.beat + at, value: p.point.value }));
    if (add.length) set([...pts, ...add].sort((a, b) => a.beat - b.beat));
  });
  const chords = chordsOf(d);
  if (chords && content.chords.length) {
    chords.push(...content.chords.map((c) => ({ ...c, beat: c.beat + at })));
    chords.sort((a, b) => a.beat - b.beat);
  }
}

function sortSections(d: Draft<Project>): void {
  d.sections?.sort((a, b) => a.start - b.start);
}

// ------------------------------------------------------------------ public actions

export function addSection(name?: string, at?: number): string {
  const p = useStore.getState().project;
  if (!p) return '';
  const bpb = beatsPerBar(p.timeSig);
  const secs = p.sections ?? [];
  const last = secs[secs.length - 1];
  const start = at ?? (last ? last.start + last.length : 0);
  const used = new Set(secs.map((s) => s.name));
  const nm = name ?? NAME_SEQUENCE.find((n) => !used.has(n)) ?? `Section ${secs.length + 1}`;
  const s = makeSection(nm, start, 8 * bpb);
  commit((d) => {
    if (!d.sections) d.sections = [];
    // Never overlap: trim to the next section.
    const nextS = d.sections.find((x) => x.start > start + EPS);
    if (nextS) s.length = Math.max(bpb, Math.min(s.length, nextS.start - start));
    d.sections.push(s);
    sortSections(d);
    growSong(d, s.start + s.length);
  });
  return s.id;
}

export function updateSection(id: string, patch: Partial<Section>): void {
  commit((d) => {
    const s = d.sections?.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
    sortSections(d);
  });
}

/** Move a section (with all its content) so it starts at `target` (beats, in current timeline). */
export function moveSection(id: string, target: number): void {
  const p = useStore.getState().project;
  const sec = p?.sections?.find((x) => x.id === id);
  if (!p || !sec) return;
  const s = sec.start;
  const e = sec.start + sec.length;
  if (target >= s - EPS && target <= e + EPS) return;
  const L = sec.length;
  commit((d) => {
    const content = collect(d, s, e, true);
    d.sections = (d.sections ?? []).filter((x) => x.id !== id);
    shiftFrom(d, e, -L);
    const T = target > e ? target - L : target;
    splitAll(d, T);
    shiftFrom(d, T, L);
    place(d, T, content);
    d.sections.push({ ...sec, start: T });
    sortSections(d);
  });
}

export function duplicateSection(id: string): void {
  const p = useStore.getState().project;
  const sec = p?.sections?.find((x) => x.id === id);
  if (!p || !sec) return;
  const s = sec.start;
  const e = sec.start + sec.length;
  commit((d) => {
    const content = collect(d, s, e, false);
    splitAll(d, e);
    shiftFrom(d, e, sec.length);
    place(d, e, content);
    const base = sec.name.replace(/\s*\d+$/, '');
    const used = new Set((d.sections ?? []).map((x) => x.name));
    let n = 2;
    while (used.has(`${base} ${n}`)) n++;
    d.sections!.push({ ...sec, id: uid('s'), name: `${base} ${n}`, start: e });
    sortSections(d);
    growSong(d, e + sec.length);
  });
}

/** Delete a section and its content, closing the gap. */
export function deleteSection(id: string, keepContent = false): void {
  const p = useStore.getState().project;
  const sec = p?.sections?.find((x) => x.id === id);
  if (!p || !sec) return;
  commit((d) => {
    d.sections = (d.sections ?? []).filter((x) => x.id !== id);
    if (keepContent) return;
    collect(d, sec.start, sec.start + sec.length, true);
    shiftFrom(d, sec.start + sec.length, -sec.length);
  });
  useStore.setState({ selectedRegionIds: [] });
}

/** Resize a section marker; `shift` also inserts/removes time after it (moving later material). */
export function resizeSection(id: string, newLength: number, shift: boolean): void {
  const p = useStore.getState().project;
  const sec = p?.sections?.find((x) => x.id === id);
  if (!p || !sec) return;
  const bpb = beatsPerBar(p.timeSig);
  const len = Math.max(bpb, newLength);
  const delta = len - sec.length;
  if (Math.abs(delta) < EPS) return;
  const e = sec.start + sec.length;
  commit((d) => {
    const s = d.sections!.find((x) => x.id === id)!;
    if (shift) {
      if (delta > 0) {
        splitAll(d, e);
        shiftFrom(d, e, delta, id);
      } else {
        collect(d, e + delta, e, true);
        shiftFrom(d, e, delta, id);
      }
      s.length = len;
    } else {
      const next = d.sections!.find((x) => x.start > s.start + EPS && x.id !== id);
      s.length = next ? Math.min(len, next.start - s.start) : len;
    }
    growSong(d, s.start + s.length);
  });
}

export function regionsInSection(p: Project, id: string): string[] {
  const sec = p.sections?.find((x) => x.id === id);
  if (!sec) return [];
  const out: string[] = [];
  for (const t of p.tracks) for (const r of t.regions) if (r.start < sec.start + sec.length - EPS && r.start + r.length > sec.start + EPS) out.push(r.id);
  return out;
}

export function cycleToSection(id: string): void {
  const p = useStore.getState().project;
  const sec = p?.sections?.find((x) => x.id === id);
  if (!sec) return;
  commit((d) => {
    d.loop = { enabled: true, start: sec.start, end: sec.start + sec.length };
  });
}

