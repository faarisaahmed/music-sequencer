// Pure, entity-level project sync: diff two projects into a small delta, apply deltas,
// and hash a project canonically so peers can verify they hold identical state.
//
// Entities:
//   fields  — top-level project fields (whole value each: bpm, key, chords, sections…)
//   tracks  — track "shells" (a track without its regions), keyed by id, plus track order
//   regions — keyed by id, each tagged with the track it lives on
import type { Project, Region, Track } from '../model/types';

export type TrackShell = Omit<Track, 'regions'>;

export interface Delta {
  fields?: Record<string, unknown>;
  tracks?: TrackShell[];
  removedTracks?: string[];
  order?: string[];
  regions?: { trackId: string; region: Region }[];
  removedRegions?: string[];
}

/** Top-level fields that are never synced. */
const SKIP_FIELDS = new Set(['id', 'tracks', 'createdAt', 'updatedAt']);

function shellOf(t: Track): TrackShell {
  const { regions: _regions, ...shell } = t;
  void _regions;
  return shell;
}

function shellChanged(a: Track, b: Track): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'regions') continue;
    if ((a as unknown as Record<string, unknown>)[k] !== (b as unknown as Record<string, unknown>)[k]) return true;
  }
  return false;
}

/** Diff prev → next. Relies on structural sharing: unchanged entities are the same object. */
export function computeDelta(prev: Project, next: Project): Delta | null {
  if (prev === next) return null;
  const d: Delta = {};
  let any = false;

  for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (SKIP_FIELDS.has(k)) continue;
    const a = (prev as unknown as Record<string, unknown>)[k];
    const b = (next as unknown as Record<string, unknown>)[k];
    if (a !== b) {
      (d.fields ??= {})[k] = b === undefined ? null : b;
      any = true;
    }
  }

  if (prev.tracks !== next.tracks) {
    const prevById = new Map(prev.tracks.map((t) => [t.id, t]));
    const nextIds = new Set(next.tracks.map((t) => t.id));
    // Region location in prev, to detect regions removed or moved between tracks.
    const prevRegionTrack = new Map<string, string>();
    for (const t of prev.tracks) for (const r of t.regions) prevRegionTrack.set(r.id, t.id);
    const nextRegionIds = new Set<string>();

    for (const t of next.tracks) {
      const p = prevById.get(t.id);
      if (!p || shellChanged(p, t)) {
        (d.tracks ??= []).push(shellOf(t));
        any = true;
      }
      if (p && p.regions === t.regions) {
        for (const r of t.regions) nextRegionIds.add(r.id);
        continue;
      }
      const prevRegions = new Map((p?.regions ?? []).map((r) => [r.id, r]));
      for (const r of t.regions) {
        nextRegionIds.add(r.id);
        if (prevRegions.get(r.id) !== r || prevRegionTrack.get(r.id) !== t.id) {
          (d.regions ??= []).push({ trackId: t.id, region: r });
          any = true;
        }
      }
    }
    for (const t of prev.tracks) {
      if (!nextIds.has(t.id)) {
        (d.removedTracks ??= []).push(t.id);
        any = true;
      }
    }
    for (const [rid, tid] of prevRegionTrack) {
      // A region that disappeared (and whose track wasn't removed wholesale) was deleted.
      if (!nextRegionIds.has(rid) && nextIds.has(tid)) {
        (d.removedRegions ??= []).push(rid);
        any = true;
      }
    }
    const prevOrder = prev.tracks.map((t) => t.id).join(',');
    const nextOrder = next.tracks.map((t) => t.id).join(',');
    if (prevOrder !== nextOrder) {
      d.order = next.tracks.map((t) => t.id);
      any = true;
    }
  }
  return any ? d : null;
}

/** Keys identifying the entities a delta touches (used to protect unacknowledged local edits). */
export function deltaKeys(d: Delta): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(d.fields ?? {})) keys.push('f:' + k);
  for (const t of d.tracks ?? []) keys.push('t:' + t.id);
  for (const id of d.removedTracks ?? []) keys.push('t:' + id);
  if (d.order) keys.push('order');
  for (const r of d.regions ?? []) keys.push('r:' + r.region.id);
  for (const id of d.removedRegions ?? []) keys.push('r:' + id);
  return keys;
}

/** Drop the parts of a delta whose entities are in `skip`. Returns null if nothing is left. */
export function filterDelta(d: Delta, skip: Set<string>): Delta | null {
  if (!skip.size) return d;
  const out: Delta = {};
  let any = false;
  for (const [k, v] of Object.entries(d.fields ?? {})) {
    if (skip.has('f:' + k)) continue;
    (out.fields ??= {})[k] = v;
    any = true;
  }
  for (const t of d.tracks ?? []) {
    if (skip.has('t:' + t.id)) continue;
    (out.tracks ??= []).push(t);
    any = true;
  }
  for (const id of d.removedTracks ?? []) {
    if (skip.has('t:' + id)) continue;
    (out.removedTracks ??= []).push(id);
    any = true;
  }
  if (d.order && !skip.has('order')) {
    out.order = d.order;
    any = true;
  }
  for (const r of d.regions ?? []) {
    if (skip.has('r:' + r.region.id)) continue;
    (out.regions ??= []).push(r);
    any = true;
  }
  for (const id of d.removedRegions ?? []) {
    if (skip.has('r:' + id)) continue;
    (out.removedRegions ??= []).push(id);
    any = true;
  }
  return any ? out : null;
}

/**
 * Apply a delta, returning a new project that shares untouched objects with the input.
 * Written without immer so it is cheap enough to replay over the whole undo history.
 */
export function applyDelta(p: Project, d: Delta): Project {
  let out: Project = p;
  const touch = () => {
    if (out === p) out = { ...p };
  };
  if (d.fields) {
    touch();
    const rec = out as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(d.fields)) {
      if (SKIP_FIELDS.has(k)) continue;
      if (v === null && k !== 'name') delete rec[k];
      else rec[k] = v;
    }
  }
  const hasTrackWork = d.tracks?.length || d.removedTracks?.length || d.order || d.regions?.length || d.removedRegions?.length;
  if (!hasTrackWork) return out;

  let tracks = p.tracks.slice();
  let changed = false;
  const indexOf = (id: string) => tracks.findIndex((t) => t.id === id);

  if (d.removedTracks?.length) {
    const rm = new Set(d.removedTracks);
    const before = tracks.length;
    tracks = tracks.filter((t) => !rm.has(t.id));
    changed ||= tracks.length !== before;
  }
  for (const shell of d.tracks ?? []) {
    const i = indexOf(shell.id);
    if (i >= 0) tracks[i] = { ...shell, regions: tracks[i].regions } as Track;
    else tracks.push({ ...shell, regions: [] } as Track);
    changed = true;
  }
  if (d.removedRegions?.length) {
    const rm = new Set(d.removedRegions);
    tracks = tracks.map((t) => {
      if (!t.regions.some((r) => rm.has(r.id))) return t;
      changed = true;
      return { ...t, regions: t.regions.filter((r) => !rm.has(r.id)) };
    });
  }
  for (const { trackId, region } of d.regions ?? []) {
    const ti = indexOf(trackId);
    if (ti < 0) continue; // track no longer exists here
    // Remove from any other track (moved between tracks).
    tracks = tracks.map((t, i) => {
      if (i === ti || !t.regions.some((r) => r.id === region.id)) return t;
      return { ...t, regions: t.regions.filter((r) => r.id !== region.id) };
    });
    const t = tracks[ti];
    const ri = t.regions.findIndex((r) => r.id === region.id);
    const regions = t.regions.slice();
    if (ri >= 0) regions[ri] = region;
    else regions.push(region);
    tracks[ti] = { ...t, regions };
    changed = true;
  }
  if (d.order) {
    const pos = new Map(d.order.map((id, i) => [id, i]));
    const sorted = tracks.slice().sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
    if (sorted.some((t, i) => t !== tracks[i])) {
      tracks = sorted;
      changed = true;
    }
  }
  if (changed) {
    touch();
    out.tracks = tracks;
  }
  return out;
}

/** Full-state delta (used to seed a brand new host from a client's copy if ever needed). */
export function fullDelta(p: Project): Delta {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!SKIP_FIELDS.has(k)) fields[k] = v;
  return {
    fields,
    tracks: p.tracks.map(shellOf),
    order: p.tracks.map((t) => t.id),
    regions: p.tracks.flatMap((t) => t.regions.map((region) => ({ trackId: t.id, region }))),
  };
}

// ------------------------------------------------------------------ hashing

function stable(v: unknown, out: string[]): void {
  if (v === null || typeof v !== 'object') {
    out.push(v === undefined ? 'null' : JSON.stringify(v));
    return;
  }
  if (Array.isArray(v)) {
    out.push('[');
    for (let i = 0; i < v.length; i++) {
      if (i) out.push(',');
      stable(v[i], out);
    }
    out.push(']');
    return;
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  out.push('{');
  keys.forEach((k, i) => {
    if (i) out.push(',');
    out.push(JSON.stringify(k), ':');
    stable(o[k], out);
  });
  out.push('}');
}

/** Order-insensitive (for regions) canonical serialisation of the synced state. */
export function canonical(p: Project): string {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!SKIP_FIELDS.has(k)) fields[k] = v;
  const tracks = p.tracks.map((t) => ({ ...shellOf(t), regions: t.regions.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }));
  const out: string[] = [];
  stable({ fields, tracks }, out);
  return out.join('');
}

/** 53-bit FNV-style hash of the canonical state, as a short string. */
export function hashProject(p: Project): string {
  const s = canonical(p);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + ':' + s.length.toString(36);
}
