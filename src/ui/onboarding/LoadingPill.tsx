// Small pill shown while instrument samples are downloading.
import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { getEngine } from '../../audio/engine';
import { instrumentKey } from '../../audio/mixer';
import './onboarding.css';

export default function LoadingPill() {
  // Changes whenever the set of instruments in the song changes.
  const sig = useStore((s) => (s.project ? s.project.id + '|' + s.project.tracks.map(instrumentKey).join(',') : ''));
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sig) return;
    let alive = true;
    // Only show the pill if loading takes noticeable time (avoids flicker for cached sounds).
    const t = setTimeout(() => alive && setLoading(true), 250);
    // Let the engine sync the new instruments first.
    const id = requestAnimationFrame(() => {
      void getEngine()
        .mixer.ready()
        .finally(() => {
          clearTimeout(t);
          if (alive) setLoading(false);
        });
    });
    return () => {
      alive = false;
      clearTimeout(t);
      cancelAnimationFrame(id);
    };
  }, [sig]);
  if (!loading) return null;
  return (
    <div className="loading-pill">
      <div className="panel-spinner" />
      Loading instruments…
    </div>
  );
}
