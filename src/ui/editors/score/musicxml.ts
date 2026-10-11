// MusicXML (partwise 3.1) export of a ScoreModel: parts, staves, voices, triplets, ties, lyrics, articulations, dynamics.
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

export function toMusicXml(model: ScoreModel, title: string, partNames: string[], partKeys: KeySignature[], timeSig: [number, number], bpm: number): string {
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
      const mi = Math.floor(mk.t / model.bpb + 1e-9);
      marksByMeasure.set(mi, [...(marksByMeasure.get(mi) ?? []), mk]);
    }

    model.measures.forEach((m, mi) => {
      out.push(`<measure number="${mi + 1}">`);
      if (mi === 0) {
        out.push(`<attributes><divisions>${DIV}</divisions>`);
        if (!part.drums) out.push(`<key><fifths>${keyFifths(key)}</fifths><mode>${key.mode}</mode></key>`);
        out.push(`<time><beats>${timeSig[0]}</beats><beat-type>${timeSig[1]}</beat-type></time>`);
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
        const offset = Math.round((mk.t - mi * model.bpb) * DIV);
        const staffNo = mk.staff + 1;
        if (mk.kind === 'dyn' && mk.value)
          out.push(`<direction placement="below"><direction-type><dynamics><${mk.value}/></dynamics></direction-type><offset>${offset}</offset><staff>${staffNo}</staff></direction>`);
        else if (mk.kind !== 'dyn') {
          out.push(`<direction placement="below"><direction-type><wedge type="${mk.kind === 'cresc' ? 'crescendo' : 'diminuendo'}"/></direction-type><offset>${offset}</offset><staff>${staffNo}</staff></direction>`);
          const endT = mk.end ?? mk.t + 1;
          const endOff = Math.round((endT - mi * model.bpb) * DIV);
          out.push(`<direction placement="below"><direction-type><wedge type="stop"/></direction-type><offset>${endOff}</offset><staff>${staffNo}</staff></direction>`);
        }
      }
      let first = true;
      staffIdx.forEach((g, s) => {
        m.staves[g].voices.forEach((pieces, vi) => {
          if (!first) out.push(`<backup><duration>${Math.round(model.bpb * DIV)}</duration></backup>`);
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
      out.push('</measure>');
    });
    out.push('</part>');
  });
  out.push('</score-partwise>');
  return out.join('\n');
}
