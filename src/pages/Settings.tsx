import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Settings() {
  const [isNewProviderOpen, setIsNewProviderOpen] = useState(false);
  const [providerConfig, setProviderConfig] = useState({
    api_key: "",
    model: "gpt-4o-mini",
    provider_type: "openai",
    base_url: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.show();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const config = await invoke<{
          api_key: string | null;
          model: string;
          provider_type: string;
          base_url: string | null;
        }>("get_config");
        if (cancelled) {
          return;
        }
        setProviderConfig({
          api_key: config.api_key ?? "",
          model: config.model,
          provider_type: config.provider_type,
          base_url: config.base_url ?? "",
        });
      } catch (error) {
        console.error("Failed to load provider config:", error);
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProviderConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await invoke("set_config", {
        config: {
          api_key: providerConfig.api_key.trim()
            ? providerConfig.api_key.trim()
            : null,
          model: providerConfig.model.trim() || "gpt-4o-mini",
          provider_type: providerConfig.provider_type.trim() || "openai",
          base_url: providerConfig.base_url.trim()
            ? providerConfig.base_url.trim()
            : null,
        },
      });
      setSaveMessage("Saved");
    } catch (error) {
      console.error("Failed to save provider config:", error);
      setSaveMessage("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white text-black font-sans overflow-hidden rounded-xl border border-border-gray shadow-2xl flex-col">
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-text-secondary hover:bg-[#FAFAFA] hover:text-black transition-all w-full text-left"
              >
                <span className="material-symbols-outlined text-[20px]">
                  settings
                </span>
                General
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm bg-[#FAFAFA] font-semibold text-black transition-all w-full text-left"
              >
                <span className="material-symbols-outlined text-[20px]">
                  hub
                </span>
                LLM Models
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-text-secondary hover:bg-[#FAFAFA] hover:text-black transition-all w-full text-left"
              >
                <span className="material-symbols-outlined text-[20px]">
                  keyboard
                </span>
                Hotkeys
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-text-secondary hover:bg-[#FAFAFA] hover:text-black transition-all w-full text-left"
              >
                <span className="material-symbols-outlined text-[20px]">
                  palette
                </span>
                Appearance
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-text-secondary hover:bg-[#FAFAFA] hover:text-black transition-all w-full text-left"
              >
                <span className="material-symbols-outlined text-[20px]">
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
                onOpenChange={setIsNewProviderOpen}
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
                      Configure a custom OpenAI-compatible API endpoint.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label
                        htmlFor="provider-name"
                        className="text-xs font-medium"
                      >
                        Provider Name
                      </label>
                      <input
                        id="provider-name"
                        placeholder="e.g. DeepSeek, Groq, Local LM Studio"
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="base-url" className="text-xs font-medium">
                        Base URL
                      </label>
                      <input
                        id="base-url"
                        placeholder="https://api.example.com/v1"
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="api-key" className="text-xs font-medium">
                        API Key
                      </label>
                      <input
                        id="api-key"
                        type="password"
                        placeholder="sk-..."
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label
                        htmlFor="model-name"
                        className="text-xs font-medium"
                      >
                        Default Model Name
                      </label>
                      <input
                        id="model-name"
                        placeholder="e.g. deepseek-chat"
                        className="flex h-9 w-full rounded-md border border-border-gray bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50"
                      />
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
                      onClick={() => setIsNewProviderOpen(false)}
                      className="px-4 h-9 bg-black text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-colors shadow-sm"
                    >
                      Save Provider
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </header>
            <div className="space-y-8">
              <div className="border border-border-gray rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shadow-inner">
                        <span className="material-symbols-outlined text-white text-2xl">
                          bolt
                        </span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">OpenAI</h2>
                        <p className="text-xs text-text-secondary mt-1">
                          Supports GPT-4o, GPT-4 Turbo, and specialized
                          embedding models.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
                        Active
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          defaultChecked
                          className="sr-only peer"
                          type="checkbox"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-secondary">
                        API Key
                      </span>
                      <a
                        className="text-[10px] text-blue-600 hover:underline font-medium"
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get key from OpenAI dashboard
                      </a>
                    </div>
                    <div className="flex gap-3">
                      <input
                        className="flex-1 h-9 px-3 border border-border-gray rounded-md text-xs focus:ring-1 focus:ring-black focus:border-black outline-none transition-all"
                        placeholder="sk-..."
                        type="password"
                        value={providerConfig.api_key}
                        onChange={(event) =>
                          setProviderConfig((prev) => ({
                            ...prev,
                            api_key: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex gap-3">
                      <input
                        className="flex-1 h-9 px-3 border border-border-gray rounded-md text-xs focus:ring-1 focus:ring-black focus:border-black outline-none transition-all"
                        placeholder="https://api.openai.com/v1"
                        value={providerConfig.base_url}
                        onChange={(event) =>
                          setProviderConfig((prev) => ({
                            ...prev,
                            base_url: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="px-4 h-9 bg-black text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
                        onClick={saveProviderConfig}
                        disabled={isSaving}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                    {saveMessage && (
                      <p className="text-[11px] text-text-secondary">
                        {saveMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="border border-border-gray rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-amber-700 text-2xl">
                          temp_preferences_custom
                        </span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Anthropic</h2>
                        <p className="text-xs text-text-secondary mt-1">
                          Claude 3.5 Sonnet, Claude 3 Opus, and Haiku for fast
                          processing.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
                        Disabled
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input className="sr-only peer" type="checkbox" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-secondary">
                        API Key
                      </span>
                      <a
                        className="text-[10px] text-blue-600 hover:underline font-medium"
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Anthropic Console
                      </a>
                    </div>
                    <div className="flex gap-3">
                      <input
                        className="flex-1 h-9 px-3 border border-border-gray rounded-md text-xs focus:ring-1 focus:ring-black focus:border-black outline-none transition-all bg-gray-50/50"
                        placeholder="sk-ant-..."
                        type="password"
                      />
                      <button
                        type="button"
                        className="px-4 h-9 border border-border-gray text-xs font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Verify Connection
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border border-border-gray rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-600 text-2xl">
                          auto_awesome
                        </span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Google Gemini</h2>
                        <p className="text-xs text-text-secondary mt-1">
                          Gemini 1.5 Pro and Flash. Advanced reasoning with
                          massive context windows.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
                        Disabled
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input className="sr-only peer" type="checkbox" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-secondary">
                        API Key
                      </span>
                      <a
                        className="text-[10px] text-blue-600 hover:underline font-medium"
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google AI Studio
                      </a>
                    </div>
                    <div className="flex gap-3">
                      <input
                        className="flex-1 h-9 px-3 border border-border-gray rounded-md text-xs focus:ring-1 focus:ring-black focus:border-black outline-none transition-all bg-gray-50/50"
                        placeholder="AIzaSy..."
                        type="password"
                      />
                      <button
                        type="button"
                        className="px-4 h-9 border border-border-gray text-xs font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Verify Connection
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
