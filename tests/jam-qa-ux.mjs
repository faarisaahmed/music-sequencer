// QA: Jam Session UX states, error paths and navigation behaviour, with screenshots.
// node tests/jam-qa-ux.mjs <chromium-exe> [base-url] [out-dir]
import { setup, sleep } from './jam-lib.mjs';

const exe = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5391/';
const OUT = process.argv[4] || '/tmp';
const T = await setup(exe, BASE);
const { log, newPeer, ev, state, waitFor, converged, commit, read, host, join, errors, browser } = T;
const results = {};
const check = (name, ok, extra) => {
  results[name] = { ok: !!ok, ...(extra ?? {}) };
  log(ok ? 'PASS' : 'FAIL', name, extra ?? '');
};
const shot = (p, name) => p.page.screenshot({ path: `${OUT}/ux-${name}.png` });
const collab = (p) => ev(p, () => {
  const c = window.__bf.collab.useCollab.getState();
  return { status: c.status, message: c.message, code: c.code, peers: Object.keys(c.peers).length };
});

try {
  for (const vp of [
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    const tag = vp.width;
    // ---- First-time user starts a session through the UI only.
    const A = await newPeer('A' + tag, { viewport: vp });
    await ev(A, async () => {
      const bf = window.__bf;
      await bf.actions.createNewProject(bf.templates.TEMPLATES.find((t) => t.id === 'demo-sunset').build());
    });
    await A.page.waitForSelector('.topbar');
    await A.page.click('button[title^="Collaborate"]');
    await A.page.waitForSelector('text=Start Session');
    await shot(A, `${tag}-1-dialog`);
    // Double-click start must not create two sessions.
    await A.page.dblclick('button:has-text("Start Session")');
    await A.page.waitForSelector('.jam-code');
    await shot(A, `${tag}-2-started`);
    const code = (await A.page.textContent('.jam-code')).trim();
    const roomsA = await ev(A, () => window.__qa.pcs.length);
    await A.page.click('text=Done');
    await shot(A, `${tag}-3-waiting-bar`);

    // ---- Friend opens the link while on the home screen.
    const B = await newPeer('B' + tag, { viewport: vp, url: BASE + '#jam=' + code });
    await B.page.waitForSelector('text=Join Session');
    await shot(B, `${tag}-4-join-prompt`);
    await B.page.click('button:has-text("Join Session")');
    await sleep(150);
    await shot(B, `${tag}-5-joining-pill`);
    await converged([A, B], 30000, 'join ' + tag);
    await B.page.waitForSelector('.topbar');
    await sleep(600);
    await shot(B, `${tag}-6-joined`);
    // Presence: B selects a track and opens a region; A should see it.
    const tr = await read(B, 'return {tid: p.tracks[1].id, rid: p.tracks[1].regions[0].id}');
    await ev(B, ({ tid, rid }) => window.__bf.store.useStore.setState({ selectedTrackId: tid, selectedRegionIds: [rid], editingRegionId: rid, dockTab: 'editor' }), tr);
    await waitFor(() => A.page.isVisible('.presence-tag'), 8000, 'presence tag');
    await shot(A, `${tag}-7-presence`);
    // Chat.
    await B.page.click('button[title="Chat"]');
    await B.page.fill('.jam-chat-input input', 'Hey! I added a bass line');
    await B.page.keyboard.press('Enter');
    await waitFor(async () => (await ev(A, () => window.__bf.collab.useCollab.getState().unread)) > 0, 8000, 'unread');
    await shot(A, `${tag}-8-unread-badge`);
    await A.page.click('button[title="Chat"]');
    await shot(A, `${tag}-9-chat`);
    // Dialog while connected.
    await A.page.click('.jam-bar-main');
    await shot(A, `${tag}-10-session-dialog`);
    await A.page.keyboard.press('Escape');
    check(`ui-${tag}`, roomsA <= 1 && !errors.length, { code, peerConnectionsAfterDoubleClick: roomsA });
    await A.ctx.close();
    await B.ctx.close();
  }

  // ---- Error: badly typed code.
  const E = await newPeer('E');
  await ev(E, () => window.__bf.store.openModal('collab'));
  await E.page.fill('input[placeholder="ABCD-EFGH"]', 'hello');
  await E.page.click('button:has-text("Join")');
  await sleep(300);
  const badToast = await T.toastsOf(E);
  await shot(E, 'err-bad-code');
  check('badCodeMessage', badToast.some((t) => /code looks wrong/i.test(t)), { badToast });

  // ---- Error: valid code but nobody there.
  await E.page.fill('input[placeholder="ABCD-EFGH"]', 'ZZZZ-ZZZZ');
  await E.page.click('button:has-text("Join")');
  await sleep(11000);
  const nobody = await collab(E);
  await shot(E, 'err-nobody');
  check('nobodyThereMessage', nobody.status === 'waiting' && /Nobody/.test(nobody.message), nobody);
  // Cancel from the pill returns to idle.
  await E.page.click('.jam-pill button:has-text("Cancel")');
  await sleep(500);
  check('cancelFromPill', (await collab(E)).status === 'idle');

  // ---- Error: relays unreachable.
  const R = await newPeer('R', { url: null });
  await R.ctx.route(/^wss?:\/\//, (r) => r.abort());
  await R.page.routeWebSocket(/.*/, (ws) => ws.close());
  await R.page.goto(BASE);
  await T.ready(R);
  await ev(R, async () => (await window.__bf.session()).joinSession('ZZZZ-ZZZY'));
  await sleep(9000);
  const offline = await collab(R);
  await shot(R, 'err-relays-down');
  check('relaysDownMessage', /matchmaking|internet|Nobody/i.test(offline.message), offline);
  await R.ctx.close();

  // ---- Joining a room whose host has left (host closed the tab).
  const H = await newPeer('H');
  const code2 = await host(H);
  await H.ctx.close();
  const J = await newPeer('J');
  await join(J, code2);
  await sleep(11000);
  const orphan = await collab(J);
  check('hostGoneBeforeJoin', orphan.status === 'waiting' && /Nobody/.test(orphan.message), orphan);
  await ev(J, async () => (await window.__bf.session()).leaveSession(true));

  // ---- Same profile, two tabs: host tab + a second tab opening the host's own link.
  const P1 = await newPeer('P1');
  const code3 = await host(P1);
  const P2 = await newPeer('P2', { ctx: P1.ctx, url: BASE + '#jam=' + code3 });
  await P2.page.waitForSelector('text=Join Session');
  await P2.page.click('button:has-text("Join Session")');
  await converged([P1, P2], 30000, 'same profile tabs');
  await commit(P2, 'd.bpm = 77;');
  await converged([P1, P2], 15000, 'same profile edit');
  check('sameProfileTwoTabs', (await read(P1, 'return p.bpm')) === 77);

  // ---- Host clicking their own link in the same tab must not reconnect / duplicate.
  const pcsBefore = await ev(P1, () => window.__qa.pcs.length);
  await ev(P1, (c) => (location.hash = 'jam=' + c), code3);
  await sleep(1500);
  const p1State = await collab(P1);
  const modalP1 = await ev(P1, () => window.__bf.store.useStore.getState().modal?.kind ?? null);
  check('hostOwnLinkSameTab', p1State.status !== 'idle' && modalP1 === null && (await ev(P1, () => window.__qa.pcs.length)) === pcsBefore, { ...p1State, modalP1 });

  // ---- Navigation: P2 goes back to My Songs → should leave with a clear message, P1 sees them leave.
  await P2.page.click('.tb-back');
  await sleep(800);
  const p2 = await collab(P2);
  const p2Toasts = await T.toastsOf(P2);
  await waitFor(async () => (await collab(P1)).peers === 0, 10000, 'P1 sees P2 leave');
  check('myLeavesSession', p2.status === 'idle' && p2Toasts.some((t) => /left the jam/i.test(t)), { p2, p2Toasts });

  // ---- Song Wizard / new song while in a session.
  const W1 = await newPeer('W1');
  const W2 = await newPeer('W2');
  const code4 = await host(W1);
  await join(W2, code4);
  await converged([W1, W2], 30000, 'wizard join');
  await ev(W2, async () => {
    const bf = window.__bf;
    await bf.actions.createNewProject(bf.templates.TEMPLATES.find((t) => t.id === 'beat').build());
  });
  await sleep(1000);
  const w2 = await collab(W2);
  const w2Toasts = await T.toastsOf(W2);
  check('newSongLeavesSessionClearly', w2.status === 'idle' && w2Toasts.some((t) => /left the jam/i.test(t)), { w2, w2Toasts });

  // ---- Leave & rejoin 10 times: no leaked intervals / window listeners.
  const L = await newPeer('L');
  const base = await ev(L, () => ({ intervals: window.__qa.intervals.size, listeners: window.__qa.listeners }));
  for (let i = 0; i < 10; i++) {
    await join(L, code4);
    await converged([W1, L], 30000, 'rejoin ' + i);
    await ev(L, async () => (await window.__bf.session()).leaveSession(true));
    await ev(L, async () => window.__bf.actions.closeProject());
  }
  await sleep(1500);
  const end = await ev(L, () => ({ intervals: window.__qa.intervals.size, listeners: window.__qa.listeners }));
  check('noLeaksAfter10Rejoins', end.intervals - base.intervals <= 2 && end.listeners - base.listeners <= 4, { base, end });
} catch (e) {
  results.error = String(e.stack || e);
}
results.errors = errors;
console.log(JSON.stringify(results, null, 1));
await browser.close();
