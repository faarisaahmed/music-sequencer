import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, FolderOpen, FileMusic, MoreHorizontal, Music2, Trash2, Copy, Pencil, Download, Play } from 'lucide-react';
import type { ProjectMeta } from '../../model/types';
import { listProjects, loadProject, saveProject } from '../../state/persistence';
import { duplicateProjectById, exportProjectFile, importMidiFile, importProjectFile, openProjectById, removeProject, createNewProject } from '../../state/actions';
import { openModal, toast } from '../../state/store';
import { keyName } from '../../model/music';
import { formatTime } from '../../model/music';
import { showContextMenu } from '../common/menus';
import { download, safeFileName } from '../../audio/export';
import { TEMPLATES } from '../../model/templates';
import { resumeAudio } from '../../audio/context';

function timeAgo(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} days ago`;
  return new Date(ts).toLocaleDateString();
}

function Cover({ hue, seed }: { hue: number; seed: string }) {
  // Deterministic decorative "waveform" bars for each song.
  const bars = useMemo(() => {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 28 }, (_, i) => {
      h = (h * 1103515245 + 12345) >>> 0;
      return 0.25 + ((h >>> 8) % 1000) / 1000 * 0.75 * (0.6 + 0.4 * Math.sin(i / 3));
    });
  }, [seed]);
  return (
    <div className="song-cover" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 50) % 360} 75% 28%))` }}>
      <div className="song-cover-bars">
        {bars.map((b, i) => (
          <div key={i} style={{ height: `${Math.abs(b) * 100}%` }} />
        ))}
      </div>
      <Music2 className="song-cover-note" size={26} />
    </div>
  );
}

export default function HomeScreen() {
  const [songs, setSongs] = useState<ProjectMeta[] | null>(null);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => listProjects().then(setSongs);
  useEffect(() => {
    void refresh();
  }, []);

  const filtered = (songs ?? []).filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const rename = async (id: string, name: string) => {
    const p = await loadProject(id);
    if (!p || !name.trim()) return;
    await saveProject({ ...p, name: name.trim(), updatedAt: Date.now() });
    setRenaming(null);
    void refresh();
  };

  const menuFor = (s: ProjectMeta) => [
    { label: 'Open', icon: <FolderOpen size={14} />, onClick: () => void openProjectById(s.id) },
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => setRenaming(s.id) },
    { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => duplicateProjectById(s.id).then(refresh) },
    {
      label: 'Export Project File',
      icon: <Download size={14} />,
      onClick: async () => {
        const p = await loadProject(s.id);
        if (p) download(await exportProjectFile(p), safeFileName(p.name) + '.bandforge.json');
      },
    },
    { separator: true },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: async () => {
        if (confirm(`Delete "${s.name}"? This cannot be undone.`)) {
          await removeProject(s.id);
          toast(`Deleted ${s.name}`);
          void refresh();
        }
      },
    },
  ];

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (/\.midi?$/i.test(f.name)) await importMidiFile(f, false);
      else if (/\.json$/i.test(f.name)) await importProjectFile(f);
      else toast(`Open a song first to import audio (${f.name})`, 'error');
    }
  };

  return (
    <div
      className="home"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void onFiles(e.dataTransfer.files);
      }}
    >
      <header className="home-header">
        <div className="brand">
          <div className="brand-logo">
            <svg viewBox="0 0 32 32" width="30" height="30">
              <defs>
                <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#ff9f0a" />
                  <stop offset="1" stopColor="#ff2d55" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#lg)" />
              <path d="M10 22V11l12-3v11" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8.3" cy="22" r="2.6" fill="white" />
              <circle cx="20.3" cy="19" r="2.6" fill="white" />
            </svg>
          </div>
          <div>
            <div className="brand-name">BandForge</div>
            <div className="brand-sub">Music studio in your browser</div>
          </div>
        </div>
        <div className="spacer" />
        <div className="home-search">
          <Search size={14} />
          <input type="search" placeholder="Search songs" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()} title="Import a MIDI file or BandForge project">
          <FileMusic size={15} /> Import
        </button>
        <button className="btn primary" onClick={() => openModal('templates')}>
          <Plus size={16} /> New Song
        </button>
        <input ref={fileRef} type="file" accept=".mid,.midi,.json" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
      </header>

      <main className="home-main">
        <section>
          <h2 className="home-h2">Start Something New</h2>
          <div className="quick-row">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                className={'quick-card' + (t.id.startsWith('demo') ? ' demo' : '')}
                onClick={async () => {
                  void resumeAudio();
                  await createNewProject(t.build());
                }}
              >
                <div className="quick-title">{t.name}</div>
                <div className="quick-desc">{t.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="home-h2">
            My Songs <span className="faint">{songs ? `(${songs.length})` : ''}</span>
          </h2>
          {songs && songs.length === 0 && (
            <div className="home-empty">
              <Music2 size={40} />
              <div>No songs yet. Create one above, or drop a MIDI file here.</div>
            </div>
          )}
          <div className="song-grid">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="song-card"
                onDoubleClick={() => void openProjectById(s.id)}
                onContextMenu={(e) => showContextMenu(e, menuFor(s))}
              >
                <div className="song-cover-wrap" onClick={() => void openProjectById(s.id)}>
                  <Cover hue={s.coverHue} seed={s.id} />
                  <div className="song-open">
                    <Play size={22} fill="white" />
                  </div>
                </div>
                <div className="song-info">
                  {renaming === s.id ? (
                    <input
                      autoFocus
                      type="text"
                      defaultValue={s.name}
                      onBlur={(e) => void rename(s.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <div className="song-name" onDoubleClick={(e) => (e.stopPropagation(), setRenaming(s.id))}>
                      {s.name}
                    </div>
                  )}
                  <div className="song-meta">
                    {timeAgo(s.updatedAt)} · {formatTime((s.lengthBeats * 60) / s.bpm)}
                  </div>
                  <div className="song-meta">
                    {s.bpm} BPM · {keyName(s.key)} · {s.trackCount} track{s.trackCount === 1 ? '' : 's'}
                  </div>
                </div>
                <button className="btn ghost icon sm song-more" onClick={(e) => showContextMenu(e, menuFor(s))}>
                  <MoreHorizontal size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="home-foot faint">
        Songs are saved automatically in this browser. Use <b>Export Project File</b> to back them up or move them to another computer.
      </footer>
    </div>
  );
}
