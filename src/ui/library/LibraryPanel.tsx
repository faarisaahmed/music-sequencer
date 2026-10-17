import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Check, Play, Star, Loader2, X } from 'lucide-react';
import { findTrack, useStore } from '../../state/store';
import { setTrackInstrument } from '../../state/actions';
import { CATEGORIES, PRESETS, getPreset, type InstrumentCategory, type InstrumentPreset } from '../../audio/presets';
import { FILTERS } from '../../audio/presetTags';
import { getEngine } from '../../audio/engine';
import AudioPatchList from '../mixer/AudioPatchList';
import { chordPitches, diatonicChords } from '../../model/music';
import { IconFor, TrackIcon } from '../common/icons';
import { homeChord, noteRecent, previewSound, searchSounds, toggleFavourite, usePreviewing, useSoundPrefs } from './soundSearch';
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

const SUGGEST = ['warm', 'bass', '80s', 'cinematic', 'lofi', 'plucky'];

/** Play and favourite buttons on a sound row or card. */
export function SoundActions({ p, drums }: { p: InstrumentPreset; drums: boolean }) {
  const fav = useSoundPrefs((s) => s.fav.includes(p.id));
  const prev = usePreviewing((s) => (s.id === p.id ? (s.loading ? 'loading' : 'playing') : null));
  return (
    <>
      {p.kind !== 'user-sampler' && (
        <button
          className={'lib-act lib-play' + (prev ? ' on' : '')}
          title="Preview this sound (doesn't change your track)"
          aria-label={'Preview ' + p.name}
          onClick={(e) => {
            e.stopPropagation();
            void previewSound(p.id, drums, homeChord());
          }}
        >
          {prev === 'loading' ? <Loader2 size={13} className="spin" /> : <Play size={12} fill="currentColor" />}
        </button>
      )}
      <button
        className={'lib-act lib-fav' + (fav ? ' on' : '')}
        title={fav ? 'Remove from favourites' : 'Add to favourites'}
        aria-label={(fav ? 'Unfavourite ' : 'Favourite ') + p.name}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavourite(p.id);
        }}
      >
        <Star size={13} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </>
  );
}

function InstrumentsTab() {
  const project = useStore((s) => s.project)!;
  const selId = useStore((s) => s.selectedTrackId);
  const t = findTrack(project, selId);
  const [query, setQueryState] = useState('');
  const [filters, setFiltersState] = useState<string[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hi, setHi] = useState(-1);
  // A new search starts again from the top.
  const setQuery = (q: string) => {
    setQueryState(q);
    setHi(-1);
  };
  const setFilters = (f: string[]) => {
    setFiltersState(f);
    setHi(-1);
  };
  const favIds = useSoundPrefs((s) => s.fav);
  const recentIds = useSoundPrefs((s) => s.recent);
  const listRef = useRef<HTMLDivElement>(null);
  const drums = t?.type === 'drums';

  const pool = useMemo(() => PRESETS.filter((p) => (drums ? p.category === 'Drums' : p.category !== 'Drums')), [drums]);
  const searching = !!query.trim() || filters.length > 0;
  const results = useMemo(() => (searching ? searchSounds(pool, query, filters) : []), [pool, query, filters, searching]);
  // Every row shown, in order, for ↑ / ↓.
  const sections = useMemo(() => {
    if (searching) return [{ key: 'results', title: `${results.length} ${results.length === 1 ? 'sound' : 'sounds'}`, items: results }];
    const byId = (ids: string[]) => ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is InstrumentPreset => !!p);
    const cats: InstrumentCategory[] = drums ? ['Drums'] : CATEGORIES.filter((c) => c !== 'Drums');
    return [
      { key: 'fav', title: 'Favourites', items: byId(favIds) },
      { key: 'recent', title: 'Recent', items: byId(recentIds).slice(0, 4) },
      ...cats.map((c) => ({ key: c, title: c, items: pool.filter((p) => p.category === c) })),
    ].filter((s) => s.items.length);
  }, [searching, results, pool, favIds, recentIds, drums]);
  const visible = sections.flatMap((s) => (!searching && open[s.key] === false ? [] : s.items.map((p) => ({ p, key: s.key + ':' + p.id }))));

  useEffect(() => {
    if (hi >= 0) listRef.current?.querySelector('.lib-item.hi')?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  if (!t) return <div className="empty-state">Select a track to choose its sound.</div>;
  if (t.type === 'audio') return <AudioPatchList t={t} />;
  const current = getPreset(t.instrument);

  const choose = (p: InstrumentPreset) => {
    if (p.id !== t.instrument) setTrackInstrument(t.id, p.id);
    noteRecent(p.id);
    void audition(t.id, drums);
  };

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
        <input
          type="search"
          placeholder={drums ? 'Search kits: 808, lofi, house…' : 'Search: warm, bass, 80s, strings…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const n = visible.length;
              if (n) setHi((h) => (e.key === 'ArrowDown' ? (h + 1) % n : (h - 1 + n) % n));
            } else if (e.key === 'Enter') {
              const row = visible[Math.max(0, hi)];
              if (row) choose(row.p);
            } else if (e.key === ' ' && hi >= 0 && e.shiftKey) {
              e.preventDefault();
              void previewSound(visible[hi].p.id, drums, homeChord());
            } else if (e.key === 'Escape') {
              setQuery('');
              setFilters([]);
            }
          }}
        />
        {searching && (
          <button
            className="lib-clear"
            title="Clear search"
            onClick={() => {
              setQuery('');
              setFilters([]);
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {!drums && (
        <div className="lib-chips">
          {FILTERS.map((f) => (
            <button key={f.id} className={'lib-chip' + (filters.includes(f.id) ? ' on' : '')} onClick={() => setFilters(filters.includes(f.id) ? filters.filter((x) => x !== f.id) : [...filters, f.id])}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      <div className="lib-list" ref={listRef}>
        {sections.map((s) => {
          const collapsed = !searching && open[s.key] === false;
          return (
            <div key={s.key} className="lib-group">
              <div className="lib-group-head" onClick={() => !searching && setOpen({ ...open, [s.key]: collapsed })}>
                {!searching && (collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />)}
                {s.key === 'fav' && <Star size={11} fill="currentColor" />}
                {s.title}
              </div>
              {!collapsed &&
                s.items.map((p) => {
                  const k = s.key + ':' + p.id;
                  return (
                    <div key={k} className={'lib-item' + (p.id === t.instrument ? ' on' : '') + (visible[hi]?.key === k ? ' hi' : '')} onClick={() => choose(p)}>
                      <div className="lib-ic">
                        <IconFor name={p.icon} size={15} />
                      </div>
                      <div className="lib-item-text">
                        <div className="lib-item-name">{p.name}</div>
                        <div className="lib-item-sub">{searching ? `${p.category} · ${p.description}` : p.description}</div>
                      </div>
                      <SoundActions p={p} drums={drums} />
                      {p.id === t.instrument && <Check size={14} className="lib-check" />}
                    </div>
                  );
                })}
            </div>
          );
        })}
        {searching && !results.length && (
          <div className="lib-empty">
            <div>No sounds match{query.trim() ? ` “${query.trim()}”` : ' all of those'}.</div>
            <div className="lib-empty-try">
              Try{' '}
              {SUGGEST.map((w) => (
                <button
                  key={w}
                  className="lib-chip"
                  onClick={() => {
                    setQuery(w);
                    setFilters([]);
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="lib-foot faint">↑↓ to move · Enter to choose · ▶ to preview</div>
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
