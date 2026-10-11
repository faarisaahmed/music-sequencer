// Editing actions for the chord track.
import { meterOf } from '../../model/timeline';
import { create } from 'zustand';
import type { ChordQuality, ChordSymbol, Project } from '../../model/types';
import { contentEndBeat, uid } from '../../model/defaults';
import { chordPcs, layChords, parseProgression } from '../../model/accompaniment';
import { getEngine } from '../../audio/engine';
import { commit, useStore } from '../../state/store';
import { growSong } from '../../state/actions';

export const useAssistantUi = create<{ showChords: boolean | null }>(() => ({
  showChords: null, // null = automatic (shown when the song has chords)
}));

export function chordsVisible(p: Project, show: boolean | null): boolean {
  return show ?? (p.chords?.length ?? 0) > 0;
}

// ------------------------------------------------------------------ chord track

export function addChord(beat: number, root: number, quality: ChordQuality, length?: number): string {
  const p = useStore.getState().project!;
  const bpb = meterOf(p).lenAt(beat);
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
  const meter = meterOf(p);
  const laid = layChords(chords, start, length, (b) => meter.addBars(b, barsPerChord));
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

export interface ChordRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

/** Ranges a progression can fill: whole song, cycle area and each section. */
export function rangesFor(p: Project): ChordRange[] {
  const meter = meterOf(p);
  const firstBar = (b: number) => Math.floor(meter.barPos(b) + 1e-6) + 1;
  const lastBar = (b: number) => Math.ceil(meter.barPos(b) - 1e-6);
  const chordEnd = Math.max(0, ...(p.chords ?? []).map((c) => c.beat + c.length));
  const songEnd = Math.max(chordEnd, contentEndBeat(p), meter.barStart(8));
  const out: ChordRange[] = [{ id: 'song', label: `Whole song (bars 1–${lastBar(songEnd)})`, start: 0, end: songEnd }];
  if (p.loop.end > p.loop.start) out.push({ id: 'cycle', label: `Cycle area (bars ${firstBar(p.loop.start)}–${lastBar(p.loop.end)})`, start: p.loop.start, end: p.loop.end });
  for (const s of p.sections ?? []) out.push({ id: 's:' + s.id, label: `${s.name} (bar ${firstBar(s.start)})`, start: s.start, end: s.start + s.length });
  return out;
}
