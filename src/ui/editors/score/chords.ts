// Chord symbols on the project chord track: naming, parsing typed symbols, editing.
import type { ChordQuality, ChordSymbol, KeySignature } from '../../../model/types';
import { uid } from '../../../model/defaults';
import { keyUsesFlats, pitchClassName } from '../../../model/music';
import { meterOf } from '../../../model/timeline';
import { commit } from '../../../state/store';

const QUALITY_TEXT: Record<ChordQuality, string> = {
  '': '',
  m: 'm',
  dim: 'dim',
  aug: '+',
  '7': '7',
  maj7: 'maj7',
  m7: 'm7',
  sus4: 'sus4',
  sus2: 'sus2',
  add9: 'add9',
  '6': '6',
  m6: 'm6',
  m9: 'm9',
  '9': '9',
};

export function chordName(c: Pick<ChordSymbol, 'root' | 'quality' | 'bass'>, key: KeySignature): string {
  const flats = keyUsesFlats(key);
  const root = pitchClassName(c.root, flats);
  return root + QUALITY_TEXT[c.quality] + (c.bass !== undefined && c.bass !== c.root ? '/' + pitchClassName(c.bass, flats) : '');
}

const QUALITY_ALIASES: [RegExp, ChordQuality][] = [
  [/^(maj7|M7|Δ7?|ma7)$/, 'maj7'],
  [/^(m7|min7|-7|mi7)$/, 'm7'],
  [/^(m9|min9|-9)$/, 'm9'],
  [/^(m6|min6|-6)$/, 'm6'],
  [/^(m|min|-|mi)$/, 'm'],
  [/^(dim|°|o|dim7|°7|m7b5|ø7?)$/, 'dim'],
  [/^(aug|\+|\+5|#5)$/, 'aug'],
  [/^(sus4|sus)$/, 'sus4'],
  [/^sus2$/, 'sus2'],
  [/^(add9|add2|2)$/, 'add9'],
  [/^6$/, '6'],
  [/^(7|dom7)$/, '7'],
  [/^9$/, '9'],
  [/^(M|maj|major)?$/, ''],
];

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parseRoot(s: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]?)$/.exec(s);
  if (!m) return null;
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return (LETTER_PC[m[1].toUpperCase()] + acc + 12) % 12;
}

/** Parse "Am7", "F#dim", "Bb/D", "Csus4"… Returns null when it can't be understood. */
export function parseChord(text: string): Pick<ChordSymbol, 'root' | 'quality' | 'bass'> | null {
  const t = text.trim().replace(/\s+/g, '');
  const m = /^([A-Ga-g][#b♯♭]?)([^/]*)(?:\/([A-Ga-g][#b♯♭]?))?$/.exec(t);
  if (!m) return null;
  const root = parseRoot(m[1]);
  if (root === null) return null;
  const qText = m[2];
  const q = QUALITY_ALIASES.find(([re]) => re.test(qText))?.[1];
  if (q === undefined) return null;
  const bass = m[3] ? parseRoot(m[3]) : null;
  return bass === null ? { root, quality: q } : { root, quality: q, bass };
}

/** Insert, replace or (with empty text) remove the chord at an absolute beat. Returns false if unparseable. */
export function setChordAt(beat: number, text: string): boolean {
  const parsed = text.trim() ? parseChord(text) : null;
  if (text.trim() && !parsed) return false;
  commit((d) => {
    if (!d.chords) d.chords = [];
    const eps = 1e-3;
    const existing = d.chords.find((c) => Math.abs(c.beat - beat) < eps);
    if (!parsed) {
      if (existing) d.chords = d.chords.filter((c) => c !== existing);
      return;
    }
    if (existing) {
      existing.root = parsed.root;
      existing.quality = parsed.quality;
      if (parsed.bass !== undefined) existing.bass = parsed.bass;
      else delete existing.bass;
      return;
    }
    const bar = meterOf(d).barAt(beat + 1e-9);
    const next = d.chords.filter((c) => c.beat > beat + eps).sort((a, b) => a.beat - b.beat)[0];
    const prev = d.chords.filter((c) => c.beat < beat - eps).sort((a, b) => b.beat - a.beat)[0];
    if (prev && prev.beat + prev.length > beat) prev.length = beat - prev.beat;
    const barEnd = bar.start + bar.len;
    const length = Math.max(0.25, Math.min(next ? next.beat - beat : Infinity, barEnd - beat));
    d.chords.push({ id: uid('c'), beat, length, ...parsed });
    d.chords.sort((a, b) => a.beat - b.beat);
  });
  return true;
}

export function chordAt(chords: ChordSymbol[] | undefined, beat: number): ChordSymbol | undefined {
  return (chords ?? []).find((c) => Math.abs(c.beat - beat) < 1e-3);
}
