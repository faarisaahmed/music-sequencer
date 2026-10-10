// Guided tour: step definitions and state.
import { create } from 'zustand';
import { useStore, type DockTab } from '../../state/store';

export interface TourStep {
  /** CSS selector of the element to spotlight; omitted = centred card. */
  target?: string;
  title: string;
  body: string;
  /** Prepare the UI (e.g. open a panel) before showing the step. */
  before?: () => void;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export type TourId = 'home' | 'project';

const openDock = (tab: DockTab) => () => useStore.setState({ dockTab: tab, dockMaximized: false });

export const TOURS: Record<TourId, TourStep[]> = {
  home: [
    {
      title: 'Welcome to BandForge',
      body: 'A complete music studio in your browser. Make beats, record, write sheet music and export MP3s. This quick tour shows you around (about a minute).',
    },
    {
      target: '.quick-row',
      title: 'Templates & demo songs',
      body: 'Start from an empty song, a beat, a band or orchestra setup — or open a demo song to hear what is possible.',
      placement: 'bottom',
    },
    {
      target: '.home-header .btn.primary',
      title: 'New Song',
      body: 'Opens the template picker any time.',
      placement: 'bottom',
    },
    {
      target: '.home-header .btn:not(.primary)',
      title: 'Import',
      body: 'Bring in MIDI files or BandForge project files. You can also just drop files anywhere on this page.',
      placement: 'bottom',
    },
    {
      target: '.home-main section:last-of-type',
      title: 'My Songs',
      body: 'Everything saves automatically in this browser. Right-click a song to rename, duplicate, back it up or delete it.',
      placement: 'top',
    },
  ],
  project: [
    {
      title: 'Your studio',
      body: 'Here is where songs come together. Let’s take a 60-second look at the essentials. You can replay this tour from the Help (?) button.',
    },
    {
      target: '.tracks-area',
      title: 'Tracks',
      body: 'Each row is an instrument. Coloured blocks are regions: drag to move, drag edges to trim or extend, drag the top-right corner to loop, and double-click to edit. Right-click for cut, copy, split and more.',
      placement: 'top',
      before: () => useStore.setState({ dockTab: null }),
    },
    {
      target: 'button[title^="New Track"]',
      title: 'Add instruments',
      body: 'Add a software instrument, drums, a microphone recorder or a Sampler.',
      placement: 'bottom',
    },
    {
      target: '.transport',
      title: 'Play & record',
      body: 'Space plays, R records on the selected track, C toggles the yellow cycle loop. Recording works with your computer keyboard, a MIDI keyboard or a microphone.',
      placement: 'bottom',
    },
    {
      target: '.lcd',
      title: 'Tempo, key & time',
      body: 'Drag the tempo up or down, click the key to change it (with automatic transposing), or the time signature for 3/4, 6/8 and more.',
      placement: 'bottom',
    },
    {
      target: '.dock',
      title: 'Play an instrument',
      body: 'Click the keys, use chord strips and the arpeggiator, or turn on Typing to play with your computer keys (A S D F… for white keys). Press P to show or hide this panel.',
      placement: 'top',
      before: openDock('instrument'),
    },
    {
      target: '.dock',
      title: 'Edit notes',
      body: 'The editor shows the piano roll, sheet-music score or drum step sequencer for the selected region. Press E to toggle it.',
      placement: 'top',
      before: openDock('editor'),
    },
    {
      target: 'button[title^="Full Score"]',
      title: 'Sheet music',
      body: 'See and write the whole song as a full score — just like MuseScore. Notes you write appear in the piano roll too.',
      placement: 'bottom',
      before: () => useStore.setState({ dockTab: null }),
    },
    {
      target: 'button[title^="Chord Track"]',
      title: 'Chord Track',
      body: 'Sketch your harmony: write chords on the timeline, try common progressions and get ideas for the next chord. You write every note yourself.',
      placement: 'bottom',
    },
    {
      target: 'button[title^="Mixer"]',
      title: 'Mix',
      body: 'Balance levels, pan, EQ and effects. Smart Controls (B) has amps, reverb, delay and more for the selected track.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Sounds (Y)"]',
      title: 'Sounds',
      body: 'Browse and swap instruments and drum kits for the selected track.',
      placement: 'bottom',
    },
    {
      target: '.tb-export',
      title: 'Share your song',
      body: 'Export to MP3, WAV, MIDI, separate stems or a project backup.',
      placement: 'bottom',
    },
    {
      target: 'button[title^="Keyboard shortcuts"]',
      title: 'You’re ready!',
      body: 'Press ? any time for every shortcut, or to take this tour again. Have fun making music.',
      placement: 'bottom',
    },
  ],
};

const FLAG = (id: TourId) => `bandforge.tour.${id}.seen`;

export function tourSeen(id: TourId): boolean {
  try {
    return localStorage.getItem(FLAG(id)) === '1';
  } catch {
    return true;
  }
}

function markSeen(id: TourId): void {
  try {
    localStorage.setItem(FLAG(id), '1');
  } catch {
    /* private mode */
  }
}

interface TourState {
  tour: TourId | null;
  index: number;
  /** Dock tab to restore when the tour ends. */
  restoreDock: DockTab | null;
}

export const useTour = create<TourState>(() => ({ tour: null, index: 0, restoreDock: null }));

export function startTour(id: TourId): void {
  useTour.setState({ tour: id, index: 0, restoreDock: useStore.getState().dockTab });
  TOURS[id][0].before?.();
}

export function gotoStep(i: number): void {
  const { tour } = useTour.getState();
  if (!tour) return;
  const steps = TOURS[tour];
  if (i < 0) return;
  if (i >= steps.length) return endTour();
  steps[i].before?.();
  useTour.setState({ index: i });
}

export function endTour(): void {
  const { tour, restoreDock } = useTour.getState();
  if (!tour) return;
  markSeen(tour);
  useTour.setState({ tour: null, index: 0 });
  if (tour === 'project' && useStore.getState().screen === 'project') useStore.setState({ dockTab: restoreDock, dockMaximized: false });
}

/** Start a tour automatically the first time (not for automated browsers). */
export function maybeAutoStart(id: TourId): void {
  const forced = new URLSearchParams(location.search).has('tour');
  if (!forced && (tourSeen(id) || navigator.webdriver)) return;
  if (useTour.getState().tour) return;
  startTour(id);
}
