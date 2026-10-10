// Score editor interactions (Flat-style): click to write, click above/below to build chords,
// clicking a note selects it in any mode, box select, changing values overwrites the next notes,
// dots, ⌥3 chord tones, naturals, notes across the barline, and held notes split into a second
// voice instead of being chopped up. Usage: node tests/score-editing.mjs <chromium> <url> <outdir>
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

// A lead (treble staff) with an empty 4-bar region open in the score editor.
const R = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'analog-lead');
  const rid = actions.createEmptyRegion(tid, 0, 16);
  store.useStore.setState({ editingRegionId: rid, selectedRegionIds: [rid], selectedTrackId: tid, dockTab: 'editor', editorMode: 'score', dockMaximized: true, selectedNoteIds: [], focusArea: 'editor' });
  return rid;
});
await page.waitForTimeout(1200);
const notes = () => S((rid) => window.__bf.store.findRegion(window.__bf.store.useStore.getState().project, rid).region.notes.map((n) => ({ id: n.id, p: n.pitch, s: n.start, d: n.duration, v: n.voice })).sort((a, b) => a.s - b.s || a.p - b.p), R);
// Client point for (measure, beat in measure, staff step) — step 0 = top line, 8 = bottom line (E4 in treble).
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
  await page.waitForTimeout(120);
};
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(100); };

// 1. Write mode, quarter notes: G4 (step 6) on beats 0,1,2,3 of bar 1 by clicking.
await key('5');
for (let b = 0; b < 4; b++) await click(0, b, 6);
let n = await notes();
check('clickWritesNotes', n.length === 4 && n.every((x) => x.p === 67 && x.d === 1) && n.map((x) => x.s).join() === '0,1,2,3', n);
// 2. Click above the first note (B4, step 4) → added to the chord, not replacing it.
await click(0, 0, 4);
n = await notes();
check('clickAboveMakesChord', n.length === 5 && n.filter((x) => x.s === 0).map((x) => x.p).join() === '67,71', n);
// 3. Clicking an existing note (write mode) selects it, doesn't add or replace anything.
await click(0, 1, 6);
const sel1 = await S(() => window.__bf.store.useStore.getState().selectedNoteIds);
n = await notes();
const second = n.find((x) => x.s === 1);
check('clickNoteSelectsInWriteMode', n.length === 5 && sel1.length === 1 && sel1[0] === second.id, { sel1, n });
// 4. Change its value to a half note (6): it grows and writes over the note on beat 2.
await key('6');
n = await notes();
check('longerValueOverwritesNext', n.length === 4 && n.find((x) => x.s === 1).d === 2 && !n.some((x) => x.s === 2), n);
// 5. Dot it (.) → dotted half (3 beats) overwrites beat 3 too.
await key('.');
n = await notes();
check('dotSelected', n.find((x) => x.s === 1)?.d === 3 && !n.some((x) => x.s === 3), n);
// 6. Shorter value leaves a rest (no notes move).
await key('4');
n = await notes();
check('shorterLeavesRest', n.find((x) => x.s === 1)?.d === 0.5 && n.length === 3, n);
// 7. ⌥3 adds a 3rd above the selected note (G4 → B4), ⌥5 a 5th.
await page.keyboard.down('Alt'); await page.keyboard.press('Digit3'); await page.keyboard.up('Alt'); await page.waitForTimeout(120);
n = await notes();
check('altThreeAddsThird', n.filter((x) => x.s === 1).map((x) => x.p).join() === '67,71', n);
// 8. Box-select bar 1 by dragging over empty space.
const a = await at(0, 0, -3); const b = await at(0, 3.6, 11);
await page.mouse.move(a.x - 18, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x + 10, b.y, { steps: 4 }); await page.mouse.up();
await page.waitForTimeout(150);
const boxed = await S(() => window.__bf.store.useStore.getState().selectedNoteIds.length);
n = await notes();
check('boxSelect', boxed === n.length && boxed === 4, { boxed, n: n.length });
check('boxDidNotWrite', n.length === 4);
// 9. Sharp then natural on the selection.
await page.click('.pal-btn.acc[title^="Sharp"]');
const sharp = (await notes()).map((x) => x.p);
await page.click('.pal-btn.acc[title^="Natural"]');
const nat = (await notes()).map((x) => x.p);
// G♯ → G♮; B♯ is spelled C, so ♮ leaves it as C.
check('sharpThenNatural', sharp.join() === '68,72,68,72' && nat.join() === '67,72,67,72', { sharp, nat });
// 10. Whole note on beat 3 of bar 2 runs over the barline (tied), not pushed back.
await key('Escape');
await page.click('.score-palette button:has-text("Write")');
await key('7');
await click(1, 3, 6);
n = await notes();
const w = n.find((x) => x.s === 7);
check('wholeNoteCrossesBarline', w && w.d === 4, n);
// 11. Held note + moving melody split into two voices, and writing over the melody keeps the held note.
await S((rid) => window.__bf.store.commit((d) => { const r = window.__bf.store.draftRegion(d, rid); r.notes = [
  { id: 'held', pitch: 60, start: 8, duration: 4, velocity: 0.7 },
  ...[64, 65, 67, 69].map((p, i) => ({ id: 'm' + i, pitch: p, start: 8 + i, duration: 1, velocity: 0.7 })),
]; }), R);
await page.waitForTimeout(600);
const voices = await S(() => { const L = window.__scoreLayout; return L.heads.filter((h) => h.t >= 8 && h.t < 12).map((h) => ({ id: h.noteId, v: h.voice, t: h.t })); });
const heldPieces = voices.filter((x) => x.id === 'held');
check('heldNoteOwnVoice', heldPieces.length === 1 && heldPieces[0].v === 2 && voices.filter((x) => x.id !== 'held').every((x) => x.v === 1), voices);
await page.click('.score-palette button:has-text("Write")');
await key('5');
await click(2, 1, 3); // C5 above the F4 on beat 2 of bar 3 → joins its chord; the held C4 is untouched
n = await notes();
check('chordOnMelodyKeepsHeld', n.some((x) => x.id === 'held' && x.d === 4) && n.some((x) => x.s === 9 && x.p === 72) && n.some((x) => x.id === 'm1'), n);
await click(2, 2, 5, ['Alt']); // ⌥-click A4 on beat 3: replaces the G4 melody note, held note still whole
n = await notes();
check('altClickReplacesKeepsHeld', n.some((x) => x.id === 'held' && x.d === 4) && n.some((x) => x.s === 10 && x.p === 69) && !n.some((x) => x.id === 'm2'), n);
check('writeKeepsHeldNote', n.filter((x) => x.id === 'held').length === 1, n);
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/score-edit.png' });
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
