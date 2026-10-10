// Core data model. All musical time is measured in beats (quarter notes).

export type TrackType = 'instrument' | 'drums' | 'audio';

export interface Note {
  id: string;
  pitch: number; // MIDI note number
  start: number; // beats, relative to region content start
  duration: number; // beats
  velocity: number; // 0..1
  /** Drum-sequencer extras: probability the hit plays (0..1). */
  chance?: number;
  /** Drum-sequencer extras: number of hits subdividing this step (1 = normal). */
  repeat?: number;
}

interface RegionBase {
  id: string;
  name: string;
  /** Position on the timeline (beats). */
  start: number;
  /** Visible length on the timeline (beats). */
  length: number;
  /** Where in the content the region begins (beats). Changes when the left edge is trimmed. */
  offset: number;
  /** When true, the content [0, contentLength) repeats to fill the region. */
  loop: boolean;
  /** Length of one loop cycle of the content (beats). */
  contentLength: number;
  muted?: boolean;
  color?: string;
}

export interface MidiRegion extends RegionBase {
  kind: 'midi';
  notes: Note[];
  /** Present on Drummer regions: notes are generated from these settings. */
  drummer?: DrummerSettings;
}

export interface AudioRegion extends RegionBase {
  kind: 'audio';
  audioId: string;
  /** Linear gain applied to the region. */
  gain: number;
  /** Fade lengths in beats. */
  fadeIn: number;
  fadeOut: number;
  reversed?: boolean;
}

export type Region = MidiRegion | AudioRegion;

export interface AutomationPoint {
  beat: number;
  value: number; // volume: 0..1 (maps to track gain multiplier), pan: -1..1
}

export interface TrackFx {
  eqLow: number; // dB -12..12
  eqMid: number;
  eqHigh: number;
  compressor: number; // 0..1 amount
  drive: number; // 0..1 distortion amount
  chorus: number; // 0..1 wet
  reverb: number; // 0..1 send
  delay: number; // 0..1 send
  filterCutoff: number; // 0..1 (1 = open)
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  /** Instrument preset id (see audio/presets). Unused for audio tracks. */
  instrument: string;
  /** Per-track overrides of instrument smart-control parameters. */
  instrumentParams: Record<string, number>;
  /** For the user Sampler instrument: id of the sample in the audio store. */
  samplerAudioId?: string;
  samplerRoot?: number;
  color: string;
  volume: number; // 0..1.25 fader (gain = volume^2 style mapping handled by engine)
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  armed: boolean;
  regions: Region[];
  fx: TrackFx;
  automation: {
    volume: AutomationPoint[];
    pan: AutomationPoint[];
  };
  showAutomation?: 'volume' | 'pan' | null;
  /** Transpose applied at playback for MIDI tracks (semitones). */
  transpose: number;
  height?: number;
  /** Drummer track: the virtual drummer playing it. */
  drummer?: { style: DrummerStyle };
}

export interface KeySignature {
  tonic: number; // 0..11 (C = 0)
  mode: 'major' | 'minor';
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSig: [number, number];
  key: KeySignature;
  tracks: Track[];
  loop: { enabled: boolean; start: number; end: number };
  /** Song length in bars (the arrangement grows automatically). */
  lengthBars: number;
  masterVolume: number;
  masterAutomation: AutomationPoint[];
  reverbType: 'room' | 'hall' | 'plate' | 'cathedral';
  delayTime: '1/4' | '1/8' | '1/8d' | '1/16' | '1/4d';
  delayFeedback: number;
  metronome: boolean;
  countIn: boolean;
  createdAt: number;
  updatedAt: number;
  /** Data-URL thumbnail colour stripe for the song browser. */
  coverHue?: number;
  /** Arrangement markers (Intro, Verse, Chorus…). */
  sections?: Section[];
}

export interface Section {
  id: string;
  name: string;
  start: number; // beats
  length: number; // beats
  color: string;
}

export type DrummerStyle = 'rock' | 'pop' | 'hiphop' | 'trap' | 'funk' | 'jazz' | 'house' | 'lofi' | 'songwriter' | 'rnb' | 'reggae' | 'latin';

/** Settings of a Drummer region — its notes are regenerated from these. */
export interface DrummerSettings {
  style: DrummerStyle;
  complexity: number; // 0..1 (Simple ↔ Complex)
  loudness: number; // 0..1 (Soft ↔ Loud)
  fills: number; // 0..1
  swing: number; // 0..1
  pieces: { kit: boolean; hats: boolean; cymbals: boolean; toms: boolean; perc: boolean };
  /** Variation per piece (0..1): kick/snare pattern, hi-hat openness → ride, percussion density. */
  kickVar: number;
  hatVar: number;
  percVar: number;
  /** Kick follows the rhythm of this track (bass etc.). */
  followTrackId?: string | null;
  seed: number;
  /** Region length the notes were generated for (regenerated when it changes). */
  generatedFor?: number;
  /** Context signature (position, length, sections, followed track) of the last generation. */
  sig?: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  bpm: number;
  key: KeySignature;
  trackCount: number;
  updatedAt: number;
  createdAt: number;
  coverHue: number;
  lengthBeats: number;
}
