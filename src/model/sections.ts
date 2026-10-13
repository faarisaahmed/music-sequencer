// Arrangement section helpers (pure).
import type { Section } from './types';
import { uid } from './defaults';

export const SECTION_COLORS = ['#7a86e6', '#5dbb7a', '#e08a3c', '#a07ae0', '#e06a8f', '#45b8c4', '#e3c35a', '#939089'];
export const NAME_SEQUENCE = ['Intro', 'Verse', 'Chorus', 'Verse 2', 'Chorus 2', 'Bridge', 'Chorus 3', 'Outro'];
const NAME_COLORS: Record<string, string> = { Intro: '#939089', Verse: '#7a86e6', Chorus: '#e08a3c', Bridge: '#a07ae0', Outro: '#45b8c4', 'Pre-Chorus': '#5dbb7a', Breakdown: '#e06a8f', Solo: '#e3c35a' };

export function colorForName(name: string): string {
  const base = name.replace(/\s*\d+$/, '');
  return NAME_COLORS[base] ?? SECTION_COLORS[Math.abs([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % SECTION_COLORS.length];
}

export function makeSection(name: string, start: number, length: number): Section {
  return { id: uid('s'), name, start, length, color: colorForName(name) };
}

/** Build sections from bar lengths, e.g. [['Intro', 4], ['Verse', 8]]. */
export function sectionsFromBars(parts: [string, number][], bpb: number, startBar = 0): Section[] {
  let bar = startBar;
  return parts.map(([name, bars]) => {
    const s = makeSection(name, bar * bpb, bars * bpb);
    bar += bars;
    return s;
  });
}
