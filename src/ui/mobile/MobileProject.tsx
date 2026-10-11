// The phone layout: a slim top bar, one full-screen view at a time, and the transport and
// tabs at the bottom where thumbs reach. The views are the same editors as on a computer.
import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Circle,
  Download,
  HelpCircle,
  History,
  LayoutList,
  Library,
  Mic,
  MonitorPlay,
  MoreHorizontal,
  Music4,
  Piano,
  Play,
  Plus,
  Redo2,
  Repeat,
  Settings,
  SkipBack,
  SlidersHorizontal,
  SlidersVertical,
  Square,
  SquarePen,
  Undo2,
  Users,
  FileMusic,
} from 'lucide-react';
import { commit, openModal, redo, undo, useStore, useTransport, type DockTab } from '../../state/store';
import { closeProject } from '../../state/actions';
import { getEngine } from '../../audio/engine';
import { formatPosition, keyName } from '../../model/music';
import TracksView from '../tracks/TracksView';
import Dock from '../Dock';
import LibraryPanel from '../library/LibraryPanel';
import EmptyHint from '../onboarding/EmptyHint';
import LoadingPill from '../onboarding/LoadingPill';
import { saveListeners, type SaveStatus } from '../../state/persistence';
import { openFullScore } from '../editors/score/FullScoreButton';
import { Sheet, SheetItem } from './Sheet';
import { IOSInstallHelp, promptInstall, useInstall } from './install';
import './mobile.css';

type Tab = 'tracks' | 'editor' | 'instrument' | 'mixer';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'tracks', label: 'Tracks', icon: <LayoutList size={21} /> },
  { id: 'editor', label: 'Editor', icon: <SquarePen size={21} /> },
  { id: 'instrument', label: 'Play', icon: <Piano size={21} /> },
  { id: 'mixer', label: 'Mixer', icon: <SlidersVertical size={21} /> },
];

function MetronomeIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6l4 18H5L9 3z" />
      <path d="M12 16l6-10" />
      <path d="M7 16h10" />
    </svg>
  );
}

function SaveDot() {
  const [st, setSt] = useState<SaveStatus>('saved');
  useEffect(() => {
    saveListeners.add(setSt);
    return () => void saveListeners.delete(setSt);
  }, []);
  return <span className={'m-save ' + st} aria-label={st === 'saved' ? 'Saved' : 'Saving'} />;
}

export default function MobileProject() {
  const project = useStore((s) => s.project)!;
  const dockTab = useStore((s) => s.dockTab);
  const libraryOpen = useStore((s) => s.libraryOpen);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [more, setMore] = useState(false);
  const [songMenu, setSongMenu] = useState(false);
  const install = useInstall();
  const [installHelp, setInstallHelp] = useState(false);

  // The bottom tabs drive the same dock state the desktop uses, so "open in editor"
  // anywhere in the app switches the phone to the Editor tab too.
  const tab: Tab | 'other' = dockTab === null ? 'tracks' : dockTab === 'editor' || dockTab === 'instrument' || dockTab === 'mixer' ? dockTab : 'other';
  const go = (t: Tab) => useStore.setState({ dockTab: t === 'tracks' ? null : (t as DockTab), dockMaximized: true, libraryOpen: false });

  return (
    <div className="m-project">
      <header className="m-top">
        <button className="m-icon" onClick={() => void closeProject()} aria-label="Back to My Songs">
          <ChevronLeft size={24} />
        </button>
        <button className="m-title" onClick={() => setSongMenu(true)}>
          <span>{project.name}</span>
          <SaveDot />
        </button>
        <button className="m-icon" disabled={!canUndo} onClick={undo} aria-label="Undo">
          <Undo2 size={20} />
        </button>
        <button className="m-icon" disabled={!canRedo} onClick={redo} aria-label="Redo">
          <Redo2 size={20} />
        </button>
        <button className="m-icon" onClick={() => setMore(true)} aria-label="More">
          <MoreHorizontal size={22} />
        </button>
      </header>
      <LoadingPill />

      <main className="m-main">
        {libraryOpen ? (
          <div className="m-panel m-library">
            <LibraryPanel />
          </div>
        ) : tab === 'tracks' ? (
          <div className="m-panel m-tracks">
            <TracksView />
            <EmptyHint />
            <button className="m-fab" onClick={() => openModal('newTrack')} aria-label="New track">
              <Plus size={24} />
            </button>
          </div>
        ) : (
          <div className="m-panel m-dock">
            <Dock />
          </div>
        )}
      </main>

      <MobileTransport />

      <nav className="m-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id && !libraryOpen ? 'on' : ''} onClick={() => go(t.id)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <button className={tab === 'other' || libraryOpen ? 'on' : ''} onClick={() => setMore(true)}>
          <MoreHorizontal size={21} />
          <span>More</span>
        </button>
      </nav>

      {more && (
        <Sheet title="More" onClose={() => setMore(false)}>
          <SheetItem icon={<SlidersHorizontal size={19} />} label="Smart Controls & Effects" onClick={() => (useStore.setState({ dockTab: 'fx', libraryOpen: false }), setMore(false))} />
          <SheetItem icon={<Music4 size={19} />} label="Chord Track" onClick={() => (useStore.setState({ dockTab: 'assistant', libraryOpen: false }), setMore(false))} />
          <SheetItem icon={<FileMusic size={19} />} label="Full Score" onClick={() => (openFullScore(), useStore.setState({ libraryOpen: false }), setMore(false))} />
          <SheetItem icon={<Library size={19} />} label="Sounds Library" onClick={() => (useStore.setState({ libraryOpen: true }), setMore(false))} />
          <SheetItem icon={<Plus size={19} />} label="New Track" onClick={() => (openModal('newTrack'), setMore(false))} />
          <div className="m-sheet-sep" />
          <SheetItem icon={<Download size={19} />} label="Export" onClick={() => (openModal('export'), setMore(false))} />
          <SheetItem icon={<MonitorPlay size={19} />} label="Publish to YouTube" onClick={() => (openModal('youtube'), setMore(false))} />
          <SheetItem icon={<History size={19} />} label="Version History" onClick={() => (openModal('versions'), setMore(false))} />
          <SheetItem icon={<Users size={19} />} label="Jam Session" onClick={() => (openModal('collab'), setMore(false))} />
          <SheetItem icon={<Settings size={19} />} label="Song Settings" onClick={() => (openModal('settings'), setMore(false))} />
          <SheetItem icon={<HelpCircle size={19} />} label="Help" onClick={() => (openModal('help', { tab: 'start' }), setMore(false))} />
          {install && (
            <SheetItem
              icon={<Download size={19} />}
              label="Add to Home Screen"
              onClick={() => {
                setMore(false);
                if (install === 'prompt') void promptInstall();
                else setInstallHelp(true);
              }}
            />
          )}
        </Sheet>
      )}
      {songMenu && <SongSheet onClose={() => setSongMenu(false)} />}
      {installHelp && <IOSInstallHelp onClose={() => setInstallHelp(false)} />}
    </div>
  );
}

function SongSheet({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)!;
  const [name, setName] = useState(project.name);
  const save = () => {
    const v = name.trim();
    if (v && v !== project.name) commit((d) => void (d.name = v));
  };
  return (
    <Sheet
      title="Song"
      onClose={() => {
        save();
        onClose();
      }}
    >
      <label className="m-field">
        <span>Name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => (e.stopPropagation(), e.key === 'Enter' && (e.target as HTMLInputElement).blur())} />
      </label>
      <SheetItem icon={<Settings size={19} />} label={`Tempo, key and time · ${Math.round(project.bpm)} BPM · ${keyName(project.key)} · ${project.timeSig[0]}/${project.timeSig[1]}`} onClick={() => (openModal('settings'), onClose())} />
      <SheetItem icon={<History size={19} />} label="Version History" onClick={() => (openModal('versions'), onClose())} />
      <SheetItem icon={<Download size={19} />} label="Export" onClick={() => (openModal('export'), onClose())} />
    </Sheet>
  );
}

function MobileTransport() {
  const project = useStore((s) => s.project)!;
  const playing = useStore((s) => s.playing);
  const recording = useStore((s) => s.recording);
  const countingIn = useStore((s) => s.countingIn);
  const cursor = useStore((s) => s.cursor);
  const position = useTransport((s) => s.position);
  const engine = getEngine();
  const pos = playing ? position : cursor;
  return (
    <div className="m-transport">
      <button className="m-lcd" onClick={() => openModal('settings')} aria-label="Tempo and key">
        <b className="mono">{countingIn ? 'COUNT' : formatPosition(Math.max(0, pos), project.timeSig)}</b>
        <span>
          {Math.round(project.bpm)} · {keyName(project.key).replace(' major', '').replace(' minor', 'm')}
        </span>
      </button>
      <button className="m-t" onClick={() => engine.seek(0)} aria-label="Go to beginning">
        <SkipBack size={20} fill="currentColor" />
      </button>
      <button className={'m-t m-play' + (playing ? ' on' : '')} onClick={() => engine.togglePlay()} aria-label={playing ? 'Stop' : 'Play'}>
        {playing ? <Square size={18} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
      </button>
      <button className={'m-t m-rec' + (recording ? ' on' : '')} onClick={() => void engine.record()} aria-label="Record">
        {project.tracks.find((t) => t.armed)?.type === 'audio' ? <Mic size={19} /> : <Circle size={18} fill="currentColor" />}
      </button>
      <button className={'m-t' + (project.loop.enabled ? ' cycle' : '')} onClick={() => commit((d) => void (d.loop.enabled = !d.loop.enabled))} aria-label="Cycle">
        <Repeat size={19} />
      </button>
      <button className={'m-t' + (project.metronome ? ' on-soft' : '')} onClick={() => commit((d) => void (d.metronome = !d.metronome))} aria-label="Metronome">
        <MetronomeIcon />
      </button>
    </div>
  );
}
