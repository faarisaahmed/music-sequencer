// Track automation lanes: which parameters exist, their ranges and their resting values.
import type { AutomationParam, AutomationPoint, Track } from './types';

export function pointsFor(t: Track, param: AutomationParam): AutomationPoint[] {
  return t.automation[param] ?? [];
}

/** The value a lane holds where it has no points: the track's own setting. */
export function restingValue(t: Track, param: AutomationParam): number {
  switch (param) {
    case 'volume':
      return 1;
    case 'pan':
      return t.pan;
    case 'filter':
      return t.fx.filterCutoff;
    case 'reverb':
      return t.fx.reverb;
    case 'delay':
      return t.fx.delay;
  }
}

export const AUTOMATION_RANGE: Record<AutomationParam, [number, number]> = {
  volume: [0, 1.25],
  pan: [-1, 1],
  filter: [0, 1],
  reverb: [0, 1],
  delay: [0, 1],
};

export const AUTOMATION_LABEL: Record<AutomationParam, string> = { volume: 'Volume', pan: 'Pan', filter: 'Filter', reverb: 'Reverb', delay: 'Echo' };

/** Filter cutoff 0..1 → Hz (shared by the mixer and the lane readout). */
export function filterHz(v: number): number {
  return 80 * Math.pow(250, v);
}

export function hasAutomation(t: Track): boolean {
  return Object.values(t.automation).some((pts) => (pts?.length ?? 0) > 0);
}
