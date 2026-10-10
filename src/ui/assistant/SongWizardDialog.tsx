// Song Wizard: genre + mood + structure → a complete, editable song.
import { useMemo, useState } from 'react';
import { Wand2, Dices, Plus, X, ArrowUp, ArrowDown, Play, Square } from 'lucide-react';
import Modal from '../modals/Modal';
import './assistant.css';
import { closeModal, toast } from '../../state/store';
import { createNewProject } from '../../state/actions';
import { getAudioContext, resumeAudio } from '../../audio/context';
import { pitchClassName, keyUsesFlats } from '../../model/music';
import { chordName } from '../../model/accompaniment';
import { GENRES, MOODS, SECTION_COLORS, STRUCTURES, buildSong, suggestedBpm, suggestedMode, type Mood, type SectionKind, type SectionPlan, type WizardOptions } from './songBuilder';
import { renderProject } from '../../audio/export';

const KINDS: SectionKind[] = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Drop', 'Bridge', 'Outro'];
const TITLES = ['Golden Hour', 'Midnight Drive', 'Paper Planes', 'Neon Rain', 'Summer Static', 'Northern Lights', 'Slow Motion', 'Electric Heart', 'Velvet Sky', 'City Lights', 'Ocean Avenue', 'Daydreamer'];

let previewSrc: AudioBufferSourceNode | null = null;

export default function SongWizardDialog() {
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState<Mood>('Happy');
  const g = GENRES.find((x) => x.id === genre)!;
  const [tonic, setTonic] = useState(0);
  const [mode, setMode] = useState<'major' | 'minor'>(suggestedMode(g, 'Happy'));
  const [bpm, setBpm] = useState(suggestedBpm(g, 'Happy'));
  const [plan, setPlan] = useState<SectionPlan[]>(STRUCTURES[0].plan);
  const [title, setTitle] = useState(() => TITLES[Math.floor(Math.random() * TITLES.length)]);
  const [parts, setParts] = useState({ drums: true, bass: true, chords: true, pad: true, lead: true, arp: true });
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [busy, setBusy] = useState<null | 'preview' | 'create'>(null);
  const [playing, setPlaying] = useState(false);

  const pickGenre = (id: string, m: Mood = mood) => {
    const ng = GENRES.find((x) => x.id === id)!;
    setGenre(id);
    setMode(suggestedMode(ng, m));
    setBpm(suggestedBpm(ng, m));
  };
  const pickMood = (m: Mood) => {
    setMood(m);
    setMode(suggestedMode(g, m));
    setBpm(suggestedBpm(g, m));
  };

  const opts: WizardOptions = { title, genre, mood, key: { tonic, mode }, bpm, plan, parts, seed };
  const bars = plan.reduce((a, s) => a + s.bars, 0);
  const seconds = (bars * 4 * 60) / bpm;
  const flats = keyUsesFlats({ tonic, mode });

  // Show the chords the wizard will use for the first verse/chorus.
  const preview = useMemo(() => {
    try {
      const p = buildSong({ ...opts, parts: { drums: false, bass: false, chords: false, pad: false, lead: false, arp: false } });
      const out: { name: string; chords: string }[] = [];
      for (const s of p.sections ?? []) {
        if (out.some((o) => o.name === s.name)) continue;
        const cs = p.chords.filter((c) => c.beat >= s.start && c.beat < s.start + s.length).slice(0, 4);
        out.push({ name: s.name, chords: cs.map((c) => chordName(c, p.key)).join(' – ') });
      }
      return out;
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, mood, tonic, mode, plan, seed]);

  const stopPreview = () => {
    try {
      previewSrc?.stop();
    } catch {
      /* noop */
    }
    previewSrc = null;
    setPlaying(false);
  };

  const listen = async () => {
    if (playing) return stopPreview();
    setBusy('preview');
    try {
      await resumeAudio();
      const p = buildSong(opts);
      const chorus = p.sections?.find((s) => s.name === 'Chorus' || s.name === 'Drop') ?? p.sections?.[0];
      const start = chorus?.start ?? 0;
      const buf = await renderProject({ ...p, masterAutomation: [] }, { start, end: start + Math.min(chorus?.length ?? 32, 32), tail: 1.5 });
      const ctx = getAudioContext();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => setPlaying(false);
      src.start();
      previewSrc = src;
      setPlaying(true);
    } catch (e) {
      console.error(e);
      toast('Preview failed', 'error');
    }
    setBusy(null);
  };

  const create = async () => {
    stopPreview();
    setBusy('create');
    try {
      void resumeAudio();
      const p = buildSong(opts);
      closeModal();
      await createNewProject(p);
      toast(`“${p.name}” is ready — press Space to play`, 'success');
    } catch (e) {
      console.error(e);
      toast('Could not build the song', 'error');
      setBusy(null);
    }
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= plan.length) return;
    const n = [...plan];
    [n[i], n[j]] = [n[j], n[i]];
    setPlan(n);
  };

  return (
    <Modal
      title={
        <span className="row">
          <Wand2 size={17} style={{ color: 'var(--pink)' }} /> Song Wizard
        </span>
      }
      width={900}
      onClose={() => {
        stopPreview();
        closeModal();
      }}
      footer={
        <>
          <span className="faint" style={{ marginRight: 'auto', fontSize: 12 }}>
            {bars} bars · about {Math.floor(seconds / 60)}:{String(Math.round(seconds % 60)).padStart(2, '0')} · everything stays fully editable
          </span>
          <button className="btn" onClick={() => setSeed(Math.floor(Math.random() * 1e6))} title="New chords, melody and variations">
            <Dices size={15} /> Reroll
          </button>
          <button className="btn" onClick={() => void listen()} disabled={busy === 'create'}>
            {playing ? <Square size={13} fill="currentColor" /> : <Play size={14} fill="currentColor" />} {busy === 'preview' ? 'Rendering…' : playing ? 'Stop' : 'Preview chorus'}
          </button>
          <button className="btn primary" onClick={() => void create()} disabled={!!busy}>
            <Wand2 size={15} /> {busy === 'create' ? 'Building…' : 'Create Song'}
          </button>
        </>
      }
    >
      <div className="wiz">
        <div className="wiz-col">
          <div className="wiz-label">Genre</div>
          <div className="wiz-genres">
            {GENRES.map((x) => (
              <button key={x.id} className={'wiz-genre' + (genre === x.id ? ' on' : '')} onClick={() => pickGenre(x.id)}>
                <span className="wiz-emoji">{x.emoji}</span>
                {x.name}
              </button>
            ))}
          </div>
          <div className="wiz-label">Mood</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
            {MOODS.map((m) => (
              <button key={m.id} className={'wiz-pill' + (mood === m.id ? ' on' : '')} onClick={() => pickMood(m.id)}>
                {m.id}
              </button>
            ))}
          </div>
          <div className="wiz-grid">
            <div>
              <div className="wiz-label">Title</div>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} onKeyDown={(e) => e.stopPropagation()} />
            </div>
            <div>
              <div className="wiz-label">Key</div>
              <div className="row" style={{ gap: 4 }}>
                <select value={tonic} onChange={(e) => setTonic(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, pc) => (
                    <option key={pc} value={pc}>
                      {pitchClassName(pc, flats)}
                    </option>
                  ))}
                </select>
                <div className="seg">
                  {(['major', 'minor'] as const).map((m) => (
                    <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                      {m === 'major' ? 'Major' : 'Minor'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className="wiz-label">Tempo · {bpm} BPM</div>
              <input type="range" min={60} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
          <div className="wiz-label">Instruments</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
            {(
              [
                ['drums', 'Drums'],
                ['bass', 'Bass'],
                ['chords', 'Chords'],
                ['pad', 'Pad / Strings'],
                ['arp', 'Arpeggio'],
                ['lead', 'Melody'],
              ] as const
            )
              .filter(([k]) => (k !== 'arp' || g.arp) && (k !== 'pad' || g.pad))
              .map(([k, label]) => (
              <button key={k} className={'wiz-pill' + (parts[k] ? ' on' : '')} onClick={() => setParts({ ...parts, [k]: !parts[k] })}>
                {parts[k] ? '✓ ' : ''}
                {label}
              </button>
            ))}
          </div>
          {preview.length > 0 && (
            <>
              <div className="wiz-label">Chords</div>
              <div className="wiz-chords">
                {preview.map((p) => (
                  <div key={p.name} className="row">
                    <span className="wiz-sec-dot" style={{ background: SECTION_COLORS[p.name as SectionKind] }} />
                    <b style={{ width: 82 }}>{p.name}</b>
                    <span className="mono" style={{ color: '#ffe9a3' }}>
                      {p.chords}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="wiz-col narrow">
          <div className="wiz-label">Structure</div>
          <select
            value=""
            onChange={(e) => {
              const s = STRUCTURES.find((x) => x.name === e.target.value);
              if (s) setPlan(s.plan);
            }}
          >
            <option value="">Choose a template…</option>
            {STRUCTURES.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="wiz-plan">
            {plan.map((sp, i) => (
              <div key={i} className="wiz-sec" style={{ borderLeftColor: SECTION_COLORS[sp.kind] }}>
                <select value={sp.kind} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, kind: e.target.value as SectionKind } : x)))}>
                  {KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <select value={sp.bars} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, bars: Number(e.target.value) } : x)))}>
                  {[2, 4, 8, 12, 16].map((b) => (
                    <option key={b} value={b}>
                      {b} bars
                    </option>
                  ))}
                </select>
                <div className="spacer" />
                <button className="btn ghost icon sm" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp size={12} />
                </button>
                <button className="btn ghost icon sm" onClick={() => move(i, 1)} disabled={i === plan.length - 1}>
                  <ArrowDown size={12} />
                </button>
                <button className="btn ghost icon sm" onClick={() => setPlan(plan.filter((_, j) => j !== i))} disabled={plan.length === 1}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn sm" onClick={() => setPlan([...plan, { kind: 'Chorus', bars: 8 }])}>
            <Plus size={13} /> Add section
          </button>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>
            Repeated sections share chords & melody, like a real song. Choruses hit harder, bridges change things up, and the outro fades out.
          </div>
        </div>
      </div>
    </Modal>
  );
}
