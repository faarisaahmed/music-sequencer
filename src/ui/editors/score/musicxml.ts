// MusicXML (partwise 3.1) export of a ScoreModel.
import type { KeySignature } from '../../../model/types';
import { LETTERS, keyFifths, spell, dynamicOf, type ScoreModel } from './notation';

const DIV = 8; // divisions per quarter (32nd = 1)

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

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}

export function toMusicXml(model: ScoreModel, title: string, partName: string, key: KeySignature, timeSig: [number, number]): string {
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  out.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  out.push('<score-partwise version="3.1">');
  out.push(`<work><work-title>${esc(title)}</work-title></work>`);
  out.push(`<part-list><score-part id="P1"><part-name>${esc(partName)}</part-name></score-part></part-list>`);
  out.push('<part id="P1">');
  const nStaves = model.staves.length;
  // Count pieces per note so ties can be started/stopped correctly.
  const appearances = new Map<string, number>();
  model.measures.forEach((m) => m.staves.forEach((s) => s.pieces.forEach((p) => p.noteIds.forEach((id) => appearances.set(id, (appearances.get(id) ?? 0) + 1)))));
  const seen = new Map<string, number>();
  let lastDyn = '';

  model.measures.forEach((m, mi) => {
    out.push(`<measure number="${mi + 1}">`);
    if (mi === 0) {
      out.push(`<attributes><divisions>${DIV}</divisions><key><fifths>${keyFifths(key)}</fifths><mode>${key.mode}</mode></key>`);
      out.push(`<time><beats>${timeSig[0]}</beats><beat-type>${timeSig[1]}</beat-type></time>`);
      if (nStaves > 1) out.push(`<staves>${nStaves}</staves>`);
      model.staves.forEach((k, i) => out.push(`<clef number="${i + 1}"><sign>${k === 'treble' ? 'G' : 'F'}</sign><line>${k === 'treble' ? 2 : 4}</line></clef>`));
      out.push('</attributes>');
    }
    m.staves.forEach((sm, si) => {
      if (si > 0) out.push(`<backup><duration>${Math.round(model.bpb * DIV)}</duration></backup>`);
      for (const p of sm.pieces) {
        const dur = Math.round(p.dur * DIV);
        const t = TYPE.find(([d]) => Math.abs(d - p.dur) < 1e-6);
        if (p.rest) {
          out.push(
            `<note><rest${p.wholeMeasure ? ' measure="yes"' : ''}/><duration>${dur}</duration><voice>${si + 1}</voice>${!p.wholeMeasure && t ? `<type>${t[1]}</type>${t[2] ? '<dot/>' : ''}` : ''}<staff>${si + 1}</staff></note>`,
          );
          continue;
        }
        const onset = p.velocities.filter((_, i) => !p.tied[i]);
        if (onset.length) {
          const d = dynamicOf(Math.max(...onset));
          if (d !== lastDyn) {
            lastDyn = d;
            out.push(`<direction placement="below"><direction-type><dynamics><${d}/></dynamics></direction-type><staff>${si + 1}</staff></direction>`);
          }
        }
        p.pitches.forEach((pitch, i) => {
          const s = spell(pitch, key);
          const id = p.noteIds[i];
          const n = (seen.get(id) ?? 0) + 1;
          seen.set(id, n);
          const total = appearances.get(id) ?? 1;
          const tieStop = p.tied[i];
          const tieStart = n < total;
          out.push(
            `<note>${i > 0 ? '<chord/>' : ''}<pitch><step>${LETTERS[s.letter].toUpperCase()}</step>${s.alter ? `<alter>${s.alter}</alter>` : ''}<octave>${s.octave}</octave></pitch>` +
              `<duration>${dur}</duration>${tieStop ? '<tie type="stop"/>' : ''}${tieStart ? '<tie type="start"/>' : ''}<voice>${si + 1}</voice>` +
              `${t ? `<type>${t[1]}</type>${t[2] ? '<dot/>' : ''}` : ''}<staff>${si + 1}</staff>` +
              (tieStop || tieStart ? `<notations>${tieStop ? '<tied type="stop"/>' : ''}${tieStart ? '<tied type="start"/>' : ''}</notations>` : '') +
              '</note>',
          );
        });
      }
    });
    if (mi === model.measures.length - 1) out.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
    out.push('</measure>');
  });
  out.push('</part></score-partwise>');
  return out.join('\n');
}
