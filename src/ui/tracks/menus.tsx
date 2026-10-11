// Context menus for regions, lanes and track headers.
import { meterOf } from '../../model/timeline';
import { Copy, Scissors, Trash2, ClipboardPaste, Repeat, SquarePen, Plus, FileAudio, Palette, Pencil, Music, Play, Unlink, Repeat1, Shuffle } from 'lucide-react';
import { GROOVE_PRESETS, grooveLabel, swingPercent } from '../../model/groove';
import { isLinkedClip, patternUseCounts } from '../../model/patterns';
import type { Track } from '../../model/types';
import { commit, draftRegion, findRegion, openModal, useStore } from '../../state/store';
import {
  addTrack,
  copySelection,
  createEmptyRegion,
  deleteRegions,
  deleteTrack,
  duplicateRegions,
  duplicateTrack,
  importAudioFile,
  joinRegions,
  pasteRegions,
  quantizeNotesIn,
  splitRegionsAt,
  currentPatternClip,
  loopPlaybackOver,
  makePatternUnique,
  placePattern,
  bakeGroove,
  setRegionGroove,
  toggleLoopRegions,
  transposeRegions,
  updateTrack,
} from '../../state/actions';
import { getEngine } from '../../audio/engine';
import type { MenuItem } from '../common/menus';
import { useTracksUi } from './tracksUi';

export function openRegionEditor(regionId: string): void {
  const p = useStore.getState().project;
  const f = findRegion(p, regionId);
  if (!f) return;
  const mode = f.region.kind === 'audio' ? 'audio' : f.track.type === 'drums' ? 'steps' : useStore.getState().editorMode === 'score' ? 'score' : 'pianoroll';
  useStore.setState({
    editingRegionId: regionId,
    selectedRegionIds: [regionId],
    selectedTrackId: f.track.id,
    dockTab: 'editor',
    editorMode: mode,
  });
}

function selectionOrThis(id: string): string[] {
  const sel = useStore.getState().selectedRegionIds;
  return sel.includes(id) ? sel : [id];
}

function editSelected(ids: string[], fn: (r: ReturnType<typeof draftRegion> & object) => void) {
  commit((d) => {
    for (const id of ids) {
      const r = draftRegion(d, id);
      if (r) fn(r);
    }
  });
}

export function convertToSampler(regionId: string): void {
  const f = findRegion(useStore.getState().project, regionId);
  if (!f || f.region.kind !== 'audio') return;
  const audioId = f.region.audioId;
  const id = addTrack('instrument', 'user-sampler');
  updateTrack(id, (t) => {
    t.samplerAudioId = audioId;
    t.samplerRoot = 60;
    t.name = (f.region.name || 'Sample') + ' Sampler';
  });
  useStore.setState({ dockTab: 'instrument' });
}

/** Items for the region context menu. `clickBeat` = where on the timeline the menu was opened. */
export function regionMenu(regionId: string, clickBeat: number): MenuItem[] {
  const p = useStore.getState().project!;
  const f = findRegion(p, regionId);
  if (!f) return [];
  const ids = selectionOrThis(regionId);
  useStore.setState({ selectedRegionIds: ids });
  const r = f.region;
  const isAudio = r.kind === 'audio';
  const grid = useStore.getState().snapGrid || 0.25;
  const splitBeat = Math.round(clickBeat / grid) * grid;
  const meter = meterOf(p);
  const bpb = meter.lenAt(r.start);
  const items: MenuItem[] = [
    { label: 'Open in Editor', icon: <SquarePen size={14} />, onClick: () => openRegionEditor(regionId) },
    ...(isLinkedClip(r)
      ? [
          { label: 'Play Pattern on Its Own', icon: <Play size={14} />, onClick: () => void getEngine().playPattern(regionId) },
          ...((patternUseCounts(p).get(r.patternId) ?? 0) > 1
            ? [{ label: 'Make Unique (stop linking)', icon: <Unlink size={14} />, onClick: () => makePatternUnique(regionId) }]
            : []),
        ]
      : []),
    { label: 'Loop Playback Over These Bars', icon: <Repeat1 size={14} />, cmd: 'transport.loopSelection', onClick: () => loopPlaybackOver(ids) },
    { separator: true },
    { label: 'Cut', icon: <Scissors size={14} />, cmd: 'edit.cut', onClick: () => copySelection(true) },
    { label: 'Copy', icon: <Copy size={14} />, cmd: 'edit.copy', onClick: () => copySelection(false) },
    { label: 'Paste', icon: <ClipboardPaste size={14} />, cmd: 'edit.paste', disabled: !useStore.getState().clipboard, onClick: () => pasteRegions() },
    { label: 'Duplicate', cmd: 'edit.duplicate', onClick: () => duplicateRegions(ids) },
    { label: 'Delete', icon: <Trash2 size={14} />, cmd: 'edit.delete', onClick: () => deleteRegions(ids) },
    { separator: true },
    { label: 'Split at Playhead', cmd: 'region.split', onClick: () => splitRegionsAt(ids, getEngine().position) },
    { label: 'Split Here', onClick: () => splitRegionsAt([regionId], splitBeat) },
    { label: 'Join Regions', cmd: 'region.join', disabled: ids.length < 2 || isAudio, onClick: () => joinRegions(ids) },
    { label: r.loop ? 'Turn Loop Off' : 'Loop', icon: <Repeat size={14} />, cmd: 'region.loop', onClick: () => toggleLoopRegions(ids) },
    {
      label: 'Loop to End of Song',
      onClick: () =>
        editSelected(ids, (x) => {
          if (!x.loop) {
            x.loop = true;
            x.contentLength = Math.max(0.25, x.offset + x.length);
          }
          x.length = Math.max(x.length, meter.barStart(p.lengthBars - 4) - x.start);
        }),
    },
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => useTracksUi.setState({ renamingRegionId: regionId }) },
    {
      label: r.muted ? 'Unmute Region' : 'Mute Region',
      onClick: () =>
        editSelected(ids, (x) => {
          x.muted = !r.muted;
        }),
    },
  ];
  if (!isAudio) {
    items.push(
      { separator: true },
      {
        label: 'Transpose',
        icon: <Music size={14} />,
        submenu: [
          { label: 'Up an Octave', onClick: () => transposeRegions(ids, 12) },
          { label: 'Up a Semitone', onClick: () => transposeRegions(ids, 1) },
          { label: 'Down a Semitone', onClick: () => transposeRegions(ids, -1) },
          { label: 'Down an Octave', onClick: () => transposeRegions(ids, -12) },
        ],
      },
      {
        label: 'Swing',
        icon: <Shuffle size={14} />,
        submenu: [
          { label: `Follow Song (${grooveLabel(p.groove)})`, onClick: () => setRegionGroove(ids, undefined) },
          { separator: true },
          ...GROOVE_PRESETS.map((pr) => ({ label: pr.name, shortcut: pr.groove ? `${pr.groove.grid}th ${swingPercent(pr.groove)}%` : '', onClick: () => setRegionGroove(ids, pr.groove ? { ...pr.groove } : null) })),
          { separator: true },
          { label: 'Write Swing into Notes', onClick: () => bakeGroove(ids) },
        ],
      },
      {
        label: 'Quantize',
        submenu: [
          { label: '1/4 Note', onClick: () => ids.forEach((id) => quantizeNotesIn(id, 1)) },
          { label: '1/8 Note', onClick: () => ids.forEach((id) => quantizeNotesIn(id, 0.5)) },
          { label: '1/16 Note', onClick: () => ids.forEach((id) => quantizeNotesIn(id, 0.25)) },
          { label: '1/8 Triplet', onClick: () => ids.forEach((id) => quantizeNotesIn(id, 1 / 3)) },
          { label: '1/16 (50% strength)', onClick: () => ids.forEach((id) => quantizeNotesIn(id, 0.25, undefined, 0.5)) },
        ],
      },
    );
  } else {
    items.push(
      { separator: true },
      {
        label: 'Fade In',
        submenu: [
          ['None', 0],
          ['1 Beat', 1],
          ['1 Bar', bpb],
          ['2 Bars', bpb * 2],
          ['4 Bars', bpb * 4],
        ].map(([label, v]) => ({
          label: label as string,
          onClick: () =>
            editSelected(ids, (x) => {
              if (x.kind === 'audio') x.fadeIn = Math.min(v as number, x.length - x.fadeOut);
            }),
        })),
      },
      {
        label: 'Fade Out',
        submenu: [
          ['None', 0],
          ['1 Beat', 1],
          ['1 Bar', bpb],
          ['2 Bars', bpb * 2],
          ['4 Bars', bpb * 4],
        ].map(([label, v]) => ({
          label: label as string,
          onClick: () =>
            editSelected(ids, (x) => {
              if (x.kind === 'audio') x.fadeOut = Math.min(v as number, x.length - x.fadeIn);
            }),
        })),
      },
      {
        label: 'Gain',
        submenu: [
          ['+6 dB', 2],
          ['+3 dB', 1.41],
          ['0 dB', 1],
          ['−3 dB', 0.71],
          ['−6 dB', 0.5],
          ['−12 dB', 0.25],
        ].map(([label, v]) => ({
          label: label as string,
          onClick: () =>
            editSelected(ids, (x) => {
              if (x.kind === 'audio') x.gain = v as number;
            }),
        })),
      },
      {
        label: r.kind === 'audio' && r.reversed ? 'Un-reverse' : 'Reverse',
        onClick: () =>
          editSelected(ids, (x) => {
            if (x.kind === 'audio') x.reversed = !x.reversed;
          }),
      },
      { label: 'Convert to Sampler Instrument', onClick: () => convertToSampler(regionId) },
    );
  }
  return items;
}

/** Floating GarageBand-style edit menu. */
export function regionPillItems(regionId: string): MenuItem[] {
  const ids = selectionOrThis(regionId);
  const r = findRegion(useStore.getState().project, regionId)?.region;
  return [
    { label: 'Cut', onClick: () => copySelection(true) },
    { label: 'Copy', onClick: () => copySelection(false) },
    { label: 'Delete', onClick: () => deleteRegions(ids) },
    { label: r?.loop ? 'Unloop' : 'Loop', onClick: () => toggleLoopRegions(ids) },
    { label: 'Split', onClick: () => splitRegionsAt(ids, getEngine().position) },
    { label: 'Duplicate', onClick: () => duplicateRegions(ids) },
    { label: 'Rename', onClick: () => useTracksUi.setState({ renamingRegionId: regionId }) },
    { label: 'Edit', onClick: () => openRegionEditor(regionId) },
  ];
}

export function pickAudioFile(trackId: string | undefined, beat: number): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aac,.webm';
  input.multiple = true;
  input.onchange = async () => {
    let at = beat;
    for (const f of Array.from(input.files ?? [])) {
      await importAudioFile(f, trackId, at);
      at = beat; // stack each file at the same position on new tracks
    }
  };
  input.click();
}

export function laneMenu(track: Track, beat: number): MenuItem[] {
  const barBeat = meterOf(useStore.getState().project!).floorBar(beat);
  const pattern = track.type === 'drums' ? currentPatternClip(useStore.getState().project!, track.id) : undefined;
  return [
    {
      label: 'Paste Here',
      icon: <ClipboardPaste size={14} />,
      disabled: !useStore.getState().clipboard,
      onClick: () => {
        useStore.setState({ selectedTrackId: track.id });
        pasteRegions(barBeat);
      },
    },
    ...(track.type === 'drums' && pattern
      ? [{ label: `Place “${pattern.name}” Here`, icon: <Repeat size={14} />, onClick: () => placePattern(track.id, beat, pattern.id) }]
      : []),
    ...(track.type !== 'audio'
      ? [{ label: track.type === 'drums' ? 'New Pattern Here' : 'Create MIDI Region', icon: <Plus size={14} />, onClick: () => createEmptyRegion(track.id, beat) }]
      : []),
    { label: 'Import Audio File…', icon: <FileAudio size={14} />, onClick: () => pickAudioFile(track.type === 'audio' ? track.id : undefined, barBeat) },
    { label: 'Set Playhead Here', onClick: () => getEngine().seek(barBeat) },
  ];
}

const COLORS: [string, string][] = [
  ['Green', '#3ecf5a'],
  ['Mint', '#2fbf8f'],
  ['Yellow', '#e8b92a'],
  ['Orange', '#f0892a'],
  ['Red', '#ef5350'],
  ['Pink', '#ec4fa0'],
  ['Purple', '#a46cf0'],
  ['Blue', '#3d9bff'],
  ['Cyan', '#28c4dc'],
  ['Gray', '#9a9aa4'],
];

export function trackMenu(t: Track): MenuItem[] {
  return [
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => useTracksUi.setState({ renamingTrackId: t.id }) },
    { label: 'Duplicate Track', icon: <Copy size={14} />, onClick: () => duplicateTrack(t.id, true) },
    { label: 'Duplicate Track (empty)', onClick: () => duplicateTrack(t.id, false) },
    ...(t.type !== 'audio'
      ? [
          {
            label: 'Change Instrument…',
            icon: <Music size={14} />,
            onClick: () => useStore.setState({ libraryOpen: true, selectedTrackId: t.id }),
          },
        ]
      : []),
    {
      label: 'Track Color',
      icon: <Palette size={14} />,
      submenu: COLORS.map(([name, c]) => ({
        label: name,
        icon: <span style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block' }} />,
        onClick: () =>
          updateTrack(t.id, (x) => {
            x.color = c;
          }),
      })),
    },
    { separator: true },
    {
      label: t.showAutomation === 'volume' ? 'Hide Volume Automation' : 'Show Volume Automation',
      onClick: () =>
        updateTrack(t.id, (x) => {
          x.showAutomation = x.showAutomation === 'volume' ? null : 'volume';
        }),
    },
    {
      label: t.showAutomation === 'pan' ? 'Hide Pan Automation' : 'Show Pan Automation',
      onClick: () =>
        updateTrack(t.id, (x) => {
          x.showAutomation = x.showAutomation === 'pan' ? null : 'pan';
        }),
    },
    {
      label: 'Clear Automation',
      disabled: !t.automation.volume.length && !t.automation.pan.length,
      onClick: () =>
        updateTrack(t.id, (x) => {
          x.automation.volume = [];
          x.automation.pan = [];
        }),
    },
    { separator: true },
    { label: 'New Track…', icon: <Plus size={14} />, onClick: () => openModal('newTrack') },
    { label: 'Delete Track', icon: <Trash2 size={14} />, onClick: () => deleteTrack(t.id) },
  ];
}
