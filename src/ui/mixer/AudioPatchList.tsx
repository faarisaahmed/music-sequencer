// Library list of channel patches for audio tracks (guitar amps, bass, vocal chains, creative FX).
import { Check, Guitar, Mic, Sparkles } from 'lucide-react';
import type { Track } from '../../model/types';
import { updateTrack } from '../../state/actions';
import { AUDIO_PATCHES, type AudioPatch } from '../../audio/audioPatches';

const ICON: Record<AudioPatch['category'], React.ReactNode> = {
  Guitar: <Guitar size={15} />,
  Bass: <Guitar size={15} />,
  Vocals: <Mic size={15} />,
  Creative: <Sparkles size={15} />,
};

function matches(t: Track, p: AudioPatch): boolean {
  return JSON.stringify(t.fx) === JSON.stringify(p.fx);
}

export default function AudioPatchList({ t }: { t: Track }) {
  return (
    <>
      <div className="lib-current">
        <div className="lib-current-icon" style={{ color: t.color }}>
          <Mic size={26} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: 14 }}>Audio Patches</div>
          <div className="faint" style={{ fontSize: 11.5 }}>
            Effect chains for guitar, bass &amp; vocals — plug in and record
          </div>
        </div>
      </div>
      <div className="lib-list">
        {(['Guitar', 'Bass', 'Vocals', 'Creative'] as const).map((cat) => (
          <div key={cat} className="lib-group">
            <div className="lib-group-head">{cat}</div>
            {AUDIO_PATCHES.filter((p) => p.category === cat).map((p) => {
              const on = matches(t, p);
              return (
                <div
                  key={p.id}
                  className={'lib-item' + (on ? ' on' : '')}
                  onClick={() => updateTrack(t.id, (x) => void (x.fx = structuredClone(p.fx)))}
                >
                  <div className="lib-ic">{ICON[cat]}</div>
                  <div className="lib-item-text">
                    <div className="lib-item-name">{p.name}</div>
                    <div className="lib-item-sub">{p.description}</div>
                  </div>
                  {on && <Check size={14} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
