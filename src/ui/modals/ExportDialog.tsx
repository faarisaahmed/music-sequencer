import { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, Trash2 } from 'lucide-react';
import { closeModal, commit, toast, useStore } from '../../state/store';
import { exportProjectFile } from '../../state/actions';
import { canExport, download, encodeAudio, normalize, projectToMidi, renderProject, safeFileName, type AudioFormat } from '../../audio/export';
import { contentEndBeat } from '../../model/defaults';
import { formatTime } from '../../model/music';
import type { SongInfo } from '../../model/types';
import { Toggle } from '../common/controls';
import Modal from './Modal';
import { makeCover } from './coverArt';
import '../mixer/mixer.css';
import './export.css';

type Format = AudioFormat | 'midi' | 'project';

const FORMATS: { id: Format; name: string; desc: string }[] = [
  { id: 'mp3', name: 'MP3', desc: 'Plays everywhere' },
  { id: 'm4a', name: 'M4A', desc: 'AAC · Apple devices' },
  { id: 'flac', name: 'FLAC', desc: 'Lossless, smaller' },
  { id: 'wav', name: 'WAV', desc: 'Lossless, studio' },
  { id: 'ogg', name: 'OGG', desc: 'Opus · web & games' },
  { id: 'midi', name: 'MIDI', desc: 'Notes for other apps' },
  { id: 'project', name: 'Project', desc: 'Full backup' },
];

const AUDIO: Format[] = ['mp3', 'm4a', 'flac', 'wav', 'ogg'];
const BITRATES: Partial<Record<Format, number[]>> = {
  mp3: [128, 192, 256, 320],
  m4a: [128, 192, 256, 320],
  ogg: [96, 128, 192, 256],
};
const DEPTHS: Partial<Record<Format, { v: 16 | 24 | 32; label: string }[]>> = {
  wav: [
    { v: 16, label: '16-bit' },
    { v: 24, label: '24-bit' },
    { v: 32, label: '32-bit float' },
  ],
  flac: [
    { v: 16, label: '16-bit' },
    { v: 24, label: '24-bit' },
  ],
};
const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Electronic', 'Dance', 'House', 'Lo-Fi', 'Jazz', 'Blues', 'Classical', 'Soundtrack', 'Folk', 'Country', 'Metal', 'Punk', 'Indie', 'Ambient', 'Funk', 'Soul', 'Reggae', 'Latin', 'Gospel', 'Video Game'];

interface Prefs {
  format: Format;
  kbps: Partial<Record<Format, number>>;
  bits: Partial<Record<Format, 16 | 24 | 32>>;
  rate: 44100 | 48000;
  norm: boolean;
  tail: number;
  swing: boolean;
}
const DEFAULT_PREFS: Prefs = { format: 'mp3', kbps: { mp3: 256, m4a: 256, ogg: 192 }, bits: { wav: 24, flac: 24 }, rate: 44100, norm: true, tail: 2.5, swing: true };
const PREFS_KEY = 'bf.export';

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* private mode */
  }
  return DEFAULT_PREFS;
}

function fileSize(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export default function ExportDialog() {
  const p = useStore((s) => s.project)!;
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [range, setRange] = useState<'song' | 'cycle'>('song');
  const [stems, setStems] = useState(false);
  const [midiTracks, setMidiTracks] = useState<string[] | null>(null);
  // The file name follows the song title until you type your own.
  const [typedName, setTypedName] = useState<string | null>(null);
  const name = typedName ?? safeFileName(p.name);
  const [busy, setBusy] = useState<null | { label: string; f: number }>(null);
  const [oggOk, setOggOk] = useState(true);

  const format: Format = prefs.format === 'ogg' && !oggOk ? 'mp3' : prefs.format;
  const update = (patch: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });

  useEffect(() => {
    void canExport('ogg').then(setOggOk);
  }, []);

  const audio = AUDIO.includes(format);
  const kbps = prefs.kbps[format] ?? BITRATES[format]?.[2] ?? 256;
  const bits = prefs.bits[format] ?? 24;
  const end = Math.max(contentEndBeat(p), 4);
  const start = range === 'cycle' ? p.loop.start : 0;
  const stop = range === 'cycle' ? p.loop.end : end;
  const seconds = ((stop - start) * 60) / p.bpm + (audio ? prefs.tail : 0);
  const noteTracks = p.tracks.filter((t) => t.type !== 'audio' && t.regions.some((r) => r.kind === 'midi' && r.notes.length));
  const chosenMidi = midiTracks ?? noteTracks.map((t) => t.id);
  const file = safeFileName(name);
  const ext = format === 'project' ? 'bandforge.json' : format === 'midi' ? 'mid' : format;

  let estimate = 0;
  if (BITRATES[format]) estimate = (kbps * 1000 * seconds) / 8;
  else if (format === 'wav') estimate = prefs.rate * 2 * (bits / 8) * seconds;
  else if (format === 'flac') estimate = prefs.rate * 2 * (bits / 8) * seconds * 0.6;
  const fileCount = audio && stems ? p.tracks.length : 1;

  const run = async () => {
    try {
      if (format === 'midi') {
        download(await projectToMidi(p, { swing: prefs.swing, trackIds: chosenMidi }), file + '.mid');
      } else if (format === 'project') {
        setBusy({ label: 'Packing project…', f: 0.5 });
        download(await exportProjectFile(p), file + '.bandforge.json');
      } else {
        const fmt = format as AudioFormat;
        const targets = stems ? p.tracks.map((t) => ({ id: t.id as string | undefined, label: t.name })) : [{ id: undefined, label: '' }];
        for (let i = 0; i < targets.length; i++) {
          const tg = targets[i];
          const prefix = stems ? `${tg.label} (${i + 1}/${targets.length}): ` : '';
          setBusy({ label: prefix + 'Rendering…', f: 0 });
          const buf = await renderProject(p, {
            start,
            end: stop,
            tail: prefs.tail,
            sampleRate: prefs.rate,
            onlyTrackId: tg.id,
            onProgress: (f) => setBusy({ label: prefix + 'Rendering…', f: f * 0.7 }),
          });
          if (prefs.norm) normalize(buf);
          setBusy({ label: prefix + `Encoding ${fmt.toUpperCase()}…`, f: 0.7 });
          const blob = await encodeAudio(buf, fmt, p, { kbps, bits, part: stems ? tg.label : undefined }, (f) =>
            setBusy({ label: prefix + `Encoding ${fmt.toUpperCase()}…`, f: 0.7 + f * 0.3 }),
          );
          download(blob, (stems ? `${file} - ${safeFileName(tg.label)}` : file) + '.' + fmt);
        }
      }
      setBusy(null);
      toast('Export complete', 'success');
      closeModal();
    } catch (e) {
      console.error(e);
      setBusy(null);
      toast('Export failed: ' + (e as Error).message, 'error');
    }
  };

  const disabled = !!busy || (audio && range === 'cycle' && p.loop.end <= p.loop.start) || (format === 'midi' && chosenMidi.length === 0);

  return (
    <Modal
      title="Export Song"
      width={820}
      footer={
        <>
          <span className="export-summary dim">
            {file}.{ext}
            {fileCount > 1 && ` + ${fileCount - 1} more`}
            {audio && ` · ${formatTime(seconds)}`}
            {estimate > 0 && ` · about ${fileSize(estimate * fileCount)}`}
          </span>
          <button className="btn" onClick={closeModal} disabled={!!busy}>
            Cancel
          </button>
          <button className="btn primary export-go" onClick={() => void run()} disabled={disabled}>
            <Download size={15} /> Export {FORMATS.find((f) => f.id === format)!.name}
          </button>
        </>
      }
    >
      <div className="export-formats">
        {FORMATS.map((f) => {
          const off = f.id === 'ogg' && !oggOk;
          return (
            <button
              key={f.id}
              className={'export-fmt' + (format === f.id ? ' on' : '')}
              disabled={off || !!busy}
              title={off ? "This browser can't make OGG files. Try Chrome, Edge or Firefox" : undefined}
              onClick={() => update({ format: f.id })}
            >
              <b>{f.name}</b>
              <span>{f.desc}</span>
            </button>
          );
        })}
      </div>
      <div className={'export-body' + (format === 'project' ? ' single' : '')}>
        <div className="form-grid export-settings">
          <span className="label">File name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setTypedName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {audio && (
            <>
              {BITRATES[format] && (
                <>
                  <span className="label">Quality</span>
                  <div className="seg export-seg">
                    {BITRATES[format]!.map((k) => (
                      <button key={k} className={kbps === k ? 'on' : ''} onClick={() => update({ kbps: { ...prefs.kbps, [format]: k } })}>
                        {k}
                        <small>kbps</small>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {DEPTHS[format] && (
                <>
                  <span className="label">Bit depth</span>
                  <div className="seg export-seg">
                    {DEPTHS[format]!.map((d) => (
                      <button key={d.v} className={bits === d.v ? 'on' : ''} onClick={() => update({ bits: { ...prefs.bits, [format]: d.v } })}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <span className="label">Sample rate</span>
              <div className="seg export-seg">
                {([44100, 48000] as const).map((r) => (
                  <button key={r} className={prefs.rate === r ? 'on' : ''} onClick={() => update({ rate: r })} title={r === 44100 ? 'CD and streaming standard' : 'Video standard'}>
                    {r / 1000} kHz
                  </button>
                ))}
              </div>
              <span className="label">Range</span>
              <div className="seg export-seg">
                <button className={range === 'song' ? 'on' : ''} onClick={() => setRange('song')}>
                  Whole song
                </button>
                <button className={range === 'cycle' ? 'on' : ''} onClick={() => setRange('cycle')} disabled={p.loop.end <= p.loop.start} title="The yellow cycle area in the ruler">
                  Cycle area
                </button>
              </div>
              <span className="label">Reverb tail</span>
              <div className="row">
                <input type="range" min={0} max={6} step={0.5} value={prefs.tail} onChange={(e) => update({ tail: Number(e.target.value) })} />
                <span className="mono dim">{prefs.tail.toFixed(1)} s</span>
              </div>
              <span className="label">Normalize</span>
              <div className="row">
                <Toggle on={prefs.norm} onChange={(v) => update({ norm: v })} />
                <span className="dim export-hint">Loudest peak just under 0 dB</span>
              </div>
              <span className="label">Stems</span>
              <div className="row">
                <Toggle on={stems} onChange={setStems} />
                <span className="dim export-hint">Every track as its own file</span>
              </div>
            </>
          )}
          {format === 'midi' && (
            <>
              <span className="label">Timing</span>
              <div className="seg export-seg">
                <button className={prefs.swing ? 'on' : ''} onClick={() => update({ swing: true })} title="Swing is written into the note timing">
                  As played
                </button>
                <button className={!prefs.swing ? 'on' : ''} onClick={() => update({ swing: false })} title="Straight notes, exactly as written">
                  As written
                </button>
              </div>
              <span className="label export-top">Tracks</span>
              <div className="export-tracks">
                {noteTracks.length === 0 && <span className="dim">No tracks with notes yet.</span>}
                {noteTracks.map((t) => {
                  const on = chosenMidi.includes(t.id);
                  return (
                    <label key={t.id} className="export-track">
                      <input type="checkbox" checked={on} onChange={() => setMidiTracks(on ? chosenMidi.filter((id) => id !== t.id) : [...chosenMidi, t.id])} />
                      <i style={{ background: t.color }} />
                      {t.name}
                    </label>
                  );
                })}
                {p.tracks.some((t) => t.type === 'audio') && <span className="dim export-hint">Audio recordings aren't notes, so they're left out.</span>}
              </div>
              <span className="label">Includes</span>
              <span className="dim export-hint">Tempo, time and key signature, instruments, section markers and your song info.</span>
            </>
          )}
          {format === 'project' && (
            <>
              <span className="label">Contents</span>
              <span className="dim">Everything, including recordings. Open it again from the Home screen with Import.</span>
            </>
          )}
        </div>
        {format !== 'project' && <SongInfoPanel />}
      </div>
      {busy && (
        <div className="col" style={{ marginTop: 18, gap: 6 }}>
          <div className="dim" style={{ fontSize: 12 }}>
            {busy.label}
          </div>
          <div className="progress">
            <div style={{ width: `${Math.round(busy.f * 100)}%` }} />
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Title, artist, album and cover, saved with the song and written into exported files. */
function SongInfoPanel() {
  const p = useStore((s) => s.project)!;
  const info = p.info ?? {};
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const set = (patch: Partial<SongInfo>) =>
    commit((d) => {
      const next: SongInfo = { ...(d.info ?? {}), ...patch };
      for (const k of Object.keys(next) as (keyof SongInfo)[]) if (next[k] === '' || next[k] === undefined) delete next[k];
      d.info = next;
    });

  const pickCover = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { cover, thumb, small } = await makeCover(f);
      set({ cover, coverThumb: thumb });
      if (small) toast('That image is small. Covers look best at 1000×1000 or larger', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  // Text fields save when you leave them (one undo step each).
  const text = (k: 'artist' | 'album' | 'albumArtist' | 'genre' | 'composer' | 'comment', label: string, placeholder?: string, list?: string) => (
    <label className="info-field">
      <span>{label}</span>
      <input
        key={`${k}:${info[k] ?? ''}`}
        type="text"
        defaultValue={info[k] ?? ''}
        placeholder={placeholder}
        list={list}
        onBlur={(e) => e.target.value.trim() !== (info[k] ?? '') && set({ [k]: e.target.value.trim() })}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
  const num = (k: 'year' | 'trackNumber' | 'trackTotal', placeholder: string, max: number) => (
    <input
      key={`${k}:${info[k] ?? ''}`}
      type="number"
      min={1}
      max={max}
      placeholder={placeholder}
      defaultValue={info[k] ?? ''}
      onBlur={(e) => {
        const v = Math.round(Number(e.target.value));
        const next = e.target.value === '' || !Number.isFinite(v) || v < 1 ? undefined : Math.min(max, v);
        if (next !== info[k]) set({ [k]: next });
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );

  return (
    <div className="song-info-panel">
      <div className="info-head">Song Info</div>
      <div className="info-top">
        <div
          className={'info-cover' + (drag ? ' drag' : '') + (info.cover ? ' has' : '')}
          title={info.cover ? 'Change the album cover' : 'Add an album cover'}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void pickCover(e.dataTransfer.files[0]);
          }}
        >
          {info.cover ? (
            <img src={info.cover} alt="Album cover" draggable={false} />
          ) : (
            <div className="info-cover-empty">
              <ImagePlus size={22} />
              <span>Add cover</span>
              <small>Drop or click</small>
            </div>
          )}
          {info.cover && (
            <button
              className="btn icon sm info-cover-remove"
              title="Remove cover"
              onClick={(e) => {
                e.stopPropagation();
                set({ cover: undefined, coverThumb: undefined });
              }}
            >
              <Trash2 size={13} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void pickCover(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div className="info-main">
          <label className="info-field">
            <span>Title</span>
            <input
              key={'title:' + p.name}
              type="text"
              defaultValue={p.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.name) commit((d) => void (d.name = v));
                else e.target.value = p.name;
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
          {text('artist', 'Artist', 'Your name')}
          {text('album', 'Album', 'Single')}
        </div>
      </div>
      <div className="info-grid">
        {text('albumArtist', 'Album artist', info.artist || 'Same as artist')}
        {text('genre', 'Genre', undefined, 'bf-genres')}
        <label className="info-field">
          <span>Year</span>
          {num('year', String(new Date().getFullYear()), 9999)}
        </label>
        <label className="info-field">
          <span>Track</span>
          <div className="info-track">
            {num('trackNumber', '1', 999)}
            <span className="dim">of</span>
            {num('trackTotal', '1', 999)}
          </div>
        </label>
        {text('composer', 'Composer')}
        {text('comment', 'Comment')}
      </div>
      <datalist id="bf-genres">
        {GENRES.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="info-foot faint">Saved with the song and written into every file you export.</div>
    </div>
  );
}
