// QA: frozen tabs, recording during collaboration, a big song, and a long random-edit soak.
// node tests/jam-qa-long.mjs <chromium-exe> [base-url] [soak-seconds]
import { setup, sleep } from './jam-lib.mjs';

const exe = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5391/';
const SOAK_S = Number(process.argv[4] || 300);
const T = await setup(exe, BASE);
const { log, newPeer, ev, state, waitFor, converged, commit, read, host, join, errors } = T;
const results = {};
const check = (name, ok, extra) => {
  results[name] = { ok: !!ok, ...(extra ?? {}) };
  log(ok ? 'PASS' : 'FAIL', name, extra ?? '');
};

try {
  const A = await newPeer('A');
  const B = await newPeer('B');
  const code = await host(A);
  await join(B, code);
  await converged([A, B], 30000, 'join');

  // 1. B's tab is frozen (like a background tab the OS suspended) while A keeps editing.
  const cdp = await B.ctx.newCDPSession(B.page);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  for (let i = 0; i < 25; i++) {
    await commit(A, `d.tracks[${i % 4}].pan = ${((i % 9) - 4) / 4}; d.name = 'frozen-${i}';`);
    await sleep(400);
  }
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  const unfreezeMs = await converged([A, B], 60000, 'after freeze');
  check('frozenTabCatchesUp', (await read(B, 'return p.name')) === 'frozen-24', { unfreezeMs });

  // 2. B records MIDI (via the engine, like playing the keyboard) while A edits other tracks.
  const recTrack = await read(B, `return p.tracks.find(t=>t.type==='instrument').id`);
  await ev(B, async (tid) => {
    window.__bf.store.useStore.setState({ selectedTrackId: tid, cursor: 64 });
    window.__bf.store.commit((d) => {
      d.countIn = false;
      d.loop.enabled = false;
    });
    const eng = await window.__bf.engine();
    await eng.record();
  }, recTrack);
  const playing = ev(B, async (tid) => {
    const eng = await window.__bf.engine();
    for (let i = 0; i < 8; i++) {
      eng.noteOn(tid, 60 + i, 0.8);
      await new Promise((r) => setTimeout(r, 150));
      eng.noteOff(tid, 60 + i);
      await new Promise((r) => setTimeout(r, 80));
    }
  }, recTrack);
  for (let i = 0; i < 10; i++) {
    await commit(A, `d.tracks[d.tracks.length-1].volume = ${i / 10};`);
    await sleep(150);
  }
  await playing;
  await ev(B, async () => (await window.__bf.engine()).stop(false));
  await converged([A, B], 20000, 'after recording');
  const recNotes = await read(A, `const t=p.tracks.find(t=>t.id==='${recTrack}'); return t.regions.flatMap(r=>r.notes??[]).filter(n=>n.pitch>=60&&n.pitch<68).length`);
  check('midiRecordingDuringEdits', recNotes >= 8, { recNotes });

  // 3. B records audio from the (fake) microphone; A must receive the clip.
  const audioTid = await ev(B, async () => {
    const id = window.__bf.actions.addTrack('audio');
    window.__bf.store.useStore.setState({ selectedTrackId: id, cursor: 0 });
    const eng = await window.__bf.engine();
    await eng.record();
    await new Promise((r) => setTimeout(r, 2500));
    eng.stop(false);
    return id;
  });
  await waitFor(async () => (await read(A, `return p.tracks.find(t=>t.id==='${audioTid}')?.regions.length ?? 0`)) > 0, 20000, 'recorded audio region on A');
  const aid = await read(A, `return p.tracks.find(t=>t.id==='${audioTid}').regions[0].audioId`);
  await waitFor(() => ev(A, (id) => !!window.__bf.audioStore.getBuffer(id), aid), 30000, 'recorded clip on A');
  check('micRecordingPropagates', true);

  // 4. Very large song: join time.
  const H = await newPeer('H');
  const bigCode = await host(H, 'demo-sunset', `for (const t of p.tracks) for (const r of t.regions) if (r.kind==='midi') for (let i=0;i<4000;i++) r.notes.push({id:'b'+t.id+i, pitch:40+(i%40), start:(i*0.0625)%r.contentLength, duration:0.05, velocity:0.6});`);
  const kb = Math.round((await read(H, 'return JSON.stringify(p).length')) / 1024);
  const J = await newPeer('J');
  const tj = Date.now();
  await join(J, bigCode);
  await converged([H, J], 120000, 'big join');
  check('bigSongJoin', true, { kb, joinMs: Date.now() - tj });
  await H.ctx.close();
  await J.ctx.close();

  // 5. Soak: three people make random edits for SOAK_S seconds; hashes checked periodically.
  const C = await newPeer('C');
  await join(C, code);
  await converged([A, B, C], 30000, 'C join');
  const peers = [A, B, C];
  const randomEdits = (p, i, seconds) =>
    ev(
      p,
      async ({ i, seconds }) => {
        const st = window.__bf.store;
        const end = performance.now() + seconds * 1000;
        let n = 0;
        const rnd = (k) => Math.floor(Math.random() * k);
        while (performance.now() < end) {
          n++;
          const kind = rnd(10);
          if (kind < 6)
            st.commit((d) => {
              const t = d.tracks[rnd(d.tracks.length)];
              if (!t) return;
              const op = rnd(6);
              if (op === 0) t.volume = rnd(100) / 100;
              else if (op === 1) t.pan = (rnd(200) - 100) / 100;
              else if (op === 2 && t.regions.length) t.regions[rnd(t.regions.length)].start = rnd(64);
              else if (op === 3) {
                const r = t.regions.find((r) => r.kind === 'midi');
                if (r) r.notes.push({ id: `s${i}-${n}`, pitch: 40 + rnd(40), start: rnd(16) / 4, duration: 0.25, velocity: 0.7 });
              } else if (op === 4) {
                const r = t.regions.find((r) => r.kind === 'midi' && r.notes.length);
                if (r) r.notes.splice(rnd(r.notes.length), 1);
              } else d.bpm = 70 + rnd(80);
            });
          else if (kind === 6) st.undo();
          else if (kind === 7) st.redo();
          else if (kind === 8) {
            // occasionally add / remove a track
            st.commit((d) => {
              if (d.tracks.length < 12 && Math.random() < 0.6) {
                const src = d.tracks[rnd(d.tracks.length)];
                if (src) d.tracks.push({ ...JSON.parse(JSON.stringify(src)), id: `soak${i}-${n}`, name: `Soak ${i}-${n}`, regions: [] });
              } else if (d.tracks.length > 4) d.tracks.splice(rnd(d.tracks.length), 1);
            });
          } else {
            // a short live drag
            st.beginGesture();
            for (let k = 0; k < 6; k++) {
              st.live((d) => {
                const t = d.tracks[0];
                if (t?.regions[0]) t.regions[0].start = (t.regions[0].start + 1) % 64;
              });
              await new Promise((r) => setTimeout(r, 16));
            }
            st.endGesture();
          }
          await new Promise((r) => setTimeout(r, 60 + rnd(140)));
        }
        return n;
      },
      { i, seconds },
    );
  const chunk = 30;
  let checks = 0;
  let totalEdits = 0;
  const convergeTimes = [];
  for (let elapsed = 0; elapsed < SOAK_S; elapsed += chunk) {
    const counts = await Promise.all(peers.map((p, i) => randomEdits(p, i, chunk)));
    totalEdits += counts.reduce((a, b) => a + b, 0);
    convergeTimes.push(await converged(peers, 60000, 'soak check ' + checks));
    checks++;
    log('soak', elapsed + chunk, 's — edits so far', totalEdits, 'converge ms', convergeTimes.at(-1));
  }
  const heap = await Promise.all(peers.map((p) => ev(p, () => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576))));
  check('soak', true, { seconds: SOAK_S, totalEdits, checks, maxConvergeMs: Math.max(...convergeTimes), heapMB: heap });
} catch (e) {
  results.error = String(e.stack || e);
}
results.errors = errors;
console.log(JSON.stringify(results, null, 1));
await T.browser.close();
