// Instrument view for the selected track: keyboard, drum pads, sampler or audio input.
import { useEffect } from 'react';
import { findTrack, openModal, useStore } from '../../state/store';
import KeyboardPanel from './KeyboardPanel';
import DrumPads from './DrumPads';
import AudioInputPanel from './AudioInputPanel';
import SamplerSection from './SamplerSection';
import { releaseAll } from './player';
import './instruments.css';

export default function InstrumentPanel() {
  const project = useStore((s) => s.project)!;
  const selected = useStore((s) => s.selectedTrackId);
  const track = findTrack(project, selected);

  // Don't leave notes hanging when switching tracks or closing the panel.
  useEffect(() => () => releaseAll(), [selected]);

  if (!track) {
    return (
      <div className="empty-state">
        <h3>No track selected</h3>
        <div>Select a track, or add a new one to start playing.</div>
        <button className="btn primary" onClick={() => openModal('newTrack')}>
          Add Track
        </button>
      </div>
    );
  }
  if (track.type === 'audio') return <AudioInputPanel track={track} />;
  if (track.type === 'drums') return <DrumPads track={track} />;
  if (track.instrument === 'user-sampler')
    return (
      <div className="ip-sampler">
        <SamplerSection track={track} />
        <div className="ip-sampler-kb">
          <KeyboardPanel track={track} compact />
        </div>
      </div>
    );
  return <KeyboardPanel track={track} />;
}
