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

let autosaveStarted = false;

export default function App() {
  const screen = useStore((s) => s.screen);
  useEffect(() => {
    if (!autosaveStarted) {
      autosaveStarted = true;
      startAutosave();
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
      <Toasts />
    </>
  );
}
