// Mouse-driven region editing: move / copy, trim, loop-extend, fades.
import { tempoOf } from '../../model/timeline';
import type { Draft } from 'immer';
import type { Project, Region } from '../../model/types';
import { snap } from '../../model/music';
import { beginGesture, endGesture, live, useStore } from '../../state/store';
import { cloneRegion, growSong } from '../../state/actions';
import { getBuffer } from '../../audio/audioStore';
import { startDrag } from '../common/drag';
import { useTracksUi } from './tracksUi';

const MIN_LEN = 0.25;

function gridOf(e: { altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }): number {
  // Holding Ctrl disables snapping for fine adjustments.
  return e.ctrlKey ? 0 : useStore.getState().snapGrid;
}

function findIn(p: Project, id: string): { trackIdx: number; region: Region } | null {
  for (let i = 0; i < p.tracks.length; i++) {
    const r = p.tracks[i].regions.find((x) => x.id === id);
    if (r) return { trackIdx: i, region: r };
  }
  return null;
}

/** Track rows currently on screen (for vertical drags). */
function trackRows(): { id: string; top: number; bottom: number }[] {
  return [...document.querySelectorAll<HTMLElement>('[data-track-block]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.trackBlock!, top: r.top, bottom: r.bottom };
  });
}

/** How many beats of the song the whole recording lasts, from where its content starts. */
function audioMaxBeats(r: Region, p: Project): number {
  if (r.kind !== 'audio') return Infinity;
  const buf = getBuffer(r.audioId);
  if (!buf) return Infinity;
  const tm = tempoOf(p);
  const origin = r.start - r.offset;
  return tm.beat(tm.sec(origin) + buf.duration) - origin;
}

/** Drag-move the selected regions (alt = copy). Calls onClick if the pointer didn't move. */
export function dragMove(e: React.PointerEvent, primaryId: string, onClick: (ev: PointerEvent) => void): void {
  const s = useStore.getState();
  const p0 = s.project!;
  const ids = s.selectedRegionIds.includes(primaryId) ? s.selectedRegionIds : [primaryId];
  const primary = findIn(p0, primaryId);
  if (!primary) return;
  const ppb = s.pxPerBeat;
  const rows = trackRows();
  const startRow = rows.findIndex((r) => e.clientY >= r.top && e.clientY < r.bottom);
  const originals = ids.map((id) => findIn(p0, id)).filter(Boolean) as { trackIdx: number; region: Region }[];
  const minStart = Math.min(...originals.map((o) => o.region.start));
  let started = false;
  let copied = false;

  startDrag(
    e,
    ({ dx, y, event }) => {
      if (!started) {
        started = true;
        beginGesture();
      }
      const grid = gridOf(event);
      let newStart = primary.region.start + dx / ppb;
      if (grid) newStart = snap(newStart, grid);
      let delta = newStart - primary.region.start;
      if (minStart + delta < 0) delta = -minStart;
      // Track offset
      let rowIdx = rows.findIndex((r) => y >= r.top && y < r.bottom);
      if (rowIdx < 0) rowIdx = y < (rows[0]?.top ?? 0) ? 0 : rows.length - 1;
      let tDelta = startRow >= 0 ? rowIdx - startRow : 0;
      const tracks = p0.tracks;
      const compatible = originals.every((o) => {
        const t = tracks[o.trackIdx + tDelta];
        return t && (t.type === 'audio') === (o.region.kind === 'audio');
      });
      if (!compatible) tDelta = 0;
      const copy = event.altKey;
      useTracksUi.setState({ snapLine: primary.region.start + delta });
      live((d) => {
        // Remove the moving regions wherever they are now…
        const set = new Set(ids);
        for (const t of d.tracks) t.regions = t.regions.filter((r) => !set.has(r.id));
        // …and also any copies we made earlier in this gesture.
        if (copied) for (const t of d.tracks) t.regions = t.regions.filter((r) => !r.id.startsWith('cp_'));
        for (const o of originals) {
          const target = d.tracks[o.trackIdx + tDelta];
          if (!target) continue;
          target.regions.push({ ...structuredClone(o.region), start: o.region.start + delta } as Draft<Region>);
          if (copy) {
            const c = cloneRegion(o.region);
            c.id = 'cp_' + c.id;
            d.tracks[o.trackIdx].regions.push(c as Draft<Region>);
          }
          growSong(d, o.region.start + delta + o.region.length);
        }
      });
      copied = copy;
    },
    ({ moved, event }) => {
      useTracksUi.setState({ snapLine: null });
      if (!moved) {
        onClick(event);
        return;
      }
      if (copied) {
        // Give the copies real ids.
        live((d) => {
          for (const t of d.tracks) for (const r of t.regions) if (r.id.startsWith('cp_')) r.id = r.id.slice(3);
        });
      }
      endGesture();
      const p = useStore.getState().project!;
      const owner = p.tracks.find((t) => t.regions.some((r) => r.id === primaryId));
      if (owner) useStore.setState({ selectedTrackId: owner.id });
    },
    { threshold: 3 },
  );
}

function editRegion(id: string, fn: (r: Draft<Region>, d: Draft<Project>) => void) {
  live((d) => {
    for (const t of d.tracks) {
      const r = t.regions.find((x) => x.id === id);
      if (r) {
        fn(r, d);
        return;
      }
    }
  });
}

/** Resize from the right edge (trim / extend). */
export function dragResizeRight(e: React.PointerEvent, id: string): void {
  const s = useStore.getState();
  const p0 = s.project!;
  const o = findIn(p0, id)?.region;
  if (!o) return;
  const ppb = s.pxPerBeat;
  beginGesture();
  startDrag(
    e,
    ({ dx, event }) => {
      const grid = gridOf(event);
      let end = o.start + o.length + dx / ppb;
      if (grid) end = snap(end, grid);
      let len = Math.max(MIN_LEN, end - o.start);
      if (!o.loop && o.kind === 'audio') len = Math.min(len, audioMaxBeats(o, p0) - o.offset);
      useTracksUi.setState({ snapLine: o.start + len });
      editRegion(id, (r, d) => {
        r.length = len;
        if (!r.loop && r.kind === 'midi') r.contentLength = Math.max(o.contentLength, r.offset + len);
        growSong(d, r.start + len);
      });
    },
    () => {
      useTracksUi.setState({ snapLine: null });
      endGesture();
    },
  );
}

/** Trim from the left edge (moves start, keeps content anchored in time). */
export function dragResizeLeft(e: React.PointerEvent, id: string): void {
  const s = useStore.getState();
  const p0 = s.project!;
  const o = findIn(p0, id)?.region;
  if (!o) return;
  const ppb = s.pxPerBeat;
  const end = o.start + o.length;
  beginGesture();
  startDrag(
    e,
    ({ dx, event }) => {
      const grid = gridOf(event);
      let start = o.start + dx / ppb;
      if (grid) start = snap(start, grid);
      start = Math.max(0, Math.min(end - MIN_LEN, start));
      let delta = start - o.start;
      if (o.kind === 'audio' && !o.loop && o.offset + delta < 0) delta = -o.offset;
      useTracksUi.setState({ snapLine: o.start + delta });
      editRegion(id, (r) => {
        r.start = o.start + delta;
        r.length = o.length - delta;
        if (r.loop) {
          const cl = r.contentLength;
          r.offset = (((o.offset + delta) % cl) + cl) % cl;
        } else if (r.kind === 'midi' && o.kind === 'midi') {
          const off = o.offset + delta;
          if (off < 0) {
            // Extending to the left: shift content so offset stays at 0.
            const shift = -off;
            r.offset = 0;
            r.contentLength = o.contentLength + shift;
            r.notes = o.notes.map((n) => ({ ...n, start: n.start + shift }));
          } else {
            r.offset = off;
            r.notes = o.notes.map((n) => ({ ...n }));
            r.contentLength = o.contentLength;
          }
        } else {
          r.offset = o.offset + delta;
        }
      });
    },
    () => {
      useTracksUi.setState({ snapLine: null });
      endGesture();
    },
  );
}

/** Drag the loop handle (upper right) — turns looping on and extends with repeats. */
export function dragLoop(e: React.PointerEvent, id: string): void {
  const s = useStore.getState();
  const p0 = s.project!;
  const o = findIn(p0, id)?.region;
  if (!o) return;
  const ppb = s.pxPerBeat;
  beginGesture();
  startDrag(
    e,
    ({ dx, event }) => {
      const grid = gridOf(event);
      let end = o.start + o.length + dx / ppb;
      if (grid) end = snap(end, grid);
      const len = Math.max(MIN_LEN, end - o.start);
      useTracksUi.setState({ snapLine: o.start + len });
      editRegion(id, (r, d) => {
        if (!o.loop) {
          r.loop = true;
          r.contentLength = Math.max(MIN_LEN, o.offset + o.length);
        }
        r.length = len;
        growSong(d, r.start + len);
      });
    },
    () => {
      useTracksUi.setState({ snapLine: null });
      endGesture();
    },
  );
}

/** Drag a fade handle on an audio region. */
export function dragFade(e: React.PointerEvent, id: string, which: 'in' | 'out'): void {
  const s = useStore.getState();
  const o = findIn(s.project!, id)?.region;
  if (!o || o.kind !== 'audio') return;
  const ppb = s.pxPerBeat;
  beginGesture();
  startDrag(
    e,
    ({ dx }) => {
      editRegion(id, (r) => {
        if (r.kind !== 'audio') return;
        if (which === 'in') r.fadeIn = Math.max(0, Math.min(r.length - r.fadeOut, o.fadeIn + dx / ppb));
        else r.fadeOut = Math.max(0, Math.min(r.length - r.fadeIn, o.fadeOut - dx / ppb));
      });
    },
    () => endGesture(),
  );
}
