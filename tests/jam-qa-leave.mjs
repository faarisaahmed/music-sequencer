// QA: leaving & rejoining. An edit made right before leaving must reach the others, others must
// see the leave promptly, rejoining the same session from the same tab must work every time,
// and chat sent just after joining (when connections may briefly stall) must still arrive.
// node tests/jam-qa-leave.mjs <chromium-exe> [base-url]
import { setup, sleep } from './jam-lib.mjs';

const exe = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5391/';
const T = await setup(exe, BASE);
const { newPeer, ev, state, waitFor, converged, read, host, join, errors, log } = T;
const results = {};

try {
  // 1. Edit, then immediately go back to My Songs — repeated, landing at different moments.
  const lastEdit = [];
  for (let trial = 0; trial < 10; trial++) {
    const A = await newPeer('A');
    const code = await host(A);
    const B = await newPeer('B');
    await join(B, code);
    await converged([A, B], 30000, 'join');
    await sleep(300 + (trial % 4) * 700);
    await ev(B, async (n) => {
      window.__bf.store.commit((d) => void (d.name = 'last-edit-' + n));
      await window.__bf.actions.closeProject();
    }, trial);
    let leaveMs = -1;
    try {
      leaveMs = await waitFor(async () => (await state(A)).peers.length === 0, 20000, 'leave seen');
    } catch {
      /* reported below */
    }
    lastEdit.push({ leaveMs, editArrived: (await read(A, 'return p.name')) === 'last-edit-' + trial });
    await A.ctx.close();
    await B.ctx.close();
  }
  results.editThenLeave = {
    ok: lastEdit.every((r) => r.editArrived && r.leaveMs >= 0 && r.leaveMs < 12000),
    editsArrived: lastEdit.filter((r) => r.editArrived).length + '/' + lastEdit.length,
    leaveMs: lastEdit.map((r) => r.leaveMs),
  };
  log('editThenLeave', results.editThenLeave);

  // 2. Leave & rejoin the same session from the same tab, many times.
  const H = await newPeer('H');
  const code = await host(H);
  const L = await newPeer('L');
  const times = [];
  for (let i = 0; i < 10; i++) {
    const t = Date.now();
    await join(L, code);
    await converged([H, L], 60000, 'rejoin ' + i);
    times.push(Date.now() - t);
    await ev(L, async () => (await window.__bf.session()).leaveSession(true));
    await ev(L, async () => window.__bf.actions.closeProject());
  }
  results.rejoinSameTab = { ok: times.every((t) => t < 10000), ms: times };
  log('rejoinSameTab', results.rejoinSameTab);

  // 3. Chat right after joining arrives eventually, in both directions.
  const A = await newPeer('A2');
  const code2 = await host(A);
  const B = await newPeer('B2');
  await join(B, code2);
  await converged([A, B], 30000, 'join chat');
  for (let i = 0; i < 20; i++) {
    await ev(B, async (t) => (await window.__bf.session()).sendChat(t), 'b' + i);
    await ev(A, async (t) => (await window.__bf.session()).sendChat(t), 'a' + i);
    await sleep(250);
  }
  const has = (p, prefix) => ev(p, (prefix) => window.__bf.collab.useCollab.getState().chat.filter((m) => m.text.startsWith(prefix) && m.from !== window.__bf.collab.useCollab.getState().selfId).length, prefix);
  await waitFor(async () => (await has(A, 'b')) === 20 && (await has(B, 'a')) === 20, 20000, 'all chat delivered');
  results.chatAfterJoin = { ok: true };
  log('chatAfterJoin', results.chatAfterJoin);
} catch (e) {
  results.error = String(e.stack || e);
}
results.errors = errors;
console.log(JSON.stringify(results, null, 1));
await T.browser.close();
