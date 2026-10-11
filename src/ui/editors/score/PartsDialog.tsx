// Parts: a separate, printable part for each player — transposed for their instrument, with
// multi-bar rests, title and composer — plus the full score, as one print job (or PDF).
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { closeModal, toast, useStore } from '../../../state/store';
import { download, safeFileName } from '../../../audio/export';
import type { Project } from '../../../model/types';
import { compressRests } from './notation';
import { renderScore, type RenderOpts } from './render';
import { buildSource, formFor, tempoMarksFor } from './source';
import { printDocs, type Paper, type PrintDoc } from './print';
import { toMusicXml } from './musicxml';
import { Toggle } from '../../common/controls';
import Modal from '../../modals/Modal';
import { meterOf } from '../../../model/timeline';
import './parts.css';

interface Prefs {
  transposed: boolean;
  multiRests: boolean;
  chords: boolean;
  dynamics: boolean;
  fullScore: boolean;
  paper: Paper;
}
const DEFAULTS: Prefs = { transposed: true, multiRests: true, chords: true, dynamics: true, fullScore: false, paper: 'a4' };
const KEY = 'bf.parts';

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Where multi-bar rests must stop in a part: a new one starts at sections, tempo and meter
 * changes; bars with repeats, endings or jumps stay on their own (and so does the bar after).
 */
function restBreaks(p: Project): { breaks: Set<number>; alone: Set<number> } {
  const breaks = new Set<number>();
  const alone = new Set<number>();
  const meter = meterOf(p);
  for (const m of p.navMarks ?? []) {
    alone.add(m.bar);
    breaks.add(m.bar + 1);
  }
  for (const v of p.voltas ?? []) for (let b = v.start; b < v.end; b++) alone.add(b);
  for (const c of p.tempoChanges ?? []) breaks.add(meter.barAt(c.beat).bar);
  for (const c of p.meterChanges ?? []) breaks.add(c.bar);
  for (const s of p.sections ?? []) breaks.add(meter.barAt(s.start).bar);
  return { breaks, alone };
}

function partDoc(p: Project, trackId: string, prefs: Prefs): PrintDoc | null {
  const src = buildSource(p, true, undefined, 0.25, 'auto', !prefs.transposed, [trackId]);
  if (!src) return null;
  const rb = restBreaks(p);
  const model = prefs.multiRests ? compressRests(src.model, rb.breaks, rb.alone) : src.model;
  const info = p.info ?? {};
  const label = src.labels[0] ?? '';
  const opts: RenderOpts = {
    partKeys: src.parts.map((x) => x.writtenKey),
    timeSig: p.timeSig,
    firstBarNumber: 1,
    showDynamics: prefs.dynamics,
    showNames: false,
    title: p.name,
    partName: label,
    composer: info.composer || info.artist || undefined,
    tempo: p.bpm,
    tempoMarks: tempoMarksFor(p, src),
    form: formFor(p, src),
    chords: prefs.chords ? src.chords : [],
    partLabels: src.labels,
  };
  return { model, opts, footer: `${p.name} · ${label}` };
}

function scoreDoc(p: Project, trackIds: string[], prefs: Prefs): PrintDoc | null {
  const src = buildSource(p, true, undefined, 0.25, 'auto', !prefs.transposed, trackIds);
  if (!src) return null;
  const info = p.info ?? {};
  return {
    model: src.model,
    footer: `${p.name} · Full score`,
    opts: {
      partKeys: src.parts.map((x) => x.writtenKey),
      timeSig: p.timeSig,
      firstBarNumber: 1,
      showDynamics: prefs.dynamics,
      showNames: true,
      title: p.name,
      partName: 'Full Score',
      composer: info.composer || info.artist || undefined,
      tempo: p.bpm,
      tempoMarks: tempoMarksFor(p, src),
      form: formFor(p, src),
      chords: prefs.chords ? src.chords : [],
      partLabels: src.labels,
    },
  };
}

export default function PartsDialog() {
  const p = useStore((s) => s.project)!;
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const tracks = useMemo(() => p.tracks.filter((t) => t.type !== 'audio' && t.regions.some((r) => r.kind === 'midi' && r.notes.length)), [p]);
  const [chosen, setChosen] = useState<string[]>(() => tracks.map((t) => t.id));
  const [preview, setPreview] = useState<string | null>(tracks[0]?.id ?? null);
  const previewRef = useRef<HTMLDivElement>(null);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });

  // A live look at the first page of the part you're looking at.
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !preview) return;
    const doc = partDoc(p, preview, prefs);
    el.innerHTML = '';
    if (!doc) return;
    try {
      renderScore(el, doc.model, 760, 0.5, doc.opts);
      // Fit the page preview to its frame.
      const svg = el.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.removeAttribute('height');
        svg.setAttribute('width', '100%');
      }
    } catch (e) {
      console.error('part preview failed', e);
    }
  }, [p, preview, prefs]);

  const print = () => {
    const docs: PrintDoc[] = [];
    if (prefs.fullScore) {
      const d = scoreDoc(p, chosen, prefs);
      if (d) docs.push(d);
    }
    for (const id of chosen) {
      const d = partDoc(p, id, prefs);
      if (d) docs.push(d);
    }
    if (!docs.length) return toast('Choose at least one part', 'error');
    if (!printDocs(`${p.name} — Parts`, docs, prefs.paper)) toast('Your browser blocked the print window. Allow pop-ups for this site', 'error');
  };

  const xml = () => {
    for (const id of chosen) {
      const src = buildSource(p, true, undefined, 0.25, 'auto', !prefs.transposed, [id]);
      if (!src) continue;
      const out = toMusicXml(src.model, p.name, src.labels, src.parts.map((x) => x.writtenKey), p.timeSig, p.bpm, tempoMarksFor(p, src), formFor(p, src));
      download(new Blob([out], { type: 'application/vnd.recordare.musicxml+xml' }), `${safeFileName(p.name)} - ${safeFileName(src.labels[0] ?? 'Part')}.musicxml`);
    }
  };

  return (
    <Modal
      title="Print Parts"
      width={900}
      footer={
        <>
          <span className="export-summary dim">
            {chosen.length} part{chosen.length === 1 ? '' : 's'}
            {prefs.fullScore ? ' + full score' : ''}
          </span>
          <button className="btn" onClick={closeModal}>
            Close
          </button>
          <button className="btn" disabled={!chosen.length} onClick={xml} title="One MusicXML file per part">
            <FileDown size={14} /> MusicXML
          </button>
          <button className="btn primary parts-print" disabled={!chosen.length && !prefs.fullScore} onClick={print} title="Opens the print dialog; choose Save as PDF for a PDF">
            <Printer size={14} /> Print / Save PDF
          </button>
        </>
      }
    >
      <div className="parts-body">
        <div className="parts-side">
          <div className="parts-head">Parts</div>
          <div className="parts-list">
            {tracks.length === 0 && <span className="dim">No tracks with notes yet.</span>}
            {tracks.map((t) => {
              const on = chosen.includes(t.id);
              return (
                <div key={t.id} className={'parts-item' + (preview === t.id ? ' on' : '')} onClick={() => setPreview(t.id)}>
                  <input
                    type="checkbox"
                    checked={on}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => setChosen(on ? chosen.filter((x) => x !== t.id) : [...chosen, t.id])}
                  />
                  <i style={{ background: t.color }} />
                  <span>{t.name}</span>
                </div>
              );
            })}
          </div>
          <div className="parts-opts">
            <label>
              <Toggle on={prefs.fullScore} onChange={(v) => update({ fullScore: v })} /> Full score first
            </label>
            <label title="Trumpet, clarinet, sax and horn parts in the key the player reads">
              <Toggle on={prefs.transposed} onChange={(v) => update({ transposed: v })} /> Transposed for the player
            </label>
            <label title="Long stretches of rest become one bar with the count">
              <Toggle on={prefs.multiRests} onChange={(v) => update({ multiRests: v })} /> Multi-bar rests
            </label>
            <label>
              <Toggle on={prefs.chords} onChange={(v) => update({ chords: v })} /> Chord symbols
            </label>
            <label>
              <Toggle on={prefs.dynamics} onChange={(v) => update({ dynamics: v })} /> Dynamics
            </label>
            <div className="seg export-seg">
              <button className={prefs.paper === 'a4' ? 'on' : ''} onClick={() => update({ paper: 'a4' })}>
                A4
              </button>
              <button className={prefs.paper === 'letter' ? 'on' : ''} onClick={() => update({ paper: 'letter' })}>
                Letter
              </button>
            </div>
          </div>
        </div>
        <div className="parts-preview">
          <div ref={previewRef} className="parts-page" />
        </div>
      </div>
    </Modal>
  );
}
