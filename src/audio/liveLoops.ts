// Live Loops: GarageBand-style cell launching. A scheduler that takes over from the
// timeline while the grid view is shown, sharing the engine's transport clock,
// mixer channels and instruments (so track volume / FX / mute / solo all apply).
import { create } from 'zustand';
import type { Draft } from 'immer';
import type { LiveCell, LiveLoops, Note, Project, Region } from '../model/types';
import { beatsPerBar } from '../model/music';
import { placedNotes } from '../model/regions';
import { uid } from '../model/defaults';
import { commit, toast, useStore } from '../state/store';
import { cloneRegion, growSong } from '../state/actions';
import { getEngine, type LiveScheduler } from './engine';
import type { Mixer } from './mixer';
import { scheduleRange, type ActiveSource } from './schedule';

// ------------------------------------------------------------------ runtime state

export interface PlayingCell {
  cellId: string;
  /** Transport beat where the loop's first cycle began. */
  start: number;
}

export interface CellRecording {
  trackId: string;
  scene: number;
  start: number;
  end: number;
  bars: number;
}

interface LiveState {
  playing: Record<string, PlayingCell>;
  /** Pending launch per track: cellId to start, or null to stop. */
  queued: Record<string, { cellId: string | null; at: number }>;
  recording: CellRecording | null;
  /** Selected cell (for keyboard / record-into-cell). */
  selected: { trackId: string; scene: number } | null;
}

export const useLive = create<LiveState>(() => ({ playing: {}, queued: {}, recording: null, selected: null }));

export const DEFAULT_SCENES = 8;

export function emptyLiveLoops(p: { timeSig: [number, number] }, scenes = DEFAULT_SCENES): LiveLoops {
  return {
    scenes: Array.from({ length: scenes }, (_, i) => ({ id: uid('s'), name: String(i + 1) })),
    cells: [],
    quantize: beatsPerBar(p.timeSig),
  };
}

export function ensureLiveLoops(d: Draft<Project>): Draft<LiveLoops> {
  if (!d.liveLoops) d.liveLoops = emptyLiveLoops(d) as Draft<LiveLoops>;
  return d.liveLoops;
}

export function cellAt(p: Project | null, trackId: string, scene: number): LiveCell | undefined {
  return p?.liveLoops?.cells.find((c) => c.trackId === trackId && c.scene === scene);
}

function findCell(p: Project | null, cellId: string): LiveCell | undefined {
  return p?.liveLoops?.cells.find((c) => c.id === cellId);
}

/** Loop length of a cell in beats. */
export function cellLength(c: LiveCell): number {
  return Math.max(0.25, c.region.length);
}

// ------------------------------------------------------------------ performance capture

interface PerfSpan {
  trackId: string;
  cellId: string;
  cellStart: number;
  from: number;
  to?: number;
}

let perf: PerfSpan[] | null = null;
let perfStart = 0;
let perfProject: Project | null = null;

function perfOpen(trackId: string, cellId: string, cellStart: number, from: number): void {
  if (!perf) return;
  perf.push({ trackId, cellId, cellStart, from: Math.max(from, perfStart) });
}

function perfClose(trackId: string, at: number): void {
  if (!perf) return;
  for (const s of perf) if (s.trackId === trackId && s.to === undefined) s.to = Math.max(at, s.from);
}

/** Write everything that played during the take into the Tracks timeline. */
function commitPerformance(endBeat: number): void {
  const spans = perf;
  const p = perfProject ?? useStore.getState().project;
  perf = null;
  if (!spans || !p) return;
  for (const s of spans) if (s.to === undefined) s.to = Math.max(endBeat, s.from);
  const done = spans.filter((s) => (s.to ?? 0) - s.from > 0.05);
  if (!done.length) return;
  commit((d) => {
    for (const s of done) {
      const cell = d.liveLoops?.cells.find((c) => c.id === s.cellId);
      const t = d.tracks.find((x) => x.id === s.trackId);
      if (!cell || !t) continue;
      const L = Math.max(0.25, cell.region.length);
      const r = cloneRegion(cell.region as Region) as Draft<Region>;
      const phase = (((s.from - s.cellStart) % L) + L) % L;
      r.start = s.from;
      r.length = (s.to ?? s.from) - s.from;
      r.loop = true;
      if (!cell.region.loop) r.contentLength = L;
      r.offset = r.loop && cell.region.loop ? phase % r.contentLength : phase;
      t.regions.push(r);
      growSong(d, r.start + r.length);
    }
  });
  toast(`Performance recorded — ${done.length} region${done.length > 1 ? 's' : ''} added to Tracks`, 'success');
}

// ------------------------------------------------------------------ record into cell

let cellRecNotes: Note[] = [];
const cellRecPending = new Map<number, { start: number; velocity: number }>();
let unsubLive: (() => void) | null = null;

function onLiveNote(pitch: number, on: boolean, trackId: string, velocity?: number): void {
  const rec = useLive.getState().recording;
  if (!rec || trackId !== rec.trackId) return;
  const pos = getEngine().position;
  if (on) {
    if (pos >= rec.start - 0.2 && pos < rec.end) cellRecPending.set(pitch, { start: Math.max(rec.start, pos), velocity: velocity ?? useStore.getState().velocity });
  } else {
    const pend = cellRecPending.get(pitch);
    if (!pend) return;
    cellRecPending.delete(pitch);
    cellRecNotes.push({ id: uid('n'), pitch, start: pend.start, duration: Math.max(0.05, Math.min(pos, rec.end) - pend.start), velocity: pend.velocity });
  }
}

/** Arm a cell to record the selected track's live playing for `bars` bars, then loop it. */
export async function recordIntoCell(trackId: string, scene: number, bars: number): Promise<void> {
  const s = useStore.getState();
  const p = s.project;
  const track = p?.tracks.find((t) => t.id === trackId);
  if (!p || !track) return;
  if (track.type === 'audio') {
    toast('Record into cells works with instrument and drum tracks', 'error');
    return;
  }
  const engine = getEngine();
  const bpb = beatsPerBar(p.timeSig);
  let start: number;
  if (!engine.isPlaying) {
    const from = Math.floor(s.cursor / bpb) * bpb;
    start = from + bpb; // one bar lead-in
    await engine.play(from);
  } else {
    start = Math.ceil((engine.position + 0.05) / bpb) * bpb;
  }
  cellRecNotes = [];
  cellRecPending.clear();
  unsubLive?.();
  unsubLive = engine.onLive(onLiveNote);
  useStore.setState({ selectedTrackId: trackId });
  useLive.setState({ recording: { trackId, scene, start, end: start + bars * bpb, bars }, selected: { trackId, scene } });
  toast(`Recording ${bars} bar${bars > 1 ? 's' : ''} into the cell — play on the keyboard`, 'info');
}

export function cancelCellRecording(): void {
  unsubLive?.();
  unsubLive = null;
  cellRecPending.clear();
  useLive.setState({ recording: null });
}

/** Called from the scheduler once the transport passes the end of the take. */
function finishCellRecording(rec: CellRecording): string | null {
  for (const [pitch, pend] of cellRecPending) cellRecNotes.push({ id: uid('n'), pitch, start: pend.start, duration: Math.max(0.05, rec.end - pend.start), velocity: pend.velocity });
  cellRecPending.clear();
  unsubLive?.();
  unsubLive = null;
  const notes = cellRecNotes.map((n) => ({ ...n, start: n.start - rec.start })).filter((n) => n.start >= 0 && n.start < rec.end - rec.start);
  cellRecNotes = [];
  useLive.setState({ recording: null });
  if (!notes.length) {
    toast('Nothing was played — cell left unchanged');
    return null;
  }
  const len = rec.end - rec.start;
  let cellId: string | null = null;
  commit((d) => {
    const ll = ensureLiveLoops(d);
    const t = d.tracks.find((x) => x.id === rec.trackId);
    if (!t) return;
    let cell = ll.cells.find((c) => c.trackId === rec.trackId && c.scene === rec.scene);
    if (cell && cell.region.kind === 'midi') {
      // Overdub: merge into the existing loop.
      const L = cell.region.length;
      for (const n of notes) cell.region.notes.push({ ...n, start: n.start % L });
    } else {
      const region: Region = { id: uid('r'), kind: 'midi', name: t.name, start: 0, length: len, offset: 0, loop: false, contentLength: len, notes };
      if (cell) cell.region = region as Draft<Region>;
      else {
        cell = { id: uid('l'), trackId: rec.trackId, scene: rec.scene, region } as Draft<LiveCell>;
        ll.cells.push(cell);
      }
    }
    cellId = cell!.id;
  });
  toast(`Recorded ${notes.length} notes into the cell`, 'success');
  return cellId;
}

// ------------------------------------------------------------------ scheduler

/** Schedule one cell's loop over [x0, x1) for a loop that began at `start`. */
function scheduleCell(p: Project, mixer: Mixer, cell: LiveCell, start: number, x0: number, x1: number, toTime: (b: number) => number, fresh: boolean, limit: number, sources: ActiveSource[]): void {
  if (x1 <= x0) return;
  const track = p.tracks.find((t) => t.id === cell.trackId);
  if (!track) return;
  const L = cellLength(cell);
  const kFirst = Math.max(0, Math.floor((x0 - start) / L - 1e-9));
  const kLast = Math.floor((x1 - start) / L - 1e-9);
  const regions: Region[] = [];
  for (let k = kFirst; k <= kLast; k++) regions.push({ ...cell.region, id: cell.region.id + ':' + k, start: start + k * L, length: L, muted: false } as Region);
  const mini: Project = {
    ...p,
    tracks: [{ ...track, regions, automation: { volume: [], pan: [] } }],
    masterAutomation: [],
  };
  scheduleRange(mini, mixer, x0, x1, toTime, { fresh, limit, sources });
}

export const liveScheduler: LiveScheduler = {
  schedule(p, mixer, b0, b1, toTime, fresh, sources) {
    const st = useLive.getState();
    let playing = st.playing;
    let queued = st.queued;
    let changed = false;

    // Finish a record-into-cell take once the transport has passed its end.
    if (st.recording && b0 >= st.recording.end - 1e-6) {
      const rec = st.recording;
      const id = finishCellRecording(rec);
      if (id) {
        playing = { ...playing, [rec.trackId]: { cellId: id, start: rec.end } };
        perfOpen(rec.trackId, id, rec.end, rec.end);
        changed = true;
      }
      p = useStore.getState().project ?? p;
    }

    for (const track of p.tracks) {
      const tid = track.id;
      const cur = playing[tid];
      const q = queued[tid];
      const curCell = cur ? findCell(p, cur.cellId) : undefined;
      if (q && q.at < b1) {
        const at = Math.max(q.at, b0);
        if (curCell && cur) scheduleCell(p, mixer, curCell, cur.start, b0, at, toTime, fresh, at, sources);
        const next = q.cellId ? findCell(p, q.cellId) : undefined;
        const rest = { ...queued };
        delete rest[tid];
        queued = rest;
        perfClose(tid, q.at);
        if (next) {
          playing = { ...playing, [tid]: { cellId: next.id, start: q.at } };
          perfOpen(tid, next.id, q.at, q.at);
          scheduleCell(p, mixer, next, q.at, at, b1, toTime, true, Infinity, sources);
        } else {
          const rest2 = { ...playing };
          delete rest2[tid];
          playing = rest2;
          // Let ringing notes end promptly when the row stops.
          mixer.channels.get(tid)?.instrument?.allNotesOff(toTime(q.at) + 0.05);
        }
        changed = true;
      } else if (curCell && cur) {
        scheduleCell(p, mixer, curCell, cur.start, b0, b1, toTime, fresh, Infinity, sources);
      } else if (cur && !curCell) {
        const rest2 = { ...playing };
        delete rest2[tid];
        playing = rest2;
        changed = true;
      }
    }
    if (changed) useLive.setState({ playing, queued });
  },
  onStop(pos: number) {
    if (perf) commitPerformance(pos);
    if (useLive.getState().recording) cancelCellRecording();
    useLive.setState({ playing: {}, queued: {} });
  },
};

// Start / finish performance capture alongside the transport's record button.
useStore.subscribe((s, prev) => {
  if (s.mainView !== 'liveloops') return;
  if (s.recording && !prev.recording) {
    const info = getEngine().recordingInfo;
    perfStart = info ? info.startBeat : s.cursor;
    perfProject = null;
    perf = [];
    // Playing loops restart in phase with the take.
    const playing: Record<string, PlayingCell> = {};
    for (const [tid, pc] of Object.entries(useLive.getState().playing)) {
      playing[tid] = { cellId: pc.cellId, start: perfStart };
      perfOpen(tid, pc.cellId, perfStart, perfStart);
    }
    useLive.setState({ playing });
  }
  if (perf) perfProject = s.project;
});

// ------------------------------------------------------------------ triggering

function launchBeat(p: Project): number {
  const engine = getEngine();
  const q = p.liveLoops?.quantize ?? beatsPerBar(p.timeSig);
  const pos = engine.position;
  if (q <= 0) return pos + 0.02;
  return Math.ceil((pos + 0.02) / q - 1e-9) * q;
}

async function ensureRunning(p: Project): Promise<number | null> {
  const engine = getEngine();
  if (engine.isPlaying) return null;
  const bpb = beatsPerBar(p.timeSig);
  const from = Math.floor(useStore.getState().cursor / bpb) * bpb;
  return from;
}

/** Queue launches/stops; starts the transport if needed (launching immediately). */
async function applyQueue(changes: Record<string, string | null>): Promise<void> {
  const p = useStore.getState().project;
  if (!p) return;
  const engine = getEngine();
  const from = await ensureRunning(p);
  const st = useLive.getState();
  const queued = { ...st.queued };
  if (from !== null) {
    // Transport stopped: everything starts together right away.
    const playing: Record<string, PlayingCell> = {};
    for (const [tid, cellId] of Object.entries(changes)) if (cellId) queued[tid] = { cellId, at: from };
    useLive.setState({ queued, playing });
    if (Object.values(changes).some(Boolean)) await engine.play(from);
    return;
  }
  const at = launchBeat(p);
  for (const [tid, cellId] of Object.entries(changes)) {
    if (cellId === null && !st.playing[tid]) {
      delete queued[tid];
      continue;
    }
    queued[tid] = { cellId, at };
  }
  useLive.setState({ queued });
}

/** Tap a cell: start it (replacing whatever plays in its row), or stop it if it's playing. */
export function triggerCell(cellId: string): void {
  const p = useStore.getState().project;
  const cell = findCell(p, cellId);
  if (!cell) return;
  const st = useLive.getState();
  const isPlaying = st.playing[cell.trackId]?.cellId === cellId;
  const q = st.queued[cell.trackId];
  if (q && q.cellId === cellId) {
    // Tapping a queued cell again cancels the launch.
    const rest = { ...st.queued };
    delete rest[cell.trackId];
    useLive.setState({ queued: rest });
    return;
  }
  void applyQueue({ [cell.trackId]: isPlaying ? null : cellId });
}

/** Launch a whole scene (column); rows without a cell in it stop. */
export function triggerScene(scene: number): void {
  const p = useStore.getState().project;
  if (!p) return;
  const changes: Record<string, string | null> = {};
  for (const t of p.tracks) {
    const c = cellAt(p, t.id, scene);
    changes[t.id] = c ? c.id : null;
  }
  void applyQueue(changes);
}

export function stopRow(trackId: string): void {
  void applyQueue({ [trackId]: null });
}

export function stopAllCells(): void {
  const p = useStore.getState().project;
  if (!p) return;
  const changes: Record<string, string | null> = {};
  for (const tid of Object.keys(useLive.getState().playing)) changes[tid] = null;
  void applyQueue(changes);
}

// ------------------------------------------------------------------ editing cells

/** Normalise any region into cell form: starts at 0, one loop cycle long, offset 0. */
export function regionToCell(r: Region, bpb: number): Region {
  const cycle = r.loop ? r.contentLength : r.length;
  const L = Math.max(bpb, Math.ceil(cycle / bpb - 1e-6) * bpb);
  if (r.kind === 'midi') {
    const notes = placedNotes({ ...r, loop: r.loop, muted: false }, r.start, r.start + Math.min(L, r.loop ? Infinity : r.length)).map((pn) => ({
      ...pn.note,
      id: uid('n'),
      start: pn.start - r.start,
      duration: pn.duration,
    }));
    return { ...(cloneRegion(r) as Region), kind: 'midi', notes, start: 0, length: L, offset: 0, loop: false, contentLength: L, drummer: undefined, muted: false } as Region;
  }
  return { ...(cloneRegion(r) as Region), start: 0, length: r.loop ? r.contentLength : r.length, loop: false, muted: false } as Region;
}

export function setCell(trackId: string, scene: number, region: Region): string {
  let id = '';
  commit((d) => {
    const ll = ensureLiveLoops(d);
    while (ll.scenes.length <= scene) ll.scenes.push({ id: uid('s'), name: String(ll.scenes.length + 1) });
    const existing = ll.cells.find((c) => c.trackId === trackId && c.scene === scene);
    if (existing) {
      existing.region = region as Draft<Region>;
      id = existing.id;
    } else {
      id = uid('l');
      ll.cells.push({ id, trackId, scene, region } as Draft<LiveCell>);
    }
  });
  return id;
}

export function deleteCell(cellId: string): void {
  const st = useLive.getState();
  for (const [tid, pc] of Object.entries(st.playing)) if (pc.cellId === cellId) stopRow(tid);
  commit((d) => {
    if (d.liveLoops) d.liveLoops.cells = d.liveLoops.cells.filter((c) => c.id !== cellId);
  });
}

export function moveCell(cellId: string, trackId: string, scene: number, copy: boolean): void {
  const p = useStore.getState().project;
  const cell = findCell(p, cellId);
  const target = p?.tracks.find((t) => t.id === trackId);
  const src = p?.tracks.find((t) => t.id === cell?.trackId);
  if (!cell || !target || !src) return;
  if ((target.type === 'audio') !== (cell.region.kind === 'audio')) {
    toast(cell.region.kind === 'audio' ? 'Audio loops go on audio tracks' : 'MIDI loops go on instrument or drum tracks', 'error');
    return;
  }
  if (cell.trackId === trackId && cell.scene === scene) return;
  commit((d) => {
    const ll = ensureLiveLoops(d);
    while (ll.scenes.length <= scene) ll.scenes.push({ id: uid('s'), name: String(ll.scenes.length + 1) });
    ll.cells = ll.cells.filter((c) => !(c.trackId === trackId && c.scene === scene) || c.id === cellId);
    if (copy) {
      ll.cells.push({ id: uid('l'), trackId, scene, region: cloneRegion(cell.region) } as Draft<LiveCell>);
    } else {
      const c = ll.cells.find((x) => x.id === cellId);
      if (c) {
        c.trackId = trackId;
        c.scene = scene;
      }
    }
  });
}

/** Turn each arrangement section into a scene: every track's content in that section becomes a cell. */
export function scenesFromSections(): number {
  const p = useStore.getState().project;
  if (!p) return 0;
  const bpb = beatsPerBar(p.timeSig);
  const sections = (p.sections ?? []).slice().sort((a, b) => a.start - b.start);
  const ranges = sections.length
    ? sections.map((s) => ({ name: s.name, start: s.start, length: s.length }))
    : Array.from({ length: Math.min(8, Math.ceil(p.lengthBars / 4)) }, (_, i) => ({ name: String(i + 1), start: i * 4 * bpb, length: 4 * bpb }));
  let made = 0;
  commit((d) => {
    const ll = ensureLiveLoops(d);
    ll.cells = [];
    ll.scenes = ranges.map((r) => ({ id: uid('s'), name: r.name }));
    ranges.forEach((range, scene) => {
      const L = Math.min(range.length, 8 * bpb);
      for (const t of d.tracks) {
        const inRange = t.regions.filter((r) => r.start < range.start + L && r.start + r.length > range.start && !r.muted);
        if (!inRange.length) continue;
        if (t.type === 'audio') {
          const r0 = inRange[0] as Region;
          const cellR = regionToCell(r0, bpb);
          ll.cells.push({ id: uid('l'), trackId: t.id, scene, region: cellR } as Draft<LiveCell>);
          made++;
          continue;
        }
        const notes: Note[] = [];
        for (const r of inRange) {
          if (r.kind !== 'midi') continue;
          for (const pn of placedNotes(r as Region & { kind: 'midi' }, range.start, range.start + L))
            notes.push({ ...pn.note, id: uid('n'), start: pn.start - range.start, duration: Math.min(pn.duration, range.start + L - pn.start) });
        }
        if (!notes.length) continue;
        const region: Region = { id: uid('r'), kind: 'midi', name: `${t.name} ${range.name}`, start: 0, length: L, offset: 0, loop: false, contentLength: L, notes };
        ll.cells.push({ id: uid('l'), trackId: t.id, scene, region } as Draft<LiveCell>);
        made++;
      }
    });
  });
  return made;
}
