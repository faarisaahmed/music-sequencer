// QA: Jam Session edge cases (concurrency, deletes under an open editor, undo storms, stalls, 4 peers).
// node tests/jam-qa-edge.mjs <chromium-exe> [base-url]
import { setup, sleep } from './jam-lib.mjs';

const exe = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5391/';
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

  // 1. Same region dragged by both at once (live gestures).
  const rid = await read(A, 'return p.tracks[2].regions[0].id');
  const drag = (p, base) =>
    ev(p, async ({ rid, base }) => {
      const st = window.__bf.store;
      st.beginGesture();
      for (let i = 0; i < 40; i++) {
        st.live((d) => {
          for (const t of d.tracks) for (const r of t.regions) if (r.id === rid) r.start = base + i;
        });
        await new Promise((r) => setTimeout(r, 12));
      }
      st.endGesture();
    }, { rid, base });
  await Promise.all([drag(A, 100), drag(B, 200)]);
  await converged([A, B], 20000, 'same-region drag');
  const starts = [await read(A, `return p.tracks.flatMap(t=>t.regions).find(r=>r.id==='${rid}').start`), await read(B, `return p.tracks.flatMap(t=>t.regions).find(r=>r.id==='${rid}').start`)];
  check('sameRegionDrag', starts[0] === starts[1] && [139, 239].includes(starts[0]), { starts });

  // 2. B deletes a track while A has one of its regions open in the piano roll and is editing notes.
  const target = await read(A, `const t = p.tracks.find(t=>t.type==='instrument' && t.regions.some(r=>r.kind==='midi')); return {tid:t.id, rid:t.regions.find(r=>r.kind==='midi').id}`);
  await ev(A, ({ tid, rid }) => {
    window.__bf.store.useStore.setState({ selectedTrackId: tid, selectedRegionIds: [rid], editingRegionId: rid, dockTab: 'editor', editorMode: 'pianoroll' });
  }, target);
  await sleep(500);
  const editing = ev(A, async (rid) => {
    const st = window.__bf.store;
    for (let i = 0; i < 30; i++) {
      st.commit((d) => {
        for (const t of d.tracks) for (const r of t.regions) if (r.id === rid && r.kind === 'midi') r.notes.push({ id: 'q' + i + Math.random(), pitch: 60 + (i % 12), start: i % 8, duration: 0.5, velocity: 0.8 });
      });
      await new Promise((r) => setTimeout(r, 25));
    }
  }, target.rid);
  await sleep(200);
  await commit(B, `d.tracks = d.tracks.filter(t => t.id !== '${target.tid}');`);
  await editing;
  await converged([A, B], 20000, 'delete under editor');
  const gone = await read(A, `return !p.tracks.some(t=>t.id==='${target.tid}')`);
  const aUi = await ev(A, () => ({ editing: window.__bf.store.useStore.getState().editingRegionId, sel: window.__bf.store.useStore.getState().selectedRegionIds, editorText: document.querySelector('.editor-panel, .empty-state')?.textContent?.slice(0, 80) }));
  check('deleteTrackUnderOpenEditor', gone && !errors.some((e) => e.startsWith('A')), { aUi });

  // 3. Both change BPM at the same moment.
  await Promise.all([commit(A, 'd.bpm = 91;'), commit(B, 'd.bpm = 133;')]);
  await converged([A, B], 20000, 'bpm');
  const bpms = [await read(A, 'return p.bpm'), await read(B, 'return p.bpm')];
  check('simultaneousBpm', bpms[0] === bpms[1] && [91, 133].includes(bpms[0]), { bpms });

  // 4. Undo/redo storm on A while B keeps editing other things.
  const ids = await read(A, 'return p.tracks.map(t=>t.id)');
  const storm = ev(A, async (ids) => {
    const st = window.__bf.store;
    for (let i = 0; i < 60; i++) {
      const r = Math.random();
      if (r < 0.45) st.commit((d) => void (d.tracks.find((t) => t.id === ids[0]).pan = Math.round(Math.random() * 100) / 100));
      else if (r < 0.75) st.undo();
      else st.redo();
      await new Promise((r) => setTimeout(r, 30));
    }
  }, ids);
  const bEdits = ev(B, async (ids) => {
    const st = window.__bf.store;
    for (let i = 0; i < 40; i++) {
      st.commit((d) => void (d.tracks.find((t) => t.id === ids[ids.length - 1]).name = 'B ' + i));
      await new Promise((r) => setTimeout(r, 45));
    }
  }, ids);
  await Promise.all([storm, bEdits]);
  await converged([A, B], 20000, 'undo storm');
  const bName = await read(A, `return p.tracks.find(t=>t.id==='${ids[ids.length - 1]}').name`);
  check('undoStormKeepsOthersEdits', bName === 'B 39', { bName });

  // 5. A stalls (main thread blocked 4s, like a frozen/backgrounded tab) while B edits; then both edit.
  const stall = ev(A, () => {
    const end = performance.now() + 4000;
    while (performance.now() < end) {
      /* busy */
    }
  });
  for (let i = 0; i < 20; i++) {
    await commit(B, `d.tracks[0].volume = ${(i + 1) / 40};`);
    await sleep(100);
  }
  await stall;
  await commit(A, 'd.tracks[1].volume = 0.21;');
  await converged([A, B], 30000, 'after stall');
  const vols = await read(A, 'return [p.tracks[0].volume, p.tracks[1].volume]');
  check('stallRecovery', vols[0] === 0.5 && vols[1] === 0.21, { vols });

  // 6. MIDI import into the shared song.
  await ev(B, async () => {
    // Build a tiny 1-track MIDI file with @tonejs/midi via the app's export helpers.
    const { projectToMidi } = await import('/src/audio/export.ts');
    const p = window.__bf.store.useStore.getState().project;
    const blob = await projectToMidi({ ...p, tracks: p.tracks.slice(0, 1) });
    await window.__bf.actions.importMidiFile(new File([blob], 'qa.mid', { type: 'audio/midi' }), true);
  });
  await converged([A, B], 20000, 'midi import');
  check('midiImportPropagates', (await read(A, 'return p.tracks.length')) === (await read(B, 'return p.tracks.length')));

  // 7. Live Loops grid edits propagate.
  await commit(B, `d.liveLoops = { scenes: [{id:'s1', name:'Intro'}], cells: [] };`);
  await converged([A, B], 20000, 'liveloops');
  check('liveLoopsPropagate', (await read(A, 'return p.liveLoops?.scenes?.[0]?.name')) === 'Intro');

  // 8. Four participants editing at once.
  const C = await newPeer('C');
  const D = await newPeer('D');
  await join(C, code);
  await join(D, code);
  await converged([A, B, C, D], 40000, '4 peers join');
  const all = [A, B, C, D];
  await Promise.all(
    all.map((p, i) =>
      ev(p, async (i) => {
        const st = window.__bf.store;
        for (let k = 0; k < 40; k++) {
          st.commit((d) => {
            const t = d.tracks[(k + i) % d.tracks.length];
            t.volume = Math.round(Math.random() * 100) / 100;
            const r = t.regions[0];
            if (r && r.kind === 'midi') r.notes.push({ id: `p${i}-${k}`, pitch: 50 + k, start: k % 8, duration: 0.25, velocity: 0.5 });
          });
          await new Promise((r) => setTimeout(r, 40));
        }
      }, i),
    ),
  );
  const ms4 = await converged(all, 30000, '4 peers');
  const noteCounts = await Promise.all(all.map((p) => read(p, 'return p.tracks.reduce((n,t)=>n+t.regions.reduce((m,r)=>m+(r.notes?.length??0),0),0)')));
  check('fourPeers', new Set(noteCounts).size === 1, { ms4, noteCounts });

  // 9. Idle message rate (after things settle).
  await sleep(3000);
  const before = await Promise.all(all.map((p) => ev(p, () => window.__qa.dcSends)));
  await sleep(10000);
  const after = await Promise.all(all.map((p) => ev(p, () => window.__qa.dcSends)));
  const rates = after.map((a, i) => +((a - before[i]) / 10).toFixed(2));
  check('idleMessageRate', rates.every((r) => r < 5), { perSecond: rates });

  // 10. Toasts never mention internal errors.
  const allToasts = (await Promise.all(all.map((p) => T.toastsOf(p)))).flat();
  check('noErrorToasts', !allToasts.some((t) => /abort|undefined|null|error:/i.test(t)), { allToasts });
} catch (e) {
  results.error = String(e.stack || e);
}
results.errors = errors;
console.log(JSON.stringify(results, null, 1));
await T.browser.close();
