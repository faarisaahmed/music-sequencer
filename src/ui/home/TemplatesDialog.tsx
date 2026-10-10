import { closeModal } from '../../state/store';
import { createNewProject } from '../../state/actions';
import { TEMPLATES } from '../../model/templates';
import { IconFor } from '../common/icons';
import { resumeAudio } from '../../audio/context';
import Modal from '../modals/Modal';

export default function TemplatesDialog() {
  return (
    <Modal title="New Song" width={720}>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="template-card"
            onClick={async () => {
              void resumeAudio();
              closeModal();
              await createNewProject(t.build());
            }}
          >
            <div className="template-icon">
              <IconFor name={t.icon} size={30} />
            </div>
            <div className="template-name">{t.name}</div>
            <div className="template-desc">{t.description}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
