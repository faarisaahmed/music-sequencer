// High-level editing operations shared across views.
import { current, isDraft, type Draft } from 'immer';
import type { MidiRegion, Note, Project, Region, Track, TrackType } from '../model/types';
import { createAudioRegion, createMidiRegion, createProject, createTrack, uid } from '../model/defaults';
import { beatsPerBar, snap } from '../model/music';
import { getPreset } from '../audio/presets';
import { addClip, getClipBlob } from '../audio/audioStore';
import { getEngine } from '../audio/engine';
import { parseMidiFile } from '../audio/export';
import { commit, draftRegion, findRegion, pruneSelection, toast, useStore } from './store';
import { deleteProject, flushSave, loadProject, markSaved, saveProject, projectAudioIds } from './persistence';

// ------------------------------------------------------------------ projects

export async function openProject(p: Project): Promise<void> {
  await flushSave();
  getEngine().stop();
  markSaved(p);
  useStore.setState({
    project: p,
    past: [],
    future: [],
    screen: 'project',
    selectedTrackId: p.tracks[0]?.id ?? null,
    selectedRegionIds: [],
    editingRegionId: null,
    selectedNoteIds: [],
    cursor: 0,
    dockTab: null,
  });
  await getEngine().loadProjectAudio(p);
}

export async function openProjectById(id: string): Promise<void> {
  const p = await loadProject(id);
  if (!p) {
    toast('Could not open that song', 'error');
    return;
  }
  await openProject(migrate(p));
}

/** Fill in fields added in later versions. */
export function migrate(p: Project): Project {
  const base = createProject(p.name);
  return {
    ...base,
    ...p,
    chords: p.chords ?? [],
    tracks: (p.tracks ?? []).map((t) => {
      const fresh = createTrack(t.type, t.instrument, t.name);
      return {
        ...fresh,
        ...t,
        fx: { ...fresh.fx, ...t.fx },
        instrumentParams: t.instrumentParams ?? {},
        regions: (t.regions ?? []).map((r) => (r.kind === 'midi' ? { ...r, notes: r.notes ?? [] } : r)),
        automation: { ...{ volume: [], pan: [] }, ...t.automation },
      };
    }),
  };
}

export async function createNewProject(p: Project): Promise<void> {
  await saveProject(p);
  await openProject(p);
}

export async function closeProject(): Promise<void> {
  getEngine().stop();
  await flushSave();
  useStore.setState({ screen: 'home', project: null, past: [], future: [] });
}

export async function removeProject(id: string): Promise<void> {
  await deleteProject(id);
}

export async function duplicateProjectById(id: string): Promise<void> {
  const p = await loadProject(id);
  if (!p) return;
  const now = Date.now();
  await saveProject({ ...p, id: uid('p'), name: p.name + ' copy', createdAt: now, updatedAt: now });
}

// ------------------------------------------------------------------ tracks

export function nextTrackName(p: Project, base: string): string {
  const names = new Set(p.tracks.map((t) => t.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

export function addTrack(type: TrackType, instrument?: string): string {
  const p = useStore.getState().project;
  if (!p) return '';
  const inst = instrument ?? (type === 'drums' ? 'kit-acoustic' : type === 'audio' ? '' : 'grand-piano');
  const name = type === 'audio' ? 'Audio' : getPreset(inst).name;
  const t = createTrack(type, inst, nextTrackName(p, name), p.tracks.filter((x) => x.type === type).length);
  const sel = useStore.getState().selectedTrackId;
  commit((d) => {
    const i = d.tracks.findIndex((x) => x.id === sel);
    if (i >= 0) d.tracks.splice(i + 1, 0, t);
    else d.tracks.push(t);
  });
  useStore.setState({ selectedTrackId: t.id });
  return t.id;
}

export function deleteTrack(id: string): void {
  commit((d) => {
    d.tracks = d.tracks.filter((t) => t.id !== id);
  });
  pruneSelection();
}

export function duplicateTrack(id: string, withRegions = true): void {
  const p = useStore.getState().project;
  const t = p?.tracks.find((x) => x.id === id);
  if (!p || !t) return;
  const copy: Track = {
    ...structuredClone(t),
    id: uid('t'),
    name: nextTrackName(p, t.name),
    solo: false,
    armed: false,
    regions: withRegions ? t.regions.map((r) => cloneRegion(r)) : [],
  };
  commit((d) => {
    const i = d.tracks.findIndex((x) => x.id === id);
    d.tracks.splice(i + 1, 0, copy);
  });
  useStore.setState({ selectedTrackId: copy.id });
}

export function updateTrack(id: string, recipe: (t: Draft<Track>) => void): void {
  commit((d) => {
    const t = d.tracks.find((x) => x.id === id);
    if (t) recipe(t);
  });
}

export function moveTrack(id: string, toIndex: number): void {
  commit((d) => {
    const i = d.tracks.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [t] = d.tracks.splice(i, 1);
    d.tracks.splice(Math.max(0, Math.min(d.tracks.length, toIndex)), 0, t);
  });
}

export function setTrackInstrument(id: string, instrument: string): void {
  const preset = getPreset(instrument);
  commit((d) => {
    const t = d.tracks.find((x) => x.id === id);
    if (!t) return;
    const oldPreset = getPreset(t.instrument);
    const autoNamed = t.name === oldPreset.name || t.name.startsWith(oldPreset.name + ' ');
    t.instrument = instrument;
    t.instrumentParams = {};
    if (autoNamed) t.name = preset.name;
  });
}

// ------------------------------------------------------------------ regions

export function cloneRegion(r: Region, patch: Partial<Region> = {}): Region {
  const c = structuredClone(isDraft(r) ? current(r) : r) as Region;
  c.id = uid('r');
  if (c.kind === 'midi') c.notes = c.notes.map((n) => ({ ...n, id: uid('n') }));
  return { ...c, ...patch } as Region;
}

export function createEmptyRegion(trackId: string, start: number, length?: number): string | null {
  const p = useStore.getState().project;
  const t = p?.tracks.find((x) => x.id === trackId);
  if (!p || !t || t.type === 'audio') return null;
  const bpb = beatsPerBar(p.timeSig);
  const len = length ?? bpb * (t.type === 'drums' ? 2 : 4);
  const r = createMidiRegion(Math.max(0, Math.floor(start / bpb) * bpb), len, [], t.name);
  commit((d) => {
    d.tracks.find((x) => x.id === trackId)?.regions.push(r);
    growSong(d, r.start + r.length);
  });
  const st = useStore.getState();
  useStore.setState({
    selectedRegionIds: [r.id],
    editingRegionId: r.id,
    selectedTrackId: trackId,
    // Open the editor so the new region can be filled straight away.
    ...(st.dockTab === null || st.dockTab === 'mixer' ? { dockTab: 'editor' as const, editorMode: t.type === 'drums' ? ('steps' as const) : st.editorMode === 'score' ? ('score' as const) : ('pianoroll' as const) } : {}),
  });
  return r.id;
}

export function growSong(d: Draft<Project>, endBeat: number): void {
  const bars = Math.ceil(endBeat / beatsPerBar(d.timeSig)) + 4;
  if (bars > d.lengthBars) d.lengthBars = bars;
}

export function deleteRegions(ids: string[]): void {
  const set = new Set(ids);
  commit((d) => {
    for (const t of d.tracks) t.regions = t.regions.filter((r) => !set.has(r.id));
  });
  pruneSelection();
}

export function duplicateRegions(ids: string[]): void {
  const newIds: string[] = [];
  commit((d) => {
    for (const t of d.tracks) {
      const sel = t.regions.filter((r) => ids.includes(r.id));
      if (!sel.length) continue;
      const lo = Math.min(...sel.map((r) => r.start));
      const hi = Math.max(...sel.map((r) => r.start + r.length));
      for (const r of sel) {
        const c = cloneRegion(r as Region, { start: r.start + (hi - lo) });
        newIds.push(c.id);
        t.regions.push(c as Draft<Region>);
        growSong(d, c.start + c.length);
      }
    }
  });
  useStore.setState({ selectedRegionIds: newIds });
}

/** Split regions at a beat position (all selected regions, or every region under the playhead). */
export function splitRegionsAt(ids: string[], beat: number): void {
  const newSel: string[] = [];
  commit((d) => {
    for (const t of d.tracks) {
      const next: Draft<Region>[] = [];
      for (const r of t.regions) {
        if (ids.length && !ids.includes(r.id)) {
          next.push(r);
          continue;
        }
        if (beat <= r.start + 1e-6 || beat >= r.start + r.length - 1e-6) {
          next.push(r);
          continue;
        }
        const leftLen = beat - r.start;
        const right = cloneRegion(r as Region) as Draft<Region>;
        right.start = beat;
        right.length = r.length - leftLen;
        right.offset = r.offset + leftLen;
        if (r.kind === 'midi' && !r.loop) {
          // Notes belong to the side they start in; trim left notes at the cut.
          const cut = r.offset + leftLen;
          (right as Draft<MidiRegion>).notes = (right as Draft<MidiRegion>).notes.filter((n) => n.start >= cut - 1e-6);
          r.notes = r.notes.filter((n) => n.start < cut - 1e-6);
          for (const n of r.notes) n.duration = Math.min(n.duration, cut - n.start);
        }
        r.length = leftLen;
        next.push(r, right);
        newSel.push(r.id, right.id);
      }
      t.regions = next;
    }
  });
  if (newSel.length) useStore.setState({ selectedRegionIds: newSel });
}

/** Join adjacent MIDI regions on the same track into one. */
export function joinRegions(ids: string[]): void {
  const mergedIds: string[] = [];
  commit((d) => {
    for (const t of d.tracks) {
      const sel = t.regions.filter((r) => ids.includes(r.id) && r.kind === 'midi') as Draft<MidiRegion>[];
      if (sel.length < 2) continue;
      sel.sort((a, b) => a.start - b.start);
      const start = sel[0].start;
      const end = Math.max(...sel.map((r) => r.start + r.length));
      const notes: Note[] = [];
      for (const r of sel) {
        const placed = expandRegionNotes(r as MidiRegion);
        for (const n of placed) notes.push({ ...n, start: n.start - start });
      }
      const merged = createMidiRegion(start, end - start, notes, sel[0].name);
      t.regions = t.regions.filter((r) => !sel.includes(r as Draft<MidiRegion>));
      t.regions.push(merged);
      mergedIds.push(merged.id);
    }
  });
  if (mergedIds.length) useStore.setState({ selectedRegionIds: mergedIds, editingRegionId: mergedIds[0] });
  pruneSelection();
}

/** Absolute-time notes of a region (loop iterations unrolled). */
export function expandRegionNotes(r: MidiRegion): Note[] {
  const out: Note[] = [];
  const end = r.start + r.length;
  const iters = r.loop ? Math.ceil((r.offset + r.length) / r.contentLength) + 1 : 1;
  for (let k = 0; k < iters; k++) {
    const base = r.start - r.offset + k * (r.loop ? r.contentLength : 0);
    for (const n of r.notes) {
      if (r.loop && n.start >= r.contentLength) continue;
      const s = base + n.start;
      if (s < r.start - 1e-6 || s >= end - 1e-6) continue;
      out.push({ ...n, id: uid('n'), start: s, duration: Math.min(n.duration, end - s) });
    }
  }
  return out;
}

export function transposeRegions(ids: string[], semis: number): void {
  commit((d) => {
    for (const id of ids) {
      const r = draftRegion(d, id);
      if (r?.kind === 'midi') for (const n of r.notes) n.pitch = Math.max(0, Math.min(127, n.pitch + semis));
    }
  });
}

export function quantizeNotesIn(regionId: string, grid: number, noteIds?: string[], strength = 1): void {
  commit((d) => {
    const r = draftRegion(d, regionId);
    if (r?.kind !== 'midi') return;
    for (const n of r.notes) {
      if (noteIds && noteIds.length && !noteIds.includes(n.id)) continue;
      const q = snap(n.start, grid);
      n.start = n.start + (q - n.start) * strength;
      const qe = Math.max(grid, snap(n.duration, grid));
      n.duration = n.duration + (qe - n.duration) * strength;
    }
  });
}

export function toggleLoopRegions(ids: string[]): void {
  const p = useStore.getState().project;
  if (!p) return;
  const anyOff = ids.some((id) => {
    const f = findRegion(p, id);
    return f && !f.region.loop;
  });
  commit((d) => {
    for (const id of ids) {
      const r = draftRegion(d, id);
      if (!r) continue;
      r.loop = anyOff;
      if (anyOff) {
        // Loop the currently visible content.
        r.contentLength = Math.max(0.25, r.offset + r.length);
      }
    }
  });
}

// ------------------------------------------------------------------ clipboard

export function copySelection(cut = false): void {
  const s = useStore.getState();
  const p = s.project;
  if (!p) return;
  if (s.selectedRegionIds.length) {
    const items: { trackOffset: number; region: Region }[] = [];
    const trackIdx = (id: string) => p.tracks.findIndex((t) => t.regions.some((r) => r.id === id));
    const baseIdx = Math.min(...s.selectedRegionIds.map(trackIdx).filter((i) => i >= 0));
    let anchor = Infinity;
    for (const id of s.selectedRegionIds) {
      const f = findRegion(p, id);
      if (!f) continue;
      items.push({ trackOffset: trackIdx(id) - baseIdx, region: structuredClone(f.region) });
      anchor = Math.min(anchor, f.region.start);
    }
    useStore.setState({ clipboard: { kind: 'regions', regions: items, anchor } });
    if (cut) deleteRegions(s.selectedRegionIds);
    toast(`${cut ? 'Cut' : 'Copied'} ${items.length} region${items.length > 1 ? 's' : ''}`);
  }
}

export function pasteRegions(at?: number): void {
  const s = useStore.getState();
  const p = s.project;
  const cb = s.clipboard;
  if (!p || !cb || cb.kind !== 'regions' || !cb.regions) return;
  const pos = at ?? s.cursor;
  const baseIdx = Math.max(0, p.tracks.findIndex((t) => t.id === s.selectedTrackId));
  const newIds: string[] = [];
  commit((d) => {
    for (const item of cb.regions!) {
      let t = d.tracks[baseIdx + item.trackOffset];
      // Fall back to a compatible track.
      const wantAudio = item.region.kind === 'audio';
      if (!t || (t.type === 'audio') !== wantAudio) t = d.tracks.find((x) => (x.type === 'audio') === wantAudio) ?? t;
      if (!t || (t.type === 'audio') !== wantAudio) continue;
      const c = cloneRegion(item.region, { start: pos + (item.region.start - cb.anchor) });
      newIds.push(c.id);
      t.regions.push(c as Draft<Region>);
      growSong(d, c.start + c.length);
    }
  });
  useStore.setState({ selectedRegionIds: newIds });
}

// ------------------------------------------------------------------ song settings

export function setBpm(bpm: number): void {
  const v = Math.max(30, Math.min(300, Math.round(bpm)));
  commit((d) => {
    d.bpm = v;
  });
}

/** Change the project key; optionally transpose all pitched MIDI content by the interval. */
export function setKey(tonic: number, mode: 'major' | 'minor', transposeContent: boolean): void {
  const p = useStore.getState().project;
  if (!p) return;
  let delta = tonic - p.key.tonic;
  if (delta > 6) delta -= 12;
  if (delta < -6) delta += 12;
  commit((d) => {
    d.key = { tonic, mode };
    if (transposeContent && delta) {
      for (const t of d.tracks) {
        if (t.type !== 'instrument') continue;
        for (const r of t.regions) if (r.kind === 'midi') for (const n of r.notes) n.pitch = Math.max(0, Math.min(127, n.pitch + delta));
      }
      // Keep the chord track in step with the transposed notes.
      for (const c of d.chords ?? []) {
        c.root = (((c.root + delta) % 12) + 12) % 12;
        if (c.bass !== undefined) c.bass = (((c.bass + delta) % 12) + 12) % 12;
      }
    }
  });
}

export function setTimeSig(num: number, den: number): void {
  commit((d) => {
    d.timeSig = [num, den];
  });
}

// ------------------------------------------------------------------ import

export async function importAudioFile(file: File, trackId?: string, at?: number): Promise<void> {
  const p = useStore.getState().project;
  if (!p) return;
  try {
    const id = uid('a');
    const buf = await addClip(id, file, file.name);
    const spb = 60 / p.bpm;
    const lengthBeats = buf.duration / spb;
    let tid = trackId;
    const target = p.tracks.find((t) => t.id === tid);
    if (!target || target.type !== 'audio') {
      tid = addTrack('audio');
      updateTrack(tid, (t) => {
        t.name = file.name.replace(/\.[^.]+$/, '').slice(0, 24);
      });
    }
    const start = at ?? useStore.getState().cursor;
    commit((d) => {
      const t = d.tracks.find((x) => x.id === tid);
      if (!t) return;
      t.regions.push(createAudioRegion(start, lengthBeats, id, file.name.replace(/\.[^.]+$/, '')));
      growSong(d, start + lengthBeats);
    });
    toast(`Imported ${file.name}`, 'success');
  } catch (e) {
    console.error(e);
    toast(`Could not import ${file.name}`, 'error');
  }
}

/** Map a GM program number to one of our presets. */
function presetForProgram(program: number): string {
  if (program < 4) return 'grand-piano';
  if (program < 6) return 'electric-piano';
  if (program < 8) return 'clav';
  if (program < 16) return program < 12 ? 'music-box' : 'xylophone';
  if (program < 24) return 'organ';
  if (program < 25) return 'nylon-guitar';
  if (program < 26) return 'acoustic-guitar';
  if (program < 32) return 'electric-guitar';
  if (program < 38) return program === 32 ? 'upright-bass' : 'electric-bass';
  if (program < 40) return 'synth-bass';
  if (program === 40 || program === 41) return 'violin';
  if (program < 44) return 'cello';
  if (program === 46) return 'harp';
  if (program < 52) return 'string-ensemble';
  if (program < 56) return 'choir';
  if (program < 57) return 'trumpet';
  if (program < 58) return 'trombone';
  if (program < 59) return 'tuba';
  if (program < 61) return 'french-horn';
  if (program < 64) return 'brass-section';
  if (program < 68) return 'saxophone';
  if (program < 71) return 'bassoon';
  if (program < 72) return 'clarinet';
  if (program < 80) return 'flute';
  if (program < 88) return 'analog-lead';
  if (program < 96) return 'warm-pad';
  return 'dream-pad';
}

export async function importMidiFile(file: File, intoCurrent: boolean): Promise<void> {
  try {
    const m = await parseMidiFile(file);
    const build = (d: Draft<Project> | Project) => {
      for (const mt of m.tracks) {
        const type: TrackType = mt.drums ? 'drums' : 'instrument';
        const inst = mt.drums ? 'kit-acoustic' : presetForProgram(mt.program);
        const t = createTrack(type, inst, mt.name.slice(0, 24) || getPreset(inst).name, d.tracks.length);
        const end = Math.max(...mt.notes.map((n) => n.start + n.duration));
        const bpb = beatsPerBar(d.timeSig);
        const len = Math.max(bpb, Math.ceil(end / bpb) * bpb);
        t.regions.push(createMidiRegion(0, len, mt.notes.map((n) => ({ ...n, id: uid('n') })), t.name));
        d.tracks.push(t);
        const bars = Math.ceil(len / bpb) + 4;
        if (bars > d.lengthBars) d.lengthBars = bars;
      }
    };
    if (intoCurrent && useStore.getState().project) {
      commit((d) => build(d));
    } else {
      const p = createProject(file.name.replace(/\.midi?$/i, ''));
      p.bpm = m.bpm;
      p.timeSig = m.timeSig;
      build(p);
      await createNewProject(p);
    }
    toast(`Imported ${m.tracks.length} MIDI track${m.tracks.length === 1 ? '' : 's'}`, 'success');
  } catch (e) {
    console.error(e);
    toast('Could not read that MIDI file', 'error');
  }
}

// ------------------------------------------------------------------ project file export/import

export async function exportProjectFile(p: Project): Promise<Blob> {
  const audio: Record<string, { name: string; type: string; data: string }> = {};
  for (const id of projectAudioIds(p)) {
    const rec = await getClipBlob(id);
    if (!rec) continue;
    const buf = new Uint8Array(await rec.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    audio[id] = { name: rec.name, type: rec.blob.type, data: btoa(bin) };
  }
  return new Blob([JSON.stringify({ format: 'bandforge', version: 1, project: p, audio })], { type: 'application/json' });
}

export async function importProjectFile(file: File): Promise<void> {
  try {
    const json = JSON.parse(await file.text());
    if (json.format !== 'bandforge') throw new Error('not a project');
    for (const [id, a] of Object.entries(json.audio ?? {}) as [string, { name: string; type: string; data: string }][]) {
      const bin = atob(a.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await addClip(id, new Blob([bytes], { type: a.type }), a.name);
    }
    const p = migrate(json.project as Project);
    p.id = uid('p');
    await createNewProject(p);
    toast(`Opened ${p.name}`, 'success');
  } catch (e) {
    console.error(e);
    toast('That file is not a BandForge project', 'error');
  }
}
