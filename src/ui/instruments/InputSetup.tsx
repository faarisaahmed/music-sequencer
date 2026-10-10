// Input device / gain / latency controls for recording.
import { useEffect, useState } from 'react';
import { getEngine } from '../../audio/engine';
import { listInputDevices, setInputSettings, useInputSettings } from '../../audio/inputSettings';
import { HSlider } from '../common/controls';

export default function InputSetup({ compact = false }: { compact?: boolean }) {
  const s = useInputSettings();
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const refresh = () => void listInputDevices().then(setDevices);
    refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
  }, []);
  return (
    <div className={'input-setup' + (compact ? ' compact' : '')}>
      <label className="row">
        <span className="dim is-label">Input</span>
        <select
          value={s.deviceId}
          onChange={async (e) => {
            setInputSettings({ deviceId: e.target.value });
            await getEngine().restartMic();
            void listInputDevices().then(setDevices);
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <option value="">System default</option>
          {devices
            .filter((d) => d.id && d.id !== 'default')
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
        </select>
      </label>
      <div className="row">
        <span className="dim is-label">Gain</span>
        <HSlider
          value={s.gainDb}
          min={-12}
          max={24}
          defaultValue={0}
          width="100%"
          undoable={false}
          onChange={(v) => {
            const db = Math.round(v * 2) / 2;
            setInputSettings({ gainDb: db });
            getEngine().setInputGain(db);
          }}
        />
        <span className="mono faint is-val">{s.gainDb > 0 ? '+' : ''}{s.gainDb.toFixed(1)} dB</span>
      </div>
      <div className="row" title="Shifts recordings earlier to compensate for audio-interface delay. Increase if your recordings land late.">
        <span className="dim is-label">Latency</span>
        <HSlider value={s.latencyMs} min={-50} max={150} defaultValue={0} width="100%" undoable={false} onChange={(v) => setInputSettings({ latencyMs: Math.round(v) })} />
        <span className="mono faint is-val">{s.latencyMs} ms</span>
      </div>
    </div>
  );
}
