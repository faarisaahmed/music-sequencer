// Chord track lane shown under the ruler in the Tracks view.
import { meterOf } from '../../model/timeline';
import { memo, useState } from 'react';
import { Music4, Wand2, EyeOff } from 'lucide-react';
import type { ChordSymbol } from '../../model/types';
import { snap } from '../../model/music';
import { PROGRESSIONS, chordName } from '../../model/accompaniment';
import { beginGesture, endGesture, live, useStore } from '../../state/store';
import { startDrag } from '../common/drag';
import { showContextMenu } from '../common/menus';
import ChordPicker, { type PickedChord } from './ChordPicker';
import { addChord, auditionChord, chordsVisible, clearChords, deleteChord, fillProgression, rangesFor, updateChord, useAssistantUi } from './assistantActions';
import './assistant.css';

const LANE_H = 34;

export function ChordToggleButton() {
  const project = useStore((s) => s.project)!;
  const show = useAssistantUi((s) => s.showChords);
  const on = chordsVisible(project, show);
  return (
    <button className={'btn sm' + (on ? ' active' : '')} onClick={() => useAssistantUi.setState({ showChords: !on })} title="Show the chord track">
      <Music4 size={13} /> Chords
    </button>
  );
}

export function fillMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }) {
  const p = useStore.getState().project!;
  const ranges = rangesFor(p);
  const list = PROGRESSIONS.filter((x) => x.mode === p.key.mode);
  showContextMenu(
    e,
    ranges.map((rg) => ({
      label: rg.label,
      submenu: [
        ...list.map((pr) => ({
          label: `${pr.name} — ${pr.roman}`,
          onClick: () => fillProgression(pr.roman, rg.start, rg.end - rg.start, 1),
        })),
        { separator: true },
        { label: 'Two bars per chord…', submenu: list.map((pr) => ({ label: `${pr.name} — ${pr.roman}`, onClick: () => fillProgression(pr.roman, rg.start, rg.end - rg.start, 2) })) },
        { separator: true },
        { label: 'Clear chords here', onClick: () => clearChords(rg.start, rg.end) },
      ],
    })),
  );
}

function ChordLane({ width, ppb }: { width: number; ppb: number }) {
  const project = useStore((s) => s.project)!;
  const grid = useStore((s) => s.snapGrid);
  const show = useAssistantUi((s) => s.showChords);
  const [picker, setPicker] = useState<null | { x: number; y: number; beat: number; chord?: ChordSymbol }>(null);
  if (!chordsVisible(project, show)) return null;
  const chords = project.chords ?? [];
  const meter = meterOf(project);
  const g = grid || 1;

  const prevOf = (beat: number) => [...chords].filter((c) => c.beat < beat - 1e-6).sort((a, b) => b.beat - a.beat)[0] ?? null;

  const onLaneDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const beat = Math.max(0, meter.floorBar((e.clientX - rect.left) / ppb));
    setPicker({ x: e.clientX, y: e.clientY + 12, beat });
  };

  const onChordDown = (e: React.PointerEvent, c: ChordSymbol, edge: boolean) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const x0 = e.clientX;
    const b0 = c.beat;
    const l0 = c.length;
    let moved = false;
    startDrag(
      e,
      ({ dx }) => {
        if (!moved) {
          moved = true;
          beginGesture();
        }
        const db = dx / ppb;
        live((d) => {
          const dc = d.chords?.find((x) => x.id === c.id);
          if (!dc) return;
          if (edge) dc.length = Math.max(g, snap(l0 + db, g));
          else dc.beat = Math.max(0, snap(b0 + db, g));
        });
      },
      ({ moved: m }) => {
        if (moved) {
          live((d) => d.chords?.sort((a, b) => a.beat - b.beat));
          endGesture();
        }
        if (!m) {
          auditionChord(c);
          setPicker({ x: x0, y: e.clientY + 12, beat: c.beat, chord: c });
        }
      },
      { threshold: 3 },
    );
  };

  const onPick = (pc: PickedChord) => {
    if (!picker) return;
    if (picker.chord) updateChord(picker.chord.id, { root: pc.root, quality: pc.quality, bass: pc.bass });
    else addChord(picker.beat, pc.root, pc.quality);
    setPicker(null);
  };

  return (
    <div className="track-row chord-row" style={{ height: LANE_H }}>
      <div className="auto-header chord-header">
        <div className="row" style={{ gap: 6 }}>
          <Music4 size={14} style={{ color: 'var(--cycle)' }} />
          <span className="th-name">Chords</span>
          <div className="spacer" />
          <button className="btn ghost icon sm" title="Fill with a chord progression" onClick={(e) => fillMenu(e)}>
            <Wand2 size={13} />
          </button>
          <button className="btn ghost icon sm" title="Hide chord track" onClick={() => useAssistantUi.setState({ showChords: false })}>
            <EyeOff size={13} />
          </button>
        </div>
      </div>
      <div
        className="chord-lane"
        style={{ width }}
        onPointerDown={onLaneDown}
        onContextMenu={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const beat = Math.max(0, meter.floorBar((e.clientX - rect.left) / ppb));
          if (e.target !== e.currentTarget) return;
          const at = { clientX: e.clientX, clientY: e.clientY };
          showContextMenu(e, [
            { label: 'Add chord here…', onClick: () => setPicker({ x: at.clientX, y: at.clientY + 12, beat }) },
            { label: 'Fill with a progression…', onClick: () => setTimeout(() => fillMenu(at), 0) },
            { separator: true },
            { label: 'Clear all chords', onClick: () => clearChords() },
          ]);
        }}
      >
        {chords.length === 0 && <div className="chord-empty">Click to add a chord · or use the wand to fill a whole progression</div>}
        {chords.map((c) => (
          <div
            key={c.id}
            className="chord-block"
            style={{ left: c.beat * ppb, width: Math.max(8, c.length * ppb - 2) }}
            onPointerDown={(e) => onChordDown(e, c, false)}
            onContextMenu={(e) =>
              showContextMenu(e, [
                { label: 'Edit…', onClick: () => setPicker({ x: e.clientX, y: e.clientY + 12, beat: c.beat, chord: c }) },
                { label: 'Listen', onClick: () => auditionChord(c) },
                { label: 'Delete', onClick: () => deleteChord(c.id) },
              ])
            }
            title={chordName(c, project.key)}
          >
            <span>{chordName(c, project.key)}</span>
            <div className="chord-edge" onPointerDown={(e) => onChordDown(e, c, true)} />
          </div>
        ))}
      </div>
      {picker && (
        <ChordPicker
          x={picker.x}
          y={picker.y}
          keySig={project.key}
          initial={picker.chord}
          prev={prevOf(picker.beat)}
          onPick={onPick}
          onDelete={
            picker.chord
              ? () => {
                  deleteChord(picker.chord!.id);
                  setPicker(null);
                }
              : undefined
          }
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

export default memo(ChordLane);
