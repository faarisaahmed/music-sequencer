// Turns a rendered song into a video for YouTube: the album cover with the title and artist,
// either still or with a live spectrum and progress bar. Also draws the default thumbnail.
import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeVideo, Mp4OutputFormat, Output, Quality, WebMOutputFormat } from 'mediabunny';
import { ensureEncoder } from '../audio/audioEncode';
import type { Project } from '../model/types';

export type VideoStyle = 'still' | 'visualizer';

const W = 1920;
const H = 1080;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error("That file isn't an image this browser can open"));
    img.src = url;
  });
}

interface Art {
  title: string;
  artist: string;
  album: string;
  cover: HTMLImageElement | null;
  hue: number;
}

async function artOf(p: Project): Promise<Art> {
  return {
    title: p.name,
    artist: p.info?.artist ?? '',
    album: p.info?.album ?? '',
    cover: p.info?.cover ? await loadImage(p.info.cover) : null,
    hue: p.coverHue ?? 210,
  };
}

/** Background, blurred cover (or a gradient) and the cover square. Returns the text area. */
function drawBase(g: CanvasRenderingContext2D, w: number, h: number, art: Art): { x: number; y: number; w: number; cover: number } {
  g.save();
  if (art.cover) {
    g.filter = `blur(${Math.round(w / 40)}px) brightness(0.45) saturate(1.2)`;
    const s = Math.max(w, h) * 1.15;
    g.drawImage(art.cover, (w - s) / 2, (h - s) / 2, s, s);
    g.filter = 'none';
  } else {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, `hsl(${art.hue} 65% 32%)`);
    grd.addColorStop(1, `hsl(${(art.hue + 50) % 360} 70% 14%)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(0,0,0,0.05)');
  shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  g.restore();

  const cover = Math.round(h * 0.56);
  const cx = Math.round(w * 0.09);
  const cy = Math.round((h - cover) / 2 - h * 0.04);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = h * 0.05;
  g.shadowOffsetY = h * 0.015;
  g.fillStyle = `hsl(${art.hue} 50% 25%)`;
  roundRect(g, cx, cy, cover, cover, h * 0.012);
  g.fill();
  g.restore();
  g.save();
  roundRect(g, cx, cy, cover, cover, h * 0.012);
  g.clip();
  if (art.cover) g.drawImage(art.cover, cx, cy, cover, cover);
  else {
    const grd = g.createLinearGradient(cx, cy, cx + cover, cy + cover);
    grd.addColorStop(0, `hsl(${art.hue} 70% 50%)`);
    grd.addColorStop(1, `hsl(${(art.hue + 50) % 360} 75% 28%)`);
    g.fillStyle = grd;
    g.fillRect(cx, cy, cover, cover);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = `700 ${Math.round(cover * 0.12)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    wrapText(g, art.title, cx + cover / 2, cy + cover / 2, cover * 0.8, cover * 0.14, 3);
  }
  g.restore();
  return { x: cx + cover + Math.round(w * 0.05), y: cy, w: w - (cx + cover + Math.round(w * 0.05)) - Math.round(w * 0.07), cover };
}

/** Title, artist and album beside the cover; `high` leaves room for the visualizer below. */
function drawText(g: CanvasRenderingContext2D, art: Art, area: { x: number; y: number; w: number; cover: number }, h: number, high = false) {
  g.save();
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.4)';
  g.shadowBlur = h * 0.01;
  let y = area.y + area.cover * (high ? 0.17 : 0.36);
  g.fillStyle = '#fff';
  let size = Math.round(h * 0.075);
  g.font = `800 ${size}px ${FONT}`;
  while (g.measureText(art.title).width > area.w * 2 && size > h * 0.04) g.font = `800 ${(size -= 4)}px ${FONT}`;
  y = wrapText(g, art.title, area.x, y, area.w, size * 1.12, 2);
  if (art.artist) {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = `500 ${Math.round(h * 0.042)}px ${FONT}`;
    y = wrapText(g, art.artist, area.x, y + h * 0.025, area.w, h * 0.05, 1);
  }
  if (art.album) {
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = `400 ${Math.round(h * 0.03)}px ${FONT}`;
    wrapText(g, art.album, area.x, y + h * 0.01, area.w, h * 0.04, 1);
  }
  g.restore();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Draws wrapped text; returns the baseline after the last line. */
function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): number {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (g.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  const startY = g.textBaseline === 'middle' ? y - ((lines.length - 1) * lineH) / 2 : y;
  lines.forEach((l, i) => g.fillText(l, x, startY + i * lineH));
  return startY + (lines.length - 1) * lineH + lineH;
}

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- spectrum

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const BANDS = 64;
const N = 2048;

/** Per-frame band levels (0..1), smoothed like a hardware analyser. */
function spectrumFrames(buf: AudioBuffer, fps: number): Float32Array[] {
  const sr = buf.sampleRate;
  const l = buf.getChannelData(0);
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
  const frames = Math.ceil((buf.length / sr) * fps);
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  // Log-spaced band edges, 40 Hz – 16 kHz.
  const edges = Array.from({ length: BANDS + 1 }, (_, i) => Math.max(1, Math.round((40 * Math.pow(16000 / 40, i / BANDS) * N) / sr)));
  const out: Float32Array[] = [];
  let prev = new Float32Array(BANDS);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let f = 0; f < frames; f++) {
    const c = Math.floor((f / fps) * sr);
    for (let i = 0; i < N; i++) {
      const k = c - N / 2 + i;
      re[i] = k >= 0 && k < l.length ? ((l[k] + r[k]) / 2) * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    const cur = new Float32Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      let sum = 0;
      const lo = edges[b];
      const hi = Math.max(lo + 1, edges[b + 1]);
      for (let k = lo; k < hi && k < N / 2; k++) sum += Math.hypot(re[k], im[k]);
      const mag = sum / (hi - lo);
      const db = 20 * Math.log10(mag / (N / 4) + 1e-9) + b * 0.18; // tilt so highs show
      const v = Math.min(1, Math.max(0, (db + 60) / 55));
      cur[b] = v > prev[b] ? v * 0.7 + prev[b] * 0.3 : prev[b] * 0.82 + v * 0.18;
    }
    out.push(cur);
    prev = cur;
  }
  return out;
}

function drawSpectrum(g: CanvasRenderingContext2D, levels: Float32Array, x: number, y: number, w: number, h: number) {
  const gap = w / BANDS;
  const bw = gap * 0.62;
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.88)';
  for (let b = 0; b < BANDS; b++) {
    const bh = Math.max(h * 0.03, levels[b] * h);
    roundRect(g, x + b * gap, y + h - bh, bw, bh, bw / 2);
    g.fill();
  }
  g.restore();
}

// ---------------------------------------------------------------- video

export async function renderVideo(
  p: Project,
  audio: AudioBuffer,
  style: VideoStyle,
  onProgress?: (f: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const art = await artOf(p);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const duration = audio.length / audio.sampleRate;

  // A still image only needs one frame per second; the visualizer runs at 30.
  const fps = style === 'still' ? 1 : 30;
  const mp4 = await canEncodeVideo('avc', { width: W, height: H });
  const vcodec = mp4 ? 'avc' : 'vp9';
  const acodec = mp4 ? 'aac' : 'opus';
  await ensureEncoder(acodec);
  const target = new BufferTarget();
  const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target });
  const video = new CanvasSource(canvas, {
    codec: vcodec,
    quality: new Quality({ bitrate: style === 'still' ? 2_000_000 : 8_000_000 }),
    keyFrameInterval: style === 'still' ? 10 : 2,
  });
  const sound = new AudioBufferSource({ codec: acodec, quality: new Quality({ bitrate: 256_000 }), ...(acodec === 'opus' ? { transform: { sampleRate: 48000 } } : {}) });
  output.addVideoTrack(video, { frameRate: fps });
  output.addAudioTrack(sound);
  await output.start();

  // Static layer drawn once, then copied into each frame.
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  const bg = base.getContext('2d')!;
  const area = drawBase(bg, W, H, art);
  drawText(bg, art, area, H, style === 'visualizer');

  const levels = style === 'visualizer' ? spectrumFrames(audio, fps) : [];
  const frames = Math.max(1, Math.ceil(duration * fps));
  const barX = area.x;
  const barW = area.w;
  const barY = area.y + area.cover - H * 0.02;
  for (let f = 0; f < frames; f++) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const t = f / fps;
    g.drawImage(base, 0, 0);
    if (style === 'visualizer') {
      drawSpectrum(g, levels[f] ?? levels[levels.length - 1], barX, barY - H * 0.2, barW, H * 0.16);
      // Progress bar with times.
      g.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(g, barX, barY, barW, H * 0.007, H * 0.0035);
      g.fill();
      g.fillStyle = '#fff';
      roundRect(g, barX, barY, Math.max(H * 0.007, (barW * t) / duration), H * 0.007, H * 0.0035);
      g.fill();
      g.font = `500 ${Math.round(H * 0.024)}px ${FONT}`;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.textBaseline = 'top';
      g.textAlign = 'left';
      g.fillText(clock(t), barX, barY + H * 0.02);
      g.textAlign = 'right';
      g.fillText(clock(duration), barX + barW, barY + H * 0.02);
    }
    await video.add(t, Math.min(1 / fps, duration - t) || 1 / fps);
    if (f % 15 === 0) onProgress?.((f / frames) * 0.85);
  }
  video.close();

  const step = audio.sampleRate * 5;
  for (let i = 0; i < audio.length; i += step) {
    const n = Math.min(audio.length, i + step) - i;
    const part = new AudioBuffer({ length: n, numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate });
    for (let c = 0; c < audio.numberOfChannels; c++) part.copyToChannel(audio.getChannelData(c).subarray(i, i + n), c);
    await sound.add(part);
    onProgress?.(0.85 + (0.15 * (i + n)) / audio.length);
  }
  sound.close();
  await output.finalize();
  return new Blob([target.buffer!], { type: mp4 ? 'video/mp4' : 'video/webm' });
}

/** One frame of the video, for the preview in the dialog. */
export async function previewFrame(p: Project, style: VideoStyle, width = 640): Promise<string> {
  const art = await artOf(p);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const area = drawBase(g, W, H, art);
  drawText(g, art, area, H, style === 'visualizer');
  if (style === 'visualizer') {
    const levels = new Float32Array(BANDS).map((_, b) => 0.25 + 0.55 * Math.abs(Math.sin(b * 0.37)) * (1 - b / BANDS / 1.4));
    const barY = area.y + area.cover - H * 0.02;
    drawSpectrum(g, levels, area.x, barY - H * 0.2, area.w, H * 0.16);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(g, area.x, barY, area.w, H * 0.007, H * 0.0035);
    g.fill();
    g.fillStyle = '#fff';
    roundRect(g, area.x, barY, area.w * 0.35, H * 0.007, H * 0.0035);
    g.fill();
  }
  const small = document.createElement('canvas');
  small.width = width;
  small.height = Math.round((width * H) / W);
  small.getContext('2d')!.drawImage(c, 0, 0, small.width, small.height);
  return small.toDataURL('image/jpeg', 0.85);
}

/** The default YouTube thumbnail (1280×720): cover, title and artist. */
export async function defaultThumbnail(p: Project): Promise<string> {
  const art = await artOf(p);
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const g = c.getContext('2d')!;
  const area = drawBase(g, 1280, 720, art);
  drawText(g, art, area, 720);
  return c.toDataURL('image/jpeg', 0.9);
}

/** A thumbnail from your own image: centre-cropped to 16:9, 1280×720, under YouTube's 2 MB limit. */
export async function thumbnailFromImage(file: Blob): Promise<string> {
  const img = await loadImage(file);
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const g = c.getContext('2d')!;
  const scale = Math.max(1280 / img.naturalWidth, 720 / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  g.drawImage(img, (1280 - w) / 2, (720 - h) / 2, w, h);
  for (let q = 0.92; q > 0.4; q -= 0.1) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length * 0.75 < 1.9e6) return url;
  }
  return c.toDataURL('image/jpeg', 0.4);
}

export function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
