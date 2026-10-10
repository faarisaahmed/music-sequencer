// Mastering card on the master bus: presets + EQ, glue compression, loudness and ceiling.
import type { MasteringSettings, Project } from '../../model/types';
import { commit } from '../../state/store';
import { DEFAULT_MASTERING, MASTERING_PRESETS } from '../../audio/mixer';
import { Knob } from '../common/controls';

const db = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;

export default function MasteringCard({ p }: { p: Project }) {
  const m: MasteringSettings = { ...DEFAULT_MASTERING, ...p.mastering };
  const set = (patch: Partial<MasteringSettings>) =>
    commit((d) => {
      d.mastering = { ...DEFAULT_MASTERING, ...d.mastering, ...patch, preset: patch.preset ?? 'Custom' };
    });
  const color = '#ff9f0a';
  return (
    <div className="strip mastering">
      <div className="strip-color" style={{ background: 'linear-gradient(90deg,#ffd60a,#ff9f0a)' }} />
      <div className="strip-head">
        <div style={{ minWidth: 0 }}>
          <div className="strip-name">Mastering</div>
          <div className="strip-inst">{m.preset}</div>
        </div>
      </div>
      <div className="master-presets">
        {MASTERING_PRESETS.map((pr) => (
          <button key={pr.preset} className={'amp-model' + (m.preset === pr.preset ? ' on' : '')} onClick={() => set({ ...pr })}>
            {pr.preset}
          </button>
        ))}
      </div>
      <div className="master-knobs">
        <Knob size={34} label="Low" min={-6} max={6} bipolar color={color} value={m.low} defaultValue={0} format={db} onChange={(v) => set({ low: v })} />
        <Knob size={34} label="Mid" min={-6} max={6} bipolar color={color} value={m.mid} defaultValue={0} format={db} onChange={(v) => set({ mid: v })} />
        <Knob size={34} label="High" min={-8} max={8} bipolar color={color} value={m.high} defaultValue={0} format={db} onChange={(v) => set({ high: v })} />
        <Knob size={34} label="Glue" min={0} max={1} color={color} value={m.glue} defaultValue={0.3} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ glue: v })} />
        <Knob size={34} label="Loudness" min={0} max={9} color={color} value={m.loudness} defaultValue={0} format={db} onChange={(v) => set({ loudness: v })} />
        <Knob size={34} label="Ceiling" min={-6} max={0} color={color} value={m.ceiling} defaultValue={-1} format={(v) => `${v.toFixed(1)} dB`} onChange={(v) => set({ ceiling: v })} />
      </div>
    </div>
  );
}
