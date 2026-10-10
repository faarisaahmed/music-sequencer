// Swing / groove: warp maths, playback timing (offline render), song vs region swing,
// "write into notes", MIDI export, old-song migration, and the three pickers' UI.
// Usage: node tests/groove.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
await page.goto(url);
await page.waitForTimeout(1000);
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? ''); };

// 1. Warp maths: grid points stay put, off-beats move, triplet lands on 1/3.
const m = await page.evaluate(async () => {
  const g = await import('/src/model/groove.ts');
  const trip8 = { grid: 8, amount: 2 / 3 };
  const s16 = { grid: 16, amount: 0.32 };
  return {
    on: [0, 0.5, 1, 2.5].map((b) => g.warpBeat(b, s16) - b),
    trip: g.warpBeat(0.5, trip8),
    mono: [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.49].map((b) => g.warpBeat(b, s16)),
    labels: [g.grooveLabel(null), g.grooveLabel({ grid: 16, amount: 0.32 }), g.grooveLabel({ grid: 16, amount: 0.44 })],
    pct: g.swingPercent({ grid: 8, amount: 2 / 3 }),
  };
});
check('gridPointsFixed', m.on.every((d) => Math.abs(d) < 1e-9), m.on);
check('tripletLandsOnThird', Math.abs(m.trip - 2 / 3) < 1e-9, m.trip);
check('warpMonotonic', m.mono.every((x, i) => !i || x > m.mono[i - 1]), m.mono);
check('labels', m.labels[0] === 'Off' && m.labels[1] === 'MPC 16th' && m.labels[2] === '16th 61%' && m.pct === 67, m);

// 2. Playback: render a hat on beat 0.25 (16th) and find where it sounds.
const t = await page.evaluate(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((x) => x.id === 'beat').build());
  const p0 = store.useStore.getState().project;
  const drum = p0.tracks.find((x) => x.type === 'drums');
  const { renderProject } = await import('/src/audio/export.ts');
  const mk = (groove, regionGroove) => ({
    ...p0, bpm: 60, groove,
    tracks: [{ ...drum, instrumentParams: {}, regions: [{ ...drum.regions[0], start: 0, offset: 0, length: 4, contentLength: 4, loop: false, groove: regionGroove, notes: [{ id: 'a', pitch: 42, start: 0.25, duration: 0.1, velocity: 1 }] }] }],
  });
  const onset = async (proj) => {
    const b = await renderProject(proj, { start: 0, end: 2 });
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.01) return i / b.sampleRate;
    return -1;
  };
  const r = {};
  r.straight = await onset(mk(null, undefined));
  r.song = await onset(mk({ grid: 16, amount: 1 }, undefined));
  r.regionOverrideStraight = await onset(mk({ grid: 16, amount: 1 }, null));
  r.regionOwn = await onset(mk(null, { grid: 16, amount: 0.5 }));
  r.eighthGridIgnores16 = await onset(mk({ grid: 8, amount: 1 }, undefined));
  return r;
});
// At 60 bpm one beat = 1 s: straight 0.25 s; dotted 16th swing → 0.375 s; amount .5 → 0.3125 s; 8th-grid warps 0.25 → 0.375 too (linear inside the half).
const near = (a, b) => Math.abs(a - b) < 0.006;
// Offsets are measured against the straight hit (the renderer has a constant lead-in).
check('renderSongSwing', near(t.song - t.straight, 0.125), t);
check('regionStraightOverridesSong', near(t.regionOverrideStraight, t.straight), t);
check('regionOwnSwing', near(t.regionOwn - t.straight, 0.0625), t);
check('eighthGridMovesSixteenthsProportionally', near(t.eighthGridIgnores16 - t.straight, 0.125), t);

// 3. Song + region actions, bake, MIDI export, migration.
const a = await page.evaluate(async () => {
  const { actions, store } = window.__bf;
  const p = store.useStore.getState().project;
  const drum = p.tracks.find((x) => x.type === 'drums');
  const rid = drum.regions[0].id;
  actions.setSongGroove({ grid: 16, amount: 0.32 });
  const songSet = store.useStore.getState().project.groove?.amount === 0.32;
  actions.setRegionGroove([rid], { grid: 8, amount: 2 / 3 });
  const own = store.findRegion(store.useStore.getState().project, rid).region.groove?.grid === 8;
  actions.setRegionGroove([rid], undefined);
  const follows = store.findRegion(store.useStore.getState().project, rid).region.groove === undefined;
  // Bake: an off-beat 16th moves, an on-beat note stays, region becomes straight.
  store.commit((d) => { const r = store.draftRegion(d, rid); r.notes = [{ id: 'x1', pitch: 36, start: 0, duration: 0.25, velocity: 1 }, { id: 'x2', pitch: 42, start: 0.25, duration: 0.25, velocity: 1 }]; });
  const moved = actions.bakeGroove([rid]);
  const r = store.findRegion(store.useStore.getState().project, rid).region;
  const baked = { moved, starts: r.notes.map((n) => n.start), groove: r.groove };
  store.undo();
  // MIDI export writes swing.
  const { projectToMidi, parseMidiFile } = await import('/src/audio/export.ts');
  const blob = await projectToMidi(store.useStore.getState().project);
  const midi = await parseMidiFile(blob);
  const ticks = midi.tracks.flatMap((tr) => tr.notes).filter((n) => n.pitch === 42).map((n) => n.start);
  // Old songs: pattern `swing` number becomes a region groove.
  const old = { ...store.useStore.getState().project };
  old.tracks = old.tracks.map((tr) => ({ ...tr, regions: tr.regions.map((rg) => ({ ...rg, groove: undefined, swing: 0.4 })) }));
  const mig = actions.migrate(old);
  const mr = mig.tracks.find((x) => x.type === 'drums').regions[0];
  return { songSet, own, follows, baked, ticks, mig: { groove: mr.groove, hasSwing: 'swing' in mr } };
});
check('songGroove', a.songSet, a);
check('regionOwnAndFollow', a.own && a.follows, a);
check('bake', a.baked.moved === 2 && a.baked.starts[0] === 0 && Math.abs(a.baked.starts[1] - (0.25 + 0.32 * 0.125)) < 1e-9 && a.baked.groove === null, a.baked);
check('midiExportSwung', a.ticks.length > 0 && a.ticks.some((x) => Math.abs((x % 0.5) - 0.25) > 0.02), a.ticks.slice(0, 6));
check('migrateOldSwing', a.mig.groove?.grid === 16 && Math.abs(a.mig.groove.amount - 0.4) < 1e-9 && !a.mig.hasSwing, a.mig);

// 4. UI: LCD picker → preset sets song swing; Beat Sequencer & Piano Roll pickers open.
await page.evaluate(() => window.__bf.actions.setSongGroove(null));
await page.click('.lcd-cell[title^="Song swing"]');
await page.waitForTimeout(250);
await page.screenshot({ path: out + '/groove-song.png' });
await page.click('.groove-preset:has-text("Shuffle")');
const lcd = await page.evaluate(() => [window.__bf.store.useStore.getState().project.groove, document.querySelector('.lcd-cell[title^="Song swing"]').innerText]);
check('lcdPresetSetsSong', lcd[0]?.grid === 8 && /67%/.test(lcd[1]), lcd);
await page.mouse.click(60, 700); // outside closes
await page.waitForTimeout(150);
check('outsideCloses', (await page.locator('.groove-pop').count()) === 0);
await page.evaluate(() => { const s = window.__bf.store.useStore.getState(); const d = s.project.tracks.find((x) => x.type === 'drums'); window.__bf.store.useStore.setState({ editingRegionId: d.regions[0].id, selectedRegionIds: [d.regions[0].id], dockTab: 'editor', editorMode: 'steps', dockHeight: 470 }); });
await page.waitForTimeout(400);
await page.click('.ss-swing');
await page.waitForTimeout(250);
await page.screenshot({ path: out + '/groove-steps.png' });
await page.click('.groove-pop .groove-preset:has-text("Boom Bap")');
const rg = await page.evaluate(() => { const s = window.__bf.store.useStore.getState(); return s.project.tracks.find((x) => x.type === 'drums').regions[0].groove; });
check('stepsPresetSetsRegion', rg?.grid === 16 && Math.abs(rg.amount - 0.48) < 1e-9, rg);
await page.click('.ss-swing'); // toggle closed
await page.waitForTimeout(150);
check('toggleCloses', (await page.locator('.groove-pop').count()) === 0);
await page.evaluate(() => { const s = window.__bf.store.useStore.getState(); const t = s.project.tracks.find((x) => x.type === 'instrument'); const id = window.__bf.actions.createEmptyRegion(t.id, 0); window.__bf.store.useStore.setState({ editingRegionId: id, selectedRegionIds: [id], dockTab: 'editor', editorMode: 'pianoroll' }); });
await page.waitForTimeout(400);
await page.click('.pr-toolbar button:has-text("Swing")');
await page.waitForTimeout(250);
const prBox = await page.locator('.groove-pop').boundingBox();
check('pianoRollPickerVisible', prBox && prBox.height > 200 && prBox.y + prBox.height <= 900 && prBox.x >= 0 && prBox.x + prBox.width <= 1440, prBox);
await page.screenshot({ path: out + '/groove-pianoroll.png' });
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
