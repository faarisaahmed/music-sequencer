import { Maximize2, Minimize2, X } from 'lucide-react';
import { useStore, type DockTab } from '../state/store';
import EditorPanel from './editors/EditorPanel';
import InstrumentPanel from './instruments/InstrumentPanel';
import MixerPanel from './mixer/MixerPanel';
import FxPanel from './mixer/FxPanel';
import { lazy, Suspense } from 'react';
import { PanelLoading } from './common/Lazy';
import ReviewPanel from './assistant/ReviewPanel';

const AssistantPanel = lazy(() => import('./assistant/AssistantPanel'));

const TABS: { id: DockTab; label: string; cmd: string }[] = [
  { id: 'fx', label: 'Smart Controls', cmd: 'view.fx' },
  { id: 'editor', label: 'Editor', cmd: 'view.editor' },
  { id: 'instrument', label: 'Instrument', cmd: 'view.instrument' },
  { id: 'mixer', label: 'Mixer', cmd: 'view.mixer' },
  { id: 'assistant', label: 'Chord Track', cmd: 'view.chords' },
  { id: 'review', label: 'Check', cmd: 'view.review' },
];

export default function Dock() {
  const tab = useStore((s) => s.dockTab);
  const max = useStore((s) => s.dockMaximized);
  return (
    <div className="dock-inner" onPointerDownCapture={() => useStore.setState({ focusArea: tab === 'editor' ? 'editor' : tab === 'instrument' ? 'instrument' : 'other' })}>
      <div className="dock-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={'dock-tab' + (tab === t.id ? ' on' : '')} data-cmd={t.cmd} onClick={() => useStore.setState({ dockTab: t.id })}>
            {t.label}
          </button>
        ))}
        <div className="spacer" />
        <button className="btn ghost icon sm" title={max ? 'Restore' : 'Maximize'} onClick={() => useStore.setState({ dockMaximized: !max })}>
          {max ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button className="btn ghost icon sm" title="Close" onClick={() => useStore.setState({ dockTab: null, dockMaximized: false })}>
          <X size={15} />
        </button>
      </div>
      <div className="dock-content">
        {tab === 'editor' && <EditorPanel />}
        {tab === 'instrument' && <InstrumentPanel />}
        {tab === 'mixer' && <MixerPanel />}
        {tab === 'fx' && <FxPanel />}
        {tab === 'review' && <ReviewPanel />}
        {tab === 'assistant' && (
          <Suspense fallback={<PanelLoading />}>
            <AssistantPanel />
          </Suspense>
        )}
      </div>
    </div>
  );
}
