// Top-bar toggle that opens the whole-song score in a maximized editor dock.
import { useStore } from '../../../state/store';

function ScoreIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18M3 9h18M3 13h18M3 17h18" opacity="0.55" />
      <path d="M14 17.5V6l5-1.2" strokeWidth={2} />
      <ellipse cx="11.6" cy="17.6" rx="2.6" ry="1.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function openFullScore(): void {
  useStore.setState({ dockTab: 'editor', editorMode: 'fullscore', dockMaximized: true, focusArea: 'editor' });
}

export default function FullScoreButton() {
  const on = useStore((s) => s.dockTab === 'editor' && s.editorMode === 'fullscore');
  return (
    <button
      className={'btn icon tb' + (on ? ' active' : '')}
      title="Full Score — the whole song as sheet music"
      onClick={() => (on ? useStore.setState({ dockTab: null, dockMaximized: false }) : openFullScore())}
    >
      <ScoreIcon />
    </button>
  );
}
