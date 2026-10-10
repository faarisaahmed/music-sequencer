import { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Play, Square, Plus, Check } from 'lucide-react';
import { findTrack, useStore } from '../../state/store';
import { setTrackInstrument } from '../../state/actions';
import { CATEGORIES, PRESETS, getPreset, type InstrumentCategory } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import AudioPatchList from '../mixer/AudioPatchList';
import { chordPitches, diatonicChords } from '../../model/music';
import { IconFor, TrackIcon } from '../common/icons';
import { LOOPS, LOOP_KINDS, addLoopToSong, previewLoop, stopLoopPreview, type LoopKind } from './loops';
import '../mixer/mixer.css';

/** Play a short phrase on a track once its (new) instrument has loaded. */
async function audition(trackId: string, drums: boolean): Promise<void> {
  // Let the engine sync the new instrument first.
  await new Promise((r) => setTimeout(r, 30));
  const engine = getEngine();
  const inst = engine.mixer.channels.get(trackId)?.instrument;
  if (!inst) return;
  await inst.ready;
  const p = useStore.getState().project;
  if (!p) return;
  if (drums) {
    [36, 42, 38, 42].forEach((pitch, i) => setTimeout(() => engine.preview(trackId, pitch, 0.85, 0.25), i * 160));
    return;
  }
  const ch = diatonicChords(p.key)[0];
  const ps = chordPitches(ch, 60);
  ps.forEach((pitch, i) => setTimeout(() => engine.preview(trackId, pitch, 0.75, 0.5), i * 110));
  setTimeout(() => ps.forEach((pitch) => engine.preview(trackId, pitch, 0.7, 1.5)), ps.length * 110 + 120);
}

function InstrumentsTab() {
  const project = useStore((s) => s.project)!;
  const selId = useStore((s) => s.selectedTrackId);
  const t = findTrack(project, selId);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!t) return <div className="empty-state">Select a track to choose its sound.</div>;
  if (t.type === 'audio') return <AudioPatchList t={t} />;
  const current = getPreset(t.instrument);
  const cats: InstrumentCategory[] = t.type === 'drums' ? ['Drums'] : CATEGORIES.filter((c) => c !== 'Drums');
  const q = query.trim().toLowerCase();
  return (
    <>
      <div className="lib-current">
        <div className="lib-current-icon" style={{ color: t.color }}>
          <TrackIcon track={t} size={26} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: 14 }}>{current.name}</div>
          <div className="faint" style={{ fontSize: 11.5 }}>
            {current.description}
          </div>
        </div>
      </div>
      <div className="lib-search">
        <Search size={13} />
        <input type="search" placeholder={t.type === 'drums' ? 'Search kits' : 'Search instruments'} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </div>
      <div className="lib-list">
        {cats.map((c) => {
          const items = PRESETS.filter((p) => p.category === c && (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)));
          if (!items.length) return null;
          const collapsed = !q && open[c] === false;
          return (
            <div key={c} className="lib-group">
              <div className="lib-group-head" onClick={() => setOpen({ ...open, [c]: collapsed })}>
                {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                {c}
              </div>
              {!collapsed &&
                items.map((p) => (
                  <div
                    key={p.id}
                    className={'lib-item' + (p.id === t.instrument ? ' on' : '')}
                    onClick={() => {
                      if (p.id !== t.instrument) setTrackInstrument(t.id, p.id);
                      void audition(t.id, t.type === 'drums');
                    }}
                  >
                    <div className="lib-ic">
                      <IconFor name={p.icon} size={15} />
                    </div>
                    <div className="lib-item-text">
                      <div className="lib-item-name">{p.name}</div>
                      <div className="lib-item-sub">{p.description}</div>
                    </div>
                    {p.id === t.instrument && <Check size={14} />}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function LoopsTab() {
  const [kind, setKind] = useState<LoopKind | 'All'>('All');
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => stopLoopPreview(), []);
  const q = query.trim().toLowerCase();
  const items = LOOPS.filter((l) => (kind === 'All' || l.kind === kind) && (!q || l.name.toLowerCase().includes(q) || l.genre.toLowerCase().includes(q)));
  const color = (k: LoopKind) => (k === 'Drums' ? 'var(--drums)' : 'var(--midi)');
  return (
    <>
      <div className="lib-search">
        <Search size={13} />
        <input type="search" placeholder="Search loops or genres" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </div>
      <div className="lib-tags">
        {(['All', ...LOOP_KINDS] as const).map((k) => (
          <button key={k} className={'lib-tag' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>
            {k}
          </button>
        ))}
      </div>
      <div className="lib-list">
        {items.map((l) => (
          <div
            key={l.id}
            className="lib-item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-bandforge-loop', l.id);
              e.dataTransfer.setData('text/plain', 'loop:' + l.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDoubleClick={() => addLoopToSong(l.id)}
            title="Drag onto the timeline, or double-click to add at the playhead"
          >
            <button
              className="lib-ic"
              style={{ color: color(l.kind), border: 'none', cursor: 'pointer' }}
              onClick={async (e) => {
                e.stopPropagation();
                if (playing === l.id) {
                  stopLoopPreview();
                  setPlaying(null);
                  return;
                }
                setPlaying(l.id);
                const ms = await previewLoop(l.id);
                setTimeout(() => setPlaying((cur) => (cur === l.id ? null : cur)), ms);
              }}
            >
              {playing === l.id ? <Square size={11} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            </button>
            <div className="lib-item-text">
              <div className="lib-item-name">{l.name}</div>
              <div className="lib-item-sub">
                {l.kind} · {l.genre} · {l.bars} bar{l.bars > 1 ? 's' : ''} · {getPreset(l.instrument).name}
              </div>
            </div>
            <button className="btn sm icon ghost lib-add" title="Add to song at playhead" onClick={(e) => (e.stopPropagation(), addLoopToSong(l.id))}>
              <Plus size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="lib-foot">Loops follow your song’s key and tempo.</div>
    </>
  );
}

export default function LibraryPanel() {
  const [tab, setTab] = useState<'sounds' | 'loops'>('sounds');
  return (
    <div className="library" onPointerDownCapture={() => useStore.setState({ focusArea: 'other' })}>
      <div className="lib-tabs">
        <div className="seg">
          <button className={tab === 'sounds' ? 'on' : ''} onClick={() => setTab('sounds')}>
            Sounds
          </button>
          <button className={tab === 'loops' ? 'on' : ''} onClick={() => setTab('loops')}>
            Loops
          </button>
        </div>
      </div>
      {tab === 'sounds' ? <InstrumentsTab /> : <LoopsTab />}
    </div>
  );
}
