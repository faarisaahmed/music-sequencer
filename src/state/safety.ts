// Keeping songs safe: permanent browser storage, version history, and backups (a backup
// folder that's kept up to date where the browser allows it, or "Back Up All Songs" files).
import { createStore, del, get, keys, set } from 'idb-keyval';
import type { Project } from '../model/types';
import { contentEndBeat } from '../model/defaults';
import { afterSaveHooks, listProjects, loadProject, projectAudioIds, projectDeleteHooks } from './persistence';
import { getClipBlob } from '../audio/audioStore';

// ---------------------------------------------------------------- persistent storage

/** Ask the browser not to clear BandForge's storage when space runs low or the site isn't visited. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isPersisted(): Promise<boolean | null> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}

export async function storageUse(): Promise<{ used: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.usage != null && e.quota ? { used: e.usage, quota: e.quota } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- version history

const versionDb = createStore('bandforge-versions', 'versions');

export interface VersionMeta {
  key: string;
  projectId: string;
  at: number;
  /** Your name for it; auto versions have none. */
  label?: string;
  auto: boolean;
  reason?: string;
  name: string;
  trackCount: number;
  seconds: number;
}
interface VersionRec extends VersionMeta {
  project: Project;
}

const MAX_AUTO = 30;
export const AUTO_EVERY = 10 * 60_000;

function metaOf(r: VersionRec): VersionMeta {
  const { project: _p, ...m } = r;
  return m;
}

export async function listVersions(projectId: string): Promise<VersionMeta[]> {
  const all = (await keys(versionDb)) as string[];
  const mine = all.filter((k) => k.startsWith(projectId + '|'));
  const recs = await Promise.all(mine.map((k) => get(k, versionDb) as Promise<VersionRec | undefined>));
  return recs
    .filter((r): r is VersionRec => !!r)
    .map(metaOf)
    .sort((a, b) => b.at - a.at);
}

export async function loadVersion(key: string): Promise<Project | undefined> {
  return ((await get(key, versionDb)) as VersionRec | undefined)?.project;
}

export async function saveVersion(p: Project, opts: { label?: string; auto?: boolean; reason?: string } = {}): Promise<VersionMeta> {
  const at = Date.now();
  const rec: VersionRec = {
    key: `${p.id}|${at}`,
    projectId: p.id,
    at,
    label: opts.label?.trim() || undefined,
    auto: !!opts.auto,
    reason: opts.reason,
    name: p.name,
    trackCount: p.tracks.length,
    seconds: (contentEndBeat(p) * 60) / p.bpm,
    project: p,
  };
  await set(rec.key, rec, versionDb);
  if (rec.auto) await pruneAuto(p.id);
  lastVersioned.set(p.id, { at, updatedAt: p.updatedAt });
  return metaOf(rec);
}

async function pruneAuto(projectId: string) {
  const autos = (await listVersions(projectId)).filter((v) => v.auto);
  for (const v of autos.slice(MAX_AUTO)) await del(v.key, versionDb);
}

export async function renameVersion(key: string, label: string): Promise<void> {
  const r = (await get(key, versionDb)) as VersionRec | undefined;
  if (!r) return;
  await set(key, { ...r, label: label.trim() || undefined, auto: label.trim() ? false : r.auto }, versionDb);
}

export async function deleteVersion(key: string): Promise<void> {
  await del(key, versionDb);
}

export async function deleteAllVersions(projectId: string): Promise<void> {
  for (const v of await listVersions(projectId)) await del(v.key, versionDb);
}

// Which edit each song was last versioned at, so auto versions are only made after changes.
const lastVersioned = new Map<string, { at: number; updatedAt: number }>();

/** Called as you work: makes an automatic version every ten minutes of editing. */
export async function maybeAutoVersion(p: Project, reason = 'Autosave'): Promise<void> {
  let last = lastVersioned.get(p.id);
  if (!last) {
    const newest = (await listVersions(p.id))[0];
    last = newest ? { at: newest.at, updatedAt: (await loadVersion(newest.key))?.updatedAt ?? 0 } : { at: 0, updatedAt: 0 };
    lastVersioned.set(p.id, last);
  }
  if (p.updatedAt === last.updatedAt) return;
  if (Date.now() - last.at < AUTO_EVERY && reason === 'Autosave') return;
  await saveVersion(p, { auto: true, reason });
}

// ---------------------------------------------------------------- backups

const settingsDb = createStore('bandforge-settings', 'settings');

interface BackupState {
  /** projectId → when it was last backed up (its updatedAt at that time and the time). */
  done: Record<string, { at: number; updatedAt: number }>;
  snoozeUntil?: number;
}

async function backupState(): Promise<BackupState> {
  return ((await get('backups', settingsDb)) as BackupState | undefined) ?? { done: {} };
}

async function markBackedUp(projects: { id: string; updatedAt: number }[]): Promise<void> {
  const st = await backupState();
  const at = Date.now();
  for (const p of projects) st.done[p.id] = { at, updatedAt: p.updatedAt };
  await set('backups', st, settingsDb);
  backupListeners.forEach((f) => f());
}

export const backupListeners = new Set<() => void>();

export async function snoozeBackupReminder(days = 3): Promise<void> {
  const st = await backupState();
  st.snoozeUntil = Date.now() + days * 86_400_000;
  await set('backups', st, settingsDb);
  backupListeners.forEach((f) => f());
}

/** Songs changed since their last backup and at least a week old (so brand-new doodles don't nag). */
export async function songsNeedingBackup(): Promise<{ count: number; snoozed: boolean }> {
  const st = await backupState();
  const list = await listProjects();
  const week = 7 * 86_400_000;
  const count = list.filter((m) => {
    const d = st.done[m.id];
    if (d && d.updatedAt >= m.updatedAt) return false;
    return Date.now() - (d?.at ?? m.createdAt) > week;
  }).length;
  return { count, snoozed: !!st.snoozeUntil && st.snoozeUntil > Date.now() };
}

async function audioOf(projects: Project[]): Promise<Record<string, { name: string; type: string; data: string }>> {
  const audio: Record<string, { name: string; type: string; data: string }> = {};
  for (const p of projects)
    for (const id of projectAudioIds(p)) {
      if (audio[id]) continue;
      const rec = await getClipBlob(id);
      if (!rec) continue;
      const buf = new Uint8Array(await rec.blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      audio[id] = { name: rec.name, type: rec.blob.type, data: btoa(bin) };
    }
  return audio;
}

/** One file holding every song (and its recordings). */
export async function backupAllFile(): Promise<File> {
  const metas = await listProjects();
  const projects = (await Promise.all(metas.map((m) => loadProject(m.id)))).filter((p): p is Project => !!p);
  const blob = new Blob([JSON.stringify({ format: 'bandforge-backup', version: 1, at: Date.now(), projects, audio: await audioOf(projects) })], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  await markBackedUp(projects);
  return new File([blob], `BandForge Backup ${date}.bandforge.json`, { type: 'application/json' });
}

/** Hand a file to the person: the share sheet on phones ("Save to Files"), a download elsewhere. */
export async function deliverFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

// ---- backup folder (Chrome / Edge on computers)

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
};

export function canUseBackupFolder(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

export type FolderStatus = { kind: 'none' } | { kind: 'ok'; name: string } | { kind: 'paused'; name: string };

export async function backupFolderStatus(): Promise<FolderStatus> {
  const h = (await get('backupDir', settingsDb)) as DirHandle | undefined;
  if (!h) return { kind: 'none' };
  try {
    const name = h.name || 'your backup folder';
    return (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? { kind: 'ok', name } : { kind: 'paused', name };
  } catch {
    return { kind: 'paused', name: h.name || 'your backup folder' };
  }
}

/** Pick (or re-allow) the backup folder. Must run from a click. */
export async function chooseBackupFolder(): Promise<FolderStatus> {
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
  const h = await picker({ id: 'bandforge-backups', mode: 'readwrite', startIn: 'documents' });
  await set('backupDir', h, settingsDb);
  await backupAllToFolder();
  return backupFolderStatus();
}

export async function resumeBackupFolder(): Promise<FolderStatus> {
  const h = (await get('backupDir', settingsDb)) as DirHandle | undefined;
  if (!h) return { kind: 'none' };
  await h.requestPermission({ mode: 'readwrite' });
  await backupAllToFolder();
  return backupFolderStatus();
}

export async function forgetBackupFolder(): Promise<void> {
  await del('backupDir', settingsDb);
  backupListeners.forEach((f) => f());
}

function fileNameFor(p: Project): string {
  const safe = p.name.replace(/[^\w\- ]+/g, '').trim() || 'Song';
  return `${safe} (${p.id.slice(-6)}).bandforge.json`;
}

async function writeTo(dir: DirHandle, p: Project): Promise<void> {
  const fh = await dir.getFileHandle(fileNameFor(p), { create: true });
  const w = await fh.createWritable();
  await w.write(new Blob([JSON.stringify({ format: 'bandforge', version: 1, project: p, audio: await audioOf([p]) })], { type: 'application/json' }));
  await w.close();
}

async function grantedDir(): Promise<DirHandle | null> {
  const h = (await get('backupDir', settingsDb)) as DirHandle | undefined;
  if (!h) return null;
  try {
    return (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? h : null;
  } catch {
    return null;
  }
}

/** Keep one song's file in the backup folder current (quietly does nothing without one). */
export async function backupToFolder(p: Project): Promise<boolean> {
  const dir = await grantedDir();
  if (!dir) return false;
  try {
    await writeTo(dir, p);
    await markBackedUp([p]);
    return true;
  } catch (e) {
    console.warn('[backup] folder write failed', e);
    return false;
  }
}

export async function backupAllToFolder(): Promise<number> {
  const dir = await grantedDir();
  if (!dir) return 0;
  const metas = await listProjects();
  let n = 0;
  for (const m of metas) {
    const p = await loadProject(m.id);
    if (!p) continue;
    await writeTo(dir, p);
    await markBackedUp([p]);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- wiring

let folderTimer: ReturnType<typeof setTimeout> | null = null;
let folderPending: Project | null = null;

/** Hook versions and the backup folder into saving. Call once at start-up. */
export function startSafety(): void {
  afterSaveHooks.add((p) => {
    void maybeAutoVersion(p);
    // Write the backup file at most once a minute while you work.
    folderPending = p;
    if (!folderTimer)
      folderTimer = setTimeout(() => {
        folderTimer = null;
        const q = folderPending;
        folderPending = null;
        if (q) void backupToFolder(q);
      }, 60_000);
  });
  projectDeleteHooks.add((id) => void deleteAllVersions(id));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && folderPending) {
      const q = folderPending;
      folderPending = null;
      void backupToFolder(q);
    }
  });
}

/** When a song is opened: protect storage and keep a version from before this session. */
export function onProjectOpened(p: Project): void {
  void requestPersistence();
  // Nothing worth keeping in a brand-new empty song.
  if (p.tracks.some((t) => t.regions.length)) void maybeAutoVersion(p, 'Before this session');
}
