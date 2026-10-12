// Drum colouring shared by the step sequencer and drum pads.

export type DrumFamily = 'kick' | 'snare' | 'hat' | 'tom' | 'perc';

export function drumFamily(pitch: number): DrumFamily {
  if (pitch === 35 || pitch === 36) return 'kick';
  if ([37, 38, 39, 40].includes(pitch)) return 'snare';
  if ([42, 44, 46, 49, 51, 52, 55, 57, 59].includes(pitch)) return 'hat';
  if ([41, 43, 45, 47, 48, 50].includes(pitch)) return 'tom';
  return 'perc';
}

export const FAMILY_COLOR: Record<DrumFamily, string> = {
  kick: '#c9607a',
  snare: '#e08a3c',
  hat: '#6fb3b8',
  tom: '#8fb573',
  perc: '#a88cc2',
};

export function drumColor(pitch: number): string {
  return FAMILY_COLOR[drumFamily(pitch)];
}
