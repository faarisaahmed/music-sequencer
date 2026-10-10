import { useEffect, useRef, useState } from 'react';
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
  Plus,
  Volume2,
  Check,
  Loader2,
  Wand2,
} from 'lucide-react';
import { beginGesture, commit, endGesture, live, openModal, redo, undo, useStore, useTransport, type DockTab } from '../state/store';
import { closeProject, setBpm, setKey } from '../state/actions';
import { getEngine } from '../audio/engine';
import { formatPosition, formatTime, keyName as fullKeyName, keyUsesFlats, makeKey, pitchClassName, scaleType } from '../model/music';
import type { KeySignature } from '../model/types';
import ScalePicker from './common/ScalePicker';
import { saveListeners, type SaveStatus } from '../state/persistence';
import { HSlider } from './common/controls';
import { startDrag } from './common/drag';
import FullScoreButton from './editors/score/FullScoreButton';
import ViewSwitch from './liveloops/ViewSwitch';

function MetronomeIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6l4 18H5L9 3z" />
      <path d="M12 16l6-10" />
      <path d="M7 16h10" />
    </svg>
  );
}

function DockButton({ tab, icon, label, shortcut }: { tab: DockTab; icon: React.ReactNode; label: string; shortcut: string }) {
  const dockTab = useStore((s) => s.dockTab);
  return (
    <button
      className={'btn icon tb' + (dockTab === tab ? ' active' : '')}
      title={`${label} (${shortcut})`}
      onClick={() => useStore.setState({ dockTab: dockTab === tab ? null : tab, dockMaximized: false })}
    >
      {icon}
    </button>
  );
}

function Lcd() {
  const project = useStore((s) => s.project)!;
  const position = useTransport((s) => s.position);
  const playing = useStore((s) => s.playing);
  const cursor = useStore((s) => s.cursor);
  const countingIn = useStore((s) => s.countingIn);
  const [mode, setMode] = useState<'beats' | 'time'>('beats');
  const [keyOpen, setKeyOpen] = useState(false);
  const [bpmEdit, setBpmEdit] = useState<string | null>(null);
  const pos = playing ? position : cursor;
  const spb = 60 / project.bpm;

  return (
    <div className="lcd">
      <div className="lcd-cell lcd-pos" onClick={() => setMode(mode === 'beats' ? 'time' : 'beats')} title="Click to switch bars / time">
        <div className="lcd-big mono">{countingIn ? 'COUNT-IN' : mode === 'beats' ? formatPosition(Math.max(0, pos), project.timeSig) : formatTime(Math.max(0, pos) * spb)}</div>
        <div className="lcd-small">{mode === 'beats' ? 'BAR · BEAT' : 'TIME'}</div>
      </div>
      <div className="lcd-sep" />
      <div
        className="lcd-cell"
        title="Tempo — drag up/down or double-click to type"
        style={{ cursor: 'ns-resize' }}
        onPointerDown={(e) => {
          if (bpmEdit !== null) return;
          const b0 = project.bpm;
          let started = false;
          startDrag(
            e,
            ({ dy }) => {
              if (!started) {
                started = true;
                beginGesture();
              }
              const v = Math.round(Math.max(30, Math.min(300, b0 - dy / 2)));
              live((d) => {
                d.bpm = v;
              });
            },
            () => endGesture(),
            { threshold: 3 },
          );
        }}
        onDoubleClick={() => setBpmEdit(String(project.bpm))}
      >
        {bpmEdit !== null ? (
          <input
            autoFocus
            className="lcd-input mono"
            value={bpmEdit}
            onChange={(e) => setBpmEdit(e.target.value)}
            onBlur={() => {
              const v = parseFloat(bpmEdit);
              if (!isNaN(v)) setBpm(v);
              setBpmEdit(null);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setBpmEdit(null);
            }}
          />
        ) : (
          <div className="lcd-big mono">{project.bpm}</div>
        )}
        <div className="lcd-small">TEMPO</div>
      </div>
      <div className="lcd-sep" />
      <div className="lcd-cell" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setKeyOpen(!keyOpen)} title={`Song key: ${fullKeyName(project.key)}`}>
        <div className="lcd-big">{shortKeyName(project.key)}</div>
        <div className="lcd-small">KEY</div>
        {keyOpen && <KeyPopover onClose={() => setKeyOpen(false)} />}
      </div>
      <div className="lcd-sep" />
      <div className="lcd-cell" style={{ cursor: 'pointer' }} onClick={() => openModal('settings')} title="Time signature">
        <div className="lcd-big mono">
          {project.timeSig[0]}/{project.timeSig[1]}
        </div>
        <div className="lcd-small">TIME</div>
      </div>
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
    <div className="save-ind" title={st === 'saved' ? 'All changes saved' : 'Saving…'}>
      {st === 'saved' ? <Check size={13} /> : <Loader2 size={13} className="spin" />}
      <span>{st === 'saved' ? 'Saved' : 'Saving'}</span>
    </div>
  );
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

  return (
    <div className="topbar">
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
        <SaveIndicator />
      </div>

      <div className="tb-group">
        <ViewSwitch />
        <button className={'btn icon tb' + (libraryOpen ? ' active' : '')} title="Library (Y)" onClick={() => useStore.setState({ libraryOpen: !libraryOpen })}>
          <Library size={17} />
        </button>
        <DockButton tab="fx" icon={<SlidersHorizontal size={17} />} label="Smart Controls & FX" shortcut="B" />
        <DockButton tab="editor" icon={<SquarePen size={17} />} label="Editor" shortcut="E" />
        <DockButton tab="instrument" icon={<Piano size={17} />} label="Instrument / Keyboard" shortcut="P" />
        <DockButton tab="mixer" icon={<SlidersVertical size={17} />} label="Mixer" shortcut="X" />
        <DockButton tab="assistant" icon={<Wand2 size={17} />} label="Songwriter: chords, auto-accompaniment & Song Wizard" shortcut="W" />
        <FullScoreButton />
        <button className="btn icon tb" title="New Track (⌥⌘N)" onClick={() => openModal('newTrack')}>
          <Plus size={18} />
        </button>
      </div>

      <div className="tb-center">
        <div className="transport">
          <button className="btn icon tb" title="Go to Beginning (Return)" onClick={() => engine.seek(0)}>
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button className={'btn icon tb play' + (playing ? ' on' : '')} title="Play / Stop (Space)" onClick={() => engine.togglePlay()}>
            {playing ? <Square size={15} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <button className={'btn icon tb rec' + (recording ? ' on' : '')} title="Record (R)" onClick={() => void engine.record()}>
            <Circle size={15} fill="currentColor" />
          </button>
          <button
            className={'btn icon tb' + (project.loop.enabled ? ' cycle-on' : '')}
            title="Cycle (C)"
            onClick={() =>
              commit((d) => {
                d.loop.enabled = !d.loop.enabled;
              })
            }
          >
            <Repeat size={16} />
          </button>
        </div>
        <Lcd />
        <div className="transport">
          <button
            className={'btn icon tb' + (project.metronome ? ' active' : '')}
            title="Metronome (K)"
            onClick={() =>
              commit((d) => {
                d.metronome = !d.metronome;
              })
            }
          >
            <MetronomeIcon />
          </button>
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
        </div>
      </div>

      <div className="tb-group right">
        <button className="btn icon tb" title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={17} />
        </button>
        <button className="btn icon tb" title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={17} />
        </button>
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
        <button className="btn primary tb-export" title="Export song (⌘E)" onClick={() => openModal('export')}>
          <Download size={15} /> Export
        </button>
        <button className="btn icon tb" title="Song settings" onClick={() => openModal('settings')}>
          <Settings size={17} />
        </button>
        <button className="btn icon tb" title="Keyboard shortcuts & help (?)" onClick={() => openModal('help')}>
          <HelpCircle size={17} />
        </button>
      </div>
    </div>
  );
}

function MasterMeter() {
  const l = useTransport((s) => s.levels.__masterL ?? 0);
  const r = useTransport((s) => s.levels.__masterR ?? 0);
  const w = (v: number) => `${Math.min(100, (Math.max(0, 1 + Math.log10(Math.max(v, 1e-4)) / 2.4)) * 100)}%`;
  return (
    <div className="mini-meter">
      <div>
        <i style={{ width: w(l), background: l > 0.98 ? 'var(--record)' : undefined }} />
      </div>
      <div>
        <i style={{ width: w(r), background: r > 0.98 ? 'var(--record)' : undefined }} />
      </div>
    </div>
  );
}

