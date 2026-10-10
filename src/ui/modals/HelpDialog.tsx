import { Compass } from 'lucide-react';
import { closeModal, useStore } from '../../state/store';
import { startTour } from '../onboarding/tourState';
import '../onboarding/onboarding.css';
import Modal from './Modal';
import '../mixer/mixer.css';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const CMD = isMac ? '⌘' : 'Ctrl';
const OPT = isMac ? '⌥' : 'Alt';

type Row = [string, string[]];

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Transport',
    rows: [
      ['Play / Stop', ['Space']],
      ['Record', ['R']],
      ['Go to beginning', ['Return']],
      ['Previous / next bar', [',', '.']],
      ['Cycle (loop) on/off', ['C']],
      ['Loop the selected regions’ bars (or this bar)', ['⇧ C']],
      ['Loop one bar: double-click it in the ruler', []],
      ['Metronome on/off', ['K']],
    ],
  },
  {
    title: 'Views',
    rows: [
      ['Editor (piano roll / score / steps)', ['E']],
      ['Instrument / keyboard', ['P']],
      ['Mixer', ['X']],
      ['Smart Controls & FX', ['B']],
      ['Sounds library', ['Y']],
      ['Zoom in / out', [`${CMD} =`, `${CMD} −`]],
      ['This help', ['?']],
    ],
  },
  {
    title: 'Song',
    rows: [
      ['Undo / Redo', [`${CMD} Z`, `⇧${CMD} Z`]],
      ['Save', [`${CMD} S`]],
      ['Export', [`${CMD} E`]],
      ['New track', [`${OPT}${CMD} N`]],
      ['Select track above / below', ['↑', '↓']],
      ['Mute / Solo selected track', ['M', 'S']],
    ],
  },
  {
    title: 'Regions (tracks area)',
    rows: [
      ['Copy / Cut / Paste', [`${CMD} C`, `${CMD} X`, `${CMD} V`]],
      ['Duplicate', [`${CMD} D`]],
      ['Split at playhead', [`${CMD} T`]],
      ['Join regions', [`${CMD} J`]],
      ['Select all', [`${CMD} A`]],
      ['Loop region on/off', ['L']],
      ['Delete', ['Delete']],
    ],
  },
  {
    title: 'Musical typing',
    rows: [
      ['White keys C D E F G A B C…', ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K']],
      ['Black keys', ['W', 'E', 'T', 'Y', 'U', 'O', 'P']],
      ['Octave down / up', ['Z', 'X']],
      ['Velocity down / up', ['C', 'V']],
    ],
  },
  {
    title: 'Score editor',
    rows: [
      ['Write / Select mode', ['N']],
      ['Durations: 32nd, 16th, 8th, quarter, half, whole', ['2', '…', '7']],
      ['Dotted duration', ['.']],
      ['Enter note by name', ['A', '…', 'G']],
      ['Add note to chord', ['⇧', 'A', '…', 'G']],
      ['Tie to next note', ['+']],
      ['Move note up / down (⌥ = scale step)', ['↑', '↓']],
      ['Up / down an octave', [`${CMD} ↑`, `${CMD} ↓`]],
      ['Previous / next note', ['←', '→']],
      ['Rest', ['0']],
      ['Delete note', ['Delete']],
      ['Triplets on / off', [`${CMD} 3`]],
      ['Voice 1 / voice 2', ['⌥ 1', '⌥ 2']],
      ['Staccato / tenuto / accent / marcato', ['⇧S', '⇧N', '⇧V', '⇧O']],
      ['Lyrics (Space = next note, - = hyphen)', [`${CMD} L`]],
      ['Chord symbol (Space = next beat, Tab = next bar)', [`${CMD} K`]],
      ['Full score of the whole song', ['Top-bar score button']],
    ],
  },
];

export default function HelpDialog() {
  return (
    <Modal title="BandForge Help" width={820}>
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
          Play with your computer keyboard, the on-screen keys (<b>P</b>) or a MIDI keyboard. Press <b>R</b> to record what you play.
        </li>
        <li>
          Double-click a region to edit it in the <b>Piano Roll</b>, <b>Score</b>, or <b>Step Sequencer</b> (drums). Drag notes to move them, drag edges to resize.
        </li>
        <li>
          Drag the right edge of a region to make it longer, turn on looping to repeat it, and press <b>{CMD} T</b> to cut it at the playhead.
        </li>
        <li>
          Shape the mix in the <b>Mixer</b> (X) and <b>Smart Controls</b> (B). Draw volume curves in a track’s automation lane for fades and dynamics.
        </li>
        <li>
          Change tempo and key in the display at the top. When you’re done, <b>Export</b> to MP3, WAV or MIDI.
        </li>
        <li>
          Make music with friends: click the <b>people icon</b> in the top bar, press <b>Start Session</b> and send them the link. Everyone edits the same song live.
        </li>
      </ol>
      <div className="help-cols">
        {SECTIONS.map((s) => (
          <div key={s.title} className="help-sec">
            <h4>{s.title}</h4>
            {s.rows.map(([label, keys]) => (
              <div key={label} className="help-row">
                <span>{label}</span>
                <span className="keys">
                  {keys.map((k, i) => (k === '…' ? <span key={i} className="faint">…</span> : <kbd key={i}>{k}</kbd>))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
