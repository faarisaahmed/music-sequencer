// Grace notes: detected from played/imported MIDI (quick note into a longer one) without
// mistaking fast runs or chords for them; added with ⌥G / the palette; selectable, movable,
// deletable without leaving rests; exported to MusicXML. Usage: node tests/grace-notes.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
await page.goto(url);
await page.waitForTimeout(800);
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? ''); };
const S = (fn, arg) => page.evaluate(fn, arg);
const N = (id, pitch, start, duration) => ({ id, pitch, start, duration, velocity: 0.8 });
const R = await S(async (notes) => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'analog-lead');
  const rid = actions.createEmptyRegion(tid, 0, 12);
  store.commit((d) => void (store.draftRegion(d, rid).notes = notes));
  store.useStore.setState({ editingRegionId: rid, selectedRegionIds: [rid], selectedTrackId: tid, dockTab: 'editor', editorMode: 'score', dockMaximized: true, focusArea: 'editor', selectedNoteIds: [] });
  return rid;
}, [
  N('q', 67, 0, 1), N('g1', 69, 0.94, 0.05), N('main1', 72, 1, 1), // one played grace into C5 on beat 2
  N('r1', 72, 2, 0.25), N('r2', 71, 2.25, 0.25), N('r3', 69, 2.5, 0.25), N('r4', 67, 2.75, 0.25), // a 16th run — not graces
  N('g2', 74, 3.86, 0.06), N('g3', 76, 3.93, 0.06), N('main2', 77, 4, 2), // two quick notes into F5
  N('c1', 60, 6, 0.1), N('c2', 64, 6, 2), // short note played WITH a long one — a chord-ish touch, not a grace
]);
await page.waitForTimeout(1200);
const L = () => S(() => ({ heads: window.__scoreLayout.heads.map((h) => ({ id: h.noteId, g: !!h.grace, t: h.t })), elems: window.__scoreLayout.elems.filter((e) => e.staff === 0 && e.voice === 1).map((e) => e.t) }));
let l = await L();
const graces = l.heads.filter((h) => h.g).map((h) => h.id).sort();
check('detectsGraces', graces.join() === 'g1,g2,g3', graces);
check('runNotGrace', ['r1', 'r2', 'r3', 'r4'].every((id) => l.heads.find((h) => h.id === id && !h.g)), l.heads.filter((h) => h.id.startsWith('r')));
check('shortWithLongNotGrace', !l.heads.find((h) => h.id === 'c1')?.g, l.heads.find((h) => h.id === 'c1'));
check('noTinyRhythms', !l.elems.some((t) => Math.abs(t - Math.round(t * 4) / 4) > 1e-6), l.elems);
// ⌥G adds a grace note before the selected note, a step above.
await S(() => window.__bf.store.useStore.setState({ selectedNoteIds: ['q'] }));
await page.keyboard.down('Alt'); await page.keyboard.press('KeyG'); await page.keyboard.up('Alt');
await page.waitForTimeout(400);
const notes = () => S((rid) => window.__bf.store.findRegion(window.__bf.store.useStore.getState().project, rid).region, R);
let r = await notes();
const added = r.notes.find((n) => n.grace);
check('altGAdds', added && added.pitch === 69 && added.start === 0 && (await S(() => window.__bf.store.useStore.getState().selectedNoteIds.length)) === 1, added);
// The first note of a region can't start earlier; put one on 'main2' instead to check timing.
await S(() => window.__bf.store.useStore.setState({ selectedNoteIds: ['main1'] }));
await page.click('.pal-btn.grace-btn');
await page.waitForTimeout(400);
r = await notes();
const g4 = r.notes.filter((n) => n.grace).sort((a, b) => a.start - b.start).find((n) => n.start > 0.5);
check('paletteAddsBeforeExistingGrace', g4 && g4.start < 0.94 && g4.start > 0.7 && g4.duration <= 0.125, g4);
l = await L();
check('addedShowsAsGrace', l.heads.some((h) => h.id === g4?.id && h.g), l.heads.filter((h) => h.g));
// Select it by clicking its head, move it up a step, delete it — no rests left behind.
const box = await S((id) => { const h = window.__scoreLayout.heads.find((x) => x.noteId === id); const host = document.querySelector('.score-svg').getBoundingClientRect(); const z = parseInt([...document.querySelectorAll('.score-tools .seg button')].find((b) => /%$/.test(b.textContent)).textContent, 10) / 100; return { x: host.left + ((h.x0 + h.x1) / 2) * z, y: host.top + h.y * z }; }, g4.id);
await page.mouse.click(box.x, box.y);
await page.waitForTimeout(150);
const selG = await S(() => window.__bf.store.useStore.getState().selectedNoteIds);
check('clickSelectsGrace', selG.length === 1 && selG[0] === g4.id, selG);
const p0 = g4.pitch;
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150);
r = await notes();
check('arrowMovesGrace', r.notes.find((n) => n.id === g4.id)?.pitch > p0, r.notes.find((n) => n.id === g4.id));
const splitsBefore = (r.restSplits ?? []).length;
await page.keyboard.press('Delete'); await page.waitForTimeout(150);
r = await notes();
check('deleteGraceNoRest', !r.notes.some((n) => n.id === g4.id) && (r.restSplits ?? []).length === splitsBefore, { splits: r.restSplits });
// MusicXML includes grace notes.
const xml = await S(async () => {
  const { buildScore } = await import('/src/ui/editors/score/notation.ts');
  const { toMusicXml } = await import('/src/ui/editors/score/musicxml.ts');
  const r = window.__bf.store.useStore.getState().project.tracks.find((t) => t.instrument === 'analog-lead').regions[0];
  const model = buildScore([{ id: 'p', trackId: 'p', name: 'Lead', abbr: 'Ld', clefs: ['treble'], transpose: 0, writtenKey: { tonic: 0, mode: 'major' }, drums: false, notes: r.notes.map((n) => ({ id: n.id, key: n.id, regionId: r.id, pitch: n.pitch, s: n.start, e: n.start + n.duration, vel: n.velocity, grace: n.grace })), marks: [] }], 4, 12, 1, 0.25);
  return toMusicXml(model, 'T', ['Lead'], [{ tonic: 0, mode: 'major' }], [4, 4], 120);
});
check('musicXmlGrace', (xml.match(/<grace/g) ?? []).length >= 3, (xml.match(/<grace/g) ?? []).length);
const pg = await page.locator('.score-page').boundingBox();
await page.screenshot({ path: out + '/grace.png', clip: { x: pg.x, y: pg.y, width: 820, height: 190 } });
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
