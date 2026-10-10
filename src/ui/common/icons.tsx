// Instrument / track icons.
import {
  AudioWaveform,
  Bell,
  Drum,
  Gamepad2,
  Guitar,
  KeyboardMusic,
  Mic,
  Music,
  Piano,
  Sparkles,
  Star,
  Users,
  Waves,
  Wind,
  Plus,
  Radio,
} from 'lucide-react';
import type { Track } from '../../model/types';
import { getPreset } from '../../audio/presets';

function Violin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 3.5l6 6" />
      <path d="M17.5 6.5L11 13" />
      <path d="M9.5 10.5c-1.5-1-3.8-.7-5 1-1 1.4-.7 2.8.3 3.6-1.3.8-1.6 2.4-.5 3.6 1.2 1.3 3 1.2 3.9-.1.9 1 2.4 1.2 3.6.2 1.7-1.3 1.9-3.6.7-5.1" />
      <path d="M7 15l2 2" />
    </svg>
  );
}

function Trumpet({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 11h12l5-4v10l-5-4H2z" />
      <path d="M6 11v-3M9 11v-3M12 11v-3" />
      <path d="M5 13c0 2 2 3 4 3h5" />
    </svg>
  );
}

function Harp({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 21V4c5 0 7 3 12 3 0 6-6 9-12 14z" />
      <path d="M9 5v12M12 6v8M15 7v4" />
    </svg>
  );
}

function Mallet({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="15" width="4" height="6" rx="1" />
      <rect x="8" y="13" width="4" height="8" rx="1" />
      <rect x="14" y="11" width="4" height="10" rx="1" />
      <path d="M20 3l-6 7" />
      <circle cx="20.5" cy="2.8" r="1.6" />
    </svg>
  );
}

export function IconFor({ name, size = 20 }: { name: string; size?: number }) {
  switch (name) {
    case 'piano':
      return <Piano size={size} />;
    case 'epiano':
    case 'organ':
      return <KeyboardMusic size={size} />;
    case 'guitar':
    case 'bass':
      return <Guitar size={size} />;
    case 'violin':
      return <Violin size={size} />;
    case 'harp':
      return <Harp size={size} />;
    case 'flute':
    case 'sax':
      return <Wind size={size} />;
    case 'trumpet':
      return <Trumpet size={size} />;
    case 'mallet':
      return <Mallet size={size} />;
    case 'bell':
      return <Bell size={size} />;
    case 'synth':
      return <Radio size={size} />;
    case 'pad':
      return <Waves size={size} />;
    case 'game':
      return <Gamepad2 size={size} />;
    case 'drums':
      return <Drum size={size} />;
    case 'sampler':
      return <AudioWaveform size={size} />;
    case 'mic':
      return <Mic size={size} />;
    case 'band':
      return <Users size={size} />;
    case 'star':
      return <Star size={size} />;
    case 'plus':
      return <Plus size={size} />;
    case 'sparkles':
      return <Sparkles size={size} />;
    default:
      return <Music size={size} />;
  }
}

export function trackIconName(t: Track): string {
  if (t.type === 'audio') return 'mic';
  return getPreset(t.instrument).icon;
}

export function TrackIcon({ track, size = 20 }: { track: Track; size?: number }) {
  return <IconFor name={trackIconName(track)} size={size} />;
}
