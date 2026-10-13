// Guides: open from Home / top bar / ⇧G, every lesson renders without errors, examples and inline
// chips play and stop, search, read tracking, Esc, and the phone layout (drawer, no sideways scroll).
// Usage: node tests/guides.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
const check = (k, ok, info) => {
  res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 400);
};
const S = (fn, arg) => page.evaluate(fn, arg);
// The guides read their starting lesson when they open, so close and reopen.
const openLesson = async (key) => {
  await S(() => window.__bf.store.useStore.setState({ modal: null }));
  await S((k) => window.__bf.store.useStore.setState({ modal: { kind: 'guides', data: k ? { lesson: k } : undefined } }), key);
  await page.waitForTimeout(300);
};
await page.goto(url);
await page.waitForTimeout(800);
await S(() => localStorage.removeItem('bf.guides.read'));

// From Home.
await page.click('button:has-text("Guides")');
await page.waitForSelector('.guides .g-hero', { timeout: 8000 });
const course = await S(async () => {
  const m = await import('/src/ui/guides/index.ts');
  return { chapters: m.CHAPTERS.length, lessons: m.ALL_LESSONS.map((r) => ({ key: r.key, title: r.lesson.title })) };
});
const cards = await page.locator('.g-ch-card').count();
check('home lists every chapter', cards === course.chapters && course.chapters >= 10, { cards, chapters: course.chapters });
check('course has lessons', course.lessons.length >= 40, course.lessons.length);
await page.screenshot({ path: out + '/guides-home.png' });

// Every lesson renders, with working figures.
const bad = [];
let figures = 0;
for (const l of course.lessons) {
  const before = errors.length;
  await openLesson(l.key);
  try {
    await page.waitForFunction((t) => document.querySelector('.g-lesson h1')?.textContent === t, l.title, { timeout: 4000 });
  } catch {
    bad.push(l.key + ': did not render');
    continue;
  }
  const info = await S(() => ({
    examples: [...document.querySelectorAll('.g-example')].map((e) => e.querySelectorAll('svg rect, svg circle').length),
    figs: document.querySelectorAll('.g-example, .g-keys, .g-chordrow-fig, .g-circle, .g-range, .g-sections, .g-inline-play').length,
    text: document.querySelector('.g-body')?.textContent.length ?? 0,
  }));
  figures += info.figs;
  if (info.examples.some((c) => c < 5)) bad.push(l.key + ': empty example');
  if (info.figs < 2) bad.push(l.key + ': fewer than 2 interactive figures');
  if (info.text < 2500) bad.push(l.key + ': very short (' + info.text + ' chars)');
  if (errors.length > before) bad.push(l.key + ': ' + errors.slice(before).join(' | '));
}
check('every lesson renders with figures', bad.length === 0, bad);
check('lots of interactive figures', figures > course.lessons.length * 3, figures);

// Playing an example: button turns into stop, playhead moves, second click stops.
await openLesson('theory/intervals');
await page.waitForSelector('.g-example .g-play');
const ex = page.locator('.g-example').first();
await ex.scrollIntoViewIfNeeded();
await ex.locator('.g-play').click();
let playing = false;
try {
  await ex.locator('.g-play.on').waitFor({ timeout: 15000 });
  playing = true;
} catch {
  /* not playing */
}
await page.waitForTimeout(700);
const head = await ex.locator('.g-playhead').evaluate((el) => ({ o: el.style.opacity, t: el.style.transform }));
check('example plays with a moving playhead', playing && head.o === '1' && /translateX/.test(head.t), head);
// Muting a part from the legend keeps it playing.
await ex.locator('.g-chip').nth(1).click();
await page.waitForTimeout(300);
check('legend mutes a part', (await ex.locator('.g-chip.off').count()) === 1 && (await ex.locator('.g-play.on').count()) === 1);
await ex.locator('.g-play').click();
await page.waitForTimeout(300);
check('second click stops', (await ex.locator('.g-play.on').count()) === 0);

// Inline chip and keyboard keys play without errors.
const before = errors.length;
await page.locator('.g-inline-play').first().click();
await page.locator('.g-keys .g-key').first().dispatchEvent('pointerdown');
await page.waitForTimeout(600);
check('inline chips and keys play', errors.length === before, errors.slice(before));

// Reaching the end marks the lesson read.
await S(() => document.querySelector('.g-scroll').scrollTo(0, 1e6));
await page.waitForTimeout(600);
const read = await S(() => JSON.parse(localStorage.getItem('bf.guides.read') ?? '[]'));
check('reading to the end marks it read', read.includes('theory/intervals') && (await page.locator('.g-toc-lesson.on.read').count()) === 1, read);

// Next lesson button.
const nextTitle = await page.locator('.g-pager-btn.next .g-pager-title').textContent();
await page.click('.g-pager-btn.next');
await page.waitForTimeout(300);
check('next button opens the next lesson', (await page.locator('.g-lesson h1').textContent()) === nextTitle, nextTitle);

// Search.
await page.fill('.g-search input', 'fifths');
await page.waitForTimeout(200);
const hits = await page.locator('.g-result').count();
check('search finds lessons', hits > 0, hits);
if (hits) {
  const t = await page.locator('.g-result .g-result-title').first().textContent();
  await page.locator('.g-result').first().click();
  await page.waitForTimeout(300);
  check('search result opens', (await page.locator('.g-lesson h1').textContent()) === t);
}

// Esc closes.
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Esc closes', (await page.locator('.guides').count()) === 0);

// In the studio: top bar button and ⇧G.
await S(async () => {
  const { actions, templates } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'demo-pop').build());
});
await page.waitForTimeout(1200);
await page.click('[data-cmd="view.guides"]');
await page.waitForTimeout(400);
const fromBar = (await page.locator('.guides').count()) === 1;
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.keyboard.press('Shift+G');
await page.waitForTimeout(400);
check('top bar button and ⇧G open guides', fromBar && (await page.locator('.guides').count()) === 1);
// Opening guides stops the song.
await page.keyboard.press('Escape');
await S(() => window.__bf.store.useStore.setState({ modal: null }));
await page.keyboard.press('Space');
await page.waitForTimeout(500);
await page.keyboard.press('Shift+G');
await page.waitForSelector('.g-ch-card');
await page.locator('.g-ch-card').nth(1).click();
await page.waitForSelector('.g-example .g-play');
await page.locator('.g-example .g-play').first().click();
await page.waitForTimeout(1500);
check('playing an example stops the song', !(await S(() => window.__bf.store.useStore.getState().playing)));
await page.keyboard.press('Escape');

// Phone.
await page.setViewportSize({ width: 390, height: 844 });
await openLesson('theory/intervals');
await page.waitForTimeout(600);
const overflow = await S(() => {
  const s = document.querySelector('.g-scroll');
  return s.scrollWidth - s.clientWidth;
});
check('phone: no sideways scroll', overflow <= 1, overflow);
await page.screenshot({ path: out + '/guides-phone.png' });
await page.click('button:has-text("Contents")');
await page.waitForTimeout(300);
const drawer = await page.locator('.g-side.open').count();
await page.screenshot({ path: out + '/guides-phone-toc.png' });
check('phone: contents drawer opens', drawer === 1);

check('no page errors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
const fails = Object.values(res).filter((v) => v !== 'ok').length;
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
