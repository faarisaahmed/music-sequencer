// "Install BandForge": the browser's own install prompt where there is one (Chrome, Edge,
// Android), and step-by-step Add to Home Screen help on iPhone and iPad.
import { useState, useSyncExternalStore } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { Sheet } from './Sheet';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

type Kind = 'prompt' | 'ios' | null;
function kind(): Kind {
  if (isStandalone()) return null;
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return null;
}

export function useInstall(): Kind {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    kind,
    () => null,
  );
}

export async function promptInstall(): Promise<void> {
  const e = deferred;
  if (!e) return;
  await e.prompt();
  await e.userChoice.catch(() => undefined);
  deferred = null;
  notify();
}

export function InstallButton({ className = 'btn', label = 'Install App' }: { className?: string; label?: string }) {
  const k = useInstall();
  const [help, setHelp] = useState(false);
  if (!k) return null;
  return (
    <>
      <button className={className + ' install-btn'} onClick={() => (k === 'prompt' ? void promptInstall() : setHelp(true))} title="Add BandForge to your home screen or dock. It opens full screen and works offline">
        <Download size={15} /> <span className="btn-label">{label}</span>
      </button>
      {help && <IOSInstallHelp onClose={() => setHelp(false)} />}
    </>
  );
}

export function IOSInstallHelp({ onClose }: { onClose: () => void }) {
  const ipad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return (
    <Sheet title="Add BandForge to your Home Screen" onClose={onClose}>
      <ol className="install-steps">
        <li>
          <span className="install-n">1</span>
          <span>
            Tap the <b>Share</b> button <Share size={16} className="install-glyph" /> {ipad ? 'at the top of Safari' : 'at the bottom of Safari'}.
          </span>
        </li>
        <li>
          <span className="install-n">2</span>
          <span>
            Scroll down and tap <b>Add to Home Screen</b> <SquarePlus size={16} className="install-glyph" />.
          </span>
        </li>
        <li>
          <span className="install-n">3</span>
          <span>
            Tap <b>Add</b>. BandForge opens full screen from your Home Screen, keeps your songs, and works without internet.
          </span>
        </li>
      </ol>
      <p className="install-note">Using Chrome on iPhone? Tap the Share button in its address bar, then Add to Home Screen.</p>
      <button className="btn primary install-done" onClick={onClose}>
        Got it
      </button>
    </Sheet>
  );
}
