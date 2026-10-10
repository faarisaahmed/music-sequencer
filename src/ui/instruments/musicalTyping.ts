// "Musical Typing": play the selected instrument from the computer keyboard (GarageBand layout).
import { useEffect } from 'react';
import { findTrack, toast, useStore } from '../../state/store';
import { isTyping } from '../common/drag';
import { press, release, setSustain, usePlayer } from './player';

/** Key → semitone offset from the typing base C. */
export const TYPING_KEYS: string[] = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', "'"];

/** Drum pads in the order musical-typing keys address them. */
export const PAD_PITCHES = [36, 38, 39, 42, 46, 49, 51, 37, 41, 45, 48, 56, 70, 54, 75, 35];

export function typingBase(octave: number): number {
  return 12 * (octave + 4);
}

/** Pitch → key letter for drawing the legend on the on-screen keyboard. */
export function typingLegend(octave: number): Record<number, string> {
  const base = typingBase(octave);
  const out: Record<number, string> = {};
  TYPING_KEYS.forEach((k, i) => (out[base + i] = k));
  return out;
}

export function padLegend(): Record<number, string> {
  const out: Record<number, string> = {};
  PAD_PITCHES.forEach((p, i) => {
    if (i < TYPING_KEYS.length) out[p] = TYPING_KEYS[i];
  });
  return out;
}

/** Mount once (globally) — listens for musical typing while it is enabled. */
export function useMusicalTyping(): void {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (!s.musicalTyping || s.modal || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const track = findTrack(s.project, s.selectedTrackId);
      if (!track) return;
      if (key === 'z' || key === 'x') {
        e.preventDefault();
        if (e.repeat) return;
        const o = Math.max(-2, Math.min(5, s.keyboardOctave + (key === 'z' ? -1 : 1)));
        useStore.setState({ keyboardOctave: o });
        toast(`Octave: C${o + 3}`);
        return;
      }
      if (key === 'c' || key === 'v') {
        e.preventDefault();
        const v = Math.max(0.1, Math.min(1, Math.round((s.velocity + (key === 'c' ? -0.1 : 0.1)) * 10) / 10));
        useStore.setState({ velocity: v });
        if (!e.repeat) toast(`Velocity: ${Math.round(v * 127)}`);
        return;
      }
      if (key === 'tab') {
        e.preventDefault();
        if (!e.repeat) setSustain(!usePlayer.getState().sustain);
        return;
      }
      const idx = TYPING_KEYS.indexOf(key);
      if (idx < 0) return;
      e.preventDefault();
      if (e.repeat) return;
      if (track.type === 'drums') {
        const p = PAD_PITCHES[idx];
        if (p !== undefined) press(`ty:${key}`, [p], s.velocity, { raw: true });
      } else if (track.type === 'instrument') {
        press(`ty:${key}`, [typingBase(s.keyboardOctave) + idx], s.velocity);
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (TYPING_KEYS.includes(key)) release(`ty:${key}`);
    };
    const blur = () => TYPING_KEYS.forEach((k) => release(`ty:${k}`));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
}
