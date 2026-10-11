// VexFlow rendering of a ScoreModel (one or many parts), returning geometry for hit-testing & overlays.
import {
  Accidental,
  Articulation,
  Beam,
  BarlineType,
  Dot,
  Formatter,
  GraceNote,
  GraceNoteGroup,
  Modifier,
  Renderer,
  Repetition,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
  VoltaType,
  SVGContext,
} from 'vexflow';
import type { Articulation as Artic, KeySignature, NavMark, Volta } from '../../../model/types';
import { LETTERS, durCode, keyAlters, spell, diatonicIndex, vexKeySpec, type Clef, type Piece, type ScoreModel } from './notation';
import { measureAt } from './notation';

// VexFlow measures text by inserting <text> into the live SVG and calling getBBox(), which forces a
// layout of the whole (growing) score for every new label. Measure with a canvas instead.
{
  const cache = (SVGContext as unknown as { measureTextCache: { measureImpl: (t: string, svg: SVGElement, a: Record<string, unknown>) => unknown } }).measureTextCache;
  let g: CanvasRenderingContext2D | null = null;
  cache.measureImpl = (text, _svg, a) => {
    g ??= document.createElement('canvas').getContext('2d');
    // Keep the unit VexFlow used (normally pt); unitless SVG sizes are px.
    const raw = String(a['font-size'] ?? '10pt');
    const num = parseFloat(raw) || 10;
    const unit = /[a-z%]+$/i.exec(raw)?.[0] ?? 'px';
    const px = unit === 'pt' ? (num * 4) / 3 : unit === 'em' ? num * 16 : num;
    if (g) g.font = `${a['font-style'] ?? 'normal'} ${a['font-weight'] ?? 'normal'} ${px}px ${a['font-family'] ?? 'Arial'}`;
    const width = g ? g.measureText(text).width : text.length * px * 0.6;
    return { x: 0, y: -px * 0.8, width, height: px };
  };
}

export interface HeadHit {
  x0: number;
  x1: number;
  y: number;
  noteId: string;
  key: string;
  pitch: number; // written pitch
  t: number; // display beat of the note onset
  t1: number; // display beat of the note end
  staff: number; // global staff index
  voice: 1 | 2;
  system: number;
  lyric?: string;
  /** A grace note (small, before its main note). */
  grace?: boolean;
}

/** One rhythmic element (a note/chord or a rest) of a voice — what Flat-style selection works on. */
export interface ElemHit {
  x0: number;
  x1: number;
  t: number; // display beat where it starts
  t1: number; // display beat where it ends
  staff: number; // global staff index
  voice: 1 | 2;
  system: number;
  measure: number;
  rest: boolean;
  /** A tied continuation of a note that started earlier. */
  cont: boolean;
  noteIds: string[];
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
  clef: Clef;
  topLineY: number; // y of the top staff line
  spacing: number;
  index: number; // global staff index
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
  elems: ElemHit[];
  width: number;
  height: number;
  bpb: number;
}

export interface ChordLabel {
  t: number; // display beat
  name: string;
}

const MARGIN = 24;
const SYSTEM_GAP = 46;

/** Diatonic index of the top staff line for each clef (as written). */
const TOP_LINE_DIDX: Record<Clef, number> = { treble: 38, treble8vb: 38, percussion: 38, bass: 26 };
export function topLineDiatonic(clef: Clef): number {
  return TOP_LINE_DIDX[clef];
}

export interface RenderOpts {
  /** Written key per part (index-aligned with model.parts). */
  partKeys: KeySignature[];
  timeSig: [number, number];
  firstBarNumber: number;
  showDynamics: boolean;
  showNames: boolean;
  title?: string;
  subtitle?: string;
  tempo?: number;
  /** Repeats, endings and jumps; `barOffset` is the song bar of the score's first measure. */
  form?: { marks: NavMark[]; voltas: Volta[]; barOffset: number };
  /** Tempo changes (display beats): drawn as ♩ = 90, or accel./rit. for gradual ones. */
  tempoMarks?: { t: number; bpm: number; ramp?: boolean; faster?: boolean }[];
  chords: ChordLabel[];
  /** Part labels may carry a transposition suffix ("Trumpet in B♭"). */
  partLabels: string[];
}

function vfClef(c: Clef): string {
  return c === 'treble8vb' ? 'treble' : c;
}

function restKey(clef: Clef, voice: number, voices: number): string {
  if (clef === 'bass') return voices > 1 ? (voice === 1 ? 'f/3' : 'f/2') : 'd/3';
  return voices > 1 ? (voice === 1 ? 'd/5' : 'f/4') : 'b/4';
}

const VF_ARTIC: Record<Artic, string> = { staccato: 'a.', accent: 'a>', tenuto: 'a-', marcato: 'a^', fermata: 'a@a' };

/** Estimated minimum width of a measure from its content density. */
function measureMinWidth(model: ScoreModel, m: number): number {
  let n = 1;
  for (const s of model.measures[m].staves) {
    for (const v of s.voices) {
      let c = 0;
      for (const p of v) c += p.wholeMeasure ? 1.5 : p.disp < 0.5 ? 0.85 : 1;
      n = Math.max(n, c);
    }
  }
  const lyricBoost = model.measures[m].staves.some((s) => s.voices.some((v) => v.some((p) => p.lyric && p.lyric.length > 3))) ? 1.25 : 1;
  return Math.max(110, (60 + n * 32) * lyricBoost);
}

interface Line {
  measures: number[];
  widths: number[];
  left: number;
}

/** Cheap layout pass: line breaks, system positions and cross-system tie bookkeeping (no VexFlow). */
export interface ScorePlan {
  model: ScoreModel;
  opts: RenderOpts;
  zoom: number;
  logicalW: number;
  /** Logical (unzoomed) height of the whole score. */
  height: number;
  lines: Line[];
  sysLayout: { top: number; staffY: number[]; bottom: number }[];
  multi: boolean;
  firstHeaderW: number;
  headerW: number;
  /** `${system}|${key}` of tied notes continuing into a later system / arriving from an earlier one. */
  crossOut: Set<string>;
  crossIn: Set<string>;
}

export function planScore(model: ScoreModel, widthPx: number, zoom: number, opts: RenderOpts): ScorePlan {
  const logicalW = Math.max(400, widthPx / zoom);
  const maxFifths = Math.max(0, ...opts.partKeys.map((k) => keyAlters(k).filter((a) => a !== 0).length));
  const hasGrand = model.parts.some((p) => p.clefs.length > 1);
  const multi = model.parts.length > 1;
  const nameW = (first: boolean) => {
    if (!opts.showNames) return 0;
    const labels = first ? opts.partLabels : model.parts.map((p) => p.abbr);
    return Math.min(180, Math.max(...labels.map((l) => l.length)) * 7.2 + 40);
  };
  const titleSpace = opts.title ? (opts.subtitle ? 74 : 56) : 10;

  // ---- line breaking
  const headerW = (first: boolean) => 38 + maxFifths * 11 + 10 + (first ? 30 : 0) + (hasGrand || multi ? 14 : 0);
  const lines: Line[] = [];
  let cur: Line = { measures: [], widths: [], left: MARGIN + nameW(true) };
  let used = 0;
  // Room for a new time signature where the meter changes.
  const sigW = (m: number) => {
    const a = model.measures[m - 1]?.sig;
    const b = model.measures[m].sig;
    return m > 0 && a && (a[0] !== b[0] || a[1] !== b[1]) ? 30 : 0;
  };
  model.measures.forEach((_, m) => {
    const avail = logicalW - MARGIN - cur.left;
    const first = cur.measures.length === 0;
    const w = measureMinWidth(model, m) + sigW(m) + (first ? headerW(lines.length === 0) : 0);
    if (!first && used + w > avail) {
      lines.push(cur);
      cur = { measures: [], widths: [], left: MARGIN + nameW(false) };
      used = 0;
      const w2 = measureMinWidth(model, m) + sigW(m) + headerW(false);
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
    const avail = logicalW - MARGIN - line.left;
    const total = line.widths.reduce((a, b) => a + b, 0);
    const isLast = i === lines.length - 1;
    if (!isLast || total > avail * 0.55) {
      const f = avail / total;
      line.widths = line.widths.map((w) => w * f);
    }
  }

  // ---- vertical layout: room for ledger notes, dynamics, lyrics and chord symbols.
  const staffHasLyrics = model.staves.map((_, si) => model.measures.some((mm) => mm.staves[si].voices.some((v) => v.some((p) => p.lyric))));
  const staffHasDyn = model.staves.map((ref) => opts.showDynamics && model.parts[ref.part].marks.some((mk) => mk.staff === ref.staff));
  const sysLayout: { top: number; staffY: number[]; bottom: number }[] = [];
  let yCursor = titleSpace;
  for (const line of lines) {
    const ext = model.staves.map((ref, si) => {
      const topDI = TOP_LINE_DIDX[ref.clef];
      let hi = -Infinity;
      let lo = Infinity;
      const key = opts.partKeys[ref.part];
      for (const m of line.measures)
        for (const v of model.measures[m].staves[si].voices)
          for (const p of v)
            for (const pitch of p.pitches) {
              const d = diatonicIndex(spell(pitch, key));
              hi = Math.max(hi, d);
              lo = Math.min(lo, d);
            }
      let above = hi === -Infinity ? 0 : Math.max(0, (hi - topDI) * 5 + 22 - 40);
      let below = lo === Infinity ? 0 : Math.max(0, (topDI - 8 - lo) * 5 + 22 - 30);
      if (staffHasDyn[si]) below += 18;
      if (staffHasLyrics[si]) below += 24;
      if (si === 0 && opts.chords.length) above += 22 + (hi > topDI - 2 ? 26 : 0);
      return { above, below };
    });
    const staffY: number[] = [];
    let yy = yCursor + ext[0].above + (yCursor === titleSpace && opts.tempo ? 24 : 0);
    staffY.push(yy);
    for (let si = 1; si < model.staves.length; si++) {
      const samePart = model.staves[si].part === model.staves[si - 1].part;
      yy += 40 + (samePart ? 52 : 62) + Math.max(ext[si - 1].below, ext[si].above);
      staffY.push(yy);
    }
    const bottom = yy + 40 + 40 + ext[ext.length - 1].below;
    sysLayout.push({ top: yCursor, staffY, bottom });
    yCursor = bottom + SYSTEM_GAP;
  }
  const height = yCursor + 10;

  // Ties that cross a line break are drawn as two halves, one per system.
  const crossOut = new Set<string>();
  const crossIn = new Set<string>();
  const lastSys = new Map<string, number>();
  lines.forEach((line, li) => {
    for (const m of line.measures)
      for (const sm of model.measures[m].staves)
        for (const v of sm.voices)
          for (const piece of v) {
            if (piece.rest) continue;
            piece.keys.forEach((key, idx) => {
              const prev = lastSys.get(key);
              if (piece.tied[idx] && prev !== undefined && prev !== li) {
                crossOut.add(prev + '|' + key);
                crossIn.add(li + '|' + key);
              }
              lastSys.set(key, li);
            });
          }
  });

  return { model, opts, zoom, logicalW, height, lines, sysLayout, multi, firstHeaderW: headerW(true), headerW: headerW(false), crossOut, crossIn };
}

/** Logical y-range owned by a system (boxes tile the page without gaps). */
export function systemBounds(plan: ScorePlan, li: number): { top: number; bottom: number } {
  const top = li === 0 ? 0 : plan.sysLayout[li].top - SYSTEM_GAP;
  const bottom = li === plan.lines.length - 1 ? plan.height : plan.sysLayout[li].bottom;
  return { top, bottom };
}

/** Layout with estimated geometry for every system; exact geometry/heads arrive as systems are drawn. */
export function emptyLayout(plan: ScorePlan): ScoreLayout {
  const { model, zoom } = plan;
  const systems: SystemGeom[] = plan.lines.map((line, li) => {
    const vl = plan.sysLayout[li];
    let x = line.left;
    const measures: MeasureGeom[] = line.measures.map((m, k) => {
      const w = line.widths[k];
      const head = k === 0 ? (li === 0 ? plan.firstHeaderW : plan.headerW) : 10;
      const g: MeasureGeom = { index: m, x, w, noteX0: x + Math.min(head, w * 0.5), noteX1: x + w - 10, anchors: [] };
      x += w;
      return g;
    });
    return {
      y0: vl.top,
      y1: vl.bottom,
      staves: model.staves.map((ref, si) => ({ clef: ref.clef, topLineY: vl.staffY[si] + 40, spacing: 10, index: si })),
      measures,
    };
  });
  return { systems, heads: [], elems: [], width: plan.logicalW * zoom, height: plan.height * zoom, bpb: model.bpb };
}

/** Render the whole score into one SVG (used for printing). */
export function renderScore(container: HTMLDivElement, model: ScoreModel, widthPx: number, zoom: number, opts: RenderOpts): ScoreLayout {
  container.innerHTML = '';
  const plan = planScore(model, widthPx, zoom, opts);
  const layout = emptyLayout(plan);
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(plan.logicalW * zoom, plan.height * zoom);
  const ctx = renderer.getContext();
  ctx.scale(zoom, zoom);
  for (let li = 0; li < plan.lines.length; li++) drawSystem(ctx, plan, li, layout);
  return layout;
}

/** Render one system into its own SVG inside `host` (absolute logical coordinates via the viewBox). */
export function renderSystemInto(host: HTMLDivElement, plan: ScorePlan, li: number, layout: ScoreLayout): void {
  const { top, bottom } = systemBounds(plan, li);
  const zoom = plan.zoom;
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(plan.logicalW * zoom, (bottom - top) * zoom);
  const ctx = renderer.getContext() as SVGContext;
  ctx.scale(zoom, zoom);
  ctx.setViewBox(0, top, plan.logicalW, bottom - top);
  (ctx.svg as SVGSVGElement).style.overflow = 'visible';
  drawSystem(ctx, plan, li, layout);
}

type DrawCtx = ReturnType<Renderer['getContext']>;

/** Draw system `li`, replacing its estimated geometry in `layout` and appending its noteheads. */
function drawSystem(ctx: DrawCtx, plan: ScorePlan, li: number, layout: ScoreLayout): void {
  const { model, opts, logicalW, multi } = plan;
  const line = plan.lines[li];
  if (li === 0 && opts.title) {
    ctx.save();
    ctx.setFont('Georgia, serif', 22, 'bold');
    const tw = ctx.measureText(opts.title).width;
    ctx.fillText(opts.title, logicalW / 2 - tw / 2, 34);
    if (opts.subtitle) {
      ctx.setFont('Georgia, serif', 12, 'italic');
      const sw = ctx.measureText(opts.subtitle).width;
      ctx.fillText(opts.subtitle, logicalW / 2 - sw / 2, 56);
    }
    ctx.restore();
  }

  // Beam groups follow each measure's meter (dotted quarters in 6/8, halves in 2/2…).
  const beamUnitOf = (sig: [number, number]) => (sig[1] === 8 && sig[0] % 3 === 0 && sig[0] > 3 ? 1.5 : sig[1] === 2 ? 2 : sig[1] === 8 ? 1.5 : 1);

  // Tie bookkeeping within this system (keyed by unique note instance).
  const lastSeen = new Map<string, { note: StaveNote; index: number; system: number }>();
  const ties: { a: { note: StaveNote; index: number; system: number }; b: { note: StaveNote; index: number; system: number } }[] = [];
  const tieIns: { note: StaveNote; index: number }[] = [];

  {
    const vl = plan.sysLayout[li];
    let x = line.left;
    const sys: SystemGeom = { y0: vl.top, y1: vl.bottom, staves: [], measures: [] };
    let firstStaves: Stave[] = [];
    line.measures.forEach((m, k) => {
      const w = line.widths[k];
      const mm = model.measures[m];
      const prevSig = m > 0 ? model.measures[m - 1].sig : null;
      const sigChanged = !prevSig || prevSig[0] !== mm.sig[0] || prevSig[1] !== mm.sig[1];
      const beamUnit = beamUnitOf(mm.sig);
      const staves = model.staves.map((ref, si) => {
        const st = new Stave(x, vl.staffY[si], w);
        const key = opts.partKeys[ref.part];
        if (k === 0) {
          if (ref.clef === 'treble8vb') st.addClef('treble', 'default', '8vb');
          else st.addClef(ref.clef);
          if (ref.clef !== 'percussion') st.addKeySignature(vexKeySpec(key));
          if (li === 0 || sigChanged) st.addTimeSignature(`${mm.sig[0]}/${mm.sig[1]}`);
          if (si === 0) st.setMeasure(opts.firstBarNumber + m);
        } else if (sigChanged) st.addTimeSignature(`${mm.sig[0]}/${mm.sig[1]}`);
        if (m === model.measures.length - 1) st.setEndBarType(BarlineType.END);
        if (opts.form) applyForm(st, opts.form, opts.form.barOffset + m, si === 0, m === model.measures.length - 1);
        st.setContext(ctx);
        return st;
      });
      if (k === 0) {
        firstStaves = staves;
        sys.staves = staves.map((st, si) => ({ clef: model.staves[si].clef, topLineY: st.getYForLine(0), spacing: st.getSpacingBetweenLines(), index: si }));
      }
      staves.forEach((st) => {
        st.setNoteStartX(st.getNoteStartX() + (k === 0 ? 6 : 10));
        st.draw();
      });
      // Barlines through each multi-staff part.
      for (const part of model.parts) {
        if (part.clefs.length < 2) continue;
        const a = staves[part.firstStaff];
        const b = staves[part.firstStaff + part.clefs.length - 1];
        new StaveConnector(a, b).setType('singleRight').setContext(ctx).draw();
        if (m === model.measures.length - 1) new StaveConnector(a, b).setType('boldDoubleRight').setContext(ctx).draw();
      }

      // ---- notes
      const allVoices: Voice[][] = [];
      const beams: Beam[] = [];
      const tuplets: Tuplet[] = [];
      const pieceNotes: { note: StaveNote; piece: Piece; staff: number; voice: 1 | 2 }[] = [];
      const graceDraws: { gns: GraceNote[]; refs: NonNullable<Piece['graces']>; staff: number; voice: 1 | 2; t: number }[] = [];
      mm.staves.forEach((sm, si) => {
        const ref = model.staves[si];
        const part = model.parts[ref.part];
        const key = opts.partKeys[ref.part];
        const baseAlters = ref.clef === 'percussion' ? [0, 0, 0, 0, 0, 0, 0] : keyAlters(key);
        const accState = new Map<string, number>();
        const nVoices = sm.voices.length;
        const staffVoices: Voice[] = [];
        sm.voices.forEach((pieces, vi) => {
          const voiceNo = (vi + 1) as 1 | 2;
          const notes: StaveNote[] = [];
          const stemDir = nVoices > 1 ? (vi === 0 ? 1 : -1) : undefined;
          for (const piece of pieces) {
            let sn: StaveNote;
            const code = durCode(piece.disp);
            if (piece.rest) {
              sn = new StaveNote({
                keys: [piece.wholeMeasure ? (ref.clef === 'bass' ? (nVoices > 1 && vi === 1 ? 'd/2' : 'f/3') : nVoices > 1 && vi === 1 ? 'f/4' : 'd/5') : restKey(ref.clef, voiceNo, nVoices)],
                duration: piece.wholeMeasure ? 'wr' : code + 'r',
                clef: vfClef(ref.clef),
                align_center: piece.wholeMeasure,
              });
            } else {
              const spellKey = ref.clef === 'percussion' ? { tonic: 0, mode: 'major' as const } : key;
              const spelled = piece.pitches.map((p) => spell(p, spellKey));
              const keys = spelled.map(
                (s, idx) =>
                  `${LETTERS[s.letter]}${s.alter === 1 ? '#' : s.alter === -1 ? 'b' : s.alter === 2 ? '##' : s.alter === -2 ? 'bb' : ''}/${s.octave}${piece.heads[idx] === 'x' ? '/x2' : ''}`,
              );
              sn = new StaveNote({ keys, duration: code, clef: vfClef(ref.clef), auto_stem: stemDir === undefined, stem_direction: stemDir });
              if (ref.clef !== 'percussion')
                spelled.forEach((s, idx) => {
                  const k2 = `${s.letter}:${s.octave}`;
                  const current = accState.has(k2) ? accState.get(k2)! : baseAlters[s.letter];
                  if (!piece.tied[idx] && current !== s.alter) {
                    const acc = s.alter === 1 ? '#' : s.alter === -1 ? 'b' : s.alter === 2 ? '##' : s.alter === -2 ? 'bb' : 'n';
                    sn.addModifier(new Accidental(acc), idx);
                  }
                  accState.set(k2, s.alter);
                });
              if (piece.graces?.length) {
              // Small slashed notes slurred into the main note.
              const gns = piece.graces.map((g) => {
                const sp = spell(g.wpitch, spellKey);
                const k = `${LETTERS[sp.letter]}${sp.alter === 1 ? '#' : sp.alter === -1 ? 'b' : sp.alter === 2 ? '##' : sp.alter === -2 ? 'bb' : ''}/${sp.octave}`;
                const gn = new GraceNote({ keys: [k], duration: piece.graces!.length > 1 ? '16' : '8', slash: piece.graces!.length === 1, clef: vfClef(ref.clef), auto_stem: false, stem_direction: 1 });
                if (sp.alter !== baseAlters[sp.letter]) gn.addModifier(new Accidental(sp.alter === 1 ? '#' : sp.alter === -1 ? 'b' : sp.alter === 2 ? '##' : sp.alter === -2 ? 'bb' : 'n'), 0);
                return gn;
              });
              const group = new GraceNoteGroup(gns, true);
              if (gns.length > 1) group.beamNotes();
              sn.addModifier(group, 0);
              graceDraws.push({ gns, refs: piece.graces, staff: si, voice: voiceNo, t: mm.start + piece.start });
            }
            const up = sn.getStemDirection() === 1;
              for (const a of piece.artic) {
                const art = new Articulation(VF_ARTIC[a]);
                if (a === 'fermata') art.setPosition(voiceNo === 2 ? Modifier.Position.BELOW : Modifier.Position.ABOVE);
                else art.setPosition(up ? Modifier.Position.BELOW : Modifier.Position.ABOVE);
                sn.addModifier(art, 0);
              }
            }
            // Voice-2 filler rests are hidden (as MuseScore does for a second voice) so held notes read cleanly.
            if (piece.rest && vi === 1) sn.setStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' });
            if (/d/.test(code) && !piece.wholeMeasure) Dot.buildAndAttach([sn], { all: true });
            sn.setStave(staves[si]);
            notes.push(sn);
            pieceNotes.push({ note: sn, piece, staff: si, voice: voiceNo });
          }
          // Tuplets must be created before the notes are added to a voice (they change tick counts).
          const groups = new Map<string, { notes: StaveNote[]; kind: string; allBeamable: boolean }>();
          pieces.forEach((p, i) => {
            if (!p.tuplet) return;
            const g = groups.get(p.tuplet) ?? { notes: [], kind: p.tupletKind ?? 't8', allBeamable: true };
            g.notes.push(notes[i]);
            if (p.rest || p.disp >= 1) g.allBeamable = false;
            groups.set(p.tuplet, g);
          });
          for (const g of groups.values()) {
            try {
              tuplets.push(
                new Tuplet(g.notes, {
                  num_notes: 3,
                  notes_occupied: 2,
                  bracketed: !g.allBeamable,
                  location: stemDir === -1 ? Tuplet.LOCATION_BOTTOM : Tuplet.LOCATION_TOP,
                }),
              );
            } catch {
              /* cosmetic */
            }
          }
          // Beams: group sub-beat notes by beat (or by tuplet).
          let group: StaveNote[] = [];
          let gKey = '';
          const flushBeam = () => {
            if (group.length >= 2) {
              try {
                beams.push(new Beam(group, stemDir === undefined));
              } catch {
                /* cosmetic */
              }
            }
            group = [];
          };
          pieces.forEach((p, i) => {
            const beamable = !p.rest && !p.wholeMeasure && p.disp < 1 - 1e-6;
            const key = p.tuplet ?? `b${Math.floor(p.start / beamUnit + 1e-6)}`;
            if (!beamable || key !== gKey) flushBeam();
            gKey = key;
            if (beamable) group.push(notes[i]);
          });
          flushBeam();
          const voice = new Voice({ num_beats: mm.sig[0], beat_value: mm.sig[1] }).setMode(Voice.Mode.SOFT);
          voice.addTickables(notes);
          staffVoices.push(voice);
        });
        allVoices.push(staffVoices);
        void part;
      });
      const noteX0 = staves[0].getNoteStartX();
      const noteX1 = staves[0].getNoteEndX();
      try {
        const fmt = new Formatter();
        allVoices.forEach((vs) => fmt.joinVoices(vs));
        fmt.format(allVoices.flat(), Math.max(20, noteX1 - noteX0 - 14));
        allVoices.forEach((vs, si) => vs.forEach((v) => v.draw(ctx, staves[si])));
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((t) => t.setContext(ctx).draw());
      } catch (e) {
        console.warn('score measure render failed', m, e);
      }

      // ---- geometry + ties
      const anchors: { x: number; t: number }[] = [];
      for (const { note, piece, staff, voice } of pieceNotes) {
        let nx = 0;
        try {
          nx = note.getAbsoluteX();
        } catch {
          continue;
        }
        if (!piece.wholeMeasure) anchors.push({ x: nx, t: piece.start });
        // Hidden voice-2 filler rests aren't selectable.
        if (!(piece.rest && voice === 2)) {
          let ex0 = nx;
          let ex1 = nx + 12;
          try {
            if (piece.rest) ex1 = nx + Math.max(10, note.getWidth());
            else {
              ex0 = note.getNoteHeadBeginX();
              ex1 = note.getNoteHeadEndX();
            }
          } catch {
            /* noop */
          }
          if (piece.wholeMeasure) {
            ex0 = noteX0;
            ex1 = noteX1;
          }
          layout.elems.push({
            x0: ex0,
            x1: ex1,
            t: mm.start + piece.start,
            t1: mm.start + piece.start + piece.dur,
            staff,
            voice,
            system: li,
            measure: m,
            rest: piece.rest,
            cont: !piece.rest && piece.tied.length > 0 && piece.tied.every(Boolean),
            noteIds: piece.noteIds,
          });
        }
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
        const part = model.parts[model.staves[staff].part];
        piece.keys.forEach((key, idx) => {
          const entry = { note, index: idx, system: li };
          if (piece.tied[idx]) {
            const prev = lastSeen.get(key);
            if (prev) ties.push({ a: prev, b: entry });
            else if (plan.crossIn.has(li + '|' + key)) tieIns.push({ note, index: idx });
          }
          lastSeen.set(key, entry);
          if (!piece.tied[idx] && ys[idx] !== undefined) {
            const qn = noteByKey(part).get(key);
            layout.heads.push({
              x0: hx0,
              x1: hx1,
              y: ys[idx],
              noteId: piece.noteIds[idx],
              key,
              pitch: piece.pitches[idx],
              t: mm.start + piece.start,
              t1: qn ? qn.e : mm.start + piece.start + piece.dur,
              staff,
              voice,
              system: li,
              lyric: piece.lyricNoteId === piece.noteIds[idx] ? piece.lyric : undefined,
            });
          }
        });
      }
      // Grace note heads are clickable too.
      for (const gd of graceDraws)
        gd.gns.forEach((gn, i) => {
          try {
            const y = gn.getYs()[0];
            const x0 = gn.getNoteHeadBeginX();
            const x1 = gn.getNoteHeadEndX();
            const ref = gd.refs[i];
            layout.heads.push({ x0, x1, y, noteId: ref.id, key: ref.key, pitch: ref.wpitch, t: gd.t, t1: gd.t, staff: gd.staff, voice: gd.voice, system: li, grace: true });
          } catch {
            /* not positioned */
          }
        });
      anchors.sort((a, b) => a.x - b.x || a.t - b.t);
      sys.measures.push({ index: m, x, w, noteX0, noteX1, anchors });
      x += w;
    });

    // ---- system decorations: connectors, part names
    if (firstStaves.length) {
      const top = firstStaves[0];
      const bottom = firstStaves[firstStaves.length - 1];
      if (firstStaves.length > 1) new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw();
      if (multi) {
        // Bracket the single-staff parts; brace the multi-staff ones.
        const singles = model.parts.filter((p) => p.clefs.length === 1);
        if (singles.length > 1) {
          const a = firstStaves[singles[0].firstStaff];
          const b = firstStaves[singles[singles.length - 1].firstStaff];
          new StaveConnector(a, b).setType('bracket').setContext(ctx).draw();
        }
      }
      for (const part of model.parts) {
        if (part.clefs.length > 1) {
          const a = firstStaves[part.firstStaff];
          const b = firstStaves[part.firstStaff + part.clefs.length - 1];
          new StaveConnector(a, b).setType('brace').setContext(ctx).draw();
          if (!multi) new StaveConnector(a, b).setType('singleLeft').setContext(ctx).draw();
        }
      }
      if (opts.showNames) {
        ctx.save();
        ctx.setFont('Georgia, serif', li === 0 ? 12 : 11, 'normal');
        model.parts.forEach((part, pi) => {
          const label = li === 0 ? opts.partLabels[pi] : part.abbr;
          const a = sys.staves[part.firstStaff];
          const b = sys.staves[part.firstStaff + part.clefs.length - 1];
          const midY = (a.topLineY + b.topLineY + b.spacing * 4) / 2;
          const tw = ctx.measureText(label).width;
          const right = line.left - (part.clefs.length > 1 ? 26 : multi ? 22 : 10);
          ctx.fillText(label, right - tw, midY + 4);
        });
        ctx.restore();
      }
    }

    // ---- tempo changes in this system
    if (opts.tempoMarks?.length && sys.staves[0]) {
      const top = sys.staves[0];
      let minY = top.topLineY;
      for (const h of layout.heads) if (h.system === li && h.staff === top.index) minY = Math.min(minY, h.y - (h.voice === 2 ? 0 : 34));
      const y = Math.min(top.topLineY - 24, minY - 10) - (opts.chords.length ? 22 : 0);
      for (const tk of opts.tempoMarks) {
        if (tk.t < 1e-6 && !tk.ramp) continue;
        const mm = measureAt(model, tk.t);
        const mg = sys.measures.find((g) => g.index === mm.index);
        if (!mg || tk.t > mm.start + mm.len) continue;
        const x = beatToX(mg, tk.t - mm.start, mm.len);
        ctx.save();
        ctx.setFont('Georgia, serif', 12.5, 'bold');
        ctx.fillText(tk.ramp ? `${tk.faster ? 'accel.' : 'rit.'} → ♩ = ${Math.round(tk.bpm)}` : `♩ = ${Math.round(tk.bpm)}`, x - 4, y);
        ctx.restore();
      }
    }

    // ---- tempo marking above the first system (drawn above chord symbols)
    if (li === 0 && opts.tempo && sys.staves[0]) {
      const top = sys.staves[0];
      let minY = top.topLineY;
      for (const h of layout.heads) if (h.system === 0 && h.staff === top.index) minY = Math.min(minY, h.y - (h.voice === 2 ? 0 : 34));
      const y = Math.min(top.topLineY - 24, minY - 10) - (opts.chords.length ? 22 : 0);
      ctx.save();
      ctx.setFont('Georgia, serif', 13, 'bold');
      ctx.fillText(`♩ = ${Math.round(opts.tempo)}`, line.left + 4, y);
      ctx.restore();
    }

    // ---- chord symbols above the top staff
    const beatX = (t: number): number | null => {
      const mm = measureAt(model, t);
      const mg = sys.measures.find((g) => g.index === mm.index);
      if (!mg) return null;
      return beatToX(mg, t - mm.start, mm.len);
    };
    if (opts.chords.length && sys.staves[0]) {
      ctx.save();
      ctx.setFont('Georgia, serif', 14, 'bold');
      const top = sys.staves[0];
      let minY = top.topLineY;
      for (const h of layout.heads) if (h.system === li && h.staff === top.index) minY = Math.min(minY, h.y - (h.voice === 2 ? 0 : 34));
      const cy = Math.min(top.topLineY - 24, minY - 10);
      for (const c of opts.chords) {
        const cx = beatX(c.t);
        if (cx === null) continue;
        ctx.fillText(c.name, cx - 2, cy);
      }
      ctx.restore();
    }

    // ---- dynamics & hairpins under each staff
    if (opts.showDynamics) {
      for (const sg of sys.staves) {
        const ref = model.staves[sg.index];
        const part = model.parts[ref.part];
        const y = sg.topLineY + sg.spacing * 4 + 26 + extBelowNotes(layout, sg, li);
        for (const mk of part.marks) {
          if (mk.staff !== ref.staff) continue;
          if (mk.kind === 'dyn') {
            const mx = beatX(mk.t);
            if (mx === null) continue;
            ctx.save();
            ctx.setFont('Times New Roman, serif', 15, 'bold italic');
            ctx.fillText(mk.value ?? '', mx - 4, y + 4);
            ctx.restore();
          } else {
            const firstM = sys.measures[0];
            const lastM = sys.measures[sys.measures.length - 1];
            const sysStart = model.measures[firstM.index].start;
            const sysEnd = model.measures[lastM.index].start + model.measures[lastM.index].len;
            const end = mk.end ?? mk.t + 1;
            if (end < sysStart || mk.t >= sysEnd) continue;
            const x0 = mk.t >= sysStart ? beatX(mk.t)! : firstM.noteX0 - 4;
            const x1 = end < sysEnd ? (beatX(end) ?? lastM.noteX1) + 10 : lastM.x + lastM.w - 4;
            if (x1 - x0 < 8) continue;
            const open = mk.kind === 'cresc';
            const h = 5;
            ctx.save();
            ctx.beginPath();
            if (open) {
              ctx.moveTo(x1, y - h);
              ctx.lineTo(x0, y);
              ctx.lineTo(x1, y + h);
            } else {
              ctx.moveTo(x0, y - h);
              ctx.lineTo(x1, y);
              ctx.lineTo(x0, y + h);
            }
            ctx.setLineWidth(1.2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // ---- lyrics on a common baseline per staff
    const sysHeads = layout.heads.filter((h) => h.system === li && h.lyric);
    if (sysHeads.length) {
      ctx.save();
      ctx.setFont('Georgia, serif', 13, 'normal');
      for (const sg of sys.staves) {
        const heads = sysHeads.filter((h) => h.staff === sg.index).sort((a, b) => a.t - b.t);
        if (!heads.length) continue;
        const dynExtra = opts.showDynamics && model.parts[model.staves[sg.index].part].marks.some((mk) => mk.staff === model.staves[sg.index].staff) ? 20 : 0;
        const y = sg.topLineY + sg.spacing * 4 + 34 + dynExtra + extBelowNotes(layout, sg, li);
        heads.forEach((h, i) => {
          const raw = h.lyric ?? '';
          const hyph = raw.endsWith('-');
          const text = hyph ? raw.slice(0, -1) : raw;
          const tw = ctx.measureText(text).width;
          const cx = (h.x0 + h.x1) / 2;
          ctx.fillText(text, cx - tw / 2, y);
          if (hyph) {
            const next = heads[i + 1];
            const nx = next ? (next.x0 + next.x1) / 2 - ctx.measureText((next.lyric ?? '').replace(/-$/, '')).width / 2 : cx + tw / 2 + 16;
            const hx = (cx + tw / 2 + nx) / 2;
            ctx.fillText('-', hx - 2, y);
          }
        });
      }
      ctx.restore();
    }
    layout.systems[li] = sys;
  }

  try {
    for (const t of ties)
      new StaveTie({ first_note: t.a.note, last_note: t.b.note, first_indices: [t.a.index], last_indices: [t.b.index] }).setContext(ctx).draw();
    for (const t of tieIns) new StaveTie({ last_note: t.note, first_indices: [t.index], last_indices: [t.index] }).setContext(ctx).draw();
    for (const [key, e] of lastSeen)
      if (plan.crossOut.has(li + '|' + key)) new StaveTie({ first_note: e.note, first_indices: [e.index], last_indices: [e.index] }).setContext(ctx).draw();
  } catch {
    /* cosmetic */
  }
}

/** Extra drop below the staff caused by low ledger notes in this system (so marks clear them). */
const partIndex = new WeakMap<object, Map<string, ScoreModel['parts'][number]['notes'][number]>>();

/** key → note lookup for a part (avoids a linear search per notehead). */
function noteByKey(part: ScoreModel['parts'][number]): Map<string, ScoreModel['parts'][number]['notes'][number]> {
  let m = partIndex.get(part);
  if (!m) {
    m = new Map();
    for (const n of part.notes) if (!m.has(n.key)) m.set(n.key, n);
    partIndex.set(part, m);
  }
  return m;
}

const headBuckets = new WeakMap<ScoreLayout, { n: number; map: Map<string, HeadHit[]> }>();

/** Heads grouped by system/staff, indexed incrementally as heads are added. */
function headsOf(layout: ScoreLayout, system: number, staff: number): HeadHit[] {
  let b = headBuckets.get(layout);
  if (!b) headBuckets.set(layout, (b = { n: 0, map: new Map() }));
  for (; b.n < layout.heads.length; b.n++) {
    const h = layout.heads[b.n];
    const k = h.system + ':' + h.staff;
    let list = b.map.get(k);
    if (!list) b.map.set(k, (list = []));
    list.push(h);
  }
  return b.map.get(system + ':' + staff) ?? [];
}

function extBelowNotes(layout: ScoreLayout, sg: StaffGeom, system: number): number {
  const bottomLine = sg.topLineY + sg.spacing * 4;
  let maxY = bottomLine;
  for (const h of headsOf(layout, system, sg.index))
    {
      // Voice-2 (stems down) and low notes carry stems below the head.
      const stemDown = h.voice === 2 || h.y < sg.topLineY + sg.spacing * 2 - 1;
      maxY = Math.max(maxY, h.y + (h.voice === 2 ? 30 : stemDown ? 0 : 6));
    }
  return Math.max(0, maxY - bottomLine - 4);
}

/** Map an x within a measure to a measure-relative beat by interpolating anchors. */
export function xToBeat(mg: MeasureGeom, x: number, bpb: number): number {
  const pts = [{ x: mg.noteX0, t: 0 }, ...mg.anchors.filter((a) => a.x > mg.noteX0 - 1), { x: mg.noteX1, t: bpb }];
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

/** Repeat barlines, ending brackets and Segno / Coda / D.S. / Fine on one measure's stave. */
function applyForm(st: Stave, form: NonNullable<RenderOpts['form']>, bar: number, top: boolean, last: boolean): void {
  const has = (k: NavMark['kind']) => form.marks.find((m) => m.kind === k && m.bar === bar);
  if (has('repeatStart')) st.setBegBarType(BarlineType.REPEAT_BEGIN);
  if (has('repeatEnd')) st.setEndBarType(BarlineType.REPEAT_END);
  else if (!last && (has('fine') || has('dc') || has('ds'))) st.setEndBarType(BarlineType.DOUBLE);
  if (!top) return;
  const v = form.voltas.find((x) => bar >= x.start && bar < x.end);
  if (v) {
    const one = v.end - v.start === 1;
    const type = one ? VoltaType.BEGIN_END : bar === v.start ? VoltaType.BEGIN : bar === v.end - 1 ? VoltaType.END : VoltaType.MID;
    st.setVoltaType(type, bar === v.start ? `${v.numbers.join(', ')}.` : '', -6);
  }
  const R = Repetition.type;
  if (has('segno')) st.setRepetitionType(R.SEGNO_LEFT);
  if (has('coda')) st.setRepetitionType(R.CODA_LEFT);
  if (has('toCoda')) st.setRepetitionType(R.TO_CODA);
  if (has('fine')) st.setRepetitionType(R.FINE);
  const j = has('dc') ?? has('ds');
  if (j) st.setRepetitionType(j.kind === 'dc' ? (j.until === 'fine' ? R.DC_AL_FINE : j.until === 'coda' ? R.DC_AL_CODA : R.DC) : j.until === 'fine' ? R.DS_AL_FINE : j.until === 'coda' ? R.DS_AL_CODA : R.DS);
}
