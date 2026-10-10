// GarageBand-style Live Loops grid: rows = tracks, columns = scenes.
import { memo, useEffect, useMemo, useState } from 'react';
import { Play, Square, Plus, Circle, Pencil, Trash2, Copy, Scissors, ClipboardPaste, Layers, Repeat } from 'lucide-react';
import type { LiveCell, Project, Region, Track } from '../../model/types';
import { beatsPerBar } from '../../model/music';
import { uid } from '../../model/defaults';
import { placedNotes } from '../../model/regions';
import { commit, live, openModal, toast, useStore, useTransport } from '../../state/store';
import { getEngine } from '../../audio/engine';
import { addClip, getPeaks } from '../../audio/audioStore';
import {
  cellAt,
  cellLength,
  deleteCell,
  ensureLiveLoops,
  liveScheduler,
  moveCell,
  recordIntoCell,
  cancelCellRecording,
  regionToCell,
  scenesFromSections,
  setCell,
  stopAllCells,
  stopRow,
  triggerCell,
  triggerScene,
  useLive,
} from '../../audio/liveLoops';
import { LOOPS } from '../library/loops';
import { TrackIcon } from '../common/icons';
import { showContextMenu, type MenuItem } from '../common/menus';
import './liveloops.css';

const QUANT_OPTIONS: { label: string; bars?: number; beats?: number }[] = [
  { label: 'Off', beats: 0 },
  { label: '1/4 note', beats: 1 },
  { label: '1 Bar', bars: 1 },
  { label: '2 Bars', bars: 2 },
  { label: '4 Bars', bars: 4 },
];

let cellClipboard: Region | null = null;

function cellColor(track: Track, region: Region): string {
  if (region.kind === 'audio') return '#3d9bff';
  if (track.type === 'drums') return '#e8b92a';
  return '#3ecf5a';
}

function openCellEditor(track: Track, cell: LiveCell): void {
  useStore.setState({
    selectedTrackId: track.id,
    editingRegionId: cell.region.id,
    selectedRegionIds: [],
    dockTab: 'editor',
    dockMaximized: false,
    editorMode: cell.region.kind === 'audio' ? 'audio' : track.type === 'drums' ? 'steps' : 'pianoroll',
  });
}

function newEmptyCell(p: Project, track: Track, scene: number, bars = track.type === 'drums' ? 1 : 2): void {
  if (track.type === 'audio') {
    toast('Drop an audio file on the cell, or record on the timeline', 'info');
    return;
  }
  const bpb = beatsPerBar(p.timeSig);
  const len = bars * bpb;
  const region: Region = { id: uid('r'), kind: 'midi', name: track.name, start: 0, length: len, offset: 0, loop: false, contentLength: len, notes: [] };
  setCell(track.id, scene, region);
  const cell = cellAt(useStore.getState().project, track.id, scene);
  if (cell) openCellEditor(track, cell);
}

/** Small preview of a cell's notes / waveform. */
const CellPreview = memo(function CellPreview({ region, color }: { region: Region; color: string }) {
  const content = useMemo(() => {
    const L = Math.max(0.25, region.length);
    if (region.kind === 'audio') {
      const peaks = getPeaks(region.audioId, 120);
      if (!peaks) return null;
      const pts: string[] = [];
      for (let i = 0; i < 120; i++) pts.push(`${i},${20 - peaks[i * 2 + 1] * 18} `);
      for (let i = 119; i >= 0; i--) pts.push(`${i},${20 - peaks[i * 2] * 18} `);
      return (
        <svg viewBox="0 0 120 40" preserveAspectRatio="none">
          <polygon points={pts.join('')} fill={color} opacity={0.9} />
        </svg>
      );
    }
    const notes = placedNotes({ ...region, start: 0, muted: false }, 0, L);
    if (!notes.length) return null;
    let lo = 127;
    let hi = 0;
    for (const n of notes) {
      lo = Math.min(lo, n.note.pitch);
      hi = Math.max(hi, n.note.pitch);
    }
    const span = Math.max(6, hi - lo + 1);
    return (
      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
        {notes.slice(0, 400).map((n, i) => (
          <rect
            key={i}
            x={(n.start / L) * 100}
            y={36 - ((n.note.pitch - lo + 0.5) / span) * 32 - 1.5}
            width={Math.max(0.8, (n.duration / L) * 100 - 0.4)}
            height={3}
            rx={0.8}
            fill={color}
          />
        ))}
      </svg>
    );
  }, [region, color]);
  return <div className="ll-preview">{content}</div>;
});

function ProgressRing({ start, length }: { start: number; length: number }) {
  const progress = useTransport((s) => {
    const f = (((s.position - start) % length) + length) % length;
    return Math.round((f / length) * 120) / 120;
  });
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ll-ring" width={34} height={34} viewBox="0 0 34 34">
      <circle cx={17} cy={17} r={r} stroke="rgba(0,0,0,0.35)" strokeWidth={4} fill="none" />
      <circle cx={17} cy={17} r={r} stroke="white" strokeWidth={4} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 17 17)" strokeLinecap="round" />
    </svg>
  );
}

function RecordRing({ start, end }: { start: number; end: number }) {
  const progress = useTransport((s) => Math.max(0, Math.min(1, Math.round(((s.position - start) / (end - start)) * 120) / 120)));
  const counting = useTransport((s) => s.position < start);
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ll-ring" width={34} height={34} viewBox="0 0 34 34">
      <circle cx={17} cy={17} r={r} stroke="rgba(255,59,48,0.3)" strokeWidth={4} fill="none" />
      <circle cx={17} cy={17} r={r} stroke="#ff3b30" strokeWidth={4} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 17 17)" />
      {counting && <circle cx={17} cy={17} r={5} fill="#ff3b30" className="ll-blink" />}
    </svg>
  );
}

interface CellProps {
  track: Track;
  scene: number;
  cell: LiveCell | undefined;
}

const Cell = memo(function Cell({ track, scene, cell }: CellProps) {
  const playing = useLive((s) => (cell && s.playing[track.id]?.cellId === cell.id ? s.playing[track.id] : null));
  const queuedStart = useLive((s) => !!cell && s.queued[track.id]?.cellId === cell.id);
  const queuedStop = useLive((s) => !!cell && s.queued[track.id]?.cellId === null && s.playing[track.id]?.cellId === cell.id);
  const selected = useLive((s) => s.selected?.trackId === track.id && s.selected.scene === scene);
  const rec = useLive((s) => (s.recording && s.recording.trackId === track.id && s.recording.scene === scene ? s.recording : null));
  const [dragOver, setDragOver] = useState(false);

  const color = cell ? cellColor(track, cell.region) : '';
  const select = () => {
    useLive.setState({ selected: { trackId: track.id, scene } });
    useStore.setState({ selectedTrackId: track.id });
  };

  const menu = (e: React.MouseEvent) => {
    select();
    const p = useStore.getState().project!;
    const bpb = beatsPerBar(p.timeSig);
    const fromTracks: MenuItem[] = track.regions.slice(0, 20).map((r) => ({
      label: `${r.name} (bar ${Math.floor(r.start / bpb) + 1})`,
      onClick: () => {
        setCell(track.id, scene, regionToCell(r, bpb));
        toast(`Copied “${r.name}” into the cell`, 'success');
      },
    }));
    const recItems: MenuItem[] = [1, 2, 4, 8].map((b) => ({ label: `${b} bar${b > 1 ? 's' : ''}`, onClick: () => void recordIntoCell(track.id, scene, b) }));
    const items: MenuItem[] = cell
      ? [
          { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openCellEditor(track, cell) },
          { label: 'Rename', onClick: () => renameCell(cell) },
          { separator: true },
          { label: 'Copy', icon: <Copy size={14} />, onClick: () => (cellClipboard = structuredClone(cell.region)) },
          {
            label: 'Cut',
            icon: <Scissors size={14} />,
            onClick: () => {
              cellClipboard = structuredClone(cell.region);
              deleteCell(cell.id);
            },
          },
          { label: 'Duplicate to Next Scene', icon: <Layers size={14} />, onClick: () => moveCell(cell.id, track.id, scene + 1, true) },
          { separator: true },
          {
            label: 'Loop Length',
            icon: <Repeat size={14} />,
            submenu: [1, 2, 4, 8].map((b) => ({ label: `${b} bar${b > 1 ? 's' : ''}`, onClick: () => setCellLength(cell, b * bpb) })),
          },
          ...(track.type !== 'audio' ? [{ label: 'Record Into Cell (overdub)', icon: <Circle size={14} />, submenu: recItems }] : []),
          ...(fromTracks.length ? [{ label: 'Replace With Region From Tracks', submenu: fromTracks }] : []),
          { separator: true },
          { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => deleteCell(cell.id) },
        ]
      : [
          ...(track.type !== 'audio'
            ? [
                { label: 'New Empty Loop', icon: <Plus size={14} />, onClick: () => newEmptyCell(p, track, scene) },
                { label: 'Record Into Cell', icon: <Circle size={14} />, submenu: recItems },
              ]
            : []),
          { label: 'Paste', icon: <ClipboardPaste size={14} />, disabled: !cellClipboard, onClick: () => pasteInto(track, scene) },
          ...(fromTracks.length ? [{ label: 'Copy Region From Tracks', submenu: fromTracks }] : [{ label: 'No regions on this track yet', disabled: true }]),
        ];
    showContextMenu(e, items);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const p = useStore.getState().project;
    if (!p) return;
    const bpb = beatsPerBar(p.timeSig);
    const loopId = e.dataTransfer.getData('application/x-bandforge-loop');
    const cellId = e.dataTransfer.getData('application/x-bandforge-cell');
    if (cellId) {
      moveCell(cellId, track.id, scene, e.altKey);
      return;
    }
    if (loopId) {
      const loop = LOOPS.find((l) => l.id === loopId);
      if (!loop) return;
      if (track.type === 'audio') {
        toast('MIDI loops go on instrument or drum tracks', 'error');
        return;
      }
      if ((loop.kind === 'Drums') !== (track.type === 'drums')) {
        toast(loop.kind === 'Drums' ? 'Drop drum loops on a drum track' : 'Drop this loop on an instrument track', 'error');
        return;
      }
      const len = Math.max(bpb, loop.bars * 4);
      setCell(track.id, scene, { id: uid('r'), kind: 'midi', name: loop.name, start: 0, length: len, offset: 0, loop: false, contentLength: len, notes: loop.build(p.key) });
      toast(`Added “${loop.name}”`, 'success');
      return;
    }
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('audio') || /\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i.test(f.name));
    if (file) {
      if (track.type !== 'audio') {
        toast('Drop audio files on an audio track row', 'error');
        return;
      }
      const id = uid('a');
      const buf = await addClip(id, file, file.name);
      const beats = buf.duration / (60 / p.bpm);
      const len = Math.max(1, Math.round(beats / bpb) * bpb || beats);
      setCell(track.id, scene, { id: uid('r'), kind: 'audio', name: file.name.replace(/\.[^.]+$/, ''), start: 0, length: len, offset: 0, loop: false, contentLength: len, audioId: id, gain: 1, fadeIn: 0, fadeOut: 0 });
    }
  };

  const cls = ['ll-cell', cell ? 'filled' : 'empty', playing ? 'playing' : '', queuedStart ? 'queued' : '', queuedStop ? 'stopping' : '', selected ? 'selected' : '', dragOver ? 'dragover' : '', rec ? 'recording' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={cell ? ({ '--cell': color } as React.CSSProperties) : undefined}
      draggable={!!cell}
      onDragStart={(e) => {
        if (!cell) return;
        e.dataTransfer.setData('application/x-bandforge-cell', cell.id);
        e.dataTransfer.effectAllowed = 'copyMove';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => void onDrop(e)}
      onClick={(e) => {
        select();
        if (e.detail > 1) return;
        if (cell) triggerCell(cell.id);
      }}
      onDoubleClick={() => {
        const p = useStore.getState().project!;
        if (cell) openCellEditor(track, cell);
        else newEmptyCell(p, track, scene);
      }}
      onContextMenu={menu}
      title={cell ? `${cell.region.name} — click to play/stop, double-click to edit` : 'Double-click for a new loop, or drop a loop here'}
    >
      {cell && (
        <>
          <div className="ll-cell-name">{cell.region.name}</div>
          <CellPreview region={cell.region} color="rgba(0,0,0,0.55)" />
          <div className="ll-cell-len">{Math.round((cellLength(cell) / beatsPerBar(useStore.getState().project!.timeSig)) * 10) / 10} bar</div>
          {playing && <ProgressRing start={playing.start} length={cellLength(cell)} />}
          {!playing && !rec && <Play className="ll-cell-play" size={14} fill="currentColor" />}
        </>
      )}
      {!cell && !rec && <Plus className="ll-cell-plus" size={18} />}
      {rec && <RecordRing start={rec.start} end={rec.end} />}
    </div>
  );
});

function renameCell(cell: LiveCell): void {
  const name = prompt('Loop name', cell.region.name);
  if (!name?.trim()) return;
  commit((d) => {
    const c = d.liveLoops?.cells.find((x) => x.id === cell.id);
    if (c) c.region.name = name.trim();
  });
}

function setCellLength(cell: LiveCell, len: number): void {
  commit((d) => {
    const c = d.liveLoops?.cells.find((x) => x.id === cell.id);
    if (!c) return;
    if (c.region.kind === 'midi' && len > c.region.length && !c.region.loop) {
      // Extending repeats the existing content so the loop keeps its groove.
      const L = c.region.length;
      const extra = [];
      for (let k = 1; k * L < len; k++) for (const n of c.region.notes) if (n.start < L && n.start + k * L < len) extra.push({ ...n, id: uid('n'), start: n.start + k * L });
      c.region.notes.push(...extra);
    }
    c.region.length = len;
    c.region.contentLength = c.region.loop ? Math.min(c.region.contentLength, len) : len;
  });
}

function pasteInto(track: Track, scene: number): void {
  if (!cellClipboard) return;
  if ((track.type === 'audio') !== (cellClipboard.kind === 'audio')) {
    toast('That loop does not fit this track type', 'error');
    return;
  }
  const r = structuredClone(cellClipboard);
  r.id = uid('r');
  if (r.kind === 'midi') r.notes = r.notes.map((n) => ({ ...n, id: uid('n') }));
  setCell(track.id, scene, r);
}

function RowHeader({ track }: { track: Track }) {
  const isPlaying = useLive((s) => !!s.playing[track.id]);
  const selected = useStore((s) => s.selectedTrackId === track.id);
  const level = useTransport((s) => Math.min(1, (s.levels[track.id] ?? 0) * 1.2));
  return (
    <div className={'ll-row-head' + (selected ? ' selected' : '')} onClick={() => useStore.setState({ selectedTrackId: track.id })}>
      <div className="ll-row-icon" style={{ color: track.color }}>
        <TrackIcon track={track} size={20} />
      </div>
      <div className="ll-row-info">
        <div className="ll-row-name">{track.name}</div>
        <div className="ll-row-btns">
          <button
            className={'ll-mini' + (track.mute ? ' on mute' : '')}
            onClick={(e) => {
              e.stopPropagation();
              commit((d) => {
                const t = d.tracks.find((x) => x.id === track.id);
                if (t) t.mute = !t.mute;
              });
            }}
          >
            M
          </button>
          <button
            className={'ll-mini' + (track.solo ? ' on solo' : '')}
            onClick={(e) => {
              e.stopPropagation();
              commit((d) => {
                const t = d.tracks.find((x) => x.id === track.id);
                if (t) t.solo = !t.solo;
              });
            }}
          >
            S
          </button>
          <div className="ll-meter">
            <i style={{ width: `${level * 100}%` }} />
          </div>
        </div>
      </div>
      <button
        className={'ll-stop-row' + (isPlaying ? ' active' : '')}
        title="Stop this row"
        onClick={(e) => {
          e.stopPropagation();
          stopRow(track.id);
        }}
      >
        <Square size={10} fill="currentColor" />
      </button>
    </div>
  );
}

function SceneHeader({ index, name }: { index: number; name: string }) {
  const p = useStore((s) => s.project)!;
  const active = useLive((s) => {
    const cells = (p.liveLoops?.cells ?? []).filter((c) => c.scene === index);
    return cells.length > 0 && cells.every((c) => s.playing[c.trackId]?.cellId === c.id);
  });
  const [editing, setEditing] = useState(false);
  return (
    <div className={'ll-scene' + (active ? ' active' : '')}>
      <button className="ll-scene-trigger" title="Play this scene" onClick={() => triggerScene(index)}>
        <Play size={13} fill="currentColor" />
      </button>
      {editing ? (
        <input
          autoFocus
          type="text"
          defaultValue={name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v)
              commit((d) => {
                const ll = ensureLiveLoops(d);
                if (ll.scenes[index]) ll.scenes[index].name = v;
              });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          className="ll-scene-name"
          onDoubleClick={() => setEditing(true)}
          onContextMenu={(e) =>
            showContextMenu(e, [
              { label: 'Play Scene', onClick: () => triggerScene(index) },
              { label: 'Rename', onClick: () => setEditing(true) },
              { label: 'Duplicate Scene', onClick: () => duplicateScene(index) },
              { label: 'Insert Scene Before', onClick: () => insertScene(index) },
              { separator: true },
              { label: 'Delete Scene', onClick: () => deleteScene(index) },
            ])
          }
          title="Double-click to rename, right-click for options"
        >
          {name}
        </span>
      )}
    </div>
  );
}

function insertScene(at: number): void {
  commit((d) => {
    const ll = ensureLiveLoops(d);
    ll.scenes.splice(at, 0, { id: uid('s'), name: String(ll.scenes.length + 1) });
    for (const c of ll.cells) if (c.scene >= at) c.scene++;
  });
}

function duplicateScene(index: number): void {
  commit((d) => {
    const ll = ensureLiveLoops(d);
    const src = ll.scenes[index];
    if (!src) return;
    ll.scenes.splice(index + 1, 0, { id: uid('s'), name: src.name + ' 2' });
    for (const c of ll.cells) if (c.scene > index) c.scene++;
    const copies = ll.cells
      .filter((c) => c.scene === index)
      .map((c) => {
        const r = JSON.parse(JSON.stringify(c.region)) as Region;
        r.id = uid('r');
        if (r.kind === 'midi') r.notes = r.notes.map((n) => ({ ...n, id: uid('n') }));
        return { id: uid('l'), trackId: c.trackId, scene: index + 1, region: r };
      });
    ll.cells.push(...(copies as typeof ll.cells));
  });
}

function deleteScene(index: number): void {
  const p = useStore.getState().project;
  const cells = (p?.liveLoops?.cells ?? []).filter((c) => c.scene === index);
  for (const [tid, pc] of Object.entries(useLive.getState().playing)) if (cells.some((c) => c.id === pc.cellId)) stopRow(tid);
  commit((d) => {
    const ll = ensureLiveLoops(d);
    ll.scenes.splice(index, 1);
    ll.cells = ll.cells.filter((c) => c.scene !== index);
    for (const c of ll.cells) if (c.scene > index) c.scene--;
  });
}

export default function LiveLoopsView() {
  const project = useStore((s) => s.project)!;
  const playing = useStore((s) => s.playing);
  const anyCellPlaying = useLive((s) => Object.keys(s.playing).length > 0);
  const selected = useLive((s) => s.selected);
  const recording = useLive((s) => s.recording);
  const [recBars, setRecBars] = useState(2);
  const ll = project.liveLoops;
  const scenes = ll?.scenes ?? Array.from({ length: 8 }, (_, i) => ({ id: 'tmp' + i, name: String(i + 1) }));
  const bpb = beatsPerBar(project.timeSig);
  const quant = ll?.quantize ?? bpb;

  // Take over playback from the timeline while the grid is shown.
  useEffect(() => {
    const engine = getEngine();
    engine.setLiveScheduler(liveScheduler);
    if (!useStore.getState().project?.liveLoops)
      live((d) => {
        ensureLiveLoops(d);
      });
    return () => engine.setLiveScheduler(null);
  }, []);

  const cellsByKey = useMemo(() => {
    const m = new Map<string, LiveCell>();
    for (const c of ll?.cells ?? []) m.set(c.trackId + ':' + c.scene, c);
    return m;
  }, [ll?.cells]);

  const selTrack = selected ? project.tracks.find((t) => t.id === selected.trackId) : undefined;

  return (
    <div className="liveloops" onPointerDownCapture={() => useStore.setState({ focusArea: 'other' })}>
      <div className="ll-toolbar">
        <div className="ll-title">Live Loops</div>
        <label className="row ll-quant" title="When a tapped loop starts">
          <span className="dim">Start</span>
          <select
            value={QUANT_OPTIONS.findIndex((o) => (o.bars !== undefined ? o.bars * bpb : o.beats) === quant)}
            onChange={(e) => {
              const o = QUANT_OPTIONS[Number(e.target.value)];
              commit((d) => {
                ensureLiveLoops(d).quantize = o.bars !== undefined ? o.bars * bpb : o.beats ?? 0;
              });
            }}
          >
            {QUANT_OPTIONS.map((o, i) => (
              <option key={o.label} value={i}>
                {o.label === 'Off' ? 'Immediately' : 'Next ' + o.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn sm" disabled={!anyCellPlaying} onClick={stopAllCells} title="Stop all loops (at the next boundary)">
          <Square size={11} fill="currentColor" /> Stop All
        </button>
        <div className="ll-sep" />
        {recording ? (
          <button className="btn sm danger" onClick={cancelCellRecording}>
            Cancel Cell Recording
          </button>
        ) : (
          <div className="row" style={{ gap: 4 }}>
            <button
              className="btn sm"
              disabled={!selected || !selTrack || selTrack.type === 'audio'}
              title="Record the keyboard into the selected cell, then loop it"
              onClick={() => selected && void recordIntoCell(selected.trackId, selected.scene, recBars)}
            >
              <Circle size={11} fill="var(--record)" color="var(--record)" /> Record Into Cell
            </button>
            <select value={recBars} onChange={(e) => setRecBars(Number(e.target.value))} title="Length of the recording">
              {[1, 2, 4, 8].map((b) => (
                <option key={b} value={b}>
                  {b} bar{b > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="ll-sep" />
        <button
          className="btn sm"
          onClick={() => {
            if ((ll?.cells.length ?? 0) && !confirm('Replace the grid with scenes made from your arrangement?')) return;
            const n = scenesFromSections();
            toast(n ? `Made ${n} loops from your arrangement` : 'No regions to turn into loops yet', n ? 'success' : 'info');
          }}
          title="Turn each section of your Tracks arrangement into a scene"
        >
          <Layers size={13} /> Scenes From Tracks
        </button>
        <div className="spacer" />
        <div className="ll-hint faint">
          {playing ? (useStore.getState().recording ? 'Recording your performance to Tracks…' : 'Tap cells to launch · press R to record a performance') : 'Tap a cell or a scene play button to start · double-click to edit · drag loops from the Library'}
        </div>
      </div>
      <div className="ll-grid-wrap">
        <div className="ll-grid" style={{ gridTemplateColumns: `200px repeat(${scenes.length}, 112px) 60px` }}>
          <div className="ll-corner" />
          {scenes.map((s, i) => (
            <SceneHeader key={s.id} index={i} name={s.name} />
          ))}
          <button
            className="ll-add-scene"
            title="Add scene"
            onClick={() =>
              commit((d) => {
                const l = ensureLiveLoops(d);
                l.scenes.push({ id: uid('s'), name: String(l.scenes.length + 1) });
              })
            }
          >
            <Plus size={16} />
          </button>
          {project.tracks.map((t) => (
            <Row key={t.id} track={t} scenes={scenes.length} cellsByKey={cellsByKey} />
          ))}
          <button className="ll-add-track" onClick={() => openModal('newTrack')}>
            <Plus size={14} /> Track
          </button>
        </div>
        {!project.tracks.length && <div className="empty-state">Add a track to start filling the grid with loops.</div>}
      </div>
    </div>
  );
}

function Row({ track, scenes, cellsByKey }: { track: Track; scenes: number; cellsByKey: Map<string, LiveCell> }) {
  return (
    <>
      <RowHeader track={track} />
      {Array.from({ length: scenes }, (_, i) => (
        <Cell key={i} track={track} scene={i} cell={cellsByKey.get(track.id + ':' + i)} />
      ))}
      <div />
    </>
  );
}
