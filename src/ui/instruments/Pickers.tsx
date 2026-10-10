import { ChevronDown, Cable } from 'lucide-react';
import type { Track } from '../../model/types';
import { CATEGORIES, PRESETS, getPreset } from '../../audio/presets';
import { setTrackInstrument } from '../../state/actions';
import { showContextMenu, type MenuItem } from '../common/menus';
import { IconFor } from '../common/icons';
import { enableMidi, useMidiDevices } from '../../audio/midiInput';

/** Button showing the track's instrument; opens a categorised menu to swap it. */
export function InstrumentPicker({ track }: { track: Track }) {
  const preset = getPreset(track.instrument);
  const open = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isDrums = track.type === 'drums';
    const items: MenuItem[] = isDrums
      ? [{ title: 'Drum Kits' }, ...PRESETS.filter((p) => p.kind === 'drums').map((p) => ({ label: p.name, icon: <IconFor name={p.icon} size={14} />, onClick: () => setTrackInstrument(track.id, p.id) }))]
      : CATEGORIES.filter((c) => c !== 'Drums').map((c) => ({
          label: c,
          submenu: PRESETS.filter((p) => p.category === c).map((p) => ({
            label: p.name,
            shortcut: p.id === track.instrument ? 'Current' : undefined,
            icon: <IconFor name={p.icon} size={14} />,
            onClick: () => setTrackInstrument(track.id, p.id),
          })),
        }));
    showContextMenu({ clientX: r.left, clientY: r.bottom + 4 }, items);
  };
  return (
    <button className="btn kp-picker" onClick={open} title="Change instrument">
      <span style={{ color: track.color, display: 'flex' }}>
        <IconFor name={preset.icon} size={16} />
      </span>
      <span className="kp-picker-name">{preset.name}</span>
      <ChevronDown size={13} className="dim" />
    </button>
  );
}

/** MIDI controller status + connect button. */
export function MidiButton() {
  const { supported, enabled, inputs, sustain } = useMidiDevices();
  const onClick = (e: React.MouseEvent) => {
    if (!enabled) {
      void enableMidi();
      return;
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showContextMenu(
      { clientX: r.left, clientY: r.bottom + 4 },
      [
        { title: 'MIDI Inputs' },
        ...(inputs.length ? inputs.map((i) => ({ label: i.name, icon: <Cable size={14} /> })) : [{ label: 'No devices — plug one in', disabled: true }]),
        { separator: true },
        { label: 'Notes play the selected track', disabled: true },
      ],
    );
  };
  return (
    <button
      className={'btn kp-btn' + (enabled && inputs.length ? ' active' : '')}
      onClick={onClick}
      disabled={!supported}
      title={supported ? (enabled ? `${inputs.length} MIDI device(s) connected` : 'Connect a MIDI keyboard') : 'Web MIDI is not supported in this browser'}
    >
      <Cable size={15} />
      {enabled ? `MIDI${inputs.length ? ` · ${inputs.length}` : ''}` : 'Connect MIDI'}
      {sustain && <span className="kp-led on" title="Sustain pedal down" />}
    </button>
  );
}
