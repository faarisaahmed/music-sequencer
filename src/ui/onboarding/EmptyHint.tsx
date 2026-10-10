// Friendly "what now?" card shown over an empty song.
import { useState } from 'react';
import { Piano, Wand2, Library, Plus, Circle, MousePointerClick, X, Lightbulb } from 'lucide-react';
import { openModal, useStore } from '../../state/store';
import { getEngine } from '../../audio/engine';
import { useTour } from './tourState';
import './onboarding.css';

export default function EmptyHint() {
  const projectId = useStore((s) => s.project?.id);
  const empty = useStore((s) => !!s.project && s.project.tracks.every((t) => t.regions.length === 0));
  const recording = useStore((s) => s.recording);
  const touring = useTour((s) => s.tour !== null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!empty || recording || touring || dismissed === projectId) return null;

  const items: { icon: React.ReactNode; label: string; k: string; run: () => void }[] = [
    { icon: <Piano size={16} />, label: 'Play the keyboard', k: 'P', run: () => useStore.setState({ dockTab: 'instrument', dockMaximized: false }) },
    { icon: <Wand2 size={16} />, label: 'Let the Song Wizard write a song', k: 'W', run: () => openModal('songWizard') },
    { icon: <Library size={16} />, label: 'Drag in ready-made loops', k: 'Y', run: () => useStore.setState({ libraryOpen: true }) },
    { icon: <Plus size={16} />, label: 'Add an instrument or mic track', k: '⌥⌘N', run: () => openModal('newTrack') },
    { icon: <Circle size={16} />, label: 'Record what you play', k: 'R', run: () => void getEngine().record() },
    {
      icon: <MousePointerClick size={16} />,
      label: 'Double-click a lane to draw notes',
      k: 'E',
      run: () => useStore.setState({ dockTab: 'editor', dockMaximized: false }),
    },
  ];
  return (
    <div className="empty-hint" onPointerDown={(e) => e.stopPropagation()}>
      <div className="empty-hint-title">
        <Lightbulb size={16} style={{ color: 'var(--yellow)' }} />
        Your song is empty — here are some ways to start
        <div className="spacer" />
        <button className="btn ghost icon sm" title="Hide" onClick={() => setDismissed(projectId ?? null)}>
          <X size={14} />
        </button>
      </div>
      <div className="empty-hint-grid">
        {items.map((it) => (
          <button key={it.label} className="empty-hint-item" onClick={it.run}>
            {it.icon}
            <span>{it.label}</span>
            <kbd className="k">{it.k}</kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
