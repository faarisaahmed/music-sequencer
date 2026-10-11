// Cross-browser smoke test in a real Firefox (puppeteer-core) or Safari (safaridriver): the
// studio opens, the editors and score engrave, audio renders, every export format encodes
// (native or the built-in fallbacks), the YouTube video encodes, MIDI/MusicXML, versions,
// backups, tempo maps, repeats and the writing check all work.
// Usage: node tests/browser-smoke.mjs firefox [url]
//        node tests/browser-smoke.mjs safari [url]   (first: sudo safaridriver --enable)
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
const [which = 'firefox', url = 'http://localhost:5391/'] = process.argv.slice(2);
const errors = [];
let browser;
let page;

if (which === 'safari') {
  // A tiny W3C WebDriver client for safaridriver, shaped like the bits of puppeteer used below.
  const port = 4447;
  const drv = spawn('/usr/bin/safaridriver', ['-p', String(port)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  const base = `http://localhost:${port}`;
  const wd = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (j.value?.error) throw new Error(j.value.message || j.value.error);
    return j.value;
  };
  const sess = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
  const sid = sess.sessionId;
  await wd('POST', `/session/${sid}/window/rect`, { width: 1440, height: 900 }).catch(() => {});
  const evaluate = async (fn, arg) => {
    const script = `const done = arguments[arguments.length - 1]; Promise.resolve((${fn.toString()})(arguments[0])).then((v) => done({ ok: v === undefined ? null : v }), (e) => done({ err: String(e && e.message || e) }));`;
    const v = await wd('POST', `/session/${sid}/execute/async`, { script, args: [arg ?? null] });
    if (v && v.err) throw new Error(v.err);
    return v?.ok;
  };
  page = {
    goto: async (u) => {
      await wd('POST', `/session/${sid}/url`, { url: u });
      // Collect page errors the same way puppeteer's listeners would.
      await evaluate(() => {
        window.__errs = [];
        window.addEventListener('error', (e) => window.__errs.push('pageerror: ' + e.message));
        window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection: ' + (e.reason?.message ?? e.reason)));
      });
    },
    evaluate,
    waitForSelector: async (sel, o = {}) => {
      const until = Date.now() + (o.timeout ?? 30000);
      while (Date.now() < until) {
        if (await evaluate((s) => !!document.querySelector(s), sel)) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error('timeout waiting for ' + sel);
    },
    $$: async (sel) => new Array(await evaluate((s) => document.querySelectorAll(s).length, sel)),
    collectErrors: () => evaluate(() => window.__errs ?? []),
  };
  browser = {
    version: async () => 'safari/' + (sess.capabilities?.browserVersion ?? '?'),
    close: async () => {
      await wd('DELETE', `/session/${sid}`).catch(() => {});
      drv.kill();
    },
  };
} else {
  const bin = '/Applications/Firefox.app/Contents/MacOS/firefox';
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: bin, headless: true, defaultViewport: null, args: ['--width=1440', '--height=900'] });
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|NetworkError|net::|downloadable font/.test(m.text()) && errors.push('console: ' + m.text()));
}
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 400); };
const S = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = async (k, fn) => {
  try {
    await fn();
  } catch (e) {
    res[k] = 'FAIL threw ' + String(e?.message ?? e).slice(0, 300);
  }
};
for (let i = 0; i < 3; i++) {
  try {
    await page.goto(url);
    break;
  } catch {
    await wait(1500); // the dev server may be reloading
  }
}
await wait(2000);
res.browser = await browser.version();

await safe('openDemo', async () => {
  await S(async () => {
    const { actions, templates } = window.__bf;
    await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'demo-sunset').build());
  });
  await page.waitForSelector('.region', { timeout: 20000 });
  check('openDemo', (await page.$$('.region')).length > 3);
});

await safe('pianoRoll', async () => {
  await S(() => {
    const st = window.__bf.store.useStore;
    const p = st.getState().project;
    const mel = p.tracks.find((t) => t.type === 'instrument' && t.regions.length);
    st.setState({ dockTab: 'editor', editorMode: 'pianoroll', selectedTrackId: mel.id, editingRegionId: mel.regions[0].id });
  });
  await page.waitForSelector('.pr-scroll', { timeout: 10000 });
  check('pianoRoll', true);
});

await safe('score', async () => {
  await S(() => window.__bf.store.useStore.setState({ editorMode: 'score' }));
  await page.waitForSelector('.score-svg svg', { timeout: 20000 });
  await wait(1200);
  const heads = await S(() => window.__scoreLayout?.heads?.length ?? document.querySelectorAll('.score-svg .vf-stavenote').length);
  check('score', heads > 0, heads);
});

await safe('steps', async () => {
  await S(() => {
    const st = window.__bf.store.useStore;
    const p = st.getState().project;
    const dr = p.tracks.find((t) => t.type === 'drums' && t.regions.length);
    st.setState({ editorMode: 'steps', selectedTrackId: dr.id, editingRegionId: dr.regions[0].id });
  });
  await page.waitForSelector('.ss-cells', { timeout: 10000 });
  check('steps', true);
});

let renderOk = false;
await safe('render', async () => {
  const r = await S(async () => {
    const ex = await import('/src/audio/export.ts');
    const p = window.__bf.store.useStore.getState().project;
    const buf = await ex.renderProject(p, { start: 0, end: 8, tail: 0.5, sampleRate: 44100 });
    let peak = 0;
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 7) peak = Math.max(peak, Math.abs(d[i]));
    window.__buf = buf;
    return { secs: buf.duration, peak };
  });
  renderOk = r.peak > 0.01;
  check('render', renderOk, r);
});

for (const fmt of ['wav', 'mp3', 'flac', 'm4a', 'ogg']) {
  await safe('encode:' + fmt, async () => {
    const r = await S(async (fmt) => {
      const ex = await import('/src/audio/export.ts');
      if (fmt === 'ogg' && !(await ex.canExport('ogg'))) return { skipped: 'no Opus encoder' };
      const p = window.__bf.store.useStore.getState().project;
      const buf = window.__buf ?? (await ex.renderProject(p, { start: 0, end: 4, tail: 0.2 }));
      const blob = await ex.encodeAudio(buf, fmt, p, {});
      const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
      return { size: blob.size, head: String.fromCharCode(...head) };
    }, fmt);
    const sig = { wav: 'RIFF', mp3: 'ID3', flac: 'fLaC', m4a: 'ftyp', ogg: 'OggS' }[fmt];
    check('encode:' + fmt, r.skipped || (r.size > 1000 && r.head.includes(sig)), r);
  });
}

await safe('youtubeVideo', async () => {
  const r = await S(async () => {
    const ex = await import('/src/audio/export.ts');
    const v = await import('/src/publish/video.ts');
    const p = window.__bf.store.useStore.getState().project;
    const buf = await ex.renderProject(p, { start: 0, end: 2, tail: 0.2, sampleRate: 48000 });
    const blob = await v.renderVideo(p, buf, 'still');
    return { size: blob.size, type: blob.type };
  });
  check('youtubeVideo', r.size > 5000 && /video\//.test(r.type), r);
});

await safe('midiXml', async () => {
  const r = await S(async () => {
    const ex = await import('/src/audio/export.ts');
    const p = window.__bf.store.useStore.getState().project;
    const mid = await ex.projectToMidi(p);
    const parsed = await ex.parseMidiFile(mid);
    return { tracks: parsed.tracks.length };
  });
  check('midiXml', r.tracks > 2, r);
});

await safe('versions', async () => {
  const r = await S(async () => {
    const s = await window.__bf.safety();
    const p = window.__bf.store.useStore.getState().project;
    await s.saveVersion(p, { label: 'FF test' });
    const list = await s.listVersions(p.id);
    const file = await s.backupAllFile();
    return { n: list.filter((v) => v.label === 'FF test').length, backup: file.size };
  });
  check('versions', r.n === 1 && r.backup > 1000, r);
});

await safe('timeline', async () => {
  const r = await S(async () => {
    const { TempoMap, Meter } = await import('/src/model/timeline.ts');
    const { barOrder } = await import('/src/model/form.ts');
    return {
      sec: new TempoMap(120, [{ id: 'a', beat: 8, bpm: 60 }]).sec(12),
      bar: new Meter([4, 4], [{ id: 'm', bar: 2, timeSig: [3, 4] }]).barStart(3),
      order: barOrder([{ id: 'r', kind: 'repeatEnd', bar: 1 }], [], 3).join(),
    };
  });
  check('timeline', r.sec === 8 && r.bar === 11 && r.order === '0,1,0,1,2', r);
});

await safe('review', async () => {
  await S(() => window.__bf.store.useStore.setState({ dockTab: 'review' }));
  await page.waitForSelector('.review', { timeout: 10000 });
  check('review', true);
});

await safe('exportDialog', async () => {
  await S(() => window.__bf.store.openModal('export'));
  await page.waitForSelector('.export-formats', { timeout: 10000 });
  const off = await S(() => [...document.querySelectorAll('.export-fmt')].filter((b) => b.disabled).map((b) => b.textContent));
  check('exportDialog', true, off);
  res.exportDisabled = off.join(',') || 'none';
});

if (page.collectErrors) errors.push(...(await page.collectErrors()));
check('noErrors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
await browser.close();
