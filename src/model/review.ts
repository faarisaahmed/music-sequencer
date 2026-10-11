// Writing check: things a teacher would point out — notes an instrument can't play, notes that
// rub a half step against another part or the chord, and parallel fifths/octaves. It only
// points things out; it never changes your music.
import type { Project, Track } from './types';
import { placedNotes } from './regions';
import { meterOf } from './timeline';
import { pitchClassName } from './music';

/** Playable sounding ranges (MIDI) of real instruments. */
export const RANGES: Record<string, { lo: number; hi: number; name: string }> = {
  violin: { lo: 55, hi: 103, name: 'Violin' },
  cello: { lo: 36, hi: 81, name: 'Cello' },
  'upright-bass': { lo: 28, hi: 67, name: 'Upright bass' },
  'upright-bass-bowed': { lo: 28, hi: 67, name: 'Upright bass' },
  'electric-bass': { lo: 28, hi: 67, name: 'Electric bass' },
  'string-ensemble': { lo: 28, hi: 103, name: 'Strings' },
  'pizzicato-strings': { lo: 28, hi: 96, name: 'Strings' },
  harp: { lo: 24, hi: 103, name: 'Harp' },
  flute: { lo: 60, hi: 96, name: 'Flute' },
  clarinet: { lo: 50, hi: 91, name: 'Clarinet' },
  saxophone: { lo: 49, hi: 80, name: 'Alto sax' },
  trumpet: { lo: 52, hi: 82, name: 'Trumpet' },
  trombone: { lo: 40, hi: 72, name: 'Trombone' },
  'french-horn': { lo: 35, hi: 77, name: 'French horn' },
  tuba: { lo: 26, hi: 65, name: 'Tuba' },
  bassoon: { lo: 34, hi: 75, name: 'Bassoon' },
  'acoustic-guitar': { lo: 40, hi: 86, name: 'Guitar' },
  'nylon-guitar': { lo: 40, hi: 83, name: 'Guitar' },
  'electric-guitar': { lo: 40, hi: 88, name: 'Guitar' },
  xylophone: { lo: 65, hi: 108, name: 'Xylophone' },
  marimba: { lo: 36, hi: 96, name: 'Marimba' },
  celesta: { lo: 60, hi: 108, name: 'Celesta' },
  'grand-piano': { lo: 21, hi: 108, name: 'Piano' },
  'bright-piano': { lo: 21, hi: 108, name: 'Piano' },
  'felt-piano': { lo: 21, hi: 108, name: 'Piano' },
  'honky-tonk': { lo: 21, hi: 108, name: 'Piano' },
  harpsichord: { lo: 29, hi: 89, name: 'Harpsichord' },
  accordion: { lo: 53, hi: 93, name: 'Accordion' },
};

export type IssueKind = 'range' | 'clash' | 'chord' | 'parallel';

export interface Issue {
  id: string;
  kind: IssueKind;
  /** Song beat where it happens. */
  beat: number;
  bar: number;
  title: string;
  /** Why it matters / what to try. */
  hint: string;
  trackIds: string[];
  /** The notes involved (region id + note id). */
  notes: { regionId: string; noteId: string }[];
}

interface Sounding {
  trackId: string;
  regionId: string;
  noteId: string;
  pitch: number; // sounding
  s: number;
  e: number;
}

function pitched(t: Track) {
  return t.type === 'instrument';
}

function soundingNotes(t: Track): Sounding[] {
  const out: Sounding[] = [];
  for (const r of t.regions) {
    if (r.kind !== 'midi' || r.muted) continue;
    for (const pn of placedNotes(r)) {
      if (pn.note.grace) continue;
      out.push({ trackId: t.id, regionId: r.id, noteId: pn.note.id, pitch: pn.note.pitch + t.transpose, s: pn.start, e: pn.start + pn.duration });
    }
  }
  return out.sort((a, b) => a.s - b.s || b.pitch - a.pitch);
}

const name = (p: number, flats: boolean) => pitchClassName(((p % 12) + 12) % 12, flats) + (Math.floor(p / 12) - 1);

export function reviewSong(p: Project, opts: { flats?: boolean } = {}): Issue[] {
  const meter = meterOf(p);
  const flats = opts.flats ?? false;
  const issues: Issue[] = [];
  const tracks = p.tracks.filter(pitched);
  const notesOf = new Map(tracks.map((t) => [t.id, soundingNotes(t)]));
  const barOf = (b: number) => meter.barAt(b).bar + 1;
  const strong = (b: number) => Math.abs(b - Math.round(b)) < 1e-6;

  // ---- range
  for (const t of tracks) {
    const r = RANGES[t.instrument];
    if (!r) continue;
    const out = notesOf.get(t.id)!.filter((n) => n.pitch < r.lo || n.pitch > r.hi);
    // One issue per stretch of out-of-range notes, so a long high passage is one item.
    let group: Sounding[] = [];
    const flush = () => {
      if (!group.length) return;
      const high = group[0].pitch > r.hi;
      const lim = high ? r.hi : r.lo;
      issues.push({
        id: `range:${t.id}:${group[0].noteId}`,
        kind: 'range',
        beat: group[0].s,
        bar: barOf(group[0].s),
        title: `${t.name}: ${group.length === 1 ? name(group[0].pitch, flats) + ' is' : group.length + ' notes are'} too ${high ? 'high' : 'low'} for a real ${r.name.toLowerCase()}`,
        hint: `A ${r.name.toLowerCase()} plays from ${name(r.lo, flats)} to about ${name(r.hi, flats)}. Move ${group.length === 1 ? 'it' : 'them'} an octave ${high ? 'down' : 'up'}, or give the line to another instrument. The highest ${name(lim, flats)} is already a stretch.`,
        trackIds: [t.id],
        notes: group.map((n) => ({ regionId: n.regionId, noteId: n.noteId })),
      });
      group = [];
    };
    for (const n of out) {
      const last = group[group.length - 1];
      if (last && n.s - last.e > 2) flush();
      group.push(n);
    }
    flush();
  }

  // ---- half-step rubs between parts (held at least a beat, starting on a beat)
  const seen = new Set<string>();
  for (let i = 0; i < tracks.length; i++)
    for (let j = i + 1; j < tracks.length; j++) {
      const A = notesOf.get(tracks[i].id)!;
      const B = notesOf.get(tracks[j].id)!;
      for (const a of A)
        for (const b of B) {
          if (b.s >= a.e) break;
          const lo = Math.max(a.s, b.s);
          const hi = Math.min(a.e, b.e);
          if (hi - lo < 1 - 1e-6 || !strong(lo)) continue;
          const iv = Math.abs(a.pitch - b.pitch) % 12;
          if (iv !== 1 && iv !== 11) continue;
          const key = `${barOf(lo)}:${tracks[i].id}:${tracks[j].id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          issues.push({
            id: `clash:${a.noteId}:${b.noteId}`,
            kind: 'clash',
            beat: lo,
            bar: barOf(lo),
            title: `${name(a.pitch, flats)} in ${tracks[i].name} rubs against ${name(b.pitch, flats)} in ${tracks[j].name}`,
            hint: 'They’re a half step apart and held together, which sounds harsh unless you want tension. Listen to it: if it isn’t on purpose, move one of them to a note of the chord.',
            trackIds: [tracks[i].id, tracks[j].id],
            notes: [
              { regionId: a.regionId, noteId: a.noteId },
              { regionId: b.regionId, noteId: b.noteId },
            ],
          });
        }
    }

  // ---- notes rubbing against the chord track
  const chords = p.chords ?? [];
  if (chords.length) {
    const tones = (c: (typeof chords)[number]) => {
      const q: Record<string, number[]> = {
        '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 2, 4, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], m9: [0, 2, 3, 7, 10], '9': [0, 2, 4, 7, 10],
      };
      return (q[c.quality] ?? [0, 4, 7]).map((x) => (c.root + x) % 12);
    };
    for (const t of tracks) {
      let last = -10;
      for (const n of notesOf.get(t.id)!) {
        if (n.e - n.s < 1 - 1e-6 || !strong(n.s)) continue;
        const c = chords.find((x) => n.s >= x.beat - 1e-6 && n.s < x.beat + x.length - 1e-6);
        if (!c) continue;
        const ct = tones(c);
        const pc = ((n.pitch % 12) + 12) % 12;
        if (ct.includes(pc)) continue;
        // A half step above a chord tone (e.g. F over C major's E) is the classic "avoid note".
        if (!ct.some((x) => (pc - x + 12) % 12 === 1)) continue;
        if (n.s - last < 4) continue; // one per bar or so
        last = n.s;
        issues.push({
          id: `chord:${n.noteId}`,
          kind: 'chord',
          beat: n.s,
          bar: barOf(n.s),
          title: `${t.name}: held ${name(n.pitch, flats)} clashes with the ${pitchClassName(c.root, flats)}${c.quality} chord`,
          hint: `It sits a half step above a note of the chord. If it’s a passing note, keep it short or move it off the beat; if it lands, resolve it down a step.`,
          trackIds: [t.id],
          notes: [{ regionId: n.regionId, noteId: n.noteId }],
        });
      }
    }
  }

  // ---- parallel fifths and octaves between two parts moving together
  const topLine = (list: Sounding[]) => {
    const m = new Map<number, Sounding>();
    for (const n of list) {
      const k = Math.round(n.s * 48);
      const cur = m.get(k);
      if (!cur || n.pitch > cur.pitch) m.set(k, n);
    }
    return m;
  };
  // Voice-leading rules are about melodic lines: parts that mostly play chords (pads, comping
  // keys) are left out, so a pop song's block chords over a bass don't light up.
  const melodic = tracks.filter((t) => {
    const groups = new Map<number, number>();
    for (const n of notesOf.get(t.id)!) groups.set(Math.round(n.s * 48), (groups.get(Math.round(n.s * 48)) ?? 0) + 1);
    const chordy = [...groups.values()].filter((c) => c > 1).length;
    return groups.size >= 2 && chordy / groups.size <= 0.3;
  });
  const lines = new Map(melodic.map((t) => [t.id, topLine(notesOf.get(t.id)!)]));
  const pseen = new Set<string>();
  for (let i = 0; i < melodic.length; i++)
    for (let j = i + 1; j < melodic.length; j++) {
      const la = lines.get(melodic[i].id)!;
      const lb = lines.get(melodic[j].id)!;
      const common = [...la.keys()].filter((k) => lb.has(k)).sort((a, b) => a - b);
      // Long runs of octaves are a part doubled on purpose, not a voice-leading slip.
      const octaveAt = (k: number) => Math.abs(la.get(common[k])!.pitch - lb.get(common[k])!.pitch) % 12 === 0;
      for (let k = 1; k < common.length; k++) {
        const a0 = la.get(common[k - 1])!;
        const b0 = lb.get(common[k - 1])!;
        const a1 = la.get(common[k])!;
        const b1 = lb.get(common[k])!;
        if (a0.pitch === a1.pitch || b0.pitch === b1.pitch) continue; // a voice that holds still isn't parallel
        if (Math.sign(a1.pitch - a0.pitch) !== Math.sign(b1.pitch - b0.pitch)) continue;
        const i0 = Math.abs(a0.pitch - b0.pitch);
        const i1 = Math.abs(a1.pitch - b1.pitch);
        if (i0 === 0 || i1 === 0) continue; // unisons are doubling, not voice leading
        const fifth = i0 % 12 === 7 && i1 % 12 === 7;
        const octave = i0 % 12 === 0 && i1 % 12 === 0;
        if (!fifth && !octave) continue;
        if (octave) {
          let run = 1;
          for (let x = k - 1; x >= 0 && octaveAt(x); x--) run++;
          for (let x = k + 1; x < common.length && octaveAt(x); x++) run++;
          if (run >= 4) continue;
        }
        // At most one per pair of parts every 8 bars.
        const key = `${Math.floor((barOf(a1.s) - 1) / 8)}:${melodic[i].id}:${melodic[j].id}`;
        if (pseen.has(key)) continue;
        pseen.add(key);
        issues.push({
          id: `par:${a1.noteId}:${b1.noteId}`,
          kind: 'parallel',
          beat: a1.s,
          bar: barOf(a1.s),
          title: `Parallel ${fifth ? 'fifths' : 'octaves'}: ${melodic[i].name} and ${melodic[j].name}`,
          hint: fifth
            ? 'Two parts move the same way a fifth apart, so they blend into one hollow sound. In classical writing, move one part the other way (contrary motion) or to a third or sixth. In rock and pop "power chords" this is normal.'
            : 'Two parts move together an octave apart, so you hear one line instead of two. Fine for doubling a melody on purpose; otherwise let one part move differently.',
          trackIds: [melodic[i].id, melodic[j].id],
          notes: [
            { regionId: a0.regionId, noteId: a0.noteId },
            { regionId: b0.regionId, noteId: b0.noteId },
            { regionId: a1.regionId, noteId: a1.noteId },
            { regionId: b1.regionId, noteId: b1.noteId },
          ],
        });
      }
    }

  return issues.sort((a, b) => a.beat - b.beat || a.kind.localeCompare(b.kind));
}

/** Note ids flagged for drawing in the editors (out of range = 'range', anything else = 'warn'). */
export function flaggedNotes(issues: Issue[]): Map<string, 'range' | 'warn'> {
  const m = new Map<string, 'range' | 'warn'>();
  for (const i of issues) for (const n of i.notes) if (m.get(n.noteId) !== 'range') m.set(n.noteId, i.kind === 'range' ? 'range' : 'warn');
  return m;
}
