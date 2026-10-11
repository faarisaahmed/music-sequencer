import { lazy, Suspense, useEffect } from 'react';
import { openModal, useStore } from './state/store';
import { importMidiFile, importProjectFile } from './state/actions';
import { startAutosave } from './state/persistence';
import { startSafety } from './state/safety';
import HomeScreen from './ui/home/HomeScreen';
import { MenuHost } from './ui/common/menus';
import Toasts from './ui/common/Toasts';
import Tooltips from './ui/keys/Tooltips';
import ModalHost from './ui/modals/ModalHost';
import Tour from './ui/onboarding/Tour';
import { enableMidi } from './audio/midiInput';
import './App.css';
import { ChatPanel, JamStatusPill } from './ui/collab/CollabUI';
import { handleJamLinkOnStartup } from './ui/collab/jamLinks';
import { useCollab } from './collab/state';

// The studio loads in the background while Home is showing, so opening a song is instant.
const loadProject = () => import('./ui/ProjectScreen');
const ProjectScreen = lazy(loadProject);

function StudioLoading() {
  return (
    <div className="studio-loading">
      <div className="studio-loading-bar" />
    </div>
  );
}

let autosaveStarted = false;

export default function App() {
  const screen = useStore((s) => s.screen);
  useEffect(() => {
    if (!autosaveStarted) {
      autosaveStarted = true;
      startAutosave();
      startSafety();
      const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300));
      idle(() => void loadProject());
      // Home-screen shortcut "New Song".
      if (new URLSearchParams(location.search).get('new') === '1') {
        history.replaceState(null, '', location.pathname + location.hash);
        setTimeout(() => openModal('templates'), 300);
      }
      // Files opened with the installed app (desktop Chrome / Edge).
      const lq = (window as unknown as { launchQueue?: { setConsumer(cb: (p: { files: FileSystemFileHandle[] }) => void): void } }).launchQueue;
      lq?.setConsumer(async ({ files }) => {
        for (const h of files ?? []) {
          const f = await h.getFile();
          if (/\.midi?$/i.test(f.name)) await importMidiFile(f, false);
          else if (/\.json$/i.test(f.name)) await importProjectFile(f);
        }
      });
      void handleJamLinkOnStartup();
      // Pasting an invite link into an already-open tab.
      window.addEventListener('hashchange', () => {
        const m = /#jam=([A-Za-z0-9-]+)/.exec(location.hash);
        if (m && useCollab.getState().status === 'idle') void handleJamLinkOnStartup();
      });
      // Quietly connect MIDI devices if the browser has already granted access.
      if ('permissions' in navigator) {
        navigator.permissions
          .query({ name: 'midi' as PermissionName })
          .then((st) => {
            if (st.state === 'granted') void enableMidi(true);
          })
          .catch(() => {});
      }
    }
  }, []);
  return (
    <>
      {screen === 'home' ? (
        <HomeScreen />
      ) : (
        <Suspense fallback={<StudioLoading />}>
          <ProjectScreen />
        </Suspense>
      )}
      <ModalHost />
      <MenuHost />
      <Tour />
      <JamStatusPill />
      <ChatPanel />
      <Toasts />
      <Tooltips />
    </>
  );
}
