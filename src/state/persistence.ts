// Project storage in IndexedDB with debounced autosave.
import { get, set, del, createStore } from 'idb-keyval';
import type { Project, ProjectMeta } from '../model/types';
import { contentEndBeat } from '../model/defaults';
import { useStore } from './store';

const projectDb = createStore('bandforge-projects', 'projects');
const INDEX_KEY = '__index__';

export async function listProjects(): Promise<ProjectMeta[]> {
  const idx = ((await get(INDEX_KEY, projectDb)) as ProjectMeta[] | undefined) ?? [];
  return idx.sort((a, b) => b.updatedAt - a.updatedAt);
}

function metaOf(p: Project): ProjectMeta {
  return {
    id: p.id,
    name: p.name,
    bpm: p.bpm,
    key: p.key,
    trackCount: p.tracks.length,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    coverHue: p.coverHue ?? 200,
    lengthBeats: contentEndBeat(p),
  };
}

export async function saveProject(p: Project): Promise<void> {
  await set(p.id, p, projectDb);
  const idx = ((await get(INDEX_KEY, projectDb)) as ProjectMeta[] | undefined) ?? [];
  const meta = metaOf(p);
  const i = idx.findIndex((m) => m.id === p.id);
  if (i >= 0) idx[i] = meta;
  else idx.push(meta);
  await set(INDEX_KEY, idx, projectDb);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return (await get(id, projectDb)) as Project | undefined;
}

export async function deleteProject(id: string): Promise<void> {
  await del(id, projectDb);
  const idx = ((await get(INDEX_KEY, projectDb)) as ProjectMeta[] | undefined) ?? [];
  await set(
    INDEX_KEY,
    idx.filter((m) => m.id !== id),
    projectDb,
  );
}

/** Collect all audio clip ids referenced by a project. */
export function projectAudioIds(p: Project): string[] {
  const ids = new Set<string>();
  for (const t of p.tracks) {
    if (t.samplerAudioId) ids.add(t.samplerAudioId);
    for (const d of Object.values(t.drumSamples ?? {})) ids.add(d.audioId);
    for (const r of t.regions) if (r.kind === 'audio') ids.add(r.audioId);
  }
  return [...ids];
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: Project | null = null;
export type SaveStatus = 'saved' | 'saving' | 'dirty';
export const saveListeners = new Set<(s: SaveStatus) => void>();
function status(s: SaveStatus) {
  saveListeners.forEach((f) => f(s));
}

export async function flushSave(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const p = useStore.getState().project;
  if (p && p !== lastSaved) {
    status('saving');
    lastSaved = p;
    await saveProject(p);
    status('saved');
  }
}

export function startAutosave(): void {
  useStore.subscribe((s, prev) => {
    if (!s.project || s.project === prev.project) return;
    if (prev.project && prev.project.id !== s.project.id) {
      lastSaved = s.project;
      return;
    }
    status('dirty');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flushSave(), 800);
  });
  window.addEventListener('beforeunload', () => void flushSave());
}

export function markSaved(p: Project): void {
  lastSaved = p;
}
