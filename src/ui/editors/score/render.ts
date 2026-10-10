// VexFlow rendering of a ScoreModel, returning geometry for hit-testing.
import { Accidental, Annotation, Articulation, Beam, Dot, Formatter, Modifier, Renderer, Stave, StaveConnector, StaveHairpin, StaveNote, StaveTie, Voice, BarlineType } from 'vexflow';
import type { KeySignature } from '../../../model/types';
import { LETTERS, diatonicIndex, durCode, dynamicOf, keyAlters, spell, vexKeySpec, type ScoreModel, type StaffKind } from './notation';

export interface HeadHit {
  x0: number;
  x1: number;
  y: number;
  noteId: string;
  pitch: number;
  t: number; // view-relative beat of the head's piece
  staff: number;
}

export interface MeasureGeom {
  index: number;
  x: number;
  w: number;
  noteX0: number;
  noteX1: number;
  /** (x, measure-relative beat) anchors for x→time interpolation */
  anchors: { x: number; t: number }[];
}

export interface StaffGeom {
  kind: StaffKind;
  topLineY: number; // y of the top staff line
  spacing: number;
}

export interface SystemGeom {
  y0: number;
  y1: number;
  staves: StaffGeom[];
  measures: MeasureGeom[];
}

export interface ScoreLayout {
  systems: SystemGeom[];
  heads: HeadHit[];
  width: number;
  height: number;
  bpb: number;
}

const MARGIN = 24;
const STAFF_GAP = 100;
const SYSTEM_GAP = 50;

const TOP_LINE_DIDX: Record<StaffKind, number> = { treble: 38, bass: 26 };
export function topLineDiatonic(kind: StaffKind): number {
  return TOP_LINE_DIDX[kind];
}

export interface RenderOpts {
  key: KeySignature;
  timeSig: [number, number];
  selected: Set<string>;
  firstBarNumber: number;
  showDynamics: boolean;
  title?: string;
}

function restKey(kind: StaffKind): string {
  return kind === 'treble' ? 'b/4' : 'd/3';
}

/** Estimated minimum width of a measure from its content density. */
function measureMinWidth(model: ScoreModel, m: number): number {
  let n = 1;
  for (const s of model.measures[m].staves) {
    let c = 0;
    for (const p of s.pieces) c += p.wholeMeasure ? 1.5 : p.dur < 0.5 ? 0.85 : 1;
    n = Math.max(n, c);
  }
  return Math.max(110, 60 + n * 32);
}

export function renderScore(container: HTMLDivElement, model: ScoreModel, widthPx: number, zoom: number, opts: RenderOpts): ScoreLayout {
  container.innerHTML = '';
  const logicalW = Math.max(400, widthPx / zoom);
  const fifths = keyAlters(opts.key).filter((a) => a !== 0).length;
  const grand = model.staves.length > 1;
  const titleSpace = opts.title ? 50 : 10;

  // ---- line breaking
  const avail = logicalW - MARGIN * 2;
  const headerW = (first: boolean) => 38 + fifths * 11 + 10 + (first ? 30 : 0) + (grand ? 14 : 0);
  const lines: { measures: number[]; widths: number[] }[] = [];
  let cur: { measures: number[]; widths: number[] } = { measures: [], widths: [] };
  let used = 0;
  model.measures.forEach((_, m) => {
    const first = cur.measures.length === 0;
    const w = measureMinWidth(model, m) + (first ? headerW(lines.length === 0) : 0);
    if (!first && used + w > avail) {
      lines.push(cur);
      cur = { measures: [], widths: [] };
      used = 0;
      const w2 = measureMinWidth(model, m) + headerW(false);
      cur.measures.push(m);
      cur.widths.push(w2);
      used += w2;
      return;
    }
    cur.measures.push(m);
    cur.widths.push(w);
    used += w;
  });
  if (cur.measures.length) lines.push(cur);
  for (const [i, line] of lines.entries()) {
    const total = line.widths.reduce((a, b) => a + b, 0);
    const isLast = i === lines.length - 1;
    if (!isLast || total > avail * 0.55) {
      const f = avail / total;
      line.widths = line.widths.map((w) => w * f);
    }
  }

  // Vertical layout: make room for ledger-line notes above/below/between staves.
  const sysLayout: { top: number; staffY: number[]; bottom: number }[] = [];
  let yCursor = titleSpace;
  for (const line of lines) {
    const ext = model.staves.map((kind) => {
      const topDI = TOP_LINE_DIDX[kind];
      let hi = -Infinity;
      let lo = Infinity;
      for (const m of line.measures)
        for (const p of model.measures[m].staves[model.staves.indexOf(kind)].pieces)
          for (const pitch of p.pitches) {
            const d = diatonicIndex(spell(pitch, opts.key));
            hi = Math.max(hi, d);
            lo = Math.min(lo, d);
          }
      return {
        above: hi === -Infinity ? 0 : Math.max(0, (hi - topDI) * 5 + 22 - 40),
        below: lo === Infinity ? 0 : Math.max(0, (topDI - 8 - lo) * 5 + 22 - 30),
      };
    });
    const staffY: number[] = [];
    let yy = yCursor + ext[0].above;
    staffY.push(yy);
    if (grand) {
      yy += STAFF_GAP + Math.max(ext[0].below, ext[1].above);
      staffY.push(yy);
    }
    const bottom = yy + 80 + ext[ext.length - 1].below + 10;
    sysLayout.push({ top: yCursor, staffY, bottom });
    yCursor = bottom + SYSTEM_GAP;
  }
  const height = yCursor + 10;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(logicalW * zoom, height * zoom);
  const ctx = renderer.getContext();
  ctx.scale(zoom, zoom);
  if (opts.title) {
    ctx.save();
    ctx.setFont('Georgia, serif', 20, 'bold');
    const tw = ctx.measureText(opts.title).width;
    ctx.fillText(opts.title, logicalW / 2 - tw / 2, 32);
    ctx.restore();
  }

  const layout: ScoreLayout = { systems: [], heads: [], width: logicalW * zoom, height: height * zoom, bpb: model.bpb };
  const timeSpec = `${opts.timeSig[0]}/${opts.timeSig[1]}`;
  const keySpec = vexKeySpec(opts.key);
  const baseAlters = keyAlters(opts.key);
  let beamGroups: ReturnType<typeof Beam.getDefaultBeamGroups> | undefined;
  try {
    beamGroups = Beam.getDefaultBeamGroups(timeSpec);
  } catch {
    beamGroups = undefined;
  }

  // Tie bookkeeping across measures/systems.
  const lastSeen = new Map<string, { note: StaveNote; index: number; system: number }>();
  const ties: { a: { note: StaveNote; index: number; system: number }; b: { note: StaveNote; index: number; system: number } }[] = [];
  // Dynamics: a new marking only when a level persists for 2+ onsets; one-off spikes become accents.
  const dynEvents = model.staves.map((_, si) => {
    const vels: number[] = [];
    for (const mm of model.measures)
      for (const p of mm.staves[si].pieces) {
        const on = p.rest ? [] : p.velocities.filter((_, i) => !p.tied[i]);
        if (on.length) vels.push(Math.max(...on));
      }
    const out: { mark: string | null; accent: boolean }[] = [];
    const head = vels.slice(0, 4).sort((a, b) => a - b);
    let level: string | null = head.length ? dynamicOf(head[Math.floor((head.length - 1) / 2)]) : null;
    vels.forEach((v, i) => {
      const d = dynamicOf(v);
      if (i === 0) {
        out.push({ mark: level, accent: d !== level && v > vels[Math.min(1, vels.length - 1)] + 0.1 });
      } else if (d !== level) {
        const next = i + 1 < vels.length ? dynamicOf(vels[i + 1]) : d;
        if (next === d) {
          level = d;
          out.push({ mark: d, accent: false });
        } else out.push({ mark: null, accent: v > vels[i + 1] + 0.1 });
      } else out.push({ mark: null, accent: false });
    });
    return out;
  });
  const onsetIdx = model.staves.map(() => 0);
  const hairpinRuns: { notes: StaveNote[]; vels: number[]; system: number }[][] = model.staves.map(() => []);
  let curRun: ({ notes: StaveNote[]; vels: number[]; system: number } | null)[] = model.staves.map(() => null);

  lines.forEach((line, li) => {
    const vl = sysLayout[li];
    let x = MARGIN;
    const sys: SystemGeom = { y0: vl.top, y1: vl.bottom, staves: [], measures: [] };
    let firstStaves: Stave[] = [];
    line.measures.forEach((m, k) => {
      const w = line.widths[k];
      const mm = model.measures[m];
      const staves = model.staves.map((kind, si) => {
        const st = new Stave(x, vl.staffY[si], w);
        if (k === 0) {
          st.addClef(kind).addKeySignature(keySpec);
          if (li === 0) st.addTimeSignature(timeSpec);
          if (si === 0) st.setMeasure(opts.firstBarNumber + m);
        }
        if (m === model.measures.length - 1) st.setEndBarType(BarlineType.END);
        st.setContext(ctx);
        return st;
      });
      if (k === 0) {
        firstStaves = staves;
        sys.staves = staves.map((st, si) => ({ kind: model.staves[si], topLineY: st.getYForLine(0), spacing: st.getSpacingBetweenLines() }));
      }
      staves.forEach((st) => {
        st.setNoteStartX(st.getNoteStartX() + (k === 0 ? 6 : 10));
        st.draw();
      });
      if (grand) {
        new StaveConnector(staves[0], staves[1]).setType('singleRight').setContext(ctx).draw();
        if (m === model.measures.length - 1) new StaveConnector(staves[0], staves[1]).setType('boldDoubleRight').setContext(ctx).draw();
      }

      // ---- notes
      const voices: Voice[] = [];
      const beams: Beam[] = [];
      const pieceNotes: { note: StaveNote; piece: (typeof mm.staves)[number]['pieces'][number]; staff: number }[] = [];
      mm.staves.forEach((sm, si) => {
        const kind = model.staves[si];
        const accState = new Map<string, number>();
        const notes: StaveNote[] = [];
        for (const piece of sm.pieces) {
          let sn: StaveNote;
          if (piece.rest) {
            sn = new StaveNote({
              keys: [piece.wholeMeasure || piece.dur >= 4 ? (kind === 'treble' ? 'd/5' : 'f/3') : restKey(kind)],
              duration: piece.wholeMeasure ? 'wr' : durCode(piece.dur) + 'r',
              clef: kind,
              align_center: piece.wholeMeasure,
            });
          } else {
            const spelled = piece.pitches.map((p) => spell(p, opts.key));
            const keys = spelled.map((s) => `${LETTERS[s.letter]}${s.alter === 1 ? '#' : s.alter === -1 ? 'b' : s.alter === 2 ? '##' : s.alter === -2 ? 'bb' : ''}/${s.octave}`);
            sn = new StaveNote({ keys, duration: durCode(piece.dur), clef: kind, auto_stem: true });
            spelled.forEach((s, idx) => {
              const k2 = `${s.letter}:${s.octave}`;
              const current = accState.has(k2) ? accState.get(k2)! : baseAlters[s.letter];
              if (!piece.tied[idx] && current !== s.alter) {
                const acc = s.alter === 1 ? '#' : s.alter === -1 ? 'b' : s.alter === 2 ? '##' : s.alter === -2 ? 'bb' : 'n';
                sn.addModifier(new Accidental(acc), idx);
              }
              accState.set(k2, s.alter);
              if (opts.selected.has(piece.noteIds[idx])) sn.setKeyStyle(idx, { fillStyle: '#1f7aff', strokeStyle: '#1f7aff' });
            });
            // Dynamics marking when the level changes (on note onsets).
            if (opts.showDynamics) {
              const onsetVels = piece.velocities.filter((_, i) => !piece.tied[i]);
              if (onsetVels.length) {
                const v = Math.max(...onsetVels);
                const ev = dynEvents[si][onsetIdx[si]++];
                if (ev?.mark) {
                  const ann = new Annotation(ev.mark).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
                  ann.setFont('Times New Roman, serif', 13, 'bold', 'italic');
                  sn.addModifier(ann, 0);
                }
                if (ev?.accent) sn.addModifier(new Articulation('a>').setPosition(Modifier.Position.ABOVE), 0);
                // Hairpin runs (monotonic velocity change over 3+ onsets)
                const run = curRun[si];
                if (run && run.system === li) {
                  const last = run.vels[run.vels.length - 1];
                  const dir = run.vels.length > 1 ? Math.sign(run.vels[1] - run.vels[0]) : Math.sign(v - last);
                  if (Math.abs(v - last) > 0.03 && Math.sign(v - last) === dir && dir !== 0) {
                    run.notes.push(sn);
                    run.vels.push(v);
                  } else {
                    if (run.notes.length >= 3) hairpinRuns[si].push(run);
                    curRun[si] = { notes: [sn], vels: [v], system: li };
                  }
                } else {
                  if (run && run.notes.length >= 3) hairpinRuns[si].push(run);
                  curRun[si] = { notes: [sn], vels: [v], system: li };
                }
              }
            }
          }
          if (/d/.test(durCode(piece.dur)) && !piece.wholeMeasure) Dot.buildAndAttach([sn], { all: true });
          sn.setStave(staves[si]);
          notes.push(sn);
          pieceNotes.push({ note: sn, piece, staff: si });
        }
        const voice = new Voice({ num_beats: opts.timeSig[0], beat_value: opts.timeSig[1] }).setMode(Voice.Mode.SOFT);
        voice.addTickables(notes);
        voices.push(voice);
        try {
          const stemmable = notes.filter((n) => !n.isRest());
          if (stemmable.length > 1) beams.push(...Beam.generateBeams(notes, { groups: beamGroups, beam_rests: false }));
        } catch {
          /* beaming is cosmetic */
        }
      });
      const noteX0 = staves[0].getNoteStartX();
      const noteX1 = staves[0].getNoteEndX();
      try {
        const fmt = new Formatter();
        voices.forEach((v) => fmt.joinVoices([v]));
        fmt.format(voices, Math.max(20, noteX1 - noteX0 - 14));
        voices.forEach((v, si) => v.draw(ctx, staves[si]));
        beams.forEach((b) => b.setContext(ctx).draw());
      } catch (e) {
        console.warn('score measure render failed', m, e);
      }

      // ---- geometry + ties
      const anchors: { x: number; t: number }[] = [];
      for (const { note, piece, staff } of pieceNotes) {
        let nx = 0;
        try {
          nx = note.getAbsoluteX();
        } catch {
          continue;
        }
        if (!piece.wholeMeasure) anchors.push({ x: nx, t: piece.start });
        if (piece.rest) continue;
        let ys: number[] = [];
        let hx0 = nx;
        let hx1 = nx + 12;
        try {
          ys = note.getYs();
          hx0 = note.getNoteHeadBeginX();
          hx1 = note.getNoteHeadEndX();
        } catch {
          /* noop */
        }
        piece.noteIds.forEach((id, idx) => {
          const entry = { note, index: idx, system: li };
          if (piece.tied[idx]) {
            const prev = lastSeen.get(id);
            if (prev) ties.push({ a: prev, b: entry });
          }
          lastSeen.set(id, entry);
          if (!piece.tied[idx] && ys[idx] !== undefined) {
            layout.heads.push({ x0: hx0, x1: hx1, y: ys[idx], noteId: id, pitch: piece.pitches[idx], t: mm.start + piece.start, staff });
          }
        });
      }
      anchors.sort((a, b) => a.x - b.x || a.t - b.t);
      sys.measures.push({ index: m, x, w, noteX0, noteX1, anchors });
      x += w;
    });
    if (grand && firstStaves.length === 2) {
      new StaveConnector(firstStaves[0], firstStaves[1]).setType('brace').setContext(ctx).draw();
      new StaveConnector(firstStaves[0], firstStaves[1]).setType('singleLeft').setContext(ctx).draw();
    }
    layout.systems.push(sys);
  });

  for (const t of ties) {
    try {
      if (t.a.system === t.b.system) {
        new StaveTie({ first_note: t.a.note, last_note: t.b.note, first_indices: [t.a.index], last_indices: [t.b.index] }).setContext(ctx).draw();
      } else {
        new StaveTie({ first_note: t.a.note, first_indices: [t.a.index], last_indices: [t.a.index] }).setContext(ctx).draw();
        new StaveTie({ last_note: t.b.note, first_indices: [t.b.index], last_indices: [t.b.index] }).setContext(ctx).draw();
      }
    } catch {
      /* noop */
    }
  }
  curRun.forEach((r, si) => r && r.notes.length >= 3 && hairpinRuns[si].push(r));
  curRun = [];
  for (const runs of hairpinRuns)
    for (const run of runs) {
      try {
        const up = run.vels[run.vels.length - 1] > run.vels[0];
        const hp = new StaveHairpin({ first_note: run.notes[0], last_note: run.notes[run.notes.length - 1] }, up ? StaveHairpin.type.CRESC : StaveHairpin.type.DECRESC);
        hp.setPosition(Modifier.Position.BELOW);
        hp.setRenderOptions({ height: 8, y_shift: -6, left_shift_px: -4, right_shift_px: 4 });
        hp.setContext(ctx).draw();
      } catch {
        /* noop */
      }
    }
  return layout;
}

/** Map an x within a measure to a measure-relative beat by interpolating anchors. */
export function xToBeat(mg: MeasureGeom, x: number, bpb: number): number {
  const pts = [{ x: mg.noteX0, t: 0 }, ...mg.anchors.filter((a) => a.x > mg.noteX0 - 1), { x: mg.noteX1, t: bpb }];
  // ensure monotonic
  const clean: { x: number; t: number }[] = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || (p.x > last.x + 0.5 && p.t > last.t + 1e-6)) clean.push(p);
  }
  if (x <= clean[0].x) return 0;
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1];
    const b = clean[i];
    if (x <= b.x) return a.t + ((x - a.x) / (b.x - a.x)) * (b.t - a.t);
  }
  return bpb;
}

/** Inverse of xToBeat. */
export function beatToX(mg: MeasureGeom, t: number, bpb: number): number {
  const pts = [{ x: mg.noteX0, t: 0 }, ...mg.anchors, { x: mg.noteX1, t: bpb }].sort((a, b) => a.t - b.t);
  const clean: { x: number; t: number }[] = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || (p.t > last.t + 1e-6 && p.x > last.x)) clean.push(p);
  }
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1];
    const b = clean[i];
    if (t <= b.t) return a.x + ((t - a.t) / (b.t - a.t)) * (b.x - a.x);
  }
  return mg.noteX1;
}
