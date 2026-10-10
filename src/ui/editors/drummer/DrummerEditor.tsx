// GarageBand-style Drummer Editor: drummer & presets, XY pad, kit-piece controls, fills & swing.
import { useRef } from 'react';
import { Dices, Wand2, Drum, Music2 } from 'lucide-react';
import { beginGesture, endGesture, findRegion, useStore } from '../../../state/store';
import { DRUMMERS, DRUMMER_PRESETS, drummerFor } from '../../../model/drummer';
import type { DrummerSettings } from '../../../model/types';
import { convertDrummerRegion, setTrackDrummer, updateDrummer } from '../../../state/drummerActions';
import { Knob, HSlider, Toggle } from '../../common/controls';
import { startDrag, clamp } from '../../common/drag';
import { beatsPerBar } from '../../../model/music';
import { commit, draftRegion } from '../../../state/store';
import './drummer.css';

function XYPad({ regionId, st, color }: { regionId: string; st: DrummerSettings; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const setFrom = (cx: number, cy: number) => {
    const r = ref.current!.getBoundingClientRect();
    const complexity = clamp((cx - r.left) / r.width, 0, 1);
    const loudness = clamp(1 - (cy - r.top) / r.height, 0, 1);
    updateDrummer(regionId, { complexity, loudness }, 'live');
  };
  return (
    <div
      ref={ref}
      className="dr-xy"
      onPointerDown={(e) => {
        e.preventDefault();
        beginGesture();
        setFrom(e.clientX, e.clientY);
        startDrag(
          e,
          ({ x, y }) => setFrom(x, y),
          () => endGesture(),
        );
      }}
    >
      <div className="dr-xy-grid" />
      <span className="dr-xy-l top">Loud</span>
      <span className="dr-xy-l bottom">Soft</span>
      <span className="dr-xy-l left">Simple</span>
      <span className="dr-xy-l right">Complex</span>
      <div className="dr-xy-cross" style={{ left: `${st.complexity * 100}%` }} />
      <div className="dr-xy-cross h" style={{ top: `${(1 - st.loudness) * 100}%` }} />
      <div className="dr-xy-puck" style={{ left: `${st.complexity * 100}%`, top: `${(1 - st.loudness) * 100}%`, background: color, boxShadow: `0 0 18px ${color}` }} />
    </div>
  );
}

function PieceRow({
  label,
  on,
  onToggle,
  value,
  onValue,
  left,
  right,
}: {
  label: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  value?: number;
  onValue?: (v: number) => void;
  left?: string;
  right?: string;
}) {
  return (
    <div className={'dr-piece' + (on ? '' : ' off')}>
      <Toggle on={on} onChange={onToggle} />
      <div className="dr-piece-name">{label}</div>
      {onValue && value !== undefined ? (
        <div className="dr-piece-slider">
          <span className="faint">{left}</span>
          <HSlider value={value} min={0} max={1} width={130} onChange={onValue} undoable={false} />
          <span className="faint">{right}</span>
        </div>
      ) : (
        <div className="dr-piece-slider" />
      )}
    </div>
  );
}

export default function DrummerEditor({ trackId, regionId }: { trackId: string; regionId: string }) {
  const project = useStore((s) => s.project)!;
  const found = findRegion(project, regionId);
  if (!found || found.region.kind !== 'midi' || !found.region.drummer) return null;
  const { track, region } = found;
  const st = found.region.drummer;
  const who = drummerFor(st.style);
  const bpb = beatsPerBar(project.timeSig);
  const set = (patch: Partial<DrummerSettings>) => updateDrummer(regionId, patch);
  // Slider gestures: one undo step per drag.
  const liveSet = (patch: Partial<DrummerSettings>) => {
    if (!useStore.getState().gestureOpen) {
      beginGesture();
      const end = () => {
        endGesture();
        window.removeEventListener('pointerup', end);
      };
      window.addEventListener('pointerup', end);
    }
    updateDrummer(regionId, patch, 'live');
  };
  const instrumentTracks = project.tracks.filter((t) => t.id !== trackId && t.type !== 'audio' && t.type !== 'drums');
  const activePreset = DRUMMER_PRESETS.find((p) => Object.entries(p.values).every(([k, v]) => Math.abs((st[k as keyof DrummerSettings] as number) - (v as number)) < 0.02));

  return (
    <div className="dr-root">
      <div className="dr-left">
        <div className="dr-who" style={{ ['--c' as string]: who.color }}>
          <div className="dr-avatar">{who.name[0]}</div>
          <div>
            <div className="dr-name">
              {who.name} <span className="faint">· {who.genre}</span>
            </div>
            <div className="dr-bio">{who.bio}</div>
          </div>
        </div>
        <div className="label" style={{ margin: '10px 2px 6px' }}>
          Drummers
        </div>
        <div className="dr-drummers">
          {DRUMMERS.map((d) => (
            <button
              key={d.style}
              className={'dr-drummer' + (d.style === st.style ? ' on' : '')}
              style={{ ['--c' as string]: d.color }}
              onClick={() => setTrackDrummer(track.id, d.style)}
              title={d.bio}
            >
              <span className="dr-mini-avatar">{d.name[0]}</span>
              <span>
                <b>{d.genre}</b>
                <i>{d.name}</i>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="dr-center">
        <div className="dr-presets">
          {DRUMMER_PRESETS.map((p) => (
            <button key={p.name} className={'dr-preset' + (activePreset === p ? ' on' : '')} onClick={() => set(p.values)}>
              {p.name}
            </button>
          ))}
        </div>
        <XYPad regionId={regionId} st={st} color={who.color} />
        <div className="dr-xy-readout faint">
          Complexity {Math.round(st.complexity * 100)}% · Loudness {Math.round(st.loudness * 100)}%
        </div>
      </div>

      <div className="dr-right">
        <div className="label" style={{ marginBottom: 6 }}>
          Kit
        </div>
        <PieceRow
          label="Percussion"
          on={st.pieces.perc}
          onToggle={(v) => set({ pieces: { ...st.pieces, perc: v } })}
          value={st.percVar}
          onValue={(v) => liveSet({ percVar: v })}
          left="Sparse"
          right="Busy"
        />
        <PieceRow
          label="Hi-Hat & Ride"
          on={st.pieces.hats}
          onToggle={(v) => set({ pieces: { ...st.pieces, hats: v } })}
          value={st.hatVar}
          onValue={(v) => liveSet({ hatVar: v })}
          left="Closed"
          right="Ride"
        />
        <PieceRow
          label="Kick & Snare"
          on={st.pieces.kit}
          onToggle={(v) => set({ pieces: { ...st.pieces, kit: v } })}
          value={st.kickVar}
          onValue={(v) => liveSet({ kickVar: v })}
          left="Simple"
          right="Busy"
        />
        <PieceRow label="Toms (fills)" on={st.pieces.toms} onToggle={(v) => set({ pieces: { ...st.pieces, toms: v } })} />
        <PieceRow label="Crash Cymbals" on={st.pieces.cymbals} onToggle={(v) => set({ pieces: { ...st.pieces, cymbals: v } })} />

        <div className="dr-knobs">
          <Knob label="Fills" value={st.fills} min={0} max={1} onChange={(v) => updateDrummer(regionId, { fills: v }, 'live')} format={(v) => `${Math.round(v * 100)}%`} defaultValue={0.45} size={46} color={who.color} />
          <Knob label="Swing" value={st.swing} min={0} max={1} onChange={(v) => updateDrummer(regionId, { swing: v }, 'live')} format={(v) => (v < 0.02 ? 'Straight' : `${Math.round(v * 100)}%`)} defaultValue={0} size={46} color={who.color} />
          <div className="dr-follow">
            <div className="knob-label">Follow</div>
            <select
              value={st.followTrackId ?? ''}
              onChange={(e) => set({ followTrackId: e.target.value || null })}
              title="Make the kick drum follow the rhythm of another track (e.g. the bass)"
            >
              <option value="">Off</option>
              {instrumentTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="dr-actions">
          <button className="btn sm" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })} title="Same settings, a fresh performance">
            <Dices size={14} /> New Take
          </button>
          <div className="row" style={{ gap: 4 }} title="Region length in bars">
            <Music2 size={13} className="dim" />
            <select
              value={Math.round(region.length / bpb)}
              onChange={(e) =>
                commit((d) => {
                  const r = draftRegion(d, regionId);
                  if (r) r.length = Number(e.target.value) * bpb;
                })
              }
            >
              {[1, 2, 4, 8, 12, 16, 24, 32].map((n) => (
                <option key={n} value={n}>
                  {n} bar{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          <button className="btn sm" onClick={() => convertDrummerRegion(regionId)} title="Freeze this performance into an ordinary editable MIDI region">
            <Wand2 size={14} /> Convert to MIDI
          </button>
        </div>
        <div className="dr-tip faint">
          <Drum size={12} /> Notes regenerate automatically when you resize or move the region. Fills land before each section change.
        </div>
      </div>
    </div>
  );
}
