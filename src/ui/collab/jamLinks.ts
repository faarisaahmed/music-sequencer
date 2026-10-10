// Startup handling for `#jam=CODE` invite links and silent rejoin after a reload.
import { openModal } from '../../state/store';
import { normalizeCode, loadSession } from '../../collab/state';
import { loadProject } from '../../state/persistence';
import { openProject, migrate } from '../../state/actions';


/** Handle `#jam=CODE` links and silently rejoin after a page reload. */
export async function handleJamLinkOnStartup(): Promise<void> {
  const m = /#jam=([A-Za-z0-9-]+)/.exec(location.hash);
  const code = m ? normalizeCode(m[1]) : null;
  if (!code) return;
  let remembered: { code: string; projectId: string } | null = null;
  try {
    const raw = sessionStorage.getItem('bf.jam.session');
    remembered = raw ? JSON.parse(raw) : null;
  } catch {
    remembered = null;
  }
  if (remembered && remembered.code === code) {
    // Page reload during a session: reopen our copy and rejoin quietly.
    const local = await loadProject(remembered.projectId);
    if (local) await openProject(migrate(local));
    (await loadSession()).joinSession(code, local ? remembered.projectId : undefined);
    return;
  }
  openModal('jamJoin', { code });
}

