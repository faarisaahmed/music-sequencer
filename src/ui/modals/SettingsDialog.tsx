import { useState } from 'react';
import type { Draft } from 'immer';
import type { Project } from '../../model/types';
import { closeModal, commit, openModal, toast, useStore } from '../../state/store';
import { Keyboard } from 'lucide-react';
import { googleClientId, looksLikeClientId, setGoogleClientId } from '../../publish/youtube';
import { setBpm, setKey, setTimeSig } from '../../state/actions';
import { keyName, keyUsesFlats, makeKey, pitchClassName } from '../../model/music';
import ScalePicker from '../common/ScalePicker';
import { enableMidi, useMidiDevices } from '../../audio/midiInput';
import { getAudioContext } from '../../audio/context';
import InputSetup from '../instruments/InputSetup';
import { NumberField, Toggle } from '../common/controls';
import Modal from './Modal';
import '../mixer/mixer.css';

const TIME_SIGS: [number, number][] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 8],
  [7, 8],
  [12, 8],
];

export default function SettingsDialog() {
  const p = useStore((s) => s.project)!;
  const midi = useMidiDevices();
  const [transpose, setTranspose] = useState(true);
  const edit = (fn: (d: Draft<Project>) => void) => commit(fn);
  const ctx = getAudioContext();

  return (
    <Modal title="Song Settings" width={560} footer={<button className="btn primary" onClick={closeModal}>Done</button>}>
      <div className="form-section">Song</div>
      <div className="form-grid">
        <span className="label">Name</span>
        <input
          type="text"
          defaultValue={p.name}
          onKeyDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== p.name) edit((d) => void (d.name = v));
          }}
        />
        <span className="label">Tempo</span>
        <div className="row">
          <NumberField value={p.bpm} min={30} max={300} onCommit={setBpm} />
          <span className="dim">BPM</span>
          <input type="range" min={40} max={220} value={p.bpm} onChange={(e) => setBpm(Number(e.target.value))} style={{ flex: 1 }} />
        </div>
        <span className="label">Time signature</span>
        <div className="seg" style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
          {TIME_SIGS.map(([n, d]) => (
            <button key={`${n}/${d}`} className={p.timeSig[0] === n && p.timeSig[1] === d ? 'on' : ''} onClick={() => setTimeSig(n, d)}>
              {n}/{d}
            </button>
          ))}
        </div>
        <span className="label">Key</span>
        <div className="row">
          <select value={p.key.tonic} onChange={(e) => setKey(Number(e.target.value), p.key.mode, transpose, p.key.scale)}>
            {Array.from({ length: 12 }, (_, pc) => (
              <option key={pc} value={pc}>
                {pitchClassName(pc, keyUsesFlats({ ...p.key, tonic: pc }))}
              </option>
            ))}
          </select>
          <span className="dim">{keyName(p.key)}</span>
        </div>
        <span />
        <ScalePicker
          value={p.key}
          onChange={(sc) => {
            const k = makeKey(p.key.tonic, sc);
            setKey(k.tonic, k.mode, false, sc);
          }}
        />
        <span />
        <label className="row" style={{ fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={transpose} onChange={(e) => setTranspose(e.target.checked)} />
          Transpose existing notes when the key changes
        </label>
        <span className="label">Song length</span>
        <div className="row">
          <NumberField value={p.lengthBars} min={4} max={999} onCommit={(v) => edit((d) => void (d.lengthBars = Math.round(v)))} />
          <span className="dim">bars</span>
        </div>
      </div>

      <div className="form-section">Recording & Metronome</div>
      <div className="form-grid">
        <span className="label">Metronome</span>
        <Toggle on={p.metronome} onChange={(v) => edit((d) => void (d.metronome = v))} />
        <span className="label">Count-in</span>
        <div className="row">
          <Toggle on={p.countIn} onChange={(v) => edit((d) => void (d.countIn = v))} />
          <span className="dim" style={{ fontSize: 12 }}>
            One bar of clicks before recording starts
          </span>
        </div>
      </div>

      <div className="form-section">Effects</div>
      <div className="form-grid">
        <span className="label">Reverb</span>
        <div className="seg" style={{ justifySelf: 'start' }}>
          {(['room', 'plate', 'hall', 'cathedral'] as const).map((r) => (
            <button key={r} className={p.reverbType === r ? 'on' : ''} onClick={() => edit((d) => void (d.reverbType = r))}>
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <span className="label">Echo time</span>
        <div className="seg" style={{ justifySelf: 'start' }}>
          {(['1/4', '1/4d', '1/8', '1/8d', '1/16'] as const).map((r) => (
            <button key={r} className={p.delayTime === r ? 'on' : ''} onClick={() => edit((d) => void (d.delayTime = r))}>
              {r.replace('d', '.')}
            </button>
          ))}
        </div>
        <span className="label">Echo feedback</span>
        <div className="row">
          <input type="range" min={0} max={0.85} step={0.01} value={p.delayFeedback} onChange={(e) => edit((d) => void (d.delayFeedback = Number(e.target.value)))} />
          <span className="mono dim">{Math.round(p.delayFeedback * 100)}%</span>
        </div>
      </div>

      <div className="form-section">MIDI Devices</div>
      {!midi.supported ? (
        <div className="dim">Web MIDI isn’t available in this browser. Use Chrome or Edge to connect a MIDI keyboard.</div>
      ) : !midi.enabled ? (
        <div className="row">
          <button className="btn primary" onClick={() => void enableMidi()}>
            Connect MIDI Keyboard
          </button>
          <span className="dim" style={{ fontSize: 12 }}>
            Notes play the selected track and record when you press R.
          </span>
        </div>
      ) : midi.inputs.length ? (
        <div className="col" style={{ gap: 4 }}>
          {midi.inputs.map((i) => (
            <div key={i.id} className="row">
              <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--green)' }} />
              {i.name}
            </div>
          ))}
          <div className="faint" style={{ fontSize: 12 }}>
            Sustain pedal (CC64) supported. {midi.sustain ? 'Pedal down.' : ''}
          </div>
        </div>
      ) : (
        <div className="dim">MIDI is on — plug in a device and it will appear here.</div>
      )}

      <div className="form-section">Audio</div>
      <div className="form-grid">
        <span className="label">Sample rate</span>
        <span className="dim">{ctx.sampleRate} Hz</span>
        <span className="label">Output latency</span>
        <span className="dim">{Math.round(((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000)} ms</span>
      </div>
      <div className="form-section">Recording Input</div>
      <InputSetup />
      <div className="form-section">Keyboard Shortcuts</div>
      <div className="row" style={{ gap: 10 }}>
        <span className="dim grow">See every shortcut and change any of them to keys you like.</span>
        <button className="btn" onClick={() => openModal('help', { tab: 'shortcuts' })}>
          <Keyboard size={14} /> Edit Shortcuts…
        </button>
      </div>
      <div className="form-section">YouTube Publishing</div>
      <div className="form-grid">
        <span className="label">Google client ID</span>
        <input
          type="text"
          defaultValue={googleClientId()}
          placeholder="….apps.googleusercontent.com"
          onKeyDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v === googleClientId()) return;
            if (v && !looksLikeClientId(v)) {
              toast("That doesn't look like a Google client ID", 'error');
              return;
            }
            setGoogleClientId(v);
            toast(v ? 'YouTube client ID saved' : 'YouTube client ID removed', 'success');
          }}
        />
      </div>
    </Modal>
  );
}
