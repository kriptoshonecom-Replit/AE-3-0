import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useGlobalNav } from "@/context/GlobalNavContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function GlobalNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { open, setOpen } = useGlobalNav();
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/app-version`)
      .then((r) => r.json())
      .then((d: { version?: string }) => { if (d.version) setAppVersion(d.version); })
      .catch(() => {});
  }, []);

  useEffect(() => { setOpen(false); }, [location, setOpen]);

  if (!user) return null;

  function go(path: string) {
    setLocation(path);
    setOpen(false);
  }

  const isAdmin = user.role === "admin";

  return (
    <>
      <div className={`sidebar${open ? " sidebar-open" : ""}`}>
        <div className="sidebar-inner">

          {/* User profile */}
          <div className="sidebar-user">
            <button
              type="button"
              className="sidebar-user-btn"
              onClick={() => go("/profile")}
            >
              <div className="sidebar-user-avatar">
                <span>{(user.fullName?.[0] || user.email?.[0] || "U").toUpperCase()}</span>
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.fullName || "Your Account"}</span>
                <span className="sidebar-user-email">{user.email}</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="sidebar-user-chevron">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Sidebar slot — QuoteBuilder portals QuoteList here */}
          <div id="global-sidebar-slot" className="sidebar-slot" />

          {/* Nav links */}
          {!isAdmin && (
            <div className="sidebar-user-links">
              <button type="button" className="sidebar-admin-link" onClick={() => go("/")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 6.5L8 2l6 4.5V14H10v-4H6v4H2V6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Quote Builder
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/my-quotes")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4.5 5.5h7M4.5 8h7M4.5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                My Quote Library
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/business-market")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M3 13l10-10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <path d="M8 1.5C6.5 3.5 5.5 5 5.5 7s1 3.5 2.5 5.5M8 1.5C9.5 3.5 10.5 5 10.5 7S9.5 10.5 8 12.5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M2.5 7h11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                Business Market
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="sidebar-admin-links">
              <button type="button" className="sidebar-admin-link" onClick={() => go("/")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 6.5L8 2l6 4.5V14H10v-4H6v4H2V6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Quote Builder
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/dashboard")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                Dashboard
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/users")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M13 7v4M11 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Users
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/products")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                Products Configuration
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/pit")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12V4l5-2 5 2v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 14v-4h2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 7h2M10 7h2M4 10h2M10 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                PIT Configuration
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/media")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="5.5" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1.5 11l3.5-3 3 3 2.5-2.5 3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Media Files
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/alerts")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2a5 5 0 0 1 5 5c0 2.5.8 3.5 1.5 4.5H1.5C2.2 10.5 3 9.5 3 7a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6.5 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Alert Configuration
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/status-pass")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 7v5.5M10.5 7v5.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                StatusPass Config
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/quote-library")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4.5 5.5h7M4.5 8h7M4.5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Quote Library
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/log-journal")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="13" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M13 10.5v1l.7.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Log Journals
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/admin/app-release")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L13 8M13 8L8 14M13 8H3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                App Release
              </button>
              <button type="button" className="sidebar-admin-link" onClick={() => go("/business-market")}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 1.5C6.5 3.5 5.5 5 5.5 7s1 3.5 2.5 5.5M8 1.5C9.5 3.5 10.5 5 10.5 7S9.5 10.5 8 12.5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M2.5 7h11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                Business Market
              </button>
            </div>
          )}

          {appVersion && (
            <div className="sidebar-version-footer">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6 4v2.5l1.5 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              QuoteBuilder Version {appVersion}
            </div>
          )}

        </div>
      </div>

      {open && (
        <div className="sidebar-backdrop" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
