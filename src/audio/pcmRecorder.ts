// Sample-accurate microphone capture via an AudioWorklet (raw PCM, no codec round-trip).

const WORKLET = `
class BandForgeRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = true;
    this.port.onmessage = (e) => { if (e.data === 'stop') this.on = false; };
  }
  process(inputs) {
    const input = inputs[0];
    if (this.on && input && input.length) {
      this.port.postMessage({ t: currentTime, ch: input.map((c) => c.slice(0)) });
    }
    return this.on;
  }
}
registerProcessor('bandforge-recorder', BandForgeRecorder);
`;

const loaded = new WeakSet<BaseAudioContext>();

async function ensureWorklet(ctx: AudioContext): Promise<void> {
  if (loaded.has(ctx)) return;
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  loaded.add(ctx);
}

export class PcmRecorder {
  private ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private chunks: Float32Array[][] = [];
  /** Context time of the first captured sample. */
  startTime = -1;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async start(source: AudioNode): Promise<void> {
    await ensureWorklet(this.ctx);
    this.node = new AudioWorkletNode(this.ctx, 'bandforge-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
    this.node.port.onmessage = (e: MessageEvent<{ t: number; ch: Float32Array[] }>) => {
      if (this.startTime < 0) this.startTime = e.data.t;
      this.chunks.push(e.data.ch);
    };
    // Keep the node pulled by the graph without making it audible.
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0;
    source.connect(this.node);
    this.node.connect(this.sink);
    this.sink.connect(this.ctx.destination);
  }

  /** Stop capturing and return the recording (null when nothing was captured). */
  async stop(): Promise<AudioBuffer | null> {
    const node = this.node;
    if (!node) return null;
    node.port.postMessage('stop');
    // Let the last messages arrive.
    await new Promise((r) => setTimeout(r, 60));
    node.disconnect();
    this.sink?.disconnect();
    this.node = null;
    const len = this.chunks.reduce((n, c) => n + (c[0]?.length ?? 0), 0);
    if (!len) return null;
    const channels = Math.max(1, Math.min(2, Math.max(...this.chunks.map((c) => c.length))));
    const buf = this.ctx.createBuffer(channels, len, this.ctx.sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const out = buf.getChannelData(ch);
      let o = 0;
      for (const c of this.chunks) {
        const data = c[ch] ?? c[0];
        out.set(data, o);
        o += data.length;
      }
    }
    this.chunks = [];
    return buf;
  }
}
