import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useGlobalNav } from "@/context/GlobalNavContext";
import { useSidebarQuoteContext } from "@/context/SidebarQuoteContext";
import QuoteList from "./QuoteList";
import { setPendingOpenQuote } from "../utils/storage";
import type { Quote } from "../types";
import {
  Home, LayoutDashboard, UserPlus, Package, Building2,
  FileImage, Bell, BadgeCheck, BookOpen, ScrollText,
  Rocket, PenLine, Users, BookMarked, ChevronRight, Clock, Settings,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function GlobalNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { open, setOpen } = useGlobalNav();
  const { activeState, callbacksRef } = useSidebarQuoteContext();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const lastRefreshTrigger = useRef(0);

  useEffect(() => {
    if (activeState?.refreshTrigger != null) {
      lastRefreshTrigger.current = activeState.refreshTrigger;
    }
  }, [activeState?.refreshTrigger]);

  useEffect(() => {
    fetch(`${API_BASE}/api/app-version`)
      .then((r) => r.json())
      .then((d: { version?: string }) => { if (d.version) setAppVersion(d.version); })
      .catch(() => {});
  }, []);

  useEffect(() => { setOpen(false); }, [location, setOpen]);

  const userId = user?.id ?? "";

  const handleSelect = useCallback((q: Quote) => {
    if (callbacksRef.current?.onSelect) {
      callbacksRef.current.onSelect(q);
      setOpen(false);
    } else {
      if (userId) setPendingOpenQuote(q, userId);
      setLocation("/");
    }
  }, [callbacksRef, userId, setOpen, setLocation]);

  const handleNew = useCallback(() => {
    if (callbacksRef.current?.onNew) {
      callbacksRef.current.onNew();
      setOpen(false);
    } else {
      setLocation("/");
    }
  }, [callbacksRef, setOpen, setLocation]);

  const handleDuplicate = useCallback(async (q: Quote) => {
    if (callbacksRef.current?.onDuplicate) {
      await callbacksRef.current.onDuplicate(q);
    }
  }, [callbacksRef]);

  if (!user) return null;

  function go(path: string) {
    setLocation(path);
    setOpen(false);
  }

  const isAdmin = user.role === "admin";
  const refreshTrigger = activeState?.refreshTrigger ?? lastRefreshTrigger.current;
  const currentId = activeState?.currentId ?? "";
  const currentStatus = activeState?.currentStatus;

  function navLink(path: string) {
    return `sidebar-admin-link${location === path ? " active" : ""}`;
  }

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
              <ChevronRight size={13} className="sidebar-user-chevron" />
            </button>
          </div>

          {/* Quote list — always visible on every page */}
          <div className="sidebar-slot">
            <QuoteList
              currentId={currentId}
              currentStatus={currentStatus}
              onSelect={handleSelect}
              onNew={handleNew}
              onDuplicate={activeState ? handleDuplicate : undefined}
              refreshTrigger={refreshTrigger}
              userId={userId}
              userFullName={user.fullName}
              isAdmin={isAdmin}
              apiBase={API_BASE}
            />
          </div>

          {/* Nav links — regular user */}
          {!isAdmin && (
            <div className="sidebar-user-links">
              <button type="button" className={navLink("/")} onClick={() => go("/")}>
                <Home size={16} />
                Quote Builder
              </button>
              <button type="button" className={navLink("/my-quotes")} onClick={() => go("/my-quotes")}>
                <BookMarked size={16} />
                My Quote Library
              </button>
              <button type="button" className={navLink("/amendments")} onClick={() => go("/amendments")}>
                <PenLine size={16} />
                Amendments
              </button>
              <button type="button" className={navLink("/customers")} onClick={() => go("/customers")}>
                <Users size={16} />
                Customers
              </button>
            </div>
          )}

          {/* Nav links — admin */}
          {isAdmin && (
            <div className="sidebar-admin-links">
              <button type="button" className={navLink("/")} onClick={() => go("/")}>
                <Home size={16} />
                Quote Builder
              </button>
              <button type="button" className={navLink("/admin/dashboard")} onClick={() => go("/admin/dashboard")}>
                <LayoutDashboard size={16} />
                Dashboard
              </button>
              <button type="button" className={navLink("/admin/users")} onClick={() => go("/admin/users")}>
                <UserPlus size={16} />
                Users
              </button>
              <button type="button" className={navLink("/admin/products")} onClick={() => go("/admin/products")}>
                <Package size={16} />
                Products Configuration
              </button>
              <button type="button" className={navLink("/admin/pit")} onClick={() => go("/admin/pit")}>
                <Building2 size={16} />
                PIT Configuration
              </button>
              <button type="button" className={navLink("/admin/media")} onClick={() => go("/admin/media")}>
                <FileImage size={16} />
                Media Files
              </button>
              <button type="button" className={navLink("/admin/alerts")} onClick={() => go("/admin/alerts")}>
                <Bell size={16} />
                Alert Configuration
              </button>
              <button type="button" className={navLink("/admin/status-pass")} onClick={() => go("/admin/status-pass")}>
                <BadgeCheck size={16} />
                StatusPass Config
              </button>
              <button type="button" className={navLink("/admin/quote-library")} onClick={() => go("/admin/quote-library")}>
                <BookOpen size={16} />
                Quote Library
              </button>
              <button type="button" className={navLink("/admin/log-journal")} onClick={() => go("/admin/log-journal")}>
                <ScrollText size={16} />
                Log Journals
              </button>
              <button type="button" className={navLink("/admin/app-release")} onClick={() => go("/admin/app-release")}>
                <Rocket size={16} />
                App Release
              </button>
              <button type="button" className={navLink("/admin/app-settings")} onClick={() => go("/admin/app-settings")}>
                <Settings size={16} />
                App Settings
              </button>
              <button type="button" className={navLink("/amendments")} onClick={() => go("/amendments")}>
                <PenLine size={16} />
                Amendments
              </button>
              <button type="button" className={navLink("/customers")} onClick={() => go("/customers")}>
                <Users size={16} />
                Customers
              </button>
            </div>
          )}

          {appVersion && (
            <div className="sidebar-version-footer">
              <Clock size={11} />
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
