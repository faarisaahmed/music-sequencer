// Keyboard instrument view: controls bar, optional chord strips, and the piano keyboard.
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Keyboard as KeyboardIcon, Music, ZoomIn, ZoomOut } from 'lucide-react';
import type { Track } from '../../model/types';
import { useStore } from '../../state/store';
import { chordPitches, diatonicChords, scaleOfKey, type ChordDef } from '../../model/music';
import { getPreset } from '../../audio/presets';
import { HSlider } from '../common/controls';
import Keyboard from './Keyboard';
import { press, release, setArp, setSustain, usePlayer, type ArpMode } from './player';
import { typingLegend } from './musicalTyping';
import { InstrumentPicker, MidiButton } from './Pickers';

const ARP_MODES: { id: ArpMode; label: string }[] = [
  { id: 'off', label: 'Arp Off' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'updown', label: 'Up & Down' },
  { id: 'random', label: 'Random' },
  { id: 'played', label: 'As Played' },
];

const ARP_RATES = [
  { label: '1/4', value: 1 },
  { label: '1/8', value: 0.5 },
  { label: '1/8T', value: 1 / 3 },
  { label: '1/16', value: 0.25 },
  { label: '1/16T', value: 1 / 6 },
  { label: '1/32', value: 0.125 },
];

const KEY_SIZES = [30, 40, 52, 66];

export default function KeyboardPanel({ track, compact = false }: { track: Track; compact?: boolean }) {
  const project = useStore((s) => s.project)!;
  const octave = useStore((s) => s.keyboardOctave);
  const velocity = useStore((s) => s.velocity);
  const typing = useStore((s) => s.musicalTyping);
  const player = usePlayer();
  const [mode, setMode] = useState<'glissando' | 'scroll'>('glissando');
  const [chords, setChords] = useState(false);
  const [sizeIdx, setSizeIdx] = useState(1);
  const preset = getPreset(track.instrument);
  const start = 12 * (octave + 3); // octave 1 → C3 (48)
  const scale = player.scaleLock ? new Set(scaleOfKey(project.key)) : null;

  const setOctave = (o: number) => useStore.setState({ keyboardOctave: Math.max(-2, Math.min(5, o)) });

  return (
    <div className="kp">
      <div className="kp-bar">
        <InstrumentPicker track={track} />
        <div className="kp-group">
          <button className="btn kp-btn icon" title="Octave down (Z)" onClick={() => setOctave(octave - 1)}>
            <ChevronLeft size={18} />
          </button>
          <div className="kp-oct mono">C{octave + 2}</div>
          <button className="btn kp-btn icon" title="Octave up (X)" onClick={() => setOctave(octave + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          className={'btn kp-btn sustain' + (player.sustain ? ' on' : '')}
          title="Sustain — click to latch, or hold Tab while musical typing"
          onClick={() => setSustain(!player.sustain)}
        >
          <span className="script">Sustain</span>
          <span className="kp-led" />
        </button>
        <div className="seg" title="Drag mode">
          <button className={mode === 'glissando' ? 'on' : ''} onClick={() => setMode('glissando')}>
            <span className="script">Glissando</span>
          </button>
          <button className={mode === 'scroll' ? 'on' : ''} onClick={() => setMode('scroll')}>
            <span className="script">Scroll</span>
          </button>
        </div>
        <button className={'btn kp-btn' + (player.scaleLock ? ' active' : '')} title="Scale lock: only play notes in the song key" onClick={() => usePlayer.setState({ scaleLock: !player.scaleLock })}>
          <Music size={14} /> Scale
        </button>
        <div className="kp-group">
          <select value={player.arp} onChange={(e) => setArp(e.target.value as ArpMode)} title="Arpeggiator" className={player.arp !== 'off' ? 'kp-arp-on' : ''}>
            {ARP_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {player.arp !== 'off' && (
            <>
              <select value={player.arpRate} onChange={(e) => usePlayer.setState({ arpRate: Number(e.target.value) })} title="Arpeggiator rate">
                {ARP_RATES.map((r) => (
                  <option key={r.label} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select value={player.arpOctaves} onChange={(e) => usePlayer.setState({ arpOctaves: Number(e.target.value) })} title="Octave range">
                {[1, 2, 3].map((o) => (
                  <option key={o} value={o}>
                    {o} oct
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="kp-group" title="Velocity (C / V while typing)">
          <span className="label">Vel</span>
          <HSlider value={velocity} min={0.1} max={1} width={70} undoable={false} defaultValue={0.8} onChange={(v) => useStore.setState({ velocity: v })} />
          <span className="mono faint" style={{ width: 24 }}>
            {Math.round(velocity * 127)}
          </span>
        </div>
        <div className="spacer" />
        {!compact && (
          <button className={'btn kp-btn' + (chords ? ' active' : '')} title="Chord strips" onClick={() => setChords(!chords)}>
            Chords
          </button>
        )}
        <div className="kp-group">
          <button className="btn kp-btn icon" title="Smaller keys" onClick={() => setSizeIdx(Math.max(0, sizeIdx - 1))}>
            <ZoomOut size={15} />
          </button>
          <button className="btn kp-btn icon" title="Larger keys" onClick={() => setSizeIdx(Math.min(KEY_SIZES.length - 1, sizeIdx + 1))}>
            <ZoomIn size={15} />
          </button>
        </div>
        <button
          className={'btn kp-btn' + (typing ? ' active' : '')}
          title="Musical Typing: play with your computer keyboard (A–' keys, Z/X octave, C/V velocity, Tab sustain)"
          onClick={() => useStore.setState({ musicalTyping: !typing })}
        >
          <KeyboardIcon size={15} /> Typing
        </button>
        <MidiButton />
      </div>
      {chords && !compact && <ChordStrips />}
      <div className="kp-keys">
        <Keyboard
          start={start}
          whiteWidth={KEY_SIZES[sizeIdx]}
          mode={mode}
          legend={typing ? typingLegend(octave) : undefined}
          dimOutside={scale}
          range={preset.range}
          onScrollOctaves={(o) => setOctave(useStore.getState().keyboardOctave + o)}
        />
      </div>
    </div>
  );
}

function ChordStrips() {
  const project = useStore((s) => s.project)!;
  const chords = diatonicChords(project.key);
  return (
    <div className="chords">
      {chords.map((c, i) => (
        <ChordStrip key={i} chord={c} />
      ))}
    </div>
  );
}

/** One GarageBand-style chord strip: 4 chord voicings on top, 2 bass notes below. */
function ChordStrip({ chord }: { chord: ChordDef }) {
  const vel = () => useStore.getState().velocity;
  const bassRoot = 36 + ((chord.root - 36 + 120) % 12);
  const zones: { label: string; pitches: number[]; bass?: boolean }[] = [
    { label: '', pitches: chordPitches(chord, 79) },
    { label: '', pitches: chordPitches(chord, 72) },
    { label: '', pitches: chordPitches(chord, 66) },
    { label: '', pitches: [...chordPitches(chord, 60), chordPitches(chord, 60)[0] + 12] },
    { label: 'bass', pitches: [bassRoot], bass: true },
    { label: '', pitches: [bassRoot + 7], bass: true },
  ];
  const [active, setActive] = useState<number | null>(null);
  const zoneAt = (x: number, y: number) => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-zone]') as HTMLElement | null;
    return el ? Number(el.dataset.zone) : null;
  };
  return (
    <div
      className="chord-strip"
      onPointerDown={(e) => {
        e.preventDefault();
        const src = `ch:${e.pointerId}`;
        const strip = e.currentTarget;
        let cur = zoneAt(e.clientX, e.clientY);
        if (cur !== null) {
          press(src, zones[cur].pitches, vel());
          setActive(cur);
        }
        const move = (ev: PointerEvent) => {
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          if (!el || !strip.contains(el)) return;
          const z = zoneAt(ev.clientX, ev.clientY);
          if (z !== null && z !== cur) {
            cur = z;
            press(src, zones[z].pitches, vel() * 0.9);
            setActive(z);
          }
        };
        const up = () => {
          release(src);
          setActive(null);
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    >
      <div className="chord-name">{chord.name}</div>
      {zones.map((z, i) => (
        <div key={i} data-zone={i} className={'chord-zone' + (z.bass ? ' bass' : '') + (active === i ? ' on' : '') + (i === 4 ? ' first-bass' : '')} />
      ))}
    </div>
  );
}
