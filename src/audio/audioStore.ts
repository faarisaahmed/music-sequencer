// In-memory registry of user audio (recordings / imported files), backed by IndexedDB.
import { get, set, del, createStore } from 'idb-keyval';
import { getAudioContext } from './context';
import { encodeWav } from './wav';

const audioDb = createStore('bandforge-audio', 'clips');

interface StoredClip {
  blob: Blob;
  name: string;
}

const buffers = new Map<string, AudioBuffer>();
const reversed = new Map<string, AudioBuffer>();
const peaksCache = new Map<string, Float32Array>();
const listeners = new Set<() => void>();
let version = 0;

export function audioVersion(): number {
  return version;
}
export function onAudioChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  version++;
  listeners.forEach((f) => f());
}

export function getBuffer(id: string, rev = false): AudioBuffer | undefined {
  const b = buffers.get(id);
  if (!b || !rev) return b;
  let r = reversed.get(id);
  if (!r) {
    r = getAudioContext().createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let ch = 0; ch < b.numberOfChannels; ch++) {
      const src = b.getChannelData(ch);
      const dst = r.getChannelData(ch);
      for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
    }
    reversed.set(id, r);
  }
  return r;
}

/** Register a clip: decode, keep in memory and persist the encoded blob. */
export async function addClip(id: string, blob: Blob, name: string): Promise<AudioBuffer> {
  const ab = await blob.arrayBuffer();
  const buf = await getAudioContext().decodeAudioData(ab);
  buffers.set(id, buf);
  await set(id, { blob, name } satisfies StoredClip, audioDb);
  emit();
  return buf;
}

/** Register an already-decoded buffer (e.g. a processed recording). */
export async function addBuffer(id: string, buf: AudioBuffer, name: string): Promise<void> {
  buffers.set(id, buf);
  await set(id, { blob: encodeWav(buf), name } satisfies StoredClip, audioDb);
  emit();
}

export async function ensureClips(ids: string[]): Promise<void> {
  await Promise.all(
    ids
      .filter((id) => !buffers.has(id))
      .map(async (id) => {
        const rec = (await get(id, audioDb)) as StoredClip | undefined;
        if (!rec) return;
        try {
          const buf = await getAudioContext().decodeAudioData(await rec.blob.arrayBuffer());
          buffers.set(id, buf);
        } catch (e) {
          console.warn('decode failed', id, e);
        }
      }),
  );
  emit();
}

export async function getClipBlob(id: string): Promise<StoredClip | undefined> {
  return (await get(id, audioDb)) as StoredClip | undefined;
}

export async function deleteClip(id: string): Promise<void> {
  buffers.delete(id);
  reversed.delete(id);
  peaksCache.delete(id);
  await del(id, audioDb);
}

/** Min/max peaks for waveform drawing: `bins` pairs over the whole buffer. */
export function getPeaks(id: string, bins = 4000): Float32Array | undefined {
  const key = id + ':' + bins;
  const hit = peaksCache.get(key);
  if (hit) return hit;
  const b = buffers.get(id);
  if (!b) return undefined;
  const out = new Float32Array(bins * 2);
  const chans = Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
  const step = b.length / bins;
  for (let i = 0; i < bins; i++) {
    let lo = 0;
    let hi = 0;
    const s = Math.floor(i * step);
    const e = Math.min(b.length, Math.floor((i + 1) * step));
    for (const d of chans)
      for (let j = s; j < e; j += 4) {
        const v = d[j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    out[i * 2] = lo;
    out[i * 2 + 1] = hi;
  }
  peaksCache.set(key, out);
  return out;
}
