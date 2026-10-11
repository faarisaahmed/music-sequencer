// Shortcut system: hover tooltips show live keys, the Shortcuts window rebinds keys (with clash
// handling), changed keys work and show up everywhere, they persist, and reset works. Also the
// score's arrow keys (scale steps, ⇧ = sharp/flat) and hearing notes as you step through them.
// Usage: node tests/shortcuts.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
await page.goto(url);
await page.waitForTimeout(800);
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? ''); };
const S = (fn, arg) => page.evaluate(fn, arg);
const openSong = () => S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'beat').build());
  store.useStore.setState({ focusArea: 'tracks', dockTab: null });
});
await openSong();
await page.waitForTimeout(800);
const tipFor = async (sel) => {
  await page.mouse.move(5, 500);
  await page.waitForTimeout(100);
  await page.hover(sel);
  await page.waitForTimeout(700);
  return S(() => document.querySelector('.bf-tip')?.innerText ?? null);
};

// 1. Hover tooltips show the shortcut.
const t1 = await tipFor('[data-cmd="transport.play"]');
check('tooltipShowsKey', t1 && /Play \/ Stop/.test(t1) && /Space/.test(t1), t1);
const t2 = await tipFor('.lcd-cell:nth-child(5)'); // plain title → same tooltip style, no native title left
check('titlesUseTooltip', !!t2 && (await S(() => !document.querySelector('.lcd-cell:nth-child(5)').hasAttribute('title'))), t2);

// 2. ? opens the Shortcuts window.
await page.mouse.click(700, 600);
await page.keyboard.press('?');
await page.waitForTimeout(300);
const rows = await S(() => document.querySelectorAll('.sc-row').length);
check('questionOpensShortcuts', rows > 60, rows);

// 3. Rebind Mixer from X to M: M is Mute → clash → use it here instead.
await page.click('[data-command="view.mixer"] .sc-key');
await page.keyboard.press('m');
await page.waitForTimeout(150);
const clash = await S(() => document.querySelector('[data-command="view.mixer"] .sc-clash')?.innerText ?? '');
check('clashWarning', /already used for/.test(clash) && /Mute/.test(clash), clash);
await page.click('[data-command="view.mixer"] .sc-clash .btn.primary');
const km = await S(async () => { const k = await import('/src/ui/keys/keymap.ts'); return { mixer: k.keysFor('view.mixer'), mute: k.keysFor('track.mute') }; });
check('rebindApplied', km.mixer.join() === 'M' && km.mute.length === 0, km);
// 4. Add a second key to Undo: ⌘U.
await page.click('[data-command="edit.undo"] .sc-add');
await page.keyboard.press('Meta+u');
await page.waitForTimeout(150);
const ku = await S(async () => (await import('/src/ui/keys/keymap.ts')).keysFor('edit.undo'));
check('addSecondKey', ku.join() === 'Mod+Z,Mod+U', ku);
// Escape while capturing cancels capture, not the window.
await page.click('[data-command="view.editor"] .sc-key');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('escCancelsCapture', (await S(() => !!document.querySelector('.sc-panel'))) && !(await S(() => !!document.querySelector('.sc-key.capturing'))));
await page.screenshot({ path: out + '/shortcuts.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('escClosesWindow', !(await S(() => !!document.querySelector('.sc-panel'))));

// 5. The new keys work; the old one doesn't.
await S(() => window.__bf.store.useStore.setState({ focusArea: 'tracks', dockTab: null }));
await page.keyboard.press('x');
const afterX = await S(() => window.__bf.store.useStore.getState().dockTab);
await page.keyboard.press('m');
const afterM = await S(() => window.__bf.store.useStore.getState().dockTab);
check('reboundKeyWorks', afterX === null && afterM === 'mixer', { afterX, afterM });
await S(() => window.__bf.store.commit((d) => void (d.bpm = 133)));
await page.keyboard.press('Meta+u');
check('secondUndoKeyWorks', (await S(() => window.__bf.store.useStore.getState().project.bpm)) !== 133);
// 6. The new key shows on hover and in menus.
const t3 = await tipFor('[data-cmd="view.mixer"]');
check('tooltipFollowsRebind', /Mixer/.test(t3 ?? '') && /\bM\b/.test(t3 ?? ''), t3);
await S(async () => (await import('/src/ui/keys/keymap.ts')).setKeys('edit.duplicate', ['Mod+Shift+D']));
const rid = await S(() => window.__bf.store.useStore.getState().project.tracks.find((t) => t.regions.length).regions[0].id);
await page.click(`[data-region-id="${rid}"]`, { button: 'right' });
await page.waitForTimeout(200);
const menuDup = await S(() => [...document.querySelectorAll('.menu-item')].find((x) => /^Duplicate/.test(x.innerText))?.innerText ?? '');
check('menuFollowsRebind', /⇧⌘D/.test(menuDup), menuDup);
await page.keyboard.press('Escape');
// 7. Persists after reload.
await page.reload();
await page.waitForTimeout(900);
const kp = await S(async () => (await import('/src/ui/keys/keymap.ts')).keysFor('view.mixer'));
check('persistsAfterReload', kp.join() === 'M', kp);
// 8. Reset all.
await openSong();
await page.waitForTimeout(600);
await page.keyboard.press('?');
await page.waitForTimeout(300);
await page.click('.sc-top button:has-text("Reset all")');
await page.click('.sc-top button:has-text("Reset every shortcut")');
const kr = await S(async () => { const k = await import('/src/ui/keys/keymap.ts'); return [k.keysFor('view.mixer').join(), k.keysFor('track.mute').join(), k.keysFor('edit.undo').join()]; });
check('resetAll', kr.join('|') === 'X|M|Mod+Z', kr);
await page.keyboard.press('Escape');

// 9. Score arrows: ↑ = next note in the key (E→F→G), ⇧↑ = sharp; preview plays the NEW pitch; → plays the next note.
const R = await S(async () => {
  const { actions, store } = window.__bf;
  const tid = actions.addTrack('instrument', 'analog-lead');
  const rid = actions.createEmptyRegion(tid, 0, 8);
  store.commit((d) => { store.draftRegion(d, rid).notes = [{ id: 'a', pitch: 64, start: 0, duration: 1, velocity: 0.8 }, { id: 'b', pitch: 67, start: 1, duration: 1, velocity: 0.8 }, { id: 'c', pitch: 72, start: 2, duration: 1, velocity: 0.8 }]; });
  store.useStore.setState({ editingRegionId: rid, selectedRegionIds: [rid], selectedTrackId: tid, dockTab: 'editor', editorMode: 'score', dockMaximized: true, focusArea: 'editor' });
  const e = await window.__bf.engine();
  window.__heard = [];
  const orig = e.preview.bind(e);
  e.preview = (t, p, v, d) => { window.__heard.push(p); return orig(t, p, v, d); };
  return rid;
});
await page.waitForTimeout(1000);
await S(() => window.__bf.store.useStore.setState({ selectedNoteIds: ['a'] }));
await page.waitForTimeout(100);
const pitchOf = () => S((rid) => window.__bf.store.findRegion(window.__bf.store.useStore.getState().project, rid).region.notes.find((n) => n.id === 'a').pitch, R);
const heard = () => S(() => { const h = window.__heard; window.__heard = []; return h; });
await heard();
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(120);
const p1 = await pitchOf(); const h1 = await heard();
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(120);
const p2 = await pitchOf(); const h2 = await heard();
await page.keyboard.press('Shift+ArrowUp'); await page.waitForTimeout(120);
const p3 = await pitchOf(); const h3 = await heard();
check('arrowUpIsScaleStep', p1 === 65 && p2 === 67, { p1, p2 });
check('shiftArrowIsSharp', p3 === 68, p3);
check('previewPlaysNewPitch', h1.at(-1) === 65 && h2.at(-1) === 67 && h3.at(-1) === 68, { h1, h2, h3 });
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
const h4 = await heard();
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
const h5 = await heard();
check('stepRightPlaysNotes', h4.includes(67) && h5.includes(72), { h4, h5 });
// 10. ⇧Space plays the drum pattern on its own (and again stops it).
await S(() => { const s = window.__bf.store.useStore.getState(); const d = s.project.tracks.find((t) => t.type === 'drums'); window.__bf.store.useStore.setState({ editingRegionId: d.regions[0].id, selectedRegionIds: [d.regions[0].id], editorMode: 'steps', focusArea: 'editor' }); });
await page.waitForTimeout(500);
await page.keyboard.press('Shift+Space'); await page.waitForTimeout(250);
const pp1 = await S(() => window.__bf.store.useStore.getState().patternPlay);
await page.keyboard.press('Shift+Space'); await page.waitForTimeout(250);
const pp2 = await S(() => window.__bf.store.useStore.getState().patternPlay);
check('shiftSpacePlaysPattern', !!pp1 && pp2 === null, { pp1, pp2 });
console.log(JSON.stringify(res, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
