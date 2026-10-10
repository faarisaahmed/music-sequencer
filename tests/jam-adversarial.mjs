import { chromium } from 'playwright';
const exe = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5391/';
const OUT = process.argv[4] || '/tmp';
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const results = {};
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
async function newPeer(label) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|WebSocket|relay|User-Initiated Abort/i.test(m.text())) errors.push(`${label} console: ${m.text()}`);
  });
  return { ctx, page, label };
}
const ev = (p, fn, arg) => p.page.evaluate(fn, arg);
const state = (p) => ev(p, async () => (await window.__bf.session()).debugState());
async function waitFor(pred, timeout, what) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await pred()) return Date.now() - start; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout waiting for ${what}`);
}
async function converged(peers, timeout = 15000, what = 'convergence') {
  return waitFor(async () => {
    const ss = await Promise.all(peers.map(state));
    return ss.every((s) => s.hash && s.synced && s.pending === 0 && s.reorder === 0 && s.hash === ss[0].hash);
  }, timeout, what);
}
const commit = (p, src) => ev(p, (src) => { const fn = new Function('d', src); window.__bf.store.commit((d) => fn(d)); }, src);
const read = (p, src) => ev(p, (src) => new Function('p', src)(window.__bf.store.useStore.getState().project), src);
const ready = (p) => p.page.waitForFunction(() => window.__bf, null, { timeout: 20000 });

try {
  // A hosts a big stress song (many notes) to test snapshot size.
  const A = await newPeer('A');
  await A.page.goto(BASE); await ready(A);
  await ev(A, async () => {
    const bf = window.__bf;
    const p = bf.templates.TEMPLATES.find((t) => t.id === 'demo-sunset').build();
    const r = p.tracks[1].regions[0];
    for (let i = 0; i < 5000; i++) r.notes.push({ id: 'big' + i, pitch: 40 + (i % 30), start: (i * 0.125) % r.contentLength, duration: 0.1, velocity: 0.6 });
    await bf.actions.createNewProject(p);
    const s = await bf.session();
    s.startSession('TEST-' + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[01OIL]/g, 'X'));
  });
  const code = await ev(A, () => window.__bf.collab.useCollab.getState().code);
  log('code', code, 'snapshot JSON KB', Math.round((await read(A, 'return JSON.stringify(p).length')) / 1024));

  // A edits continuously while B joins (snapshot during heavy edits).
  const burstA = ev(A, async () => {
    const st = window.__bf.store;
    const end = performance.now() + 6000; let n = 0;
    while (performance.now() < end) { n++; st.commit((d) => { d.tracks[n % d.tracks.length].pan = Math.sin(n) * 0.5; if (n % 3 === 0) d.bpm = 90 + (n % 30); }); await new Promise((r) => setTimeout(r, 15)); }
    return n;
  });
  const B = await newPeer('B');
  const tB = Date.now();
  await B.page.goto(BASE + '#jam=' + code); await ready(B);
  await B.page.click('text=Join Session');
  const nA = await burstA;
  await converged([A, B], 60000, 'B join during burst');
  results.joinDuringBurst = { ms: Date.now() - tB, editsA: nA, notes: await read(B, 'return p.tracks[1].regions[0].notes.length') };
  log('join during burst', results.joinDuringBurst);

  // UI-driven edit: B paints drum steps in the step sequencer.
  await ev(B, () => { const st = window.__bf.store.useStore; const p = st.getState().project; const t = p.tracks[0]; const r = t.regions.find((x) => x.kind === 'midi'); st.setState({ selectedTrackId: t.id, selectedRegionIds: [r.id], editingRegionId: r.id, dockTab: 'editor', editorMode: 'steps' }); });
  await B.page.waitForSelector('.step-cell, .ss-cell, [class*="step"]', { timeout: 8000 }).catch(() => {});
  const before = await read(A, 'return p.tracks[0].regions.find(r=>r.kind==="midi").notes.length');
  const cells = await B.page.$$('[data-step]');
  results.stepCellsFound = cells.length;
  if (cells.length) { await cells[1].click(); await cells[3].click(); }
  await converged([A, B], 15000, 'step edit');
  results.uiStepEdit = { before, after: await read(A, 'return p.tracks[0].regions.find(r=>r.kind==="midi").notes.length') };
  log('ui step edit', results.uiStepEdit);
  await B.page.screenshot({ path: OUT + '/jam-B-steps.png' });

  // Play together: A plays → B plays near same position, A stops → B stops.
  await A.page.click('button[title^="Play"]');
  await waitFor(() => ev(B, () => window.__bf.store.useStore.getState().playing), 8000, 'B follows play');
  await new Promise((r) => setTimeout(r, 1500));
  const [pa, pb] = await Promise.all([ev(A, () => window.__bf.store.useStore.getState().playing), ev(B, () => window.__bf.store.useStore.getState().playing)]);
  await B.page.screenshot({ path: OUT + '/jam-B-playing.png' });
  await A.page.click('button[title^="Play"]');
  await waitFor(() => ev(B, () => !window.__bf.store.useStore.getState().playing), 8000, 'B follows stop');
  results.playTogether = { bothPlaying: pa && pb, stopFollowed: true };
  log('play together', results.playTogether);

  // Network drop on B for 6s, with edits on both sides meanwhile → recover & converge.
  await B.ctx.setOffline(true);
  await commit(A, `d.name = 'Edited while B offline';`);
  await commit(B, `d.tracks[2].volume = 0.21;`);
  await new Promise((r) => setTimeout(r, 6000));
  await B.ctx.setOffline(false);
  const tRec = Date.now();
  await converged([A, B], 90000, 'recover after offline');
  results.offlineRecovery = { ms: Date.now() - tRec, name: await read(B, 'return p.name'), vol: await read(A, 'return p.tracks[2].volume') };
  log('offline recovery', results.offlineRecovery);

  // Host (A) reloads while B is connected → B takes over, A rejoins as a client.
  const tHR = Date.now();
  await A.page.reload(); await ready(A);
  await converged([A, B], 60000, 'host reload');
  results.hostReload = { ms: Date.now() - tHR, A: await state(A), B: await state(B) };
  await commit(A, `d.bpm = 133;`);
  await converged([A, B], 15000, 'post host reload');
  results.hostReload.bpmOnB = await read(B, 'return p.bpm');
  log('host reload', results.hostReload.ms, results.hostReload.bpmOnB, 'host now', results.hostReload.B.isHost ? 'B' : 'A');

  // Leave via UI then rejoin with code.
  await B.page.click('.jam-bar-main');
  await B.page.screenshot({ path: OUT + '/jam-leave1.png' });
  await B.page.click('text=Leave Session');
  await new Promise((r) => setTimeout(r, 800));
  await B.page.screenshot({ path: OUT + '/jam-leave2.png' });
  results.afterLeave = await ev(B, () => ({ c: window.__bf.collab.useCollab.getState().status, modal: window.__bf.store.useStore.getState().modal }));
  await waitFor(() => ev(B, () => window.__bf.collab.useCollab.getState().status === 'idle'), 5000, 'B left');
  await waitFor(async () => (await state(A)).peers.length === 0, 15000, 'A sees B leave');
  await commit(A, `d.bpm = 77;`);
  await ev(B, () => window.__bf.store.openModal('collab'));
  await B.page.fill('input[placeholder="ABCD-EFGH"]', code);
  await B.page.click('button:has-text("Join")');
  await converged([A, B], 60000, 'B rejoin');
  results.leaveRejoin = { bpmOnB: await read(B, 'return p.bpm') };
  log('leave & rejoin', results.leaveRejoin);

  // Back to My Songs leaves the session cleanly.
  await B.page.click('button[title="Back to My Songs"]');
  await waitFor(() => ev(B, () => window.__bf.collab.useCollab.getState().status === 'idle'), 5000, 'B left via home');
  results.homeLeaves = true;
  await A.page.screenshot({ path: OUT + '/jam-A-final.png' });
} catch (e) {
  results.error = String(e.stack || e);
}
results.errors = errors;
console.log(JSON.stringify(results, (k, v) => (k === 'A' || k === 'B' ? undefined : v), 1));
await browser.close();
