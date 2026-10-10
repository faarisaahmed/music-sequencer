import { addDrummerRegion } from '../../state/drummerActions';
import { addLoopToSong } from '../library/loops';
import { memo, useEffect, useRef, useState } from 'react';
import { Circle } from 'lucide-react';
import type { Track } from '../../model/types';
import { getPreset } from '../../audio/presets';
import { getEngine } from '../../audio/engine';
import type { Draft } from 'immer';
import { live, useStore, useTransport } from '../../state/store';
import { createEmptyRegion, importAudioFile, importMidiFile, moveTrack, updateTrack } from '../../state/actions';
import { HSlider, Knob } from '../common/controls';
import { TrackIcon } from '../common/icons';
import { showContextMenu } from '../common/menus';
import { startDrag } from '../common/drag';
import RegionView from './RegionView';
import AutomationLane from './AutomationLane';
import { laneMenu, trackMenu } from './menus';
import { AUTOMATION_H, useTracksUi } from './tracksUi';

function Meter({ trackId }: { trackId: string }) {
  const level = useTransport((s) => s.levels[trackId] ?? 0);
  const db = 20 * Math.log10(Math.max(level, 1e-5));
  const f = Math.max(0, Math.min(1, (db + 48) / 48));
  return (
    <div className="th-meter">
      <i style={{ height: `${f * 100}%`, background: level > 0.98 ? 'var(--record)' : undefined }} />
    </div>
  );
}

function TrackHeader({ track, height, selected }: { track: Track; height: number; selected: boolean }) {
  const renaming = useTracksUi((s) => s.renamingTrackId === track.id);
  const preset = track.type === 'audio' ? null : getPreset(track.instrument);
  const sub = track.type === 'audio' ? 'Audio Recorder' : preset!.name === track.name ? preset!.category : preset!.name;
  const compact = height < 70;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    useStore.setState({ selectedTrackId: track.id, focusArea: 'tracks' });
    const target = e.target as HTMLElement;
    if (target.closest('button, input, .hslider, .knob')) return;
    // Drag to reorder
    const rows = [...document.querySelectorAll<HTMLElement>('[data-track-block]')].map((el) => ({ id: el.dataset.trackBlock!, rect: el.getBoundingClientRect() }));
    const content = (e.currentTarget as HTMLElement).closest('.tv-content') as HTMLElement;
    let targetIdx = -1;
    startDrag(
      e,
      ({ y }) => {
        const others = rows.filter((r) => r.id !== track.id);
        targetIdx = others.filter((r) => r.rect.top + r.rect.height / 2 < y).length;
        const ref = targetIdx < others.length ? others[targetIdx].rect.top : others[others.length - 1]?.rect.bottom ?? 0;
        useTracksUi.setState({ dropIndicator: ref - content.getBoundingClientRect().top });
      },
      ({ moved }) => {
        useTracksUi.setState({ dropIndicator: null });
        if (moved && targetIdx >= 0) moveTrack(track.id, targetIdx);
      },
      { threshold: 5 },
    );
  };

  const btn = (label: string, on: boolean, cls: string, title: string, onClick: () => void) => (
    <button className={'th-btn ' + cls + (on ? ' on' : '')} title={title} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div
      className={'track-header' + (selected ? ' selected' : '') + (compact ? ' compact' : '')}
      style={{ height, ['--c' as string]: track.color }}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        useStore.setState({ selectedTrackId: track.id });
        showContextMenu(e, trackMenu(track));
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.th-name')) useTracksUi.setState({ renamingTrackId: track.id });
      }}
    >
      <div className="th-strip" />
      <div
        className="th-icon"
        title={track.type === 'audio' ? 'Audio track' : 'Change instrument'}
        onClick={() => track.type !== 'audio' && useStore.setState({ libraryOpen: true, selectedTrackId: track.id })}
      >
        <TrackIcon track={track} size={compact ? 18 : 24} />
      </div>
      <div className="th-main">
        <div className="th-top">
          {renaming ? (
            <input
              autoFocus
              className="th-rename"
              defaultValue={track.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== track.name)
                  updateTrack(track.id, (t) => {
                    t.name = v;
                  });
                useTracksUi.setState({ renamingTrackId: null });
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') useTracksUi.setState({ renamingTrackId: null });
              }}
            />
          ) : (
            <div className="th-name" title={`${track.name} — double-click to rename`}>
              {track.name}
            </div>
          )}
        </div>
        {!compact && <div className="th-sub">{sub}</div>}
        <div className="th-controls">
          {btn('M', track.mute, 'mute', 'Mute (M)', () =>
            updateTrack(track.id, (t) => {
              t.mute = !t.mute;
            }),
          )}
          {btn('S', track.solo, 'solo', 'Solo (S)', () =>
            updateTrack(track.id, (t) => {
              t.solo = !t.solo;
            }),
          )}
          <button
            className={'th-btn arm' + (track.armed ? ' on' : '')}
            title="Record enable"
            onClick={() => {
              updateTrack(track.id, (t) => {
                t.armed = !t.armed;
              });
              if (!track.armed && track.type === 'audio') void getEngine().startMic();
            }}
          >
            <Circle size={9} fill="currentColor" />
          </button>
          <button
            className={'th-btn auto' + (track.showAutomation ? ' on' : '')}
            title="Show automation (volume → pan → off)"
            onClick={() =>
              updateTrack(track.id, (t) => {
                t.showAutomation = t.showAutomation === 'volume' ? 'pan' : t.showAutomation === 'pan' ? null : 'volume';
              })
            }
          >
            A
          </button>
          <div className="th-vol">
            <HSlider
              value={track.volume}
              min={0}
              max={1.25}
              defaultValue={0.8}
              width="100%"
              color={track.color}
              title="Volume"
              onChange={(v) =>
                updateTrackLive(track.id, (t) => {
                  t.volume = v;
                })
              }
            />
          </div>
          <Knob
            value={track.pan}
            min={-1}
            max={1}
            size={22}
            bipolar
            defaultValue={0}
            color={track.color}
            label={undefined}
            onChange={(v) =>
              updateTrackLive(track.id, (t) => {
                t.pan = Math.abs(v) < 0.03 ? 0 : v;
              })
            }
          />
        </div>
      </div>
      <Meter trackId={track.id} />
    </div>
  );
}

// Knob / slider wrap their changes in a gesture, so use live edits here.
function updateTrackLive(id: string, fn: (t: Draft<Track>) => void) {
  const s = useStore.getState();
  if (!s.gestureOpen) {
    updateTrack(id, fn);
    return;
  }
  live((d) => {
    const t = d.tracks.find((x) => x.id === id);
    if (t) fn(t);
  });
}

function RecordingOverlay({ trackId, ppb, height }: { trackId: string; ppb: number; height: number }) {
  const recording = useStore((s) => s.recording);
  const pos = useTransport((s) => (recording ? s.position : 0));
  if (!recording) return null;
  const info = getEngine().recordingInfo;
  if (!info || info.trackId !== trackId) return null;
  const end = Math.max(info.startBeat, pos);
  const w = (end - info.startBeat) * ppb;
  if (w <= 0) return null;
  const notes = info.notes;
  let lo = 127;
  let hi = 0;
  for (const n of notes) {
    lo = Math.min(lo, n.pitch);
    hi = Math.max(hi, n.pitch);
  }
  const span = Math.max(12, hi - lo + 2);
  const bodyH = height - 26;
  return (
    <div className="region recording" style={{ left: info.startBeat * ppb, width: w, height: height - 4 }}>
      <div className="region-name">
        <span>Recording…</span>
      </div>
      <svg width={w} height={bodyH} className="region-notes">
        {notes.map((n) => (
          <rect
            key={n.id}
            x={(n.start - info.startBeat) * ppb}
            y={3 + ((hi + 1 - n.pitch) / span) * (bodyH - 4)}
            width={Math.max(2, n.duration * ppb)}
            height={3}
            rx={1}
          />
        ))}
      </svg>
    </div>
  );
}

interface LaneProps {
  track: Track;
  width: number;
  ppb: number;
  height: number;
  bpm: number;
  selected: boolean;
  onMarquee: (e: React.PointerEvent) => void;
}

function TrackLane({ track, width, ppb, height, bpm, selected, onMarquee }: LaneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const beatAt = (clientX: number) => (clientX - ref.current!.getBoundingClientRect().left) / ppb;
  return (
    <div
      ref={ref}
      className={'track-lane' + (selected ? ' selected' : '') + (dragOver ? ' dragover' : '')}
      style={{ width, height }}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        useStore.setState({ selectedTrackId: track.id, focusArea: 'tracks' });
        onMarquee(e);
      }}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget || track.type === 'audio') return;
        if (track.drummer) {
          addDrummerRegion(track.id, beatAt(e.clientX));
          useStore.setState({ dockTab: 'editor', editorMode: 'drummer' });
          return;
        }
        createEmptyRegion(track.id, beatAt(e.clientX));
      }}
      onContextMenu={(e) => {
        if (e.target !== e.currentTarget) return;
        useStore.setState({ selectedTrackId: track.id });
        showContextMenu(e, laneMenu(track, beatAt(e.clientX)));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const grid = useStore.getState().snapGrid || 1;
        const beat = Math.max(0, Math.round(beatAt(e.clientX) / grid) * grid);
        const loopId = e.dataTransfer.getData('application/x-bandforge-loop');
        if (loopId) {
          // Library loop: place it on this lane when the track type fits, otherwise on a matching track.
          addLoopToSong(loopId, beat, track.type === 'audio' ? undefined : track.id);
          return;
        }
        for (const f of Array.from(e.dataTransfer.files)) {
          if (/\.midi?$/i.test(f.name)) void importMidiFile(f, true);
          else void importAudioFile(f, track.type === 'audio' ? track.id : undefined, beat);
        }
      }}
    >
      {track.regions.map((r) => (
        <RegionView key={r.id} region={r} trackId={track.id} trackType={track.type} color={r.color ?? track.color} ppb={ppb} height={height} bpm={bpm} />
      ))}
      <RecordingOverlay trackId={track.id} ppb={ppb} height={height} />
    </div>
  );
}

interface RowProps {
  track: Track;
  width: number;
  ppb: number;
  height: number;
  bpm: number;
  onMarquee: (e: React.PointerEvent) => void;
}

function TrackRow({ track, width, ppb, height, bpm, onMarquee }: RowProps) {
  const selected = useStore((s) => s.selectedTrackId === track.id);
  const auto = track.showAutomation;
  return (
    <div className="track-block" data-track-block={track.id}>
      <div className="track-row" style={{ height }}>
        <TrackHeader track={track} height={height} selected={selected} />
        <TrackLane track={track} width={width} ppb={ppb} height={height} bpm={bpm} selected={selected} onMarquee={onMarquee} />
      </div>
      {auto && (
        <div className="track-row auto-row" style={{ height: AUTOMATION_H }}>
          <div className="auto-header" style={{ ['--c' as string]: track.color }}>
            <div className="seg">
              {(['volume', 'pan'] as const).map((p) => (
                <button
                  key={p}
                  className={auto === p ? 'on' : ''}
                  onClick={() =>
                    updateTrack(track.id, (t) => {
                      t.showAutomation = p;
                    })
                  }
                >
                  {p === 'volume' ? 'Volume' : 'Pan'}
                </button>
              ))}
            </div>
            <div className="auto-help faint">Click to add · drag · double-click deletes</div>
          </div>
          <AutomationLane
            trackId={track.id}
            param={auto}
            points={track.automation[auto]}
            fallback={auto === 'volume' ? 1 : track.pan}
            width={width}
            ppb={ppb}
            color={track.color}
          />
        </div>
      )}
    </div>
  );
}

export default memo(TrackRow);

/** Keep the mic open while an audio track is armed so the input meter works. */
export function useArmedMic(tracks: Track[]): void {
  const anyArmed = tracks.some((t) => t.type === 'audio' && t.armed);
  useEffect(() => {
    if (anyArmed) void getEngine().startMic();
  }, [anyArmed]);
}
