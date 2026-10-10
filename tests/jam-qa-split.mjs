// QA: network split & heal. Both sides keep editing while disconnected; after reconnecting
// everyone must converge and keep the edits made on both sides of the split.
// node tests/jam-qa-split.mjs <chromium-exe> [base-url]
import { setup, sleep } from './jam-lib.mjs';

const exe = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5391/';
const T = await setup(exe, BASE);
const { log, newPeer, ev, state, waitFor, converged, commit, read, host, join, errors } = T;
const results = {};

async function splitOnce(A, B, label) {
  const sA = await state(A);
  const sB = await state(B);
  // Cut every WebRTC connection on B's side (A notices when the data channel closes).
  await ev(B, () => window.__qa.pcs.forEach((pc) => pc.close()));
  await waitFor(async () => (await state(A)).peers.length === 0 && (await state(B)).peers.length === 0, 30000, 'both notice split');
  const during = { A: await state(A), B: await state(B) };
  // Edits on both sides while split (different entities).
  await commit(A, `d.tracks[0].name = 'A-split-${label}'; d.bpm = 101;`);
  await commit(B, `d.tracks[1].name = 'B-split-${label}'; d.tracks[2].volume = 0.42;`);
  const t = Date.now();
  // Trystero re-announces periodically; wait for the reconnection and merge.
  await converged([A, B], 90000, 'heal ' + label);
  const healMs = Date.now() - t;
  const names = await Promise.all([A, B].map((p) => read(p, 'return [p.tracks[0].name, p.tracks[1].name, p.tracks[2].volume, p.bpm]')));
  const ok = names.every((n) => n[0] === `A-split-${label}` && n[1] === `B-split-${label}` && n[2] === 0.42 && n[3] === 101);
  return { ok, healMs, names, hostBefore: sA.isHost ? 'A' : sB.isHost ? 'B' : '?', duringHosts: { A: during.A.isHost, B: during.B.isHost }, hostAfter: (await state(A)).isHost ? 'A' : 'B' };
}

try {
  const A = await newPeer('A');
  const B = await newPeer('B');
  const code = await host(A);
  await join(B, code);
  await converged([A, B], 30000, 'join');
  results.split1 = await splitOnce(A, B, '1');
  log('split 1', results.split1);
  await sleep(1000);
  results.split2 = await splitOnce(A, B, '2');
  log('split 2', results.split2);
  // Third peer joins after the heals: must get the merged state.
  const C = await newPeer('C');
  await join(C, code);
  await converged([A, B, C], 30000, 'C after heals');
  results.lateJoinAfterHeal = (await read(C, 'return p.tracks[1].name')) === 'B-split-2';
} catch (e) {
  results.error = String(e.stack || e);
}
results.errors = errors;
console.log(JSON.stringify(results, null, 1));
await T.browser.close();
