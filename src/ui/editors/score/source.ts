// Turning a song (or one region, or some tracks) into a score model the renderer can draw.
import type { MidiRegion, Note, Project, Track } from '../../../model/types';
import { findRegion } from '../../../state/store';
import { meterOf } from '../../../model/timeline';
import { placedNotes } from '../../../model/regions';
import { getPreset } from '../../../audio/presets';
import { abbreviate, buildScore, notationFor, staffForWritten, transposeKey, type ClefMode, type DisplayMark, type PartInput, type RawNote, type ScoreModel } from './notation';
import type { ChordLabel, RenderOpts } from './render';
import { viewOf, type Placement } from './edits';
import { chordName } from './chords';

export interface PartMeta {
  track: Track;
  placement: Placement;
  transpose: number;
  writtenKey: Project['key'];
  drums: boolean;
}

export interface Source {
  model: ScoreModel;
  parts: PartMeta[];
  firstBar: number;
  chords: ChordLabel[];
  toAbs: (t: number) => number;
  fromAbs: (abs: number) => number | null;
  region?: MidiRegion;
  labels: string[];
  regionIds: string[];
}

export function rawFromNote(n: Note, regionId: string, s: number, e: number, key: string): RawNote {
  return { id: n.id, key, regionId, pitch: n.pitch, s, e, vel: n.velocity, voice: n.voice, artic: n.artic, lyric: n.lyric, grace: n.grace };
}

export function formFor(project: Project, src: Source): RenderOpts['form'] {
  if (!project.navMarks?.length && !project.voltas?.length) return undefined;
  return { marks: project.navMarks ?? [], voltas: project.voltas ?? [], barOffset: src.firstBar - 1 };
}

/** The song's tempo changes in the score's own beats (only those inside what it shows). */
export function tempoMarksFor(project: Project, src: Source): { t: number; bpm: number; ramp?: boolean; faster?: boolean }[] {
  const out: { t: number; bpm: number; ramp?: boolean; faster?: boolean }[] = [];
  let prev = project.bpm;
  let prevBeat = 0;
  for (const c of [...(project.tempoChanges ?? [])].sort((a, b) => a.beat - b.beat)) {
    // A gradual change is marked where it starts ("accel." … to the new tempo).
    const t = src.fromAbs(c.ramp ? prevBeat : c.beat);
    if (t !== null) out.push({ t, bpm: c.bpm, ramp: c.ramp, faster: c.bpm > prev });
    prev = c.bpm;
    prevBeat = c.beat;
  }
  return out;
}

/**
 * Build the notation source for a single region, or the whole song (optionally only some
 * tracks, e.g. one instrument's part).
 */
export function buildSource(project: Project, full: boolean, regionId: string | undefined, grid: number, clefMode: ClefMode, concert: boolean, onlyTracks?: string[]): Source | null {
  const meter = meterOf(project);
  let bpb = meter.lenAt(0);
  const mkPart = (track: Track, raw: RawNote[], marks: DisplayMark[], mode: ClefMode, placementBase: Omit<Placement, 'staffOf'>, splits: PartInput['splits'] = []) => {
    const drums = track.type === 'drums';
    const preset = getPreset(track.instrument);
    const nt = notationFor(track.instrument, drums, raw.map((n) => n.pitch), mode, concert, preset.range);
    const writtenKey = transposeKey(project.key, nt.transpose);
    const staffOf = (p: number) => (drums ? 0 : staffForWritten(p + nt.transpose, nt.clefs));
    const input: PartInput = {
      id: track.id,
      trackId: track.id,
      name: track.name,
      abbr: abbreviate(track.name),
      clefs: nt.clefs,
      transpose: nt.transpose,
      writtenKey,
      drums,
      notes: raw,
      marks,
      splits,
    };
    const meta: PartMeta = { track, placement: { ...placementBase, staffOf }, transpose: nt.transpose, writtenKey, drums };
    return { input, meta, label: track.name + (nt.transLabel ? ` ${nt.transLabel}` : '') };
  };

  if (!full) {
    const found = findRegion(project, regionId ?? null);
    if (!found || found.region.kind !== 'midi') return null;
    const region = found.region;
    const track = found.track;
    const { viewStart, viewLen } = viewOf(region);
    // Bars counted from where this region's score starts.
    const origin = region.start - (region.loop ? region.offset : 0);
    const rm = meter.relativeTo(origin);
    bpb = rm.lenAt(0);
    const raw: RawNote[] = [];
    for (const n of region.notes) {
      const t = n.start - viewStart;
      if (t < -1e-6 || t >= viewLen - 1e-6) continue;
      raw.push(rawFromNote(n, region.id, t, t + n.duration, n.id));
    }
    const marks: DisplayMark[] = (region.marks ?? []).map((m) => ({ kind: m.kind, t: m.beat - viewStart, end: m.end !== undefined ? m.end - viewStart : undefined, value: m.value, staff: m.staff ?? 0, id: m.id, regionId: region.id }));
    const splits = (region.restSplits ?? []).map((x) => ({ t: x.beat - viewStart, staff: x.staff, voice: x.voice })).filter((x) => x.t > 0 && x.t < viewLen + bpb);
    const p = mkPart(track, raw, marks, clefMode, { mode: 'region', trackId: track.id, regionId: region.id }, splits);
    const toAbs = (t: number) => region.start + t - (region.loop ? region.offset : 0);
    const fromAbs = (a: number) => a - region.start + (region.loop ? region.offset : 0);
    const chords: ChordLabel[] = (project.chords ?? [])
      .map((c) => ({ t: fromAbs(c.beat), name: chordName(c, p.meta.writtenKey) }))
      .filter((c) => c.t >= -1e-6 && c.t < viewLen + bpb);
    const model = buildScore([p.input], rm, viewLen, 1, grid);
    return {
      model,
      parts: [p.meta],
      firstBar: meter.barAt(origin + 1e-9).bar + 1,
      chords,
      toAbs,
      fromAbs: (a) => {
        const rel = a - region.start;
        if (rel < 0 || rel >= region.length) return null;
        return region.loop ? (((rel + region.offset) % region.contentLength) + region.contentLength) % region.contentLength : rel;
      },
      region,
      labels: [p.label],
      regionIds: [region.id],
    };
  }

  const tracks = project.tracks.filter((t) => t.type !== 'audio' && (!onlyTracks || onlyTracks.includes(t.id)));
  if (!tracks.length) return null;
  let total = meter.barStart(4);
  const built = tracks.map((track) => {
    const raw: RawNote[] = [];
    const marks: DisplayMark[] = [];
    const splits: NonNullable<PartInput['splits']> = [];
    for (const r of track.regions) {
      if (r.kind !== 'midi' || r.muted) continue;
      const iters = r.loop ? Math.ceil((r.offset + r.length) / r.contentLength) + 1 : 1;
      for (const sp of r.restSplits ?? [])
        for (let k = 0; k < iters; k++) {
          const t = r.start - r.offset + k * (r.loop ? r.contentLength : 0) + sp.beat;
          if (t > r.start && t < r.start + r.length) splits.push({ t, staff: sp.staff, voice: sp.voice });
        }
      total = Math.max(total, r.start + r.length);
      for (const pn of placedNotes(r)) raw.push(rawFromNote(pn.note, r.id, pn.start, pn.start + pn.duration, `${pn.note.id}@${pn.iteration}`));
      for (const m of r.marks ?? []) {
        const iters = r.loop ? Math.ceil((r.offset + r.length) / r.contentLength) + 1 : 1;
        for (let k = 0; k < iters; k++) {
          const base = r.start - r.offset + k * (r.loop ? r.contentLength : 0);
          const t = base + m.beat;
          if (t < r.start - 1e-6 || t >= r.start + r.length) continue;
          marks.push({ kind: m.kind, t, end: m.end !== undefined ? Math.min(base + m.end, r.start + r.length) : undefined, value: m.value, staff: m.staff ?? 0, id: m.id, regionId: r.id });
        }
      }
    }
    return mkPart(track, raw, marks, 'auto', { mode: 'song', trackId: track.id }, splits);
  });
  const model = buildScore(
    built.map((b) => b.input),
    meter,
    total,
    1,
    grid,
  );
  return {
    model,
    parts: built.map((b) => b.meta),
    firstBar: 1,
    chords: (project.chords ?? []).map((c) => ({ t: c.beat, name: chordName(c, project.key) })),
    toAbs: (t) => t,
    fromAbs: (a) => a,
    labels: built.map((b) => b.label),
    regionIds: tracks.flatMap((t) => t.regions.map((r) => r.id)),
  };
}

