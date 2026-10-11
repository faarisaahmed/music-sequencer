// Score editor, Flat / Noteflight model: every bar is notes and rests; you select a note or a
// rest (a whole rest is one thing), change its value, type or click to turn a rest into a note,
// Delete leaves a rest of the same value, and clicks never land in the middle of a rest.
// Also: chords by clicking above/below, ⌥3, box select, held notes in a second voice.
// Usage: node tests/score-editing.mjs <chromium> <url> <outdir>
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

const R = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'analog-lead');
  const rid = actions.createEmptyRegion(tid, 0, 16);
  store.useStore.setState({ editingRegionId: rid, selectedRegionIds: [rid], selectedTrackId: tid, dockTab: 'editor', editorMode: 'score', dockMaximized: true, selectedNoteIds: [], focusArea: 'editor' });
  return rid;
});
await page.waitForTimeout(1200);
const notes = () => S((rid) => window.__bf.store.findRegion(window.__bf.store.useStore.getState().project, rid).region.notes.map((n) => ({ id: n.id, p: n.pitch, s: n.start, d: n.duration })).sort((a, b) => a.s - b.s || a.p - b.p), R);
const elems = (m) => S((m) => window.__scoreLayout.elems.filter((e) => e.measure === m && e.staff === 0 && e.voice === 1).map((e) => ({ t: e.t, t1: e.t1, rest: e.rest })).sort((a, b) => a.t - b.t), m);
const restSelBox = () => S(() => !!document.querySelector('.score-rest-sel'));
const at = (m, beat, step) =>
  S(async ({ m, beat, step }) => {
    const L = window.__scoreLayout;
    const { beatToX } = await import('/src/ui/editors/score/render.ts');
    const sys = L.systems.find((s) => s.measures.some((x) => x.index === m));
    const mg = sys.measures.find((x) => x.index === m);
    const sg = sys.staves[0];
    const host = document.querySelector('.score-svg').getBoundingClientRect();
    const zoom = parseInt([...document.querySelectorAll('.score-tools .seg button')].find((b) => /%$/.test(b.textContent)).textContent, 10) / 100;
    return { x: host.left + beatToX(mg, beat, L.bpb) * zoom, y: host.top + (sg.topLineY + (step * sg.spacing) / 2) * zoom };
  }, { m, beat, step });
const click = async (m, beat, step, mods = []) => {
  const p = await at(m, beat, step);
  for (const k of mods) await page.keyboard.down(k);
  await page.mouse.click(p.x, p.y);
  for (const k of mods) await page.keyboard.up(k);
  await page.waitForTimeout(150);
};
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };

// 1. The editor opens with bar 1's whole rest selected.
check('opensWithRestSelected', await restSelBox());
// 2. Quarter (5) on the whole rest → quarter rest + rests for the rest of the bar.
await key('5');
let e1 = await elems(0);
check('restValueSplits', e1.length >= 2 && e1[0].rest && e1[0].t === 0 && e1[0].t1 === 1 && e1.every((x) => x.rest), e1);
// 3. Typing G A B fills the selected rest, then the next ones.
await key('g'); await key('a'); await key('b');
let n = await notes();
check('typingFillsRests', n.map((x) => `${x.p}@${x.s}/${x.d}`).join() === '67@0/1,69@1/1,71@2/1', n);
check('selectionMovesToNextRest', await restSelBox());
// 4. Clicking in the MIDDLE of bar 2's whole rest (Write mode) writes at the start of that rest, not mid-bar.
await click(1, 2.5, 6);
n = await notes();
check('clickInRestWritesAtRestStart', n.some((x) => x.s === 4 && x.p === 67) && !n.some((x) => x.s > 4 && x.s < 8), n);
// 5. Select mode: clicking inside a whole rest selects the whole rest (one object).
await page.click('.score-palette button:has-text("Select")');
await click(2, 2.2, 4);
const sel = await S(() => { const L = window.__scoreLayout; const b = document.querySelector('.score-rest-sel'); return { box: !!b, w: b ? parseFloat(b.style.width) : 0, bar: L.systems[0].measures.find((m) => m.index === 2)?.w }; });
check('wholeRestSelectsAsOne', sel.box && sel.w > sel.bar * 0.5, sel);
check('selectModeClickWritesNothing', (await notes()).length === 4);
// 6. Change that rest to a half (6) → half rest + half rest; type C → a half note at the bar start.
await key('6');
const e3 = await elems(2);
check('wholeRestToHalf', e3.length === 2 && e3[0].t1 - e3[0].t === 2 && e3.every((x) => x.rest), e3);
await key('c');
n = await notes();
const c = n.find((x) => x.s === 8);
check('letterOnRestMakesNoteOfThatValue', c && c.d === 2 && c.p === 72, n);
// 7. Delete a note → a rest of the same value appears (the bar doesn't collapse into one rest).
await click(0, 1, 5); // the A4 on beat 2 of bar 1
await key('Delete');
e1 = await elems(0);
const mid = e1.find((x) => x.t === 1);
check('deleteLeavesSameValueRest', mid && mid.rest && mid.t1 === 2 && e1.find((x) => x.t === 0 && !x.rest) && e1.find((x) => x.t === 2 && !x.rest), e1);
// 8. Click a note in Write mode selects it; a longer value writes over what follows.
await page.click('.score-palette button:has-text("Write")');
await click(0, 0, 6);
const s8 = await S(() => window.__bf.store.useStore.getState().selectedNoteIds.length);
await key('7'); // whole note
n = await notes();
check('clickNoteSelects', s8 === 1, s8);
check('longerValueOverwrites', n.filter((x) => x.s < 4).length === 1 && n.find((x) => x.s === 0).d === 4, n);
// 9. Click above a note → chord.
await click(0, 0, 4);
n = await notes();
check('clickAboveMakesChord', n.filter((x) => x.s === 0).map((x) => x.p).join() === '67,71', n);
// 10. ⌥3 adds a 3rd above the selected note.
await page.keyboard.down('Alt'); await page.keyboard.press('Digit3'); await page.keyboard.up('Alt'); await page.waitForTimeout(150);
n = await notes();
check('altThreeAddsThird', n.filter((x) => x.s === 0).map((x) => x.p).join() === '67,71,74', n);
// 11. Box select.
const a = await at(0, 0, -4); const b = await at(1, 0.5, 11);
await page.mouse.move(a.x - 20, a.y); await page.mouse.down(); await page.mouse.move(b.x + 10, b.y, { steps: 6 }); await page.mouse.up();
await page.waitForTimeout(150);
const boxed = await S(() => window.__bf.store.useStore.getState().selectedNoteIds.length);
check('boxSelect', boxed === 4, boxed);
// 12. Held note + moving melody: two voices; filling the melody's rests never touches the held note.
await S((rid) => window.__bf.store.commit((d) => { const r = window.__bf.store.draftRegion(d, rid); r.notes = [
  { id: 'held', pitch: 60, start: 12, duration: 4, velocity: 0.7 },
  ...[64, 65, 67, 69].map((p, i) => ({ id: 'm' + i, pitch: p, start: 12 + i, duration: 1, velocity: 0.7 })),
]; }), R);
await page.waitForTimeout(600);
const voices = await S(() => window.__scoreLayout.heads.filter((h) => h.t >= 12 && h.t < 16).map((h) => ({ id: h.noteId, v: h.voice })));
check('heldNoteOwnVoice', voices.find((x) => x.id === 'held')?.v === 2 && voices.filter((x) => x.id !== 'held').every((x) => x.v === 1), voices);
await click(3, 1, 7);
await key('Delete'); // m1 → rest
await click(3, 1, 7); // the rest where m1 was: write mode click fills it (quarter)
n = await notes();
check('heldUntouched', n.some((x) => x.id === 'held' && x.d === 4) && n.some((x) => x.s === 13), n);
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/score-edit.png' });
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
