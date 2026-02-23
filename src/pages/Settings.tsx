import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
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
import type { ProviderType } from "@/types/provider";
import { PROVIDER_TYPE_INFO } from "@/types/provider";

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
    const appWindow = getCurrentWindow();
    appWindow.show();
  }, []);

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
                        defaultChecked
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
                        defaultChecked
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                    </label>
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
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-gray-100 border border-border-gray rounded-md text-xs font-mono font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Alt + Space
                    </button>
                  </div>
                  <div className="h-px bg-border-gray w-full"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Open Settings</h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Shortcut to open this settings window.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-gray-100 border border-border-gray rounded-md text-xs font-mono font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Ctrl + ,
                    </button>
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
                        className="flex flex-col items-center gap-2 p-4 border-2 border-black rounded-lg bg-white"
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
                        className="flex flex-col items-center gap-2 p-4 border-2 border-transparent hover:border-gray-200 rounded-lg bg-white"
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
                        className="flex flex-col items-center gap-2 p-4 border-2 border-transparent hover:border-gray-200 rounded-lg bg-white"
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
    </div>
  );
}
