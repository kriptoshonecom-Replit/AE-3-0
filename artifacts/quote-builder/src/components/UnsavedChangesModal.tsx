import { AlertCircle } from "lucide-react";

interface Props {
  onYes: () => void;
  onNo: () => void;
}

export default function UnsavedChangesModal({ onYes, onNo }: Props) {
  return (
    <div className="info-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onNo()}>
      <div className="unsaved-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="unsaved-modal-header">
          <AlertCircle size={20} />
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
