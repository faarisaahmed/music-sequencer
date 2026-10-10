import type { AudioRegion, MidiRegion, Note, Project, Track, TrackFx, TrackType } from './types';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const TRACK_COLORS: Record<TrackType, string[]> = {
  instrument: ['#3ecf5a', '#2fbf8f', '#7ed957', '#1fae6b'],
  drums: ['#e8b92a', '#f0a020', '#d9c234'],
  audio: ['#3d9bff', '#2c7be5', '#5b8cff', '#22a6f0'],
};

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
