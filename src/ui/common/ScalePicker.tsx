// Grouped picker for the key's scale / mode (Major, Minor, Dorian, Blues…).
import type { KeySignature, ScaleType } from '../../model/types';
import { SCALE_INFO, scaleType } from '../../model/music';

const GROUPS = ['Common', 'Modes', 'Minor variants', 'Pentatonic & blues'] as const;

export default function ScalePicker({ value, onChange }: { value: KeySignature; onChange: (scale: ScaleType) => void }) {
  const current = scaleType(value);
  return (
    <div className="scale-picker">
      {GROUPS.map((g) => (
        <div key={g} className="scale-group">
          <div className="scale-group-title">{g}</div>
          <div className="scale-btns">
            {SCALE_INFO.filter((s) => s.group === g).map((s) => (
              <button key={s.id} className={'scale-btn' + (current === s.id ? ' on' : '')} onClick={() => onChange(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
