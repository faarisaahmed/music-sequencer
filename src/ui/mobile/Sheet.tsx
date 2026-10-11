// A bottom sheet: the phone's version of menus and popovers.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import './mobile.css';

export function Sheet({ title, onClose, children }: { title?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  // Close on a whole tap of the backdrop (down and up on it), so the tap doesn't land on
  // whatever is underneath once the sheet is gone.
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="m-sheet-backdrop"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div className="m-sheet" role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="m-sheet-grab" />
        {title && <div className="m-sheet-title">{title}</div>}
        <div className="m-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function SheetItem({
  icon,
  label,
  hint,
  onClick,
  disabled,
  danger,
  more,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  more?: boolean;
}) {
  return (
    <button className={'m-sheet-item' + (danger ? ' danger' : '')} disabled={disabled} onClick={onClick}>
      {icon && <span className="m-sheet-icon">{icon}</span>}
      <span className="m-sheet-label">{label}</span>
      {hint && <span className="m-sheet-hint">{hint}</span>}
      {more && <ChevronRight size={16} className="m-sheet-chev" />}
    </button>
  );
}
