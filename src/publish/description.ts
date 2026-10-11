// Builds the YouTube title, description (credits, chapters from sections) and tags from a song.
import type { Project } from '../model/types';
import { keyName } from '../model/music';
import { contentEndBeat } from '../model/defaults';
import { tempoOf } from '../model/timeline';

function stamp(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * YouTube chapters from the arrangement sections. YouTube only shows chapters when the first
 * is at 0:00, there are at least three, and each lasts 10 seconds or more.
 */
export function chapters(p: Project): { at: number; name: string }[] {
  const tm = tempoOf(p);
  const end = tm.sec(contentEndBeat(p));
  const secs = [...(p.sections ?? [])].filter((s) => tm.sec(s.start) < end - 1).sort((a, b) => a.start - b.start);
  if (!secs.length) return [];
  const out: { at: number; name: string }[] = [];
  for (const s of secs) {
    const at = tm.sec(s.start);
    const prev = out[out.length - 1];
    if (prev && at - prev.at < 10) continue; // too short to be its own chapter
    out.push({ at, name: s.name.trim() || 'Section' });
  }
  if (out[0].at > 0) {
    if (out[0].at >= 10) out.unshift({ at: 0, name: 'Intro' });
    else out[0].at = 0;
  }
  while (out.length && end - out[out.length - 1].at < 10) out.pop();
  return out.length >= 3 ? out : [];
}

export function videoTitle(p: Project): string {
  const artist = p.info?.artist?.trim();
  return (artist ? `${artist} - ${p.name}` : p.name).slice(0, 100);
}

export function videoDescription(p: Project, opts: { credit?: boolean } = {}): string {
  const i = p.info ?? {};
  const lines: string[] = [];
  lines.push(i.artist ? `"${p.name}" by ${i.artist}` : `"${p.name}"`);
  if (i.album) lines.push(`From ${i.album}${i.trackNumber ? ` (track ${i.trackNumber}${i.trackTotal ? ` of ${i.trackTotal}` : ''})` : ''}`);
  if (i.comment) lines.push('', i.comment);
  const ch = chapters(p);
  if (ch.length) {
    lines.push('', 'Chapters');
    for (const c of ch) lines.push(`${stamp(c.at)} ${c.name}`);
  }
  const credits: string[] = [];
  if (i.composer) credits.push(`Written by ${i.composer}`);
  if (i.artist && i.composer !== i.artist) credits.push(`Performed and produced by ${i.artist}`);
  if (credits.length) lines.push('', ...credits);
  const details = [i.genre, `${Math.round(p.bpm)} BPM`, keyName(p.key), `${p.timeSig[0]}/${p.timeSig[1]}`].filter(Boolean).join(' · ');
  lines.push('', details);
  if (i.artist) lines.push(`℗ ${i.year ?? new Date().getFullYear()} ${i.albumArtist || i.artist}`);
  if (opts.credit !== false) lines.push('', 'Made by hand in BandForge.');
  const hashtags = [i.genre, i.artist]
    .filter(Boolean)
    .map((t) => '#' + t!.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((t) => t.length > 1);
  if (hashtags.length) lines.push('', hashtags.join(' '));
  return trimBytes(lines.join('\n'), 5000);
}

export function videoTags(p: Project): string[] {
  const i = p.info ?? {};
  const raw = [i.artist, p.name, i.album, i.genre, i.genre && `${i.genre} music`, 'original music', i.composer, keyName(p.key), `${Math.round(p.bpm)} bpm`];
  const out: string[] = [];
  for (const t of raw) {
    const v = t?.replace(/[<>,]/g, '').trim();
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return fitTags(out);
}

/** YouTube's 500-character tag budget counts commas and quotes around tags with spaces. */
export function fitTags(tags: string[]): string[] {
  const out: string[] = [];
  let used = 0;
  for (const t of tags) {
    const cost = t.length + (/\s/.test(t) ? 2 : 0) + (out.length ? 1 : 0);
    if (used + cost > 500) break;
    out.push(t);
    used += cost;
  }
  return out;
}

/** The description limit is 5000 bytes, and < > aren't allowed. */
export function trimBytes(s: string, max: number): string {
  s = s.replace(/[<>]/g, '');
  const enc = new TextEncoder();
  if (enc.encode(s).length <= max) return s;
  while (enc.encode(s).length > max) s = s.slice(0, -1);
  return s;
}
