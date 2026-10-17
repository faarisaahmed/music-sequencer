// Sound library search: words match names, categories, tags and synonyms with small typos
// forgiven and the best match first; character chips filter; ↑↓ + Enter choose; ▶ previews a
// sound without changing the track; ★ favourites and recents show at the top and are remembered;
// the New Track dialog searches too (Enter picks the top result).
// Usage: node tests/sound-search.mjs <chromium> <url> <outdir>
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
await page.goto(url);
await page.waitForTimeout(800);

// Ranking and matching.
const q = await S(async () => {
  const { PRESETS } = await import('/src/audio/presets.ts');
  const { searchSounds } = await import('/src/ui/library/soundSearch.ts');
  const pool = PRESETS.filter((p) => p.category !== 'Drums');
  const ids = (s, f) => searchSounds(pool, s, f).map((p) => p.id);
  return {
    piano: ids('piano'),
    typo: ids('pinao'),
    violn: ids('violn'),
    keys: ids('keys'),
    warm: ids('warm'),
    bass80: ids('80s bass'),
    film: ids('film'),
    lofi: ids('lofi'),
    nothing: ids('zzzqqq'),
    bassChip: ids('', ['bass']),
    warmPad: ids('', ['warm', 'pad']),
    kits: searchSounds(PRESETS.filter((p) => p.category === 'Drums'), '808').map((p) => p.id),
  };
});
check('name match ranks first', q.piano[0] === 'grand-piano' || q.piano.slice(0, 3).includes('grand-piano'), q.piano);
check('typos are forgiven', q.typo.includes('grand-piano') && q.violn[0] === 'violin', { typo: q.typo, violn: q.violn });
check('synonyms: keys finds pianos and organs', q.keys.includes('grand-piano') && q.keys.includes('organ'), q.keys);
check('character words: warm', q.warm.includes('warm-pad') && q.warm.includes('cello') && !q.warm.includes('chiptune'), q.warm);
check('every word must match: 80s bass', q.bass80[0] === 'synth-bass' && q.bass80.every((id) => !['violin', 'grand-piano'].includes(id)), q.bass80);
check('film finds cinematic sounds', q.film.includes('french-horn') && q.film.includes('cello'), q.film);
check('lofi finds lo-fi keys', q.lofi.includes('felt-piano') && q.lofi.includes('electric-piano'), q.lofi);
check('nonsense finds nothing', q.nothing.length === 0);
check('Bass chip shows only basses', q.bassChip.length >= 5 && q.bassChip.includes('sub-808') && !q.bassChip.includes('flute'), q.bassChip);
check('chips combine', q.warmPad.includes('warm-pad') && !q.warmPad.includes('electric-bass'), q.warmPad);
check('kits search', q.kits[0] === 'kit-808', q.kits);

// The Sounds panel on an instrument track.
const tid = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'demo-pop').build());
  const t = store.useStore.getState().project.tracks.find((x) => x.type === 'instrument' && x.instrument === 'grand-piano') ?? store.useStore.getState().project.tracks.find((x) => x.type === 'instrument');
  store.useStore.setState({ selectedTrackId: t.id, libraryOpen: true });
  localStorage.removeItem('bf.sounds.fav');
  localStorage.removeItem('bf.sounds.recent');
  return t.id;
});
await page.waitForTimeout(600);
const inst = () => S((id) => window.__bf.store.useStore.getState().project.tracks.find((t) => t.id === id).instrument, tid);
const before = await inst();
const input = page.locator('.library .lib-search input');
await input.fill('warm');
await page.waitForTimeout(200);
const names = await page.locator('.library .lib-item-name').allTextContents();
check('panel shows ranked results', names.length >= 4 && names.includes('Warm Pad'), names);
check('results show a count', /\d+ sounds/.test(await page.locator('.library .lib-group-head').first().textContent()));

// Preview leaves the track alone.
const row = page.locator('.library .lib-item', { hasText: 'Warm Pad' }).first();
await row.hover();
await row.locator('.lib-play').click();
await page.waitForTimeout(150);
check('preview shows it is playing', (await row.locator('.lib-play.on').count()) === 1);
await page.waitForTimeout(300);
check('preview does not change the track', (await inst()) === before);

// Keyboard: ↓ ↓ Enter picks the second result.
await input.focus();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
const hiName = await page.locator('.library .lib-item.hi .lib-item-name').textContent();
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const picked = await S(async (id) => {
  const { getPreset } = await import('/src/audio/presets.ts');
  return getPreset(window.__bf.store.useStore.getState().project.tracks.find((t) => t.id === id).instrument).name;
}, tid);
check('arrow keys and Enter choose a sound', picked === hiName && names[1] === hiName, { picked, hiName });

// Chips.
await page.locator('.library .lib-clear').click();
await page.locator('.library .lib-chip', { hasText: 'Bass' }).click();
await page.waitForTimeout(200);
const bassNames = await page.locator('.library .lib-item-name').allTextContents();
check('chip filters the list', bassNames.includes('808 Sub Bass') && !bassNames.includes('Flute'), bassNames);
await page.locator('.library .lib-chip.on').click();

// Empty search offers suggestions.
await input.fill('zzzqqq');
await page.waitForTimeout(150);
check('no matches suggests words', (await page.locator('.lib-empty .lib-chip').count()) >= 4);
await page.locator('.lib-empty .lib-chip', { hasText: 'cinematic' }).click();
await page.waitForTimeout(150);
check('suggestion searches', (await input.inputValue()) === 'cinematic' && (await page.locator('.library .lib-item').count()) > 3);
await page.locator('.library .lib-clear').click();

// Favourites and recents.
const cello = page.locator('.library .lib-item', { hasText: 'Cello' }).first();
await cello.hover();
await cello.locator('.lib-fav').click();
await page.waitForTimeout(150);
const heads = await page.locator('.library .lib-group-head').allTextContents();
check('favourites and recents sections at the top', heads[0].includes('Favourites') && heads[1].includes('Recent'), heads);
check('favourite is listed', (await page.locator('.library .lib-group').first().locator('.lib-item-name').allTextContents()).includes('Cello'));
await input.fill('warm');
await page.locator('.library .lib-item').nth(1).hover();
await page.waitForTimeout(150);
await page.screenshot({ path: out + '/sound-search.png', clip: { x: 0, y: 0, width: 700, height: 900 } });
await page.reload();
await page.waitForTimeout(800);
const kept = await S(() => JSON.parse(localStorage.getItem('bf.sounds.fav') ?? '[]'));
check('favourites are remembered', kept.includes('cello'), kept);

// New Track dialog: search, Enter picks the top result, Favourites in the sidebar.
await S(async () => {
  const { actions, templates } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
});
await page.waitForTimeout(600);
await S(() => window.__bf.store.openModal('newTrack'));
await page.waitForTimeout(300);
await page.locator('.newtrack-card', { hasText: 'Software Instrument' }).click();
await page.waitForTimeout(200);
check('dialog lists Favourites', (await page.locator('.newtrack-cats .lib-cat', { hasText: 'Favourites' }).count()) === 1);
await page.locator('.newtrack-search input').fill('trumpt');
await page.waitForTimeout(150);
const top = await page.locator('.preset-grid .preset-name').first().textContent();
check('dialog search forgives typos', top === 'Trumpet', top);
await page.screenshot({ path: out + '/sound-search-newtrack.png' });
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const added = await S(() => window.__bf.store.useStore.getState().project.tracks.map((t) => t.instrument));
check('Enter adds the top result', added.includes('trumpet'), added);
check('new instrument becomes recent', (await S(() => JSON.parse(localStorage.getItem('bf.sounds.recent') ?? '[]')))[0] === 'trumpet');

check('no page errors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
const fails = Object.values(res).filter((v) => v !== 'ok').length;
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
