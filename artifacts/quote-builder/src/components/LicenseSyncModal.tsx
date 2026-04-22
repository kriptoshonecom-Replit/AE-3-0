import { useEffect } from "react";

interface Props {
  deviceCount: number;
  licenseProductName: string;
  displayMessage?: string;
  onAutoAdjust: () => void;
  onKeep: () => void;
}

export default function LicenseSyncModal({
  deviceCount,
  licenseProductName,
  displayMessage,
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
          <img
            src="/warning-btn.png"
            alt="Warning"
            style={{ width: 22, height: 22, flexShrink: 0 }}
          />
          License Quantity Mismatch
        </div>

        <p className="unsaved-modal-text" style={{ marginTop: 12 }}>
          {displayMessage ? (
            <>
              {displayMessage}
              <br />
              <br />
              Auto-adjust <strong>{licenseProductName}</strong> to{" "}
              <strong>{deviceCount}</strong>, or keep the current value?
            </>
          ) : (
            <>
              You now have{" "}
              <strong>
                {deviceCount} device{deviceCount !== 1 ? "s" : ""}
              </strong>{" "}
              (terminals&nbsp;+&nbsp;tablets), but your{" "}
              <strong>{licenseProductName}</strong> quantity doesn't match.
              <br />
              <br />
              Auto-adjust it to <strong>{deviceCount}</strong>, or keep the
              current value?
            </>
          )}
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
