// Takes: cycle-recording audio makes one take per pass (last complete one plays), recording again from
// the same spot adds a take, the region's take chip and menu switch takes, splitting lets each half use
// a different take, takes survive save + reopen, "Keep Only This Take", and MIDI cycle recording still merges.
// Uses Chromium's fake microphone. Usage: node tests/takes.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
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

// A 120 BPM song (one 4/4 bar = 2 s) with an audio track, cycle over bar 1, no count-in.
const tid = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const id = actions.addTrack('audio');
  store.commit((d) => {
    d.bpm = 120;
    d.countIn = false;
    d.loop = { enabled: true, start: 0, end: 4 };
  });
  store.useStore.setState({ selectedTrackId: id, cursor: 0 });
  return id;
});
await page.waitForTimeout(500);
const region = () =>
  S((tid) => {
    const t = window.__bf.store.useStore.getState().project.tracks.find((x) => x.id === tid);
    return t.regions.map((r) => ({ id: r.id, start: r.start, length: r.length, offset: r.offset, audioId: r.audioId, takes: r.takes?.map((k) => k.audioId) ?? null, names: r.takes?.map((k) => k.name) ?? null }));
  }, tid);
const record = async (ms) => {
  await page.click('body', { position: { x: 700, y: 600 } }).catch(() => {});
  await S(async () => (await window.__bf.engine()).record());
  await page.waitForTimeout(ms);
  await S(async () => (await window.__bf.engine()).stop());
  await page.waitForTimeout(1200);
};

// Cycle recording over ~2 passes → a take per pass (a last pass under a third long is dropped).
await record(4200);
let rs = await region();
const N = rs[0]?.takes?.length ?? 0;
check('cycle recording makes one take per pass', rs.length === 1 && N >= 2 && N <= 3 && rs[0].length === 4, rs);
const playing = rs[0]?.takes?.indexOf(rs[0].audioId);
check('a complete take plays (the last full pass)', playing === 1, rs);
check('takes are named', rs[0]?.names?.every((x, i) => x === 'Take ' + (i + 1)), rs[0]?.names);

// The take chip shows 2/2 and its menu switches to take 1.
const chip = page.locator('.region-take');
check('take chip shows', (await chip.count()) === 1 && (await chip.textContent()).trim() === `2/${N}`, await chip.textContent());
await chip.click();
await page.waitForTimeout(200);
await page.locator('.menu-item:has-text("Take 1")').click();
await page.waitForTimeout(200);
rs = await region();
check('menu switches take', rs[0].audioId === rs[0].takes[0] && (await chip.textContent()).trim() === `1/${N}`, rs);
await S(() => window.__bf.store.undo());

// Recording again from the same spot (cycle off) adds a third take to the same region.
await S(() => {
  const { store } = window.__bf;
  store.commit((d) => {
    d.loop.enabled = false;
  });
  store.useStore.setState({ cursor: 0 });
});
await record(1500);
rs = await region();
check('recording again from the same spot adds a take', rs.length === 1 && rs[0].takes?.length === N + 1 && rs[0].audioId === rs[0].takes[N], rs);

// Every take's audio is kept with the song.
const ids = await S(async () => {
  const { store } = window.__bf;
  const m = await import('/src/state/persistence.ts');
  return m.projectAudioIds(store.useStore.getState().project);
});
check('all takes count as song audio', rs[0].takes.every((id) => ids.includes(id)), { ids, takes: rs[0].takes });

// Split at beat 2: both halves keep the takes, and each can play a different one (comping).
await S(([rid]) => window.__bf.actions.splitRegionsAt([rid], 2), [rs[0].id]);
rs = await region();
const [a, b] = rs.sort((x, y) => x.start - y.start);
await S(([aid, bid, t0, t1]) => {
  window.__bf.actions.chooseTake(aid, t0);
  window.__bf.actions.chooseTake(bid, t1);
}, [a.id, b.id, a.takes[0], a.takes[1]]);
rs = (await region()).sort((x, y) => x.start - y.start);
check('split halves keep takes and can differ', rs.length === 2 && rs[0].takes?.length === N + 1 && rs[1].takes?.length === N + 1 && rs[0].audioId === rs[0].takes[0] && rs[1].audioId === rs[1].takes[1] && rs[1].offset === 2, rs);

// Right-click menu has the Takes submenu.
await page.locator('.region.audio').first().click({ button: 'right' });
await page.waitForTimeout(200);
check('region menu lists takes', (await page.locator(`.menu-item:has-text("Takes (1 of ${N + 1})")`).count()) === 1);
await page.keyboard.press('Escape');

// Save, close, reopen: takes and their audio come back.
const pid = await S(async () => {
  const { actions, store } = window.__bf;
  const id = store.useStore.getState().project.id;
  await actions.closeProject();
  await actions.openProjectById(id);
  return id;
});
await page.waitForTimeout(1500);
rs = (await region()).sort((x, y) => x.start - y.start);
const loaded = await S((list) => list.every((id) => !!window.__bf.audioStore.getBuffer(id)), rs[0].takes ?? []);
check('takes survive reopening', !!pid && rs.length === 2 && rs[0].takes?.length === N + 1 && loaded, { rs, loaded });

// Keep Only This Take.
await S((rid) => window.__bf.actions.deleteOtherTakes(rid), rs[1].id);
rs = (await region()).sort((x, y) => x.start - y.start);
check('keep only this take', rs[1].takes === null && rs[1].audioId && rs[0].takes?.length === N + 1, rs);
await page.screenshot({ path: out + '/takes.png' });

// MIDI cycle recording still merges passes into one region.
const midi = await S(async () => {
  const { actions, store } = window.__bf;
  const id = actions.addTrack('instrument', 'grand-piano');
  store.commit((d) => {
    d.loop = { enabled: true, start: 0, end: 4 };
  });
  store.useStore.setState({ selectedTrackId: id, cursor: 0 });
  const eng = await window.__bf.engine();
  await eng.record();
  const hit = (p) => {
    eng.noteOn(id, p, 0.8);
    setTimeout(() => eng.noteOff(id, p), 200);
  };
  await new Promise((r) => setTimeout(r, 500));
  hit(60);
  await new Promise((r) => setTimeout(r, 2000));
  hit(64);
  await new Promise((r) => setTimeout(r, 700));
  eng.stop();
  await new Promise((r) => setTimeout(r, 400));
  const t = store.useStore.getState().project.tracks.find((x) => x.id === id);
  return { regions: t.regions.length, notes: t.regions[0]?.notes?.length ?? 0 };
});
check('MIDI cycle recording still merges', midi.regions === 1 && midi.notes === 2, midi);

check('no page errors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
const fails = Object.values(res).filter((v) => v !== 'ok').length;
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
