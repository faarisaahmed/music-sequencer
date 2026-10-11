// Parts: the Print Parts window (from Export and the score), a part per player with title,
// composer and instrument, transposed parts for B♭ instruments, multi-bar rests (kept apart at
// repeats/sections), full score first, paper size, MusicXML per part, and ⌘P.
// Usage: node tests/parts.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
process.on('exit', () => !res.__done && console.log('PARTIAL', JSON.stringify(res, null, 1)));
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 300); };
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(url);
await page.waitForTimeout(800);

// A song: trumpet melody in bars 1–2 and 11–12, piano chords throughout, flute only in bar 12.
await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tp = actions.addTrack('instrument', 'trumpet');
  const fl = actions.addTrack('instrument', 'flute');
  const p0 = store.useStore.getState().project;
  const piano = p0.tracks[0].id;
  const r1 = actions.createEmptyRegion(tp, 0, 48);
  const r2 = actions.createEmptyRegion(fl, 0, 48);
  const r3 = actions.createEmptyRegion(piano, 0, 48);
  store.commit((d) => {
    d.name = 'Brass Test';
    d.info = { composer: 'F. Ahmed' };
    d.key = { tonic: 0, mode: 'major' };
    store.draftRegion(d, r1).notes = [0, 1, 2, 3, 4, 5, 40, 41, 44].map((b, i) => ({ id: 't' + i, pitch: 67 + (i % 3), start: b, duration: 1, velocity: 0.8 }));
    store.draftRegion(d, r2).notes = [{ id: 'f0', pitch: 79, start: 44, duration: 4, velocity: 0.8 }];
    store.draftRegion(d, r3).notes = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, pitch: 60, start: i * 4, duration: 4, velocity: 0.7 }));
    d.sections = [{ id: 's', name: 'B', start: 32, length: 16, color: '#09f' }];
  });
});

// Stub the print window so we can read what would be printed.
await S(() => {
  window.__printed = [];
  window.open = () => {
    const doc = { html: '', write(h) { this.html += h; }, close() {} };
    window.__printed.push(doc);
    return { document: doc, focus() {}, print() { window.__didPrint = true; } };
  };
});

// From the Export dialog.
await S(() => window.__bf.store.openModal('export'));
await page.click('.export-parts');
await page.waitForSelector('.parts-list');
check('partsListed', (await page.locator('.parts-item span').allTextContents()).join('|') === 'Grand Piano|Trumpet|Flute', await page.locator('.parts-item span').allTextContents());
await page.waitForSelector('.parts-page svg');
check('previewRenders', (await page.locator('.parts-page svg').count()) === 1);

// Transposed trumpet: preview shows "Trumpet in B♭" and the part is written in D major.
await page.locator('.parts-item', { hasText: 'Trumpet' }).click();
await page.waitForTimeout(400);
const tpPreview = await page.locator('.parts-page').innerHTML();
check('trumpetLabel', /Trumpet in B♭/.test(tpPreview) && /F\. Ahmed/.test(tpPreview) && /Brass Test/.test(tpPreview));
const keys = await S(async () => {
  const { buildSource } = await import('/src/ui/editors/score/source.ts');
  const p = window.__bf.store.useStore.getState().project;
  const t = p.tracks.find((x) => x.instrument === 'trumpet');
  return { transposed: buildSource(p, true, undefined, 0.25, 'auto', false, [t.id]).parts[0].writtenKey, concert: buildSource(p, true, undefined, 0.25, 'auto', true, [t.id]).parts[0].writtenKey };
});
check('transposedKey', keys.transposed.tonic === 2 && keys.concert.tonic === 0, keys);

// Multi-bar rests: the flute rests 11 bars, but the section at bar 9 keeps bars 1–8 and 9–11 apart.
const runs = await S(async () => {
  const { buildSource } = await import('/src/ui/editors/score/source.ts');
  const { compressRests } = await import('/src/ui/editors/score/notation.ts');
  const p = window.__bf.store.useStore.getState().project;
  const fl = p.tracks.find((x) => x.instrument === 'flute');
  const src = buildSource(p, true, undefined, 0.25, 'auto', false, [fl.id]);
  const m = compressRests(src.model, new Set([8]));
  return { before: src.model.measures.length, after: m.measures.map((x) => [x.number, x.restRun ?? 1]) };
});
check('multiRests', runs.after[0][1] === 8 && runs.after[1][0] === 8 && runs.after[1][1] === 3 && runs.after.length < runs.before, runs);

// Print: full score + 3 parts, each part starting on its own page, footers name the part.
await page.locator('.parts-opts label', { hasText: 'Full score first' }).locator('.toggle').click();
await page.click('.parts-print');
await page.waitForTimeout(800);
const printed = await S(() => ({ html: window.__printed.at(-1)?.html ?? '', did: !!window.__didPrint }));
const footers = [...printed.html.matchAll(/<footer>([^<]*)<\/footer>/g)].map((m) => m[1]);
check('printJob', printed.did && footers.some((f) => /Full score/.test(f)) && footers.some((f) => /Trumpet in B♭/.test(f)) && footers.some((f) => /Flute/.test(f)) && footers.some((f) => /Grand Piano/.test(f)), footers);
check('a4', /size:A4 portrait/.test(printed.html));
check('multiRestDrawn', /multirest/.test(printed.html));

// Paper size and remembered options.
await page.click('.parts-opts .seg button:has-text("Letter")');
await page.click('.parts-print');
await page.waitForTimeout(500);
check('letter', /size:Letter portrait/.test(await S(() => window.__printed.at(-1).html)));
check('prefsSaved', await S(() => JSON.parse(localStorage.getItem('bf.parts')).paper === 'letter' && JSON.parse(localStorage.getItem('bf.parts')).fullScore === true));

// MusicXML: one file per chosen part.
await page.locator('.parts-item', { hasText: 'Grand Piano' }).locator('input').uncheck();
const files = [];
page.on('download', (d) => files.push(d.suggestedFilename()));
await page.click('.modal-foot button:has-text("MusicXML")');
await page.waitForTimeout(800);
check('xmlPerPart', files.length === 2 && files.some((f) => /Trumpet/.test(f)) && files.some((f) => /Flute/.test(f)), files);
await page.screenshot({ path: `${out}/parts.png` });

// ⌘P opens it from anywhere in the song.
await S(() => window.__bf.store.closeModal());
await page.keyboard.press('Meta+KeyP');
await page.waitForTimeout(400);
check('cmdP', (await page.locator('.parts-list').count()) === 1);

check('noErrors', errors.length === 0, errors);
res.__done = true;
console.log(JSON.stringify(res, null, 1));
await browser.close();
