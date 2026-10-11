// Export: every audio format downloads with title/artist/album/cover tags embedded, settings
// are remembered, MIDI carries instruments, key, markers and song info. Song info is saved
// with the project and the cover shows on the Home screen.
// Usage: node tests/export.mjs <chromium> <url> <outdir>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Midi } = require('@tonejs/midi');
const [exe, url = 'http://localhost:5391/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errors.push('console: ' + m.text()));
await page.goto(url);
await page.waitForTimeout(800);
const res = {};
const check = (k, ok, info) => { res[k] = ok ? 'ok' : 'FAIL ' + JSON.stringify(info ?? '').slice(0, 300); };
const S = (fn, arg) => page.evaluate(fn, arg);

await S(async () => {
  const { actions, templates, store } = window.__bf;
  await actions.createNewProject(templates.TEMPLATES.find((t) => t.id === 'empty').build());
  const tid = actions.addTrack('instrument', 'violin');
  const rid = actions.createEmptyRegion(tid, 0, 4);
  store.commit((d) => {
    store.draftRegion(d, rid).notes = [0, 1, 2, 3].map((i) => ({ id: 'n' + i, pitch: 64 + i * 2, start: i, duration: 1, velocity: 0.8 }));
    d.name = 'Night Drive';
    d.key = { tonic: 9, mode: 'minor' };
    d.sections = [{ id: 's1', name: 'Verse', start: 0, length: 4, color: '#f00' }];
  });
  store.openModal('export');
});
await page.waitForSelector('.song-info-panel');

// Fill in song info.
const fill = async (label, v) => {
  const inp = page.locator('.info-field', { hasText: label }).locator('input').first();
  await inp.fill(v);
  await inp.press('Enter');
};
await fill('Artist', 'Faaris');
await fill('Album', 'First Light');
await fill('Genre', 'Electronic');
await fill('Year', '2026');
await fill('Composer', 'F. A.');
await page.locator('.info-track input').nth(0).fill('3');
await page.locator('.info-track input').nth(0).press('Enter');
await page.locator('.info-track input').nth(1).fill('10');
await page.locator('.info-track input').nth(1).press('Enter');
// A non-square cover image: should be centre-cropped to a square.
const png = await S(() => {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 800;
  const g = c.getContext('2d');
  g.fillStyle = '#c33'; g.fillRect(0, 0, 1200, 800);
  g.fillStyle = '#33c'; g.fillRect(300, 100, 600, 600);
  return c.toDataURL('image/png').split(',')[1];
});
await page.setInputFiles('.info-cover input[type=file]', { name: 'art.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await page.waitForTimeout(500);
const info = await S(() => window.__bf.store.useStore.getState().project.info);
check('infoSaved', info?.artist === 'Faaris' && info.album === 'First Light' && info.genre === 'Electronic' && info.year === 2026 && info.trackNumber === 3 && info.trackTotal === 10 && info.composer === 'F. A.', info && { ...info, cover: !!info.cover, coverThumb: !!info.coverThumb });
const dims = await S(() => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = window.__bf.store.useStore.getState().project.info.cover; }));
check('coverSquare', dims[0] === dims[1] && dims[0] === 800, dims);
check('coverShown', await page.locator('.info-cover img').count() === 1);
// Undo restores the previous info (one step per field).
await S(() => window.__bf.store.undo());
const afterUndo = await S(() => window.__bf.store.useStore.getState().project.info);
check('undoable', !afterUndo?.cover && afterUndo?.artist === 'Faaris', afterUndo && { cover: !!afterUndo.cover });
await S(() => window.__bf.store.redo());

const bytes = (path) => readFileSync(path);
const has = (buf, s) => buf.includes(Buffer.from(s, 'utf8'));
async function exportAs(fmt, setup) {
  await page.click(`.export-fmt:has(b:text-is("${fmt}"))`);
  if (setup) await setup();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click('.export-go')]);
  const path = `${out}/export-test.${dl.suggestedFilename().split('.').pop()}`;
  await dl.saveAs(path);
  await page.waitForTimeout(300);
  const name = dl.suggestedFilename();
  await S(() => window.__bf.store.openModal('export'));
  await page.waitForSelector('.song-info-panel');
  return { name, buf: bytes(path) };
}

let f = await exportAs('MP3', () => page.click('.export-seg button:has-text("320")'));
check('mp3', f.name === 'Night Drive.mp3' && f.buf.subarray(0, 3).toString() === 'ID3' && has(f.buf, 'TIT2') && has(f.buf, 'Faaris') && has(f.buf, 'First Light') && has(f.buf, 'APIC') && has(f.buf, 'TCOM') && f.buf.length > 20000, { name: f.name, len: f.buf.length, head: f.buf.subarray(0, 3).toString() });
const mp3Len = f.buf.length;
f = await exportAs('M4A');
check('m4a', f.name.endsWith('.m4a') && has(f.buf, 'ftyp') && has(f.buf, 'covr') && f.buf.includes(Buffer.from('©ART', 'latin1')) && has(f.buf, 'Faaris') && has(f.buf, 'First Light') && f.buf.includes(Buffer.from('©wrt', 'latin1')), { name: f.name, len: f.buf.length });
f = await exportAs('FLAC', () => page.click('.export-seg button:text-is("16-bit")'));
check('flac', f.buf.subarray(0, 4).toString() === 'fLaC' && /ARTIST=Faaris/i.test(f.buf.toString('latin1')) && /ALBUM=First Light/i.test(f.buf.toString('latin1')) && has(f.buf, 'image/jpeg'), { len: f.buf.length });
f = await exportAs('WAV', () => page.click('.export-seg button:text-is("24-bit")'));
const bitsPerSample = f.buf.readUInt16LE(f.buf.indexOf('fmt ') + 8 + 14);
check('wav', f.buf.subarray(0, 4).toString() === 'RIFF' && has(f.buf, 'ID3 ') && has(f.buf, 'Faaris') && has(f.buf, 'APIC') && bitsPerSample === 24, { bitsPerSample });
const oggEnabled = await page.locator('.export-fmt:has(b:text-is("OGG"))').isEnabled();
if (oggEnabled) {
  f = await exportAs('OGG');
  check('ogg', f.buf.subarray(0, 4).toString() === 'OggS' && has(f.buf, 'OpusTags') && /ARTIST=Faaris/i.test(f.buf.toString('latin1')) && /METADATA_BLOCK_PICTURE=/i.test(f.buf.toString('latin1')), { len: f.buf.length });
} else check('ogg', true);

// MIDI: instruments, key, markers, song info; "As written" drops swing.
await S(() => window.__bf.store.commit((d) => void (d.groove = { grid: 8, amount: 2 / 3 })));
f = await exportAs('MIDI', () => page.click('.export-seg button:has-text("As written")'));
let midi = new Midi(f.buf);
const tr = midi.tracks.find((t) => t.notes.length) ?? midi.tracks[0];
console.log(midi.tracks.map((t) => [t.name, t.notes.length, t.instrument.number]));
check('midiInstrument', midi.tracks.length === 1 && tr.instrument.number === 40 && tr.name === 'Violin', { n: tr.instrument.number, name: tr.name });
check('midiKey', midi.header.keySignatures[0]?.key === 'C' && midi.header.keySignatures[0]?.scale === 'minor', midi.header.keySignatures);
check('midiMeta', has(f.buf, '(C) Faaris, 2026') && midi.header.meta.some((m) => m.type === 'marker' && m.text === 'Verse') && midi.header.meta.some((m) => /Album: First Light/.test(m.text)), midi.header.meta);
check('midiAsWritten', tr.notes[1]?.ticks === midi.header.ppq, tr.notes.map((n) => n.ticks));
f = await exportAs('MIDI', () => page.click('.export-seg button:has-text("As played")'));
midi = new Midi(f.buf);
const tp = midi.tracks.find((t) => t.notes.length);
check('midiAsPlayed', tp?.notes.length === 4, tp?.notes.map((n) => n.ticks));

// Settings are remembered next time.
await page.click('.export-fmt:has(b:text-is("MP3"))');
await S(() => window.__bf.store.closeModal());
await S(() => window.__bf.store.openModal('export'));
await page.waitForSelector('.export-fmt.on');
check('remembersFormat', (await page.locator('.export-fmt.on b').textContent()) === 'MP3');
check('remembersBitrate', (await page.locator('.export-seg button.on').first().textContent()).startsWith('320'));
check('sizeEstimate', /about [\d.]+ (KB|MB)/.test(await page.locator('.export-summary').textContent()), await page.locator('.export-summary').textContent());
check('mp3Size', mp3Len > 0);
await page.screenshot({ path: `${out}/export-dialog.png` });

// Cover on the Home screen after saving.
await S(async () => {
  const { useStore } = window.__bf.store;
  window.__bf.store.closeModal();
  const { saveProject } = await import('/src/state/persistence.ts');
  await saveProject(useStore.getState().project);
});
await S(() => window.__bf.actions.closeProject());
await page.waitForTimeout(800);
check('homeCover', await page.locator('.song-cover-img').count() >= 1 && await page.locator('.song-artist', { hasText: 'Faaris' }).count() >= 1);
await page.screenshot({ path: `${out}/export-home.png` });

check('noErrors', errors.length === 0, errors);
console.log(JSON.stringify(res, null, 1));
await browser.close();
