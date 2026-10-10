// Tracks ↔ Live Loops view switcher for the top bar (like GarageBand's).
import { LayoutGrid, Rows3 } from 'lucide-react';
import { useStore } from '../../state/store';

export default function ViewSwitch() {
  const view = useStore((s) => s.mainView);
  const set = (v: 'tracks' | 'liveloops') => useStore.setState({ mainView: v, focusArea: v === 'tracks' ? 'tracks' : 'other' });
  return (
    <div className="seg view-switch" title="Switch between Tracks and Live Loops (G)">
      <button className={view === 'tracks' ? 'on' : ''} onClick={() => set('tracks')} title="Tracks">
        <Rows3 size={15} />
      </button>
      <button className={view === 'liveloops' ? 'on' : ''} onClick={() => set('liveloops')} title="Live Loops">
        <LayoutGrid size={15} />
      </button>
    </div>
  );
}
