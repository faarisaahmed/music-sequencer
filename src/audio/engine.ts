// Live engine: transport, lookahead scheduler, metronome, live playing & recording.
import type { Note, Project } from '../model/types';
import { beatsPerBar } from '../model/music';
import { createMidiRegion, createAudioRegion, uid } from '../model/defaults';
import { commit, findTrack, toast, useStore, useTransport } from '../state/store';
import { getAudioContext, resumeAudio } from './context';
import { Mixer } from './mixer';
import { scheduleRange, type ActiveSource } from './schedule';
import { addBuffer, ensureClips } from './audioStore';
import { PcmRecorder } from './pcmRecorder';
import { projectAudioIds } from '../state/persistence';

const LOOKAHEAD = 0.12; // seconds scheduled ahead
const TICK_MS = 25;

interface Segment {
  ctxTime: number;
  beat: number;
}

interface RecordingState {
  trackId: string;
  startBeat: number;
  kind: 'midi' | 'audio';
  notes: Note[];
  pending: Map<number, { start: number; velocity: number }>;
  cycle: boolean;
  // audio
  recorder?: PcmRecorder;
}

type LiveListener = (pitch: number, on: boolean, trackId: string) => void;

class Engine {
  ctx: AudioContext;
  mixer: Mixer;
  private project: Project | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;
  private segments: Segment[] = [];
  private scheduledBeat = 0;
  private freshPending = false;
  private sources: ActiveSource[] = [];
  private playing = false;
  private rec: RecordingState | null = null;
  private stream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private monitorGain: GainNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private countInUntil = -Infinity;
  private liveListeners = new Set<LiveListener>();
  /** Notes currently held by the user, per track (for UI highlighting). */
  readonly held = new Map<string, Set<number>>();

  constructor() {
    this.ctx = getAudioContext();
    this.mixer = new Mixer(this.ctx);
    this.mixer.output.connect(this.ctx.destination);
    useStore.subscribe((s, prev) => {
      if (s.project !== prev.project) this.setProject(s.project);
    });
    this.setProject(useStore.getState().project);
  }

  private setProject(p: Project | null): void {
    const prev = this.project;
    this.project = p;
    if (!p) {
      this.stop();
      for (const t of [...this.mixer.channels.keys()]) this.mixer.channels.get(t)?.dispose();
      this.mixer.channels.clear();
      return;
    }
    if (prev && prev.id !== p.id) this.stop();
    // Tempo change while playing: re-anchor the transport.
    if (prev && this.playing && prev.bpm !== p.bpm) {
      const now = this.ctx.currentTime;
      const beat = this.beatAt(now, prev.bpm);
      this.segments = [{ ctxTime: now, beat }];
      this.scheduledBeat = Math.max(this.scheduledBeat, beat);
    }
    this.mixer.sync(p);
  }

  async loadProjectAudio(p: Project): Promise<void> {
    await ensureClips(projectAudioIds(p));
    this.mixer.sync(p);
  }

  // ----------------------------------------------------------- transport math

  private get spb(): number {
    return 60 / (this.project?.bpm ?? 120);
  }

  private beatAt(ctxTime: number, bpm = this.project?.bpm ?? 120): number {
    let seg = this.segments[0];
    for (const s of this.segments) if (s.ctxTime <= ctxTime + 1e-9) seg = s;
    if (!seg) return 0;
    return seg.beat + ((ctxTime - seg.ctxTime) * bpm) / 60;
  }

  get position(): number {
    if (!this.playing) return useStore.getState().cursor;
    return this.beatAt(this.ctx.currentTime);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  // ----------------------------------------------------------- playback

  async play(from?: number): Promise<void> {
    await resumeAudio();
    const p = this.project;
    if (!p) return;
    if (this.playing) this.stopSources();
    const start = from ?? useStore.getState().cursor;
    const now = this.ctx.currentTime + 0.06;
    this.segments = [{ ctxTime: now, beat: start }];
    this.scheduledBeat = start;
    this.freshPending = true;
    this.playing = true;
    useStore.setState({ playing: true });
    this.tick();
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    this.startRaf();
  }

  stop(returnToCursor = true): void {
    const wasRecording = !!this.rec;
    if (wasRecording) void this.finishRecording();
    if (!this.playing) return;
    const pos = this.position;
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopSources();
    for (const ch of this.mixer.channels.values()) ch.instrument?.allNotesOff(this.ctx.currentTime);
    const s = useStore.getState();
    useStore.setState({ playing: false, recording: false, countingIn: false });
    const resume = returnToCursor ? s.cursor : Math.max(0, pos);
    useTransport.setState({ position: resume, seconds: resume * this.spb });
    if (!returnToCursor) useStore.setState({ cursor: resume });
  }

  togglePlay(): void {
    if (this.playing) this.stop(false);
    else void this.play();
  }

  /** Move the playhead. While playing, playback jumps there. */
  seek(beat: number): void {
    const b = Math.max(0, beat);
    useStore.setState({ cursor: b });
    useTransport.setState({ position: b, seconds: b * this.spb });
    if (this.playing && !this.rec) void this.play(b);
  }

  private stopSources(): void {
    const now = this.ctx.currentTime;
    for (const s of this.sources) {
      try {
        s.gain.gain.cancelScheduledValues(now);
        s.gain.gain.setTargetAtTime(0, now, 0.01);
        s.src.stop(now + 0.05);
      } catch {
        /* noop */
      }
    }
    this.sources = [];
  }

  private tick(): void {
    const p = this.project;
    if (!this.playing || !p) return;
    const now = this.ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    const loopOn = p.loop.enabled && p.loop.end > p.loop.start && !(this.rec?.kind === 'audio');
    this.sources = this.sources.filter((s) => s.end > now);
    let guard = 0;
    while (guard++ < 8) {
      const seg = this.segments[this.segments.length - 1];
      const horizonBeat = seg.beat + ((horizon - seg.ctxTime) * p.bpm) / 60;
      const segEnd = loopOn && seg.beat < p.loop.end ? p.loop.end : Infinity;
      const b1 = Math.min(horizonBeat, segEnd);
      const b0 = this.scheduledBeat;
      if (b1 > b0) {
        const toTime = (b: number) => seg.ctxTime + ((b - seg.beat) * 60) / p.bpm;
        scheduleRange(p, this.mixer, b0, b1, toTime, { fresh: this.freshPending, limit: segEnd, sources: this.sources });
        this.scheduleMetronome(p, b0, b1, toTime);
        this.freshPending = false;
        this.scheduledBeat = b1;
      }
      if (b1 >= segEnd) {
        // Wrap to loop start.
        const wrapTime = seg.ctxTime + ((segEnd - seg.beat) * 60) / p.bpm;
        this.segments.push({ ctxTime: wrapTime, beat: p.loop.start });
        if (this.segments.length > 8) this.segments.splice(0, this.segments.length - 8);
        this.scheduledBeat = p.loop.start;
        this.freshPending = true;
        continue;
      }
      break;
    }
    // Auto-stop at the end of the song when not looping.
    const pos = this.beatAt(now);
    const endBeat = p.lengthBars * beatsPerBar(p.timeSig);
    if (!loopOn && !this.rec && pos > endBeat) this.stop(false);
  }

  private scheduleMetronome(p: Project, b0: number, b1: number, toTime: (b: number) => number): void {
    const counting = b0 < this.countInUntil;
    if (!p.metronome && !counting && !(this.rec && p.metronome)) return;
    const beatLen = 4 / p.timeSig[1];
    const bpb = beatsPerBar(p.timeSig);
    for (let b = Math.ceil(b0 / beatLen - 1e-9) * beatLen; b < b1; b += beatLen) {
      if (!p.metronome && b >= this.countInUntil) continue;
      const accent = Math.abs(((b % bpb) + bpb) % bpb) < 1e-6;
      this.click(toTime(b), accent);
    }
  }

  private click(time: number, accent: boolean): void {
    const ctx = this.ctx;
    if (time < ctx.currentTime) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(accent ? 0.45 : 0.3, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(time);
    o.stop(time + 0.06);
  }

  private startRaf(): void {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (!this.playing) return;
      const pos = this.beatAt(this.ctx.currentTime - (this.ctx.outputLatency || 0));
      useTransport.setState({ position: pos, seconds: Math.max(0, pos) * this.spb });
      if (this.countInUntil > -Infinity && pos >= this.countInUntil && useStore.getState().countingIn) {
        useStore.setState({ countingIn: false });
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // ----------------------------------------------------------- meters

  readLevels(): Record<string, number> {
    const out: Record<string, number> = {};
    const buf = new Float32Array(512);
    for (const [id, ch] of this.mixer.channels) {
      ch.analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
      out[id] = peak;
    }
    const big = new Float32Array(1024);
    this.mixer.analyserL.getFloatTimeDomainData(big);
    let l = 0;
    for (let i = 0; i < big.length; i++) l = Math.max(l, Math.abs(big[i]));
    this.mixer.analyserR.getFloatTimeDomainData(big);
    let r = 0;
    for (let i = 0; i < big.length; i++) r = Math.max(r, Math.abs(big[i]));
    out.__masterL = l;
    out.__masterR = r;
    if (this.micAnalyser) {
      this.micAnalyser.getFloatTimeDomainData(buf);
      let m = 0;
      for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
      out.__mic = m;
    }
    return out;
  }

  // ----------------------------------------------------------- live playing

  onLive(fn: LiveListener): () => void {
    this.liveListeners.add(fn);
    return () => this.liveListeners.delete(fn);
  }

  noteOn(trackId: string, pitch: number, velocity: number): void {
    void resumeAudio();
    const ch = this.mixer.channels.get(trackId);
    const t = findTrack(this.project, trackId);
    if (!ch?.instrument || !t) return;
    const transpose = t.type === 'drums' ? 0 : t.transpose;
    ch.instrument.noteOn(pitch + transpose, velocity, this.ctx.currentTime);
    let set = this.held.get(trackId);
    if (!set) this.held.set(trackId, (set = new Set()));
    set.add(pitch);
    this.liveListeners.forEach((f) => f(pitch, true, trackId));
    const rec = this.rec;
    if (rec && rec.kind === 'midi' && rec.trackId === trackId && this.playing) {
      const pos = this.position;
      if (pos >= rec.startBeat - 0.25) rec.pending.set(pitch, { start: Math.max(rec.startBeat, pos), velocity });
    }
  }

  noteOff(trackId: string, pitch: number): void {
    const ch = this.mixer.channels.get(trackId);
    const t = findTrack(this.project, trackId);
    if (!ch?.instrument || !t) return;
    const transpose = t.type === 'drums' ? 0 : t.transpose;
    ch.instrument.noteOff(pitch + transpose, this.ctx.currentTime);
    this.held.get(trackId)?.delete(pitch);
    this.liveListeners.forEach((f) => f(pitch, false, trackId));
    const rec = this.rec;
    if (rec && rec.kind === 'midi' && rec.trackId === trackId) {
      const pend = rec.pending.get(pitch);
      if (pend) {
        rec.pending.delete(pitch);
        this.pushRecordedNote(pitch, pend.start, this.position, pend.velocity);
      }
    }
  }

  /**
   * Play a note at a precise future audio-context time (arpeggiator etc.).
   * Recorded like a live note when recording on this track.
   */
  playScheduled(trackId: string, pitch: number, velocity: number, time: number, seconds: number): void {
    const ch = this.mixer.channels.get(trackId);
    const t = findTrack(this.project, trackId);
    if (!ch?.instrument || !t) return;
    const transpose = t.type === 'drums' ? 0 : t.transpose;
    ch.instrument.playNote(pitch + transpose, velocity, time, seconds);
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.liveListeners.forEach((f) => f(pitch, true, trackId)), delayMs);
    setTimeout(() => this.liveListeners.forEach((f) => f(pitch, false, trackId)), delayMs + seconds * 1000);
    const rec = this.rec;
    if (rec && rec.kind === 'midi' && rec.trackId === trackId && this.playing) {
      const start = this.beatAt(time);
      if (start >= rec.startBeat - 1e-6) this.pushRecordedNote(pitch, start, start + seconds / this.spb, velocity);
    }
  }

  private pushRecordedNote(pitch: number, start: number, end: number, velocity: number): void {
    const rec = this.rec;
    const p = this.project;
    if (!rec || !p) return;
    let dur = end - start;
    if (dur <= 0 && rec.cycle) dur += p.loop.end - p.loop.start; // wrapped around the loop
    rec.notes.push({ id: uid('n'), pitch, start, duration: Math.max(0.05, dur), velocity });
  }

  /** Audition a note (piano roll clicks, step sequencer). */
  preview(trackId: string, pitch: number, velocity = 0.8, beats = 0.5): void {
    void resumeAudio();
    const ch = this.mixer.channels.get(trackId);
    const t = findTrack(this.project, trackId);
    if (!ch?.instrument || !t) return;
    const transpose = t.type === 'drums' ? 0 : t.transpose;
    ch.instrument.playNote(pitch + transpose, velocity, this.ctx.currentTime + 0.005, beats * this.spb);
  }

  // ----------------------------------------------------------- recording

  async record(): Promise<void> {
    const s = useStore.getState();
    const p = this.project;
    if (!p) return;
    if (this.rec) {
      this.stop(false);
      return;
    }
    const track = findTrack(p, s.selectedTrackId) ?? p.tracks.find((t) => t.armed) ?? p.tracks[0];
    if (!track) {
      toast('Add a track before recording', 'error');
      return;
    }
    await resumeAudio();
    const bpb = beatsPerBar(p.timeSig);
    const cycle = p.loop.enabled && track.type !== 'audio';
    const startBeat = cycle ? p.loop.start : s.cursor;
    const preroll = p.countIn ? bpb : 0;
    this.rec = {
      trackId: track.id,
      startBeat,
      kind: track.type === 'audio' ? 'audio' : 'midi',
      notes: [],
      pending: new Map(),
      cycle,
    };
    if (this.rec.kind === 'audio') {
      const ok = await this.startMic();
      if (!ok || !this.stream) {
        this.rec = null;
        return;
      }
      const recorder = new PcmRecorder(this.ctx);
      await recorder.start(this.micSource!);
      this.rec.recorder = recorder;
    }
    this.countInUntil = preroll ? startBeat : -Infinity;
    useStore.setState({ recording: true, countingIn: preroll > 0, selectedTrackId: track.id });
    await this.play(startBeat - preroll);
  }

  get recordingInfo(): { trackId: string; startBeat: number; notes: Note[]; kind: string } | null {
    return this.rec ? { trackId: this.rec.trackId, startBeat: this.rec.startBeat, notes: this.rec.notes, kind: this.rec.kind } : null;
  }

  private async finishRecording(): Promise<void> {
    const rec = this.rec;
    const p = this.project;
    this.rec = null;
    this.countInUntil = -Infinity;
    if (!rec || !p) return;
    const endPos = this.position;
    if (rec.kind === 'midi') {
      for (const [pitch, pend] of rec.pending) this.pushRecordedNote(pitch, pend.start, endPos, pend.velocity);
      if (!rec.notes.length) return;
      const bpb = beatsPerBar(p.timeSig);
      let lo = Math.min(...rec.notes.map((n) => n.start));
      let hi = Math.max(...rec.notes.map((n) => n.start + n.duration));
      if (rec.cycle) {
        lo = p.loop.start;
        hi = p.loop.end;
      } else {
        lo = Math.floor(lo / bpb) * bpb;
        hi = Math.ceil(hi / bpb) * bpb;
      }
      const notes = rec.notes;
      commit((d) => {
        const t = d.tracks.find((x) => x.id === rec.trackId);
        if (!t) return;
        // Merge into an existing region that covers the take (overdub), else create a new one.
        const host = t.regions.find((r) => r.kind === 'midi' && !r.loop && r.start <= lo + 1e-6 && r.start + r.length >= lo + 1e-6);
        if (host && host.kind === 'midi') {
          const newEnd = Math.max(host.start + host.length, hi);
          host.length = newEnd - host.start;
          host.contentLength = Math.max(host.contentLength, host.offset + host.length);
          for (const n of notes) host.notes.push({ ...n, start: n.start - host.start + host.offset });
        } else {
          const r = createMidiRegion(lo, hi - lo, [], t.name);
          r.notes = notes.map((n) => ({ ...n, start: n.start - lo }));
          t.regions.push(r);
        }
        const bars = Math.ceil(hi / bpb) + 4;
        if (bars > d.lengthBars) d.lengthBars = bars;
      });
      toast(`Recorded ${notes.length} notes`, 'success');
    } else {
      const recorder = rec.recorder;
      if (!recorder) return;
      try {
        const raw = await recorder.stop();
        if (!raw) {
          toast('Nothing was recorded — check your microphone', 'error');
          return;
        }
        const spb = 60 / p.bpm;
        const recStartCtx = recorder.startTime >= 0 ? recorder.startTime : this.ctx.currentTime;
        const beatAtRecStart = this.beatAtSafe(recStartCtx);
        const latency = (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0);
        // Seconds of the recording to discard so that audio lines up with startBeat.
        const skip = Math.max(0, (rec.startBeat - beatAtRecStart) * spb + latency);
        const startSample = Math.floor(skip * raw.sampleRate);
        const len = raw.length - startSample;
        if (len < raw.sampleRate * 0.1) return;
        const trimmed = this.ctx.createBuffer(raw.numberOfChannels, len, raw.sampleRate);
        for (let c = 0; c < raw.numberOfChannels; c++) trimmed.copyToChannel(raw.getChannelData(c).subarray(startSample), c);
        const id = uid('a');
        await addBuffer(id, trimmed, 'Recording');
        const lengthBeats = trimmed.duration / spb;
        commit((d) => {
          const t = d.tracks.find((x) => x.id === rec.trackId);
          if (!t) return;
          const r = createAudioRegion(rec.startBeat, lengthBeats, id, t.name);
          t.regions.push(r);
          const bpb = beatsPerBar(d.timeSig);
          const bars = Math.ceil((rec.startBeat + lengthBeats) / bpb) + 4;
          if (bars > d.lengthBars) d.lengthBars = bars;
        });
        toast('Audio recorded', 'success');
      } catch (e) {
        console.error(e);
        toast('Could not decode recording', 'error');
      }
    }
  }

  private beatAtSafe(t: number): number {
    return this.segments.length ? this.beatAt(t) : 0;
  }

  async startMic(): Promise<boolean> {
    if (this.stream) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const srcNode = this.ctx.createMediaStreamSource(this.stream);
      this.micSource = srcNode;
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 512;
      srcNode.connect(this.micAnalyser);
      this.monitorGain = this.ctx.createGain();
      this.monitorGain.gain.value = 0;
      srcNode.connect(this.monitorGain);
      this.monitorGain.connect(this.ctx.destination);
      return true;
    } catch (e) {
      console.warn(e);
      toast('Microphone access was denied', 'error');
      return false;
    }
  }

  setMonitoring(on: boolean): void {
    if (this.monitorGain) this.monitorGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  get micStream(): MediaStream | null {
    return this.stream;
  }

  /** Record a short sample from the microphone (for the Sampler instrument). */
  async recordSample(maxSeconds = 10): Promise<{ stop: () => Promise<AudioBuffer | null> } | null> {
    await resumeAudio();
    if (!(await this.startMic()) || !this.stream) return null;
    const recorder = new PcmRecorder(this.ctx);
    await recorder.start(this.micSource!);
    let result: Promise<AudioBuffer | null> | null = null;
    const finish = () => (result ??= recorder.stop().then((buf) => (buf ? trimSilence(this.ctx, buf) : null)));
    const timeout = setTimeout(() => void finish(), maxSeconds * 1000);
    return {
      stop: async () => {
        clearTimeout(timeout);
        return finish();
      },
    };
  }
}

/** Trim leading/trailing silence from a buffer. */
export function trimSilence(ctx: BaseAudioContext, buf: AudioBuffer, threshold = 0.02): AudioBuffer {
  const d = buf.getChannelData(0);
  let s = 0;
  while (s < d.length && Math.abs(d[s]) < threshold) s++;
  if (s >= d.length) return buf; // all quiet: keep as-is rather than returning nothing
  let e = d.length - 1;
  while (e > s && Math.abs(d[e]) < threshold) e--;
  s = Math.max(0, s - Math.floor(buf.sampleRate * 0.005));
  e = Math.min(d.length - 1, e + Math.floor(buf.sampleRate * 0.05));
  const len = Math.max(1, e - s);
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(s, s + len), c);
  return out;
}

let engine: Engine | null = null;
export function getEngine(): Engine {
  if (!engine) engine = new Engine();
  return engine;
}
export type { Engine };
