// "Chord Track" dock panel: chord track tools — progressions and next-chord ideas.
import { meterOf } from '../../model/timeline';
import { useMemo, useState } from 'react';
import { Music4, Plus, ListMusic } from 'lucide-react';
import { toast, useStore } from '../../state/store';
import { keyName } from '../../model/music';
import { PROGRESSIONS, chordName, suggestNext } from '../../model/accompaniment';
import { addChord, auditionChord, fillProgression, rangesFor, useAssistantUi } from './assistantActions';
import './assistant.css';

export default function AssistantPanel() {
  const project = useStore((s) => s.project)!;
  const [progRange, setProgRange] = useState('song');
  const [barsPerChord, setBarsPerChord] = useState(1);
  const ranges = useMemo(() => rangesFor(project), [project]);
  const pRange = ranges.find((r) => r.id === progRange) ?? ranges[0];
  const meter = meterOf(project);
  const chords = project.chords ?? [];
  const last = [...chords].sort((a, b) => b.beat - a.beat)[0] ?? null;

  return (
    <div className="assistant">
      {/* ---------------------------------------------------- chord track */}
      <section className="as-card">
        <div className="as-head">
          <Music4 size={16} style={{ color: 'var(--cycle)' }} />
          <h4>Chord Track</h4>
          <span className="chip">{keyName(project.key)}</span>
          <div className="spacer" />
          <span className="faint" style={{ fontSize: 11 }}>
            {chords.length} chord{chords.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <select value={progRange} onChange={(e) => setProgRange(e.target.value)} className="grow">
            {ranges.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="seg" title="Chord length">
            {[1, 2].map((b) => (
              <button key={b} className={barsPerChord === b ? 'on' : ''} onClick={() => setBarsPerChord(b)}>
                {b} bar{b > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="as-progs">
          {PROGRESSIONS.filter((p) => p.mode === project.key.mode).map((p) => (
            <button
              key={p.name}
              className="as-prog"
              onClick={() => {
                const n = fillProgression(p.roman, pRange.start, pRange.end - pRange.start, barsPerChord);
                toast(`Added ${n} chords`, 'success');
              }}
              title={`Fill ${pRange.label} with ${p.roman}`}
            >
              <b>{p.name}</b>
              <span>{p.roman}</span>
            </button>
          ))}
        </div>
        <div className="as-sub">
          <ListMusic size={13} /> Next chord ideas {last ? <>after <b>{chordName(last, project.key)}</b></> : ''}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {suggestNext(last, project.key).map((c, i) => (
            <button
              key={i}
              className="cp-chip"
              title={c.why + ' — click to add after the last chord'}
              onClick={() => {
                const at = last ? last.beat + last.length : 0;
                addChord(at, c.root, c.quality, meter.addBars(at, barsPerChord) - at);
                auditionChord(c);
                useAssistantUi.setState({ showChords: true });
              }}
            >
              <b>
                <Plus size={10} /> {chordName(c, project.key)}
              </b>
              <span>{c.why}</span>
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}
