import { ChevronLeft, Search, Star, Clock } from 'lucide-react';
import { useState } from 'react';
import { closeModal, useStore } from '../../state/store';
import { addTrack, createEmptyRegion } from '../../state/actions';
import { CATEGORIES, PRESETS, type InstrumentPreset } from '../../audio/presets';
import { IconFor } from '../common/icons';
import { SoundActions } from '../library/LibraryPanel';
import { noteRecent, searchSounds, useSoundPrefs } from '../library/soundSearch';
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
  const [cat, setCat] = useState<string>('Keyboards');
  const [query, setQuery] = useState('');
  const fav = useSoundPrefs((s) => s.fav);
  const recent = useSoundPrefs((s) => s.recent);

  const finish = (instrument: string, type: 'instrument' | 'drums' | 'audio') => {
    if (instrument) noteRecent(instrument);
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
  const pool = PRESETS.filter((p) => p.category !== 'Drums' && p.category !== 'Sampler');
  const byIds = (ids: string[]) => ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is InstrumentPreset => !!p);
  const shown = query.trim() ? searchSounds(pool, query) : cat === 'fav' ? byIds(fav) : cat === 'recent' ? byIds(recent) : pool.filter((p) => p.category === cat);
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
            <div className="lib-search newtrack-search">
              <Search size={13} />
              <input
                type="search"
                autoFocus
                placeholder="Search: warm, bass, 80s…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && shown[0]) finish(shown[0].id, 'instrument');
                  if (e.key === 'Escape' && query) {
                    e.preventDefault();
                    setQuery('');
                  }
                }}
              />
            </div>
            {fav.length > 0 && (
              <button className={'lib-cat' + (!query && cat === 'fav' ? ' on' : '')} onClick={() => (setCat('fav'), setQuery(''))}>
                <Star size={12} fill="currentColor" /> Favourites
              </button>
            )}
            {recent.length > 0 && (
              <button className={'lib-cat' + (!query && cat === 'recent' ? ' on' : '')} onClick={() => (setCat('recent'), setQuery(''))}>
                <Clock size={12} /> Recent
              </button>
            )}
            {cats.map((c) => (
              <button key={c} className={'lib-cat' + (!query && c === cat ? ' on' : '')} onClick={() => (setCat(c), setQuery(''))}>
                {c}
              </button>
            ))}
            <div className="spacer" />
            <button className="btn ghost" onClick={() => setKind(null)}>
              <ChevronLeft size={15} /> Back
            </button>
          </div>
          <div className="preset-grid">
            {shown.map((p) => (
              <PresetCard key={p.id} p={p} sub={query ? p.category : undefined} onPick={() => finish(p.id, 'instrument')} />
            ))}
            {query && !shown.length && <div className="faint newtrack-none">No instruments match “{query.trim()}”. Try warm, bass, 80s or cinematic.</div>}
          </div>
        </div>
      )}
      {kind === 'drums' && (
        <div className="col">
          <div className="preset-grid">
            {PRESETS.filter((p) => p.category === 'Drums').map((p) => (
              <PresetCard key={p.id} p={p} drums onPick={() => finish(p.id, 'drums')} />
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

function PresetCard({ p, drums = false, sub, onPick }: { p: InstrumentPreset; drums?: boolean; sub?: string; onPick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={'preset-card' + (drums ? ' drums' : '')}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <div className="preset-card-acts">
        <SoundActions p={p} drums={drums} />
      </div>
      <IconFor name={drums ? 'drums' : p.icon} size={26} />
      <div className="preset-name">{p.name}</div>
      <div className="preset-desc">{sub ? `${sub} · ${p.description}` : p.description}</div>
    </div>
  );
}
