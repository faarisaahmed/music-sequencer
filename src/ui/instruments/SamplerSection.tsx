// The Sampler: record or import a sound (or pick one from My Samples), trim it, and play it
// three ways: Classic (pitched across the keys, optionally looping), One-Shot (pitched, always
// plays to the end) or Slice (chopped into pieces, one per key from C4 up). Slices can also
// become a drum kit for the Beat Sequencer.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AudioWaveform, Circle, Square, Upload, Play, Repeat, ArrowLeftRight, Wand2, Scissors, Library, Drum } from 'lucide-react';
import { DEFAULT_SAMPLER, SLICE_BASE, type SamplerSettings, type Track } from '../../model/types';
import { getEngine } from '../../audio/engine';
import { addBuffer, addClip, ensureClips, getBuffer, getPeaks, onAudioChange } from '../../audio/audioStore';
import { addTrack, createEmptyRegion, updateTrack } from '../../state/actions';
import { beginGesture, endGesture, toast, useStore, useTransport } from '../../state/store';
import { uid } from '../../model/defaults';
import { DRUM_LANES, noteName } from '../../model/music';
import { cutBuffer, detectPitch, detectSlices, equalSlices } from '../../audio/sampleTools';
import { samplerRegion, sliceStarts } from '../../audio/instruments';
import { loadSampleLibrary, removeFromSampleLibrary } from '../../audio/sampleLibrary';
import { getAudioContext } from '../../audio/context';
import { showContextMenu, type MenuItem } from '../common/menus';
import { HSlider } from '../common/controls';
import { startDrag } from '../common/drag';
import { LevelMeter } from './AudioInputPanel';
import { loadSound } from './samplerLoad';

const MODES: { id: SamplerSettings['mode']; label: string; tip: string }[] = [
  { id: 'classic', label: 'Classic', tip: 'Play the sound across the keyboard; it stops when you let go (and can loop while held)' },
  { id: 'oneshot', label: 'One-Shot', tip: 'Every key plays the whole sound to the end, at its pitch' },
  { id: 'slice', label: 'Slice', tip: 'Chop the sound into pieces: each key from C4 up plays one slice' },
];
const MAX_SLICES = 24;

/** Settings with defaults filled in. */
function settingsOf(t: Track): SamplerSettings {
  return { ...DEFAULT_SAMPLER, ...t.sampler };
}

function setSettings(trackId: string, patch: Partial<SamplerSettings>) {
  updateTrack(trackId, (t) => {
    t.sampler = { ...DEFAULT_SAMPLER, ...t.sampler, ...patch };
  });
}

const cutsOf = sliceStarts;

function previewKey(trackId: string, pitch: number, seconds: number) {
  const bpm = useStore.getState().project?.bpm ?? 120;
  getEngine().preview(trackId, pitch, 0.85, Math.max(0.25, Math.min(16, (seconds * bpm) / 60)));
}

/** Waveform with trim handles, fades, loop and slice markers. */
function WaveEditor({ track, buf }: { track: Track; buf: AudioBuffer }) {
  const s = settingsOf(track);
  const ref = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(600);
  const [flash, setFlash] = useState<number | null>(null);
  const audioId = track.samplerAudioId!;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = devicePixelRatio;
    const W = (c.width = Math.max(1, Math.round(w * dpr)));
    const H = (c.height = Math.round(c.clientHeight * dpr));
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    const peaks = getPeaks(audioId, Math.max(64, Math.round(w)));
    if (!peaks) return;
    const bins = peaks.length / 2;
    for (let x = 0; x < W; x++) {
      const i = Math.floor((x / W) * bins);
      const f = x / W;
      const inside = f >= s.start && f <= s.end;
      g.fillStyle = inside ? track.color : '#4a4844';
      const lo = peaks[i * 2];
      const hi = peaks[i * 2 + 1];
      const y0 = H / 2 - hi * (H / 2) * 0.92;
      const y1 = H / 2 - lo * (H / 2) * 0.92;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
    // Fades as ramps over the trimmed area.
    const dur = buf.duration;
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = dpr;
    const x0 = s.start * W;
    const x1 = s.end * W;
    const fi = ((s.fadeIn ?? 0) / dur) * W;
    const fo = ((s.fadeOut ?? 0) / dur) * W;
    g.beginPath();
    g.moveTo(x0, H - 2 * dpr);
    g.lineTo(x0 + fi, 2 * dpr);
    g.lineTo(x1 - fo, 2 * dpr);
    g.lineTo(x1, H - 2 * dpr);
    g.stroke();
  });

  const frac = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const cuts = s.mode === 'slice' ? cutsOf(s) : [];
  const near = (clientX: number, f: number) => Math.abs(clientX - ref.current!.getBoundingClientRect().left - f * w) < 7;

  const dragTrim = (e: React.PointerEvent, which: 'start' | 'end') => {
    e.stopPropagation();
    beginGesture();
    startDrag(
      e,
      ({ x }) => {
        const f = frac(x);
        const cur = settingsOf(useStore.getState().project!.tracks.find((t) => t.id === track.id)!);
        const min = 0.01 / buf.duration;
        if (which === 'start') setSettings(track.id, { start: Math.min(f, cur.end - min) });
        else setSettings(track.id, { end: Math.max(f, cur.start + min) });
      },
      () => endGesture(),
    );
  };

  const dragCut = (e: React.PointerEvent, from: number) => {
    e.stopPropagation();
    beginGesture();
    let at = from;
    startDrag(
      e,
      ({ x }) => {
        const cur = settingsOf(useStore.getState().project!.tracks.find((t) => t.id === track.id)!);
        const f = Math.max(cur.start, Math.min(cur.end - 0.005, frac(x)));
        setSettings(track.id, { slices: (cur.slices ?? []).map((c) => (Math.abs(c - at) < 1e-9 ? f : c)) });
        at = f;
      },
      () => endGesture(),
    );
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Handles first.
    if (near(e.clientX, s.start)) return dragTrim(e, 'start');
    if (near(e.clientX, s.end)) return dragTrim(e, 'end');
    const hit = cuts.slice(1).find((c) => near(e.clientX, c));
    if (hit !== undefined) return dragCut(e, hit);
    // Otherwise play: the slice under the pointer, or the sound at its root.
    const f = frac(e.clientX);
    if (s.mode === 'slice') {
      const k = cuts.findIndex((c, i) => f >= c && (i + 1 >= cuts.length || f < cuts[i + 1]));
      if (k >= 0 && f <= s.end) {
        const reg = samplerRegion(s, buf.duration, SLICE_BASE + k);
        if (reg) previewKey(track.id, SLICE_BASE + k, reg.to - reg.from);
        setFlash(k);
        setTimeout(() => setFlash((x) => (x === k ? null : x)), 250);
      }
    } else previewKey(track.id, track.samplerRoot ?? 60, (s.end - s.start) * buf.duration);
  };

  const onDouble = (e: React.MouseEvent) => {
    if (s.mode !== 'slice') return;
    const f = frac(e.clientX);
    const hit = cuts.slice(1).find((c) => near(e.clientX, c));
    if (hit !== undefined) setSettings(track.id, { slices: (s.slices ?? []).filter((c) => c !== hit) });
    else if (!near(e.clientX, s.start) && f > s.start && f < s.end && cuts.length < MAX_SLICES) setSettings(track.id, { slices: [...(s.slices ?? []), f].sort((a, b) => a - b) });
  };

  return (
    <div ref={ref} className={'smp-editor mode-' + s.mode} onPointerDown={onDown} onDoubleClick={onDouble}>
      <canvas ref={canvas} className="smp-wave" />
      <div className="smp-dim" style={{ left: 0, width: `${s.start * 100}%` }} />
      <div className="smp-dim" style={{ left: `${s.end * 100}%`, right: 0 }} />
      {s.mode === 'classic' && s.loop && <div className="smp-loop" style={{ left: `${s.start * 100}%`, width: `${(s.end - s.start) * 100}%` }} />}
      {cuts.map((c, k) => (
        <div key={k} className={'smp-cut' + (flash === k ? ' flash' : '')} style={{ left: `${c * 100}%`, width: `${((cuts[k + 1] ?? s.end) - c) * 100}%` }}>
          <span>{noteName(SLICE_BASE + k)}</span>
        </div>
      ))}
      <div className="smp-handle start" style={{ left: `${s.start * 100}%` }} title="Drag to trim the start" />
      <div className="smp-handle end" style={{ left: `${s.end * 100}%` }} title="Drag to trim the end" />
    </div>
  );
}

/** Make a drum track whose rows are the slices, ready for the Beat Sequencer. */
async function kitFromSlices(track: Track): Promise<void> {
  const buf = track.samplerAudioId ? getBuffer(track.samplerAudioId) : undefined;
  if (!buf) return;
  const s = settingsOf(track);
  const n = Math.min(cutsOf(s).length, 24);
  if (!n) return;
  const rows = [...DRUM_LANES, ...Array.from({ length: 40 }, (_, i) => 88 + i)];
  const samples: Record<string, { audioId: string; name: string }> = {};
  for (let k = 0; k < n; k++) {
    const reg = samplerRegion(s, buf.duration, SLICE_BASE + k);
    if (!reg) continue;
    const id = uid('aud');
    await addBuffer(id, cutBuffer(getAudioContext(), buf, reg.from, reg.to, { reverse: s.reverse }), `Slice ${k + 1}`);
    samples[rows[k]] = { audioId: id, name: `Slice ${k + 1}` };
  }
  const id = addTrack('drums', 'kit-stark');
  updateTrack(id, (t) => {
    t.name = `${track.name} Chops`;
    t.drumSamples = samples;
  });
  createEmptyRegion(id, useStore.getState().cursor);
  useStore.setState({ selectedTrackId: id, dockTab: 'editor', editorMode: 'steps' });
  toast(`Made a drum kit from ${n} slices — click pads to build a beat`, 'success');
}

async function openMySamples(e: React.MouseEvent, track: Track) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const list = await loadSampleLibrary();
  const pick = async (id: string, name: string) => {
    await ensureClips([id]);
    const buf = getBuffer(id);
    if (!buf) return toast('That sample is missing from this browser', 'error');
    loadSound(track, id, buf, name);
  };
  const items: MenuItem[] = list.length
    ? [
        { title: 'My Samples' },
        ...list.slice(0, 40).map((x) => ({ label: `${x.name}  ·  ${x.duration.toFixed(1)}s`, onClick: () => void pick(x.id, x.name) })),
        { separator: true },
        { label: 'Remove from My Samples', submenu: list.slice(0, 40).map((x) => ({ label: x.name, onClick: () => void removeFromSampleLibrary(x.id) })) },
      ]
    : [{ label: 'Sounds you record or import are saved here for every song', disabled: true }];
  showContextMenu({ clientX: r.left, clientY: r.bottom + 4 }, items);
}

export default function SamplerSection({ track }: { track: Track }) {
  const [rec, setRec] = useState<null | { stop: () => Promise<AudioBuffer | null> }>(null);
  const [, setV] = useState(0);
  const level = useTransport((s) => s.levels.__mic ?? 0);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => onAudioChange(() => setV((v) => v + 1)), []);
  const buf = track.samplerAudioId ? getBuffer(track.samplerAudioId) : undefined;
  const s = settingsOf(track);
  const cuts = cutsOf(s);
  const len = buf ? (s.end - s.start) * buf.duration : 0;

  const toggleRec = async () => {
    if (rec) {
      const handle = rec;
      setRec(null);
      const b = await handle.stop();
      if (!b) {
        toast('Nothing was recorded', 'error');
        return;
      }
      const id = uid('a');
      await addBuffer(id, b, 'Recorded sample');
      loadSound(track, id, b, 'Recorded sample');
    } else {
      const h = await getEngine().recordSample(10);
      if (h) setRec(h);
    }
  };

  const setMode = (mode: SamplerSettings['mode']) => {
    const patch: Partial<SamplerSettings> = { mode };
    if (mode === 'slice' && buf && cuts.length < 2) patch.slices = detectSlices(buf, s.start * buf.duration, s.end * buf.duration, 16);
    setSettings(track.id, patch);
  };

  return (
    <div className="smp">
      <div className="smp-bar">
        <div className="seg smp-modes">
          {MODES.map((m) => (
            <button key={m.id} className={s.mode === m.id ? 'on' : ''} title={m.tip} onClick={() => setMode(m.id)} disabled={!buf}>
              {m.label}
            </button>
          ))}
        </div>
        {buf && (
          <>
            <button
              className="btn sm"
              title="Play the sound"
              onClick={() => {
                if (s.mode === 'slice') cuts.forEach((_, k) => setTimeout(() => previewKey(track.id, SLICE_BASE + k, 0.3), k * 220));
                else previewKey(track.id, track.samplerRoot ?? 60, len);
              }}
            >
              <Play size={12} fill="currentColor" /> Play
            </button>
            <button className={'btn sm' + (s.reverse ? ' active' : '')} title="Play the sound backwards" onClick={() => setSettings(track.id, { reverse: !s.reverse })}>
              <ArrowLeftRight size={13} /> Reverse
            </button>
            {s.mode === 'classic' && (
              <button className={'btn sm' + (s.loop ? ' active' : '')} title="Loop the trimmed part while a key is held (for pads and long notes)" onClick={() => setSettings(track.id, { loop: !s.loop })}>
                <Repeat size={13} /> Loop
              </button>
            )}
          </>
        )}
        <div className="spacer" />
        <button className="btn sm" title="Sounds you've recorded or imported, for any song" onClick={(e) => void openMySamples(e, track)}>
          <Library size={13} /> My Samples
        </button>
        <button className={'btn sm' + (rec ? ' danger' : '')} onClick={() => void toggleRec()}>
          {rec ? <Square size={12} fill="currentColor" /> : <Circle size={12} fill="currentColor" className="smp-rec-dot" />} {rec ? 'Stop' : 'Record'}
        </button>
        <button className="btn sm" onClick={() => fileRef.current?.click()}>
          <Upload size={13} /> Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const id = uid('a');
              const b = await addClip(id, f, f.name);
              loadSound(track, id, b, f.name);
            } catch {
              toast('Could not read that audio file', 'error');
            }
          }}
        />
      </div>

      <div className="smp-wave-box" style={{ borderColor: rec ? 'var(--record)' : undefined }}>
        {buf && !rec ? (
          <WaveEditor track={track} buf={buf} />
        ) : (
          <div className="smp-empty">
            <AudioWaveform size={22} />
            {rec ? 'Recording… make a sound, then press Stop' : 'Record or import a sound (or pick one from My Samples) to play it on the keyboard'}
          </div>
        )}
        {rec && (
          <div className="smp-meter">
            <LevelMeter value={level} />
          </div>
        )}
      </div>

      {buf && (
        <div className="smp-opts">
          {s.mode !== 'slice' ? (
            <>
              <label className="row smp-opt" title="The note the sample was recorded at; that key plays it at its own pitch">
                <span className="label">Root</span>
                <select value={track.samplerRoot ?? 60} onChange={(e) => updateTrack(track.id, (t) => void (t.samplerRoot = Number(e.target.value)))}>
                  {Array.from({ length: 73 }, (_, i) => 24 + i).map((p) => (
                    <option key={p} value={p}>
                      {noteName(p)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn sm"
                  title="Find the sample's pitch"
                  onClick={() => {
                    const r = detectPitch(buf, s.start * buf.duration, s.end * buf.duration);
                    if (r === null) return toast("Couldn't hear a clear pitch (drums and noises don't have one)", 'info');
                    updateTrack(track.id, (t) => void (t.samplerRoot = r));
                    toast(`Its pitch is ${noteName(r)}`, 'success');
                  }}
                >
                  <Wand2 size={12} /> Detect
                </button>
              </label>
              <Fade label="Fade In" value={s.fadeIn ?? 0} max={Math.min(2, len)} onChange={(v) => setSettings(track.id, { fadeIn: v })} />
              <Fade label="Fade Out" value={s.fadeOut ?? 0} max={Math.min(4, len)} onChange={(v) => setSettings(track.id, { fadeOut: v })} />
            </>
          ) : (
            <>
              <button className="btn sm" title="Find the hits and put a slice on each" onClick={() => setSettings(track.id, { slices: detectSlices(buf, s.start * buf.duration, s.end * buf.duration, 16) })}>
                <Wand2 size={12} /> Auto Chop
              </button>
              <span className="faint smp-opt-l">Equal:</span>
              {[4, 8, 16].map((n) => (
                <button key={n} className="btn sm" onClick={() => setSettings(track.id, { slices: equalSlices(n, s.start, s.end) })}>
                  {n}
                </button>
              ))}
              <button className="btn sm" title="Make a drum track with a row for each slice" onClick={() => void kitFromSlices(track)} disabled={!cuts.length}>
                <Drum size={12} /> Make Drum Kit
              </button>
              <span className="faint smp-hint">
                <Scissors size={11} /> {cuts.length} slices on {noteName(SLICE_BASE)}–{noteName(SLICE_BASE + Math.max(0, cuts.length - 1))} · click to hear · double-click to add or remove · drag to move
              </span>
            </>
          )}
          <span className="faint smp-len">{len.toFixed(2)}s</span>
        </div>
      )}
    </div>
  );
}

function Fade({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="row smp-opt" title={`${label}: ${value.toFixed(2)}s`}>
      <span className="label">{label}</span>
      <HSlider value={value} min={0} max={Math.max(0.01, max)} width={70} defaultValue={0} onChange={(v) => onChange(Math.round(v * 1000) / 1000)} />
    </span>
  );
}
