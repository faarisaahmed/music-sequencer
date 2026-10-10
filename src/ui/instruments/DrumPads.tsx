// 4×4 drum pads for drum tracks.
import { Grid3x3, Keyboard as KeyboardIcon } from 'lucide-react';
import type { Track } from '../../model/types';
import { DRUM_NAMES } from '../../model/music';
import { useStore } from '../../state/store';
import { DrumIcon, drumColor } from '../editors/steps/drumVisuals';
import { useLiveNotes } from './Keyboard';
import { press, release, velocityFromY } from './player';
import { PAD_PITCHES, padLegend } from './musicalTyping';
import { InstrumentPicker, MidiButton } from './Pickers';
import { HSlider } from '../common/controls';

export default function DrumPads({ track }: { track: Track }) {
  const lit = useLiveNotes(track.id);
  const typing = useStore((s) => s.musicalTyping);
  const velocity = useStore((s) => s.velocity);
  const legend = padLegend();
  return (
    <div className="kp">
      <div className="kp-bar">
        <InstrumentPicker track={track} />
        <div className="kp-group" title="Maximum velocity">
          <span className="label">Vel</span>
          <HSlider value={velocity} min={0.1} max={1} width={80} undoable={false} defaultValue={0.8} onChange={(v) => useStore.setState({ velocity: v })} />
        </div>
        <div className="spacer" />
        <button className="btn kp-btn" onClick={() => useStore.setState({ dockTab: 'editor', editorMode: 'steps' })}>
          <Grid3x3 size={15} /> Open Step Sequencer
        </button>
        <button className={'btn kp-btn' + (typing ? ' active' : '')} title="Play pads with your computer keyboard" onClick={() => useStore.setState({ musicalTyping: !typing })}>
          <KeyboardIcon size={15} /> Typing
        </button>
        <MidiButton />
      </div>
      <div className="pads-wrap">
        <div className="pads">
          {PAD_PITCHES.map((p) => {
            const c = drumColor(p);
            return (
              <div
                key={p}
                className={'pad' + (lit.has(p) ? ' hit' : '')}
                style={{ ['--c' as string]: c }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  // Hitting nearer the centre is louder, like a real pad.
                  const dx = (e.clientX - rect.left) / rect.width - 0.5;
                  const dy = (e.clientY - rect.top) / rect.height - 0.5;
                  const centre = 1 - Math.min(1, Math.hypot(dx, dy) * 1.4);
                  const v = velocity * (0.55 + 0.45 * Math.max(centre, velocityFromY(e, rect, 0) * 0.3));
                  const src = `pad:${e.pointerId}`;
                  press(src, [p], Math.min(1, v), { raw: true });
                  const up = () => {
                    release(src);
                    window.removeEventListener('pointerup', up);
                  };
                  window.addEventListener('pointerup', up);
                }}
              >
                <div className="pad-icon" style={{ color: c }}>
                  <DrumIcon pitch={p} size={30} />
                </div>
                <div className="pad-name">{DRUM_NAMES[p]}</div>
                {typing && legend[p] && <div className="pad-key">{legend[p].toUpperCase()}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
