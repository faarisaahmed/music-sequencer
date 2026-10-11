let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    // iPhone: play through the speaker even with the silent switch on (it's a music app).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 44100 });
  }
  return ctx;
}

// Phones suspend audio when you switch apps or take a call; the next touch brings it back.
const wake = () => {
  if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => undefined);
};
window.addEventListener('pointerdown', wake, true);
window.addEventListener('keydown', wake, true);

/** Must be called from a user gesture at least once. */
export async function resumeAudio(): Promise<AudioContext> {
  const c = getAudioContext();
  if (c.state !== 'running') await c.resume();
  return c;
}

// ---------- Buffer cache (shared between live and offline contexts) ----------

const bufferCache = new Map<string, Promise<AudioBuffer>>();

export function loadBuffer(url: string): Promise<AudioBuffer> {
  let p = bufferCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.arrayBuffer();
      })
      .then((ab) => getAudioContext().decodeAudioData(ab));
    p.catch(() => bufferCache.delete(url));
    bufferCache.set(url, p);
  }
  return p;
}

/** Generate a stereo reverb impulse response procedurally. */
export function makeImpulse(c: BaseAudioContext, seconds: number, decay: number, preDelay = 0.01, bright = 1): AudioBuffer {
  const rate = c.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = c.createBuffer(2, len, rate);
  const pre = Math.floor(preDelay * rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      const white = Math.random() * 2 - 1;
      // one-pole lowpass that darkens over time
      const k = Math.min(1, bright * (1 - t * 0.85));
      lp = lp + k * (white - lp);
      d[i] = lp * Math.pow(1 - t, decay);
    }
    // early reflections
    for (let e = 0; e < 8; e++) {
      const idx = pre + Math.floor(Math.random() * rate * 0.06);
      if (idx < len) d[idx] += (Math.random() * 2 - 1) * 0.5;
    }
  }
  return buf;
}
