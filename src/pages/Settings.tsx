import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProviderCard } from "@/components/ProviderCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProviders } from "@/hooks/useProviders";
import {
  type AppSettings,
  AppSettingsApi,
  DEFAULT_APP_SETTINGS,
  type SettingKey,
} from "@/lib/appSettings";
import type { ProviderType } from "@/types/provider";
import { PROVIDER_TYPE_INFO } from "@/types/provider";

type RecordingTarget = "toggle" | "open-settings" | null;
type SettingsToast = {
  id: number;
  message: string;
  detail?: string;
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("llm-models");
  const [isNewProviderOpen, setIsNewProviderOpen] = useState(false);
  const [newProviderType, setNewProviderType] =
    useState<ProviderType>("openai");
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState("");
  const [newProviderApiKey, setNewProviderApiKey] = useState("");
  const [newProviderShowApiKey, setNewProviderShowApiKey] = useState(false);
  const [newProviderModel, setNewProviderModel] = useState("");
  const [isCreatingProvider, setIsCreatingProvider] = useState(false);
  const [appSettings, setAppSettings] =
    useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [toggleHotkeyDraft, setToggleHotkeyDraft] = useState(
    DEFAULT_APP_SETTINGS.hotkeyToggleSearch,
  );
  const [openSettingsHotkeyDraft, setOpenSettingsHotkeyDraft] = useState(
    DEFAULT_APP_SETTINGS.hotkeyOpenSettings,
  );
  const [defaultSystemPromptDraft, setDefaultSystemPromptDraft] = useState(
    DEFAULT_APP_SETTINGS.defaultSystemPrompt,
  );
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget>(null);
  const [hotkeyRecordHint, setHotkeyRecordHint] = useState<string | null>(null);
  const [isLoadingAppSettings, setIsLoadingAppSettings] = useState(true);
  const [toast, setToast] = useState<SettingsToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    providers,
    isLoading: isLoadingProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    setActiveProvider,
    setApiKey,
    getApiKey,
    testConnection,
  } = useProviders();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const appWindow = getCurrentWindow();
      await appWindow.show();
      try {
        const settings = await AppSettingsApi.getAll();
        if (!cancelled) {
          setAppSettings(settings);
          setToggleHotkeyDraft(settings.hotkeyToggleSearch);
          setOpenSettingsHotkeyDraft(settings.hotkeyOpenSettings);
          setDefaultSystemPromptDraft(settings.defaultSystemPrompt);
        }
      } catch (error) {
        console.error("Failed to load app settings:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingAppSettings(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  const pushToast = (message: string, detail?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, detail });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  };

  const mapSettingErrorToToast = (key: SettingKey, error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error);
    const isHotkey =
      key === "hotkey_toggle_search" || key === "hotkey_open_settings";

    if (isHotkey) {
      if (
        /already registered|already in use|hotkey already|accelerator/i.test(
          raw,
        )
      ) {
        return {
          message:
            "That hotkey is already registered or claimed by the system. Please pick a different shortcut.",
        };
      }
      if (/invalid|unsupported|empty token|parse|format/i.test(raw)) {
        return {
          message: "Hotkey format is invalid.",
          detail: "Include at least one modifier (Ctrl, Alt, Shift, or Cmd).",
        };
      }
      return {
        message: "Failed to save the hotkey. Try again.",
        detail: raw,
      };
    }

    return {
      message: "Failed to save the setting. Please try again.",
      detail: raw,
    };
  };
  const setSettingWithRollback = (
    key: SettingKey,
    value: string,
    rollback: () => void,
    onNormalized?: (normalized: string) => void,
  ) => {
    void AppSettingsApi.set(key, value)
      .then((normalized) => {
        onNormalized?.(normalized);
      })
      .catch((error) => {
        console.error(`Failed to persist setting '${key}':`, error);
        rollback();
        const toastContent = mapSettingErrorToToast(key, error);
        pushToast(toastContent.message, toastContent.detail);
      });
  };

  const toBool = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  };

  const handleLaunchOnStartupChange = (checked: boolean) => {
    const previous = appSettings.launchOnStartup;
    setAppSettings((prev) => ({ ...prev, launchOnStartup: checked }));
    setSettingWithRollback(
      "launch_on_startup",
      checked ? "1" : "0",
      () => setAppSettings((prev) => ({ ...prev, launchOnStartup: previous })),
      (normalized) =>
        setAppSettings((prev) => ({
          ...prev,
          launchOnStartup: toBool(normalized),
        })),
    );
  };

  const handleHideOnBlurChange = (checked: boolean) => {
    const previous = appSettings.hideOnBlur;
    setAppSettings((prev) => ({ ...prev, hideOnBlur: checked }));
    setSettingWithRollback("hide_on_blur", checked ? "1" : "0", () =>
      setAppSettings((prev) => ({ ...prev, hideOnBlur: previous })),
    );
  };

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    const previous = appSettings.theme;
    setAppSettings((prev) => ({ ...prev, theme }));
    setSettingWithRollback("theme", theme, () =>
      setAppSettings((prev) => ({ ...prev, theme: previous })),
    );
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: setSettingWithRollback is functionally stable
  const saveToggleHotkey = useCallback(
    (candidate?: string) => {
      const next = (candidate ?? toggleHotkeyDraft).trim();
      const previous = appSettings.hotkeyToggleSearch;
      if (!next || next === previous) {
        setToggleHotkeyDraft(previous);
        return;
      }
      setAppSettings((prev) => ({ ...prev, hotkeyToggleSearch: next }));
      setSettingWithRollback(
        "hotkey_toggle_search",
        next,
        () => {
          setAppSettings((prev) => ({ ...prev, hotkeyToggleSearch: previous }));
          setToggleHotkeyDraft(previous);
        },
        (normalized) => {
          setAppSettings((prev) => ({
            ...prev,
            hotkeyToggleSearch: normalized,
          }));
          setToggleHotkeyDraft(normalized);
        },
      );
    },
    [toggleHotkeyDraft, appSettings.hotkeyToggleSearch],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: setSettingWithRollback is functionally stable
  const saveOpenSettingsHotkey = useCallback(
    (candidate?: string) => {
      const next = (candidate ?? openSettingsHotkeyDraft).trim();
      const previous = appSettings.hotkeyOpenSettings;
      if (!next || next === previous) {
        setOpenSettingsHotkeyDraft(previous);
        return;
      }
      setAppSettings((prev) => ({ ...prev, hotkeyOpenSettings: next }));
      setSettingWithRollback(
        "hotkey_open_settings",
        next,
        () => {
          setAppSettings((prev) => ({ ...prev, hotkeyOpenSettings: previous }));
          setOpenSettingsHotkeyDraft(previous);
        },
        (normalized) => {
          setAppSettings((prev) => ({
            ...prev,
            hotkeyOpenSettings: normalized,
          }));
          setOpenSettingsHotkeyDraft(normalized);
        },
      );
    },
    [openSettingsHotkeyDraft, appSettings.hotkeyOpenSettings],
  );

  const saveDefaultSystemPrompt = () => {
    const next = defaultSystemPromptDraft.trim();
    const previous = appSettings.defaultSystemPrompt;
    if (next === previous) return;
    setAppSettings((prev) => ({ ...prev, defaultSystemPrompt: next }));
    setSettingWithRollback(
      "default_system_prompt",
      next,
      () => {
        setAppSettings((prev) => ({ ...prev, defaultSystemPrompt: previous }));
        setDefaultSystemPromptDraft(previous);
      },
      (normalized) => {
        setAppSettings((prev) => ({
          ...prev,
          defaultSystemPrompt: normalized,
        }));
        setDefaultSystemPromptDraft(normalized);
      },
    );
  };

  const getThemeCardClass = (theme: "light" | "dark" | "system") =>
    `flex flex-col items-center gap-2 p-4 border-2 rounded-lg bg-white ${
      appSettings.theme === theme
        ? "border-black"
        : "border-transparent hover:border-gray-200"
    }`;

  const formatRecordedKey = useCallback((event: KeyboardEvent) => {
    const key = event.key;
    const code = event.code;

    if (
      key === "Control" ||
      key === "Shift" ||
      key === "Alt" ||
      key === "Meta"
    ) {
      return null;
    }

    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return key.toUpperCase();
    if (key === " ") return "Space";
    if (key === "Escape") return "Esc";
    if (key === "ArrowUp") return "Up";
    if (key === "ArrowDown") return "Down";
    if (key === "ArrowLeft") return "Left";
    if (key === "ArrowRight") return "Right";
    if (key === "PageUp") return "PageUp";
    if (key === "PageDown") return "PageDown";
    if (key === "Backspace") return "Backspace";
    if (key === "Delete") return "Delete";
    if (key === "Enter") return "Enter";
    if (key === "Tab") return "Tab";
    if (key === "Home") return "Home";
    if (key === "End") return "End";

    if (key === ",") return ",";
    if (key === ".") return ".";
    if (key === ";") return ";";
    if (key === "'") return "'";
    if (key === "/") return "/";
    if (key === "\\") return "\\";
    if (key === "[") return "[";
    if (key === "]") return "]";
    if (key === "`") return "`";
    if (key === "-") return "-";
    if (key === "=") return "=";

    if (code.startsWith("Key") && code.length === 4) {
      return code.slice(3).toUpperCase();
    }
    if (code.startsWith("Digit") && code.length === 6) {
      return code.slice(5);
    }
    if (/^[a-zA-Z0-9]$/.test(key)) return key.toUpperCase();

    return null;
  }, []);

  useEffect(() => {
    if (!recordingTarget) return;
    let completed = false;
    let altPressed = false;
    let ctrlPressed = false;
    let shiftPressed = false;
    let metaPressed = false;

    const commitCombo = (combo: string) => {
      if (completed) return;
      completed = true;
      if (recordingTarget === "toggle") {
        setToggleHotkeyDraft(combo);
        saveToggleHotkey(combo);
      } else {
        setOpenSettingsHotkeyDraft(combo);
        saveOpenSettingsHotkey(combo);
      }
      setHotkeyRecordHint(null);
      setRecordingTarget(null);
    };

    const onKeyEvent = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.type === "keydown" && event.repeat) return;

      if (event.key === "Alt") altPressed = event.type === "keydown";
      if (event.key === "Control") ctrlPressed = event.type === "keydown";
      if (event.key === "Shift") shiftPressed = event.type === "keydown";
      if (event.key === "Meta") metaPressed = event.type === "keydown";

      if (event.key === "Escape") {
        completed = true;
        setRecordingTarget(null);
        setHotkeyRecordHint(null);
        return;
      }

      if (event.key === " " && (event.altKey || altPressed)) {
        commitCombo("Alt + Space");
        void getCurrentWindow()
          .setFocus()
          .catch(() => {});
        return;
      }

      const mainKey = formatRecordedKey(event);
      if (!mainKey) return;

      const parts: string[] = [];
      if (event.ctrlKey || ctrlPressed) parts.push("Ctrl");
      if (event.altKey || altPressed) parts.push("Alt");
      if (event.shiftKey || shiftPressed) parts.push("Shift");
      if (event.metaKey || metaPressed) parts.push("Cmd");
      parts.push(mainKey);

      if (parts.length < 2) {
        setHotkeyRecordHint("Shortcut must include at least one modifier key.");
        return;
      }

      commitCombo(parts.join(" + "));
    };

    window.addEventListener("keydown", onKeyEvent, true);
    window.addEventListener("keyup", onKeyEvent, true);
    return () => {
      window.removeEventListener("keydown", onKeyEvent, true);
      window.removeEventListener("keyup", onKeyEvent, true);
    };
  }, [
    recordingTarget,
    saveToggleHotkey,
    saveOpenSettingsHotkey,
    formatRecordedKey,
  ]);

  const handleCreateProvider = async () => {
    setIsCreatingProvider(true);
    try {
      await createProvider({
        name:
          newProviderName.trim() || PROVIDER_TYPE_INFO[newProviderType].label,
        provider_type: newProviderType,
        base_url: newProviderBaseUrl.trim() || undefined,
        model: newProviderModel.trim() || undefined,
        api_key: newProviderApiKey.trim() || undefined,
      });
      // Reset form
      setIsNewProviderOpen(false);
      setNewProviderType("openai");
      setNewProviderName("");
      setNewProviderBaseUrl("");
      setNewProviderApiKey("");
      setNewProviderShowApiKey(false);
      setNewProviderModel("");
    } catch (error) {
      console.error("Failed to create provider:", error);
    } finally {
      setIsCreatingProvider(false);
    }
  };

  const handleNewProviderTypeChange = (type: ProviderType) => {
    setNewProviderType(type);
    setNewProviderName(PROVIDER_TYPE_INFO[type].label);
    setNewProviderBaseUrl(PROVIDER_TYPE_INFO[type].defaultBaseUrl ?? "");
    setNewProviderModel(PROVIDER_TYPE_INFO[type].defaultModel);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="max-w-[800px] mx-auto py-12 px-10">
            <header className="mb-12">
              <div className="flex items-center gap-2 text-text-secondary text-xs mb-3">
                <span>Settings</span>
                <span className="material-symbols-outlined text-[14px]">
                  chevron_right
                </span>
                <span className="text-black font-medium">General</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">
                General
              </h1>
              <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
                Configure basic application behavior and startup settings.
              </p>
            </header>
            <div className="space-y-8">
              <div className="border border-border-gray rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Launch on Startup</h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Automatically start the application when you log in.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={appSettings.launchOnStartup}
                        disabled={isLoadingAppSettings}
                        onChange={(e) =>
                          handleLaunchOnStartupChange(e.target.checked)
                        }
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>
                  <div className="h-px bg-border-gray w-full"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Hide on Blur</h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Hide the search window when it loses focus.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={appSettings.hideOnBlur}
                        disabled={isLoadingAppSettings}
                        onChange={(e) =>
                          handleHideOnBlurChange(e.target.checked)
                        }
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>
                  <div className="h-px bg-border-gray w-full"></div>
                  <div>
                    <h3 className="text-sm font-bold">Default System Prompt</h3>
                    <p className="text-xs text-text-secondary mt-1 mb-3">
                      Used as fallback when current session has no custom system
                      prompt.
                    </p>
                    <textarea
                      rows={4}
                      value={defaultSystemPromptDraft}
                      disabled={isLoadingAppSettings}
                      onChange={(e) =>
                        setDefaultSystemPromptDraft(e.target.value)
                      }
                      className="w-full text-[12px] px-3 py-2 rounded-md border border-border-gray bg-white outline-none focus:border-black/40 resize-y transition-colors"
                      placeholder="e.g. You are a concise technical expert. Reply in the same language as the user."
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={saveDefaultSystemPrompt}
                        className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-colors"
                      >
                        Save Prompt
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "hotkeys":
        return (
          <div className="max-w-[800px] mx-auto py-12 px-10">
            <header className="mb-12">
              <div className="flex items-center gap-2 text-text-secondary text-xs mb-3">
                <span>Settings</span>
                <span className="material-symbols-outlined text-[14px]">
                  chevron_right
                </span>
                <span className="text-black font-medium">Hotkeys</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">
                Hotkeys
              </h1>
              <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
                Customize keyboard shortcuts to improve your workflow.
              </p>
            </header>
            <div className="space-y-8">
              <div className="border border-border-gray rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">
                        Toggle Search Window
                      </h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Global shortcut to show or hide the main search
                        interface.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={toggleHotkeyDraft}
                        readOnly
                        className="w-[160px] px-3 py-1.5 bg-gray-100 border border-border-gray rounded-md text-xs font-mono font-medium text-gray-700 focus:outline-none focus:border-black/40"
                        placeholder="Alt + Space"
                      />
                      <button
                        type="button"
                        disabled={isLoadingAppSettings}
                        onClick={() => {
                          setHotkeyRecordHint(null);
                          setRecordingTarget((prev) =>
                            prev === "toggle" ? null : "toggle",
                          );
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          recordingTarget === "toggle"
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-black text-white hover:bg-neutral-800"
                        }`}
                      >
                        {recordingTarget === "toggle" ? "Cancel" : "Record"}
                      </button>
                    </div>
                  </div>
                  <div className="h-px bg-border-gray w-full"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Open Settings</h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Shortcut to open this settings window.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={openSettingsHotkeyDraft}
                        readOnly
                        className="w-[160px] px-3 py-1.5 bg-gray-100 border border-border-gray rounded-md text-xs font-mono font-medium text-gray-700 focus:outline-none focus:border-black/40"
                        placeholder="Ctrl + ,"
                      />
                      <button
                        type="button"
                        disabled={isLoadingAppSettings}
                        onClick={() => {
                          setHotkeyRecordHint(null);
                          setRecordingTarget((prev) =>
                            prev === "open-settings" ? null : "open-settings",
                          );
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          recordingTarget === "open-settings"
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-black text-white hover:bg-neutral-800"
                        }`}
                      >
                        {recordingTarget === "open-settings"
                          ? "Cancel"
                          : "Record"}
                      </button>
                    </div>
                  </div>
                  <div className="h-px bg-border-gray w-full"></div>
                  <div className="text-xs text-text-secondary">
                    {recordingTarget
                      ? "Recording... press your shortcut now, or Esc to cancel."
                      : "Click Record and press the full shortcut combination."}
                    {recordingTarget === "toggle" && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setToggleHotkeyDraft("Alt + Space");
                            saveToggleHotkey("Alt + Space");
                            setRecordingTarget(null);
                            setHotkeyRecordHint(null);
                          }}
                          className="px-2.5 py-1 rounded-md border border-border-gray bg-white text-[11px] font-medium text-text-secondary hover:border-black/30 hover:text-black transition-colors"
                        >
                          Set Alt + Space
                        </button>
                      </div>
                    )}
                    {hotkeyRecordHint && (
                      <span className="block mt-1 text-red-600">
                        {hotkeyRecordHint}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="max-w-[800px] mx-auto py-12 px-10">
            <header className="mb-12">
              <div className="flex items-center gap-2 text-text-secondary text-xs mb-3">
                <span>Settings</span>
                <span className="material-symbols-outlined text-[14px]">
                  chevron_right
                </span>
                <span className="text-black font-medium">Appearance</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">
                Appearance
              </h1>
              <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
                Customize how the application looks and feels.
              </p>
            </header>
            <div className="space-y-8">
              <div className="border border-border-gray rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold mb-4">Theme</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        type="button"
                        className={getThemeCardClass("light")}
                        onClick={() => handleThemeChange("light")}
                      >
                        <div className="w-full h-20 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400">
                            light_mode
                          </span>
                        </div>
                        <span className="text-xs font-medium">Light</span>
                      </button>
                      <button
                        type="button"
                        className={getThemeCardClass("dark")}
                        onClick={() => handleThemeChange("dark")}
                      >
                        <div className="w-full h-20 bg-gray-900 rounded-md border border-gray-800 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400">
                            dark_mode
                          </span>
                        </div>
                        <span className="text-xs font-medium">Dark</span>
                      </button>
                      <button
                        type="button"
                        className={getThemeCardClass("system")}
                        onClick={() => handleThemeChange("system")}
                      >
                        <div className="w-full h-20 bg-gradient-to-br from-gray-100 to-gray-900 rounded-md border border-gray-300 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400">
                            brightness_auto
                          </span>
                        </div>
                        <span className="text-xs font-medium">System</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "about":
        return (
          <div className="max-w-[800px] mx-auto py-12 px-10">
            <header className="mb-12">
              <div className="flex items-center gap-2 text-text-secondary text-xs mb-3">
                <span>Settings</span>
                <span className="material-symbols-outlined text-[14px]">
                  chevron_right
                </span>
                <span className="text-black font-medium">About</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">About</h1>
              <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
                Information about the application and its creators.
              </p>
            </header>
            <div className="space-y-8">
              <div className="border border-border-gray rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="p-8 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <span className="material-symbols-outlined text-white text-4xl">
                      search
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">AI Quick Search</h2>
                  <p className="text-sm text-text-secondary mt-1 mb-6">
                    Version 1.0.0
                  </p>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-md transition-colors"
                    >
                      Check for Updates
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 border border-border-gray hover:bg-gray-50 text-sm font-medium rounded-md transition-colors"
                    >
                      View on GitHub
                    </button>
                  </div>
                </div>
                <div className="border-t border-border-gray p-6 bg-gray-50">
                  <div className="text-xs text-text-secondary text-center space-y-2">
                    <p>Built with Tauri, React, and Tailwind CSS.</p>
                    <p>
                      &copy; {new Date().getFullYear()} AI Quick Search. All
                      rights reserved.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="max-w-[800px] mx-auto py-12 px-10">
            <header className="mb-12 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-text-secondary text-xs mb-3">
                  <span>Settings</span>
                  <span className="material-symbols-outlined text-[14px]">
                    chevron_right
                  </span>
                  <span className="text-black font-medium">LLM Models</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">
                  LLM Models
                </h1>
                <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
                  Connect your AI provider API keys to enable multi-model chat.
                  Your keys are encrypted and stored locally on your machine.
                </p>
              </div>
              <Dialog
                open={isNewProviderOpen}
                onOpenChange={(open) => {
                  setIsNewProviderOpen(open);
                  if (open) {
                    // Reset form when opening
                    setNewProviderType("openai");
                    setNewProviderName(PROVIDER_TYPE_INFO.openai.label);
                    setNewProviderBaseUrl(
                      PROVIDER_TYPE_INFO.openai.defaultBaseUrl ?? "",
                    );
                    setNewProviderModel(PROVIDER_TYPE_INFO.openai.defaultModel);
                    setNewProviderApiKey("");
                    setNewProviderShowApiKey(false);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 h-9 bg-black text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-colors shadow-sm shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>
                    New Provider
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Provider</DialogTitle>
                    <DialogDescription>
                      Configure an AI provider to use for queries.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label
                        htmlFor="provider-type"
                        className="text-xs font-medium"
                      >
                        Provider Type
                      </label>
                      <select
                        id="provider-type"
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
                        value={newProviderType}
                        onChange={(e) =>
                          handleNewProviderTypeChange(
                            e.target.value as ProviderType,
                          )
                        }
                      >
                        <option value="openai">OpenAI</option>
                        <option value="glm">GLM (BigModel)</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Google Gemini</option>
                        <option value="volcengine">Volcengine ARK</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label
                        htmlFor="provider-name"
                        className="text-xs font-medium"
                      >
                        Provider Name
                      </label>
                      <input
                        id="provider-name"
                        placeholder="e.g. OpenAI, Claude, Gemini"
                        value={newProviderName}
                        onChange={(e) => setNewProviderName(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="base-url" className="text-xs font-medium">
                        Base URL
                      </label>
                      <input
                        id="base-url"
                        placeholder="https://api.example.com/v1"
                        value={newProviderBaseUrl}
                        onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label
                        htmlFor="model-name"
                        className="text-xs font-medium"
                      >
                        Default Model
                      </label>
                      <input
                        id="model-name"
                        placeholder="e.g. gpt-4o-mini"
                        value={newProviderModel}
                        onChange={(e) => setNewProviderModel(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="api-key" className="text-xs font-medium">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          id="api-key"
                          type={newProviderShowApiKey ? "text" : "password"}
                          placeholder="sk-..."
                          value={newProviderApiKey}
                          onChange={(e) => setNewProviderApiKey(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 pr-10 text-sm shadow-sm transition-colors placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-black transition-colors"
                          onClick={() =>
                            setNewProviderShowApiKey((prev) => !prev)
                          }
                          title={
                            newProviderShowApiKey
                              ? "Hide API Key"
                              : "Show API Key"
                          }
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {newProviderShowApiKey
                              ? "visibility_off"
                              : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <button
                      type="button"
                      onClick={() => setIsNewProviderOpen(false)}
                      className="px-4 h-9 border border-border-gray text-xs font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateProvider}
                      disabled={isCreatingProvider}
                      className="px-4 h-9 bg-black text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isCreatingProvider ? "Creating..." : "Create Provider"}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </header>
            <div className="space-y-8">
              {isLoadingProviders ? (
                <div className="text-center py-12 text-text-secondary">
                  Loading providers...
                </div>
              ) : providers.length === 0 ? (
                <div className="text-center py-12 text-text-secondary">
                  No providers configured. Click "New Provider" to add one.
                </div>
              ) : (
                providers.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onSetActive={setActiveProvider}
                    onDelete={deleteProvider}
                    onUpdate={updateProvider}
                    onSetApiKey={setApiKey}
                    onGetApiKey={getApiKey}
                    onTestConnection={testConnection}
                  />
                ))
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen bg-white text-black font-sans flex flex-col overflow-hidden rounded-xl border border-border-gray shadow-2xl">
      {/* Custom Titlebar */}
      <div
        data-tauri-drag-region
        className="h-12 flex items-center justify-between px-4 z-50 bg-[#FAFAFA] border-b border-border-gray relative shrink-0 cursor-move select-none"
      >
        <div className="flex items-center gap-3 pointer-events-none relative z-10">
          <div className="w-6 h-6 bg-black rounded-md flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-white text-[14px]">
              settings
            </span>
          </div>
          <span className="text-sm font-semibold text-black tracking-tight">
            Settings
          </span>
        </div>

        {/* biome-ignore lint/a11y/noStaticElementInteractions: only stopping propagation for drag region */}
        <div
          className="flex items-center gap-1.5 relative z-10"
          onMouseDown={(e) => e.stopPropagation()}
          data-tauri-drag-region="false"
        >
          {/* Divider */}
          <div className="w-[1px] h-4 bg-border-gray mx-1"></div>

          <button
            type="button"
            onClick={() => getCurrentWindow().minimize()}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 text-text-secondary hover:text-black transition-colors cursor-pointer"
            title="Minimize"
          >
            <span className="material-symbols-outlined text-[18px]">
              remove
            </span>
          </button>

          <button
            type="button"
            onClick={() => getCurrentWindow().toggleMaximize()}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 text-text-secondary hover:text-black transition-colors cursor-pointer"
            title="Maximize"
          >
            <span className="material-symbols-outlined text-[14px]">
              crop_square
            </span>
          </button>

          <button
            type="button"
            onClick={() => getCurrentWindow().hide()}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500 hover:text-white text-text-secondary transition-colors cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[280px] border-r border-border-gray flex flex-col h-full bg-[#FAFAFA] z-20">
          <div className="p-6 pb-4">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white text-lg">
                  terminal
                </span>
              </div>
              <span className="font-bold text-lg tracking-tight">Launcher</span>
            </div>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "general"
                    ? "bg-black text-white shadow-sm"
                    : "text-text-secondary hover:bg-gray-100 hover:text-black"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  settings
                </span>
                General
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("llm-models")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "llm-models"
                    ? "bg-black text-white shadow-sm"
                    : "text-text-secondary hover:bg-gray-100 hover:text-black"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  neurology
                </span>
                LLM Models
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("hotkeys")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "hotkeys"
                    ? "bg-black text-white shadow-sm"
                    : "text-text-secondary hover:bg-gray-100 hover:text-black"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  keyboard
                </span>
                Hotkeys
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "appearance"
                    ? "bg-black text-white shadow-sm"
                    : "text-text-secondary hover:bg-gray-100 hover:text-black"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  palette
                </span>
                Appearance
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("about")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "about"
                    ? "bg-black text-white shadow-sm"
                    : "text-text-secondary hover:bg-gray-100 hover:text-black"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  info
                </span>
                About
              </button>
            </nav>
          </div>
          <div className="mt-auto p-6 border-t border-border-gray bg-[#FAFAFA]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white border border-border-gray rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-slate-500 text-sm">
                  person
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold">Desktop User</p>
                <p className="text-[10px] text-text-secondary">v2.4.0 Pro</p>
              </div>
            </div>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto bg-white">
          {renderTabContent()}
        </main>
      </div>

      {toast && (
        <div className="fixed right-6 bottom-6 z-[120] pointer-events-none">
          <div className="max-w-[420px] min-w-[300px] rounded-xl border border-border-gray bg-white shadow-2xl px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-red-500 mt-[1px]">
                warning
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-black leading-5">
                  {toast.message}
                </p>
                {toast.detail && (
                  <p className="text-[11px] text-text-secondary mt-1 break-all leading-4">
                    {toast.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
