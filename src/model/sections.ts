// Arrangement section helpers (pure).
import type { Section } from './types';
import { uid } from './defaults';

export const SECTION_COLORS = ['#5b8cff', '#34c759', '#ff9f0a', '#bf5af2', '#ff375f', '#32d0e6', '#ffd60a', '#8e8e93'];
export const NAME_SEQUENCE = ['Intro', 'Verse', 'Chorus', 'Verse 2', 'Chorus 2', 'Bridge', 'Chorus 3', 'Outro'];
const NAME_COLORS: Record<string, string> = { Intro: '#8e8e93', Verse: '#5b8cff', Chorus: '#ff9f0a', Bridge: '#bf5af2', Outro: '#32d0e6', 'Pre-Chorus': '#34c759', Breakdown: '#ff375f', Solo: '#ffd60a' };

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
