// Small presence indicators for collaborators: who's on which track, who's editing which
// region, and where each person's playhead is.
import { useEffect, useRef } from 'react';
import { useCollab, initials, type Peer } from '../../collab/state';
import { HEADER_W } from '../tracks/tracksUi';

function usePeers(): Peer[] {
  const peers = useCollab((s) => s.peers);
  return Object.values(peers);
}

export function TrackPresence({ trackId }: { trackId: string }) {
  const here = usePeers().filter((p) => p.selectedTrackId === trackId);
  if (!here.length) return null;
  return (
    <div className="presence-dots">
      {here.slice(0, 3).map((p) => (
        <span key={p.id} className="presence-dot" style={{ background: p.color }} title={`${p.name} is on this track`}>
          {initials(p.name)}
        </span>
      ))}
    </div>
  );
}

export function RegionPresence({ regionId }: { regionId: string }) {
  const here = usePeers().filter((p) => p.editingRegionId === regionId);
  if (!here.length) return null;
  const p = here[0];
  return (
    <>
      <div className="presence-outline" style={{ borderColor: p.color }} />
      <div className="presence-tag" style={{ background: p.color }}>
        {here.map((x) => x.name).join(', ')}
      </div>
    </>
  );
}

/** Thin coloured playheads for collaborators who are playing. Extrapolated between updates. */
export function PeerPlayheads({ ppb }: { ppb: number }) {
  const peers = usePeers().filter((p) => p.playing);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const ppbRef = useRef(ppb);
  useEffect(() => {
    ppbRef.current = ppb;
  }, [ppb]);
  const active = peers.length > 0;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      for (const p of Object.values(useCollab.getState().peers)) {
        const el = refs.current.get(p.id);
        if (!el || !p.playing) continue;
        const beat = p.position + ((now - p.posAt) / 1000) * (p.bpm / 60);
        el.style.transform = `translateX(${HEADER_W + Math.max(0, beat) * ppbRef.current}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return (
    <>
      {peers.map((p) => (
        <div
          key={p.id}
          ref={(el) => {
            if (el) refs.current.set(p.id, el);
            else refs.current.delete(p.id);
          }}
          className="peer-playhead"
          style={{ ['--pc' as string]: p.color }}
        >
          <span>{p.name}</span>
        </div>
      ))}
    </>
  );
}
