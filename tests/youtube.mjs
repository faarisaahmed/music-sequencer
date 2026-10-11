// Publish to YouTube against a fake Google: setup (client id), connect + channel + playlists,
// automatic title/description/chapters/tags, required audience choice, the resumable upload's
// metadata, the video file, the thumbnail, playlist, done screen, and error messages.
// Usage: node tests/youtube.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 400); };
const S = (fn, arg) => page.evaluate(fn, arg);

// ---- fake Google
const calls = [];
let channelItems = [{ id: 'UC123', snippet: { title: 'Faaris Music', customUrl: '@faarismusic', thumbnails: { default: { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } } } }];
await page.route('https://accounts.google.com/gsi/client', (r) =>
  r.fulfill({
    contentType: 'text/javascript',
    body: `window.google={accounts:{oauth2:{initTokenClient(cfg){return{requestAccessToken(o){(window.__gis=window.__gis||[]).push({scope:cfg.scope,prompt:o&&o.prompt,client:cfg.client_id});setTimeout(()=>cfg.callback({access_token:'tok-'+window.__gis.length,expires_in:3600,scope:cfg.scope}),5)}}},revoke(){}}}};`,
  }),
);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Location, Range' };
await page.route('https://www.googleapis.com/**', async (r) => {
  const req = r.request();
  const u = new URL(req.url());
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  const entry = { method: req.method(), path: u.pathname, query: Object.fromEntries(u.searchParams), headers: req.headers() };
  const buf = req.postDataBuffer();
  entry.size = buf?.length ?? 0;
  if (buf && /json/.test(req.headers()['content-type'] ?? '')) entry.json = JSON.parse(buf.toString());
  if (buf && entry.path.endsWith('/videos') && !u.searchParams.get('upload_id')) entry.json = JSON.parse(buf.toString());
  if (buf && u.searchParams.get('upload_id')) entry.head = buf.subarray(0, 12).toString('latin1');
  calls.push(entry);
  const json = (status, body, headers = {}) => r.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (u.pathname === '/youtube/v3/channels') return json(200, { items: channelItems });
  if (u.pathname === '/youtube/v3/playlists') return json(200, { items: [{ id: 'PL1', snippet: { title: 'Singles' } }] });
  if (u.pathname === '/youtube/v3/playlistItems') return json(200, { id: 'PI1' });
  if (u.pathname === '/upload/youtube/v3/videos' && u.searchParams.get('upload_id')) return json(200, { id: 'VID42' });
  if (u.pathname === '/upload/youtube/v3/videos') return r.fulfill({ status: 200, headers: { ...cors, Location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc' }, body: '' });
  if (u.pathname === '/upload/youtube/v3/thumbnails/set') return json(200, { items: [] });
  return json(404, { error: { message: 'unexpected ' + u.pathname } });
});

await page.goto(url);
await page.waitForTimeout(800);
await S(async () => {
  localStorage.removeItem('bf.googleClientId');
  localStorage.removeItem('bf.youtube');
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'analog-lead');
  const rid = actions.createEmptyRegion(tid, 0, 64);
  store.commit((d) => {
    store.draftRegion(d, rid).notes = Array.from({ length: 16 }, (_, i) => ({ id: 'n' + i, pitch: 60 + (i % 5), start: i * 4, duration: 4, velocity: 0.8 }));
    d.name = 'Night Drive';
    d.bpm = 60;
    d.info = { artist: 'Faaris', album: 'First Light', genre: 'Synthwave', year: 2026, comment: 'Thanks for listening' };
    d.sections = [
      { id: 'a', name: 'Intro', start: 0, length: 16, color: '#f00' },
      { id: 'b', name: 'Verse', start: 16, length: 16, color: '#0f0' },
      { id: 'c', name: 'Chorus', start: 32, length: 16, color: '#00f' },
      { id: 'd', name: 'Outro', start: 48, length: 16, color: '#ff0' },
    ];
  });
  store.openModal('export');
});
// Reached from the Export dialog.
await page.click('.export-yt');
await page.waitForSelector('.yt-setup');
check('setupFirst', true);
await page.fill('.yt-setup input', 'not-an-id');
check('setupRejectsBad', await page.locator('.modal-foot .btn.primary').isDisabled());
await page.fill('.yt-setup input', '123-abc.apps.googleusercontent.com');
await page.click('.modal-foot .btn.primary');
await page.waitForSelector('.yt-section');
check('clientIdSaved', (await S(() => localStorage.getItem('bf.googleClientId'))) === '123-abc.apps.googleusercontent.com');
check('publishNeedsChannel', await page.locator('.yt-publish').isDisabled() && /connect a channel/.test(await page.locator('.export-summary').textContent()));

// Automatic text from Song Info.
const title = await page.locator('.yt-details input[type=text]').first().inputValue();
const desc = await page.locator('.yt-details textarea').inputValue();
check('autoTitle', title === 'Faaris - Night Drive', title);
check('autoDescription', /"Night Drive" by Faaris/.test(desc) && /From First Light/.test(desc) && /0:00 Intro\n0:16 Verse\n0:32 Chorus\n0:48 Outro/.test(desc) && /Synthwave · 60 BPM/.test(desc) && /℗ 2026 Faaris/.test(desc) && /#Synthwave #Faaris/.test(desc), desc);
const tags = await page.locator('.yt-details input[type=text]').nth(1).inputValue();
check('autoTags', /Faaris/.test(tags) && /Night Drive/.test(tags) && /original music/.test(tags), tags);

// Connect.
await page.click('.yt-connect .btn.primary');
await page.waitForSelector('.yt-channel');
check('channelShown', (await page.locator('.yt-channel b').textContent()) === 'Faaris Music');
const gis = await S(() => window.__gis);
check('scopesMinimal', gis[0].scope.includes('youtube.upload') && gis[0].scope.includes('youtube.readonly') && !gis[0].scope.includes('force-ssl') && gis[0].prompt.includes('select_account') && gis[0].client === '123-abc.apps.googleusercontent.com', gis);
check('playlistsLoaded', (await page.locator('.yt-row select').nth(1).locator('option').count()) === 2);
check('needsAudience', await page.locator('.yt-publish').isDisabled() && /choose the audience/.test(await page.locator('.export-summary').textContent()));

// Edit the title; it sticks and is saved with the song.
const t = page.locator('.yt-details input[type=text]').first();
await t.fill('Night Drive (Official Audio)');
await t.press('Tab');
check('titleSaved', (await S(() => window.__bf.store.useStore.getState().project.info.youtube?.title)) === 'Night Drive (Official Audio)');

// Settings: Still cover (quick), public, playlist, not for kids, CC license.
await page.click('.yt-art-video .seg button:has-text("Still cover")');
await page.click('.yt-vis .seg button:has-text("Public")');
await page.check('input[name=kids] >> nth=0');
await page.click('.seg button:has-text("Creative Commons")');
await page.locator('.yt-row select').nth(1).selectOption('PL1');
await page.screenshot({ path: `${out}/youtube-dialog.png`, fullPage: true });
check('readyToPublish', await page.locator('.yt-publish').isEnabled(), await page.locator('.export-summary').textContent());

await page.click('.yt-publish');
await page.waitForSelector('.yt-done', { timeout: 180000 });
const init = calls.find((c) => c.method === 'POST' && c.path === '/upload/youtube/v3/videos');
check('uploadInit', init && init.query.uploadType === 'resumable' && init.query.notifySubscribers === 'true' && /snippet/.test(init.query.part) && init.headers.authorization?.startsWith('Bearer tok'), init && { q: init.query });
const v = init?.json;
check('snippet', v?.snippet.title === 'Night Drive (Official Audio)' && v.snippet.categoryId === '10' && v.snippet.description.includes('0:16 Verse') && v.snippet.tags.includes('Faaris'), v?.snippet);
check('status', v?.status.privacyStatus === 'public' && v.status.selfDeclaredMadeForKids === false && v.status.containsSyntheticMedia === false && v.status.license === 'creativeCommon' && v.status.embeddable === true && !v.status.publishAt, v?.status);
const put = calls.find((c) => c.method === 'PUT');
const declared = Number(init?.headers['x-upload-content-length']);
check('videoUploaded', put && put.size === declared && put.size > 10000 && /ftyp|\x1aE\xdf\xa3/.test(put.head) && /video\/(mp4|webm)/.test(init.headers['x-upload-content-type']), put && { size: put.size, declared, head: put.head });
const th = calls.find((c) => c.path === '/upload/youtube/v3/thumbnails/set');
check('thumbnailSet', th && th.query.videoId === 'VID42' && th.headers['content-type'] === 'image/jpeg' && th.size > 5000, th && { q: th.query, size: th.size });
const pi = calls.find((c) => c.path === '/youtube/v3/playlistItems');
check('playlistAdded', pi?.json?.snippet.playlistId === 'PL1' && pi.json.snippet.resourceId.videoId === 'VID42', pi?.json);
check('playlistAskedMoreScope', (await S(() => window.__gis)).some((g) => g.scope.includes('force-ssl')));
check('doneLink', (await page.locator('.yt-done-link input').inputValue()) === 'https://youtu.be/VID42');
check('rememberedVideo', (await S(() => window.__bf.store.useStore.getState().project.info.youtube?.videoId)) === 'VID42');
await page.screenshot({ path: `${out}/youtube-done.png` });

// Re-open: banner for the last video, settings remembered, scheduling.
await page.click('.modal-foot .btn.primary');
await S(() => window.__bf.store.openModal('youtube'));
await page.waitForSelector('.yt-section');
check('publishedBanner', await page.locator('.yt-banner a[href="https://youtu.be/VID42"]').count() === 1);
check('prefsRemembered', await page.locator('input[name=kids]').first().isChecked() && (await page.locator('.yt-vis .seg button.on').textContent()) === 'Public');
await page.click('.yt-vis .seg button:has-text("Schedule")');
check('scheduleInput', await page.locator('.yt-vis input[type=datetime-local]').count() === 1);

// Visualizer video renders (frames + audio) for a short song.
const vid = await S(async () => {
  const { store } = window.__bf;
  const ex = await import('/src/audio/export.ts');
  const v = await import('/src/publish/video.ts');
  const p = store.useStore.getState().project;
  const buf = await ex.renderProject(p, { start: 0, end: 4, tail: 0.5, sampleRate: 48000 });
  const t0 = performance.now();
  const blob = await v.renderVideo(p, buf, 'visualizer');
  return { size: blob.size, type: blob.type, ms: Math.round(performance.now() - t0) };
});
check('visualizerVideo', vid.size > 50000 && /video\//.test(vid.type), vid);

// No channel on the account: a clear message.
channelItems = [];
await page.click('.yt-channel .btn.sm');
await page.waitForSelector('.yt-error');
check('noChannelMessage', /doesn’t have a YouTube channel/.test(await page.locator('.yt-error').textContent()));

check('noErrors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
await browser.close();
