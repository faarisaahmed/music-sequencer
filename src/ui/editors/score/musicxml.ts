// MusicXML (partwise 3.1) export of a ScoreModel: parts, staves, voices, triplets, ties, lyrics, articulations, dynamics.
import type { NavMark, Volta } from '../../../model/types';
import { measureAt } from './notation';
import type { KeySignature } from '../../../model/types';
import { C_MAJOR, LETTERS, keyFifths, spell, type Clef, type ScoreModel } from './notation';

const DIV = 24; // divisions per quarter (supports triplets)

const TYPE: [number, string, boolean][] = [
  [4, 'whole', false],
  [3, 'half', true],
  [2, 'half', false],
  [1.5, 'quarter', true],
  [1, 'quarter', false],
  [0.75, 'eighth', true],
  [0.5, 'eighth', false],
  [0.375, '16th', true],
  [0.25, '16th', false],
  [0.125, '32nd', false],
];

const ARTIC_XML: Record<string, string> = { staccato: '<staccato/>', accent: '<accent/>', tenuto: '<tenuto/>', marcato: '<strong-accent/>' };

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}

function clefXml(c: Clef, n: number): string {
  if (c === 'bass') return `<clef number="${n}"><sign>F</sign><line>4</line></clef>`;
  if (c === 'percussion') return `<clef number="${n}"><sign>percussion</sign></clef>`;
  if (c === 'treble8vb') return `<clef number="${n}"><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>`;
  return `<clef number="${n}"><sign>G</sign><line>2</line></clef>`;
}

/** Tempo markings after the start (display beats): sudden changes and accel./rit. */
export interface TempoMark {
  t: number;
  bpm: number;
  ramp?: boolean;
}

function tempoBefore(tempos: TempoMark[], base: number, t: number): number {
  let v = base;
  for (const x of [...tempos].sort((a, b) => a.t - b.t)) if (x.t < t - 1e-6) v = x.bpm;
  return v;
}

export function toMusicXml(
  model: ScoreModel,
  title: string,
  partNames: string[],
  partKeys: KeySignature[],
  _timeSig: [number, number],
  bpm: number,
  tempos: TempoMark[] = [],
  form?: { marks: NavMark[]; voltas: Volta[]; barOffset: number },
): string {
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  out.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  out.push('<score-partwise version="3.1">');
  out.push(`<work><work-title>${esc(title)}</work-title></work>`);
  out.push('<identification><encoding><software>BandForge</software></encoding></identification>');
  out.push('<part-list>');
  model.parts.forEach((p, i) => out.push(`<score-part id="P${i + 1}"><part-name>${esc(partNames[i] ?? p.name)}</part-name><part-abbreviation>${esc(p.abbr)}</part-abbreviation></score-part>`));
  out.push('</part-list>');

  model.parts.forEach((part, pi) => {
    out.push(`<part id="P${pi + 1}">`);
    const key = part.drums ? C_MAJOR : partKeys[pi];
    const nStaves = part.clefs.length;
    const staffIdx = Array.from({ length: nStaves }, (_, s) => part.firstStaff + s);
    // Count pieces per note instance so ties can be started/stopped correctly.
    const appearances = new Map<string, number>();
    model.measures.forEach((m) => staffIdx.forEach((g) => m.staves[g].voices.forEach((v) => v.forEach((p) => p.keys.forEach((k) => appearances.set(k, (appearances.get(k) ?? 0) + 1))))));
    const seen = new Map<string, number>();
    const marksByMeasure = new Map<number, typeof part.marks>();
    for (const mk of part.marks) {
      const mi = measureAt(model, mk.t).index;
      marksByMeasure.set(mi, [...(marksByMeasure.get(mi) ?? []), mk]);
    }

    model.measures.forEach((m, mi) => {
      out.push(`<measure number="${mi + 1}">`);
      const bar = (form?.barOffset ?? 0) + mi;
      const fm = (k: NavMark['kind']) => form?.marks.find((x) => x.kind === k && x.bar === bar);
      const volta = form?.voltas.find((v) => bar >= v.start && bar < v.end);
      // Left barline: forward repeat and/or an ending bracket starting here.
      if (fm('repeatStart') || (volta && volta.start === bar)) {
        out.push('<barline location="left">');
        if (fm('repeatStart')) out.push('<bar-style>heavy-light</bar-style><repeat direction="forward"/>');
        if (volta && volta.start === bar) out.push(`<ending number="${volta.numbers.join(', ')}" type="start">${volta.numbers.join(', ')}.</ending>`);
        out.push('</barline>');
      }
      if (pi === 0) {
        if (fm('segno')) out.push('<direction placement="above"><direction-type><segno/></direction-type><sound segno="s1"/></direction>');
        if (fm('coda')) out.push('<direction placement="above"><direction-type><coda/></direction-type><sound coda="c1"/></direction>');
      }
      const prevSig = mi > 0 ? model.measures[mi - 1].sig : null;
      if (mi > 0 && prevSig && (prevSig[0] !== m.sig[0] || prevSig[1] !== m.sig[1])) out.push(`<attributes><time><beats>${m.sig[0]}</beats><beat-type>${m.sig[1]}</beat-type></time></attributes>`);
      if (pi === 0)
        for (const tk of tempos.filter((x) => x.t >= m.start - 1e-6 && x.t < m.start + m.len - 1e-6 && x.t > 1e-6)) {
          const off = Math.round((tk.t - m.start) * DIV);
          const words = tk.ramp ? `<direction-type><words>${tk.bpm > (tempoBefore(tempos, bpm, tk.t) ?? bpm) ? 'accel.' : 'rit.'}</words></direction-type>` : '';
          out.push(`<direction placement="above">${words}<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(tk.bpm)}</per-minute></metronome></direction-type><offset>${off}</offset><sound tempo="${Math.round(tk.bpm)}"/></direction>`);
        }
      if (mi === 0) {
        out.push(`<attributes><divisions>${DIV}</divisions>`);
        if (!part.drums) out.push(`<key><fifths>${keyFifths(key)}</fifths><mode>${key.mode}</mode></key>`);
        out.push(`<time><beats>${m.sig[0]}</beats><beat-type>${m.sig[1]}</beat-type></time>`);
        if (nStaves > 1) out.push(`<staves>${nStaves}</staves>`);
        part.clefs.forEach((c, i) => out.push(clefXml(c, i + 1)));
        if (part.transpose && !part.drums && part.transpose % 12 !== 0) {
          const chromatic = -part.transpose;
          const diatonic = Math.round((chromatic * 7) / 12);
          out.push(`<transpose><diatonic>${diatonic}</diatonic><chromatic>${chromatic}</chromatic></transpose>`);
        }
        out.push('</attributes>');
        if (pi === 0) out.push(`<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(bpm)}</per-minute></metronome></direction-type><sound tempo="${Math.round(bpm)}"/></direction>`);
      }
      for (const mk of marksByMeasure.get(mi) ?? []) {
        const offset = Math.round((mk.t - m.start) * DIV);
        const staffNo = mk.staff + 1;
        if (mk.kind === 'dyn' && mk.value)
          out.push(`<direction placement="below"><direction-type><dynamics><${mk.value}/></dynamics></direction-type><offset>${offset}</offset><staff>${staffNo}</staff></direction>`);
        else if (mk.kind !== 'dyn') {
          out.push(`<direction placement="below"><direction-type><wedge type="${mk.kind === 'cresc' ? 'crescendo' : 'diminuendo'}"/></direction-type><offset>${offset}</offset><staff>${staffNo}</staff></direction>`);
          const endT = mk.end ?? mk.t + 1;
          const endOff = Math.round((endT - m.start) * DIV);
          out.push(`<direction placement="below"><direction-type><wedge type="stop"/></direction-type><offset>${endOff}</offset><staff>${staffNo}</staff></direction>`);
        }
      }
      let first = true;
      staffIdx.forEach((g, s) => {
        m.staves[g].voices.forEach((pieces, vi) => {
          if (!first) out.push(`<backup><duration>${Math.round(m.len * DIV)}</duration></backup>`);
          first = false;
          const voiceNo = s * 4 + vi + 1;
          let curTuplet: string | undefined;
          pieces.forEach((p, idx) => {
            const dur = Math.round(p.dur * DIV);
            const t = TYPE.find(([d]) => Math.abs(d - p.disp) < 1e-6);
            const tupStart = p.tuplet && p.tuplet !== curTuplet;
            const tupStop = p.tuplet && pieces[idx + 1]?.tuplet !== p.tuplet;
            curTuplet = p.tuplet;
            const timeMod = p.tuplet ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : '';
            const tupNot = (tupStart ? '<tuplet type="start" bracket="yes"/>' : '') + (tupStop ? '<tuplet type="stop"/>' : '');
            if (p.rest) {
              out.push(
                `<note><rest${p.wholeMeasure ? ' measure="yes"' : ''}/><duration>${dur}</duration><voice>${voiceNo}</voice>${!p.wholeMeasure && t ? `<type>${t[1]}</type>${t[2] ? '<dot/>' : ''}` : ''}${timeMod}<staff>${s + 1}</staff>${tupNot ? `<notations>${tupNot}</notations>` : ''}</note>`,
              );
              return;
            }
            // Grace notes come first, with no duration (slashed when there's just one).
            for (const g of p.graces ?? []) {
              const gs = spell(g.wpitch, key);
              out.push(
                `<note><grace${(p.graces ?? []).length === 1 ? ' slash="yes"' : ''}/><pitch><step>${LETTERS[gs.letter].toUpperCase()}</step>${gs.alter ? `<alter>${gs.alter}</alter>` : ''}<octave>${gs.octave}</octave></pitch><voice>${voiceNo}</voice><type>${(p.graces ?? []).length > 1 ? '16th' : 'eighth'}</type><staff>${s + 1}</staff></note>`,
              );
            }
            p.pitches.forEach((pitch, i) => {
              const sp = spell(pitch, key);
              const k = p.keys[i];
              const n = (seen.get(k) ?? 0) + 1;
              seen.set(k, n);
              const total = appearances.get(k) ?? 1;
              const tieStop = p.tied[i];
              const tieStart = n < total;
              const artic = i === 0 && !tieStop ? p.artic.filter((a) => ARTIC_XML[a]).map((a) => ARTIC_XML[a]).join('') : '';
              const fermata = i === 0 && p.artic.includes('fermata') ? '<fermata type="upright"/>' : '';
              const notations =
                (tieStop ? '<tied type="stop"/>' : '') + (tieStart ? '<tied type="start"/>' : '') + (i === 0 ? tupNot : '') + (artic ? `<articulations>${artic}</articulations>` : '') + fermata;
              const lyric =
                i === 0 && p.lyric && !tieStop
                  ? `<lyric number="1"><syllabic>${p.lyric.endsWith('-') ? 'begin' : 'single'}</syllabic><text>${esc(p.lyric.replace(/-$/, ''))}</text></lyric>`
                  : '';
              const head = p.heads[i] === 'x' ? '<notehead>x</notehead>' : '';
              const pitchXml = part.drums
                ? `<unpitched><display-step>${LETTERS[sp.letter].toUpperCase()}</display-step><display-octave>${sp.octave}</display-octave></unpitched>`
                : `<pitch><step>${LETTERS[sp.letter].toUpperCase()}</step>${sp.alter ? `<alter>${sp.alter}</alter>` : ''}<octave>${sp.octave}</octave></pitch>`;
              out.push(
                `<note>${i > 0 ? '<chord/>' : ''}${pitchXml}` +
                  `<duration>${dur}</duration>${tieStop ? '<tie type="stop"/>' : ''}${tieStart ? '<tie type="start"/>' : ''}<voice>${voiceNo}</voice>` +
                  `${t ? `<type>${t[1]}</type>${t[2] ? '<dot/>' : ''}` : ''}${timeMod}${head}${pieces.length && (m.staves[g].voices.length > 1) ? `<stem>${vi === 0 ? 'up' : 'down'}</stem>` : ''}<staff>${s + 1}</staff>` +
                  (notations ? `<notations>${notations}</notations>` : '') +
                  lyric +
                  '</note>',
              );
            });
          });
        });
      });
      if (mi === model.measures.length - 1) out.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
      if (form) {
        const bar = form.barOffset + mi;
        const fm = (k: NavMark['kind']) => form.marks.find((x) => x.kind === k && x.bar === bar);
        if (pi === 0) {
          if (fm('toCoda')) out.push('<direction placement="above"><direction-type><words>To Coda</words></direction-type><sound tocoda="c1"/></direction>');
          if (fm('fine')) out.push('<direction placement="below"><direction-type><words>Fine</words></direction-type><sound fine="yes"/></direction>');
          const j = fm('dc') ?? fm('ds');
          if (j) {
            const words = j.kind === 'dc' ? (j.until === 'fine' ? 'D.C. al Fine' : j.until === 'coda' ? 'D.C. al Coda' : 'D.C.') : j.until === 'fine' ? 'D.S. al Fine' : j.until === 'coda' ? 'D.S. al Coda' : 'D.S.';
            out.push(`<direction placement="below"><direction-type><words>${words}</words></direction-type><sound ${j.kind === 'dc' ? 'dacapo="yes"' : 'dalsegno="s1"'}/></direction>`);
          }
        }
        const volta = form.voltas.find((v) => bar >= v.start && bar < v.end);
        const rep = fm('repeatEnd');
        if (rep || (volta && volta.end - 1 === bar)) {
          out.push('<barline location="right">');
          if (rep) out.push('<bar-style>light-heavy</bar-style>');
          if (volta && volta.end - 1 === bar) out.push(`<ending number="${volta.numbers.join(', ')}" type="${rep ? 'stop' : 'discontinue'}"/>`);
          if (rep) out.push(`<repeat direction="backward"${(rep.times ?? 2) > 2 ? ` times="${rep.times}"` : ''}/>`);
          out.push('</barline>');
        }
      }
      out.push('</measure>');
    });
    out.push('</part>');
  });
  out.push('</score-partwise>');
  return out.join('\n');
}
