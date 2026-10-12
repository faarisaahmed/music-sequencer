// Resizing the window (or opening a panel) must not paint frames where the editors are drawn at
// the old size and then snap: every canvas, score page and sized layer has to match the new size
// in the very first frame that shows it.
// For each view we step the window size, snapshot the sized elements at the moment the browser
// is about to paint (from a ResizeObserver that runs after the app's own), then snapshot again
// once things have settled. Any difference is a frame the user saw jump.
// Usage: node tests/resize-jitter.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
await page.goto(url);
await page.waitForTimeout(800);
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? ''); };
const S = (fn, arg) => page.evaluate(fn, arg);

const ids = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'demo-pop').build());
  const p = store.useStore.getState().project;
  const midi = p.tracks.find((t) => t.type === 'instrument' && t.regions.some((r) => r.kind === 'midi'));
  const drums = p.tracks.find((t) => t.type === 'drums' && t.regions.length);
  return { mt: midi.id, mr: midi.regions[0].id, dt: drums.id, dr: drums.regions[0].id };
});
await page.waitForTimeout(800);

// Snapshot of everything whose size is derived from a measured container.
await S(() => {
  const SEL = '.project canvas, .score-svg, .score-system, .editor-head, .editor-body, .tracks-area, .dock, .tv-scroll > div, .pr-scroll > div, .ss-scroll > div, .ae-scroll > div, .score-scroll > div';
  window.__snap = () =>
    [...document.querySelectorAll(SEL)].flatMap((el) => {
      const r = el.getBoundingClientRect();
      // Off-screen score systems are drawn ahead of time after the first frame; nobody sees them.
      const clip = el.closest('.score-scroll')?.getBoundingClientRect();
      if (clip && el.classList.contains('score-system') && (r.top >= clip.bottom || r.bottom <= clip.top)) return [];
      const a = el instanceof HTMLCanvasElement ? `${el.width}x${el.height}` : '';
      return [`${el.className || el.tagName}|${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}|${a}`];
    }).join('\n');
  window.__arm = () => {
    // A fresh observer is last in the browser's list, so it sees the frame as it will be painted.
    window.__painted = null;
    window.__probe?.disconnect();
    const w0 = innerWidth;
    const h0 = innerHeight;
    // Observers always report once when they start; only the frame with the new size counts.
    const ro = new ResizeObserver(() => {
      if (window.__painted === null && (innerWidth !== w0 || innerHeight !== h0)) window.__painted = window.__snap();
    });
    ro.observe(document.documentElement);
    window.__probe = ro;
  };
});

async function sweep(name) {
  const sizes = [];
  for (let i = 1; i <= 12; i++) sizes.push([1440 - i * 37, 900 - i * 13]);
  for (let i = 11; i >= 0; i--) sizes.push([1440 - i * 37, 900 - i * 13]);
  let bad = 0;
  const diffs = [];
  for (const [w, h] of sizes) {
    await S(() => window.__arm());
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    const { painted, settled } = await S(() => ({ painted: window.__painted, settled: window.__snap() }));
    if (painted !== null && painted !== settled) {
      bad++;
      if (diffs.length < 3) {
        const a = painted.split('\n');
        const b = settled.split('\n');
        diffs.push({ w, h, first: b.map((l, i) => (l !== a[i] ? `${a[i]}  →  ${l}` : null)).filter(Boolean).slice(0, 4) });
      }
    }
  }
  check(`${name}:resizeNoStaleFrames`, bad === 0, { staleSteps: `${bad}/${sizes.length}`, diffs });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
}

async function opening(name, state) {
  // Close the dock, then open it and record every frame for a second.
  await S(() => window.__bf.store.useStore.setState({ dockTab: null }));
  await page.waitForTimeout(400);
  const frames = await S(async (state) => {
    const seen = [];
    let stop = false;
    const tick = () => {
      seen.push(window.__snap());
      if (!stop) requestAnimationFrame(tick);
    };
    window.__bf.store.useStore.setState(state);
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 1200));
    stop = true;
    // Count how many times the layout changed after the first frame that showed the panel.
    let changes = 0;
    for (let i = 2; i < seen.length; i++) if (seen[i] !== seen[i - 1]) changes++;
    return { frames: seen.length, changes };
  }, state);
  check(`${name}:openSettlesAtOnce`, frames.changes <= 1, frames);
}

const views = [
  ['tracks', { dockTab: null }],
  ['pianoroll', { dockTab: 'editor', editorMode: 'pianoroll', editingRegionId: ids.mr, selectedTrackId: ids.mt, selectedRegionIds: [ids.mr], dockMaximized: false }],
  ['score', { dockTab: 'editor', editorMode: 'score', editingRegionId: ids.mr, selectedTrackId: ids.mt, selectedRegionIds: [ids.mr], dockMaximized: false }],
  ['fullscore', { dockTab: 'editor', editorMode: 'fullscore', editingRegionId: ids.mr, selectedTrackId: ids.mt, selectedRegionIds: [ids.mr], dockMaximized: true }],
  ['steps', { dockTab: 'editor', editorMode: 'steps', editingRegionId: ids.dr, selectedTrackId: ids.dt, selectedRegionIds: [ids.dr], dockMaximized: false }],
  ['mixer', { dockTab: 'mixer', dockMaximized: false }],
];
for (const [name, state] of views) {
  if (name !== 'tracks') await opening(name, state);
  await S((s) => window.__bf.store.useStore.setState(s), state);
  await page.waitForTimeout(1500);
  await sweep(name);
}
await page.screenshot({ path: `${out}/resize-jitter.png` });
check('noErrors', errors.length === 0, errors.slice(0, 5));
console.log(JSON.stringify(res, null, 1));
await browser.close();
process.exit(Object.values(res).every((v) => v === 'ok') ? 0 : 1);
