import { useState } from 'react';
import { Compass, Keyboard } from 'lucide-react';
import ShortcutsPanel from '../keys/ShortcutsPanel';
import { shortcutLabel } from '../keys/keymap';
import { closeModal, useStore } from '../../state/store';
import { startTour } from '../onboarding/tourState';
import '../onboarding/onboarding.css';
import Modal from './Modal';
import '../mixer/mixer.css';

export default function HelpDialog() {
  const initial = (useStore.getState().modal?.data as { tab?: 'shortcuts' | 'start' } | undefined)?.tab ?? 'shortcuts';
  const [tab, setTab] = useState<'shortcuts' | 'start'>(initial);
  return (
    <Modal
      title={
        <div className="row" style={{ gap: 14 }}>
          <span>Help</span>
          <div className="seg">
            <button className={tab === 'shortcuts' ? 'on' : ''} onClick={() => setTab('shortcuts')}>
              <Keyboard size={13} /> Keyboard Shortcuts
            </button>
            <button className={tab === 'start' ? 'on' : ''} onClick={() => setTab('start')}>
              <Compass size={13} /> Getting Started
            </button>
          </div>
        </div>
      }
      width={820}
    >
      {tab === 'shortcuts' ? (
        <ShortcutsPanel />
      ) : (
      <>
      <div className="help-tour">
        <div>
          <b>New here?</b> Take a one-minute guided tour of the studio.
        </div>
        <button
          className="btn primary sm"
          onClick={() => {
            closeModal();
            startTour(useStore.getState().screen === 'project' ? 'project' : 'home');
          }}
        >
          <Compass size={14} /> Take the tour
        </button>
      </div>
      <div className="form-section">Getting started</div>
      <ol className="help-steps">
        <li>
          Press <b>+</b> in the top bar to add a track — a <b>Software Instrument</b>, <b>Drums</b>, an <b>Audio Recorder</b> for your mic, or a <b>Sampler</b>.
        </li>
        <li>
          Play with your computer keyboard, the on-screen keys (<b>{shortcutLabel('view.instrument')}</b>) or a MIDI keyboard. Press <b>{shortcutLabel('transport.record')}</b> to record what you play.
        </li>
        <li>
          Double-click a region to edit it in the <b>Piano Roll</b>, <b>Score</b>, or <b>Step Sequencer</b> (drums). Drag notes to move them, drag edges to resize.
        </li>
        <li>
          Drag the right edge of a region to make it longer, turn on looping to repeat it, and press <b>{shortcutLabel('region.split')}</b> to cut it at the playhead.
        </li>
        <li>
          Shape the mix in the <b>Mixer</b> ({shortcutLabel('view.mixer')}) and <b>Smart Controls</b> ({shortcutLabel('view.fx')}). Draw volume curves in a track’s automation lane for fades and dynamics.
        </li>
        <li>
          Change tempo and key in the display at the top. When you’re done, <b>Export</b> to MP3, WAV or MIDI.
        </li>
        <li>
          Make music with friends: click the <b>people icon</b> in the top bar, press <b>Start Session</b> and send them the link. Everyone edits the same song live.
        </li>
      </ol>
      </>
      )}
    </Modal>
  );
}
