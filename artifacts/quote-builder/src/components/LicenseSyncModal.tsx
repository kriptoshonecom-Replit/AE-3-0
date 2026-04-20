import { useEffect } from "react";

interface Props {
  deviceCount: number;
  licenseProductName: string;
  onAutoAdjust: () => void;
  onKeep: () => void;
}

export default function LicenseSyncModal({
  deviceCount,
  licenseProductName,
  onAutoAdjust,
  onKeep,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKeep();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onKeep]);

  return (
    <div
      className="info-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onKeep()}
    >
      <div
        className="unsaved-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 400 }}
      >
        <div className="unsaved-modal-header">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#f59e0b" strokeWidth="1.5" />
            <path
              d="M10 5.5v5"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="10" cy="13.5" r="0.9" fill="#f59e0b" />
          </svg>
          License Quantity Mismatch
        </div>

        <p className="unsaved-modal-text" style={{ marginTop: 12 }}>
          You now have{" "}
          <strong>
            {deviceCount} device{deviceCount !== 1 ? "s" : ""}
          </strong>{" "}
          (terminals&nbsp;+&nbsp;tablets), but your{" "}
          <strong>{licenseProductName}</strong> quantity doesn't match.
          <br />
          <br />
          Auto-adjust it to <strong>{deviceCount}</strong>, or keep the current
          value?
        </p>

        <div className="unsaved-modal-actions">
          <button type="button" className="unsaved-btn-no" onClick={onKeep}>
            Keep it
          </button>
          <button
            type="button"
            className="unsaved-btn-yes"
            onClick={onAutoAdjust}
          >
            Auto Adjust
          </button>
        </div>
      </div>
    </div>
  );
}
