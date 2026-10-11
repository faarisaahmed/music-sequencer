// Phones and tablets: the phone layout (no sideways overflow anywhere, transport and tabs in
// reach), real touch gestures (double-tap opens the editor, press-and-hold opens a menu sheet,
// two-finger pinch zooms, one finger paints steps), dialogs as sheets, install (manifest,
// iPhone Add to Home Screen help), landscape phones, and iPads keeping the full layout.
// Usage: node tests/mobile.mjs <chromium> <url> <outdir>
import { chromium, devices } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 300); };
const errors = [];
process.on('exit', () => !res.__printed && console.log('PARTIAL', JSON.stringify(res, null, 1)));

async function open(device, extra = {}) {
  const ctx = await browser.newContext({ ...devices[device], ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(device + ': ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push(device + ': ' + m.text()));
  await page.goto(url);
  await page.waitForTimeout(900);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}
const S = (page, fn, arg) => page.evaluate(fn, arg);
const overflow = (page) => S(page, () => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth }));
const touch = (cdp, type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const center = async (loc) => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
async function visibleRegion(page) {
  const n = await page.locator('.region').count();
  const v = page.viewportSize();
  for (let i = 0; i < n; i++) {
    const b = await page.locator('.region').nth(i).boundingBox();
    if (b && b.x + 20 < v.width && b.x + Math.min(b.width, 60) > 140 && b.y > 120 && b.y + b.height < v.height - 140) return [Math.max(b.x, 140) + 20, b.y + b.height / 2];
  }
  throw new Error('no visible region');
}
const inView = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); const v = page.viewportSize(); return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1; };

// ---------------------------------------------------------------- iPhone portrait
{
  const { page, cdp } = await open('iPhone 14');
  check('phoneClass', await S(page, () => document.documentElement.classList.contains('phone') && document.documentElement.classList.contains('touch')));
  let o = await overflow(page);
  check('homeNoOverflow', o.doc <= 0 && o.body <= 0, o);
  check('homeButtonsVisible', (await inView(page, '.home-header .btn.primary')) && (await inView(page, '.home-search')), null);

  await S(page, async () => {
    const { actions, templates } = window.__bf;
    await actions.createNewProject(templates.TEMPLATES.find((t) => t.id.startsWith('demo')).build());
  });
  await page.waitForSelector('.m-project');
  check('phoneShell', (await page.locator('.topbar').count()) === 0 && (await page.locator('.m-tabs button').count()) === 5);
  check('transportInReach', (await inView(page, '.m-play')) && (await inView(page, '.m-rec')));

  for (const tab of ['Tracks', 'Editor', 'Play', 'Mixer']) {
    await page.locator('.m-tabs button', { hasText: tab }).tap();
    await page.waitForTimeout(400);
    o = await overflow(page);
    check('noOverflow:' + tab, o.doc <= 0 && o.body <= 0, o);
    if (tab === 'Play') check('playTabShowsInstrument', (await page.locator('.kp-keys, .kp').count()) >= 1, await page.locator('.m-dock').innerHTML().then((h) => h.slice(0, 200)));
  }

  // Double-tap a region → it opens in the Editor tab.
  await page.locator('.m-tabs button', { hasText: 'Tracks' }).tap();
  await page.waitForTimeout(300);
  const [rx, ry] = await visibleRegion(page);
  await touch(cdp, 'touchStart', [[rx, ry]]); await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(80);
  await touch(cdp, 'touchStart', [[rx, ry]]); await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(500);
  check('doubleTapOpensEditor', (await page.locator('.m-tabs button.on').textContent()).includes('Editor') && (await page.locator('.editor-panel').count()) === 1, await page.locator('.m-tabs button.on').textContent());

  // Press and hold a region → its menu as a bottom sheet; submenus slide in with Back.
  await page.locator('.m-tabs button', { hasText: 'Tracks' }).tap();
  await page.waitForTimeout(300);
  const [hx, hy] = await visibleRegion(page);
  await touch(cdp, 'touchStart', [[hx, hy]]);
  await page.waitForTimeout(750);
  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  const items = await page.locator('.m-sheet .m-sheet-item').allTextContents();
  check('holdOpensMenuSheet', items.length > 4 && (await page.locator('.menu').count()) === 0, items);
  const sub = page.locator('.m-sheet .m-sheet-item:has(.m-sheet-chev)').first();
  if (await sub.count()) {
    const label = await sub.textContent();
    await sub.tap();
    await page.waitForTimeout(200);
    check('submenuSlidesIn', (await page.locator('.m-sheet-title').textContent()) === label && (await page.locator('.m-sheet-item', { hasText: 'Back' }).count()) === 1, label);
  }
  await page.locator('.m-sheet-backdrop').tap({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(250);
  check('sheetCloses', (await page.locator('.m-sheet').count()) === 0);
  check('holdDidNotAlsoTap', (await page.locator('.m-tabs button.on').textContent()).includes('Tracks'));

  // Piano roll: two-finger pinch zooms in.
  await S(page, () => {
    const st = window.__bf.store.useStore;
    const p = st.getState().project;
    const mel = p.tracks.find((t) => t.type === 'instrument' && t.regions.length);
    st.setState({ dockTab: 'editor', editorMode: 'pianoroll', selectedTrackId: mel.id, editingRegionId: mel.regions[0].id });
  });
  await page.waitForTimeout(500);
  const w0 = await page.locator('.pr-scroll').evaluate((e) => e.scrollWidth);
  const [px, py] = await center(page.locator('.pr-scroll'));
  await touch(cdp, 'touchStart', [[px - 30, py], [px + 30, py]]);
  for (let i = 1; i <= 8; i++) { await touch(cdp, 'touchMove', [[px - 30 - i * 12, py], [px + 30 + i * 12, py]]); await page.waitForTimeout(16); }
  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  const w1 = await page.locator('.pr-scroll').evaluate((e) => e.scrollWidth);
  check('pinchZooms', w1 > w0 * 1.4, { w0, w1 });

  // Step sequencer: one finger paints a step; the row menu has the phone's mute/level/pan.
  await S(page, () => {
    const st = window.__bf.store.useStore;
    const p = st.getState().project;
    const dr = p.tracks.find((t) => t.type === 'drums' && t.regions.length);
    st.setState({ dockTab: 'editor', editorMode: 'steps', selectedTrackId: dr.id, editingRegionId: dr.regions[0].id });
  });
  await page.waitForTimeout(500);
  const notesBefore = await S(page, () => { const s = window.__bf.store; const p = s.useStore.getState().project; return s.findRegion(p, s.useStore.getState().editingRegionId).region.notes.length; });
  const cell = page.locator('.ss-cells').nth(2).locator('> *').nth(1);
  await cell.tap();
  await page.waitForTimeout(250);
  const notesAfter = await S(page, () => { const s = window.__bf.store; const p = s.useStore.getState().project; return s.findRegion(p, s.useStore.getState().editingRegionId).region.notes.length; });
  check('tapPaintsStep', notesAfter !== notesBefore, { notesBefore, notesAfter });
  await page.locator('.ss-more').first().tap();
  await page.waitForTimeout(250);
  const rowItems = await page.locator('.m-sheet .m-sheet-item').allTextContents();
  check('rowMenuHasMix', rowItems.some((t) => /Mute Row/.test(t)) && rowItems.some((t) => /^Level/.test(t)) && rowItems.some((t) => /^Pan/.test(t)), rowItems);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${out}/mobile-steps.png` });

  // Dialogs open as full-width sheets.
  await S(page, () => window.__bf.store.openModal('export'));
  await page.waitForSelector('.modal');
  await page.waitForTimeout(600); // slide-up animation
  const mb = await page.locator('.modal').boundingBox();
  check('dialogIsSheet', Math.abs(mb.width - page.viewportSize().width) < 2 && Math.abs(mb.y + mb.height - page.viewportSize().height) < 2, mb);
  await S(page, () => window.__bf.store.closeModal());

  // More → Add to Home Screen shows iPhone steps (Safari has no install prompt).
  await page.locator('.m-tabs button', { hasText: 'More' }).tap();
  await page.waitForTimeout(250);
  await page.locator('.m-sheet-item', { hasText: 'Add to Home Screen' }).tap();
  await page.waitForTimeout(300);
  check('iosInstallHelp', (await page.locator('.install-steps li').count()) === 3 && /Add to Home Screen/.test(await page.locator('.install-steps').textContent()));
  await page.screenshot({ path: `${out}/mobile-install.png` });
  await page.locator('.install-done').tap();

  // Manifest is installable.
  const mf = await S(page, async () => (await fetch('./manifest.webmanifest')).json());
  check('manifest', mf.display === 'standalone' && mf.id && mf.icons.some((i) => i.sizes === '512x512') && mf.icons.some((i) => i.purpose === 'maskable') && mf.shortcuts?.length, mf);
  check('iosMeta', await S(page, () => !!document.querySelector('meta[name="apple-mobile-web-app-capable"]') && /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content)));
}

// ---------------------------------------------------------------- phone landscape
{
  const { page } = await open('iPhone 14 landscape');
  check('landscapeIsPhone', await S(page, () => document.documentElement.classList.contains('phone')));
  await S(page, async () => {
    const { actions, templates } = window.__bf;
    await actions.createNewProject(templates.TEMPLATES.find((t) => t.id.startsWith('demo')).build());
  });
  await page.waitForSelector('.m-project');
  const o = await overflow(page);
  check('landscapeNoOverflow', o.doc <= 0 && o.body <= 0, o);
  check('landscapeTransport', await inView(page, '.m-play'));
  await page.screenshot({ path: `${out}/mobile-landscape.png` });
}

// ---------------------------------------------------------------- Android: real install prompt
{
  const { page } = await open('Pixel 7');
  await S(page, () => {
    const e = new Event('beforeinstallprompt');
    e.prompt = async () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.waitForTimeout(200);
  await page.locator('.install-btn').tap();
  await page.waitForTimeout(200);
  check('androidPrompt', await S(page, () => window.__prompted === true));
}

// ---------------------------------------------------------------- iPad keeps the full studio
{
  const { page } = await open('iPad Pro 11 landscape');
  await S(page, async () => {
    const { actions, templates } = window.__bf;
    await actions.createNewProject(templates.TEMPLATES.find((t) => t.id.startsWith('demo')).build());
  });
  await page.waitForTimeout(800);
  check('ipadDesktopLayout', (await page.locator('.topbar').count()) === 1 && (await page.locator('.m-project').count()) === 0 && (await S(page, () => document.documentElement.classList.contains('touch'))));
  await page.screenshot({ path: `${out}/mobile-ipad.png` });
}

check('noErrors', errors.length === 0, errors);
res.__printed = true;
console.log(JSON.stringify(res, null, 1));
await browser.close();
