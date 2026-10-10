// Drummer track/region operations and automatic regeneration.
import type { Draft } from 'immer';
import type { DrummerSettings, DrummerStyle, MidiRegion, Project } from '../model/types';
import { createMidiRegion, createTrack } from '../model/defaults';
import { beatsPerBar } from '../model/music';
import { defaultDrummerSettings, drummerFor, drummerSig, regenerateDrummerRegion } from '../model/drummer';
import { commit, draftRegion, live, useStore } from './store';
import { growSong, nextTrackName } from './actions';

/** Regenerate a drummer region inside a draft. */
function regen(d: Draft<Project>, r: Draft<MidiRegion>): void {
  regenerateDrummerRegion(d as unknown as Project, r as unknown as MidiRegion);
}

export function createDrummerTrack(style: DrummerStyle, bars = 8): string {
  const p = useStore.getState().project;
  if (!p) return '';
  const who = drummerFor(style);
  const t = createTrack('drums', who.kit, nextTrackName(p, `${who.name} (${who.genre})`), 0);
  t.drummer = { style };
  t.color = '#e8b92a';
  const bpb = beatsPerBar(p.timeSig);
  const s = useStore.getState();
  const start = Math.floor(s.cursor / bpb) * bpb;
  const r = createMidiRegion(start, bars * bpb, [], who.genre);
  r.drummer = defaultDrummerSettings(style);
  const sel = s.selectedTrackId;
  commit((d) => {
    regenerateDrummerRegion(d as unknown as Project, r);
    const i = d.tracks.findIndex((x) => x.id === sel);
    t.regions.push(r);
    if (i >= 0) d.tracks.splice(i + 1, 0, t);
    else d.tracks.push(t);
    growSong(d, r.start + r.length);
  });
  useStore.setState({ selectedTrackId: t.id, selectedRegionIds: [r.id], editingRegionId: r.id, dockTab: 'editor', editorMode: 'drummer' });
  return t.id;
}

/** Add a new drummer region on a drummer track (at a beat), continuing the last region's settings. */
export function addDrummerRegion(trackId: string, start: number, length?: number): string | null {
  const p = useStore.getState().project;
  const t = p?.tracks.find((x) => x.id === trackId);
  if (!p || !t || !t.drummer) return null;
  const bpb = beatsPerBar(p.timeSig);
  const prev = [...t.regions].reverse().find((r) => r.kind === 'midi' && r.drummer) as MidiRegion | undefined;
  const r = createMidiRegion(Math.floor(start / bpb) * bpb, length ?? 8 * bpb, [], drummerFor(t.drummer.style).genre);
  r.drummer = { ...(prev?.drummer ?? defaultDrummerSettings(t.drummer.style)), seed: Math.floor(Math.random() * 1e9) };
  commit((d) => {
    regenerateDrummerRegion(d as unknown as Project, r);
    d.tracks.find((x) => x.id === trackId)?.regions.push(r);
    growSong(d, r.start + r.length);
  });
  useStore.setState({ selectedRegionIds: [r.id], editingRegionId: r.id });
  return r.id;
}

/** Change drummer settings. Use `gesture` mode (live) while dragging the XY pad etc. */
export function updateDrummer(regionId: string, patch: Partial<DrummerSettings>, mode: 'commit' | 'live' = 'commit'): void {
  const fn = mode === 'commit' ? commit : live;
  fn((d) => {
    const r = draftRegion(d, regionId);
    if (r?.kind !== 'midi' || !r.drummer) return;
    Object.assign(r.drummer, patch);
    if (patch.pieces) r.drummer.pieces = { ...patch.pieces };
    regen(d, r);
  });
}

/** Switch the drummer (genre) of a track: updates the kit and all its drummer regions. */
export function setTrackDrummer(trackId: string, style: DrummerStyle): void {
  const who = drummerFor(style);
  commit((d) => {
    const t = d.tracks.find((x) => x.id === trackId);
    if (!t) return;
    const old = t.drummer ? drummerFor(t.drummer.style) : null;
    t.drummer = { style };
    t.instrument = who.kit;
    t.instrumentParams = {};
    if (!old || t.name.startsWith(old.name)) t.name = `${who.name} (${who.genre})`;
    for (const r of t.regions) {
      if (r.kind !== 'midi' || !r.drummer) continue;
      const swingDefault = defaultDrummerSettings(style).swing;
      r.drummer.style = style;
      r.drummer.swing = swingDefault;
      if (old && r.name === old.genre) r.name = who.genre;
      regen(d, r);
    }
  });
}

/** Turn a drummer region into a plain editable MIDI region. */
export function convertDrummerRegion(regionId: string): void {
  commit((d) => {
    const r = draftRegion(d, regionId);
    if (r?.kind === 'midi') delete r.drummer;
  });
  useStore.setState({ editorMode: 'pianoroll' });
}

/** Turn an ordinary drum track into a drummer track. */
export function makeDrummerTrack(trackId: string, style: DrummerStyle): void {
  commit((d) => {
    const t = d.tracks.find((x) => x.id === trackId);
    if (t) t.drummer = { style };
  });
}

// ------------------------------------------------------------------ auto-regeneration

let installed = false;
let pending = false;

function staleRegions(p: Project): string[] {
  const out: string[] = [];
  for (const t of p.tracks)
    for (const r of t.regions) {
      if (r.kind !== 'midi' || !r.drummer) continue;
      if (r.drummer.sig !== drummerSig(p, r)) out.push(r.id);
    }
  return out;
}

/** Keep drummer regions in sync when they are moved, resized, or the song structure changes. */
export function installDrummerSync(): void {
  if (installed) return;
  installed = true;
  useStore.subscribe((s, prev) => {
    if (!s.project || s.project === prev.project || pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      const p = useStore.getState().project;
      if (!p) return;
      const stale = staleRegions(p);
      if (!stale.length) return;
      live((d) => {
        for (const id of stale) {
          const r = draftRegion(d, id);
          if (r?.kind === 'midi' && r.drummer) regen(d, r);
        }
      });
    });
  });
}
installDrummerSync();
