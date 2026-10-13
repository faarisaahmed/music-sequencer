// Audio region editor: waveform with trim, fade and gain handles, plus reverse,
// normalize, loop and "convert to Sampler" (sampling) tools.
import { meterOf, tempoOf } from '../../model/timeline';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, Repeat, FlipHorizontal2, AudioWaveform, Maximize, Eraser } from 'lucide-react';
import type { AudioRegion } from '../../model/types';
import { uid } from '../../model/defaults';
import { formatTime } from '../../model/music';
import { beginGesture, commit, draftRegion, endGesture, findRegion, live, toast, useStore, useTransport } from '../../state/store';
import { addTrack, updateTrack } from '../../state/actions';
import { addBuffer, getBuffer, getPeaks, onAudioChange } from '../../audio/audioStore';
import { getAudioContext } from '../../audio/context';
import { getEngine } from '../../audio/engine';
import { HSlider } from '../common/controls';
import { clamp, startDrag } from '../common/drag';
import { useElementSize } from '../common/useElementSize';
import './pianoroll.css';

const PEAK_BINS = 6000;

function editAudio(regionId: string, recipe: (r: AudioRegion) => void, mode: 'commit' | 'live' = 'commit') {
  (mode === 'commit' ? commit : live)((d) => {
    const r = draftRegion(d, regionId);
    if (r?.kind === 'audio') recipe(r as AudioRegion);
  });
}

const dbOf = (g: number) => (g <= 0.0001 ? -60 : 20 * Math.log10(g));
const gainOf = (db: number) => Math.pow(10, db / 20);

export default function AudioEditor({ trackId, regionId }: { trackId: string; regionId: string }) {
  const region = useStore((s) => findRegion(s.project, regionId)?.region) as AudioRegion | undefined;
  const track = useStore((s) => s.project?.tracks.find((t) => t.id === trackId));
  const project = useStore((s) => s.project)!;
  const [audioVer, setAudioVer] = useState(0);
  const [ppb, setPpb] = useState(40);
  const [scrollX, setScrollX] = useState(0);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(scrollRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const didFit = useRef(false);

  useEffect(() => onAudioChange(() => setAudioVer((v) => v + 1)), []);
  useLayoutEffect(() => setSlot(document.getElementById('editor-toolbar-slot')), []);

  // The clip plays in real time from where its content starts; convert through the song's tempo.
  const tm = tempoOf(project);
  const clipBase = region ? region.start - region.offset : 0;
  const secOf = (contentBeat: number) => tm.span(clipBase, clipBase + contentBeat);
  const buf = region ? getBuffer(region.audioId) : undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const peaks = useMemo(() => (region ? getPeaks(region.audioId, PEAK_BINS) : undefined), [region?.audioId, audioVer]);
  const bufBeats = buf ? tm.beat(tm.sec(clipBase) + buf.duration) - clipBase : region ? region.offset + region.length : 4;
  const regionEndC = region ? region.offset + region.length : 0; // in content beats
  const totalBeats = Math.max(bufBeats, regionEndC) + 2;
  const pad = 24; // left padding px

  // Fit to width once
  useLayoutEffect(() => {
    if (didFit.current || !size.w || !region) return;
    didFit.current = true;
    setPpb(clamp((size.w - pad * 2) / Math.max(1, totalBeats), 4, 300));
  }, [size.w, region, totalBeats]);

  // Draw waveform
  useEffect(() => {
    const c = canvasRef.current;
    const { w, h } = size;
    if (!c || !w || !h || !region) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#191817';
    ctx.fillRect(0, 0, w, h);
    const xOf = (beat: number) => pad + beat * ppb - scrollX;
    const top = 26;
    const mid = top + (h - top - 8) / 2;
    const amp = (h - top - 12) / 2;
    // beat grid (song bars)
    const meter = meterOf(project);
    const songBase = region.start - region.offset;
    const v0 = Math.floor(scrollX / ppb) - 1;
    const v1 = (scrollX + w) / ppb + 1;
    if (ppb >= 10)
      for (let b = v0; b <= v1; b++) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(Math.round(xOf(b)), 0, 1, h);
      }
    for (const bar of meter.bars(songBase + v0, songBase + v1)) {
      const x = xOf(bar.start - songBase);
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(Math.round(x), 0, 1, h);
      ctx.fillStyle = '#a19e96';
      ctx.font = '600 10px "IBM Plex Sans", sans-serif';
      ctx.fillText(String(bar.bar + 1), x + 3, 12);
    }
    // region area
    const rx0 = xOf(region.offset);
    const rx1 = xOf(regionEndC);
    ctx.fillStyle = 'rgba(109, 151, 184,0.10)';
    ctx.fillRect(rx0, top, rx1 - rx0, h - top - 4);
    ctx.fillStyle = 'rgba(109, 151, 184,0.5)';
    ctx.fillRect(rx0, top - 4, rx1 - rx0, 3);
    // centre line
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, Math.round(mid), w, 1);

    // gain envelope at content beat c
    const envAt = (cb: number) => {
      let g = region.gain;
      const t = cb - region.offset; // beats into region
      if (region.fadeIn > 0 && t < region.fadeIn) g *= Math.max(0, t / region.fadeIn);
      if (region.fadeOut > 0 && t > region.length - region.fadeOut) g *= Math.max(0, (region.length - t) / region.fadeOut);
      return g;
    };

    if (peaks && buf) {
      const bins = peaks.length / 2;
      for (let x = 0; x < w; x++) {
        const cb = (x + scrollX - pad) / ppb;
        if (cb < 0 || cb >= bufBeats) continue;
        let bin = Math.floor((cb / bufBeats) * bins);
        if (region.reversed) bin = bins - 1 - bin;
        const binEnd = Math.max(bin + 1, Math.floor(((cb + 1 / ppb) / bufBeats) * bins));
        let lo = 0;
        let hi = 0;
        for (let i = bin; i < Math.min(bins, binEnd); i++) {
          lo = Math.min(lo, peaks[i * 2]);
          hi = Math.max(hi, peaks[i * 2 + 1]);
        }
        const inside = cb >= region.offset && cb < regionEndC;
        const g = inside ? envAt(cb) : region.gain;
        const yTop = mid - Math.min(1, hi * g) * amp;
        const yBot = mid - Math.max(-1, lo * g) * amp;
        ctx.fillStyle = inside ? (Math.max(hi, -lo) * g > 0.99 ? '#e0735e' : '#f2bd68') : 'rgba(133, 129, 124,0.35)';
        ctx.fillRect(x, yTop, 1, Math.max(1, yBot - yTop));
      }
    } else {
      ctx.fillStyle = '#74716c';
      ctx.font = '12px "IBM Plex Sans", sans-serif';
      ctx.fillText('Loading audio…', pad + 10, mid);
    }
    // Loop repeats ghost
    if (region.loop && buf) {
      ctx.fillStyle = 'rgba(227, 195, 90,0.7)';
      ctx.fillRect(xOf(region.contentLength), top, 2, h - top - 4);
    }
    // Fade curves
    ctx.strokeStyle = '#e3c35a';
    ctx.lineWidth = 1.5;
    if (region.fadeIn > 0) {
      ctx.beginPath();
      ctx.moveTo(rx0, h - 6);
      ctx.lineTo(xOf(region.offset + region.fadeIn), top + 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(rx0, top);
      ctx.lineTo(xOf(region.offset + region.fadeIn), top);
      ctx.lineTo(rx0, h - 6);
      ctx.fill();
    }
    if (region.fadeOut > 0) {
      ctx.beginPath();
      ctx.moveTo(xOf(regionEndC - region.fadeOut), top + 2);
      ctx.lineTo(rx1, h - 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(rx1, top);
      ctx.lineTo(xOf(regionEndC - region.fadeOut), top);
      ctx.lineTo(rx1, h - 6);
      ctx.fill();
    }
  }, [size, ppb, scrollX, region, peaks, buf, bufBeats, regionEndC, project.timeSig]);

  if (!region || region.kind !== 'audio' || !track) return <div className="empty-state">Region not found</div>;

  const xOf = (beat: number) => pad + beat * ppb - scrollX;
  const top = 26;

  const dragHandle = (e: React.PointerEvent, kind: 'trimL' | 'trimR' | 'fadeIn' | 'fadeOut') => {
    e.preventDefault();
    e.stopPropagation();
    const o = { ...region };
    const maxEnd = region.loop ? Infinity : bufBeats;
    beginGesture();
    startDrag(
      e,
      ({ dx, event }) => {
        let d = dx / ppb;
        if (!event.metaKey && !event.ctrlKey && kind.startsWith('trim')) d = Math.round(d * 4) / 4; // 1/16 snap
        editAudio(
          regionId,
          (r) => {
            if (kind === 'trimL') {
              const nOff = clamp(o.offset + d, 0, o.offset + o.length - 0.1);
              const delta = nOff - o.offset;
              if (o.start + delta < 0) return;
              r.offset = nOff;
              r.start = o.start + delta;
              r.length = o.length - delta;
              if (!r.loop) r.contentLength = r.offset + r.length;
              r.fadeIn = Math.min(r.fadeIn, r.length);
            } else if (kind === 'trimR') {
              r.length = clamp(o.length + d, 0.1, maxEnd - o.offset);
              if (!r.loop) r.contentLength = r.offset + r.length;
              r.fadeOut = Math.min(r.fadeOut, r.length);
            } else if (kind === 'fadeIn') {
              r.fadeIn = clamp(o.fadeIn + d, 0, o.length - o.fadeOut);
            } else {
              r.fadeOut = clamp(o.fadeOut - d, 0, o.length - o.fadeIn);
            }
          },
          'live',
        );
      },
      () => endGesture(),
    );
  };

  const normalize = () => {
    if (!buf) return;
    let peak = 0;
    const s0 = Math.floor(secOf(region.offset) * buf.sampleRate);
    const s1 = Math.min(buf.length, Math.floor(secOf(region.offset + region.length) * buf.sampleRate));
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      const a = region.reversed ? buf.length - s1 : s0;
      const b = region.reversed ? buf.length - s0 : s1;
      for (let i = Math.max(0, a); i < b; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    if (peak < 1e-5) return toast('Region is silent', 'error');
    editAudio(regionId, (r) => {
      r.gain = 0.97 / peak;
    });
    toast(`Normalized (${dbOf(0.97 / peak) >= 0 ? '+' : ''}${dbOf(0.97 / peak).toFixed(1)} dB)`, 'success');
  };

  const toSampler = async () => {
    if (!buf) return;
    const ctx = getAudioContext();
    const s0 = Math.floor(secOf(region.offset) * buf.sampleRate);
    const s1 = Math.min(buf.length, Math.floor(secOf(region.offset + Math.min(region.length, region.loop ? region.contentLength : region.length)) * buf.sampleRate));
    const len = Math.max(1, s1 - s0);
    const src = getBuffer(region.audioId, region.reversed) ?? buf;
    const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = src.getChannelData(ch).slice(s0, s0 + len);
      const g = region.gain;
      if (g !== 1) for (let i = 0; i < data.length; i++) data[i] *= g;
      out.copyToChannel(data, ch);
    }
    const id = uid('a');
    await addBuffer(id, out, region.name + ' sample');
    const tid = addTrack('instrument', 'user-sampler');
    updateTrack(tid, (t) => {
      t.samplerAudioId = id;
      t.samplerRoot = 60;
      t.name = ('Sampler: ' + region.name).slice(0, 28);
    });
    useStore.setState({ selectedTrackId: tid, dockTab: 'instrument' });
    toast('Created a Sampler instrument — play it on the keyboard (root C4)', 'success');
  };

  const zoom = (f: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const center = (el.scrollLeft + el.clientWidth / 2 - pad) / ppb;
    const next = clamp(ppb * f, 2, 400);
    setPpb(next);
    requestAnimationFrame(() => (el.scrollLeft = center * next + pad - el.clientWidth / 2));
  };

  const gainDb = dbOf(region.gain);
  const toolbar = (
    <div className="ae-toolbar">
      <div className="row" style={{ gap: 6 }} title="Region gain">
        <span className="faint" style={{ fontSize: 11 }}>
          Gain
        </span>
        <HSlider value={clamp(gainDb, -30, 18)} min={-30} max={18} width={90} defaultValue={0} onChange={(db) => editAudio(regionId, (r) => void (r.gain = gainOf(db)), 'live')} />
        <span className="mono faint" style={{ fontSize: 10.5, width: 50 }}>
          {gainDb >= 0 ? '+' : ''}
          {gainDb.toFixed(1)} dB
        </span>
      </div>
      <button className="btn sm" onClick={normalize} title="Raise gain so the loudest peak hits 0 dB">
        <Maximize size={13} /> Normalize
      </button>
      <button className={'btn sm' + (region.reversed ? ' active' : '')} onClick={() => editAudio(regionId, (r) => void (r.reversed = !r.reversed))} title="Play the audio backwards">
        <FlipHorizontal2 size={13} /> Reverse
      </button>
      <button
        className={'btn sm' + (region.loop ? ' active' : '')}
        onClick={() =>
          editAudio(regionId, (r) => {
            r.loop = !r.loop;
            if (r.loop) r.contentLength = Math.max(0.25, r.offset + r.length);
            else r.contentLength = r.offset + r.length;
          })
        }
        title="Loop the region when extended"
      >
        <Repeat size={13} /> Loop
      </button>
      <div className="row" style={{ gap: 4 }} title="Fade lengths (drag the yellow handles on the waveform)">
        <button className="btn sm" onClick={() => editAudio(regionId, (r) => void (r.fadeIn = Math.min(r.length / 2, 1)))}>
          Fade In
        </button>
        <button className="btn sm" onClick={() => editAudio(regionId, (r) => void (r.fadeOut = Math.min(r.length / 2, 2)))}>
          Fade Out
        </button>
        <button
          className="btn sm icon"
          title="Remove fades"
          onClick={() =>
            editAudio(regionId, (r) => {
              r.fadeIn = 0;
              r.fadeOut = 0;
            })
          }
        >
          <Eraser size={13} />
        </button>
      </div>
      <button className="btn sm primary" onClick={() => void toSampler()} title="Turn this audio into a playable Sampler instrument">
        <AudioWaveform size={13} /> Make Sampler Instrument
      </button>
      <div className="row" style={{ gap: 2 }}>
        <button className="btn sm icon" onClick={() => zoom(1 / 1.4)} title="Zoom out">
          <ZoomOut size={13} />
        </button>
        <button className="btn sm icon" onClick={() => zoom(1.4)} title="Zoom in">
          <ZoomIn size={13} />
        </button>
      </div>
    </div>
  );

  const seek = (clientX: number) => {
    const el = scrollRef.current!;
    const rect = el.getBoundingClientRect();
    const cb = (clientX - rect.left + el.scrollLeft - pad) / ppb;
    getEngine().seek(Math.max(0, region.start + (cb - region.offset)));
  };

  const fadeInX = xOf(region.offset + region.fadeIn);
  const fadeOutX = xOf(regionEndC - region.fadeOut);

  return (
    <div className="ae-root">
      {slot ? createPortal(toolbar, slot) : <div style={{ padding: '6px 10px' }}>{toolbar}</div>}
      <div className="ae-body">
        <canvas ref={canvasRef} className="ae-canvas" />
        <div
          ref={scrollRef}
          className="ae-scroll"
          onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            seek(e.clientX);
            startDrag(e, ({ x }) => seek(x));
          }}
          onWheel={(e) => {
            if (e.metaKey || e.ctrlKey) zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
          }}
        >
          <div style={{ width: totalBeats * ppb + pad * 2, height: '100%' }} />
        </div>
        <div className="ae-trim" style={{ left: xOf(region.offset) }} title="Trim start" onPointerDown={(e) => dragHandle(e, 'trimL')} />
        <div className="ae-trim" style={{ left: xOf(regionEndC) }} title="Trim end" onPointerDown={(e) => dragHandle(e, 'trimR')} />
        <div className="ae-handle" style={{ left: fadeInX, top: top + 4, borderColor: '#e3c35a' }} title="Fade in" onPointerDown={(e) => dragHandle(e, 'fadeIn')} />
        <div className="ae-handle" style={{ left: fadeOutX, top: top + 4, borderColor: '#e3c35a' }} title="Fade out" onPointerDown={(e) => dragHandle(e, 'fadeOut')} />
        <AudioPlayhead region={region} xOf={xOf} />
      </div>
      <div className="ae-info">
        <span>
          Clip <b>{region.name}</b>
        </span>
        <span>
          Starts <b className="mono">{meterOf(project).format(region.start)}</b>
        </span>
        <span>
          Length <b className="mono">{formatTime(tm.span(region.start, region.start + region.length))}</b>
        </span>
        <span>
          Source <b className="mono">{buf ? formatTime(buf.duration) : '—'}</b>
        </span>
        <span>
          Fades <b className="mono">{tm.span(region.start, region.start + region.fadeIn).toFixed(2)}s / {tm.span(region.start + region.length - region.fadeOut, region.start + region.length).toFixed(2)}s</b>
        </span>
        <span className="faint">Drag the blue edges to trim, yellow dots to fade · ⌘-scroll to zoom</span>
      </div>
    </div>
  );
}

function AudioPlayhead({ region, xOf }: { region: AudioRegion; xOf: (b: number) => number }) {
  const position = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  const cursor = useStore((s) => s.cursor);
  const pos = playing ? position : cursor;
  const rel = pos - region.start;
  if (rel < 0 || rel > region.length) return null;
  let c = region.offset + rel;
  if (region.loop && region.contentLength > 0) c = c % region.contentLength;
  return <div className="pr-playhead" style={{ transform: `translateX(${xOf(c)}px)` }} />;
}
