import { chromium } from 'playwright';
// Beat Sequencer patterns: linking, unique, split safety, pattern play, swing, row mute/solo,
// own sounds, loop-bars review, lane stamping. Usage: node tests/beat-patterns.mjs <chromium> <url> <outdir>
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1440), height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
await page.goto(url);
await page.waitForTimeout(1000);
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? ''); };
// New song from the "beat" template.
await page.evaluate(async () => { const { actions, templates } = window.__bf; await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'beat').build()); });
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const p = window.__bf.store.useStore.getState().project;
  const t = p.tracks.find((x) => x.type === 'drums');
  return { trackId: t.id, regions: t.regions.map((r) => ({ id: r.id, pid: r.patternId, loop: r.loop, start: r.start, cl: r.contentLength, len: r.length, n: r.notes.length })) };
});
console.log('drum track:', JSON.stringify(info));
const T = info.trackId; const R = info.regions[0].id;
check('templateHasPattern', !!info.regions[0].pid);
// Place two linked copies at bars 9 and 10.
const ids = await page.evaluate(({ T, R }) => { const a = window.__bf.actions; return [a.placePattern(T, 32, R), a.placePattern(T, 36, R)]; }, { T, R });
// Edit the original: add a note → both copies follow.
await page.evaluate(({ R }) => window.__bf.store.commit((d) => { const r = window.__bf.store.draftRegion(d, R); r.notes.push({ id: 'zz', pitch: 39, start: 0.5, duration: 0.25, velocity: 0.8 }); }), { R });
const linked = await page.evaluate(({ ids }) => { const p = window.__bf.store.useStore.getState().project; return ids.map((id) => window.__bf.store.findRegion(p, id).region.notes.some((n) => n.pitch === 39 && n.start === 0.5)); }, { ids });
check('editPropagates', linked.every(Boolean), linked);
// Undo removes it everywhere.
await page.evaluate(() => window.__bf.store.undo());
const undone = await page.evaluate(({ ids, R }) => { const p = window.__bf.store.useStore.getState().project; return [R, ...ids].map((id) => window.__bf.store.findRegion(p, id).region.notes.some((n) => n.pitch === 39 && n.start === 0.5)); }, { ids, R });
check('undoAll', undone.every((x) => !x), undone);
// Make unique: editing it no longer changes the others.
await page.evaluate(({ id }) => window.__bf.actions.makePatternUnique(id), { id: ids[1] });
await page.evaluate(({ id }) => window.__bf.store.commit((d) => { window.__bf.store.draftRegion(d, id).notes = []; }), { id: ids[1] });
const uniq = await page.evaluate(({ R, ids }) => { const p = window.__bf.store.useStore.getState().project; const f = (id) => window.__bf.store.findRegion(p, id).region; return { orig: f(R).notes.length, copy: f(ids[0]).notes.length, uniq: f(ids[1]).notes.length, name: f(ids[1]).name }; }, { R, ids });
check('makeUnique', uniq.orig > 0 && uniq.copy === uniq.orig && uniq.uniq === 0, uniq);
// Split a linked clip in the middle: other clips keep all notes.
const before = uniq.orig;
await page.evaluate(({ id }) => { const p = window.__bf.store.useStore.getState().project; const r = window.__bf.store.findRegion(p, id).region; window.__bf.actions.splitRegionsAt([id], r.start + r.length / 2); }, { id: ids[0] });
const afterSplit = await page.evaluate(({ R }) => window.__bf.store.findRegion(window.__bf.store.useStore.getState().project, R).region.notes.length, { R });
check('splitSafe', afterSplit === before, { before, afterSplit });
// Turning loop off unlinks that clip only.
await page.evaluate(({ id }) => window.__bf.actions.toggleLoopRegions([id]), { id: ids[0] });
const unl = await page.evaluate(({ R, id }) => { const p = window.__bf.store.useStore.getState().project; const f = (x) => window.__bf.store.findRegion(p, x).region; return { pid: f(id).patternId ?? null, orig: f(R).notes.length }; }, { R, id: ids[0] });
check('loopOffUnlinks', unl.pid === null && unl.orig === before, unl);
// Pattern play: loops inside the clip, song cycle untouched.
const loopBefore = await page.evaluate(() => JSON.stringify(window.__bf.store.useStore.getState().project.loop));
await page.evaluate(async ({ R }) => { const e = await window.__bf.engine(); await e.playPattern(R); }, { R });
const positions = [];
for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); positions.push(await page.evaluate(async () => (await window.__bf.engine()).position)); }
const r0 = info.regions[0];
const pp = await page.evaluate(() => window.__bf.store.useStore.getState().patternPlay);
await page.evaluate(async () => (await window.__bf.engine()).stop());
const loopAfter = await page.evaluate(() => JSON.stringify(window.__bf.store.useStore.getState().project.loop));
const inside = positions.every((x) => x >= r0.start - 0.01 && x < r0.start + Math.min(r0.len, r0.cl) + 0.3);
const wrapped = positions.some((x, i) => i && x < positions[i - 1]);
check('patternPlayLoops', inside && (wrapped || Math.min(r0.len, r0.cl) > 6) && pp === R, { positions: positions.map((x) => x.toFixed(2)), r0, pp });
check('songLoopUntouched', loopBefore === loopAfter);
check('patternPlayClears', (await page.evaluate(() => window.__bf.store.useStore.getState().patternPlay)) === null);
// Swing + row silence helpers.
const sw = await page.evaluate(async () => { const m = await import('/src/audio/schedule.ts'); const g = await import('/src/model/groove.ts'); return [g.warpBeat(0.25, { grid: 16, amount: 0.5 }) - 0.25, g.warpBeat(0.5, { grid: 16, amount: 0.5 }) - 0.5, g.warpBeat(0.75, { grid: 16, amount: 1 }) - 0.75, [...m.silentRows({ mute36: 1 })], m.silentRows({ solo38: 1 }).has(36), m.silentRows({ solo38: 1 }).has(38)]; });
check('swing', sw[0] === 0.0625 && sw[1] === 0 && sw[2] === 0.125, sw);
check('rowMuteSolo', sw[3].length === 1 && sw[3][0] === 36 && sw[4] === true && sw[5] === false, sw);
// Own sound on a custom row renders in export; muted row is silent.
const rend = await page.evaluate(async ({ T }) => {
  const { store, audioStore, actions } = window.__bf;
  const ctx = new OfflineAudioContext(1, 44100 * 0.3, 44100);
  const o = ctx.createOscillator(); o.frequency.value = 440; o.connect(ctx.destination); o.start();
  const buf = await ctx.startRendering();
  await audioStore.addBuffer('aud_test', buf, 'beep');
  actions.updateTrack(T, (t) => { t.drumSamples = { 88: { audioId: 'aud_test', name: 'beep' } }; });
  const base = store.useStore.getState().project;
  const solo = { ...base, tracks: base.tracks.filter((t) => t.id === T).map((t) => ({ ...t, regions: [{ ...t.regions[0], start: 0, offset: 0, notes: [{ id: 'q', pitch: 88, start: 0, duration: 1, velocity: 1 }] }] })) };
  const { renderProject } = await import('/src/audio/export.ts');
  const peak = (b) => { let m = 0; const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; };
  const a = await renderProject(solo, { start: 0, end: 2 });
  const muted = { ...solo, tracks: solo.tracks.map((t) => ({ ...t, instrumentParams: { ...t.instrumentParams, mute88: 1 } })) };
  const b = await renderProject(muted, { start: 0, end: 2 });
  return { own: peak(a), muted: peak(b) };
}, { T });
check('ownSoundRenders', rend.own > 0.05 && rend.muted < 0.01, rend);
// Ruler double-click loops a bar; Shift+C loops selection.
await page.evaluate(() => window.__bf.store.useStore.setState({ selectedRegionIds: [], editingRegionId: null, dockTab: null }));
const box = await page.locator('.tv-ruler').boundingBox();
const ppb = await page.evaluate(() => window.__bf.store.useStore.getState().pxPerBeat);
await page.mouse.dblclick(box.x + ppb * 4 * 2 + 10, box.y + box.height - 6);
const lp = await page.evaluate(() => window.__bf.store.useStore.getState().project.loop);
check('rulerDblClickLoopsBar', lp.enabled && lp.start === 8 && lp.end === 12, lp);
await page.evaluate(({ id }) => window.__bf.store.useStore.setState({ selectedRegionIds: [id], focusArea: 'tracks' }), { id: ids[1] });
await page.keyboard.press('Shift+C');
const lp2 = await page.evaluate(() => window.__bf.store.useStore.getState().project.loop);
check('shiftCLoopsSelection', lp2.enabled && lp2.start === 36 && lp2.end === 44, lp2);
// Lane double-click stamps the current pattern (linked).
await page.evaluate(({ R }) => window.__bf.store.useStore.setState({ editingRegionId: R, selectedRegionIds: [R], pxPerBeat: 12 }), { R });
await page.waitForTimeout(300);
const laneBox = await page.locator('.track-lane').nth(0).boundingBox();
const nBefore = await page.evaluate(({ T }) => window.__bf.store.useStore.getState().project.tracks.find((t) => t.id === T).regions.length, { T });
const drumLaneIdx = await page.evaluate(({ T }) => window.__bf.store.useStore.getState().project.tracks.findIndex((t) => t.id === T), { T });
const lane = page.locator('.track-lane').nth(drumLaneIdx);
const lb = await lane.boundingBox();
const ppb2 = 12;
await page.mouse.dblclick(lb.x + ppb2 * 4 * 13 + 5, lb.y + lb.height / 2);
const stamped = await page.evaluate(({ T, R }) => { const t = window.__bf.store.useStore.getState().project.tracks.find((t) => t.id === T); const o = t.regions.find((r) => r.id === R); const last = t.regions[t.regions.length - 1]; return { n: t.regions.length, linked: last.patternId === o.patternId, start: last.start }; }, { T, R });
check('laneStampsPattern', stamped.n === nBefore + 1 && stamped.linked && stamped.start === 52, stamped);
// Screenshot the sequencer.
await page.evaluate(({ R, T }) => { window.__bf.store.useStore.setState({ editingRegionId: R, selectedRegionIds: [R], selectedTrackId: T, dockTab: 'editor', editorMode: 'steps', dockHeight: 470 }); window.__bf.actions.updateTrack(T, (t) => { t.instrumentParams.solo38 = 0; t.instrumentParams.mute46 = 1; t.instrumentParams.pan42 = -0.4; }); }, { R, T });
await page.waitForTimeout(700);
await page.screenshot({ path: out + '/seq.png' });
await page.evaluate(async ({ R }) => (await window.__bf.engine()).playPattern(R), { R });
await page.waitForTimeout(500);
await page.screenshot({ path: out + '/seq-playing.png' });
await page.evaluate(async () => (await window.__bf.engine()).stop());
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
