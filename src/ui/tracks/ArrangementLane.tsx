// Arrangement track: song sections (Intro, Verse, Chorus…) that move, copy and delete whole song parts.
import { meterOf } from '../../model/timeline';
import { useRef, useState } from 'react';
import { Plus, LayoutList } from 'lucide-react';
import type { Section } from '../../model/types';
import { useStore } from '../../state/store';
import { SECTION_COLORS } from '../../model/sections';
import { addSection, cycleToSection, deleteSection, duplicateSection, moveSection, regionsInSection, resizeSection, updateSection } from '../../state/sectionActions';
import { startDrag } from '../common/drag';
import { showContextMenu, type MenuItem } from '../common/menus';
import { getEngine } from '../../audio/engine';

const PRESET_NAMES = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Breakdown', 'Solo', 'Outro'];

export default function ArrangementLane({ width, ppb }: { width: number; ppb: number }) {
  const project = useStore((s) => s.project)!;
  const sections = project.sections ?? [];
  const meter = meterOf(project);
  const barsIn = (start: number, len: number) => Math.round(meter.barPos(start + len) - meter.barPos(start));
  const laneRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; target: number | null } | null>(null);
  const [resize, setResize] = useState<{ id: string; len: number } | null>(null);
  const dragRef = useRef<{ id: string; dx: number; target: number | null } | null>(null);
  const resizeRef = useRef<{ id: string; len: number } | null>(null);

  const beatAt = (clientX: number) => {
    const r = laneRef.current!.getBoundingClientRect();
    return Math.max(0, (clientX - r.left) / ppb);
  };

  /** Where a dragged section would land: snapped to section boundaries or bars. */
  const dropTarget = (sec: Section, beat: number): number => {
    const bounds = new Set<number>([0]);
    for (const s of sections) {
      bounds.add(s.start);
      bounds.add(s.start + s.length);
    }
    let best = meter.snapToBar(beat);
    let bestD = Infinity;
    for (const b of bounds) {
      const d = Math.abs(b - beat);
      if (d < bestD && d < meter.lenAt(beat) * 2) {
        bestD = d;
        best = b;
      }
    }
    if (best >= sec.start && best <= sec.start + sec.length) return sec.start;
    return best;
  };

  const menu = (s: Section): MenuItem[] => [
    { label: 'Rename', onClick: () => setRenaming(s.id) },
    {
      label: 'Name',
      submenu: PRESET_NAMES.map((n) => ({ label: n, onClick: () => updateSection(s.id, { name: n }) })),
    },
    {
      label: 'Color',
      submenu: SECTION_COLORS.map((c) => ({
        label: ' ',
        icon: <span style={{ width: 14, height: 14, borderRadius: 4, background: c, display: 'inline-block' }} />,
        onClick: () => updateSection(s.id, { color: c }),
      })),
    },
    { separator: true },
    { label: 'Select Regions in Section', onClick: () => useStore.setState({ selectedRegionIds: regionsInSection(useStore.getState().project!, s.id) }) },
    { label: 'Cycle This Section', onClick: () => cycleToSection(s.id) },
    { label: 'Move Playhead Here', onClick: () => getEngine().seek(s.start) },
    { separator: true },
    { label: 'Duplicate Section', onClick: () => duplicateSection(s.id) },
    { label: 'Add 4 Bars', onClick: () => resizeSection(s.id, meter.addBars(s.start + s.length, 4) - s.start, true) },
    { label: 'Remove 4 Bars', disabled: barsIn(s.start, s.length) <= 4, onClick: () => resizeSection(s.id, meter.addBars(s.start + s.length, -4) - s.start, true) },
    { separator: true },
    { label: 'Delete Section & Content', onClick: () => deleteSection(s.id) },
    { label: 'Delete Marker Only', onClick: () => deleteSection(s.id, true) },
  ];

  const onSectionDown = (e: React.PointerEvent, s: Section) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startBeat = beatAt(e.clientX);
    startDrag(
      e,
      ({ x }) => {
        const b = beatAt(x);
        const dx = (b - startBeat) * ppb;
        dragRef.current = { id: s.id, dx, target: dropTarget(s, s.start + (b - startBeat)) };
        setDrag(dragRef.current);
      },
      ({ moved }) => {
        const d = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (moved && d && d.target !== null && d.target !== s.start) moveSection(s.id, d.target);
        if (!moved) {
          useStore.setState({ selectedRegionIds: regionsInSection(useStore.getState().project!, s.id), focusArea: 'tracks' });
          getEngine().seek(s.start);
        }
      },
      { threshold: 4 },
    );
  };

  const onResizeDown = (e: React.PointerEvent, s: Section) => {
    e.stopPropagation();
    e.preventDefault();
    startDrag(
      e,
      ({ x }) => {
        const end = Math.max(s.start + meter.lenAt(s.start), meter.snapToBar(beatAt(x)));
        resizeRef.current = { id: s.id, len: end - s.start };
        setResize(resizeRef.current);
      },
      ({ event }) => {
        const r = resizeRef.current;
        resizeRef.current = null;
        setResize(null);
        if (r) resizeSection(s.id, r.len, !event.altKey);
      },
    );
  };

  return (
    <div className="arr-row">
      <div className="arr-corner">
        <LayoutList size={14} className="dim" />
        <span>Arrangement</span>
        <button className="btn ghost icon sm" title="Add a section" onClick={() => addSection()}>
          <Plus size={14} />
        </button>
      </div>
      <div
        ref={laneRef}
        className="arr-lane"
        style={{ width }}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const bar = meter.floorBar(beatAt(e.clientX));
          addSection(undefined, sections.some((s) => bar >= s.start && bar < s.start + s.length) ? undefined : bar);
        }}
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) return;
          const bar = meter.floorBar(beatAt(e.clientX));
          showContextMenu(e, [
            { title: 'Add Section' },
            ...PRESET_NAMES.map((n) => ({ label: n, onClick: () => addSection(n, sections.some((s) => bar >= s.start && bar < s.start + s.length) ? undefined : bar) })),
          ]);
        }}
      >
        {sections.length === 0 && (
          <div className="arr-empty faint" onClick={() => addSection()}>
            + Add sections (Intro, Verse, Chorus…) to rearrange your song — drag them to move, right-click to duplicate
          </div>
        )}
        {sections.map((s) => {
          const len = resize?.id === s.id ? resize.len : s.length;
          const dragging = drag?.id === s.id;
          return (
            <div
              key={s.id}
              className={'arr-sec' + (dragging ? ' dragging' : '')}
              style={{ left: s.start * ppb, width: Math.max(8, len * ppb - 2), ['--c' as string]: s.color, transform: dragging ? `translateX(${drag!.dx}px)` : undefined }}
              onPointerDown={(e) => onSectionDown(e, s)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                cycleToSection(s.id);
              }}
              onContextMenu={(e) => showContextMenu(e, menu(s))}
              title={`${s.name} — ${barsIn(s.start, s.length)} bars · drag to move · double-click to cycle · right-click for options`}
            >
              {renaming === s.id ? (
                <input
                  autoFocus
                  className="arr-rename"
                  defaultValue={s.name}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.name) updateSection(s.id, { name: v });
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="arr-name" onDoubleClick={(e) => (e.stopPropagation(), setRenaming(s.id))}>
                  {s.name}
                </span>
              )}
              <span className="arr-bars">{barsIn(s.start, len)}</span>
              <div className="arr-resize" onPointerDown={(e) => onResizeDown(e, s)} title="Drag to lengthen/shorten (moves later sections; hold ⌥ to resize the marker only)" />
            </div>
          );
        })}
        {drag && drag.target !== null && <div className="arr-drop" style={{ left: drag.target * ppb - 1 }} />}
      </div>
    </div>
  );
}
