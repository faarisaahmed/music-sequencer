import type { AudioRegion, MidiRegion, Note, Project, Track, TrackFx, TrackType } from './types';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const TRACK_COLORS: Record<TrackType, string[]> = {
  instrument: ['#5dbb7a', '#3fb5a5', '#a07ae0', '#4a9f6e'],
  drums: ['#d99a3a', '#c9773a', '#d4ad4a'],
  audio: ['#5b9be0', '#4f86d0', '#7a86e6', '#4fb7d6'],
};

/** Track and section colours from before the analog palette → their replacements, so older songs match. */
const RETIRED_COLORS: Record<string, string> = {
  '#3ecf5a': '#5dbb7a', '#2fbf8f': '#3fb5a5', '#7ed957': '#8cc265', '#1fae6b': '#4a9f6e',
  '#e8b92a': '#d99a3a', '#f0a020': '#c9773a', '#d9c234': '#d4ad4a',
  '#3d9bff': '#5b9be0', '#2c7be5': '#4f86d0', '#5b8cff': '#7a86e6', '#22a6f0': '#4fb7d6',
  '#34c759': '#5dbb7a', '#ff9f0a': '#e08a3c', '#bf5af2': '#a07ae0', '#ff375f': '#e06a8f',
  '#32d0e6': '#45b8c4', '#ffd60a': '#e3c35a', '#8e8e93': '#939089',
  '#f0892a': '#e08a3c', '#ef5350': '#e05a4a', '#ec4fa0': '#e06a8f', '#a46cf0': '#a07ae0', '#28c4dc': '#45b8c4', '#9a9aa4': '#a19e96',
  '#99907c': '#939089', '#a89d87': '#a19e96',
  // The first analog palette (muted olive/slate) → the cleaner hues.
  '#8fae6e': '#5dbb7a', '#6fa58a': '#3fb5a5', '#a7b56a': '#8cc265', '#5e9a74': '#4a9f6e', '#c98b3a': '#d99a3a', '#b8743a': '#c9773a', '#c2a050': '#d4ad4a',
  '#6d97b8': '#5b9be0', '#5a83a6': '#4f86d0', '#7d8fc0': '#7a86e6', '#5c9fb0': '#4fb7d6', '#8fb573': '#5dbb7a', '#6fb3b8': '#45b8c4', '#a88cc2': '#a07ae0',
  '#d36d7f': '#e06a8f', '#d9533b': '#e05a4a',
};
export function currentColor(c: string): string {
  return RETIRED_COLORS[c?.toLowerCase()] ?? c;
}

export function defaultFx(): TrackFx {
  return {
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressor: 0.2,
    drive: 0,
    chorus: 0,
    reverb: 0.15,
    delay: 0,
    filterCutoff: 1,
  };
}

export function createTrack(type: TrackType, instrument: string, name: string, index = 0): Track {
  const palette = TRACK_COLORS[type];
  return {
    id: uid('t'),
    name,
    type,
    instrument,
    instrumentParams: {},
    color: palette[index % palette.length],
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    regions: [],
    fx: defaultFx(),
    automation: { volume: [], pan: [] },
    showAutomation: null,
    transpose: 0,
  };
}

export function createMidiRegion(start: number, length: number, notes: Note[] = [], name = 'Region'): MidiRegion {
  return {
    id: uid('r'),
    kind: 'midi',
    name,
    start,
    length,
    offset: 0,
    loop: false,
    contentLength: length,
    notes,
  };
}

export function createAudioRegion(start: number, length: number, audioId: string, name = 'Audio'): AudioRegion {
  return {
    id: uid('r'),
    kind: 'audio',
    name,
    start,
    length,
    offset: 0,
    loop: false,
    contentLength: length,
    audioId,
    gain: 1,
    fadeIn: 0,
    fadeOut: 0,
  };
}

export function note(pitch: number, start: number, duration: number, velocity = 0.8): Note {
  return { id: uid('n'), pitch, start, duration, velocity };
}

export function createProject(name = 'My Song'): Project {
  const now = Date.now();
  return {
    id: uid('p'),
    name,
    bpm: 110,
    timeSig: [4, 4],
    key: { tonic: 0, mode: 'major' },
    tracks: [],
    loop: { enabled: false, start: 0, end: 16 },
    lengthBars: 32,
    masterVolume: 0.85,
    masterAutomation: [],
    reverbType: 'hall',
    delayTime: '1/8d',
    delayFeedback: 0.35,
    metronome: false,
    countIn: true,
    createdAt: now,
    updatedAt: now,
    coverHue: Math.floor(Math.random() * 360),
    chords: [],
  };
}

export function regionEnd(r: { start: number; length: number }): number {
  return r.start + r.length;
}

/** Project length in beats, based on the last region end (min 4 bars). */
export function contentEndBeat(p: Project): number {
  let end = 0;
  for (const t of p.tracks) for (const r of t.regions) end = Math.max(end, r.start + r.length);
  return end;
}
