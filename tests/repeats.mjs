// Repeats, 1st/2nd endings, D.S./D.C./Coda/Fine: the play order rules, the live engine's jumps
// (simulated clock), exported audio and MIDI following them, the lane and score palette menus,
// the score drawing, MusicXML, and switching repeats off. Usage: node tests/repeats.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Midi } = require('@tonejs/midi');
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
process.on('exit', () => !res.__done && console.log('PARTIAL', JSON.stringify(res, null, 1)));
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 300); };
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(url);
await page.waitForTimeout(800);

// ---- play order rules
const orders = await S(async () => {
  const { barOrder } = await import('/src/model/form.ts');
  const M = (kind, bar, x = {}) => ({ id: kind + bar, kind, bar, ...x });
  return {
    simple: barOrder([M('repeatEnd', 3)], [], 6),
    times3: barOrder([M('repeatStart', 2), M('repeatEnd', 3, { times: 3 })], [], 6),
    endings: barOrder([M('repeatEnd', 3)], [{ id: 'v1', start: 3, end: 4, numbers: [1] }, { id: 'v2', start: 4, end: 5, numbers: [2] }], 6),
    dsCoda: barOrder([M('segno', 1), M('toCoda', 2), M('ds', 4, { until: 'coda' }), M('coda', 5)], [], 7),
    dcFine: barOrder([M('fine', 1), M('dc', 3, { until: 'fine' })], [], 5),
    twoRepeats: barOrder([M('repeatEnd', 1), M('repeatStart', 2), M('repeatEnd', 3)], [], 5),
  };
});
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('orderSimple', eq(orders.simple, [0, 1, 2, 3, 0, 1, 2, 3, 4, 5]), orders.simple);
check('orderTimes3', eq(orders.times3, [0, 1, 2, 3, 2, 3, 2, 3, 4, 5]), orders.times3);
check('orderEndings', eq(orders.endings, [0, 1, 2, 3, 0, 1, 2, 4, 5]), orders.endings);
check('orderDsCoda', eq(orders.dsCoda, [0, 1, 2, 3, 4, 1, 2, 5, 6]), orders.dsCoda);
check('orderDcFine', eq(orders.dcFine, [0, 1, 2, 3, 0, 1]), orders.dcFine);
check('orderTwoRepeats', eq(orders.twoRepeats, [0, 1, 0, 1, 2, 3, 2, 3, 4]), orders.twoRepeats);

// ---- a 4-bar song in 4/4 at 120 with a note on each bar
await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'analog-lead');
  const rid = actions.createEmptyRegion(tid, 0, 16);
  store.commit((d) => {
    store.draftRegion(d, rid).notes = [0, 4, 8, 12].map((b, i) => ({ id: 'n' + i, pitch: 60 + i * 2, start: b, duration: 0.5, velocity: 0.9 }));
    d.bpm = 120;
    d.lengthBars = 4;
  });
});

// Lane menu: "Repeat This Bar" on bar 2, then 1st & 2nd endings from bar 2.
await page.click('.tv-toolbar button:has-text("Tempo")');
await page.waitForSelector('.tempo-lane');
const lane = await page.locator('.tempo-lane').boundingBox();
const ppb = await S(() => window.__bf.store.useStore.getState().pxPerBeat);
const openForm = async (bar) => {
  await page.mouse.click(lane.x + (bar * 4 + 1) * ppb, lane.y + 40, { button: 'right' });
  await page.hover(`.menu-item:has-text("Repeats & Jumps at Bar ${bar + 1}")`);
  await page.waitForTimeout(100);
};
await openForm(1);
await page.locator('.menu-item', { hasText: /^Repeat This Bar$/ }).click();
await page.waitForTimeout(150);
let p = await S(() => window.__bf.store.useStore.getState().project);
check('repeatThisBar', p.navMarks?.some((m) => m.kind === 'repeatStart' && m.bar === 1) && p.navMarks?.some((m) => m.kind === 'repeatEnd' && m.bar === 1), p.navMarks);
check('laneShowsMarks', (await page.locator('.nav-mark').count()) === 2);

// Order now: bars 0,1,1,2,3 → 5 bars = 10 s at 120.
const len1 = await S(async () => (await import('/src/audio/export.ts')).playSeconds(window.__bf.store.useStore.getState().project, 0, 16));
check('exportLengthRepeats', Math.abs(len1 - 10) < 1e-6, len1);

// Live engine with a simulated clock: playback jumps back from the end of bar 2 to bar 2.
const jumps = await S(async () => {
  const engine = await window.__bf.engine();
  let now = 100;
  Object.defineProperty(engine.ctx, 'currentTime', { get: () => now, configurable: true });
  await engine.play(0);
  const seen = [];
  for (let i = 0; i < 160; i++) {
    now += 0.1;
    engine.tick();
    if (!engine.isPlaying) break;
    seen.push(Math.round(engine.position * 4) / 4);
  }
  engine.stop();
  delete engine.ctx.currentTime;
  // Where the position went backwards (a jump), and the furthest point reached.
  const backs = [];
  for (let i = 1; i < seen.length; i++) if (seen[i] < seen[i - 1] - 0.5) backs.push([seen[i - 1], seen[i]]);
  return { backs, max: Math.max(...seen), stopped: !engine.isPlaying };
});
check('engineJumpsBack', jumps.backs.length === 1 && Math.abs(jumps.backs[0][1] - 4) < 0.3 && jumps.backs[0][0] >= 7.5, jumps);
check('engineStopsAtEnd', jumps.stopped && jumps.max <= 16.1, jumps);

// 1st & 2nd endings from bar 3 (1 bar each): bars 0,1,1,2,0,1,1,3 ... (repeat goes back to start)
await openForm(2);
await page.hover('.menu-item:has-text("1st & 2nd Endings From Here")');
await page.waitForTimeout(100);
await page.locator('.menu-item', { hasText: /^1 bar each$/ }).click();
await page.waitForTimeout(150);
p = await S(() => window.__bf.store.useStore.getState().project);
check('endingsAdded', p.voltas?.length === 2 && p.voltas[0].start === 2 && p.voltas[1].start === 3 && p.navMarks.some((m) => m.kind === 'repeatEnd' && m.bar === 2), { v: p.voltas, m: p.navMarks });
check('laneShowsVoltas', (await page.locator('.volta').allTextContents()).join('|') === '1.|2.', await page.locator('.volta').allTextContents());
await page.screenshot({ path: `${out}/repeats-lane.png` });

// MIDI: played out vs written once.
const midiCounts = await S(async () => {
  const ex = await import('/src/audio/export.ts');
  const p = window.__bf.store.useStore.getState().project;
  const toArr = async (b) => Array.from(new Uint8Array(await b.arrayBuffer()));
  return { played: await toArr(await ex.projectToMidi(p)), once: await toArr(await ex.projectToMidi(p, { repeats: false })) };
});
const played = new Midi(Buffer.from(midiCounts.played)).tracks.find((t) => t.notes.length);
const once = new Midi(Buffer.from(midiCounts.once)).tracks.find((t) => t.notes.length);
const order = await S(async () => { const { barOrder } = await import('/src/model/form.ts'); const p = window.__bf.store.useStore.getState().project; return barOrder(p.navMarks, p.voltas, 4); });
check('midiPlayedOut', played.notes.length === order.length && once.notes.length === 4, { played: played.notes.length, once: once.notes.length, order });

// Score: repeat palette button opens the same options; the score draws repeat barlines + endings.
await S(() => {
  const s = window.__bf.store;
  const p = s.useStore.getState().project;
  const t = p.tracks.find((x) => x.regions.length);
  s.useStore.setState({ dockTab: 'editor', editorMode: 'score', selectedTrackId: t.id, editingRegionId: t.regions[0].id });
});
await page.waitForSelector('.repeat-btn');
await page.waitForTimeout(1200);
await page.click('.repeat-btn');
check('paletteMenu', (await page.locator('.menu-item', { hasText: 'Repeat This Bar' }).count()) === 1);
await page.keyboard.press('Escape');
const svg = await S(() => document.querySelector('.score-svg')?.innerHTML ?? '');
check('scoreVolta', /1\.<\/text>/.test(svg) && /2\.<\/text>/.test(svg), svg.length);
await page.screenshot({ path: `${out}/repeats-score.png` });

const xml = await S(async () => {
  const { buildScore } = await import('/src/ui/editors/score/notation.ts');
  const { toMusicXml } = await import('/src/ui/editors/score/musicxml.ts');
  const { meterOf } = await import('/src/model/timeline.ts');
  const p = window.__bf.store.useStore.getState().project;
  const part = { id: 'p', trackId: 'p', name: 'Lead', abbr: 'Ld', clefs: ['treble'], transpose: 0, writtenKey: p.key, drums: false, notes: [], marks: [] };
  const m = buildScore([part], meterOf(p), 16, 0, 0.25);
  return toMusicXml(m, 'x', ['Lead'], [p.key], p.timeSig, p.bpm, [], { marks: p.navMarks, voltas: p.voltas, barOffset: 0 });
});
check('musicXmlRepeats', /<repeat direction="forward"\/>/.test(xml) && /<repeat direction="backward"\/>/.test(xml) && /<ending number="1" type="start">1\.<\/ending>/.test(xml) && /<ending number="2" type="discontinue"\/>/.test(xml));

// Switching repeats off plays straight through (the lane button).
await S(() => window.__bf.store.useStore.setState({ dockTab: null }));
await page.waitForTimeout(200);
await page.click('.tempo-corner button[title*="follows the repeats"]');
const len2 = await S(async () => (await import('/src/audio/export.ts')).playSeconds(window.__bf.store.useStore.getState().project, 0, 16));
check('repeatsOff', Math.abs(len2 - 8) < 1e-6, len2);
await S(() => window.__bf.store.undo());

// D.S. al Coda via the menu writes the jump and marks.
await openForm(0);
await page.locator('.menu-item', { hasText: /^Segno Here$/ }).click();
await openForm(3);
await page.hover('.menu-item:has-text("Jump After This Bar")');
await page.waitForTimeout(100);
await page.locator('.menu-item', { hasText: /^D\.S\. al Fine$/ }).click();
p = await S(() => window.__bf.store.useStore.getState().project);
check('dsAdded', p.navMarks.some((m) => m.kind === 'segno' && m.bar === 0) && p.navMarks.some((m) => m.kind === 'ds' && m.bar === 3 && m.until === 'fine'), p.navMarks);

check('noErrors', errors.length === 0, errors);
res.__done = true;
console.log(JSON.stringify(res, null, 1));
await browser.close();
