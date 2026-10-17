// Searching the sound library: every word you type has to match the sound's name, category,
// tags or description (with synonyms like "keys" → keyboards and small typos forgiven), and
// results are ranked by how well they match. Also favourites and recently used sounds.
import { create } from 'zustand';
import type { InstrumentPreset } from '../../audio/presets';
import { FILTERS, SYNONYMS, tagsFor } from '../../audio/presetTags';
import { previewNotes } from '../guides/audio';
import { useStore } from '../../state/store';
import { chordPitches, diatonicChords } from '../../model/music';

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9♭#-]+/).filter(Boolean);

/** Within `max` typos of each other (a missing, extra, wrong or swapped letter counts as one). */
function near(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length] <= max;
}

interface Indexed {
  preset: InstrumentPreset;
  name: string[];
  tags: string[];
  cat: string[];
  desc: string[];
}
const index = new Map<string, Indexed>();
function indexed(p: InstrumentPreset): Indexed {
  let x = index.get(p.id);
  if (!x) {
    x = { preset: p, name: words(p.name), tags: tagsFor(p.id), cat: words(p.category), desc: words(p.description) };
    index.set(p.id, x);
  }
  return x;
}

/** How well one typed word matches a sound (0 = not at all). */
function scoreWord(x: Indexed, w: string): number {
  let best = 0;
  const alts = [w, ...(SYNONYMS[w] ?? [])];
  for (const a of alts) {
    const syn = a !== w ? 0.8 : 1;
    for (const n of x.name) best = Math.max(best, (n === a ? 12 : n.startsWith(a) ? 9 : 0) * syn);
    for (const t of x.tags) best = Math.max(best, (t === a ? 7 : t.startsWith(a) && a.length >= 3 ? 5 : 0) * syn);
    for (const c of x.cat) best = Math.max(best, (c === a || (c.startsWith(a) && a.length >= 3) ? 6 : 0) * syn);
    for (const d of x.desc) best = Math.max(best, (d === a ? 4 : d.startsWith(a) && a.length >= 3 ? 3 : 0) * syn);
  }
  if (best === 0 && w.length >= 4) {
    // Small typos: "pinao", "violn", "synthwve".
    const max = w.length >= 7 ? 2 : 1;
    for (const n of x.name) if (near(w, n, max)) best = Math.max(best, 6);
    for (const t of x.tags) if (near(w, t, max)) best = Math.max(best, 3);
  }
  return best;
}

export function matchesFilter(p: InstrumentPreset, filterId: string): boolean {
  const f = FILTERS.find((x) => x.id === filterId);
  if (!f) return true;
  const tags = indexed(p).tags;
  return f.tags.some((t) => tags.includes(t));
}

/** Sounds matching the query and every chosen filter, best first. */
export function searchSounds(presets: InstrumentPreset[], query: string, filters: string[] = []): InstrumentPreset[] {
  const ws = words(query);
  const out: { p: InstrumentPreset; s: number; i: number }[] = [];
  presets.forEach((p, i) => {
    if (!filters.every((f) => matchesFilter(p, f))) return;
    const x = indexed(p);
    let s = 0;
    for (const w of ws) {
      const k = scoreWord(x, w);
      if (!k) return;
      s += k;
    }
    out.push({ p, s, i });
  });
  return out.sort((a, b) => b.s - a.s || a.i - b.i).map((o) => o.p);
}

// ---------------------------------------------------------------- favourites & recents

const FAV_KEY = 'bf.sounds.fav';
const RECENT_KEY = 'bf.sounds.recent';
function load(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function save(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: keep it for this session only */
  }
}

export const useSoundPrefs = create<{ fav: string[]; recent: string[] }>(() => ({ fav: load(FAV_KEY), recent: load(RECENT_KEY) }));

export function toggleFavourite(id: string): void {
  const { fav } = useSoundPrefs.getState();
  const next = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id];
  useSoundPrefs.setState({ fav: next });
  save(FAV_KEY, next);
}

export function noteRecent(id: string): void {
  if (id === 'user-sampler') return;
  const next = [id, ...useSoundPrefs.getState().recent.filter((x) => x !== id)].slice(0, 6);
  useSoundPrefs.setState({ recent: next });
  save(RECENT_KEY, next);
}

// ---------------------------------------------------------------- previews

/** The song key's home chord, for previews. */
export function homeChord(): number[] {
  const p = useStore.getState().project;
  return p ? chordPitches(diatonicChords(p.key)[0], 60) : [60, 64, 67];
}

export const usePreviewing = create<{ id: string | null; loading: boolean }>(() => ({ id: null, loading: false }));

/** Hear a sound without putting it on a track: a little beat for kits, a chord for the rest. */
export async function previewSound(id: string, drums: boolean, chord: number[]): Promise<void> {
  usePreviewing.setState({ id, loading: true });
  const done = () => usePreviewing.getState().id === id && usePreviewing.setState({ loading: false });
  const clear = () => usePreviewing.getState().id === id && usePreviewing.setState({ id: null });
  try {
    if (drums) {
      await previewNotes([36, 42, 38, 42, 36, 36, 38, 42], id, { arpeggio: 0.17, dur: 0.3 });
      done();
      setTimeout(clear, 1500);
    } else {
      await previewNotes(chord, id, { arpeggio: 0.11, dur: 1.6 });
      done();
      setTimeout(clear, 2200);
    }
  } catch {
    clear();
  }
}
