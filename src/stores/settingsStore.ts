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

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  apiBaseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  temperature: 0.85,
  maxTokens: 8192,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loading: false,
  initialized: false,

  loadSettings: async () => {
    set({ loading: true });
    try {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string }[]>(
        "SELECT key, value FROM settings WHERE key IN ('api_key', 'api_base_url', 'model', 'temperature', 'max_tokens')"
      );

      const settingsMap: Record<string, string> = {};
      for (const row of rows) {
        settingsMap[row.key] = row.value;
      }

      set({
        settings: {
          apiKey: settingsMap["api_key"] ?? DEFAULT_SETTINGS.apiKey,
          apiBaseUrl: settingsMap["api_base_url"] ?? DEFAULT_SETTINGS.apiBaseUrl,
          model: settingsMap["model"] ?? DEFAULT_SETTINGS.model,
          temperature: settingsMap["temperature"]
            ? parseFloat(settingsMap["temperature"])
            : DEFAULT_SETTINGS.temperature,
          maxTokens: settingsMap["max_tokens"]
            ? parseInt(settingsMap["max_tokens"], 10)
            : DEFAULT_SETTINGS.maxTokens,
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

      const keyMap: Record<string, string | undefined> = {
        apiKey: partial.apiKey !== undefined ? partial.apiKey : undefined,
        apiBaseUrl: partial.apiBaseUrl !== undefined ? partial.apiBaseUrl : undefined,
        model: partial.model !== undefined ? partial.model : undefined,
        temperature:
          partial.temperature !== undefined
            ? String(partial.temperature)
            : undefined,
        maxTokens:
          partial.maxTokens !== undefined
            ? String(partial.maxTokens)
            : undefined,
      };

      const dbKeyMap: Record<string, string> = {
        apiKey: "api_key",
        apiBaseUrl: "api_base_url",
        model: "model",
        temperature: "temperature",
        maxTokens: "max_tokens",
      };

      for (const [field, value] of Object.entries(keyMap)) {
        if (value !== undefined) {
          await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
            [dbKeyMap[field], value]
          );
        }
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
