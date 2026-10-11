import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { closeModal, useStore } from '../../state/store';
import { addTrack, createEmptyRegion } from '../../state/actions';
import { CATEGORIES, PRESETS, type InstrumentCategory } from '../../audio/presets';
import { IconFor } from '../common/icons';
import Modal from './Modal';

type Kind = 'instrument' | 'drums' | 'audio' | 'sampler';

const KINDS: { kind: Kind; title: string; desc: string; icon: string; color: string }[] = [
  { kind: 'instrument', title: 'Software Instrument', desc: 'Play keyboards, guitars, strings, synths & more with your keyboard or MIDI controller', icon: 'piano', color: 'var(--midi)' },
  { kind: 'drums', title: 'Drums', desc: 'Program beats in the step sequencer or play the drum pads', icon: 'drums', color: 'var(--drums)' },
  { kind: 'audio', title: 'Audio Recorder', desc: 'Record your voice or any instrument with a microphone, or import audio files', icon: 'mic', color: 'var(--audio)' },
  { kind: 'sampler', title: 'Sampler', desc: 'Record or import a sound and play it chromatically across the keyboard', icon: 'sampler', color: 'var(--purple)' },
];

export default function NewTrackDialog() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [cat, setCat] = useState<InstrumentCategory>('Keyboards');

  const finish = (instrument: string, type: 'instrument' | 'drums' | 'audio') => {
    const id = addTrack(type, instrument);
    closeModal();
    if (type !== 'audio') {
      const cursor = useStore.getState().cursor;
      createEmptyRegion(id, cursor);
      useStore.setState({ dockTab: type === 'drums' ? 'editor' : 'instrument', editorMode: type === 'drums' ? 'steps' : 'pianoroll' });
    } else {
      useStore.setState({ dockTab: 'instrument' });
    }
  };

  const cats = CATEGORIES.filter((c) => c !== 'Drums' && c !== 'Sampler');
  return (
    <Modal title={kind === 'instrument' ? 'Choose an Instrument' : kind === 'drums' ? 'Choose a Drum Kit' : 'Add a New Track'} width={kind ? 760 : 680}>
      {!kind && (
        <div className="newtrack-kinds">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              className="newtrack-card"
              onClick={() => {
                if (k.kind === 'audio') finish('', 'audio');
                else if (k.kind === 'sampler') finish('user-sampler', 'instrument');
                else setKind(k.kind);
              }}
            >
              <div className="newtrack-icon" style={{ color: k.color }}>
                <IconFor name={k.icon} size={34} />
              </div>
              <div className="newtrack-title">{k.title}</div>
              <div className="newtrack-desc">{k.desc}</div>
            </button>
          ))}
        </div>
      )}
      {kind === 'instrument' && (
        <div className="newtrack-pick">
          <div className="col newtrack-cats">
            {cats.map((c) => (
              <button key={c} className={'lib-cat' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
            <div className="spacer" />
            <button className="btn ghost" onClick={() => setKind(null)}>
              <ChevronLeft size={15} /> Back
            </button>
          </div>
          <div className="preset-grid">
            {PRESETS.filter((p) => p.category === cat).map((p) => (
              <button key={p.id} className="preset-card" onClick={() => finish(p.id, 'instrument')}>
                <IconFor name={p.icon} size={26} />
                <div className="preset-name">{p.name}</div>
                <div className="preset-desc">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {kind === 'drums' && (
        <div className="col">
          <div className="preset-grid">
            {PRESETS.filter((p) => p.category === 'Drums').map((p) => (
              <button key={p.id} className="preset-card drums" onClick={() => finish(p.id, 'drums')}>
                <IconFor name="drums" size={26} />
                <div className="preset-name">{p.name}</div>
                <div className="preset-desc">{p.description}</div>
              </button>
            ))}
          </div>
          <div>
            <button className="btn ghost" onClick={() => setKind(null)}>
              <ChevronLeft size={15} /> Back
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
