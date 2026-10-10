// Input panel for audio tracks: microphone, level meter, monitoring, record & import.
import { useRef, useState } from 'react';
import { Circle, Headphones, Mic, MicOff, Upload } from 'lucide-react';
import type { Track } from '../../model/types';
import { useStore, useTransport } from '../../state/store';
import { getEngine } from '../../audio/engine';
import { importAudioFile } from '../../state/actions';
import { Toggle } from '../common/controls';

export function LevelMeter({ value, wide = false }: { value: number; wide?: boolean }) {
  const db = 20 * Math.log10(Math.max(value, 1e-5));
  const f = Math.max(0, Math.min(1, (db + 60) / 60));
  return (
    <div className={'lvl' + (wide ? ' wide' : '')}>
      <div className="lvl-fill" style={{ width: `${f * 100}%` }} />
      <div className="lvl-ticks">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      {value > 0.98 && <span className="lvl-clip">CLIP</span>}
    </div>
  );
}

export default function AudioInputPanel({ track }: { track: Track }) {
  const engine = getEngine();
  const [micOn, setMicOn] = useState(!!engine.micStream);
  const [monitor, setMonitor] = useState(false);
  const level = useTransport((s) => s.levels.__mic ?? 0);
  const recording = useStore((s) => s.recording);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="aip">
      <div className="aip-main">
        <div className="aip-head">
          <div className="aip-mic" style={{ color: track.color }}>
            {micOn ? <Mic size={34} /> : <MicOff size={34} />}
          </div>
          <div>
            <div className="aip-title">{track.name}</div>
            <div className="dim">{micOn ? 'Microphone connected' : 'Audio recorder — connect a microphone to start'}</div>
          </div>
        </div>
        {!micOn ? (
          <button className="btn primary lg" onClick={async () => setMicOn(await engine.startMic())}>
            <Mic size={16} /> Enable Microphone
          </button>
        ) : (
          <>
            <div className="col" style={{ gap: 6 }}>
              <span className="label">Input level</span>
              <LevelMeter value={level} wide />
            </div>
            <label className="row" style={{ gap: 10 }}>
              <Toggle
                on={monitor}
                onChange={(v) => {
                  setMonitor(v);
                  engine.setMonitoring(v);
                }}
              />
              <Headphones size={15} /> Monitor input <span className="faint">(use headphones to avoid feedback)</span>
            </label>
          </>
        )}
        <div className="row" style={{ marginTop: 6 }}>
          <button
            className={'btn lg aip-rec' + (recording ? ' on' : '')}
            onClick={() => {
              useStore.setState({ selectedTrackId: track.id });
              void engine.record();
            }}
          >
            <Circle size={14} fill="currentColor" /> {recording ? 'Stop Recording' : 'Record'}
          </button>
          <button className="btn lg" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import Audio File
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.aac,.webm"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importAudioFile(f, track.id);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <div className="aip-tips">
        <div className="label" style={{ marginBottom: 8 }}>
          Tips
        </div>
        <ul>
          <li>
            Recording starts at the playhead. Turn on the count-in (<b>1234</b>) to get a bar of clicks first.
          </li>
          <li>
            Press <kbd>R</kbd> to record and <kbd>Space</kbd> to stop.
          </li>
          <li>Keep the level out of the red — move back from the mic if you see CLIP.</li>
          <li>Drag audio files (WAV, MP3, M4A…) straight onto the tracks area to import them.</li>
          <li>Trim, fade and loop recordings in the Tracks area and the Editor.</li>
        </ul>
      </div>
    </div>
  );
}
