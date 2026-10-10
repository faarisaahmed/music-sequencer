// Chord chooser: diatonic suggestions for the key, "what comes next" ideas, and any root/quality.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Trash2, Volume2 } from 'lucide-react';
import type { ChordQuality, KeySignature } from '../../model/types';
import { ALL_QUALITIES, QUALITY_LABEL, chordName, diatonic, rootName, suggestNext } from '../../model/accompaniment';
import { auditionChord } from './assistantActions';

const ROMAN_MAJ = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const ROMAN_MIN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

export interface PickedChord {
  root: number;
  quality: ChordQuality;
  bass?: number;
}

export default function ChordPicker({
  x,
  y,
  keySig,
  initial,
  prev,
  onPick,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  keySig: KeySignature;
  initial?: PickedChord;
  prev?: PickedChord | null;
  onPick: (c: PickedChord) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState(initial?.root ?? keySig.tonic);
  const [quality, setQuality] = useState<ChordQuality>(initial?.quality ?? (keySig.mode === 'minor' ? 'm' : ''));
  const [bass, setBass] = useState<number | undefined>(initial?.bass);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', close);
      window.addEventListener('keydown', key);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const pickNow = (c: PickedChord) => {
    auditionChord(c);
    onPick(c);
  };
  const romans = keySig.mode === 'major' ? ROMAN_MAJ : ROMAN_MIN;
  const next = suggestNext(prev ?? null, keySig);

  return (
    <div ref={ref} className="chord-picker" style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="cp-title">In the key</div>
      <div className="cp-diatonic">
        {romans.map((rn, d) => {
          const c = diatonic(keySig, d);
          const on = initial && c.root === initial.root && c.quality === initial.quality;
          return (
            <button key={d} className={'cp-chip big' + (on ? ' on' : '')} onClick={() => pickNow(c)} title={`Degree ${rn}`}>
              <b>{chordName(c, keySig)}</b>
              <span>{rn}</span>
            </button>
          );
        })}
      </div>
      <div className="cp-title">{prev ? `After ${chordName(prev, keySig)}, try` : 'Good places to start'}</div>
      <div className="cp-row">
        {next.map((c, i) => (
          <button key={i} className="cp-chip" onClick={() => pickNow(c)} title={c.why}>
            <b>{chordName(c, keySig)}</b>
            <span>{c.why}</span>
          </button>
        ))}
      </div>
      <div className="cp-title">Any chord</div>
      <div className="cp-roots">
        {Array.from({ length: 12 }, (_, pc) => (
          <button key={pc} className={'cp-root' + (root === pc ? ' on' : '')} onClick={() => setRoot(pc)}>
            {rootName(pc, keySig)}
          </button>
        ))}
      </div>
      <div className="cp-quals">
        {ALL_QUALITIES.map((q) => (
          <button key={q} className={'cp-root' + (quality === q ? ' on' : '')} onClick={() => setQuality(q)}>
            {QUALITY_LABEL[q] || 'maj'}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <span className="faint" style={{ fontSize: 11 }}>
          Bass
        </span>
        <select value={bass ?? ''} onChange={(e) => setBass(e.target.value === '' ? undefined : Number(e.target.value))} style={{ padding: '2px 4px' }}>
          <option value="">Root</option>
          {Array.from({ length: 12 }, (_, pc) => (
            <option key={pc} value={pc}>
              /{rootName(pc, keySig)}
            </option>
          ))}
        </select>
        <button className="btn ghost icon sm" title="Listen" onClick={() => auditionChord({ root, quality })}>
          <Volume2 size={14} />
        </button>
        <div className="spacer" />
        {onDelete && (
          <button className="btn ghost icon sm" title="Delete chord" onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        )}
        <button className="btn primary sm" onClick={() => pickNow({ root, quality, bass })}>
          {chordName({ root, quality, bass }, keySig)}
        </button>
      </div>
    </div>
  );
}
