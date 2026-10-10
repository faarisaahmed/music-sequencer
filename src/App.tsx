import { useEffect } from 'react';
import { useStore } from './state/store';
import { startAutosave } from './state/persistence';
import HomeScreen from './ui/home/HomeScreen';
import ProjectScreen from './ui/ProjectScreen';
import { MenuHost } from './ui/common/menus';
import Toasts from './ui/common/Toasts';
import ModalHost from './ui/modals/ModalHost';
import Tour from './ui/onboarding/Tour';
import { enableMidi } from './audio/midiInput';
import './App.css';
import { ChatPanel, JamStatusPill } from './ui/collab/CollabUI';
import { handleJamLinkOnStartup } from './ui/collab/jamLinks';
import { useCollab } from './collab/state';

let autosaveStarted = false;

export default function App() {
  const screen = useStore((s) => s.screen);
  useEffect(() => {
    if (!autosaveStarted) {
      autosaveStarted = true;
      startAutosave();
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
      {screen === 'home' ? <HomeScreen /> : <ProjectScreen />}
      <ModalHost />
      <MenuHost />
      <Tour />
      <JamStatusPill />
      <ChatPanel />
      <Toasts />
    </>
  );
}
