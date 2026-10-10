import { useState } from 'react';
import { Download } from 'lucide-react';
import { closeModal, toast, useStore } from '../../state/store';
import { exportProjectFile } from '../../state/actions';
import { download, encodeMp3, exportWav, normalize, projectToMidi, renderProject, safeFileName } from '../../audio/export';
import { contentEndBeat } from '../../model/defaults';
import { formatTime } from '../../model/music';
import { Toggle } from '../common/controls';
import Modal from './Modal';
import '../mixer/mixer.css';

type Format = 'mp3' | 'wav' | 'midi' | 'project';

const FORMATS: { id: Format; name: string; desc: string }[] = [
  { id: 'mp3', name: 'MP3', desc: 'Share anywhere' },
  { id: 'wav', name: 'WAV', desc: 'Lossless audio' },
  { id: 'midi', name: 'MIDI', desc: 'Notes for other apps' },
  { id: 'project', name: 'Project', desc: 'Full backup' },
];

export default function ExportDialog() {
  const p = useStore((s) => s.project)!;
  const [format, setFormat] = useState<Format>('mp3');
  const [kbps, setKbps] = useState(192);
  const [range, setRange] = useState<'song' | 'cycle'>('song');
  const [norm, setNorm] = useState(true);
  const [tail, setTail] = useState(2.5);
  const [stems, setStems] = useState(false);
  const [name, setName] = useState(p.name);
  const [busy, setBusy] = useState<null | { label: string; f: number }>(null);

  const end = Math.max(contentEndBeat(p), 4);
  const start = range === 'cycle' ? p.loop.start : 0;
  const stop = range === 'cycle' ? p.loop.end : end;
  const seconds = ((stop - start) * 60) / p.bpm + (format === 'mp3' || format === 'wav' ? tail : 0);
  const file = safeFileName(name);
  const audio = format === 'mp3' || format === 'wav';

  const run = async () => {
    try {
      if (format === 'midi') {
        download(projectToMidi(p), file + '.mid');
      } else if (format === 'project') {
        setBusy({ label: 'Packing project…', f: 0.5 });
        download(await exportProjectFile(p), file + '.bandforge.json');
      } else {
        const targets = stems ? p.tracks.map((t) => ({ id: t.id, label: t.name })) : [{ id: undefined as string | undefined, label: '' }];
        for (let i = 0; i < targets.length; i++) {
          const tg = targets[i];
          const prefix = stems ? `${tg.label} (${i + 1}/${targets.length}) — ` : '';
          setBusy({ label: prefix + 'Rendering…', f: 0 });
          const buf = await renderProject(p, {
            start,
            end: stop,
            tail,
            onlyTrackId: tg.id,
            onProgress: (f) => setBusy({ label: prefix + 'Rendering…', f: f * (format === 'mp3' ? 0.6 : 1) }),
          });
          if (norm) normalize(buf);
          const fname = stems ? `${file} - ${safeFileName(tg.label)}` : file;
          if (format === 'wav') {
            download(exportWav(buf), fname + '.wav');
          } else {
            setBusy({ label: prefix + 'Encoding MP3…', f: 0.6 });
            const blob = await encodeMp3(buf, kbps, (f) => setBusy({ label: prefix + 'Encoding MP3…', f: 0.6 + f * 0.4 }));
            download(blob, fname + '.mp3');
          }
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

  return (
    <Modal
      title="Export Song"
      width={560}
      footer={
        <>
          <button className="btn" onClick={closeModal} disabled={!!busy}>
            Cancel
          </button>
          <button className="btn primary export-go" onClick={() => void run()} disabled={!!busy || (range === 'cycle' && p.loop.end <= p.loop.start)}>
            <Download size={15} /> Export {FORMATS.find((f) => f.id === format)!.name}
          </button>
        </>
      }
    >
      <div className="export-formats">
        {FORMATS.map((f) => (
          <button key={f.id} className={'export-fmt' + (format === f.id ? ' on' : '')} onClick={() => setFormat(f.id)}>
            <b>{f.name}</b>
            <span>{f.desc}</span>
          </button>
        ))}
      </div>
      <div className="form-grid" style={{ marginTop: 18 }}>
        <span className="label">File name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        {audio && (
          <>
            <span className="label">Range</span>
            <div className="seg" style={{ justifySelf: 'start' }}>
              <button className={range === 'song' ? 'on' : ''} onClick={() => setRange('song')}>
                Whole song
              </button>
              <button className={range === 'cycle' ? 'on' : ''} onClick={() => setRange('cycle')}>
                Cycle region
              </button>
            </div>
            {format === 'mp3' && (
              <>
                <span className="label">Quality</span>
                <div className="seg" style={{ justifySelf: 'start' }}>
                  {[128, 192, 320].map((k) => (
                    <button key={k} className={kbps === k ? 'on' : ''} onClick={() => setKbps(k)}>
                      {k} kbps
                    </button>
                  ))}
                </div>
              </>
            )}
            <span className="label">Reverb tail</span>
            <div className="row">
              <input type="range" min={0} max={6} step={0.5} value={tail} onChange={(e) => setTail(Number(e.target.value))} />
              <span className="mono dim">{tail.toFixed(1)} s</span>
            </div>
            <span className="label">Normalize</span>
            <div className="row">
              <Toggle on={norm} onChange={setNorm} />
              <span className="dim" style={{ fontSize: 12 }}>
                Make the loudest peak just under 0 dB
              </span>
            </div>
            <span className="label">Stems</span>
            <div className="row">
              <Toggle on={stems} onChange={setStems} />
              <span className="dim" style={{ fontSize: 12 }}>
                Export every track as its own file
              </span>
            </div>
            <span className="label">Length</span>
            <span className="dim">{formatTime(seconds)}</span>
          </>
        )}
        {format === 'midi' && (
          <>
            <span className="label">Contents</span>
            <span className="dim">{p.tracks.filter((t) => t.type !== 'audio').length} instrument tracks (audio tracks are skipped)</span>
          </>
        )}
        {format === 'project' && (
          <>
            <span className="label">Contents</span>
            <span className="dim">Everything, including recordings — re-open it from the Home screen with Import.</span>
          </>
        )}
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
