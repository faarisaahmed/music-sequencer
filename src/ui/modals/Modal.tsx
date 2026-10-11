import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { closeModal } from '../../state/store';
import { keyCapture } from '../keys/keymap';

export default function Modal({
  title,
  children,
  footer,
  width,
  onClose = closeModal,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  onClose?: () => void;
}) {
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !keyCapture.active) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div className="modal" style={{ width }}>
        <div className="modal-head">
          <div className="grow">{title}</div>
          <button className="btn ghost icon sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
