// Global keyboard shortcuts (GarageBand-style).
import { meterOf } from '../model/timeline';
import { useEffect } from 'react';
import { commit, openModal, redo, undo, useStore, toast } from '../state/store';
import { copySelection, deleteRegions, loopPlaybackOver, duplicateRegions, joinRegions, pasteRegions, splitRegionsAt, toggleLoopRegions } from '../state/actions';
import { getEngine } from '../audio/engine';
import { flushSave } from '../state/persistence';
import { isTyping } from './common/drag';
import { comboOf, isKey } from './keys/keymap';
import { openFullScore } from './editors/score/FullScoreButton';

/** Keys that musical typing claims while it is active. */
export const MUSICAL_TYPING_KEYS = new Set(['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', "'", 'z', 'x', 'c', 'v', '1', '2', '3', '4', '5', '6', '7', '8']);

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.defaultPrevented) return;
      const s = useStore.getState();
      const p = s.project;
      if (!p || s.modal) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const engine = getEngine();
      const meter = meterOf(p);
      const combo = comboOf(e);
      if (!combo) return;
      const is = (id: string) => isKey(e, id, combo);

      // Musical typing owns plain letter keys while it's on.
      if (s.musicalTyping && !mod && !e.altKey && MUSICAL_TYPING_KEYS.has(key) && !is('view.musicalTyping')) return;

      const inTracks = s.focusArea === 'tracks';
      const done = () => e.preventDefault();
      const dock = (tab: NonNullable<typeof s.dockTab>) => useStore.setState({ dockTab: s.dockTab === tab ? null : tab, dockMaximized: false });
      const toggleTrack = (field: 'mute' | 'solo') =>
        s.selectedTrackId &&
        commit((d) => {
          const t = d.tracks.find((x) => x.id === s.selectedTrackId);
          if (t) t[field] = !t[field];
        });
      // Previous / next bar line (a little past a bar line counts as "on" it).
      const prevBar = () => engine.seek(Math.max(0, meter.floorBar(engine.position - 0.05)));
      const nextBar = () => engine.seek(meter.ceilBar(engine.position + 0.05));
      const selectTrack = (dir: number) => {
        const i = p.tracks.findIndex((t) => t.id === s.selectedTrackId);
        const j = Math.max(0, Math.min(p.tracks.length - 1, i + dir));
        if (p.tracks[j]) useStore.setState({ selectedTrackId: p.tracks[j].id });
      };

      // Region editing in the tracks area.
      if (inTracks) {
        if (is('edit.copy')) return done(), copySelection(false);
        if (is('edit.cut')) return done(), copySelection(true);
        if (is('edit.paste')) return done(), pasteRegions();
        if (is('edit.duplicate')) return done(), duplicateRegions(s.selectedRegionIds);
        if (is('region.split')) return done(), splitRegionsAt(s.selectedRegionIds, engine.position);
        if (is('region.join')) return done(), joinRegions(s.selectedRegionIds);
        if (is('edit.selectAll')) return done(), useStore.setState({ selectedRegionIds: p.tracks.flatMap((t) => t.regions.map((r) => r.id)) });
        if (is('edit.delete') && s.selectedRegionIds.length) return done(), deleteRegions(s.selectedRegionIds);
        if (is('region.loop') && s.selectedRegionIds.length) return done(), toggleLoopRegions(s.selectedRegionIds);
        if (is('track.prev')) return done(), selectTrack(-1);
        if (is('track.next')) return done(), selectTrack(1);
        if (is('tracks.prevBar')) return done(), prevBar();
        if (is('tracks.nextBar')) return done(), nextBar();
      }

      const actions: [string, () => void][] = [
        ['edit.undo', undo],
        ['edit.redo', redo],
        ['song.save', () => void flushSave().then(() => toast('Song saved', 'success'))],
        ['song.export', () => openModal('export')],
        ['song.youtube', () => openModal('youtube')],
        ['song.parts', () => openModal('parts')],
        ['song.versions', () => openModal('versions')],
        [
          'song.saveVersion',
          () =>
            void flushSave().then(async () => {
              const { saveVersion, listVersions } = await import('../state/safety');
              const p = useStore.getState().project;
              if (!p) return;
              const n = (await listVersions(p.id)).filter((v) => !v.auto).length + 1;
              await saveVersion(p, { label: `Version ${n}` });
              toast(`Saved “Version ${n}”. Find it in Version History`, 'success');
            }),
        ],
        ['song.newTrack', () => openModal('newTrack')],
        ['view.zoomIn', () => useStore.setState({ pxPerBeat: Math.min(200, s.pxPerBeat * 1.25) })],
        ['view.zoomOut', () => useStore.setState({ pxPerBeat: Math.max(4, s.pxPerBeat / 1.25) })],
        ['transport.play', () => engine.togglePlay()],
        ['transport.toStart', () => engine.seek(0)],
        ['transport.record', () => void engine.record()],
        ['transport.loopSelection', () => loopPlaybackOver(s.selectedRegionIds)],
        ['transport.cycle', () => commit((d) => void (d.loop.enabled = !d.loop.enabled))],
        ['transport.metronome', () => commit((d) => void (d.metronome = !d.metronome))],
        ['transport.prevBar', prevBar],
        ['transport.nextBar', nextBar],
        ['view.editor', () => dock('editor')],
        ['view.instrument', () => dock('instrument')],
        ['view.mixer', () => dock('mixer')],
        ['view.chords', () => dock('assistant')],
        ['view.fx', () => dock('fx')],
        ['view.sounds', () => useStore.setState({ libraryOpen: !s.libraryOpen })],
        ['view.musicalTyping', () => {
          useStore.setState({ musicalTyping: !s.musicalTyping });
          toast(s.musicalTyping ? 'Musical typing off' : 'Musical typing on: play with A S D F…');
        }],
        ['view.shortcuts', () => openModal('help')],
        ['view.fullScore', () => (s.dockTab === 'editor' && s.editorMode === 'fullscore' ? useStore.setState({ dockTab: null, dockMaximized: false }) : openFullScore())],
        ['track.mute', () => toggleTrack('mute')],
        ['track.solo', () => toggleTrack('solo')],
      ];
      for (const [id, run] of actions)
        if (is(id)) {
          done();
          run();
          return;
        }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
