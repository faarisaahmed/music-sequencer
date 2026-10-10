// "Songwriter" dock panel: chord track tools, smart accompaniment and melody generation.
import { useMemo, useState } from 'react';
import { Wand2, Sparkles, Music4, Shuffle, Plus, Dices, ListMusic } from 'lucide-react';
import { findRegion, openModal, toast, useStore } from '../../state/store';
import { beatsPerBar, keyName } from '../../model/music';
import { PROGRESSIONS, STYLES, chordName, suggestNext, type DrumStyle, type StyleId } from '../../model/accompaniment';
import { getPreset } from '../../audio/presets';
import { TrackIcon } from '../common/icons';
import { HSlider } from '../common/controls';
import {
  addChord,
  auditionChord,
  drumStyleForKit,
  familyOfTrack,
  fillProgression,
  generateForTrack,
  rangesFor,
  regenerateMelodyInRegion,
  styleForTrack,
  useAssistantUi,
} from './assistantActions';
import './assistant.css';

const DRUM_STYLES: { id: DrumStyle; name: string }[] = [
  { id: 'pop', name: 'Pop' },
  { id: 'rock', name: 'Rock' },
  { id: 'hiphop', name: 'Boom Bap' },
  { id: 'trap', name: 'Trap' },
  { id: 'lofi', name: 'Lo-Fi' },
  { id: 'house', name: 'House' },
  { id: 'rnb', name: 'R&B' },
  { id: 'synthwave', name: 'Synthwave' },
  { id: 'funk', name: 'Funk' },
  { id: 'country', name: 'Country' },
  { id: 'cinematic', name: 'Cinematic' },
  { id: 'ballad', name: 'Ballad' },
  { id: 'jazz', name: 'Jazz' },
];

export default function AssistantPanel() {
  const project = useStore((s) => s.project)!;
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const selectedRegionIds = useStore((s) => s.selectedRegionIds);
  const styles = useAssistantUi((s) => s.style);
  const [rangeId, setRangeId] = useState('song');
  const [progRange, setProgRange] = useState('song');
  const [barsPerChord, setBarsPerChord] = useState(1);
  const [energy, setEnergy] = useState(0.6);
  const [density, setDensity] = useState(0.55);
  const [drumStyles, setDrumStyles] = useState<Record<string, DrumStyle>>({});
  const ranges = useMemo(() => rangesFor(project), [project]);
  const range = ranges.find((r) => r.id === rangeId) ?? ranges[0];
  const pRange = ranges.find((r) => r.id === progRange) ?? ranges[0];
  const bpb = beatsPerBar(project.timeSig);
  const chords = project.chords ?? [];
  const last = [...chords].sort((a, b) => b.beat - a.beat)[0] ?? null;
  const track = project.tracks.find((t) => t.id === selectedTrackId && t.type !== 'audio') ?? project.tracks.find((t) => t.type !== 'audio');
  const family = track ? familyOfTrack(track) : 'piano';
  const style: StyleId = track ? styles[track.id] ?? styleForTrack(track) : 'piano-block';
  const drumStyle = track ? drumStyles[track.id] ?? drumStyleForKit(track.instrument) : 'pop';
  const sel = findRegion(project, selectedRegionIds[0] ?? null);

  const generate = () => {
    if (!track) return;
    const seed = Math.floor(Math.random() * 1e6);
    useAssistantUi.setState({ seed });
    const n = generateForTrack(track.id, track.type === 'drums' ? drumStyle : style, range.start, range.end, { energy, density, seed });
    if (n) toast(`Generated ${n} notes on “${track.name}”`, 'success');
  };

  const generateAll = () => {
    if (!chords.length) {
      toast('Fill the chord track first', 'error');
      return;
    }
    let total = 0;
    for (const t of project.tracks) {
      if (t.type === 'audio') continue;
      const st = t.type === 'drums' ? drumStyles[t.id] ?? drumStyleForKit(t.instrument) : styles[t.id] ?? styleForTrack(t);
      total += generateForTrack(t.id, st, range.start, range.end, { energy, density });
    }
    toast(`Generated ${total} notes across the band`, 'success');
  };

  const recommended = STYLES.filter((s) => s.family.includes(family));
  const others = STYLES.filter((s) => !s.family.includes(family));

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
                addChord(at, c.root, c.quality, bpb * barsPerChord);
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

      {/* ---------------------------------------------------- part generator */}
      <section className="as-card wide">
        <div className="as-head">
          <Wand2 size={16} style={{ color: 'var(--accent-2)' }} />
          <h4>Generate a Part</h4>
          <div className="spacer" />
          <select value={track?.id ?? ''} onChange={(e) => useStore.setState({ selectedTrackId: e.target.value })}>
            {project.tracks
              .filter((t) => t.type !== 'audio')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
        {!track ? (
          <div className="faint">Add an instrument or drum track first.</div>
        ) : (
          <>
            <div className="row as-track" style={{ color: track.color }}>
              <TrackIcon track={track} size={16} />
              <b style={{ color: 'var(--text)' }}>{track.name}</b>
              <span className="faint">{getPreset(track.instrument).name}</span>
            </div>
            <div className="as-styles">
              {track.type === 'drums'
                ? DRUM_STYLES.map((d) => (
                    <button key={d.id} className={'as-style' + (drumStyle === d.id ? ' on' : '')} onClick={() => setDrumStyles({ ...drumStyles, [track.id]: d.id })}>
                      <b>{d.name}</b>
                    </button>
                  ))
                : [...recommended, ...others].map((s, i) => (
                    <button
                      key={s.id}
                      className={'as-style' + (style === s.id ? ' on' : '') + (i >= recommended.length ? ' other' : '')}
                      title={s.description}
                      onClick={() => useAssistantUi.setState({ style: { ...styles, [track.id]: s.id } })}
                    >
                      <b>{s.name}</b>
                      <span>{s.description}</span>
                    </button>
                  ))}
            </div>
            <div className="row as-controls">
              <select value={rangeId} onChange={(e) => setRangeId(e.target.value)}>
                {ranges.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="label">Energy</span>
              <HSlider value={energy} min={0} max={1} width={90} onChange={setEnergy} undoable={false} />
              {style === 'melody' && track.type !== 'drums' && (
                <>
                  <span className="label">Busy</span>
                  <HSlider value={density} min={0} max={1} width={90} onChange={setDensity} undoable={false} />
                </>
              )}
              <div className="spacer" />
              <button className="btn primary" onClick={generate}>
                <Sparkles size={14} /> Generate
              </button>
              <button className="btn" title="Generate a different variation" onClick={generate}>
                <Dices size={14} /> Try another
              </button>
            </div>
          </>
        )}
      </section>

      {/* ---------------------------------------------------- whole song */}
      <section className="as-card">
        <div className="as-head">
          <Sparkles size={16} style={{ color: 'var(--pink)' }} />
          <h4>Whole Song</h4>
        </div>
        <button className="btn primary as-big" onClick={() => openModal('songWizard')}>
          <Wand2 size={15} /> Song Wizard…
        </button>
        <div className="faint as-note">Pick a genre and mood — get a complete arranged song with drums, bass, chords, pads and a melody.</div>
        <button className="btn as-big" onClick={generateAll} title="Generate every track over the chosen range using each track's style">
          <Shuffle size={14} /> Generate all tracks
        </button>
        <button
          className="btn as-big"
          disabled={!sel || sel.region.kind !== 'midi'}
          title="Replace the selected MIDI region with a new melody over its chords"
          onClick={() => {
            if (sel && regenerateMelodyInRegion(sel.region.id, density)) toast('New melody written', 'success');
          }}
        >
          <Music4 size={14} /> New melody in selected region
        </button>
      </section>
    </div>
  );
}
