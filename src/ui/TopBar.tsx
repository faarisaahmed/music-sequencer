import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import {
  ChevronLeft,
  Library,
  SlidersHorizontal,
  SlidersVertical,
  Piano,
  SquarePen,
  SkipBack,
  Play,
  Square,
  Circle,
  Repeat,
  Undo2,
  Redo2,
  Download,
  Settings,
  HelpCircle,
  BookOpen,
  Plus,
  Volume2,
  Check,
  Loader2,
  Music4,
  History,
  ClipboardCheck,
  MoreHorizontal,
} from 'lucide-react';
import { commit, openModal, redo, undo, useStore, useTransport, type DockTab } from '../state/store';
import { closeProject, setKey } from '../state/actions';
import { getEngine } from '../audio/engine';
import { formatTime, keyName as fullKeyName, keyUsesFlats, makeKey, pitchClassName, scaleType } from '../model/music';
import type { KeySignature } from '../model/types';
import GroovePanel from './groove/GroovePanel';
import { grooveLabel, isStraight, swingPercent } from '../model/groove';
import ScalePicker from './common/ScalePicker';
import { saveListeners, type SaveStatus } from '../state/persistence';
import { HSlider } from './common/controls';
import { startDrag } from './common/drag';
import FullScoreButton, { openFullScore } from './editors/score/FullScoreButton';
import { showContextMenu, type MenuItem } from './common/menus';
import { meterOf, tempoOf } from '../model/timeline';
import { MAX_BPM, MIN_BPM, setTempoAt, tempoGesture } from '../state/timelineActions';
import { CollabBar } from './collab/CollabUI';

function MetronomeIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6l4 18H5L9 3z" />
      <path d="M12 16l6-10" />
      <path d="M7 16h10" />
    </svg>
  );
}

function toggleDock(tab: DockTab) {
  const { dockTab } = useStore.getState();
  useStore.setState({ dockTab: dockTab === tab ? null : tab, dockMaximized: false });
}

function DockButton({ tab, icon, label, cmd }: { tab: DockTab; icon: React.ReactNode; label: string; cmd: string }) {
  const dockTab = useStore((s) => s.dockTab);
  return (
    <button className={'btn icon tb' + (dockTab === tab ? ' active' : '')} data-tip={label} data-cmd={cmd} onClick={() => toggleDock(tab)}>
      {icon}
    </button>
  );
}

function Lcd({ compact = false }: { compact?: boolean }) {
  const project = useStore((s) => s.project)!;
  const position = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  const cursor = useStore((s) => s.cursor);
  const countingIn = useStore((s) => s.countingIn);
  const [mode, setMode] = useState<'beats' | 'time'>('beats');
  const [keyOpen, setKeyOpen] = useState(false);
  const [swingOpen, setSwingOpen] = useState(false);
  const [bpmEdit, setBpmEdit] = useState<string | null>(null);
  const pos = playing ? position : cursor;
  const tm = tempoOf(project);
  const meter = meterOf(project);
  const here = Math.max(0, pos);
  const bpmHere = Math.round(tm.bpmAt(here) * 10) / 10;
  const sigHere = meter.sigAt(here);

  return (
    <div className="lcd">
      <div className="lcd-cell lcd-pos" onClick={() => setMode(mode === 'beats' ? 'time' : 'beats')} title="Click to switch bars / time">
        <div className="lcd-big mono">{countingIn ? 'COUNT-IN' : mode === 'beats' ? meter.format(here) : formatTime(tm.sec(here))}</div>
        <div className="lcd-small">{mode === 'beats' ? 'BAR · BEAT' : 'TIME'}</div>
      </div>
      <div className="lcd-sep" />
      <div
        className="lcd-cell"
        title={(project.tempoChanges?.length ? 'Tempo here (this song changes tempo; see the Tempo lane)' : 'Tempo') + ': drag up/down or double-click to type'}
        style={{ cursor: 'ns-resize' }}
        onPointerDown={(e) => {
          if (bpmEdit !== null) return;
          const b0 = bpmHere;
          let started = false;
          startDrag(
            e,
            ({ dy }) => {
              if (!started) {
                started = true;
                tempoGesture.begin();
              }
              tempoGesture.move(here, Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, b0 - dy / 2))));
            },
            () => started && tempoGesture.end(),
            { threshold: 3 },
          );
        }}
        onDoubleClick={() => setBpmEdit(String(bpmHere))}
      >
        {bpmEdit !== null ? (
          <input
            autoFocus
            className="lcd-input mono"
            value={bpmEdit}
            onChange={(e) => setBpmEdit(e.target.value)}
            onBlur={() => {
              const v = parseFloat(bpmEdit);
              if (!isNaN(v)) setTempoAt(here, v);
              setBpmEdit(null);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setBpmEdit(null);
            }}
          />
        ) : (
          <div className="lcd-big mono">{bpmHere}</div>
        )}
        <div className="lcd-small">TEMPO</div>
      </div>
      <div className="lcd-sep" />
      <div className="lcd-cell" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setKeyOpen(!keyOpen)} title={`Song key: ${fullKeyName(project.key)}`}>
        <div className="lcd-big">{shortKeyName(project.key)}</div>
        <div className="lcd-small">KEY</div>
        {keyOpen && <KeyPopover onClose={() => setKeyOpen(false)} />}
      </div>
      {!compact && (
        <>
          <div className="lcd-sep" />
          <div
            className="lcd-cell"
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setSwingOpen(!swingOpen)}
            title={`Song swing: ${grooveLabel(project.groove)}. Click to choose a swing feel for the whole song.`}
          >
            <div className={'lcd-big' + (isStraight(project.groove) ? ' lcd-off' : '')}>{isStraight(project.groove) ? 'Off' : `${swingPercent(project.groove)}%`}</div>
            <div className="lcd-small">{isStraight(project.groove) ? 'SWING' : `SWING ${project.groove!.grid}TH`}</div>
            {swingOpen && <GroovePanel scope={{ kind: 'song' }} onClose={() => setSwingOpen(false)} />}
          </div>
          <div className="lcd-sep" />
          <div className="lcd-cell" style={{ cursor: 'pointer' }} onClick={() => openModal('settings')} title="Time signature here">
            <div className="lcd-big mono">
              {sigHere[0]}/{sigHere[1]}
            </div>
            <div className="lcd-small">TIME</div>
          </div>
        </>
      )}
    </div>
  );
}

const SCALE_SHORT: Record<string, string> = {
  major: 'maj',
  minor: 'min',
  dorian: 'Dor',
  phrygian: 'Phr',
  lydian: 'Lyd',
  mixolydian: 'Mix',
  locrian: 'Loc',
  'harmonic minor': 'hm',
  'melodic minor': 'mm',
  'major pentatonic': 'pent',
  'minor pentatonic': 'm pent',
  blues: 'blues',
};

function shortKeyName(key: KeySignature): string {
  return pitchClassName(key.tonic, keyUsesFlats(key)) + ' ' + SCALE_SHORT[scaleType(key)];
}

function KeyPopover({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)!;
  const [transpose, setTranspose] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => window.addEventListener('pointerdown', close), 0);
    return () => window.removeEventListener('pointerdown', close);
  }, [onClose]);
  return (
    <div ref={ref} className="popover key-popover" onClick={(e) => e.stopPropagation()}>
      <div className="scale-group-title">Root note</div>
      <div className="key-grid">
        {Array.from({ length: 12 }, (_, pc) => (
          <button key={pc} className={'key-btn' + (project.key.tonic === pc ? ' on' : '')} onClick={() => setKey(pc, project.key.mode, transpose, project.key.scale)}>
            {pitchClassName(pc, keyUsesFlats({ ...project.key, tonic: pc }))}
          </button>
        ))}
      </div>
      <ScalePicker
        value={project.key}
        onChange={(sc) => {
          const k = makeKey(project.key.tonic, sc);
          setKey(k.tonic, k.mode, false, sc);
        }}
      />
      <label className="row" style={{ marginTop: 10, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={transpose} onChange={(e) => setTranspose(e.target.checked)} />
        Transpose existing notes to the new key
      </label>
    </div>
  );
}

function SaveIndicator() {
  const [st, setSt] = useState<SaveStatus>('saved');
  useEffect(() => {
    saveListeners.add(setSt);
    return () => {
      saveListeners.delete(setSt);
    };
  }, []);
  return (
    <button className="save-ind" data-tip={(st === 'saved' ? 'All changes saved. ' : 'Saving… ') + 'Click for Version History'} data-cmd="song.versions" onClick={() => openModal('versions')}>
      {st === 'saved' ? <Check size={13} /> : <Loader2 size={13} className="spin" />}
      <span>{st === 'saved' ? 'Saved' : 'Saving'}</span>
      <History size={12} className="save-hist" />
    </button>
  );
}

/**
 * How much the top bar has to compact to fit its width (0 = everything shown). Measured after
 * layout and before paint, so a resize never shows a frame with the bar overflowing.
 *   1: no song title / labels, shorter volume slider   2: no volume slider, icon-only Export
 *   3: Settings, Guides, Help move to the ⋯ menu      4: so do Undo/Redo, Chord Track, Check My
 *      Writing, Full Score and count-in, and the display drops swing and time
 *   5: so do the metronome and the save indicator
 */
const MAX_FIT = 5;

function useTopBarFit(ref: RefObject<HTMLDivElement | null>): number {
  const [fit, setFit] = useState(0);
  const fitRef = useRef(0);
  fitRef.current = fit;
  // Width the bar needed at each level, so it can tell when there's room to show more again.
  const need = useRef<number[]>([]);

  const step = (): number | null => {
    const el = ref.current;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const kids = [...el.children] as HTMLElement[];
    const w = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + (parseFloat(cs.columnGap) || 0) * (kids.length - 1) + kids.reduce((sum, k) => sum + k.getBoundingClientRect().width, 0);
    const l = fitRef.current;
    need.current[l] = w;
    if (w > el.clientWidth + 0.5 && l < MAX_FIT) return l + 1;
    const less = need.current[l - 1];
    if (l > 0 && less !== undefined && less <= el.clientWidth) return l - 1;
    return null;
  };

  // After every render (contents can change width) …
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs every render on purpose; it settles in a step or two
  useLayoutEffect(() => {
    const next = step();
    if (next !== null) setFit(next);
  });
  // … and whenever the bar or one of its groups resizes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      for (let i = 0; i < 2 * MAX_FIT; i++) {
        const next = step();
        if (next === null) break;
        flushSync(() => setFit(next));
        fitRef.current = next;
      }
    });
    ro.observe(el);
    for (const k of el.children) ro.observe(k);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return fit;
}

export default function TopBar() {
  const project = useStore((s) => s.project)!;
  const playing = useStore((s) => s.playing);
  const recording = useStore((s) => s.recording);
  const libraryOpen = useStore((s) => s.libraryOpen);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const engine = getEngine();
  const [editingName, setEditingName] = useState(false);
  const metronome = project.metronome;
  const countIn = project.countIn;
  const barRef = useRef<HTMLDivElement>(null);
  const fit = useTopBarFit(barRef);

  const [swingOpen, setSwingOpen] = useState(false);

  // The ⋯ menu holds whatever the bar no longer has room for.
  const openMore = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const on = (label: string, active: boolean) => (active ? label + ' ✓' : label);
    const items: MenuItem[] = [];
    if (fit >= 4) {
      items.push(
        { label: 'Undo', cmd: 'edit.undo', icon: <Undo2 size={14} />, disabled: !canUndo, onClick: undo },
        { label: 'Redo', cmd: 'edit.redo', icon: <Redo2 size={14} />, disabled: !canRedo, onClick: redo },
        { separator: true },
        { label: 'Chord Track', cmd: 'view.chords', icon: <Music4 size={14} />, onClick: () => toggleDock('assistant') },
        { label: 'Check My Writing', cmd: 'view.review', icon: <ClipboardCheck size={14} />, onClick: () => toggleDock('review') },
        { label: 'Full Score', cmd: 'view.fullScore', onClick: openFullScore },
        { separator: true },
        { label: `Song Swing: ${grooveLabel(project.groove)}…`, onClick: () => setSwingOpen(true) },
      );
      if (fit >= 5) items.push({ label: on('Metronome', metronome), cmd: 'transport.metronome', onClick: () => commit((d) => void (d.metronome = !d.metronome)) });
      items.push({ label: on('Count-in Before Recording', countIn), onClick: () => commit((d) => void (d.countIn = !d.countIn)) });
      if (fit >= 5) items.push({ label: 'Version History', icon: <History size={14} />, onClick: () => openModal('versions') });
      items.push({ separator: true });
    }
    items.push(
      { label: 'Song Settings', icon: <Settings size={14} />, onClick: () => openModal('settings') },
      { label: 'Guides', cmd: 'view.guides', icon: <BookOpen size={14} />, onClick: () => openModal('guides') },
      { label: 'Shortcuts & Help', cmd: 'view.shortcuts', icon: <HelpCircle size={14} />, onClick: () => openModal('help') },
    );
    showContextMenu({ clientX: r.right - 220, clientY: r.bottom + 4 }, items);
  };

  return (
    <div className="topbar" ref={barRef} data-fit={fit}>
      <div className="tb-group">
        <button className="btn ghost tb-back" onClick={() => void closeProject()} title="Back to My Songs">
          <ChevronLeft size={18} />
          <span>My Songs</span>
        </button>
        {editingName ? (
          <input
            autoFocus
            type="text"
            defaultValue={project.name}
            style={{ width: 160 }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v)
                commit((d) => {
                  d.name = v;
                });
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingName(false);
            }}
          />
        ) : (
          <div className="tb-title" onDoubleClick={() => setEditingName(true)} title="Double-click to rename">
            {project.name}
          </div>
        )}
        {fit < 5 && <SaveIndicator />}
      </div>

      <div className="tb-group">
        <button className={'btn icon tb' + (libraryOpen ? ' active' : '')} data-tip="Sounds" data-cmd="view.sounds" onClick={() => useStore.setState({ libraryOpen: !libraryOpen })}>
          <Library size={17} />
        </button>
        <DockButton tab="fx" icon={<SlidersHorizontal size={17} />} label="Smart Controls & FX" cmd="view.fx" />
        <DockButton tab="editor" icon={<SquarePen size={17} />} label="Editor" cmd="view.editor" />
        <DockButton tab="instrument" icon={<Piano size={17} />} label="Instrument / Keyboard" cmd="view.instrument" />
        <DockButton tab="mixer" icon={<SlidersVertical size={17} />} label="Mixer" cmd="view.mixer" />
        {fit < 4 && (
          <>
            <DockButton tab="assistant" icon={<Music4 size={17} />} label="Chord Track" cmd="view.chords" />
            <DockButton tab="review" icon={<ClipboardCheck size={17} />} label="Check My Writing" cmd="view.review" />
            <FullScoreButton />
          </>
        )}
        <button className="btn icon tb" data-tip="New Track" data-cmd="song.newTrack" onClick={() => openModal('newTrack')}>
          <Plus size={18} />
        </button>
      </div>

      <div className="tb-center">
        <div className="transport">
          <button className="btn icon tb" data-tip="Go to Beginning" data-cmd="transport.toStart" onClick={() => engine.seek(0)}>
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button className={'btn icon tb play' + (playing ? ' on' : '')} data-tip="Play / Stop" data-cmd="transport.play" onClick={() => engine.togglePlay()}>
            {playing ? <Square size={15} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <button className={'btn icon tb rec' + (recording ? ' on' : '')} data-tip="Record" data-cmd="transport.record" onClick={() => void engine.record()}>
            <Circle size={15} fill="currentColor" />
          </button>
          <button
            className={'btn icon tb' + (project.loop.enabled ? ' cycle-on' : '')}
            data-tip="Loop (cycle) — drag the yellow strip in the ruler to set bars"
            data-cmd="transport.cycle"
            onClick={() =>
              commit((d) => {
                d.loop.enabled = !d.loop.enabled;
              })
            }
          >
            <Repeat size={16} />
          </button>
        </div>
        <Lcd compact={fit >= 4} />
        <div className="transport">
          {fit < 5 && (
            <button
              className={'btn icon tb' + (project.metronome ? ' active' : '')}
              data-tip="Metronome"
              data-cmd="transport.metronome"
              onClick={() =>
                commit((d) => {
                  d.metronome = !d.metronome;
                })
              }
            >
              <MetronomeIcon />
            </button>
          )}
          {fit < 4 && (
            <button
              className={'btn tb sm count-in' + (project.countIn ? ' active' : '')}
              title="Count-in before recording"
              onClick={() =>
                commit((d) => {
                  d.countIn = !d.countIn;
                })
              }
            >
              1234
            </button>
          )}
        </div>
      </div>

      <div className="tb-group right">
        <CollabBar />
        {fit < 4 && (
          <>
            <button className="btn icon tb" data-tip="Undo" data-cmd="edit.undo" disabled={!canUndo} onClick={undo}>
              <Undo2 size={17} />
            </button>
            <button className="btn icon tb" data-tip="Redo" data-cmd="edit.redo" disabled={!canRedo} onClick={redo}>
              <Redo2 size={17} />
            </button>
          </>
        )}
        {fit < 2 && (
          <div className="row master-vol" title="Master volume">
            <Volume2 size={15} className="dim" />
            <HSlider
              value={project.masterVolume}
              min={0}
              max={1.25}
              defaultValue={0.85}
              width={80}
              onChange={(v) =>
                commit((d) => {
                  d.masterVolume = v;
                })
              }
            />
            <MasterMeter />
          </div>
        )}
        <button className="btn primary tb-export" data-tip="Export song" data-cmd="song.export" onClick={() => openModal('export')}>
          <Download size={15} />
          {fit < 2 && ' Export'}
        </button>
        {fit < 3 ? (
          <>
            <button className="btn icon tb" title="Song settings" onClick={() => openModal('settings')}>
              <Settings size={17} />
            </button>
            <button className="btn icon tb" data-tip="Guides: learn to write music" data-cmd="view.guides" onClick={() => openModal('guides')}>
              <BookOpen size={17} />
            </button>
            <button className="btn icon tb" data-tip="Keyboard shortcuts & help" data-cmd="view.shortcuts" onClick={() => openModal('help')}>
              <HelpCircle size={17} />
            </button>
          </>
        ) : (
          <div className="tb-more-wrap">
            <button className="btn icon tb tb-more" data-tip="More" onClick={openMore}>
              <MoreHorizontal size={18} />
            </button>
            {swingOpen && <GroovePanel scope={{ kind: 'song' }} placement="down-left" onClose={() => setSwingOpen(false)} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MasterMeter() {
  const l = useTransport((s) => s.levels.__masterL ?? 0);
  const r = useTransport((s) => s.levels.__masterR ?? 0);
  const w = (v: number) => `${Math.min(100, Math.max(0, 1 + Math.log10(Math.max(v, 1e-4)) / 2.4) * 100)}%`;
  return (
    <div className="mini-meter">
      <div>
        <i
          style={{
            width: w(l),
            background: l > 0.98 ? 'var(--record)' : undefined,
          }}
        />
      </div>
      <div>
        <i
          style={{
            width: w(r),
            background: r > 0.98 ? 'var(--record)' : undefined,
          }}
        />
      </div>
    </div>
  );
}
