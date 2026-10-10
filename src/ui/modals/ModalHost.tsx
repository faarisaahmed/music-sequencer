import { useStore } from '../../state/store';
import NewTrackDialog from './NewTrackDialog';
import ExportDialog from './ExportDialog';
import SettingsDialog from './SettingsDialog';
import HelpDialog from './HelpDialog';
import TemplatesDialog from '../home/TemplatesDialog';
import SongWizardDialog from '../assistant/SongWizardDialog';

export default function ModalHost() {
  const modal = useStore((s) => s.modal);
  if (!modal) return null;
  switch (modal.kind) {
    case 'newTrack':
      return <NewTrackDialog />;
    case 'export':
      return <ExportDialog />;
    case 'settings':
      return <SettingsDialog />;
    case 'help':
      return <HelpDialog />;
    case 'templates':
      return <TemplatesDialog />;
    case 'songWizard':
      return <SongWizardDialog />;
    default:
      return null;
  }
}
