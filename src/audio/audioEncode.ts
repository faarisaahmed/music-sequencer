// Audio file encoding with embedded song details (title, artist, album, cover…).
// Loaded on demand: the encoders are large.
import {
  AudioBufferSource,
  BufferTarget,
  canEncodeAudio,
  FlacOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  Quality,
  WavOutputFormat,
  type AudioCodec,
  type MetadataTags,
  type OutputFormat,
} from 'mediabunny';
import type { Project } from '../model/types';

export type AudioFormat = 'mp3' | 'm4a' | 'flac' | 'wav' | 'ogg';

export interface EncodeOptions {
  /** kbps for MP3 / M4A / OGG. */
  kbps?: number;
  /** Bit depth for WAV (32 = float) and FLAC. */
  bits?: 16 | 24 | 32;
  composer?: string;
}

// Where each container keeps the composer credit.
const COMPOSER_KEY: Record<AudioFormat, string> = { mp3: 'TCOM', wav: 'TCOM', m4a: '\u00a9wrt', flac: 'COMPOSER', ogg: 'COMPOSER' };

export const AUDIO_MIME: Record<AudioFormat, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

function dataUrlBytes(url: string): { data: Uint8Array; mimeType: string } | null {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  return { data, mimeType: m[1] };
}

/** Tags for a song, or for one stem of it (`part` names the track). */
export function songTags(p: Project, part?: string): MetadataTags {
  const i = p.info ?? {};
  const tags: MetadataTags = {
    title: part ? `${p.name} (${part})` : p.name,
    artist: i.artist || undefined,
    album: i.album || undefined,
    albumArtist: i.albumArtist || i.artist || undefined,
    genre: i.genre || undefined,
    date: i.year ? new Date(Date.UTC(i.year, 0, 1)) : undefined,
    trackNumber: i.trackNumber || undefined,
    tracksTotal: i.trackTotal || undefined,
    beatsPerMinute: Math.round(p.bpm),
    comment: i.comment || undefined,
  };
  const cover = i.cover ? dataUrlBytes(i.cover) : null;
  if (cover) tags.images = [{ ...cover, kind: 'coverFront', name: 'cover.jpg', description: 'Cover' }];
  return tags;
}

async function ensureEncoder(codec: AudioCodec): Promise<void> {
  if (await canEncodeAudio(codec)) return;
  if (codec === 'mp3') (await import('@mediabunny/mp3-encoder')).registerMp3Encoder();
  else if (codec === 'aac') (await import('@mediabunny/aac-encoder')).registerAacEncoder();
  else if (codec === 'flac') (await import('@mediabunny/flac-encoder')).registerFlacEncoder();
  if (!(await canEncodeAudio(codec))) throw new Error(`This browser can't encode ${codec.toUpperCase()}`);
}

/** Can this browser make the format? (OGG needs a built-in Opus encoder.) */
export async function canExport(fmt: AudioFormat): Promise<boolean> {
  if (fmt === 'ogg') return canEncodeAudio('opus');
  return true;
}

function slice(buf: AudioBuffer, from: number, to: number): AudioBuffer {
  const out = new AudioBuffer({ length: to - from, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(from, to), c);
  return out;
}

export async function encodeAudio(
  buf: AudioBuffer,
  fmt: AudioFormat,
  tags: MetadataTags,
  opts: EncodeOptions = {},
  onProgress?: (f: number) => void,
): Promise<Blob> {
  const kbps = opts.kbps ?? 256;
  const bits = opts.bits ?? 16;
  const lossy = (bitrate: number) => new Quality({ bitrate: bitrate * 1000, bitrateMode: 'constant' });
  let format: OutputFormat;
  let config: ConstructorParameters<typeof AudioBufferSource>[0];
  switch (fmt) {
    case 'mp3':
      format = new Mp3OutputFormat();
      config = { codec: 'mp3', quality: lossy(kbps) };
      break;
    case 'm4a':
      format = new Mp4OutputFormat({ fastStart: 'in-memory' });
      config = { codec: 'aac', quality: lossy(kbps) };
      break;
    case 'ogg':
      format = new OggOutputFormat();
      config = { codec: 'opus', quality: lossy(kbps), transform: { sampleRate: 48000 } };
      break;
    case 'flac':
      format = new FlacOutputFormat();
      config = { codec: 'flac', transform: { sampleFormat: bits === 16 ? 's16' : 's32' } };
      break;
    case 'wav':
      format = new WavOutputFormat({ metadataFormat: 'id3' });
      config = { codec: bits === 32 ? 'pcm-f32' : bits === 24 ? 'pcm-s24' : 'pcm-s16' };
      break;
  }
  await ensureEncoder(config.codec);
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new AudioBufferSource(config);
  output.addAudioTrack(source);
  output.setMetadataTags(opts.composer ? { ...tags, raw: { ...tags.raw, [COMPOSER_KEY[fmt]]: opts.composer } } : tags);
  await output.start();
  // Feed a few seconds at a time so progress can be shown and the page stays responsive.
  const step = buf.sampleRate * 4;
  for (let i = 0; i < buf.length; i += step) {
    await source.add(slice(buf, i, Math.min(buf.length, i + step)));
    onProgress?.(Math.min(1, (i + step) / buf.length));
  }
  source.close();
  await output.finalize();
  return new Blob([target.buffer!], { type: AUDIO_MIME[fmt] });
}
