// Audio input preferences (per browser, not per song): device, input gain and
// recording latency compensation.
import { create } from 'zustand';

export interface InputSettings {
  deviceId: string; // '' = system default
  gainDb: number; // -12..+24
  latencyMs: number; // extra compensation applied when placing recordings (+ = shift earlier)
}

const KEY = 'bandforge-input-settings';

function load(): InputSettings {
  const def: InputSettings = { deviceId: '', gainDb: 0, latencyMs: 0 };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return def;
  }
}

export const useInputSettings = create<InputSettings>(() => load());

useInputSettings.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
});

export function setInputSettings(patch: Partial<InputSettings>): void {
  useInputSettings.setState(patch);
}

export async function listInputDevices(): Promise<{ id: string; label: string }[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Input ${i + 1}` }));
}
