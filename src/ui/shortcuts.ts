// Global keyboard shortcuts (GarageBand-style).
import { useEffect } from 'react';
import { commit, openModal, redo, undo, useStore, toast } from '../state/store';
import { copySelection, deleteRegions, duplicateRegions, joinRegions, pasteRegions, splitRegionsAt, toggleLoopRegions } from '../state/actions';
import { getEngine } from '../audio/engine';
import { flushSave } from '../state/persistence';
import { beatsPerBar } from '../model/music';
import { isTyping } from './common/drag';

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
      const bpb = beatsPerBar(p.timeSig);

      // Musical typing owns plain letter keys while it's on.
      if (s.musicalTyping && !mod && MUSICAL_TYPING_KEYS.has(key)) return;

      const inTracks = s.focusArea === 'tracks';

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === 's') {
        e.preventDefault();
        void flushSave().then(() => toast('Song saved', 'success'));
        return;
      }
      if (mod && key === 'e') {
        e.preventDefault();
        openModal('export');
        return;
      }
      if (mod && e.altKey && key === 'n') {
        e.preventDefault();
        openModal('newTrack');
        return;
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault();
        useStore.setState({ pxPerBeat: Math.min(200, s.pxPerBeat * 1.25) });
        return;
      }
      if (mod && key === '-') {
        e.preventDefault();
        useStore.setState({ pxPerBeat: Math.max(4, s.pxPerBeat / 1.25) });
        return;
      }

      // Region editing in the tracks area.
      if (inTracks) {
        if (mod && key === 'c') {
          e.preventDefault();
          copySelection(false);
          return;
        }
        if (mod && key === 'x') {
          e.preventDefault();
          copySelection(true);
          return;
        }
        if (mod && key === 'v') {
          e.preventDefault();
          pasteRegions();
          return;
        }
        if (mod && key === 'd') {
          e.preventDefault();
          duplicateRegions(s.selectedRegionIds);
          return;
        }
        if (mod && key === 't') {
          e.preventDefault();
          splitRegionsAt(s.selectedRegionIds, engine.position);
          return;
        }
        if (mod && key === 'j') {
          e.preventDefault();
          joinRegions(s.selectedRegionIds);
          return;
        }
        if (mod && key === 'a') {
          e.preventDefault();
          useStore.setState({ selectedRegionIds: p.tracks.flatMap((t) => t.regions.map((r) => r.id)) });
          return;
        }
        if ((key === 'delete' || key === 'backspace') && s.selectedRegionIds.length) {
          e.preventDefault();
          deleteRegions(s.selectedRegionIds);
          return;
        }
        if (key === 'l' && !mod && s.selectedRegionIds.length) {
          toggleLoopRegions(s.selectedRegionIds);
          return;
        }
      }

      if (mod) return;

      switch (key) {
        case ' ':
          e.preventDefault();
          engine.togglePlay();
          break;
        case 'enter':
        case 'home':
          e.preventDefault();
          engine.seek(0);
          break;
        case 'r':
          e.preventDefault();
          void engine.record();
          break;
        case 'c':
          commit((d) => {
            d.loop.enabled = !d.loop.enabled;
          });
          break;
        case 'k':
          commit((d) => {
            d.metronome = !d.metronome;
          });
          break;
        case 'e':
          useStore.setState({ dockTab: s.dockTab === 'editor' ? null : 'editor', dockMaximized: false });
          break;
        case 'p':
          useStore.setState({ dockTab: s.dockTab === 'instrument' ? null : 'instrument', dockMaximized: false });
          break;
        case 'x':
          useStore.setState({ dockTab: s.dockTab === 'mixer' ? null : 'mixer', dockMaximized: false });
          break;
        case 'b':
          useStore.setState({ dockTab: s.dockTab === 'fx' ? null : 'fx', dockMaximized: false });
          break;
        case 'y':
          useStore.setState({ libraryOpen: !s.libraryOpen });
          break;
        case '?':
          openModal('help');
          break;
        case 'arrowleft':
          if (inTracks) {
            e.preventDefault();
            engine.seek(Math.max(0, Math.ceil(engine.position / bpb - 1.0001) * bpb));
          }
          break;
        case 'arrowright':
          if (inTracks) {
            e.preventDefault();
            engine.seek(Math.floor(engine.position / bpb + 1.0001) * bpb);
          }
          break;
        case ',':
          engine.seek(Math.max(0, Math.ceil(engine.position / bpb - 1.0001) * bpb));
          break;
        case '.':
          engine.seek(Math.floor(engine.position / bpb + 1.0001) * bpb);
          break;
        case 'm':
          if (s.selectedTrackId)
            commit((d) => {
              const t = d.tracks.find((x) => x.id === s.selectedTrackId);
              if (t) t.mute = !t.mute;
            });
          break;
        case 's':
          if (s.selectedTrackId)
            commit((d) => {
              const t = d.tracks.find((x) => x.id === s.selectedTrackId);
              if (t) t.solo = !t.solo;
            });
          break;
        case 'arrowup':
        case 'arrowdown':
          if (inTracks) {
            e.preventDefault();
            const i = p.tracks.findIndex((t) => t.id === s.selectedTrackId);
            const j = Math.max(0, Math.min(p.tracks.length - 1, i + (key === 'arrowup' ? -1 : 1)));
            if (p.tracks[j]) useStore.setState({ selectedTrackId: p.tracks[j].id });
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
