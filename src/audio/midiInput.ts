// Web MIDI input: routes hardware keyboards/pads to the selected track.
import { useStore, toast } from '../state/store';
import { getEngine } from './engine';
import { create } from 'zustand';

export const useMidiDevices = create<{ supported: boolean; enabled: boolean; inputs: { id: string; name: string }[]; sustain: boolean }>(() => ({
  supported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  enabled: false,
  inputs: [],
  sustain: false,
}));

let access: MIDIAccess | null = null;
const sustained = new Set<number>();
const physicallyHeld = new Set<number>();

function targetTrack(): string | null {
  return useStore.getState().selectedTrackId;
}

function onMessage(e: MIDIMessageEvent) {
  const data = e.data;
  if (!data || data.length < 2) return;
  const [status, d1, d2 = 0] = data;
  const cmd = status & 0xf0;
  const trackId = targetTrack();
  if (!trackId) return;
  const engine = getEngine();
  if (cmd === 0x90 && d2 > 0) {
    physicallyHeld.add(d1);
    sustained.delete(d1);
    engine.noteOn(trackId, d1, d2 / 127);
  } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
    physicallyHeld.delete(d1);
    if (useMidiDevices.getState().sustain) sustained.add(d1);
    else engine.noteOff(trackId, d1);
  } else if (cmd === 0xb0 && d1 === 64) {
    const on = d2 >= 64;
    useMidiDevices.setState({ sustain: on });
    if (!on) {
      for (const p of sustained) engine.noteOff(trackId, p);
      sustained.clear();
    }
  }
}

function refresh() {
  if (!access) return;
  const inputs: { id: string; name: string }[] = [];
  access.inputs.forEach((inp) => {
    inputs.push({ id: inp.id, name: inp.name ?? 'MIDI device' });
    inp.onmidimessage = onMessage;
  });
  useMidiDevices.setState({ inputs });
}

export async function enableMidi(silent = false): Promise<void> {
  if (access) return;
  if (!useMidiDevices.getState().supported) {
    if (!silent) toast('Web MIDI is not supported in this browser (try Chrome or Edge)', 'error');
    return;
  }
  try {
    access = await navigator.requestMIDIAccess();
    access.onstatechange = () => {
      const before = useMidiDevices.getState().inputs.length;
      refresh();
      const after = useMidiDevices.getState().inputs.length;
      if (after > before) toast('MIDI device connected', 'success');
    };
    refresh();
    useMidiDevices.setState({ enabled: true });
    if (!silent) {
      const n = useMidiDevices.getState().inputs.length;
      toast(n ? `MIDI ready — ${n} device${n > 1 ? 's' : ''} connected` : 'MIDI enabled — plug in a device', 'success');
    }
  } catch {
    if (!silent) toast('MIDI access was denied', 'error');
  }
}
