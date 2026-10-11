// Tempo and time-signature changes: the timeline math (sudden + gradual tempo, meter changes),
// rendered audio landing at the right seconds, the Tempo lane (add/edit/undo), ruler bar
// numbers, the LCD at the playhead, the score's measures, and MIDI/MusicXML round trips.
// Usage: node tests/tempo-meter.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Midi } = require('@tonejs/midi');
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
process.on('exit', () => !res.__done && console.log('PARTIAL', JSON.stringify(res, null, 1)));
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 300); };
const S = (fn, arg) => page.evaluate(fn, arg);
const near = (a, b, tol = 1e-3) => Math.abs(a - b) < tol;
await page.goto(url);
await page.waitForTimeout(800);

// ---- timeline math
const math = await S(async () => {
  const { TempoMap, Meter } = await import('/src/model/timeline.ts');
  const t = new TempoMap(120, [{ id: 'a', beat: 8, bpm: 60 }]);
  const r = new TempoMap(120, [{ id: 'a', beat: 8, bpm: 120 }, { id: 'b', beat: 16, bpm: 60, ramp: true }]);
  const m = new Meter([4, 4], [{ id: 'x', bar: 2, timeSig: [3, 4] }, { id: 'y', bar: 4, timeSig: [7, 8] }]);
  return {
    s8: t.sec(8), s12: t.sec(12), b6: t.beat(6), bpm10: t.bpmAt(10),
    ramp: r.sec(16) - r.sec(8), rampMid: r.bpmAt(12), rampBack: r.beat(r.sec(13)),
    bar2: m.barStart(2), bar3: m.barStart(3), bar4: m.barStart(4), bar5: m.barStart(5), at10: m.barAt(10).bar, fmt: m.format(11.5), fmt78: m.format(14.5), sig: m.sigAt(15),
    ceil: m.ceilBar(9), add: m.addBars(0, 3), rel: m.relativeTo(8).barStart(1),
  };
});
check('tempoStep', near(math.s8, 4) && near(math.s12, 8) && near(math.b6, 10) && math.bpm10 === 60, math);
check('tempoRamp', near(math.ramp, (60 / -7.5) * Math.log(0.5)) && near(math.rampMid, 90) && near(math.rampBack, 13), math);
check('meterBars', math.bar2 === 8 && math.bar3 === 11 && math.bar4 === 14 && near(math.bar5, 17.5) && math.at10 === 2 && math.fmt === '4.1.3' && math.fmt78 === '5.2.1' && math.sig.join() === '7,8', math);
check('meterHelpers', math.ceil === 11 && math.add === 11 && math.rel === 3, math);

// ---- a song: 4/4 at 120, 3/4 from bar 3, 60 BPM from beat 8
await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'analog-lead');
  const rid = actions.createEmptyRegion(tid, 0, 20);
  store.commit((d) => {
    store.draftRegion(d, rid).notes = [0, 4, 8, 11, 14].map((b, i) => ({ id: 'n' + i, pitch: 72, start: b, duration: 0.25, velocity: 0.9 }));
    d.name = 'Changes';
  });
});

// Show the Tempo lane and add a tempo change from its menu.
await page.click('.tv-toolbar button:has-text("Tempo")');
await page.waitForSelector('.tempo-lane');
const lane = await page.locator('.tempo-lane').boundingBox();
const ppb = await S(() => window.__bf.store.useStore.getState().pxPerBeat);
await page.mouse.click(lane.x + 8 * ppb + 2, lane.y + 30, { button: 'right' });
await page.click('.menu-item:has-text("Add Tempo Change Here")');
await page.waitForSelector('.tempo-pop input');
await page.fill('.tempo-pop input', '60');
await page.press('.tempo-pop input', 'Enter');
await page.waitForTimeout(200);
let p = await S(() => window.__bf.store.useStore.getState().project);
check('laneAddsTempo', p.tempoChanges?.length === 1 && near(p.tempoChanges[0].beat, 8, 0.01) && p.tempoChanges[0].bpm === 60, p.tempoChanges);

// Time signature from bar 3 via the lane menu.
await page.mouse.click(lane.x + 9 * ppb, lane.y + 30, { button: 'right' });
await page.hover('.menu-item:has-text("Time Signature from Bar 3")');
await page.locator('.menu-item', { hasText: /^3\/4$/ }).click();
await page.waitForTimeout(200);
p = await S(() => window.__bf.store.useStore.getState().project);
check('laneAddsMeter', p.meterChanges?.length === 1 && p.meterChanges[0].bar === 2 && p.meterChanges[0].timeSig.join('/') === '3/4', p.meterChanges);
check('rulerShowsMeter', (await page.locator('.rt-sig').allTextContents()).some((t) => t.includes('3/4')));
check('customGrid', (await page.locator('.tv-content.custom-grid').count()) === 1);
check('meterFlags', (await page.locator('.meter-flag').allTextContents()).join('|') === '4/4|3/4', await page.locator('.meter-flag').allTextContents());
await page.screenshot({ path: `${out}/tempo-lane.png` });

// Undo removes the meter change; redo brings it back.
await S(() => window.__bf.store.undo());
check('undoMeter', !(await S(() => window.__bf.store.useStore.getState().project.meterChanges?.length)));
await S(() => window.__bf.store.redo());

// LCD at the playhead: bar 3 beat 2 (beat 9) shows 60 BPM and 3/4.
await S(() => window.__bf.store.useStore.setState({ cursor: 9 }));
await page.waitForTimeout(150);
const lcd = await page.locator('.lcd .lcd-big').allTextContents();
check('lcdAtPlayhead', lcd[0] === '3.2.1' && lcd.includes('60') && lcd.includes('3/4'), lcd);

// Next-bar shortcut follows the meter: from beat 9 → 11 (start of bar 4).
await page.click('.tv-ruler', { position: { x: 9 * ppb, y: 30 } });
await S(() => window.__bf.store.useStore.setState({ cursor: 9, focusArea: 'tracks' }));
const bar4 = await S(() => { const { keymap } = window.__bf; return keymap.keysFor('transport.nextBar')[0]; });
if (bar4) {
  const keys = bar4.replace('Mod', 'Meta').split('+');
  await page.keyboard.press(keys.map((k) => (/^[A-Z]$/.test(k) ? 'Key' + k : k === '.' ? 'Period' : k)).join('+'));
  await page.waitForTimeout(150);
  check('nextBarFollowsMeter', (await S(() => window.__bf.store.useStore.getState().cursor)) === 11, await S(() => window.__bf.store.useStore.getState().cursor));
}

// Gradual change: drag-free edit through the popover toggle.
const tcId = await S(() => window.__bf.store.useStore.getState().project.tempoChanges[0].id);
await S(async (id) => (await import('/src/state/timelineActions.ts')).updateTempoChange(id, { ramp: true }), tcId);

// ---- offline render: notes land at the right seconds
const onsets = await S(async () => {
  const ex = await import('/src/audio/export.ts');
  const { useStore } = window.__bf.store;
  // Back to a sudden change for exact timing.
  const p = useStore.getState().project;
  const proj = { ...p, tempoChanges: p.tempoChanges.map((c) => ({ ...c, ramp: undefined })) };
  const buf = await ex.renderProject(proj, { start: 0, end: 16, tail: 0.5, sampleRate: 22050 });
  const d = buf.getChannelData(0);
  const win = 220;
  const found = [];
  let quiet = true;
  for (let i = 0; i + win < d.length; i += win) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += d[j] * d[j];
    const loud = Math.sqrt(e / win) > 0.02;
    const at = i / buf.sampleRate - 0.05;
    if (loud && quiet && (!found.length || at - Number(found[found.length - 1]) > 0.8)) found.push(at.toFixed(2));
    quiet = !loud;
  }
  return { found, len: buf.duration, bpm: p.bpm };
});
// Beats 0, 4, 8 at the song's opening tempo; then 60 BPM: beat 11 is 3 s after beat 8, beat 14 is 6 s after.
const spb = 60 / onsets.bpm;
const want = [0, 4 * spb, 8 * spb, 8 * spb + 3, 8 * spb + 6];
check('renderTiming', onsets.found.length >= 5 && want.every((w, i) => Math.abs(Number(onsets.found[i]) - w) < 0.06), { ...onsets, want });
check('renderLength', Math.abs(onsets.len - (8 * spb + 8 + 0.5)) < 0.05, onsets.len);

// ---- score: measures follow the meter (4/4, 4/4, then 3/4)
await S(() => {
  const s = window.__bf.store;
  const p = s.useStore.getState().project;
  const t = p.tracks.find((x) => x.regions.length);
  s.useStore.setState({ dockTab: 'editor', editorMode: 'score', selectedTrackId: t.id, editingRegionId: t.regions[0].id });
});
await page.waitForTimeout(1500);
const sm = await S(async () => {
  const { buildScore } = await import('/src/ui/editors/score/notation.ts');
  const { meterOf } = await import('/src/model/timeline.ts');
  const p = window.__bf.store.useStore.getState().project;
  const m = buildScore([], meterOf(p), 17, 0, 0.25);
  return { lens: m.measures.map((x) => x.len), sigs: m.measures.map((x) => x.sig.join('/')), svgTimes: document.querySelectorAll('.score-svg svg .vf-timesignature, .score-svg svg g.vf-stave ~ g text').length };
});
check('scoreMeasures', sm.lens.slice(0, 5).join() === '4,4,3,3,3' && sm.sigs[2] === '3/4', sm);
await page.screenshot({ path: `${out}/tempo-score.png` });
const marks = await S(() => !!document.querySelector('.score-svg svg') && [...document.querySelectorAll('.score-svg svg text')].some((t) => /♩ = 60/.test(t.textContent)));
check('scoreTempoMark', marks);

// ---- MIDI round trip
const midiB64 = await S(async () => {
  const ex = await import('/src/audio/export.ts');
  const b = await ex.projectToMidi(window.__bf.store.useStore.getState().project);
  const a = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s);
});
const midi = new Midi(Buffer.from(midiB64, 'base64'));
const ppq = midi.header.ppq;
check('midiTempos', midi.header.tempos.some((t) => Math.round(t.ticks / ppq) === 8 && Math.round(t.bpm) === 60) && midi.header.tempos.length > 3, midi.header.tempos.map((t) => [t.ticks / ppq, Math.round(t.bpm)]));
check('midiMeters', midi.header.timeSignatures.some((t) => t.ticks / ppq === 8 && t.timeSignature.join('/') === '3/4'), midi.header.timeSignatures);
const back = await S(async (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ex = await import('/src/audio/export.ts');
  const m = await ex.parseMidiFile(new Blob([bytes]));
  await window.__bf.actions.importMidiFile(new File([bytes], 'back.mid'), false);
  const p = window.__bf.store.useStore.getState().project;
  return { meters: m.meters, n: m.tempos.length, pTempo: p.tempoChanges?.length, pMeter: p.meterChanges };
}, midiB64);
check('midiImport', back.meters.some((x) => x.bar === 2 && x.timeSig.join('/') === '3/4') && back.pTempo >= 1 && back.pMeter?.some((x) => x.bar === 2), back);

// ---- MusicXML has the time change and tempo marks
const xml = await S(async () => {
  const { buildScore } = await import('/src/ui/editors/score/notation.ts');
  const { toMusicXml } = await import('/src/ui/editors/score/musicxml.ts');
  const { meterOf } = await import('/src/model/timeline.ts');
  const p = window.__bf.store.useStore.getState().project;
  const part = { id: 'p', trackId: 'p', name: 'Lead', abbr: 'Ld', clefs: ['treble'], transpose: 0, writtenKey: p.key, drums: false, notes: [], marks: [] };
  const m = buildScore([part], meterOf(p), 17, 0, 0.25);
  return toMusicXml(m, 'x', ['Lead'], [p.key], p.timeSig, p.bpm, [{ t: 8, bpm: 60 }]);
});
check('musicXml', /<measure number="3"><attributes><time><beats>3<\/beats><beat-type>4<\/beat-type>/.test(xml.replace(/\n/g, '')) && /<per-minute>60<\/per-minute>/.test(xml), xml.slice(xml.indexOf('<measure number="3"'), xml.indexOf('<measure number="3"') + 300));

check('noErrors', errors.length === 0, errors);
res.__done = true;
console.log(JSON.stringify(res, null, 1));
await browser.close();
