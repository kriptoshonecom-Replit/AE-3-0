import type { CustomerProfile } from "../pages/CDMPage";

interface Props {
  match: CustomerProfile;
  onUseRecord: (customer: CustomerProfile) => void;
  onKeepGoing: () => void;
}

export default function CdmDuplicateModal({ match, onUseRecord, onKeepGoing }: Props) {
  const addr = match.address;
  const addrStreet = [addr?.number, addr?.name].filter(Boolean).join(" ");
  const addrCity = [addr?.city, addr?.state, addr?.zip].filter(Boolean).join(", ");
  const addrFull = [addrStreet, addrCity].filter(Boolean).join(", ");

  return (
    <div
      className="info-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onKeepGoing()}
    >
      <div className="cdm-dup-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cdm-dup-header">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M3 15.5c0-3.314 2.686-6 6-6s6 2.686 6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Similar entry exists within CDM records
        </div>

        <div className="cdm-dup-body">
          <p className="cdm-dup-prompt">
            A matching customer was found. Would you like to use this record and pre-fill the
            remaining fields, or continue with your current input?
          </p>

          <div className="cdm-dup-card">
            {match.companyName && (
              <div className="cdm-dup-row">
                <span className="cdm-dup-label">Company</span>
                <span className="cdm-dup-value">{match.companyName}</span>
              </div>
            )}
            {match.customerName && (
              <div className="cdm-dup-row">
                <span className="cdm-dup-label">Contact</span>
                <span className="cdm-dup-value">{match.customerName}</span>
              </div>
            )}
            {match.customerEmail && (
              <div className="cdm-dup-row">
                <span className="cdm-dup-label">Email</span>
                <span className="cdm-dup-value">{match.customerEmail}</span>
              </div>
            )}
            {match.customerPhone && (
              <div className="cdm-dup-row">
                <span className="cdm-dup-label">Phone</span>
                <span className="cdm-dup-value">{match.customerPhone}</span>
              </div>
            )}
            {addrFull && (
              <div className="cdm-dup-row">
                <span className="cdm-dup-label">Address</span>
                <span className="cdm-dup-value">{addrFull}</span>
              </div>
            )}
            <div className="cdm-dup-row cdm-dup-row-stat">
              <span className="cdm-dup-label">Quotes</span>
              <span className="cdm-dup-value">
                {match.quotes.length} quote{match.quotes.length !== 1 ? "s" : ""}
                {(match.passCount > 0 || match.failCount > 0) && (
                  <span className="cdm-dup-stat-pill">
                    {match.passCount > 0 && (
                      <span className="cdm-dup-pass">{match.passCount}P</span>
                    )}
                    {match.failCount > 0 && (
                      <span className="cdm-dup-fail">{match.failCount}F</span>
                    )}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="cdm-dup-actions">
          <button type="button" className="cdm-dup-btn-secondary" onClick={onKeepGoing}>
            Keep Going
          </button>
          <button
            type="button"
            className="cdm-dup-btn-primary"
            onClick={() => onUseRecord(match)}
          >
            Use the Record
          </button>
        </div>
      </div>
    </div>
  );
}
