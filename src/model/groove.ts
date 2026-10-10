// Swing / groove: a time warp applied at playback (notes stay on the grid in the editors).
// Amount follows the familiar MPC scale: 50% = straight, 66% = triplet feel, 75% = dotted.
import type { Groove, MidiRegion, Note, Project } from './types';

export interface GroovePreset {
  id: string;
  name: string;
  desc: string;
  groove: Groove | null;
}

const pct = (mpc: number) => (mpc - 50) / 25;

export const GROOVE_PRESETS: GroovePreset[] = [
  { id: 'straight', name: 'Straight', desc: 'No swing', groove: null },
  { id: 'light16', name: 'Light 16th', desc: 'A gentle bounce · pop, house', groove: { grid: 16, amount: pct(54) } },
  { id: 'mpc16', name: 'MPC 16th', desc: 'Classic drum-machine swing · 58%', groove: { grid: 16, amount: pct(58) } },
  { id: 'hiphop16', name: 'Boom Bap', desc: 'Deep 16th swing · hip-hop, funk', groove: { grid: 16, amount: pct(62) } },
  { id: 'trip16', name: 'Triplet 16th', desc: 'Full triplet feel · trap hats, Afro', groove: { grid: 16, amount: pct(66.7) } },
  { id: 'dilla', name: 'Laid Back', desc: 'Lazy, slightly late · neo-soul, lo-fi', groove: { grid: 16, amount: pct(57), loose: 0.6 } },
  { id: 'jazz8', name: 'Jazz 8th', desc: 'Medium swing eighths · jazz, swing', groove: { grid: 8, amount: pct(62) } },
  { id: 'shuffle8', name: 'Shuffle', desc: 'Triplet eighths · blues, rock shuffle', groove: { grid: 8, amount: pct(66.7) } },
  { id: 'hard8', name: 'Hard Shuffle', desc: 'Dotted-eighth bounce · country, boogie', groove: { grid: 8, amount: pct(72) } },
  { id: 'live', name: 'Human Feel', desc: 'Straight but loose, like a real player', groove: { grid: 16, amount: 0, loose: 0.45 } },
];

/** True when the groove changes nothing. */
export function isStraight(g: Groove | null | undefined): boolean {
  return !g || (g.amount < 0.005 && !(g.loose && g.loose > 0.005));
}

/** The groove a region plays with: its own, else the song's. */
export function grooveFor(p: Project, r: MidiRegion): Groove | null {
  const g = r.groove !== undefined ? r.groove : p.groove;
  return isStraight(g) ? null : g!;
}

export function swingPercent(g: Groove | null | undefined): number {
  return Math.round(50 + 25 * (g?.amount ?? 0));
}

export function presetFor(g: Groove | null | undefined): GroovePreset | undefined {
  if (isStraight(g)) return GROOVE_PRESETS[0];
  return GROOVE_PRESETS.find(
    (p) => p.groove && p.groove.grid === g!.grid && Math.abs(p.groove.amount - g!.amount) < 0.01 && Math.abs((p.groove.loose ?? 0) - (g!.loose ?? 0)) < 0.01,
  );
}

/** Short label, e.g. "Off", "MPC 16th", "16th 61%". */
export function grooveLabel(g: Groove | null | undefined): string {
  if (isStraight(g)) return 'Off';
  const pr = presetFor(g);
  if (pr) return pr.name;
  return `${g!.grid}th ${swingPercent(g)}%${g!.loose ? ' loose' : ''}`;
}

/** Move a timeline beat to its swung position (grid points on the beat never move). */
export function warpBeat(beat: number, g: Groove): number {
  if (!g.amount) return beat;
  const period = g.grid === 8 ? 1 : 0.5;
  const half = period / 2;
  const mid = half + g.amount * (half / 2);
  const base = Math.floor(beat / period + 1e-9) * period;
  const x = beat - base;
  return x < half ? base + (x * mid) / half : base + mid + ((x - half) * (period - mid)) / (period - half);
}

/** Small, repeatable "late" drift per note for loose / laid-back grooves (beats). */
export function looseOffset(n: Note, g: Groove): number {
  if (!g.loose) return 0;
  let h = 2166136261;
  for (let i = 0; i < n.id.length; i++) h = Math.imul(h ^ n.id.charCodeAt(i), 16777619);
  const r = ((h >>> 0) % 1000) / 1000;
  // Mostly a little late, never early: up to ~1/24 of a beat at full looseness.
  return g.loose * (0.012 + r * 0.03);
}

/** Swung start and duration of a note placed at `start` (timeline beats). */
export function applyGroove(n: Note, start: number, duration: number, g: Groove): { start: number; duration: number } {
  const s = warpBeat(start, g);
  const e = warpBeat(start + duration, g);
  const off = looseOffset(n, g);
  return { start: s + off, duration: Math.max(0.01, e - s) };
}
