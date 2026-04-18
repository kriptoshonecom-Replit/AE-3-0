interface Props {
  onYes: () => void;
  onNo: () => void;
}

export default function UnsavedChangesModal({ onYes, onNo }: Props) {
  return (
    <div className="info-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onNo()}>
      <div className="unsaved-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="unsaved-modal-header">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 6v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="10" cy="13.5" r="0.9" fill="currentColor" />
          </svg>
          Unsaved Changes
        </div>
        <p className="unsaved-modal-text">
          You did not save your last edit, would you like me to save it for you?
        </p>
        <div className="unsaved-modal-actions">
          <button type="button" className="unsaved-btn-no" onClick={onNo}>
            No
          </button>
          <button type="button" className="unsaved-btn-yes" onClick={onYes}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
