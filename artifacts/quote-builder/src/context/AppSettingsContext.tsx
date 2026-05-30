import { createContext, useContext, useEffect, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface AppSettings {
  id: number;
  appName: string;
  mainLogoUrl: string | null;
  smallLogoUrl: string | null;
  accentColor: string;
  disabledGroupIds: string[];
}

const ACCENT_PALETTES: Record<string, { hover: string; subtle: string; border: string }> = {
  "#7c3aed": { hover: "#6d28d9", subtle: "#f3eeff", border: "#ddd0fa" },
  "#D92243": { hover: "#b51a37", subtle: "#fde8ec", border: "#f8c2cc" },
  "#59B292": { hover: "#479f7e", subtle: "#eaf7f2", border: "#c5e8d9" },
  "#1591DC": { hover: "#0e7bbf", subtle: "#e5f4fc", border: "#b8dff5" },
};

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  appName: "Aloha WebCalculator",
  mainLogoUrl: null,
  smallLogoUrl: null,
  accentColor: "#7c3aed",
  disabledGroupIds: [],
};

function applyAccent(color: string) {
  const palette = ACCENT_PALETTES[color] ?? ACCENT_PALETTES["#7c3aed"];
  const root = document.documentElement;
  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-hover", palette.hover);
  root.style.setProperty("--accent-subtle", palette.subtle);
  root.style.setProperty("--accent-border", palette.border);
}

interface AppSettingsContextValue {
  settings: AppSettings;
  refresh: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  refresh: async () => {},
});

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (!res.ok) return;
      const data = await res.json() as AppSettings;
      setSettings(data);
      applyAccent(data.accentColor ?? "#7c3aed");
      if (data.appName) document.title = data.appName;
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppSettingsContext.Provider value={{ settings, refresh: load }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
