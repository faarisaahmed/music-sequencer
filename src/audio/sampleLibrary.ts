// "My Samples": sounds you've recorded or imported into a Sampler or a drum row, kept in this
// browser so any song can use them again. The audio itself lives in the audio store (clips are
// never deleted); this is just the list.
import { get, set, createStore } from 'idb-keyval';
import { create } from 'zustand';

export interface LibrarySample {
  id: string;
  name: string;
  duration: number;
  added: number;
}

const db = createStore('bandforge-samples', 'list');
const KEY = 'samples';

export const useSampleLibrary = create<{ samples: LibrarySample[]; loaded: boolean }>(() => ({ samples: [], loaded: false }));

export async function loadSampleLibrary(): Promise<LibrarySample[]> {
  if (useSampleLibrary.getState().loaded) return useSampleLibrary.getState().samples;
  let samples: LibrarySample[] = [];
  try {
    samples = ((await get(KEY, db)) as LibrarySample[] | undefined) ?? [];
  } catch {
    /* storage unavailable */
  }
  useSampleLibrary.setState({ samples, loaded: true });
  return samples;
}

async function store(samples: LibrarySample[]) {
  useSampleLibrary.setState({ samples });
  try {
    await set(KEY, samples, db);
  } catch {
    /* storage unavailable: kept for this session */
  }
}

export async function addToSampleLibrary(id: string, name: string, duration: number): Promise<void> {
  const list = await loadSampleLibrary();
  if (list.some((s) => s.id === id)) return;
  await store([{ id, name: name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Sample', duration, added: Date.now() }, ...list]);
}

export async function removeFromSampleLibrary(id: string): Promise<void> {
  await store((await loadSampleLibrary()).filter((s) => s.id !== id));
}

export async function renameLibrarySample(id: string, name: string): Promise<void> {
  await store((await loadSampleLibrary()).map((s) => (s.id === id ? { ...s, name: name.slice(0, 40) || s.name } : s)));
}
