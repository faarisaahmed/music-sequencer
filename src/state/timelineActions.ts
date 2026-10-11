// Editing the song's tempo and time-signature changes.
import type { Draft } from 'immer';
import type { MeterChange, Project, TempoChange } from '../model/types';
import { uid } from '../model/defaults';
import { Meter, meterOf } from '../model/timeline';
import { beginGesture, commit, endGesture, live, useStore } from './store';

export const MIN_BPM = 20;
export const MAX_BPM = 400;
const clampBpm = (v: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v * 10) / 10));

/** The tempo change in effect at `beat` (undefined = the song's opening tempo). */
export function tempoChangeAt(p: Project, beat: number): TempoChange | undefined {
  let found: TempoChange | undefined;
  for (const c of p.tempoChanges ?? []) if (c.beat <= beat + 1e-9 && (!found || c.beat > found.beat)) found = c;
  return found;
}

/** Change whichever tempo is in effect at `beat` (the opening tempo or a later change). */
function writeTempoAt(d: Draft<Project>, beat: number, bpm: number) {
  const c = tempoChangeAt(d as Project, beat);
  if (!c) d.bpm = clampBpm(bpm);
  else {
    const dc = d.tempoChanges!.find((x) => x.id === c.id)!;
    dc.bpm = clampBpm(bpm);
  }
}

export function setTempoAt(beat: number, bpm: number): void {
  commit((d) => writeTempoAt(d, beat, bpm));
}

/** Drag-adjust the tempo at `beat` (call begin/end around it). */
export const tempoGesture = {
  begin: beginGesture,
  move: (beat: number, bpm: number) => live((d) => writeTempoAt(d, beat, bpm)),
  end: endGesture,
};

export function addTempoChange(beat: number, bpm: number, ramp = false): string {
  const id = uid('tc');
  commit((d) => {
    d.tempoChanges = (d.tempoChanges ?? []).filter((c) => Math.abs(c.beat - beat) > 1e-6);
    d.tempoChanges.push({ id, beat: Math.max(1 / 64, beat), bpm: clampBpm(bpm), ramp: ramp || undefined });
  });
  return id;
}

export function updateTempoChange(id: string, patch: Partial<Omit<TempoChange, 'id'>>, gesture = false): void {
  const apply = (d: Draft<Project>) => {
    const c = d.tempoChanges?.find((x) => x.id === id);
    if (!c) return;
    if (patch.beat !== undefined) c.beat = Math.max(1 / 64, patch.beat);
    if (patch.bpm !== undefined) c.bpm = clampBpm(patch.bpm);
    if (patch.ramp !== undefined) c.ramp = patch.ramp || undefined;
  };
  if (gesture) live(apply);
  else commit(apply);
}

export function deleteTempoChange(id: string): void {
  commit((d) => {
    d.tempoChanges = (d.tempoChanges ?? []).filter((c) => c.id !== id);
  });
}

/** The meter change starting at `bar`, if any. */
export function meterChangeAt(p: Project, bar: number): MeterChange | undefined {
  return (p.meterChanges ?? []).find((c) => c.bar === bar);
}

/**
 * Change the time signature from the bar containing `beat` onwards (until the next change).
 * Notes stay where they are in time; the bar lines move around them.
 */
export function setMeterFrom(beat: number, timeSig: [number, number]): void {
  const p = useStore.getState().project;
  if (!p) return;
  const bar = meterOf(p).barAt(beat).bar;
  commit((d) => {
    if (bar <= 0) {
      d.timeSig = timeSig;
      return;
    }
    const list = (d.meterChanges ??= []);
    const c = list.find((x) => x.bar === bar);
    if (c) c.timeSig = timeSig;
    else list.push({ id: uid('mc'), bar, timeSig });
    // A change that matches the meter before it isn't a change.
    const earlier = list.filter((x) => x.bar < bar).map((x) => ({ ...x, timeSig: [x.timeSig[0], x.timeSig[1]] as [number, number] }));
    const before = new Meter([d.timeSig[0], d.timeSig[1]], earlier).sigAt(Number.MAX_SAFE_INTEGER);
    if (before[0] === timeSig[0] && before[1] === timeSig[1]) d.meterChanges = list.filter((x) => x.bar !== bar);
  });
}

export function moveMeterChange(id: string, bar: number): void {
  commit((d) => {
    const list = d.meterChanges ?? [];
    const c = list.find((x) => x.id === id);
    if (!c || bar < 1) return;
    d.meterChanges = list.filter((x) => x.id === id || x.bar !== bar);
    c.bar = bar;
  });
}

export function deleteMeterChange(id: string): void {
  commit((d) => {
    d.meterChanges = (d.meterChanges ?? []).filter((c) => c.id !== id);
  });
}
