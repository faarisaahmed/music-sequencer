import { useEffect, useRef, useState } from 'react';
import type { Draft } from 'immer';
import { Plus, Circle } from 'lucide-react';
import type { Project, Track } from '../../model/types';
import { commit, openModal, useStore, useTransport } from '../../state/store';
import { updateTrack } from '../../state/actions';
import { faderGain } from '../../audio/mixer';
import { getPreset } from '../../audio/presets';
import { Knob, VFader } from '../common/controls';
import { TrackIcon } from '../common/icons';
import './mixer.css';
import MasteringCard from './MasteringCard';

export function gainToDb(g: number): string {
  if (g <= 0.0001) return '-∞';
  const db = 20 * Math.log10(g);
  return (db > 0 ? '+' : '') + db.toFixed(1);
}

/** Map a linear peak (0..1+) to a meter fraction (-60dB..+3dB). */
function meterFrac(v: number): number {
  if (v <= 0.00001) return 0;
  const db = 20 * Math.log10(v);
  return Math.max(0, Math.min(1, (db + 60) / 63));
}

export function Meter({ ids, height }: { ids: string[]; height?: number | string }) {
  const all = useTransport((s) => s.levels);
  const levels = ids.map((id) => all[id] ?? 0);
  const peaks = useRef<{ v: number; t: number }[]>([]);
  const now = performance.now();
  return (
    <div className="meter" style={{ height }}>
      {levels.map((lv, i) => {
        const f = meterFrac(lv);
        const p = peaks.current[i] ?? { v: 0, t: 0 };
        if (f >= p.v || now - p.t > 1200) peaks.current[i] = { v: f, t: now };
        const pk = peaks.current[i].v;
        return (
          <div key={i} className="meter-bar">
            <div className="meter-fill" style={{ height: `${f * 100}%`, backgroundSize: typeof height === 'number' ? `100% ${height}px` : undefined }} />
            {pk > 0.02 && <div className="meter-peak" style={{ bottom: `calc(${pk * 100}% - 2px)`, background: pk > 0.95 ? 'var(--record)' : undefined }} />}
          </div>
        );
      })}
    </div>
  );
}

const panFmt = (v: number) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 50)}` : `R${Math.round(v * 50)}`);

/** Height of an element, tracked with ResizeObserver. */
function useHeight<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [h, setH] = useState(100);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  return [ref, h];
}

function Strip({ t, selected }: { t: Track; selected: boolean }) {
  const set = (fn: (x: Draft<Track>) => void) => updateTrack(t.id, fn);
  const preset = t.type === 'audio' ? null : getPreset(t.instrument);
  const instName = !preset ? 'Audio Recorder' : preset.name === t.name ? preset.category : preset.name;
  const [faderRef, fh] = useHeight<HTMLDivElement>();
  const k = (label: string, key: 'eqLow' | 'eqMid' | 'eqHigh' | 'compressor' | 'reverb' | 'delay', color: string, bip: boolean, def: number) => (
    <Knob size={26} label={label} bipolar={bip} min={bip ? -12 : 0} max={bip ? 12 : 1} value={t.fx[key]} defaultValue={def} color={color} onChange={(v) => set((x) => void (x.fx[key] = v))} />
  );
  return (
    <div className={'strip' + (selected ? ' selected' : '')} onPointerDown={() => useStore.setState({ selectedTrackId: t.id })}>
      <div className="strip-color" style={{ background: t.color }} />
      <div className="strip-head">
        <span style={{ color: t.color, display: 'flex' }}>
          <TrackIcon track={t} size={17} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="strip-name" title={t.name}>
            {t.name}
          </div>
          <div className="strip-inst">{instName}</div>
        </div>
      </div>
      <div className="strip-body">
        <div className="strip-knobs">
          {k('Low', 'eqLow', '#e08a3c', true, 0)}
          {k('Comp', 'compressor', '#a07ae0', false, 0.2)}
          {k('Mid', 'eqMid', '#e3c35a', true, 0)}
          {k('Verb', 'reverb', '#45b8c4', false, 0.15)}
          {k('High', 'eqHigh', '#7fb8c4', true, 0)}
          {k('Delay', 'delay', '#5dbb7a', false, 0)}
          <div style={{ gridColumn: 'span 2' }}>
            <Knob size={28} label={'Pan ' + panFmt(t.pan)} bipolar min={-1} max={1} value={t.pan} defaultValue={0} color="#e2dfd9" onChange={(v) => set((x) => void (x.pan = v))} />
          </div>
        </div>
        <div className="strip-fader-row" ref={faderRef}>
          <VFader value={t.volume} height={Math.max(40, fh - 12)} onChange={(v) => set((x) => void (x.volume = v))} />
          <Meter ids={[t.id, t.id]} height={Math.max(40, fh - 12)} />
        </div>
      </div>
      <div className="strip-foot">
        <div className="strip-db">{gainToDb(faderGain(t.volume))}</div>
        <div className="strip-btns">
          <button className={'ms-btn m' + (t.mute ? ' on' : '')} title="Mute (M)" onClick={() => set((x) => void (x.mute = !x.mute))}>
            M
          </button>
          <button className={'ms-btn s' + (t.solo ? ' on' : '')} title="Solo (S)" onClick={() => set((x) => void (x.solo = !x.solo))}>
            S
          </button>
          <button className={'ms-btn r' + (t.armed ? ' on' : '')} title="Record enable" onClick={() => set((x) => void (x.armed = !x.armed))}>
            <Circle size={9} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MasterStrip({ p }: { p: Project }) {
  const edit = (fn: (d: Draft<Project>) => void) => commit(fn);
  const [faderRef, fh] = useHeight<HTMLDivElement>();
  return (
    <div className="strip master">
      <div className="strip-color" style={{ background: 'linear-gradient(90deg,#e08a3c,#d0586a)' }} />
      <div className="strip-head">
        <div style={{ minWidth: 0 }}>
          <div className="strip-name">Master</div>
          <div className="strip-inst">Stereo Out</div>
        </div>
      </div>
      <div className="strip-body">
        <div className="col" style={{ gap: 6, width: 92, flexShrink: 0 }}>
          <div className="strip-sec">REVERB</div>
          <select value={p.reverbType} onChange={(e) => edit((d) => void (d.reverbType = e.target.value as Project['reverbType']))}>
            <option value="room">Room</option>
            <option value="plate">Plate</option>
            <option value="hall">Hall</option>
            <option value="cathedral">Cathedral</option>
          </select>
          <div className="strip-sec">ECHO</div>
          <select value={p.delayTime} onChange={(e) => edit((d) => void (d.delayTime = e.target.value as Project['delayTime']))}>
            <option value="1/4">1/4</option>
            <option value="1/4d">1/4 dotted</option>
            <option value="1/8">1/8</option>
            <option value="1/8d">1/8 dotted</option>
            <option value="1/16">1/16</option>
          </select>
          <Knob size={28} label="Feedback" min={0} max={0.85} value={p.delayFeedback} defaultValue={0.35} onChange={(v) => edit((d) => void (d.delayFeedback = v))} />
        </div>
        <div className="strip-fader-row" ref={faderRef}>
          <VFader value={p.masterVolume} height={Math.max(40, fh - 12)} defaultValue={0.85} onChange={(v) => edit((d) => void (d.masterVolume = v))} />
          <Meter ids={['__masterL', '__masterR']} height={Math.max(40, fh - 12)} />
        </div>
      </div>
      <div className="strip-foot">
        <div className="strip-db">{gainToDb(faderGain(p.masterVolume))} dB</div>
      </div>
    </div>
  );
}

export default function MixerPanel() {
  const p = useStore((s) => s.project)!;
  const sel = useStore((s) => s.selectedTrackId);
  return (
    <div className="mixer">
      <div className="mixer-strips">
        {p.tracks.map((t) => (
          <Strip key={t.id} t={t} selected={t.id === sel} />
        ))}
        <button className="mixer-add" title="New Track" onClick={() => openModal('newTrack')}>
          <Plus size={20} />
        </button>
      </div>
      {/* Mastering and the master strip stay pinned while track strips scroll. */}
      <div className="mixer-pinned">
        <MasteringCard p={p} />
        <MasterStrip p={p} />
      </div>
    </div>
  );
}

