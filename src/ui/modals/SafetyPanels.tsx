import { useEffect, useState } from 'react';
import { Archive, FolderCheck, FolderOpen, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { toast } from '../../state/store';
import {
  backupAllFile,
  backupAllToFolder,
  backupFolderStatus,
  backupListeners,
  canUseBackupFolder,
  chooseBackupFolder,
  deliverFile,
  forgetBackupFolder,
  isPersisted,
  requestPersistence,
  resumeBackupFolder,
  snoozeBackupReminder,
  songsNeedingBackup,
  storageUse,
  type FolderStatus,
} from '../../state/safety';
import './safety.css';

export async function backUpAllSongs(): Promise<void> {
  try {
    const n = await backupAllToFolder();
    if (n) {
      toast(`Backed up ${n} song${n === 1 ? '' : 's'} to your backup folder`, 'success');
      return;
    }
    const r = await deliverFile(await backupAllFile());
    if (r !== 'cancelled') toast('Backup saved. Keep it somewhere safe (iCloud, Google Drive, a USB stick…)', 'success');
  } catch (e) {
    toast('Backup failed: ' + (e as Error).message, 'error');
  }
}

function useBackupInfo() {
  const [folder, setFolder] = useState<FolderStatus>({ kind: 'none' });
  const [need, setNeed] = useState<{ count: number; snoozed: boolean }>({ count: 0, snoozed: true });
  useEffect(() => {
    const load = () => {
      void backupFolderStatus().then(setFolder);
      void songsNeedingBackup().then(setNeed);
    };
    load();
    backupListeners.add(load);
    return () => void backupListeners.delete(load);
  }, []);
  return { folder, setFolder, need };
}

/** Settings → Keep Songs Safe. */
export function SafetySettings() {
  const { folder, setFolder } = useBackupInfo();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [use, setUse] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => {
    void isPersisted().then(setPersisted);
    void storageUse().then(setUse);
  }, []);
  const mb = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);

  const pickFolder = async () => {
    try {
      setFolder(await chooseBackupFolder());
      toast('Backup folder set. Every song is copied there as you work', 'success');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Could not use that folder: ' + (e as Error).message, 'error');
    }
  };

  return (
    <div className="safety">
      <div className="safety-row">
        {persisted ? <ShieldCheck size={18} className="ok" /> : <ShieldAlert size={18} className="warn" />}
        <div className="grow">
          <b>{persisted ? 'Songs are protected in this browser' : persisted === null ? 'Songs are saved in this browser' : 'The browser may clear songs if space runs low'}</b>
          <span className="dim">
            {persisted ? "The browser won't delete them to free up space." : 'Allow permanent storage, and keep backups too.'}
            {use && ` Using ${mb(use.used)}.`}
          </span>
        </div>
        {persisted === false && (
          <button
            className="btn sm"
            onClick={async () => {
              const ok = await requestPersistence();
              setPersisted(ok);
              toast(ok ? 'Songs are now protected' : 'The browser said no. Installing BandForge as an app usually allows it', ok ? 'success' : 'info');
            }}
          >
            Protect
          </button>
        )}
      </div>

      {canUseBackupFolder() && (
        <div className="safety-row">
          {folder.kind === 'ok' ? <FolderCheck size={18} className="ok" /> : <FolderOpen size={18} className={folder.kind === 'paused' ? 'warn' : 'dim'} />}
          <div className="grow">
            <b>{folder.kind === 'none' ? 'Backup folder' : folder.kind === 'ok' ? `Backing up to “${folder.name}”` : `Backups to “${folder.name}” are paused`}</b>
            <span className="dim">
              {folder.kind === 'none'
                ? 'Pick a folder (one that syncs to iCloud, Dropbox or Google Drive is ideal) and every song is copied there as you work.'
                : folder.kind === 'ok'
                  ? 'Each song is saved there as a .bandforge.json file within a minute of changes.'
                  : 'The browser needs your OK again after a restart.'}
            </span>
          </div>
          {folder.kind === 'paused' && (
            <button className="btn sm primary" onClick={async () => setFolder(await resumeBackupFolder())}>
              Resume
            </button>
          )}
          <button className="btn sm" onClick={() => void pickFolder()}>
            {folder.kind === 'none' ? 'Choose Folder…' : 'Change…'}
          </button>
          {folder.kind !== 'none' && (
            <button className="btn ghost icon sm" title="Stop backing up to this folder" onClick={() => void forgetBackupFolder()}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="safety-row">
        <Archive size={18} className="dim" />
        <div className="grow">
          <b>Back up all songs</b>
          <span className="dim">One file with every song and recording. Open it with Import on the Home screen to bring them back.</span>
        </div>
        <button className="btn sm" onClick={() => void backUpAllSongs()}>
          Back Up Now
        </button>
      </div>
    </div>
  );
}

/** Home screen reminder when songs haven't been backed up for a while. */
export function BackupBanner() {
  const { folder, setFolder, need } = useBackupInfo();
  if (need.snoozed || need.count === 0) return null;
  return (
    <div className="backup-banner">
      <ShieldAlert size={18} />
      <div className="grow">
        <b>
          {need.count} song{need.count === 1 ? " hasn't" : "s haven't"} been backed up in over a week
        </b>
        <span>Songs live in this browser. A backup keeps them safe if it's cleared or you switch devices.</span>
      </div>
      {folder.kind === 'paused' ? (
        <button className="btn sm primary" onClick={async () => setFolder(await resumeBackupFolder())}>
          Resume Folder Backups
        </button>
      ) : (
        <button className="btn sm primary" onClick={() => void backUpAllSongs()}>
          Back Up Now
        </button>
      )}
      <button className="btn ghost icon sm" title="Remind me in 3 days" onClick={() => void snoozeBackupReminder(3)}>
        <X size={15} />
      </button>
    </div>
  );
}
