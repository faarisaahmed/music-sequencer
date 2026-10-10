// Shared helpers for Jam Session browser tests (multi-profile, real relays).
import { chromium } from 'playwright';

/** Instrumentation injected into every page before app code runs. */
const INSTRUMENT = () => {
  const w = window;
  w.__qa = { dcSends: 0, intervals: new Set(), listeners: 0, types: {}, pcs: [] };
  const DC = RTCDataChannel.prototype.send;
  w.__qa.log = [];
  RTCDataChannel.prototype.send = function (...a) {
    w.__qa.dcSends++;
    if (w.__qa.trace) w.__qa.log.push(`${Math.round(performance.now())} send ${this.label} ${this.readyState} buf=${this.bufferedAmount} len=${a[0]?.byteLength ?? a[0]?.length}`);
    return DC.apply(this, a);
  };
  const desc = Object.getOwnPropertyDescriptor(RTCDataChannel.prototype, 'onmessage');
  Object.defineProperty(RTCDataChannel.prototype, 'onmessage', {
    configurable: true,
    get() {
      return desc.get.call(this);
    },
    set(fn) {
      const ch = this;
      desc.set.call(this, fn ? function (e) {
        if (w.__qa.trace) w.__qa.log.push(`${Math.round(performance.now())} recv ${ch.label} len=${e.data?.byteLength ?? e.data?.length}`);
        return fn.call(this, e);
      } : fn);
    },
  });
  const si = w.setInterval.bind(w);
  const ci = w.clearInterval.bind(w);
  w.setInterval = (...a) => {
    const id = si(...a);
    w.__qa.intervals.add(id);
    return id;
  };
  w.clearInterval = (id) => {
    w.__qa.intervals.delete(id);
    return ci(id);
  };
  const ael = w.addEventListener.bind(w);
  const rel = w.removeEventListener.bind(w);
  w.addEventListener = (...a) => {
    w.__qa.listeners++;
    w.__qa.types[a[0]] = (w.__qa.types[a[0]] ?? 0) + 1;
    return ael(...a);
  };
  w.removeEventListener = (...a) => {
    w.__qa.listeners--;
    w.__qa.types[a[0]] = (w.__qa.types[a[0]] ?? 0) - 1;
    return rel(...a);
  };
  const PC = w.RTCPeerConnection;
  w.RTCPeerConnection = function (...a) {
    const pc = new PC(...a);
    w.__qa.pcs.push(pc);
    return pc;
  };
  w.RTCPeerConnection.prototype = PC.prototype;
};

export async function setup(exe, base) {
  const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  const toasts = [];
  const t0 = Date.now();
  const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

  async function newPeer(label, opts = {}) {
    const ctx = opts.ctx ?? (await browser.newContext({ viewport: opts.viewport ?? { width: 1500, height: 900 }, permissions: ['microphone'] }));
    await ctx.addInitScript(INSTRUMENT);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|ERR_|WebSocket|relay|User-Initiated Abort|Vite server/i.test(m.text())) errors.push(`${label} console: ${m.text()}`);
    });
    const peer = { ctx, page, label };
    if (opts.url !== null) {
      await page.goto(opts.url ?? base);
      await ready(peer);
    }
    return peer;
  }
  const ev = (p, fn, arg) => p.page.evaluate(fn, arg);
  const ready = (p) => p.page.waitForFunction(() => window.__bf, null, { timeout: 30000 });
  const state = (p) => ev(p, async () => (await window.__bf.session()).debugState());
  async function waitFor(pred, timeout, what) {
    const start = Date.now();
    let last;
    while (Date.now() - start < timeout) {
      try {
        if (await pred()) return Date.now() - start;
      } catch (e) {
        last = e;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`timeout waiting for ${what}${last ? ' (' + last.message + ')' : ''}`);
  }
  async function converged(peers, timeout = 20000, what = 'convergence') {
    return waitFor(
      async () => {
        const ss = await Promise.all(peers.map(state));
        return ss.every((s) => s.hash && s.synced && s.pending === 0 && s.reorder === 0 && s.hash === ss[0].hash);
      },
      timeout,
      what,
    );
  }
  const commit = (p, src) =>
    ev(p, (src) => {
      const fn = new Function('d', src);
      window.__bf.store.commit((d) => fn(d));
    }, src);
  const read = (p, src) => ev(p, (src) => new Function('p', src)(window.__bf.store.useStore.getState().project), src);
  const toastsOf = (p) => ev(p, () => window.__bf.store.useStore.getState().toasts.map((t) => t.kind + ':' + t.text));

  /** A hosts a fresh copy of a template and starts a session; returns the code. */
  async function host(A, template = 'demo-sunset', mutate) {
    const code = await ev(
      A,
      async ({ template, mutate }) => {
        const bf = window.__bf;
        const p = bf.templates.TEMPLATES.find((t) => t.id === template).build();
        if (mutate) new Function('p', mutate)(p);
        await bf.actions.createNewProject(p);
        const s = await bf.session();
        const code = bf.collab.makeRoomCode();
        await s.startSession(code);
        return code;
      },
      { template, mutate },
    );
    return code;
  }
  async function join(B, code) {
    try {
      await ev(B, async (code) => { await (await window.__bf.session()).joinSession(code); }, code);
    } catch {
      // Re-joining a session from the same tab reloads the page (fresh network identity).
      await B.page.waitForLoadState('load');
      await ready(B);
    }
  }
  return { browser, errors, toasts, log, newPeer, ev, ready, state, waitFor, converged, commit, read, toastsOf, host, join };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
