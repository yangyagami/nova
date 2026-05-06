import { create } from "zustand";
import type { AppSettings } from "@/types";
import { getDb } from "@/lib/db";

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  initialized: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  getApiKey: () => Promise<string>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    apiKey: "",
    model: "deepseek-chat",
    temperature: 0.85,
  },
  loading: false,
  initialized: false,

  loadSettings: async () => {
    set({ loading: true });
    try {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string }[]>(
        "SELECT key, value FROM settings WHERE key IN ('api_key', 'model', 'temperature')"
      );

      const settingsMap: Record<string, string> = {};
      for (const row of rows) {
        settingsMap[row.key] = row.value;
      }

      set({
        settings: {
          apiKey: settingsMap["api_key"] || "",
          model: (settingsMap["model"] as AppSettings["model"]) || "deepseek-chat",
          temperature: settingsMap["temperature"]
            ? parseFloat(settingsMap["temperature"])
            : 0.85,
        },
        loading: false,
        initialized: true,
      });
    } catch (e) {
      console.error("Failed to load settings:", e);
      set({ loading: false, initialized: true });
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const { settings } = get();
    const newSettings = { ...settings, ...partial };
    set({ settings: newSettings });

    try {
      const db = await getDb();

      if (partial.apiKey !== undefined) {
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["api_key", partial.apiKey]
        );
      }
      if (partial.model !== undefined) {
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["model", partial.model]
        );
      }
      if (partial.temperature !== undefined) {
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["temperature", String(partial.temperature)]
        );
      }
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  },

  getApiKey: async () => {
    const { settings, loadSettings } = get();
    if (!settings.apiKey) {
      await loadSettings();
    }
    return get().settings.apiKey;
  },
}));
