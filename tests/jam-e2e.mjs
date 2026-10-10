// End-to-end Jam Session test over real Nostr relays with 3 isolated browser profiles.
import { chromium } from 'playwright';
const exe = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5391/';
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
    if (m.type() === "error" && !/Failed to load resource|ERR_|WebSocket|relay|User-Initiated Abort/i.test(m.text())) errors.push(`${label} console: ${m.text()}`);
  });
  return { ctx, page, label };
}
const ev = (p, fn, arg) => p.page.evaluate(fn, arg);
const state = (p) =>
  ev(p, async () => {
    const s = await window.__bf.session();
    return s.debugState();
  });
async function waitFor(p, pred, timeout, what) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await pred()) return Date.now() - start;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${what}`);
}
async function converged(peers, timeout = 15000, what = 'convergence') {
  return waitFor(
    peers[0],
    async () => {
      const ss = await Promise.all(peers.map(state));
      return ss.every((s) => s.hash && s.synced && s.pending === 0 && s.reorder === 0 && s.hash === ss[0].hash);
    },
    timeout,
    what,
  );
}
const commit = (p, src) =>
  ev(p, async (src) => {
    const st = window.__bf.store;
    const fn = new Function('d', src);
    st.commit((d) => fn(d));
  }, src);
const read = (p, src) =>
  ev(p, async (src) => {
    const st = window.__bf.store;
    return new Function('p', src)(st.useStore.getState().project);
  }, src);

try {
  // ---------------------------------------------------------------- A starts a session
  const A = await newPeer('A');
  await A.page.goto(BASE);
  await A.page.waitForFunction(() => window.__bf);
  await ev(A, async () => {
    const { TEMPLATES } = window.__bf.templates;
    const { createNewProject } = window.__bf.actions;
    await createNewProject(TEMPLATES.find((t) => t.id === 'demo-sunset').build());
  });
  await A.page.waitForSelector('.topbar');
  await A.page.click('button[title^="Collaborate"]');
  await A.page.click('text=Start Session');
  await A.page.waitForSelector('.jam-code');
  const code = (await A.page.textContent('.jam-code')).trim();
  log('session code', code);
  await A.page.click('text=Done');

  // ---------------------------------------------------------------- B joins via link UI
  const B = await newPeer('B');
  const tJoin = Date.now();
  await B.page.goto(BASE + '#jam=' + code);
  await B.page.waitForSelector('text=Join Session', { timeout: 10000 });
  await B.page.click('text=Join Session');
  await B.page.waitForFunction(() => window.__bf);
  await converged([A, B], 60000, 'B join');
  results.joinB_ms = Date.now() - tJoin;
  log('B joined & converged in', results.joinB_ms, 'ms');
  results.B_onProjectScreen = await B.page.isVisible('.topbar');
  await new Promise((r) => setTimeout(r, 300));
  results.dbgA = await ev(A, async () => { const st = (window.__bf.store).useStore.getState(); const c = window.__bf.collab.useCollab.getState(); return { screen: st.screen, hasProject: !!st.project, status: c.status, msg: c.message, url: location.href }; });
  results.dbgB = await ev(B, async () => { const st = (window.__bf.store).useStore.getState(); const c = window.__bf.collab.useCollab.getState(); return { screen: st.screen, hasProject: !!st.project, status: c.status, msg: c.message }; });

  // ---------------------------------------------------------------- concurrent edits on different entities
  const tracks = await read(A, 'return p.tracks.map(t=>({id:t.id, regions:t.regions.map(r=>r.id)}))');
  const rA = tracks[0].regions[0];
  const rB = tracks[2].regions[0];
  await Promise.all([
    commit(A, `d.bpm = 97; for (const t of d.tracks) for (const r of t.regions) if (r.id==='${rA}') r.start += 4;`),
    commit(B, `d.tracks[1].volume = 0.33; for (const t of d.tracks) for (const r of t.regions) if (r.id==='${rB}') r.name = 'B was here';`),
  ]);
  let ms = await converged([A, B], 15000, 'concurrent different');
  const checkAB = await read(B, `const f=id=>p.tracks.flatMap(t=>t.regions).find(r=>r.id===id); return {bpm:p.bpm, vol:p.tracks[1].volume, name:f('${rB}').name}`);
  const checkAB2 = await read(A, `const f=id=>p.tracks.flatMap(t=>t.regions).find(r=>r.id===id); return {bpm:p.bpm, vol:p.tracks[1].volume, name:f('${rB}').name}`);
  results.concurrentDifferent = { ms, B: checkAB, A: checkAB2, ok: checkAB.bpm === 97 && checkAB.vol === 0.33 && checkAB2.name === 'B was here' };
  log('concurrent different entities', results.concurrentDifferent);

  // ---------------------------------------------------------------- same-entity conflict converges
  await Promise.all([commit(A, `d.tracks[0].regions[0].start = 40;`), commit(B, `d.tracks[0].regions[0].start = 44;`)]);
  ms = await converged([A, B], 15000, 'same entity');
  results.sameEntity = { ms, value: await read(A, 'return p.tracks[0].regions[0].start') };
  log('same entity', results.sameEntity);

  // ---------------------------------------------------------------- structural ops
  await commit(B, `const c = JSON.parse(JSON.stringify(d.tracks[3])); c.id='tNEW'; c.name='Copied by B'; c.regions=c.regions.map((r,i)=>({...r,id:'rNEW'+i})); d.tracks.splice(1,0,c);`);
  await commit(A, `const t = d.tracks.splice(d.tracks.length-1,1)[0]; d.tracks.unshift(t);`);
  await commit(A, `d.key = {tonic: 2, mode: 'minor'}; d.chords = [{id:'c1', beat:0, length:4, root:2, quality:'m'}]; d.sections=[{id:'s1',name:'Verse',start:0,length:16,color:'#f00'}];`);
  await commit(B, `const r = d.tracks.flatMap(t=>t.regions).find(r=>r.kind==='midi'); r.notes.push({id:'nB1',pitch:72,start:1,duration:1,velocity:0.9}); r.notes[0].velocity = 0.2;`);
  ms = await converged([A, B], 15000, 'structural');
  results.structural = {
    ms,
    order: await read(A, 'return p.tracks.map(t=>t.name).join(" | ")'),
    hasCopied: await read(A, 'return p.tracks.some(t=>t.id==="tNEW")'),
    key: await read(B, 'return p.key.tonic+p.key.mode'),
  };
  log('structural', results.structural);

  // ---------------------------------------------------------------- per-user undo
  const rid = await read(A, 'return p.tracks[2].regions[0]?.id');
  const rid2 = await read(A, 'return p.tracks[3].regions[0]?.id');
  await commit(A, `d.tracks.flatMap(t=>t.regions).find(r=>r.id==='${rid}').name='A-edit';`);
  await converged([A, B], 15000, 'pre-undo');
  await commit(B, `d.tracks.flatMap(t=>t.regions).find(r=>r.id==='${rid2}').name='B-edit';`);
  await converged([A, B], 15000, 'pre-undo 2');
  await ev(A, async () => (window.__bf.store).undo());
  ms = await converged([A, B], 15000, 'undo');
  results.undo = {
    ms,
    onB: await read(B, `const f=id=>p.tracks.flatMap(t=>t.regions).find(r=>r.id===id).name; return [f('${rid}'), f('${rid2}')]`),
  };
  results.undo.ok = results.undo.onB[0] !== 'A-edit' && results.undo.onB[1] === 'B-edit';
  log('undo', results.undo);

  // ---------------------------------------------------------------- live drag (gesture) propagation
  await ev(A, async () => {
    const st = window.__bf.store;
    st.beginGesture();
    for (let i = 0; i < 30; i++) {
      st.live((d) => {
        d.tracks[0].regions[0].start = 8 + i;
      });
      await new Promise((r) => setTimeout(r, 16));
    }
    st.endGesture();
  });
  ms = await converged([A, B], 15000, 'drag');
  results.drag = { ms, B: await read(B, 'return p.tracks[0].regions[0].start') };
  log('drag', results.drag);

  // ---------------------------------------------------------------- rapid fire from both sides
  const burst = (p, who) =>
    ev(p, async (who) => {
      const st = window.__bf.store;
      const end = performance.now() + 3000;
      let n = 0;
      while (performance.now() < end) {
        for (let k = 0; k < 2; k++) {
          n++;
          st.commit((d) => {
            const t = d.tracks[(n * 7 + (who === 'A' ? 0 : 3)) % d.tracks.length];
            t.volume = Math.random();
            if (n % 5 === 0) d.bpm = 80 + (n % 40);
            const r = t.regions[0];
            if (r && r.kind === 'midi' && n % 3 === 0) r.notes.push({ id: who + n, pitch: 60 + (n % 12), start: (n % 16) / 4, duration: 0.25, velocity: 0.7 });
            if (r && n % 4 === 0) r.start = n % 32;
          });
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      return n;
    }, who);
  const [na, nb] = await Promise.all([burst(A, 'A'), burst(B, 'B')]);
  ms = await converged([A, B], 30000, 'rapid fire');
  results.rapid = { editsA: na, editsB: nb, convergeMs: ms };
  log('rapid fire', results.rapid);

  // ---------------------------------------------------------------- late joiner C (via code entry UI)
  const C = await newPeer('C');
  await C.page.goto(BASE);
  await C.page.waitForFunction(() => window.__bf);
  const tC = Date.now();
  await C.page.click('.home-section-head button').catch(() => {});
  await ev(C, async () => (window.__bf.store).openModal('collab'));
  await C.page.fill('input[placeholder="ABCD-EFGH"]', code.toLowerCase().replace('-', ' '));
  await C.page.click('.jam-card button:has-text("Join")');
  await converged([A, B, C], 60000, 'C join');
  results.joinC_ms = Date.now() - tC;
  log('C joined in', results.joinC_ms);

  // ---------------------------------------------------------------- audio clip transfer
  const audioId = await ev(A, async () => {
    const sr = 44100, n = sr;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin((i / sr) * 2 * Math.PI * 440) * 12000, true);
    const file = new File([buf], 'tone.wav', { type: 'audio/wav' });
    const a = window.__bf.actions;
    await a.importAudioFile(file, undefined, 0);
    const st = window.__bf.store;
    const p = st.useStore.getState().project;
    return p.tracks.flatMap((t) => t.regions).find((r) => r.kind === 'audio')?.audioId;
  });
  const hasClip = (p) => ev(p, async (id) => !!window.__bf.audioStore.getBuffer(id), audioId);
  const tAud = Date.now();
  await waitFor(B, async () => (await hasClip(B)) && (await hasClip(C)), 30000, 'audio transfer');
  results.audio = { ms: Date.now() - tAud, ok: true };
  await converged([A, B, C], 15000, 'post audio');
  log('audio clip transferred', results.audio);

  // ---------------------------------------------------------------- chat
  await ev(B, async () => (await window.__bf.session()).sendChat('hello from B'));
  await waitFor(C, () => ev(C, async () => window.__bf.collab.useCollab.getState().chat.some((m) => m.text === 'hello from B')), 10000, 'chat');
  results.chat = true;

  // ---------------------------------------------------------------- host leaves → election
  const hostBefore = (await state(B)).hostId;
  await A.page.close();
  await A.ctx.close();
  const tH = Date.now();
  await waitFor(B, async () => {
    const [sb, sc] = [await state(B), await state(C)];
    return sb.hostId && sb.hostId !== hostBefore && sb.hostId === sc.hostId && (sb.isHost || sc.isHost);
  }, 30000, 'host election');
  results.hostHandover_ms = Date.now() - tH;
  await commit(C, `d.name = 'After handover'; d.bpm = 123;`);
  await commit(B, `d.tracks[0].volume = 0.55;`);
  ms = await converged([B, C], 20000, 'after handover');
  results.afterHandover = { ms, name: await read(B, 'return p.name + "/" + p.bpm'), vol: await read(C, 'return p.tracks[0].volume') };
  log('host handover', results.hostHandover_ms, results.afterHandover);

  // ---------------------------------------------------------------- reload rejoin
  const tR = Date.now();
  await C.page.reload();
  await C.page.waitForFunction(() => window.__bf);
  await converged([B, C], 60000, 'reload rejoin');
  results.reloadRejoin_ms = Date.now() - tR;
  await commit(C, `d.bpm = 111;`);
  await converged([B, C], 15000, 'post reload edit');
  results.postReloadBpm = await read(B, 'return p.bpm');
  log('reload rejoin', results.reloadRejoin_ms, results.postReloadBpm);

  // ---------------------------------------------------------------- UI screenshot
  await B.page.screenshot({ path: process.argv[4] || '/tmp/jam.png' });
} catch (e) {
  results.error = String(e.stack || e);
}
results.errors = errors;
console.log(JSON.stringify(results, null, 1));
await browser.close();
