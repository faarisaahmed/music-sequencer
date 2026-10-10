import { Plus, ArrowLeft } from 'lucide-react';
import { findRegion, findTrack, useStore, type EditorMode } from '../../state/store';
import { createEmptyRegion } from '../../state/actions';
import PianoRoll from './PianoRoll';
import { lazy, Suspense } from 'react';
import { PanelLoading } from '../common/Lazy';

const ScoreEditor = lazy(() => import('./ScoreEditor'));
import StepSequencer from './StepSequencer';
import AudioEditor from './AudioEditor';
import { TrackIcon } from '../common/icons';

/** Hosts the editor for the region being edited, with a mode switch. */
export default function EditorPanel() {
  const project = useStore((s) => s.project)!;
  const editingId = useStore((s) => s.editingRegionId);
  const selectedRegionIds = useStore((s) => s.selectedRegionIds);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const mode = useStore((s) => s.editorMode);
  const cursor = useStore((s) => s.cursor);

  let found = findRegion(project, editingId) ?? findRegion(project, selectedRegionIds[0] ?? null);
  const track = findTrack(project, selectedTrackId);
  if (!found && track) {
    // Fall back to the region under the playhead (or the first region) on the selected track.
    const r = track.regions.find((r) => r.start <= cursor && r.start + r.length > cursor) ?? track.regions[0];
    if (r) found = { track, region: r };
  }

  if (mode === 'fullscore') {
    const back = found;
    return (
      <div className="editor-panel">
        <div className="editor-head">
          <div className="editor-title">
            <span>Full Score</span>
            <span className="faint" style={{ fontWeight: 400 }}>
              · all instruments
            </span>
          </div>
          {back && back.region.kind === 'midi' && (
            <div className="seg">
              <button onClick={() => useStore.setState({ editorMode: back.track.type === 'drums' ? 'steps' : 'score', dockMaximized: false })}><ArrowLeft size={13} /> {back.region.name}</button>
            </div>
          )}
          <div id="editor-toolbar-slot" className="editor-toolbar-slot" />
        </div>
        <div className="editor-body">
          <Suspense fallback={<PanelLoading label="Loading score…" />}>
            <ScoreEditor full />
          </Suspense>
        </div>
      </div>
    );
  }

  if (!found) {
    return (
      <div className="empty-state">
        <h3>No region selected</h3>
        <div>Double-click a region in the Tracks area to edit its notes, or create a new one.</div>
        {track && track.type !== 'audio' && (
          <button className="btn primary" onClick={() => createEmptyRegion(track.id, cursor)}>
            <Plus size={15} /> New {track.type === 'drums' ? 'Drum Pattern' : 'MIDI Region'} on “{track.name}”
          </button>
        )}
      </div>
    );
  }

  const { track: t, region: r } = found;
  const modes: { id: EditorMode; label: string }[] =
    r.kind === 'audio'
      ? [{ id: 'audio', label: 'Audio' }]
      : t.type === 'drums'
        ? [
            { id: 'steps', label: 'Step Sequencer' },
            { id: 'pianoroll', label: 'Piano Roll' },
          ]
        : [
            { id: 'pianoroll', label: 'Piano Roll' },
            { id: 'score', label: 'Score' },
            { id: 'fullscore', label: 'Full Score' },
          ];
  const active = modes.some((m) => m.id === mode) ? mode : modes[0].id;

  return (
    <div className="editor-panel">
      <div className="editor-head">
        <div className="editor-title" style={{ color: t.color }}>
          <TrackIcon track={t} size={16} />
          <span>{t.name}</span>
          <span className="faint">›</span>
          <span style={{ color: 'var(--text)' }}>{r.name}</span>
        </div>
        {modes.length > 1 && (
          <div className="seg">
            {modes.map((m) => (
              <button key={m.id} className={active === m.id ? 'on' : ''} onClick={() => useStore.setState({ editorMode: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
        )}
        <div id="editor-toolbar-slot" className="editor-toolbar-slot" />
      </div>
      <div className="editor-body">
        {active === 'pianoroll' && r.kind === 'midi' && <PianoRoll key={r.id} trackId={t.id} regionId={r.id} />}
        {active === 'score' && r.kind === 'midi' && (
          <Suspense fallback={<PanelLoading label="Loading score…" />}>
            <ScoreEditor key={r.id} trackId={t.id} regionId={r.id} />
          </Suspense>
        )}
        {active === 'steps' && r.kind === 'midi' && <StepSequencer key={r.id} trackId={t.id} regionId={r.id} />}
        {active === 'audio' && r.kind === 'audio' && <AudioEditor key={r.id} trackId={t.id} regionId={r.id} />}
      </div>
    </div>
  );
}
