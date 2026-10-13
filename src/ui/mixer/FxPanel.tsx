import { useEffect, useRef, useState } from 'react';
import type { Draft } from 'immer';
import { Mic, Square, Upload, Power } from 'lucide-react';
import type { Track, TrackFx } from '../../model/types';
import { useStore, findTrack, toast } from '../../state/store';
import { setTrackInstrument, updateTrack } from '../../state/actions';
import { CATEGORIES, PRESETS, getPreset } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import { addBuffer, addClip, getPeaks, onAudioChange } from '../../audio/audioStore';
import { uid } from '../../model/defaults';
import { noteName } from '../../model/music';
import { Knob, HSlider } from '../common/controls';
import { TrackIcon } from '../common/icons';
import { gainToDb } from './MixerPanel';
import { InsertCards } from './InsertCards';
import { AUDIO_PATCHES } from '../../audio/audioPatches';
import { faderGain } from '../../audio/mixer';
import './mixer.css';

const NEUTRAL: Record<FxKey, number> = { eqLow: 0, eqMid: 0, eqHigh: 0, compressor: 0, drive: 0, chorus: 0, reverb: 0, delay: 0, filterCutoff: 1 };

type FxKey = Exclude<keyof TrackFx, 'inserts'>;
interface FxCardDef {
  id: string;
  name: string;
  color: string;
  keys: FxKey[];
  wide?: boolean;
}
const CARDS: FxCardDef[] = [
  { id: 'eq', name: 'Channel EQ', color: '#e3c35a', keys: ['eqLow', 'eqMid', 'eqHigh'], wide: true },
  { id: 'filter', name: 'Filter', color: '#e08a3c', keys: ['filterCutoff'] },
  { id: 'comp', name: 'Compressor', color: '#a07ae0', keys: ['compressor'] },
  { id: 'drive', name: 'Amp Drive', color: '#e05a4a', keys: ['drive'] },
  { id: 'chorus', name: 'Chorus', color: '#7fb8c4', keys: ['chorus'] },
  { id: 'reverb', name: 'Reverb', color: '#45b8c4', keys: ['reverb'] },
  { id: 'delay', name: 'Echo / Delay', color: '#5dbb7a', keys: ['delay'] },
];

const FX_PRESETS: Record<string, Partial<Record<FxKey, number>>> = {
  Dry: { ...NEUTRAL, compressor: 0.15 },
  Vocal: { eqLow: -3, eqMid: 2, eqHigh: 4, compressor: 0.6, drive: 0, chorus: 0, reverb: 0.3, delay: 0.15, filterCutoff: 1 },
  Bright: { eqLow: 0, eqMid: 1, eqHigh: 6, compressor: 0.3, drive: 0, chorus: 0.1, reverb: 0.15, delay: 0, filterCutoff: 1 },
  Warm: { eqLow: 3, eqMid: 0, eqHigh: -3, compressor: 0.3, drive: 0.1, chorus: 0, reverb: 0.2, delay: 0, filterCutoff: 0.8 },
  Punchy: { eqLow: 4, eqMid: -1, eqHigh: 3, compressor: 0.7, drive: 0.12, chorus: 0, reverb: 0.1, delay: 0, filterCutoff: 1 },
  'Lo-Fi': { eqLow: 2, eqMid: 1, eqHigh: -6, compressor: 0.4, drive: 0.3, chorus: 0.3, reverb: 0.2, delay: 0.05, filterCutoff: 0.55 },
  Radio: { eqLow: -12, eqMid: 6, eqHigh: -8, compressor: 0.5, drive: 0.4, chorus: 0, reverb: 0.05, delay: 0, filterCutoff: 0.7 },
  'Big Room': { eqLow: 1, eqMid: 0, eqHigh: 2, compressor: 0.4, drive: 0, chorus: 0.15, reverb: 0.6, delay: 0.25, filterCutoff: 1 },
  Ambient: { eqLow: -2, eqMid: 0, eqHigh: 1, compressor: 0.2, drive: 0, chorus: 0.4, reverb: 0.8, delay: 0.45, filterCutoff: 0.85 },
};

// Remember settings of bypassed effects per track.
const stash = new Map<string, Partial<Record<FxKey, number>>>();

function isOn(fx: TrackFx, keys: FxKey[]): boolean {
  return keys.some((k) => Math.abs(fx[k] - NEUTRAL[k]) > 1e-4);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const dbf = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;

/** Approximate EQ response for display (dB at frequency f). */
function eqResponse(fx: TrackFx, f: number): number {
  const lo = fx.eqLow / (1 + Math.pow(f / 220, 2));
  const hi = fx.eqHigh / (1 + Math.pow(5000 / f, 2));
  const oct = Math.log2(f / 1200);
  const mid = fx.eqMid * Math.exp(-(oct * oct) / (2 * 0.9 * 0.9));
  let cut = 0;
  const fc = 80 * Math.pow(250, fx.filterCutoff);
  if (fx.filterCutoff < 0.999) cut = -10 * Math.log10(1 + Math.pow(f / fc, 4));
  return lo + hi + mid + cut;
}

function EqCurve({ fx, color }: { fx: TrackFx; color: string }) {
  const w = 220;
  const h = 64;
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const f = 20 * Math.pow(1000, i / 60);
    const d = Math.max(-18, Math.min(18, eqResponse(fx, f)));
    pts.push(`${(i / 60) * w},${h / 2 - (d / 18) * (h / 2 - 4)}`);
  }
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ background: '#181716', borderRadius: 6 }}>
      {[100, 1000, 10000].map((f) => {
        const x = (Math.log10(f / 20) / 3) * w;
        return <line key={f} x1={x} x2={x} y1={0} y2={h} stroke="#2e2c2a" />;
      })}
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#373533" />
      <polygon points={`0,${h / 2} ${pts.join(' ')} ${w},${h / 2}`} fill={color} opacity={0.15} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

function FxCard({ def, t }: { def: FxCardDef; t: Track }) {
  const on = isOn(t.fx, def.keys);
  const set = (k: FxKey, v: number) => updateTrack(t.id, (x) => void (x.fx[k] = v));
  const toggle = () => {
    const key = t.id + ':' + def.id;
    updateTrack(t.id, (x) => {
      if (on) {
        const saved: Partial<Record<FxKey, number>> = {};
        for (const k of def.keys) {
          saved[k] = x.fx[k];
          x.fx[k] = NEUTRAL[k];
        }
        stash.set(key, saved);
      } else {
        const saved = stash.get(key);
        const defaults: Partial<Record<FxKey, number>> = { eqLow: 2, eqMid: 0, eqHigh: 2, filterCutoff: 0.7, compressor: 0.4, drive: 0.25, chorus: 0.35, reverb: 0.3, delay: 0.25 };
        for (const k of def.keys) x.fx[k] = saved?.[k] ?? defaults[k] ?? NEUTRAL[k];
      }
    });
  };
  const knob = (k: FxKey, label: string, min: number, max: number, fmt: (v: number) => string, bipolar = false) => (
    <Knob key={k} size={44} label={label} min={min} max={max} value={t.fx[k]} defaultValue={NEUTRAL[k] === 0 && !bipolar ? undefined : NEUTRAL[k]} bipolar={bipolar} color={def.color} format={fmt} onChange={(v) => set(k, v)} />
  );
  return (
    <div className={'fx-card' + (on ? '' : ' off') + (def.wide ? ' fx-wide' : '')}>
      <div className="fx-card-head">
        <span className="dot" style={{ background: on ? def.color : '#5a5753' }} />
        {def.name}
        <div className="spacer" />
        <button className={'btn sm icon' + (on ? ' active' : ' ghost')} title={on ? 'Bypass' : 'Enable'} onClick={toggle}>
          <Power size={13} />
        </button>
      </div>
      {def.id === 'eq' && <EqCurve fx={t.fx} color={def.color} />}
      <div className="fx-card-body">
        {def.id === 'eq' && (
          <>
            {knob('eqLow', 'Low', -12, 12, dbf, true)}
            {knob('eqMid', 'Mid', -12, 12, dbf, true)}
            {knob('eqHigh', 'High', -12, 12, dbf, true)}
          </>
        )}
        {def.id === 'filter' && knob('filterCutoff', 'Cutoff', 0, 1, (v) => `${Math.round(80 * Math.pow(250, v))} Hz`)}
        {def.id === 'comp' && knob('compressor', 'Amount', 0, 1, pct)}
        {def.id === 'drive' && knob('drive', 'Drive', 0, 1, pct)}
        {def.id === 'chorus' && knob('chorus', 'Mix', 0, 1, pct)}
        {def.id === 'reverb' && knob('reverb', 'Send', 0, 1, pct)}
        {def.id === 'delay' && knob('delay', 'Send', 0, 1, pct)}
      </div>
    </div>
  );
}

function SamplerSource({ t }: { t: Track }) {
  const [recording, setRecording] = useState<null | { stop: () => Promise<AudioBuffer | null> }>(null);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => onAudioChange(() => force((x) => x + 1)), []);
  const peaks = t.samplerAudioId ? getPeaks(t.samplerAudioId, 120) : undefined;
  const assign = (id: string) =>
    updateTrack(t.id, (x) => {
      x.samplerAudioId = id;
      x.samplerRoot = x.samplerRoot ?? 60;
    });
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="label">Sample</div>
      <div style={{ height: 54, background: '#161514', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 1, padding: '0 6px' }}>
        {peaks ? (
          Array.from({ length: 120 }, (_, i) => {
            const v = Math.max(Math.abs(peaks[i * 2]), Math.abs(peaks[i * 2 + 1]));
            return <div key={i} style={{ flex: 1, height: `${Math.max(2, v * 100)}%`, background: 'var(--purple)', borderRadius: 1 }} />;
          })
        ) : (
          <div className="faint" style={{ fontSize: 12, width: '100%', textAlign: 'center' }}>
            No sample yet — record or import one
          </div>
        )}
      </div>
      <div className="row">
        {recording ? (
          <button
            className="btn danger"
            onClick={async () => {
              const buf = await recording.stop();
              setRecording(null);
              if (!buf) return toast('Recording failed', 'error');
              const id = uid('a');
              await addBuffer(id, buf, 'Sample');
              assign(id);
              toast('Sample captured — play it on the keyboard', 'success');
            }}
          >
            <Square size={13} fill="currentColor" /> Stop
          </button>
        ) : (
          <button
            className="btn"
            onClick={async () => {
              const r = await getEngine().recordSample(10);
              if (r) setRecording(r);
            }}
          >
            <Mic size={14} /> Record
          </button>
        )}
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const id = uid('a');
              await addClip(id, f, f.name);
              assign(id);
            } catch {
              toast('Could not read that audio file', 'error');
            }
            e.target.value = '';
          }}
        />
      </div>
      <div className="row">
        <span className="dim" style={{ fontSize: 12 }}>
          Root note
        </span>
        <select value={t.samplerRoot ?? 60} onChange={(e) => updateTrack(t.id, (x) => void (x.samplerRoot = Number(e.target.value)))}>
          {Array.from({ length: 49 }, (_, i) => 36 + i).map((p) => (
            <option key={p} value={p}>
              {noteName(p)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function FxPanel() {
  const project = useStore((s) => s.project)!;
  const selId = useStore((s) => s.selectedTrackId);
  const t = findTrack(project, selId);
  if (!t) return <div className="empty-state">Select a track to see its Smart Controls.</div>;
  const preset = t.type === 'audio' ? null : getPreset(t.instrument);
  const setT = (fn: (x: Draft<Track>) => void) => updateTrack(t.id, fn);

  return (
    <div className="fxp">
      <div className="fxp-inst">
        <div className="fxp-inst-head">
          <div className="fxp-inst-icon" style={{ color: t.color }}>
            <TrackIcon track={t} size={26} />
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="fxp-inst-name">{t.name}</div>
            {preset ? (
              <select
                value={t.instrument}
                style={{ marginTop: 4, width: '100%' }}
                onChange={(e) => {
                  setTrackInstrument(t.id, e.target.value);
                }}
              >
                {CATEGORIES.filter((c) => (t.type === 'drums' ? c === 'Drums' : c !== 'Drums')).map((c) => (
                  <optgroup key={c} label={c}>
                    {PRESETS.filter((p) => p.category === c).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <div className="dim" style={{ fontSize: 12 }}>
                Audio Recorder
              </div>
            )}
          </div>
        </div>
        {preset && (
          <>
            <div className="fxp-knobs">
              {preset.controls.map((c) => (
                <Knob
                  key={c.key}
                  size={50}
                  label={c.label}
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  bipolar={c.min < 0}
                  color={t.color}
                  value={t.instrumentParams[c.key] ?? c.default}
                  defaultValue={c.default}
                  format={(v) => (c.key === 'tune' ? `${v > 0 ? '+' : ''}${Math.round(v)} st` : c.key === 'attack' || c.key === 'release' ? `${v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s'}` : pct(v))}
                  onChange={(v) => setT((x) => void (x.instrumentParams[c.key] = v))}
                />
              ))}
            </div>
            {preset.kind === 'user-sampler' && <SamplerSource t={t} />}
          </>
        )}
        <div className="label" style={{ marginTop: 4 }}>
          Track
        </div>
        <div className="row">
          <span className="dim" style={{ width: 62, fontSize: 12 }}>
            Volume
          </span>
          <HSlider value={t.volume} min={0} max={1.25} defaultValue={0.8} width="100%" color={t.color} onChange={(v) => setT((x) => void (x.volume = v))} />
          <span className="mono faint" style={{ fontSize: 11, width: 52, textAlign: 'right' }}>
            {gainToDb(faderGain(t.volume))}
          </span>
        </div>
        <div className="row">
          <span className="dim" style={{ width: 62, fontSize: 12 }}>
            Pan
          </span>
          <HSlider value={(t.pan + 1) / 2} min={0} max={1} defaultValue={0.5} width="100%" color="#939089" onChange={(v) => setT((x) => void (x.pan = v * 2 - 1))} />
          <span className="mono faint" style={{ fontSize: 11, width: 52, textAlign: 'right' }}>
            {Math.abs(t.pan) < 0.02 ? 'C' : t.pan < 0 ? `L${Math.round(-t.pan * 50)}` : `R${Math.round(t.pan * 50)}`}
          </span>
        </div>
        {t.type === 'instrument' && (
          <div className="row">
            <span className="dim" style={{ width: 62, fontSize: 12 }}>
              Transpose
            </span>
            <button className="btn sm icon" onClick={() => setT((x) => void (x.transpose = Math.max(-24, x.transpose - 1)))}>
              −
            </button>
            <span className="mono" style={{ width: 44, textAlign: 'center' }}>
              {t.transpose > 0 ? '+' : ''}
              {t.transpose}
            </span>
            <button className="btn sm icon" onClick={() => setT((x) => void (x.transpose = Math.min(24, x.transpose + 1)))}>
              +
            </button>
            <button className="btn sm ghost" onClick={() => setT((x) => void (x.transpose = 0))}>
              Reset
            </button>
          </div>
        )}
      </div>
      <div className="fxp-rack">
        <div className="fxp-presets">
          <span className="label" style={{ marginRight: 4 }}>
            Effect presets
          </span>
          <select
            value=""
            title="Load a full channel patch (amp, gate, vocal chain…)"
            onChange={(e) => {
              const patch = AUDIO_PATCHES.find((x) => x.id === e.target.value);
              if (patch) setT((x) => void (x.fx = structuredClone(patch.fx)));
            }}
          >
            <option value="">{t.type === 'audio' ? 'Audio patches…' : 'Channel patches…'}</option>
            {(['Guitar', 'Bass', 'Vocals', 'Creative'] as const).map((cat) => (
              <optgroup key={cat} label={cat}>
                {AUDIO_PATCHES.filter((x) => x.category === cat).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {Object.keys(FX_PRESETS).map((name) => (
            <button
              key={name}
              className="btn sm"
              onClick={() =>
                setT((x) => {
                  Object.assign(x.fx, FX_PRESETS[name]);
                })
              }
            >
              {name}
            </button>
          ))}
        </div>
        <div className="fx-cards">
          {CARDS.map((c) => (
            <FxCard key={c.id} def={c} t={t} />
          ))}
          <InsertCards t={t} />
        </div>
      </div>
    </div>
  );
}
