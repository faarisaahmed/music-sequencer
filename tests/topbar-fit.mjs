// The top bar and the tracks toolbar fit any window width: nothing runs off the right edge
// (the Export button used to be cut in half on smaller screens). The top bar compacts in steps
// (labels, volume slider, then a ⋯ menu), never paints a frame wider than the window while
// resizing, comes back in full when the window grows, and the ⋯ menu's items work.
// Usage: node tests/topbar-fit.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
const check = (k, ok, info) => {
  res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 500);
};
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(url);
await page.waitForTimeout(800);
await S(async () => {
  const { actions, templates } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'demo-pop').build());
});
await page.waitForTimeout(1200);

// Everything in both bars inside the window, measured in the frame the browser paints
// (a ResizeObserver started last runs after the app's own).
await S(() => {
  window.__overflow = () => {
    const W = innerWidth;
    const out = [];
    for (const bar of document.querySelectorAll('.topbar, .tv-toolbar'))
      for (const el of bar.querySelectorAll('button, select, input, .lcd'))
        if (el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > W + 0.5) out.push(`${el.className || el.tagName} ${el.getAttribute('data-tip') ?? ''} r=${Math.round(el.getBoundingClientRect().right)}`);
    return out;
  };
  window.__arm = () => {
    window.__painted = null;
    window.__probe?.disconnect();
    const w0 = innerWidth;
    const ro = new ResizeObserver(() => {
      if (window.__painted === null && innerWidth !== w0) window.__painted = window.__overflow();
    });
    ro.observe(document.documentElement);
    window.__probe = ro;
  };
});

const fits = [];
const paintedBad = [];
const settledBad = [];
for (let w = 1600; w >= 770; w -= 30) {
  await S(() => window.__arm());
  await page.setViewportSize({ width: w, height: 800 });
  await page.waitForTimeout(150);
  const r = await S(() => ({ painted: window.__painted, settled: window.__overflow(), fit: Number(document.querySelector('.topbar').dataset.fit) }));
  fits.push([w, r.fit]);
  if (r.painted?.length) paintedBad.push({ w, els: r.painted.slice(0, 3) });
  if (r.settled.length) settledBad.push({ w, els: r.settled.slice(0, 3) });
}
check('nothing off the right edge at any width', settledBad.length === 0, settledBad.slice(0, 3));
check('no overflowing frame while resizing', paintedBad.length === 0, paintedBad.slice(0, 3));
const levels = fits.map(([, l]) => l);
check('compacts step by step as the window narrows', levels.every((l, i) => i === 0 || l >= levels[i - 1]) && levels[0] <= 1 && levels[levels.length - 1] >= 3, fits);

// Export is always fully visible and works.
const exp = await page.locator('.tb-export').boundingBox();
check('Export button fully visible at the narrowest width', !!exp && exp.x + exp.width <= 770, exp);

// The ⋯ menu holds what no longer fits, and its items work.
await page.locator('.tb-more').click();
await page.waitForTimeout(200);
const items = await page.locator('.menu-item').allTextContents();
check('More menu lists the moved items', ['Song Settings', 'Guides', 'Shortcuts & Help', 'Check My Writing', 'Undo'].every((x) => items.some((i) => i.includes(x))), items);
const menuBox = await page.locator('.menu').boundingBox();
check('More menu is inside the window', !!menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 770, menuBox);
await page.locator('.menu-item:has-text("Check My Writing")').click();
await page.waitForTimeout(200);
check('menu item opens its panel', (await S(() => window.__bf.store.useStore.getState().dockTab)) === 'review');
await page.locator('.tb-more').click();
await page.waitForTimeout(150);
await page.locator('.menu-item:has-text("Guides")').click();
await page.waitForTimeout(600);
check('menu opens Guides', (await page.locator('.guides').count()) > 0 || (await S(() => JSON.stringify(window.__bf.store.useStore.getState().modal ?? null).includes('guides'))));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// Swing (dropped from the display on narrow windows) opens from the menu, inside the window.
await page.locator('.tb-more').click();
await page.waitForTimeout(150);
await page.locator('.menu-item:has-text("Song Swing")').click();
await page.waitForTimeout(300);
const gp = await page.locator('.groove-head').boundingBox();
check('menu opens Song Swing inside the window', !!gp && gp.x >= 0 && gp.x + gp.width <= 770, gp);
await page.screenshot({ path: out + '/topbar-narrow.png', clip: { x: 0, y: 0, width: 770, height: 400 } });
await page.keyboard.press('Escape');
await page.mouse.click(300, 600);
await page.waitForTimeout(200);

// Growing the window brings everything back.
await page.setViewportSize({ width: 1920, height: 900 });
await page.waitForTimeout(300);
const back = await S(() => ({ fit: document.querySelector('.topbar').dataset.fit, guides: !!document.querySelector('.topbar [data-cmd="view.guides"]'), label: document.querySelector('.tb-export').textContent.trim() }));
check('full bar comes back on a wide window', back.fit === '0' && back.guides && back.label === 'Export', back);

// Content changes re-fit too: a long song name on a wide window still fits.
await S(() => window.__bf.store.commit((d) => void (d.name = 'A Really Long Song Name For Testing The Top Bar')));
await page.waitForTimeout(300);
check('still fits after the content changes', (await S(() => window.__overflow())).length === 0, await S(() => window.__overflow()));
await page.screenshot({ path: out + '/topbar-wide.png', clip: { x: 0, y: 0, width: 1920, height: 100 } });

check('no page errors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
const fails = Object.values(res).filter((v) => v !== 'ok').length;
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
