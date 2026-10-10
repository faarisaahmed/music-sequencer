// Sample area for the user Sampler instrument: record/import a sound and set its root note.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AudioWaveform, Circle, Square, Upload } from 'lucide-react';
import type { Track } from '../../model/types';
import { getEngine } from '../../audio/engine';
import { addBuffer, addClip, getBuffer, getPeaks, onAudioChange } from '../../audio/audioStore';
import { updateTrack } from '../../state/actions';
import { toast, useTransport } from '../../state/store';
import { uid } from '../../model/defaults';
import { noteName } from '../../model/music';
import { LevelMeter } from './AudioInputPanel';

function Waveform({ audioId, color }: { audioId?: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [, setV] = useState(0);
  useEffect(() => onAudioChange(() => setV((v) => v + 1)), []);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const h = (c.height = c.clientHeight * devicePixelRatio);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    const peaks = audioId ? getPeaks(audioId, 800) : undefined;
    if (!peaks) return;
    g.fillStyle = color;
    const bins = peaks.length / 2;
    for (let x = 0; x < w; x++) {
      const i = Math.floor((x / w) * bins);
      const lo = peaks[i * 2];
      const hi = peaks[i * 2 + 1];
      const y0 = h / 2 - hi * (h / 2) * 0.95;
      const y1 = h / 2 - lo * (h / 2) * 0.95;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
  });
  return <canvas ref={ref} className="smp-wave" />;
}

export default function SamplerSection({ track }: { track: Track }) {
  const [rec, setRec] = useState<null | { stop: () => Promise<AudioBuffer | null> }>(null);
  const level = useTransport((s) => s.levels.__mic ?? 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const buf = track.samplerAudioId ? getBuffer(track.samplerAudioId) : undefined;

  const assign = (id: string) =>
    updateTrack(track.id, (t) => {
      t.samplerAudioId = id;
      if (t.samplerRoot === undefined) t.samplerRoot = 60;
    });

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
      await addBuffer(id, b, 'Sample');
      assign(id);
      toast('Sample recorded — play it on the keyboard', 'success');
    } else {
      const h = await getEngine().recordSample(10);
      if (h) setRec(h);
    }
  };

  return (
    <div className="smp">
      <div className="smp-wave-box" style={{ borderColor: rec ? 'var(--record)' : undefined }}>
        {buf ? (
          <Waveform audioId={track.samplerAudioId} color={track.color} />
        ) : (
          <div className="smp-empty">
            <AudioWaveform size={22} />
            {rec ? 'Recording… make a sound' : 'Record or import a sound to play it across the keyboard'}
          </div>
        )}
        {rec && (
          <div className="smp-meter">
            <LevelMeter value={level} />
          </div>
        )}
      </div>
      <div className="smp-side">
        <button className={'btn' + (rec ? ' danger' : ' primary')} onClick={() => void toggleRec()}>
          {rec ? <Square size={13} fill="currentColor" /> : <Circle size={13} fill="currentColor" />} {rec ? 'Stop' : 'Record Sample'}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Import Sample
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const id = uid('a');
              await addClip(id, f, f.name);
              assign(id);
              toast(`Loaded ${f.name}`, 'success');
            } catch {
              toast('Could not read that audio file', 'error');
            }
          }}
        />
        <label className="row" style={{ gap: 6 }}>
          <span className="label">Root</span>
          <select
            value={track.samplerRoot ?? 60}
            onChange={(e) =>
              updateTrack(track.id, (t) => {
                t.samplerRoot = Number(e.target.value);
              })
            }
          >
            {Array.from({ length: 49 }, (_, i) => 36 + i).map((p) => (
              <option key={p} value={p}>
                {noteName(p)}
              </option>
            ))}
          </select>
        </label>
        {buf && <span className="faint" style={{ fontSize: 11 }}>{buf.duration.toFixed(2)}s sample</span>}
      </div>
    </div>
  );
}
