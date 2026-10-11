// Keeping songs safe: version history (auto on open, Save Version, ⌘⌥S, rename, restore + undo,
// open as copy), backups (Back Up All file → import restores deleted songs), the backup folder,
// the Home reminder, and saving when the page is hidden. Usage: node tests/safety.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 300); };
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(url);
await page.waitForTimeout(800);

// Start clean.
await S(async () => {
  const dbs = await indexedDB.databases();
  await Promise.all(dbs.map((d) => new Promise((r) => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; })));
});
await page.reload();
await page.waitForTimeout(800);

// A song with notes, saved, closed and reopened → "Before this session" version.
const pid = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'grand-piano');
  const rid = actions.createEmptyRegion(tid, 0, 4);
  store.commit((d) => { store.draftRegion(d, rid).notes = [{ id: 'a', pitch: 60, start: 0, duration: 1, velocity: 0.8 }]; d.name = 'Safe Song'; });
  const id = store.useStore.getState().project.id;
  await actions.closeProject();
  await actions.openProjectById(id);
  await new Promise((r) => setTimeout(r, 400));
  return id;
});
let versions = await S(async (id) => (await window.__bf.safety()).listVersions(id), pid);
check('autoOnOpen', versions.length === 1 && versions[0].auto && versions[0].reason === 'Before this session', versions);

// ⌘⌥S saves a named version.
await page.keyboard.press('Meta+Alt+KeyS');
await page.waitForTimeout(500);
versions = await S(async (id) => (await window.__bf.safety()).listVersions(id), pid);
check('hotkeySaves', versions.some((v) => v.label === 'Version 1' && !v.auto), versions.map((v) => v.label));

// Change the song, then open Version History from the save indicator and save a named one.
await S(() => window.__bf.store.commit((d) => void (d.tracks.at(-1).regions[0].notes.push({ id: 'b', pitch: 64, start: 1, duration: 1, velocity: 0.8 }))));
await page.click('.save-ind');
await page.waitForSelector('.ver-list');
await page.fill('.ver-save input', 'Two notes');
await page.click('.ver-save-btn');
await page.waitForTimeout(400);
check('namedInList', (await page.locator('.ver-row:not(.auto) b').allTextContents()).join('|') === 'Two notes|Version 1', await page.locator('.ver-row b').allTextContents());
await page.screenshot({ path: `${out}/versions.png` });

// Add a third note, then restore "Version 1" (one note) — undo brings the three back.
await S(() => window.__bf.store.commit((d) => void (d.tracks.at(-1).regions[0].notes.push({ id: 'c', pitch: 67, start: 2, duration: 1, velocity: 0.8 }))));
const count = () => S(() => window.__bf.store.useStore.getState().project.tracks.at(-1).regions[0].notes.length);
await page.locator('.ver-row', { hasText: 'Version 1' }).locator('button', { hasText: 'Restore' }).click();
await page.waitForTimeout(500);
check('restored', (await count()) === 1, await count());
check('restoreKeepsId', (await S(() => window.__bf.store.useStore.getState().project.id)) === pid);
versions = await S(async (id) => (await window.__bf.safety()).listVersions(id), pid);
check('beforeRestoreSaved', versions.some((v) => v.reason === 'Before restoring'), versions.map((v) => v.reason ?? v.label));
await S(() => window.__bf.store.undo());
check('restoreUndoable', (await count()) === 3, await count());

// Rename an auto version (it becomes a kept, named version).
await S(() => window.__bf.store.openModal('versions'));
await page.waitForSelector('.ver-list');
await page.locator('.ver-row.auto').first().locator('button[title^="Name it"]').click();
await page.locator('.ver-row input').fill('Pre-restore');
await page.locator('.ver-row input').press('Enter');
await page.waitForTimeout(300);
check('renameAuto', (await page.locator('.ver-row:not(.auto) b').allTextContents()).includes('Pre-restore'));

// Open a version as a copy: a new song.
await page.locator('.ver-row', { hasText: 'Two notes' }).locator('button[title^="Open this version"]').click();
await page.waitForTimeout(600);
const copy = await S(() => ({ id: window.__bf.store.useStore.getState().project.id, name: window.__bf.store.useStore.getState().project.name, n: window.__bf.store.useStore.getState().project.tracks.at(-1).regions[0].notes.length }));
check('openAsCopy', copy.id !== pid && /Safe Song \(Two notes\)/.test(copy.name) && copy.n === 2, copy);

// Saves when the page is hidden (phones don't fire beforeunload).
await S(() => window.__bf.store.commit((d) => void (d.name = 'Hidden Save')));
await S(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(300);
const saved = await S(async (id) => (await (await import('/src/state/persistence.ts')).loadProject(id))?.name, copy.id);
check('saveOnHidden', saved === 'Hidden Save', saved);
await S(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });

// Back Up All → a file with every song; import restores a deleted one.
await S(() => window.__bf.actions.closeProject());
await page.waitForSelector('.home-section-head button:has-text("Back Up All")');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.home-section-head button:has-text("Back Up All")')]);
const bpath = `${out}/backup.bandforge.json`;
await dl.saveAs(bpath);
const bundle = JSON.parse(readFileSync(bpath, 'utf8'));
check('backupFile', bundle.format === 'bandforge-backup' && bundle.projects.length === 2 && /BandForge Backup \d{4}-\d\d-\d\d\.bandforge\.json/.test(dl.suggestedFilename()), { n: bundle.projects?.length, name: dl.suggestedFilename() });
await S(async (id) => window.__bf.actions.removeProject(id), pid);
check('versionsDeletedWithSong', (await S(async (id) => (await window.__bf.safety()).listVersions(id), pid)).length === 0);
await page.reload();
await page.waitForTimeout(800);
check('deleted', (await page.locator('.song-card').count()) === 1);
await page.setInputFiles('.home-header input[type=file]', bpath);
await page.waitForTimeout(800);
check('restoredFromBackup', (await page.locator('.song-name').allTextContents()).includes('Safe Song') && (await page.locator('.song-card').count()) === 2, await page.locator('.song-name').allTextContents());
check('restoreToast', /Restored 1 song \(1 already up to date\)/.test(await page.locator('.toast').last().textContent()), await page.locator('.toast').allTextContents());

// Reminder: a song changed over a week ago and never backed up.
await S(async () => {
  const { set, createStore, get } = await import('/node_modules/.vite/deps/idb-keyval.js');
  const db = createStore('bandforge-settings', 'settings');
  await set('backups', { done: {} }, db);
  const pdb = createStore('bandforge-projects', 'projects');
  const idx = await get('__index__', pdb);
  idx[0].createdAt = Date.now() - 10 * 86400000;
  await set('__index__', idx, pdb);
});
await page.reload();
await page.waitForTimeout(800);
check('reminderShown', await page.locator('.backup-banner').count() === 1 && /1 song hasn't been backed up/.test(await page.locator('.backup-banner b').textContent()), await page.locator('.backup-banner').count());
await page.screenshot({ path: `${out}/backup-banner.png` });
await page.click('.backup-banner button[title="Remind me in 3 days"]');
await page.waitForTimeout(300);
check('reminderSnoozed', await page.locator('.backup-banner').count() === 0);

// Backup folder (stand-in: the browser's private file system).
const folder = await S(async () => {
  const dir = await navigator.storage.getDirectory();
  window.showDirectoryPicker = async () => dir;
  const s = await window.__bf.safety();
  const st = await s.chooseBackupFolder();
  const names = [];
  for await (const [name] of dir.entries()) names.push(name);
  return { st, names };
});
check('folderBackup', folder.st.kind === 'ok' && folder.names.filter((n) => n.endsWith('.bandforge.json')).length === 2, folder);

// Settings shows the Keep Songs Safe section.
await S(async () => { await window.__bf.actions.openProjectById((await (await import('/src/state/persistence.ts')).listProjects())[0].id); window.__bf.store.openModal('settings'); });
await page.waitForSelector('.safety');
check('settingsSection', (await page.locator('.safety-row').count()) >= 2 && /Backing up to/.test(await page.locator('.safety').textContent()), await page.locator('.safety').textContent());
await page.locator('.safety').screenshot({ path: `${out}/safety-settings.png` });

check('noErrors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
await browser.close();
