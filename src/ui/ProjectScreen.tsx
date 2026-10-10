import { useEffect, useRef } from 'react';
import { useStore, useTransport } from '../state/store';
import { getEngine } from '../audio/engine';
import { importAudioFile, importMidiFile } from '../state/actions';
import TopBar from './TopBar';
import TracksView from './tracks/TracksView';
import Dock from './Dock';
import LibraryPanel from './library/LibraryPanel';
import { useGlobalShortcuts } from './shortcuts';
import { useMusicalTyping } from './instruments/musicalTyping';
import { startDrag } from './common/drag';

export default function ProjectScreen() {
  const libraryOpen = useStore((s) => s.libraryOpen);
  const dockTab = useStore((s) => s.dockTab);
  const dockHeight = useStore((s) => s.dockHeight);
  const dockMax = useStore((s) => s.dockMaximized);
  const mainRef = useRef<HTMLDivElement>(null);
  useGlobalShortcuts();
  useMusicalTyping();

  // Level meters polling (~30fps) while the project is open.
  useEffect(() => {
    const engine = getEngine();
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 33) {
        last = t;
        useTransport.setState({ levels: engine.readLevels() });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="project"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Files dropped anywhere not handled by a more specific target.
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files)) {
          if (/\.midi?$/i.test(f.name)) void importMidiFile(f, true);
          else if (f.type.startsWith('audio') || /\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i.test(f.name)) void importAudioFile(f);
        }
      }}
    >
      <TopBar />
      <div className="workspace">
        {libraryOpen && <LibraryPanel />}
        <div className="main-col" ref={mainRef}>
          <div className="tracks-area" style={{ display: dockTab && dockMax ? 'none' : undefined }}>
            <TracksView />
          </div>
          {dockTab && (
            <>
              {!dockMax && (
                <div
                  className="dock-splitter"
                  onPointerDown={(e) => {
                    const h0 = dockHeight;
                    const total = mainRef.current?.clientHeight ?? 800;
                    startDrag(e, ({ dy }) => useStore.setState({ dockHeight: Math.max(160, Math.min(total - 120, h0 - dy)) }));
                  }}
                  onDoubleClick={() => useStore.setState({ dockMaximized: true })}
                />
              )}
              <div className="dock" style={dockMax ? { flex: 1 } : { height: dockHeight }}>
                <Dock />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
