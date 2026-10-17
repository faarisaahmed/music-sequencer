// Sampler: importing finds the sample's pitch (plays in tune) and saves it to My Samples; trim
// handles, fades, reverse, Classic vs One-Shot (checked by rendering audio); Slice mode with Auto
// Chop finding the hits in a break, one slice per key from C4, double-click to add / remove a
// slice; Make Drum Kit puts slices on drum rows; My Samples reloads a sound into another track and
// shows up in drum row menus; a trim drag is one undo step.
// Usage: node tests/sampler.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);

// Test sounds: a decaying A3 tone and a 2 s "break" with four hits.
function wav(samples, sr = 44100) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32000), 44 + i * 2));
  return b;
}
const SR = 44100;
const tone = Array.from({ length: SR * 1.5 }, (_, i) => 0.8 * Math.sin((2 * Math.PI * 220 * i) / SR) * Math.exp(-i / (SR * 0.5)));
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const brk = Array.from({ length: SR * 2 }, (_, i) => {
  const t = (i / SR) % 0.5;
  return 0.9 * rnd() * Math.exp(-t / 0.05);
});
const dir = mkdtempSync(join(tmpdir(), 'bf-sampler-'));
writeFileSync(join(dir, 'tone-a3.wav'), wav(tone));
writeFileSync(join(dir, 'break.wav'), wav(brk));

const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
const res = {};
const check = (k, ok, info) => {
  res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 400);
};
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(url);
await page.waitForTimeout(800);

// Pitch detection on clean tones and noise.
const pitches = await S(async () => {
  const { detectPitch } = await import('/src/audio/sampleTools.ts');
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const make = (f) => {
    const b = ctx.createBuffer(1, 44100, 44100);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = f ? 0.5 * Math.sin((2 * Math.PI * f * i) / 44100) + 0.2 * Math.sin((4 * Math.PI * f * i) / 44100) : Math.random() * 2 - 1;
    return b;
  };
  return [110, 261.63, 440, 0].map((f) => detectPitch(make(f)));
});
check('detects pitch (A2, C4, A4) and not noise', JSON.stringify(pitches) === '[45,60,69,null]', pitches);

// A Sampler track; import the tone through the file picker.
const tid = await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  store.commit((d) => void (d.bpm = 120));
  const id = actions.addTrack('instrument', 'user-sampler');
  store.useStore.setState({ selectedTrackId: id, dockTab: 'instrument' });
  return id;
});
await page.waitForTimeout(500);
const track = () => S((id) => window.__bf.store.useStore.getState().project.tracks.find((t) => t.id === id), tid);
await page.locator('.smp input[type=file]').setInputFiles(join(dir, 'tone-a3.wav'));
await page.waitForTimeout(800);
let t = await track();
check('import loads the sample', !!t.samplerAudioId && (await page.locator('.smp-editor canvas').count()) === 1);
check('import finds its pitch (A3) as the root', t.samplerRoot === 57, t.samplerRoot);
const lib = await S(async () => (await import('/src/audio/sampleLibrary.ts')).loadSampleLibrary());
check('import is saved to My Samples', lib.some((x) => x.id === t.samplerAudioId && x.name === 'tone-a3'), lib);

// Render helper: notes on the sampler track → loudness every 50 ms.
const render = (notes, beats = 4) =>
  S(
    async ([id, notes, beats]) => {
      const { store, actions } = window.__bf;
      store.commit((d) => {
        const tr = d.tracks.find((x) => x.id === id);
        tr.fx.reverb = 0;
        tr.fx.delay = 0;
        tr.regions = [{ id: 'rg-test', kind: 'midi', start: 0, length: beats, contentLength: beats, offset: 0, loop: false, name: 'T', notes: notes.map((n, i) => ({ id: 'n' + i, velocity: 0.9, ...n })) }];
      });
      const m = await import('/src/audio/export.ts');
      const buf = await m.renderProject(store.useStore.getState().project, { start: 0, end: beats });
      const d = buf.getChannelData(0);
      const win = Math.floor(buf.sampleRate * 0.05);
      const rms = [];
      for (let i = 0; i + win <= d.length; i += win) {
        let e = 0;
        for (let j = 0; j < win; j++) e += d[i + j] * d[i + j];
        rms.push(Math.sqrt(e / win));
      }
      void actions;
      return rms;
    },
    [tid, notes, beats],
  );
// Loud = within 26 dB of the render's peak (ignores the quiet reverb tail).
const rel = (rms) => Math.max(...rms) * 0.05;
const lastLoud = (rms) => rms.reduce((k, v, i) => (v > rel(rms) ? i : k), -1) * 0.05;
const firstLoud = (rms) => rms.findIndex((v) => v > rel(rms)) * 0.05;
const set = (patch) => S(([id, patch]) => window.__bf.actions.updateTrack(id, (t) => void (t.sampler = { mode: 'classic', start: 0, end: 1, ...t.sampler, ...patch })), [tid, patch]);

// Classic: let go after a quarter beat (0.125 s) → stops soon after. One-shot: plays to the end.
await set({ mode: 'classic' });
const classic = await render([{ pitch: 57, start: 0, duration: 0.25 }]);
await set({ mode: 'oneshot' });
const oneshot = await render([{ pitch: 57, start: 0, duration: 0.25 }]);
check('Classic stops when the key is let go', lastLoud(classic) < 0.9, lastLoud(classic));
check('One-Shot plays the whole sound', lastLoud(oneshot) > 1.2, lastLoud(oneshot));

// Trim the end to a third: one-shot ends around 0.5 s.
await set({ mode: 'oneshot', end: 1 / 3 });
const trimmed = await render([{ pitch: 57, start: 0, duration: 0.25 }]);
// Cut at 0.5 s while still loud: right after, it's much quieter than the untrimmed sound (only reverb left).
check('trimming the end shortens the sound', trimmed[8] > oneshot[8] * 0.8 && trimmed[13] < oneshot[13] * 0.35, { before: [trimmed[8], oneshot[8]], after: [trimmed[13], oneshot[13]] });

// Reverse: the decaying tone swells instead (loudest near its end).
await set({ mode: 'oneshot', end: 1, reverse: true });
const rev = await render([{ pitch: 57, start: 0, duration: 0.25 }]);
const peakAt = rev.indexOf(Math.max(...rev)) * 0.05;
check('reverse plays it backwards', peakAt > 1.0, { peakAt });
await set({ reverse: false });

// Pitch: an octave up plays at double speed (half as long).
const up = await render([{ pitch: 69, start: 0, duration: 0.25 }]);
check('higher keys play it higher (shorter)', lastLoud(up) < lastLoud(oneshot) * 0.7, { up: lastLoud(up), base: lastLoud(oneshot) });

// Fade in: the start is quiet.
await set({ fadeIn: 0.4 });
const faded = await render([{ pitch: 57, start: 0, duration: 0.25 }]);
check('fade in softens the start', faded[1] < oneshot[1] * 0.5, { faded: faded[1], plain: oneshot[1] });
await set({ fadeIn: 0 });

// UI: drag the start handle; one undo step reverts it.
await page.locator('.smp-modes button', { hasText: 'Classic' }).click();
await page.waitForTimeout(200);
const box = await page.locator('.smp-editor').boundingBox();
const startX = box.x + 1;
await page.mouse.move(startX, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(startX + i * 30, box.y + box.height / 2);
await page.mouse.up();
await page.waitForTimeout(200);
t = await track();
check('dragging the start handle trims', t.sampler.start > 0.1 && t.sampler.start < 0.25, t.sampler);
await S(() => window.__bf.store.undo());
t = await track();
check('a trim drag is one undo step', t.sampler.start === 0, t.sampler);

// Slice mode on the break: Auto Chop finds the four hits.
await page.locator('.smp input[type=file]').setInputFiles(join(dir, 'break.wav'));
await page.waitForTimeout(800);
await page.locator('.smp-modes button', { hasText: 'Slice' }).click();
await page.waitForTimeout(300);
t = await track();
const cuts = await S(async (s) => (await import('/src/audio/instruments.ts')).sliceStarts(s), t.sampler);
check('Slice mode auto-chops at the hits', cuts.length === 4 && cuts.every((c, i) => Math.abs(c - i * 0.25) < 0.02), cuts);
check('slices are shown with their keys', (await page.locator('.smp-cut').count()) === 4 && (await page.locator('.smp-cut span').first().textContent()) === 'C4');
const sl = await render([
  { pitch: 61, start: 0, duration: 0.25 },
  { pitch: 64, start: 2, duration: 0.25 },
]);
check('each key plays its slice; keys past the last slice are silent', firstLoud(sl) < 0.1 && lastLoud(sl) < 0.6, { first: firstLoud(sl), last: lastLoud(sl) });

// Double-click adds a slice between hits; double-clicking it again removes it.
const eb = await page.locator('.smp-editor').boundingBox();
await page.mouse.dblclick(eb.x + eb.width * 0.375, eb.y + eb.height / 2);
await page.waitForTimeout(200);
const added = await page.locator('.smp-cut').count();
await page.mouse.dblclick(eb.x + eb.width * 0.375, eb.y + eb.height / 2);
await page.waitForTimeout(200);
check('double-click adds and removes a slice', added === 5 && (await page.locator('.smp-cut').count()) === 4, { added });
await page.locator('.smp-opts button', { hasText: '8' }).click();
await page.waitForTimeout(150);
check('equal slices', (await page.locator('.smp-cut').count()) === 8);
await page.locator('.smp-opts button', { hasText: 'Auto Chop' }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: out + '/sampler.png' });

// Make Drum Kit: a drum track with a row per slice, in the Beat Sequencer.
await page.locator('.smp-opts button', { hasText: 'Make Drum Kit' }).click();
await page.waitForTimeout(800);
const kit = await S(() => {
  const s = window.__bf.store.useStore.getState();
  const d = s.project.tracks.find((x) => x.type === 'drums');
  return { rows: Object.keys(d?.drumSamples ?? {}).map(Number), names: Object.values(d?.drumSamples ?? {}).map((x) => x.name), mode: s.editorMode, sel: s.selectedTrackId === d?.id };
});
check('Make Drum Kit puts slices on drum rows', kit.rows.length === 4 && kit.rows.join() === '36,38,39,42' && kit.names[0] === 'Slice 1' && kit.mode === 'steps' && kit.sel, kit);
await page.waitForTimeout(400);
await page.locator('.ss-more').first().click();
await page.waitForTimeout(200);
check('drum row menu offers My Samples', (await page.locator('.menu-item', { hasText: 'From My Samples' }).count()) === 1);
await page.keyboard.press('Escape');
await page.screenshot({ path: out + '/sampler-kit.png' });

// My Samples: a second Sampler track picks the tone from the library.
const t2 = await S(() => {
  const { actions, store } = window.__bf;
  const id = actions.addTrack('instrument', 'user-sampler');
  store.useStore.setState({ selectedTrackId: id, dockTab: 'instrument' });
  return id;
});
await page.waitForTimeout(400);
await page.locator('.smp-bar button', { hasText: 'My Samples' }).click();
await page.waitForTimeout(250);
await page.locator('.menu-item', { hasText: 'tone-a3' }).first().click();
await page.waitForTimeout(500);
const t2v = await S((id) => window.__bf.store.useStore.getState().project.tracks.find((x) => x.id === id), t2);
check('My Samples loads a saved sound into another track', t2v.samplerAudioId === t.samplerAudioId || (t2v.samplerAudioId && t2v.samplerRoot === 57), t2v);

check('no page errors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
const fails = Object.values(res).filter((v) => v !== 'ok').length;
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
