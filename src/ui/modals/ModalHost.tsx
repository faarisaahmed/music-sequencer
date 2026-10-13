import { lazy, Suspense } from 'react';
import { useStore } from '../../state/store';

// Dialogs load when first opened.
const NewTrackDialog = lazy(() => import('./NewTrackDialog'));
const ExportDialog = lazy(() => import('./ExportDialog'));
const SettingsDialog = lazy(() => import('./SettingsDialog'));
const HelpDialog = lazy(() => import('./HelpDialog'));
const TemplatesDialog = lazy(() => import('../home/TemplatesDialog'));
const CollabDialog = lazy(() => import('../collab/CollabUI').then((m) => ({ default: m.CollabDialog })));
const JoinDialog = lazy(() => import('../collab/CollabUI').then((m) => ({ default: m.JoinDialog })));
const VersionsDialog = lazy(() => import('./VersionsDialog'));
const YouTubeDialog = lazy(() => import('./YouTubeDialog'));
const PartsDialog = lazy(() => import('../editors/score/PartsDialog'));
const GuidesView = lazy(() => import('../guides/GuidesView'));

function Body({ kind }: { kind: string }) {
  switch (kind) {
    case 'newTrack':
      return <NewTrackDialog />;
    case 'export':
      return <ExportDialog />;
    case 'youtube':
      return <YouTubeDialog />;
    case 'parts':
      return <PartsDialog />;
    case 'versions':
      return <VersionsDialog />;
    case 'settings':
      return <SettingsDialog />;
    case 'guides':
      return <GuidesView />;
    case 'help':
      return <HelpDialog />;
    case 'templates':
      return <TemplatesDialog />;
    case 'collab':
      return <CollabDialog />;
    case 'jamJoin':
      return <JoinDialog />;
    default:
      return null;
  }
}

export default function ModalHost() {
  const modal = useStore((s) => s.modal);
  if (!modal) return null;
  return (
    <Suspense fallback={null}>
      <Body kind={modal.kind} />
    </Suspense>
  );
}
