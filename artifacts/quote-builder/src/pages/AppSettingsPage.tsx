import { useState, useRef, useEffect } from "react";
import { Settings, Palette, Type, Upload, Check, RefreshCw, ImageIcon, Eye, Library } from "lucide-react";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { useAppSettings } from "@/context/AppSettingsContext";
import MediaPickerModal, { type MediaFile } from "@/components/MediaPickerModal";
import productsData from "../data/products.json";
import pitData from "../data/pit-services.json";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const ACCENT_COLORS = [
  { value: "#7c3aed", label: "Purple (Default)", textColor: "#ffffff" },
  { value: "#D92243", label: "Dark Red", textColor: "#ffffff" },
  { value: "#59B292", label: "Green", textColor: "#ffffff" },
  { value: "#1591DC", label: "Blue", textColor: "#ffffff" },
  { value: "#F4AE52", label: "Orange", textColor: "#ffffff" },
];

function Section({ icon, title, description, children }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "22px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: "var(--accent-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent)", flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text)" }}>{title}</h3>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: "3px 0 0" }}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SaveMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  const isErr = msg.startsWith("Error");
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, color: isErr ? "var(--danger)" : "var(--success)",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {!isErr && <Check size={12} />}
      {msg}
    </span>
  );
}

export default function AppSettingsPage() {
  const { settings, refresh } = useAppSettings();

  /* ── App Name ─────────────────────────────── */
  const [appName, setAppName] = useState(settings.appName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  /* ── Accent color ────────────────────────── */
  const [accent, setAccent] = useState(settings.accentColor);
  const [accentSaving, setAccentSaving] = useState(false);
  const [accentMsg, setAccentMsg] = useState("");

  /* ── Product group toggles ───────────────── */
  const [disabledGroups, setDisabledGroups] = useState<Set<string>>(new Set(settings.disabledGroupIds));
  const [groupsSaving, setGroupsSaving] = useState(false);
  const [groupsMsg, setGroupsMsg] = useState("");

  /* ── Logo upload ─────────────────────────── */
  const [logoMsg, setLogoMsg] = useState<Record<string, string>>({ main: "", small: "" });
  const [logoUploading, setLogoUploading] = useState<Record<string, boolean>>({ main: false, small: false });
  const mainLogoRef = useRef<HTMLInputElement>(null);
  const smallLogoRef = useRef<HTMLInputElement>(null);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"main" | "small" | null>(null);

  /* Sync when settings load */
  useEffect(() => {
    setAppName(settings.appName);
    setAccent(settings.accentColor);
    setDisabledGroups(new Set(settings.disabledGroupIds));
  }, [settings]);

  /* ── Handlers ─────────────────────────────── */

  async function saveAppName() {
    setNameSaving(true); setNameMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refresh();
      setNameMsg("Saved!");
    } catch {
      setNameMsg("Error saving");
    } finally {
      setNameSaving(false);
      setTimeout(() => setNameMsg(""), 3000);
    }
  }

  async function saveAccent(color: string) {
    setAccent(color); setAccentSaving(true); setAccentMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentColor: color }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refresh();
      setAccentMsg("Saved!");
    } catch {
      setAccentMsg("Error saving");
    } finally {
      setAccentSaving(false);
      setTimeout(() => setAccentMsg(""), 3000);
    }
  }

  async function saveGroups(next: Set<string>) {
    setGroupsSaving(true); setGroupsMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledGroupIds: Array.from(next) }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refresh();
      setGroupsMsg("Saved!");
    } catch {
      setGroupsMsg("Error saving");
    } finally {
      setGroupsSaving(false);
      setTimeout(() => setGroupsMsg(""), 3000);
    }
  }

  function toggleGroup(id: string) {
    const next = new Set(disabledGroups);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDisabledGroups(next);
    void saveGroups(next);
  }

  async function selectLogoFromLibrary(type: "main" | "small", file: MediaFile) {
    setLogoUploading((p) => ({ ...p, [type]: true }));
    setLogoMsg((p) => ({ ...p, [type]: "" }));
    try {
      const field = type === "main" ? "mainLogoUrl" : "smallLogoUrl";
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: file.path }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refresh();
      setLogoMsg((p) => ({ ...p, [type]: "Saved!" }));
    } catch {
      setLogoMsg((p) => ({ ...p, [type]: "Error saving" }));
    } finally {
      setLogoUploading((p) => ({ ...p, [type]: false }));
      setTimeout(() => setLogoMsg((p) => ({ ...p, [type]: "" })), 3000);
    }
  }

  async function uploadLogo(type: "main" | "small", file: File) {
    setLogoUploading((p) => ({ ...p, [type]: true }));
    setLogoMsg((p) => ({ ...p, [type]: "" }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/settings/upload-logo?type=${type}`, {
        method: "POST", credentials: "include", body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      await refresh();
      setLogoMsg((p) => ({ ...p, [type]: "Uploaded!" }));
    } catch {
      setLogoMsg((p) => ({ ...p, [type]: "Error uploading" }));
    } finally {
      setLogoUploading((p) => ({ ...p, [type]: false }));
      setTimeout(() => setLogoMsg((p) => ({ ...p, [type]: "" })), 3000);
    }
  }

  const allCategories = productsData.categories as { id: string; name: string; items: unknown[] }[];
  const allPitCategories = pitData.categories as { id: string; name: string; lineItems: unknown[] }[];

  return (
    <>
    <div className="admin-page">
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">App Settings</h1>
      </div>

      <div className="admin-body app-settings-body">

        {/* App Name */}
        <Section icon={<Type size={17} />} title="App Name" description="Changes the name shown in the navbar, PDF exports, and emails.">
          <div className="app-settings-name-row">
            <label className="lib-label" style={{ flex: 1, margin: 0 }}>
              Application name
              <input
                className="lib-input"
                style={{ marginTop: 6 }}
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Aloha WebCalculator"
                maxLength={80}
              />
            </label>
            <button
              className="edit-modal-save app-settings-save-btn"
              style={{ flexShrink: 0, height: 38, display: "flex", alignItems: "center", gap: 6 }}
              onClick={saveAppName}
              disabled={nameSaving || !appName.trim()}
            >
              {nameSaving ? (
                <RefreshCw size={13} className="spin" />
              ) : (
                <>
                  Save
                  {appName.trim() !== settings.appName && (
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "var(--accent)", display: "inline-block", flexShrink: 0,
                    }} />
                  )}
                </>
              )}
            </button>
          </div>
          {nameMsg && <div style={{ marginTop: 8 }}><SaveMsg msg={nameMsg} /></div>}
        </Section>

        {/* Logo */}
        <Section
          icon={<ImageIcon size={17} />}
          title="Brand Logos"
          description="Main logo used in headers, PDF exports, and emails. Small logo used as favicon (1:1, max 50×50 px)."
        >
          <div className="app-settings-logos-grid">
            {/* Main logo */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)", marginBottom: 10 }}>
                Main Logo — 16:9 · max 200px wide
              </div>
              <div style={{
                border: "2px dashed var(--border)", borderRadius: 8,
                height: 110, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                background: "var(--surface-subtle)", position: "relative", overflow: "hidden",
              }}>
                {settings.mainLogoUrl ? (
                  <img
                    src={`${API_BASE}${settings.mainLogoUrl}?t=${Date.now()}`}
                    alt="Main logo"
                    style={{ maxWidth: "90%", maxHeight: 90, objectFit: "contain" }}
                  />
                ) : (
                  <>
                    <ImageIcon size={28} color="var(--text-3)" />
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>No logo set</span>
                  </>
                )}
              </div>
              <input
                ref={mainLogoRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo("main", f); e.target.value = ""; }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  className="edit-modal-cancel"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onClick={() => setMediaPickerTarget("main")}
                  disabled={logoUploading.main}
                >
                  <Library size={13} /> Library
                </button>
                <button
                  className="edit-modal-cancel"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onClick={() => mainLogoRef.current?.click()}
                  disabled={logoUploading.main}
                >
                  {logoUploading.main ? <RefreshCw size={13} className="spin" /> : <Upload size={13} />}
                  {logoUploading.main ? "Uploading…" : "Upload new"}
                </button>
              </div>
              {logoMsg.main && <div style={{ marginTop: 6 }}><SaveMsg msg={logoMsg.main} /></div>}
            </div>

            {/* Small / favicon logo */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)", marginBottom: 10 }}>
                Small Logo — 1:1 · max 50×50 px (favicon)
              </div>
              <div style={{
                border: "2px dashed var(--border)", borderRadius: 8,
                height: 110, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                background: "var(--surface-subtle)",
              }}>
                {settings.smallLogoUrl ? (
                  <img
                    src={`${API_BASE}${settings.smallLogoUrl}?t=${Date.now()}`}
                    alt="Small logo"
                    style={{ maxWidth: 50, maxHeight: 50, objectFit: "contain" }}
                  />
                ) : (
                  <>
                    <ImageIcon size={28} color="var(--text-3)" />
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>No logo set</span>
                  </>
                )}
              </div>
              <input
                ref={smallLogoRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo("small", f); e.target.value = ""; }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  className="edit-modal-cancel"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onClick={() => setMediaPickerTarget("small")}
                  disabled={logoUploading.small}
                >
                  <Library size={13} /> Library
                </button>
                <button
                  className="edit-modal-cancel"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onClick={() => smallLogoRef.current?.click()}
                  disabled={logoUploading.small}
                >
                  {logoUploading.small ? <RefreshCw size={13} className="spin" /> : <Upload size={13} />}
                  {logoUploading.small ? "Uploading…" : "Upload new"}
                </button>
              </div>
              {logoMsg.small && <div style={{ marginTop: 6 }}><SaveMsg msg={logoMsg.small} /></div>}
            </div>
          </div>
        </Section>

        {/* Accent Color */}
        <Section icon={<Palette size={17} />} title="Accent Color" description="Applies to buttons, links, borders, and headings across the entire app.">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => void saveAccent(c.value)}
                disabled={accentSaving}
                title={c.label}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 18px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${accent === c.value ? c.value : "var(--border)"}`,
                  background: accent === c.value ? c.value + "18" : "var(--surface)",
                  fontWeight: accent === c.value ? 700 : 400,
                  fontSize: 13, color: "var(--text)", transition: "all 0.15s",
                  boxShadow: accent === c.value ? `0 0 0 3px ${c.value}33` : "none",
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", background: c.value,
                  display: "inline-block", flexShrink: 0,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                }} />
                {c.label}
                {accent === c.value && <Check size={13} style={{ color: c.value }} />}
              </button>
            ))}
          </div>
          {accentMsg && <div style={{ marginTop: 10 }}><SaveMsg msg={accentMsg} /></div>}
        </Section>

        {/* Product Group Toggles */}
        <Section
          icon={<Eye size={17} />}
          title="Product Group Visibility"
          description="Disabled groups are hidden from the Add Group popup in the Quote Builder. Already-added groups are unaffected."
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>
              {disabledGroups.size === 0 ? "All groups are visible." : `${disabledGroups.size} group${disabledGroups.size !== 1 ? "s" : ""} hidden.`}
            </span>
            {groupsMsg && <SaveMsg msg={groupsMsg} />}
          </div>
          {/* Product Groups */}
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)", marginBottom: 8 }}>
            Quote Builder Groups
          </div>
          <div className="app-settings-groups-grid" style={{ marginBottom: 18 }}>
            {allCategories.map((cat) => {
              const enabled = !disabledGroups.has(cat.id);
              return (
                <div
                  key={cat.id}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: 10, padding: "10px 14px", borderRadius: 7,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    transition: "all 0.12s",
                  }}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleGroup(cat.id)}
                    disabled={groupsSaving}
                    className={`pit-toggle-switch ${enabled ? "pit-toggle-on" : "pit-toggle-off"}`}
                  >
                    <span className="pit-toggle-thumb" />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? "var(--accent)" : "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {(cat.items as unknown[]).length} product{(cat.items as unknown[]).length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span className={`pit-toggle-state ${enabled ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
                    {enabled ? "On" : "Off"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* PIT Configuration Groups */}
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)", marginBottom: 8, marginTop: 6 }}>
            PIT Configuration
          </div>
          <div className="app-settings-groups-grid">
            {allPitCategories.map((cat) => {
              const key = `pit-${cat.id}`;
              const enabled = !disabledGroups.has(key);
              return (
                <div
                  key={key}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: 10, padding: "10px 14px", borderRadius: 7,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    transition: "all 0.12s",
                  }}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleGroup(key)}
                    disabled={groupsSaving}
                    className={`pit-toggle-switch ${enabled ? "pit-toggle-on" : "pit-toggle-off"}`}
                  >
                    <span className="pit-toggle-thumb" />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? "var(--accent)" : "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {(cat.lineItems as unknown[]).length} line item{(cat.lineItems as unknown[]).length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span className={`pit-toggle-state ${enabled ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
                    {enabled ? "On" : "Off"}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

      </div>
    </div>

    {mediaPickerTarget && (
      <MediaPickerModal
        onSelect={(file) => { void selectLogoFromLibrary(mediaPickerTarget, file); }}
        onClose={() => setMediaPickerTarget(null)}
      />
    )}
    </>
  );
}
