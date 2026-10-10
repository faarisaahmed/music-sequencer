import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { findTrack, useStore } from '../../state/store';
import { setTrackInstrument } from '../../state/actions';
import { CATEGORIES, PRESETS, getPreset, type InstrumentCategory } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import AudioPatchList from '../mixer/AudioPatchList';
import { chordPitches, diatonicChords } from '../../model/music';
import { IconFor, TrackIcon } from '../common/icons';
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

export default function LibraryPanel() {
  return (
    <div className="library" onPointerDownCapture={() => useStore.setState({ focusArea: 'other' })}>
      <InstrumentsTab />
    </div>
  );
}
