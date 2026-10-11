// Check My Writing: out-of-range notes, half-step rubs between parts, held notes against the
// chord, parallel fifths — listed with hints, filterable, clickable (selects the notes), marked
// in the score, and quiet for well-written music. Usage: node tests/review.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
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

const ids = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const N = (id, pitch, start, duration) => ({ id, pitch, start, duration, velocity: 0.8 });
  const p0 = store.useStore.getState().project;
  const piano = p0.tracks[0].id;
  const tp = actions.addTrack('instrument', 'trumpet');
  const vn = actions.addTrack('instrument', 'violin');
  const vc = actions.addTrack('instrument', 'cello');
  const fl = actions.addTrack('instrument', 'flute');
  const r = (t) => actions.createEmptyRegion(t, 0, 16);
  const rp = r(piano), rt = r(tp), rv = r(vn), rc = r(vc), rf = r(fl);
  store.commit((d) => {
    store.draftRegion(d, rt).notes = [N('high', 90, 0, 1), N('ok', 70, 1, 1)];
    // Violin and cello move up together a fifth apart.
    store.draftRegion(d, rv).notes = [N('v1', 72, 4, 1), N('v2', 74, 5, 1), N('v3', 76, 6, 1)];
    store.draftRegion(d, rc).notes = [N('c1', 65, 4, 1), N('c2', 67, 5, 1), N('c3', 69, 6, 1)];
    // Piano holds C4 while the flute holds C#5: a half-step rub.
    store.draftRegion(d, rp).notes = [N('pc', 60, 8, 4)];
    // Flute F5 held over a C major chord (a half step above E).
    store.draftRegion(d, rf).notes = [N('fc', 73, 8, 4), N('ff', 77, 12, 2)];
    d.chords = [{ id: 'ch', beat: 12, length: 4, root: 0, quality: '' }];
  });
  return { rt };
});

// Open the Check tab from the top bar.
await page.click('.tb[data-cmd="view.review"]');
await page.waitForSelector('.review');
const counts = Object.fromEntries(await Promise.all((await page.locator('.review-chip').all()).map(async (c) => [((await c.textContent()) ?? '').replace(/\d+$/, '').trim(), Number(await c.locator('em').textContent())])));
check('findsEach', counts.Range === 1 && counts.Rubs === 1 && counts.Chords === 1 && counts.Parallels === 1, counts);
const titles = await page.locator('.review-text').allTextContents();
check('rangeTitle', titles.some((t) => /Trumpet: F#6 is too high for a real trumpet/.test(t)), titles);
check('parallelTitle', titles.some((t) => /Parallel fifths: Violin and Cello/.test(t)), titles);
check('rubTitle', titles.some((t) => /C#5 in Flute rubs against C4 in Grand Piano|C4 in Grand Piano rubs against C#5 in Flute/.test(t)), titles);

// Filter, click to reveal the hint and select the notes.
await page.locator('.review-chip', { hasText: 'Range' }).click();
check('filter', (await page.locator('.review-item').count()) === 1);
await page.locator('.review-item').first().click();
check('hint', /plays from/.test(await page.locator('.review-hint').textContent()));
const sel = await S(() => window.__bf.store.useStore.getState().selectedNoteIds);
check('selectsNotes', sel.length === 1 && sel[0] === 'high', sel);
await page.screenshot({ path: `${out}/review.png` });

// The score marks the out-of-range note in red.
await S((rt) => window.__bf.store.useStore.setState({ dockTab: 'editor', editorMode: 'score', editingRegionId: rt }), ids.rt);
await page.waitForTimeout(1500);
check('scoreMarked', /#d70015/.test(await S(() => document.querySelector('.score-svg')?.innerHTML ?? '')));
// "Mark notes" off clears the colours.
await S(() => window.__bf.store.useStore.setState({ dockTab: 'review' }));
await page.click('.review-head button:has-text("Mark notes")');
await S(() => window.__bf.store.useStore.setState({ dockTab: 'editor' }));
await page.waitForTimeout(1200);
check('marksOff', !/#d70015/.test(await S(() => document.querySelector('.score-svg')?.innerHTML ?? '')));

// Good writing: contrary motion, in range, chord tones → nothing flagged.
const clean = await S(async () => {
  const { reviewSong } = await import('/src/model/review.ts');
  const p = window.__bf.store.useStore.getState().project;
  const t = (inst, notes) => ({ ...p.tracks[1], id: inst, name: inst, instrument: inst, transpose: 0, regions: [{ ...p.tracks[1].regions[0], id: 'r' + inst, notes }] });
  const N = (id, pitch, start) => ({ id, pitch, start, duration: 1, velocity: 0.8 });
  const q = { ...p, chords: [{ id: 'c', beat: 0, length: 8, root: 0, quality: '' }], tracks: [t('violin', [N('a', 72, 0), N('b', 74, 1), N('c', 76, 2)]), t('cello', [N('d', 48, 0), N('e', 47, 1), N('f', 45, 2)])] };
  return reviewSong(q).map((i) => i.title);
});
check('quietWhenFine', clean.length === 0, clean);

check('noErrors', errors.length === 0, errors);
res.__done = true;
console.log(JSON.stringify(res, null, 1));
await browser.close();
