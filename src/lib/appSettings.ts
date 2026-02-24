import { invoke } from "@tauri-apps/api/core";
import { withTimeout } from "@/lib/utils";

export type AppSettings = {
  launchOnStartup: boolean;
  hideOnBlur: boolean;
  hotkeyToggleSearch: string;
  hotkeyOpenSettings: string;
  theme: string;
  defaultSystemPrompt: string;
};

export type SettingKey =
  | "launch_on_startup"
  | "hide_on_blur"
  | "hotkey_toggle_search"
  | "hotkey_open_settings"
  | "theme"
  | "default_system_prompt";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  launchOnStartup: false,
  hideOnBlur: true,
  hotkeyToggleSearch: "Alt + Space",
  hotkeyOpenSettings: "Ctrl + ,",
  theme: "system",
  defaultSystemPrompt: "",
};

export const AppSettingsApi = {
  async getAll(): Promise<AppSettings> {
    return withTimeout(
      invoke<AppSettings>("get_app_settings"),
      10_000,
      "get_app_settings",
    );
  },

  async set(key: SettingKey, value: string): Promise<string> {
    return withTimeout(
      invoke<string>("set_app_setting", { key, value }),
      10_000,
      "set_app_setting",
    );
  },
};
