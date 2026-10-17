// Analysis for the Sampler: finding a sample's pitch (so it plays in tune), finding the hits in
// a recording (to chop it into slices), and cutting a slice out as its own sound.

/** Mono copy of a stretch of a buffer. */
function mono(buf: AudioBuffer, from: number, to: number): Float32Array {
  const a = Math.max(0, Math.floor(from * buf.sampleRate));
  const b = Math.min(buf.length, Math.ceil(to * buf.sampleRate));
  const out = new Float32Array(Math.max(0, b - a));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += d[a + i] / buf.numberOfChannels;
  }
  return out;
}

/**
 * The sample's pitch as a MIDI note (rounded), or null if it isn't clearly pitched (drums,
 * noise). Uses the YIN difference function on the loudest steady stretch of the sound.
 */
export function detectPitch(buf: AudioBuffer, from = 0, to = buf.duration): number | null {
  const sr = buf.sampleRate;
  const x = mono(buf, from, to);
  const W = 2048;
  if (x.length < W * 2) return null;
  // Loudest window, skipping the attack (pitch settles after the first few hundredths).
  let best = 0;
  let bestE = 0;
  const skip = Math.min(Math.floor(sr * 0.04), x.length - 2 * W);
  for (let s = skip; s + 2 * W <= x.length; s += W / 2) {
    let e = 0;
    for (let i = 0; i < W; i++) e += x[s + i] * x[s + i];
    if (e > bestE) {
      bestE = e;
      best = s;
    }
  }
  if (bestE / W < 1e-5) return null;
  const minLag = Math.floor(sr / 1500);
  const maxLag = Math.min(W - 1, Math.floor(sr / 40));
  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const v = x[best + i] - x[best + i + lag];
      sum += v * v;
    }
    d[lag] = sum;
  }
  // Cumulative mean normalised difference; the first dip under the threshold is the period.
  let run = 0;
  let lag = -1;
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  for (let l = 1; l <= maxLag; l++) {
    run += d[l];
    cmnd[l] = run > 0 ? (d[l] * l) / run : 1;
  }
  for (let l = minLag; l <= maxLag; l++) {
    if (cmnd[l] < 0.15) {
      while (l + 1 <= maxLag && cmnd[l + 1] < cmnd[l]) l++;
      lag = l;
      break;
    }
  }
  if (lag < 0) return null;
  // Parabolic interpolation for a finer period.
  const a = cmnd[lag - 1] ?? cmnd[lag];
  const b = cmnd[lag];
  const c = cmnd[lag + 1] ?? cmnd[lag];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  const f = sr / (lag + (Number.isFinite(shift) ? shift : 0));
  const midi = Math.round(69 + 12 * Math.log2(f / 440));
  return midi >= 24 && midi <= 108 ? midi : null;
}

/**
 * Where the hits are (as fractions of the buffer), for chopping a beat or phrase into slices.
 * Finds sharp rises in loudness, keeps the strongest `max` of them at least 70 ms apart, and
 * always starts with a slice at `from`.
 */
export function detectSlices(buf: AudioBuffer, from: number, to: number, max = 16, sensitivity = 0.5): number[] {
  const sr = buf.sampleRate;
  const x = mono(buf, from, to);
  const hop = 256;
  const frames = Math.floor(x.length / hop);
  if (frames < 4) return [from / buf.duration];
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < hop; i++) e += x[f * hop + i] * x[f * hop + i];
    env[f] = Math.sqrt(e / hop);
  }
  const peak = env.reduce((m, v) => Math.max(m, v), 0) || 1;
  // Onset strength: rise in (log-ish) loudness over the last few frames.
  const lvl = env.map((v) => Math.log10(1 + (100 * v) / peak));
  const flux = new Float32Array(frames);
  for (let f = 2; f < frames; f++) flux[f] = Math.max(0, lvl[f] - Math.max(lvl[f - 1], lvl[f - 2] * 0.98));
  const fluxPeak = flux.reduce((m, v) => Math.max(m, v), 0) || 1;
  const thresh = fluxPeak * (0.5 - 0.4 * Math.max(0, Math.min(1, sensitivity)));
  const cands: { f: number; s: number }[] = [];
  for (let f = 1; f < frames - 1; f++) if (flux[f] >= thresh && flux[f] >= flux[f - 1] && flux[f] >= flux[f + 1] && lvl[f] > 0.15) cands.push({ f, s: flux[f] });
  cands.sort((a, b) => b.s - a.s);
  const gap = Math.ceil((0.07 * sr) / hop);
  const kept: number[] = [];
  for (const c of cands) {
    if (kept.length >= max) break;
    if (kept.every((k) => Math.abs(k - c.f) >= gap)) kept.push(c.f);
  }
  // Each slice starts slightly before its hit so the attack isn't cut.
  const pre = Math.floor((0.004 * sr) / hop);
  const times = kept.map((f) => from + (Math.max(0, f - 1 - pre) * hop) / sr).sort((a, b) => a - b);
  const out = [from, ...times.filter((t) => t - from > 0.05)];
  return out.slice(0, max).map((t) => t / buf.duration);
}

/** `n` slices of equal length between start and end (fractions). */
export function equalSlices(n: number, start: number, end: number): number[] {
  return Array.from({ length: n }, (_, i) => start + ((end - start) * i) / n);
}

/** Cut a stretch out as its own buffer, with short fades so it never clicks. */
export function cutBuffer(ctx: BaseAudioContext, buf: AudioBuffer, from: number, to: number, opts: { reverse?: boolean; fadeIn?: number; fadeOut?: number } = {}): AudioBuffer {
  const sr = buf.sampleRate;
  const a = Math.max(0, Math.floor(from * sr));
  const b = Math.min(buf.length, Math.max(a + 1, Math.ceil(to * sr)));
  const n = b - a;
  const out = ctx.createBuffer(buf.numberOfChannels, n, sr);
  const fi = Math.max(Math.floor(0.002 * sr), Math.floor((opts.fadeIn ?? 0) * sr));
  const fo = Math.max(Math.floor(0.006 * sr), Math.floor((opts.fadeOut ?? 0) * sr));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < n; i++) dst[i] = opts.reverse ? src[b - 1 - i] : src[a + i];
    for (let i = 0; i < Math.min(fi, n); i++) dst[i] *= i / fi;
    for (let i = 0; i < Math.min(fo, n); i++) dst[n - 1 - i] *= i / fo;
  }
  return out;
}
