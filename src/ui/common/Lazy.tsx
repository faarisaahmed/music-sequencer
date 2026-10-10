// Fallback shown while a code-split panel loads.
export function PanelLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="empty-state">
      <div className="panel-spinner" />
      <div className="faint">{label}</div>
    </div>
  );
}
