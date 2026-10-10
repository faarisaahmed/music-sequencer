// Drum icons for the step sequencer and drum pads.
import { Hand } from 'lucide-react';
import { drumFamily } from './drumColors';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function DrumIcon({ pitch, size = 22 }: { pitch: number; size?: number }) {
  const fam = drumFamily(pitch);
  if (pitch === 39) return <Hand size={size} />;
  if (fam === 'kick')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...S}>
        <circle cx="12" cy="11" r="7.5" />
        <circle cx="12" cy="11" r="2.2" />
        <path d="M7 20l2-3M17 20l-2-3M12 3.5V2" />
      </svg>
    );
  if (fam === 'hat' && (pitch === 49 || pitch === 51))
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...S}>
        <path d="M3 11c3-2.5 15-2.5 18 0-3 1.6-15 1.6-18 0z" />
        <path d="M12 9V7M12 12.5V21M9 21h6" />
      </svg>
    );
  if (fam === 'hat')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...S}>
        <path d="M4 9c2.5-2 13.5-2 16 0-2.5 1.3-13.5 1.3-16 0z" />
        <path d="M4 12.5c2.5 1.6 13.5 1.6 16 0" />
        <path d="M12 7V5M12 13.5V21" />
      </svg>
    );
  if (fam === 'tom')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...S}>
        <ellipse cx="12" cy="7" rx="7" ry="2.5" />
        <path d="M5 7v9c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V7" />
        <path d="M8 9.2v8M16 9.2v8" />
      </svg>
    );
  if (fam === 'snare')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...S}>
        <ellipse cx="12" cy="9" rx="8" ry="2.5" />
        <path d="M4 9v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V9" />
        <path d="M6 11l2 5M10 11.5l1 5.5M14 11.5l-1 5.5M18 11l-2 5" />
      </svg>
    );
  // percussion: crossed sticks
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S}>
      <path d="M4 4l14 14M20 4L6 18" />
      <circle cx="18.5" cy="18.5" r="1.8" />
      <circle cx="5.5" cy="18.5" r="1.8" />
    </svg>
  );
}
