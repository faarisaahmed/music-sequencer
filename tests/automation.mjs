// Automation beyond volume and pan: the lane's parameter picker (Volume, Pan, Filter, Reverb, Echo),
// drawing points, playback following filter / reverb / echo curves (and not being reset by mixer changes),
// the track menu's Automation submenu, sections moving the new lanes, and offline render.
// Usage: node tests/automation.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
const check = (k, ok, info) => {
  res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 400);
};
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(url);
await page.waitForTimeout(800);

const tid = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'demo-pop').build());
  const p = store.useStore.getState().project;
  store.commit((d) => {
    d.bpm = 120;
  });
  return p.tracks.find((t) => t.type === 'instrument').id;
});
await page.waitForTimeout(1200);
const track = () => S((id) => window.__bf.store.useStore.getState().project.tracks.find((t) => t.id === id), tid);

// The A button opens the lane; the picker offers every parameter.
const block = page.locator(`[data-track-block="${tid}"]`);
await block.locator('.th-btn.auto').click();
await page.waitForTimeout(200);
const opts = await block.locator('.auto-param option').allTextContents();
check('lane picker lists all parameters', JSON.stringify(opts.map((o) => o.replace(' •', ''))) === '["Volume","Pan","Filter","Reverb","Echo"]', opts);
await block.locator('.auto-param').selectOption('filter');
await page.waitForTimeout(200);
check('lane switches to Filter', (await track()).showAutomation === 'filter');

// Draw two filter points by clicking in the lane: low at bar 1, open at bar 3.
const lane = block.locator('.automation-lane svg');
const box = await lane.boundingBox();
await S(() => window.__bf.store.useStore.setState({ snapGrid: 0 }));
await page.mouse.click(box.x + 4, box.y + box.height - 9);
await page.mouse.click(box.x + box.width * 0.04, box.y + 9);
await page.waitForTimeout(200);
let t = await track();
check('clicking draws filter points', t.automation.filter?.length === 2 && t.automation.filter[0].value < 0.1 && t.automation.filter[1].value > 0.9, t.automation.filter);
check('the picker marks lanes with points', (await block.locator('.auto-param option', { hasText: 'Filter •' }).count()) === 1);

// Precise curves for the audio checks: filter 0 → 1 over 8 beats, reverb 0 → 1, echo 1 → 0.
await S((id) => {
  window.__bf.store.commit((d) => {
    const t = d.tracks.find((x) => x.id === id);
    t.automation.filter = [{ beat: 0, value: 0 }, { beat: 8, value: 1 }];
    t.automation.reverb = [{ beat: 0, value: 0 }, { beat: 8, value: 1 }];
    t.automation.delay = [{ beat: 0, value: 1 }, { beat: 8, value: 0 }];
  });
}, tid);
const sample = () =>
  S(async (id) => {
    const eng = await window.__bf.engine();
    const ch = eng.mixer.channels.get(id);
    return { f: ch.filter.frequency.value, r: ch.reverbSend.gain.value, d: ch.delaySend.gain.value, pos: eng.position };
  }, tid);
await S(async () => {
  window.__bf.store.useStore.setState({ cursor: 0 });
  await (await window.__bf.engine()).play(0);
});
await page.waitForTimeout(800);
const a = await sample();
// A mixer change mid-play must not snap the automated values back to the knob settings.
await S((id) => window.__bf.store.commit((d) => {
  d.tracks.find((x) => x.id === id).volume = 0.7;
}), tid);
await page.waitForTimeout(1400);
const b = await sample();
await S(async () => (await window.__bf.engine()).stop());
const hz = (v) => 80 * Math.pow(250, v);
const near = (x, y, tol) => Math.abs(x - y) <= tol;
check('filter follows its curve', a.f < b.f && near(a.f, hz(a.pos / 8), hz(a.pos / 8) * 0.35 + 40) && near(b.f, hz(b.pos / 8), hz(b.pos / 8) * 0.35 + 40), { a, b });
check('reverb send follows its curve', b.r > a.r && near(b.r, (b.pos / 8) * 0.9, 0.12), { a, b });
check('echo send follows its curve', b.d < a.d && near(b.d, (1 - b.pos / 8) * 0.8, 0.12), { a, b });
check('mixer changes do not reset automated values', b.f < 10000 && b.r < 0.85, b);

// Clearing a lane hands control back to the knob (set halfway).
await S((id) => window.__bf.store.commit((d) => {
  const t = d.tracks.find((x) => x.id === id);
  t.automation.filter = [];
  t.fx.filterCutoff = 0.5; // keep the filter in the signal path (fully open bypasses it)
}), tid);
await page.waitForTimeout(400);
const after = await sample();
t = await track();
check('cleared lane returns to the knob', near(after.f, hz(t.fx.filterCutoff), hz(t.fx.filterCutoff) * 0.05 + 5), { after, knob: hz(t.fx.filterCutoff) });

// Track menu: Automation submenu.
await block.locator('.track-header').first().click({ button: 'right' });
await page.waitForTimeout(200);
await page.locator('.menu-item:has-text("Automation")').hover();
await page.waitForTimeout(250);
const sub = await page.locator('.menu-item').allTextContents();
check('track menu has the Automation submenu', sub.some((x) => x.includes('Show Reverb (drawn)')) && sub.some((x) => x.includes('Clear All Automation')), sub);
await page.keyboard.press('Escape');

// Offline render (export) runs with the new lanes.
const rendered = await S(async () => {
  const m = await import('/src/audio/export.ts');
  const p = window.__bf.store.useStore.getState().project;
  const buf = await m.renderProject(p, { start: 0, end: 8 });
  let peak = 0;
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 64) peak = Math.max(peak, Math.abs(d[i]));
  return { len: buf.duration, peak };
}).catch((e) => ({ error: String(e) }));
check('export renders with filter/reverb/echo automation', !rendered.error && rendered.peak > 0.001, rendered);

// Older songs (no filter/reverb/delay lists) still load and play.
const legacy = await S(async (id) => {
  window.__bf.store.commit((d) => {
    const t = d.tracks.find((x) => x.id === id);
    t.automation = { volume: [], pan: [] };
    t.showAutomation = 'reverb';
  });
  await new Promise((r) => setTimeout(r, 300));
  return document.querySelectorAll('.automation-lane').length;
}, tid);
check('songs without the new lanes still work', legacy >= 1);

await page.screenshot({ path: out + '/automation.png' });
check('no page errors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
const fails = Object.values(res).filter((v) => v !== 'ok').length;
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
