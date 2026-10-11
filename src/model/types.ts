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
  /** Score: voice within its staff (1 = stems up, 2 = stems down). */
  voice?: 1 | 2;
  /** Score: lyric syllable sung on this note ("lo-" continues into the next note). */
  lyric?: string;
  /** Score: articulations; staccato/accent/marcato also change playback. */
  artic?: Articulation[];
  /** Score: a grace note — played quickly just before the note that follows it, drawn small and slashed. */
  grace?: boolean;
}

export type Articulation = 'staccato' | 'accent' | 'tenuto' | 'marcato' | 'fermata';

/** Score markings stored on a MIDI region (content-relative beats). */
export interface ScoreMark {
  id: string;
  kind: 'dyn' | 'cresc' | 'dim';
  beat: number;
  /** Hairpin end (beats). */
  end?: number;
  /** Dynamic level, e.g. 'mf'. */
  value?: string;
  /** Staff index within the part (grand staff: 0 = treble, 1 = bass). */
  staff?: number;
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
  /** Score dynamics & hairpins. */
  marks?: ScoreMark[];
  /**
   * Beat Sequencer pattern this clip plays. Clips sharing a patternId are linked
   * (FL Studio-style): editing one edits them all. Only used while `loop` is on.
   */
  patternId?: string;
  /**
   * Score: rest boundaries (content beats, staff within the part, voice) so rests keep the
   * values you give them — e.g. a whole rest changed to a quarter shows as quarter + rests.
   */
  restSplits?: { beat: number; staff: number; voice: 1 | 2 }[];
  /** Swing for this region; undefined = follow the song's groove, null = straight. */
  groove?: Groove | null;
}

/** Swing feel applied at playback. */
export interface Groove {
  /** Which off-beats swing: 16th notes or 8th notes. */
  grid: 8 | 16;
  /** 0 = straight … 2/3 = triplet … 1 = dotted (MPC 50%–75%). */
  amount: number;
  /** 0..1: notes drift slightly late, for a laid-back human feel. */
  loose?: number;
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

export type AmpModel = 'clean' | 'crunch' | 'british' | 'highgain' | 'bass';

/** Insert effects. Each is optional; `on` switches it in/out of the channel. */
export interface InsertFx {
  gate?: { on: boolean; threshold: number /* dB -80..0 */ };
  amp?: { on: boolean; model: AmpModel; gain: number; bass: number; mid: number; treble: number; presence: number; level: number /* 0..1 each */ };
  deesser?: { on: boolean; amount: number };
  autowah?: { on: boolean; mode: 'envelope' | 'lfo'; sensitivity: number; rate: number; base: number; q: number; mix: number };
  phaser?: { on: boolean; rate: number; depth: number; feedback: number; mix: number };
  flanger?: { on: boolean; rate: number; depth: number; feedback: number; mix: number };
  tremolo?: { on: boolean; rate: number; depth: number };
  lofi?: { on: boolean; bits: number; tone: number; mix: number };
  widener?: { on: boolean; width: number; haas: number };
}

export interface MasteringSettings {
  preset: string;
  low: number; // dB
  mid: number;
  high: number;
  glue: number; // 0..1
  ceiling: number; // dBFS, e.g. -1
  loudness: number; // dB of drive into the limiter
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
  /** Optional insert effects (only instantiated when switched on). */
  inserts?: InsertFx;
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
  /**
   * Drum tracks: your own sounds on Beat Sequencer rows, keyed by row pitch.
   * Row mix lives in instrumentParams: level<p>, pan<p>, tune<p>, mute<p>, solo<p>.
   */
  drumSamples?: Record<string, { audioId: string; name: string }>;
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
}

export type ScaleType =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'harmonic minor'
  | 'melodic minor'
  | 'major pentatonic'
  | 'minor pentatonic'
  | 'blues';

export interface KeySignature {
  tonic: number; // 0..11 (C = 0)
  /** Major/minor family of the key (drives chord & progression logic). */
  mode: 'major' | 'minor';
  /** Specific scale or mode. Absent means plain major/minor. */
  scale?: ScaleType;
}

export type ChordQuality = '' | 'm' | 'dim' | 'aug' | '7' | 'maj7' | 'm7' | 'sus4' | 'sus2' | 'add9' | '6' | 'm6' | 'm9' | '9';

export interface ChordSymbol {
  id: string;
  beat: number;
  length: number;
  root: number; // pitch class 0..11
  quality: ChordQuality;
  /** Slash-chord bass pitch class. */
  bass?: number;
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
  /** Chord track: chord symbols on the timeline. */
  chords: ChordSymbol[];
  /** Master-bus mastering chain settings. */
  mastering?: MasteringSettings;
  /** Song-wide swing applied to every MIDI region that doesn't set its own. */
  groove?: Groove | null;
  /** Arrangement markers (Intro, Verse, Chorus…). */
  sections?: Section[];
  /** Tempo changes after the start (the song starts at `bpm`). */
  tempoChanges?: TempoChange[];
  /** Time-signature changes at bar lines (the song starts in `timeSig`). */
  meterChanges?: MeterChange[];
  /** Release details written into exported files (ID3 / MP4 / Vorbis tags, MIDI meta). */
  info?: SongInfo;
}

/** Song details for exported files. The title is the project name. */
export interface SongInfo {
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  trackTotal?: number;
  composer?: string;
  comment?: string;
  /** Album cover as a square JPEG data URL (up to 1000 px). */
  cover?: string;
  /** Small copy of the cover for the song browser. */
  coverThumb?: string;
  /** YouTube publishing: your edits (unset fields follow the song info) and the last upload. */
  youtube?: YouTubeInfo;
}

export interface YouTubeInfo {
  title?: string;
  description?: string;
  tags?: string[];
  /** Custom 1280×720 thumbnail (JPEG data URL); unset = made from the cover. */
  thumbnail?: string;
  /** The last published video. */
  videoId?: string;
  channel?: string;
  publishedAt?: number;
}

export interface TempoChange {
  id: string;
  /** Where the new tempo is reached (beats). */
  beat: number;
  bpm: number;
  /** Speed up / slow down gradually from the previous tempo (accelerando / ritardando). */
  ramp?: boolean;
}

export interface MeterChange {
  id: string;
  /** Bar number (0-based) where the new time signature starts. */
  bar: number;
  timeSig: [number, number];
}

export interface Section {
  id: string;
  name: string;
  start: number; // beats
  length: number; // beats
  color: string;
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
  /** Album cover thumbnail (data URL). */
  cover?: string;
  artist?: string;
}
