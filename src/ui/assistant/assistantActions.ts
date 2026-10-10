// Editing actions for the chord track and generated parts.
import { create } from 'zustand';
import type { ChordQuality, ChordSymbol, Project, Track } from '../../model/types';
import { createMidiRegion, contentEndBeat, uid } from '../../model/defaults';
import { beatsPerBar } from '../../model/music';
import {
  chordPcs,
  defaultStyleFor,
  familyOf,
  generateDrums,
  generateMelody,
  generatePart,
  layChords,
  parseProgression,
  STYLES,
  type DrumStyle,
  type StyleId,
} from '../../model/accompaniment';
import { getPreset } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import { commit, toast, useStore } from '../../state/store';
import { growSong } from '../../state/actions';

export const useAssistantUi = create<{ showChords: boolean | null; style: Record<string, StyleId>; seed: number }>(() => ({
  showChords: null, // null = automatic (shown when the song has chords)
  style: {},
  seed: 1,
}));

export function chordsVisible(p: Project, show: boolean | null): boolean {
  return show ?? (p.chords?.length ?? 0) > 0;
}

// ------------------------------------------------------------------ chord track

export function addChord(beat: number, root: number, quality: ChordQuality, length?: number): string {
  const p = useStore.getState().project!;
  const bpb = beatsPerBar(p.timeSig);
  const id = uid('c');
  commit((d) => {
    d.chords ??= [];
    const next = d.chords.filter((c) => c.beat > beat + 1e-6).sort((a, b) => a.beat - b.beat)[0];
    const len = length ?? Math.min(bpb, next ? next.beat - beat : bpb);
    // Remove any chord starting at the same spot.
    d.chords = d.chords.filter((c) => Math.abs(c.beat - beat) > 1e-6);
    d.chords.push({ id, beat, length: Math.max(0.25, len), root, quality });
    d.chords.sort((a, b) => a.beat - b.beat);
  });
  return id;
}

export function updateChord(id: string, patch: Partial<ChordSymbol>): void {
  commit((d) => {
    const c = d.chords?.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    d.chords?.sort((a, b) => a.beat - b.beat);
  });
}

export function deleteChord(id: string): void {
  commit((d) => {
    d.chords = (d.chords ?? []).filter((c) => c.id !== id);
  });
}

export function clearChords(from = -Infinity, to = Infinity): void {
  commit((d) => {
    d.chords = (d.chords ?? []).filter((c) => c.beat + c.length <= from + 1e-6 || c.beat >= to - 1e-6);
  });
}

/** Write a roman-numeral progression over [start, start+length), replacing chords there. */
export function fillProgression(roman: string, start: number, length: number, barsPerChord = 1): number {
  const p = useStore.getState().project!;
  const chords = parseProgression(roman, p.key);
  if (!chords.length) return 0;
  const laid = layChords(chords, start, length, barsPerChord * beatsPerBar(p.timeSig));
  commit((d) => {
    d.chords = (d.chords ?? []).filter((c) => c.beat + c.length <= start + 1e-6 || c.beat >= start + length - 1e-6);
    d.chords.push(...laid);
    d.chords.sort((a, b) => a.beat - b.beat);
    growSong(d, start + length);
  });
  useAssistantUi.setState({ showChords: true });
  return laid.length;
}

/** Play a chord on the selected track (or a piano-ish fallback) so people can hear it. */
export function auditionChord(c: { root: number; quality: ChordQuality }): void {
  const s = useStore.getState();
  const t = s.project?.tracks.find((x) => x.id === s.selectedTrackId && x.type === 'instrument') ?? s.project?.tracks.find((x) => x.type === 'instrument');
  if (!t) return;
  const pcs = chordPcs(c);
  const base = 48 + c.root;
  const engine = getEngine();
  engine.preview(t.id, base - 12, 0.6, 1.5);
  let last = base - 1;
  for (const pc of pcs) {
    let p = 48 + pc;
    while (p <= last) p += 12;
    last = p;
    engine.preview(t.id, p, 0.62, 1.5);
  }
}

// ------------------------------------------------------------------ ranges

export interface GenRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

/** Ranges the user can generate into: whole song, cycle area and each section. */
export function rangesFor(p: Project): GenRange[] {
  const bpb = beatsPerBar(p.timeSig);
  const chordEnd = Math.max(0, ...(p.chords ?? []).map((c) => c.beat + c.length));
  const songEnd = Math.max(chordEnd, contentEndBeat(p), bpb * 8);
  const out: GenRange[] = [{ id: 'song', label: `Whole song (bars 1–${Math.ceil(songEnd / bpb)})`, start: 0, end: songEnd }];
  if (p.loop.end > p.loop.start) out.push({ id: 'cycle', label: `Cycle area (bars ${Math.floor(p.loop.start / bpb) + 1}–${Math.ceil(p.loop.end / bpb)})`, start: p.loop.start, end: p.loop.end });
  for (const s of p.sections ?? []) out.push({ id: 's:' + s.id, label: `${s.name} (bar ${Math.floor(s.start / bpb) + 1})`, start: s.start, end: s.start + s.length });
  return out;
}

// ------------------------------------------------------------------ generation

export function familyOfTrack(t: Track) {
  const pr = getPreset(t.instrument);
  return familyOf(t.instrument, pr.category, t.type);
}

export function styleForTrack(t: Track): StyleId {
  return useAssistantUi.getState().style[t.id] ?? defaultStyleFor(familyOfTrack(t));
}

const DRUM_STYLE_BY_KIT: Record<string, DrumStyle> = {
  'kit-808': 'hiphop',
  'kit-909': 'house',
  'kit-techno': 'house',
  'kit-lofi': 'lofi',
  'kit-linn': 'synthwave',
  'kit-cr78': 'funk',
};

/**
 * Generate a part for a track over a range, splitting into one region per section
 * when the song has sections. Replaces regions that lie entirely inside the range.
 */
export function generateForTrack(trackId: string, style: StyleId | DrumStyle, start: number, end: number, opts: { energy?: number; seed?: number; density?: number } = {}): number {
  const p = useStore.getState().project!;
  const t = p.tracks.find((x) => x.id === trackId);
  if (!t || t.type === 'audio') return 0;
  const chords = p.chords ?? [];
  if (t.type !== 'drums' && !chords.some((c) => c.beat < end && c.beat + c.length > start)) {
    toast('Add chords to the chord track first (or use “Fill with progression”)', 'error');
    return 0;
  }
  const bpb = beatsPerBar(p.timeSig);
  const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
  const preset = getPreset(t.instrument);
  const range = preset.range ?? [36, 96];
  // Split the range at section boundaries.
  const cuts = new Set<number>([start, end]);
  for (const s of p.sections ?? []) {
    if (s.start > start && s.start < end) cuts.add(s.start);
  }
  const bounds = [...cuts].sort((a, b) => a - b);
  const regions: ReturnType<typeof createMidiRegion>[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = bounds[i];
    const e = bounds[i + 1];
    if (e - s < 0.25) continue;
    const sec = (p.sections ?? []).find((x) => x.start <= s + 1e-6 && x.start + x.length > s + 1e-6);
    let notes;
    if (t.type === 'drums') {
      notes = generateDrums(style as DrumStyle, 0, Math.max(1, Math.round((e - s) / bpb)), p.timeSig, opts.energy ?? 0.6, seed + i, { fillAtEnd: i < bounds.length - 2 || bounds.length === 2, crashAtStart: !!sec && /chorus|drop/i.test(sec.name) });
      notes = notes.filter((n) => n.start < e - s);
    } else {
      const base = { chords, start: s, end: e, timeSig: p.timeSig, key: p.key, range, energy: opts.energy ?? 0.6, seed: seed + (sec ? hash(sec.name) : i) };
      notes = style === 'melody' ? generateMelody({ ...base, density: opts.density }) : generatePart(style as StyleId, base);
      notes = notes.map((n) => ({ ...n, start: n.start - s }));
    }
    if (!notes.length) continue;
    const r = createMidiRegion(s, e - s, notes, sec?.name ?? styleLabel(style));
    regions.push(r);
  }
  if (!regions.length) return 0;
  commit((d) => {
    const dt = d.tracks.find((x) => x.id === trackId);
    if (!dt) return;
    dt.regions = dt.regions.filter((r) => !(r.start >= start - 1e-6 && r.start + r.length <= end + 1e-6));
    dt.regions.push(...regions);
    growSong(d, end);
  });
  useStore.setState({ selectedTrackId: trackId, selectedRegionIds: regions.map((r) => r.id), editingRegionId: regions[0].id });
  return regions.reduce((a, r) => a + r.notes.length, 0);
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 100000;
}

function styleLabel(s: string): string {
  if (s === 'melody') return 'Melody';
  return STYLES.find((x) => x.id === s)?.name ?? s.replace(/^[a-z]+-/, '').replace(/^\w/, (c) => c.toUpperCase());
}

export function drumStyleForKit(kit: string): DrumStyle {
  return DRUM_STYLE_BY_KIT[kit] ?? 'pop';
}

/** Replace the notes of an existing MIDI region with a fresh melody over its chords. */
export function regenerateMelodyInRegion(regionId: string, density = 0.55, seed = Math.floor(Math.random() * 1e6)): boolean {
  const p = useStore.getState().project!;
  for (const t of p.tracks) {
    const r = t.regions.find((x) => x.id === regionId);
    if (!r || r.kind !== 'midi') continue;
    if (!(p.chords ?? []).some((c) => c.beat < r.start + r.length && c.beat + c.length > r.start)) {
      toast('Add chords under this region first', 'error');
      return false;
    }
    const notes = generateMelody({ chords: p.chords, start: r.start, end: r.start + r.length, timeSig: p.timeSig, key: p.key, range: getPreset(t.instrument).range ?? [55, 84], density, seed });
    commit((d) => {
      const dt = d.tracks.find((x) => x.id === t.id);
      const dr = dt?.regions.find((x) => x.id === regionId);
      if (dr && dr.kind === 'midi') {
        dr.notes = notes.map((n) => ({ ...n, start: n.start - r.start + r.offset }));
        dr.loop = false;
      }
    });
    return true;
  }
  return false;
}
