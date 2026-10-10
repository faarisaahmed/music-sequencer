import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5391/');
console.log(JSON.stringify(await page.evaluate(async () => {
  const { produce } = await import('/node_modules/.vite/deps/immer.js').catch(() => import('immer'));
  const sync = await import('/src/collab/sync.ts');
  const { TEMPLATES } = await import('/src/model/templates.ts');
  const { uid } = await import('/src/model/defaults.ts');
  let rnd = 12345;
  const r = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(r() * a.length)];
  let fails = 0, checks = 0;
  for (const t of TEMPLATES.slice(0, 8)) {
    let p = t.build();
    for (let i = 0; i < 150; i++) {
      const prev = p;
      const op = Math.floor(r() * 10);
      p = produce(p, (d) => {
        if (!d.tracks.length) { d.bpm += 1; return; }
        const tr = pick(d.tracks);
        switch (op) {
          case 0: d.bpm = 60 + Math.floor(r() * 100); break;
          case 1: if (tr.regions.length) { const g = pick(tr.regions); g.start += 1; } break;
          case 2: if (tr.regions.length && d.tracks.length > 1) { const gi = Math.floor(r() * tr.regions.length); const [g] = tr.regions.splice(gi, 1); pick(d.tracks.filter((x) => x.type === tr.type) ).regions.push(g); } break;
          case 3: tr.volume = r(); break;
          case 4: if (tr.regions.length) tr.regions.splice(Math.floor(r() * tr.regions.length), 1); break;
          case 5: { const c = JSON.parse(JSON.stringify(tr)); c.id = uid('t'); c.regions = c.regions.map((g) => ({ ...g, id: uid('r') })); d.tracks.splice(Math.floor(r() * d.tracks.length), 0, c); } break;
          case 6: if (d.tracks.length > 1) d.tracks.splice(Math.floor(r() * d.tracks.length), 1); break;
          case 7: { const i = Math.floor(r() * d.tracks.length); const [x] = d.tracks.splice(i, 1); d.tracks.splice(Math.floor(r() * (d.tracks.length + 1)), 0, x); } break;
          case 8: { const g = tr.regions.find((x) => x.kind === 'midi'); if (g) { g.notes.push({ id: uid('n'), pitch: 60, start: r() * 4, duration: 0.5, velocity: 0.7 }); if (g.notes.length > 3) g.notes.splice(0, 1); } } break;
          case 9: d.chords = [...(d.chords ?? []), { id: uid('c'), beat: 0, length: 4, root: 2, quality: 'm' }]; d.mastering = r() > 0.5 ? undefined : { preset: 'x', low: 0, mid: 0, high: 0, glue: 0, ceiling: -1, loudness: 0 }; break;
        }
      });
      const delta = sync.computeDelta(prev, p);
      const applied = delta ? sync.applyDelta(prev, JSON.parse(JSON.stringify(delta))) : prev;
      checks++;
      if (sync.hashProject(applied) !== sync.hashProject(p)) { fails++; if (fails < 4) console.log('mismatch op', op); }
      // order of tracks must match exactly too
      if (applied.tracks.map((x) => x.id).join() !== p.tracks.map((x) => x.id).join()) fails++;
    }
  }
  return { checks, fails };
}), null, 1));
await browser.close();
