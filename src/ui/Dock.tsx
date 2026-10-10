import { Maximize2, Minimize2, X } from 'lucide-react';
import { useStore, type DockTab } from '../state/store';
import EditorPanel from './editors/EditorPanel';
import InstrumentPanel from './instruments/InstrumentPanel';
import MixerPanel from './mixer/MixerPanel';
import FxPanel from './mixer/FxPanel';
import AssistantPanel from './assistant/AssistantPanel';

const TABS: { id: DockTab; label: string }[] = [
  { id: 'fx', label: 'Smart Controls' },
  { id: 'editor', label: 'Editor' },
  { id: 'instrument', label: 'Instrument' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'assistant', label: 'Songwriter' },
];

export default function Dock() {
  const tab = useStore((s) => s.dockTab);
  const max = useStore((s) => s.dockMaximized);
  return (
    <div className="dock-inner" onPointerDownCapture={() => useStore.setState({ focusArea: tab === 'editor' ? 'editor' : tab === 'instrument' ? 'instrument' : 'other' })}>
      <div className="dock-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={'dock-tab' + (tab === t.id ? ' on' : '')} onClick={() => useStore.setState({ dockTab: t.id })}>
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
        {tab === 'assistant' && <AssistantPanel />}
      </div>
    </div>
  );
}
