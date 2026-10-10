import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type { Note, Project, Region, Track } from '../model/types';

export type DockTab = 'editor' | 'instrument' | 'mixer' | 'fx';
export type EditorMode = 'pianoroll' | 'score' | 'steps' | 'audio';

export interface Clipboard {
  kind: 'regions' | 'notes' | 'track';
  regions?: { trackOffset: number; region: Region }[];
  notes?: Note[];
  track?: Track;
  /** Earliest start of copied items (beats) — paste is relative to this. */
  anchor: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

export interface AppState {
  screen: 'home' | 'project';
  project: Project | null;
  past: Project[];
  future: Project[];
  gestureOpen: boolean;

  // Selection
  selectedTrackId: string | null;
  selectedRegionIds: string[];
  editingRegionId: string | null;
  selectedNoteIds: string[];

  // Layout
  dockTab: DockTab | null;
  dockHeight: number;
  dockMaximized: boolean;
  editorMode: EditorMode;
  libraryOpen: boolean;
  pxPerBeat: number;
  trackHeight: number;
  snapGrid: number; // beats, 0 = off
  clipboard: Clipboard | null;
  toasts: Toast[];
  modal: null | { kind: string; data?: unknown };
  /** Which area last received a click — decides where Delete / Copy / arrows apply. */
  focusArea: 'tracks' | 'editor' | 'instrument' | 'other';
  /** Computer-keyboard-as-piano ("musical typing") — letter keys play notes instead of shortcuts. */
  musicalTyping: boolean;
  /** Octave offset for musical typing / on-screen keyboard (base C = 48 + 12*octave). */
  keyboardOctave: number;
  velocity: number;

  // Transport (low-frequency state only; position lives in useTransport)
  playing: boolean;
  recording: boolean;
  countingIn: boolean;
  /** Where playback starts from / returns to (beats). */
  cursor: number;
}

export const useStore = create<AppState>(() => ({
  screen: 'home',
  project: null,
  past: [],
  future: [],
  gestureOpen: false,
  selectedTrackId: null,
  selectedRegionIds: [],
  editingRegionId: null,
  selectedNoteIds: [],
  dockTab: null,
  dockHeight: 340,
  dockMaximized: false,
  editorMode: 'pianoroll',
  libraryOpen: false,
  pxPerBeat: 28,
  trackHeight: 84,
  snapGrid: 1,
  clipboard: null,
  toasts: [],
  modal: null,
  focusArea: 'tracks',
  musicalTyping: false,
  keyboardOctave: 1,
  velocity: 0.8,
  playing: false,
  recording: false,
  countingIn: false,
  cursor: 0,
}));

const HISTORY_LIMIT = 200;

/** Apply an undoable edit to the current project. */
export function commit(recipe: (p: Draft<Project>) => void): void {
  const s = useStore.getState();
  if (!s.project) return;
  const next = produce(s.project, recipe);
  if (next === s.project) return;
  useStore.setState({
    project: { ...next, updatedAt: Date.now() },
    past: s.gestureOpen ? s.past : [...s.past.slice(-HISTORY_LIMIT), s.project],
    future: [],
  });
}

/**
 * Start a continuous gesture (drag etc.). The current project is pushed to history once;
 * subsequent `live` edits are not recorded individually. Call `endGesture` when done.
 */
export function beginGesture(): void {
  const s = useStore.getState();
  if (!s.project || s.gestureOpen) return;
  useStore.setState({ past: [...s.past.slice(-HISTORY_LIMIT), s.project], future: [], gestureOpen: true });
}

export function live(recipe: (p: Draft<Project>) => void): void {
  const s = useStore.getState();
  if (!s.project) return;
  const next = produce(s.project, recipe);
  if (next === s.project) return;
  useStore.setState({ project: next });
}

export function endGesture(): void {
  const s = useStore.getState();
  if (!s.gestureOpen) return;
  const prev = s.past[s.past.length - 1];
  // Drop the history entry if the gesture changed nothing.
  if (prev === s.project) useStore.setState({ past: s.past.slice(0, -1), gestureOpen: false });
  else useStore.setState({ gestureOpen: false, project: s.project ? { ...s.project, updatedAt: Date.now() } : null });
}

export function undo(): void {
  const s = useStore.getState();
  if (!s.project || !s.past.length) return;
  const prev = s.past[s.past.length - 1];
  useStore.setState({ project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future], gestureOpen: false });
  pruneSelection();
}

export function redo(): void {
  const s = useStore.getState();
  if (!s.project || !s.future.length) return;
  const [next, ...rest] = s.future;
  useStore.setState({ project: next, past: [...s.past, s.project], future: rest });
  pruneSelection();
}

/** Remove selection references to things that no longer exist. */
export function pruneSelection(): void {
  const s = useStore.getState();
  const p = s.project;
  if (!p) return;
  const regionIds = new Set<string>();
  const noteIds = new Set<string>();
  for (const t of p.tracks)
    for (const r of t.regions) {
      regionIds.add(r.id);
      if (r.kind === 'midi') for (const n of r.notes) noteIds.add(n.id);
    }
  useStore.setState({
    selectedTrackId: p.tracks.some((t) => t.id === s.selectedTrackId) ? s.selectedTrackId : p.tracks[0]?.id ?? null,
    selectedRegionIds: s.selectedRegionIds.filter((id) => regionIds.has(id)),
    editingRegionId: s.editingRegionId && regionIds.has(s.editingRegionId) ? s.editingRegionId : null,
    selectedNoteIds: s.selectedNoteIds.filter((id) => noteIds.has(id)),
  });
}

let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const id = toastId++;
  useStore.setState((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  setTimeout(() => useStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
}

export function openModal(kind: string, data?: unknown): void {
  useStore.setState({ modal: { kind, data } });
}
export function closeModal(): void {
  useStore.setState({ modal: null });
}

// ---------- Selectors / lookup helpers ----------

export function findTrack(p: Project | null, trackId: string | null): Track | undefined {
  if (!p || !trackId) return undefined;
  return p.tracks.find((t) => t.id === trackId);
}

export function findRegion(p: Project | null, regionId: string | null): { track: Track; region: Region } | undefined {
  if (!p || !regionId) return undefined;
  for (const track of p.tracks) {
    const region = track.regions.find((r) => r.id === regionId);
    if (region) return { track, region };
  }
  return undefined;
}

/** Find a region inside an immer draft. */
export function draftRegion(p: Draft<Project>, regionId: string): Draft<Region> | undefined {
  for (const t of p.tracks) {
    const r = t.regions.find((r) => r.id === regionId);
    if (r) return r;
  }
  return undefined;
}

export function draftTrack(p: Draft<Project>, trackId: string): Draft<Track> | undefined {
  return p.tracks.find((t) => t.id === trackId);
}

export function useProject(): Project {
  return useStore((s) => s.project!) as Project;
}

/** High-frequency transport position, kept separate so only playhead views re-render. */
export const useTransport = create<{ position: number; seconds: number; levels: Record<string, number> }>(() => ({
  position: 0,
  seconds: 0,
  levels: {},
}));
