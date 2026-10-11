import { useEffect, useState } from 'react';
import { Bookmark, Copy, History, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { closeModal, replaceProject, toast, useStore } from '../../state/store';
import { createNewProject } from '../../state/actions';
import { deleteVersion, listVersions, loadVersion, renameVersion, saveVersion, type VersionMeta } from '../../state/safety';
import { flushSave } from '../../state/persistence';
import { getEngine } from '../../audio/engine';
import { uid } from '../../model/defaults';
import { formatTime } from '../../model/music';
import Modal from './Modal';
import './safety.css';

function when(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }) + `, ${time}`;
}

export default function VersionsDialog() {
  const p = useStore((s) => s.project)!;
  const [list, setList] = useState<VersionMeta[] | null>(null);
  const [label, setLabel] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [onlyNamed, setOnlyNamed] = useState(false);

  const refresh = () => listVersions(p.id).then(setList);
  useEffect(() => {
    void refresh();
  }, [p.id]);

  const save = async () => {
    await flushSave();
    await saveVersion(useStore.getState().project!, { label: label || `Version ${(list ?? []).filter((v) => !v.auto).length + 1}` });
    setLabel('');
    toast('Version saved', 'success');
    void refresh();
  };

  const restore = async (v: VersionMeta) => {
    const old = await loadVersion(v.key);
    if (!old) return toast('That version could not be read', 'error');
    await flushSave();
    // Keep what you have now, so restoring can always be taken back.
    await saveVersion(useStore.getState().project!, { auto: true, reason: 'Before restoring' });
    getEngine().stop();
    replaceProject(old);
    await getEngine().loadProjectAudio(useStore.getState().project!);
    toast(`Restored ${v.label ?? when(v.at)}. Undo brings back what you had`, 'success');
    closeModal();
  };

  const openCopy = async (v: VersionMeta) => {
    const old = await loadVersion(v.key);
    if (!old) return;
    const now = Date.now();
    closeModal();
    await createNewProject({ ...old, id: uid('p'), name: `${old.name} (${v.label ?? when(v.at)})`, createdAt: now, updatedAt: now });
  };

  const shown = (list ?? []).filter((v) => !onlyNamed || !v.auto);

  return (
    <Modal title="Version History" width={620}>
      <div className="ver-save">
        <Bookmark size={16} className="dim" />
        <input
          type="text"
          placeholder="Name this version, e.g. “Before new chorus”"
          value={label}
          maxLength={80}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') void save();
          }}
        />
        <button className="btn primary ver-save-btn" onClick={() => void save()}>
          Save Version
        </button>
      </div>
      <div className="ver-head">
        <span className="dim">BandForge also saves a version automatically when you open a song and every 10 minutes while you work.</span>
        <label className="ver-filter">
          <input type="checkbox" checked={onlyNamed} onChange={(e) => setOnlyNamed(e.target.checked)} /> Named only
        </label>
      </div>
      <div className="ver-list">
        {list && shown.length === 0 && (
          <div className="ver-empty">
            <History size={28} />
            <span>{onlyNamed ? 'No named versions yet.' : 'No versions yet. Save one above before a big change.'}</span>
          </div>
        )}
        {shown.map((v) => (
          <div key={v.key} className={'ver-row' + (v.auto ? ' auto' : '')}>
            <div className="ver-icon">{v.auto ? <History size={14} /> : <Bookmark size={14} />}</div>
            <div className="ver-main">
              {renaming === v.key ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={v.label ?? ''}
                  placeholder="Version name"
                  onBlur={async (e) => {
                    await renameVersion(v.key, e.target.value);
                    setRenaming(null);
                    void refresh();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <b>{v.label ?? v.reason ?? 'Automatic'}</b>
              )}
              <span className="dim">
                {when(v.at)} · {v.trackCount} track{v.trackCount === 1 ? '' : 's'} · {formatTime(v.seconds)}
                {v.name !== p.name && ` · “${v.name}”`}
              </span>
            </div>
            <div className="ver-actions">
              <button className="btn sm" onClick={() => void restore(v)} title="Go back to this version (you can undo it)">
                <RotateCcw size={13} /> Restore
              </button>
              <button className="btn ghost icon sm" onClick={() => void openCopy(v)} title="Open this version as a separate song">
                <Copy size={14} />
              </button>
              <button className="btn ghost icon sm" onClick={() => setRenaming(v.key)} title={v.auto ? 'Name it (keeps it from being cleaned up)' : 'Rename'}>
                <Pencil size={14} />
              </button>
              <button
                className="btn ghost icon sm"
                title="Delete this version"
                onClick={async () => {
                  await deleteVersion(v.key);
                  void refresh();
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
