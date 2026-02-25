import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ConnectionTestResult,
  ProviderType,
  ProviderView,
} from "@/types/provider";
import { PROVIDER_TYPE_INFO } from "@/types/provider";

interface ProviderCardProps {
  provider: ProviderView;
  onSetActive: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (
    id: string,
    updates: { name?: string; model?: string; base_url?: string },
  ) => Promise<void>;
  onSetApiKey: (id: string, apiKey: string) => Promise<void>;
  onGetApiKey: (id: string) => Promise<string>;
  onTestConnection: (id: string) => Promise<ConnectionTestResult>;
}

const PROVIDER_ICONS: Record<
  ProviderType,
  { bg: string; border?: string; iconColor: string }
> = {
  openai: { bg: "bg-black", iconColor: "text-white" },
  glm: {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    iconColor: "text-emerald-700",
  },
  anthropic: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    iconColor: "text-amber-700",
  },
  google: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    iconColor: "text-blue-600",
  },
  volcengine: {
    bg: "bg-orange-50",
    border: "border-orange-100",
    iconColor: "text-orange-600",
  },
  custom: { bg: "bg-gray-100", iconColor: "text-gray-600" },
};

export function ProviderCard({
  provider,
  onSetActive,
  onDelete,
  onUpdate,
  onSetApiKey,
  onGetApiKey,
  onTestConnection,
}: ProviderCardProps) {
  const withUiTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(provider.name);
  const [editedModel, setEditedModel] = useState(provider.model);
  const [editedBaseUrl, setEditedBaseUrl] = useState(provider.base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyLoadError, setApiKeyLoadError] = useState<string | null>(null);
  const [apiKeySaveError, setApiKeySaveError] = useState<string | null>(null);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(
    null,
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Load API key on mount
  useEffect(() => {
    void (async () => {
      try {
        const key = await onGetApiKey(provider.id);
        setApiKey(key);
        setApiKeyLoadError(null);
        setShowApiKey(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setApiKey("");
        setApiKeyLoadError(message);
      }
    })();
  }, [provider.id, onGetApiKey]);

  const handleSave = async () => {
    setIsSavingSettings(true);
    setSettingsSaveError(null);
    try {
      await onUpdate(provider.id, {
        name: editedName.trim() || undefined,
        model: editedModel.trim() || undefined,
        base_url: editedBaseUrl.trim() || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSettingsSaveError(message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveApiKey = async () => {
    setIsSavingApiKey(true);
    try {
      await withUiTimeout(
        onSetApiKey(provider.id, apiKey),
        15000,
        "Save API key",
      );
      setApiKeyLoadError(null);
      setApiKeySaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setApiKeySaveError(message);
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleToggleActive = async () => {
    await onSetActive(provider.id, !provider.is_active);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestMessage(null);
    try {
      const result = await onTestConnection(provider.id);
      setTestResult(result.success ? "success" : "error");
      setTestMessage(result.message);
      setTimeout(() => {
        setTestResult(null);
        setTestMessage(null);
      }, 3000);
    } catch (error) {
      setTestResult("error");
      setTestMessage(error instanceof Error ? error.message : String(error));
      setTimeout(() => {
        setTestResult(null);
        setTestMessage(null);
      }, 3000);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(provider.id);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const iconStyle = PROVIDER_ICONS[provider.provider_type];
  const typeInfo = PROVIDER_TYPE_INFO[provider.provider_type];

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 ${iconStyle.bg} ${iconStyle.border ?? ""} ${iconStyle.border ? "border" : ""} rounded-xl flex items-center justify-center shadow-inner`}
            >
              <span
                className={`material-symbols-outlined ${iconStyle.iconColor} text-2xl`}
              >
                {provider.provider_type === "openai" && "bolt"}
                {provider.provider_type === "glm" && "model_training"}
                {provider.provider_type === "anthropic" &&
                  "temp_preferences_custom"}
                {provider.provider_type === "google" && "auto_awesome"}
                {provider.provider_type === "volcengine" && "deployed_code"}
                {provider.provider_type === "custom" && "extension"}
              </span>
            </div>
            <div>
              {isEditing ? (
                <input
                  className="text-lg font-bold border-b border-input focus:border-primary outline-none bg-transparent text-foreground"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Provider Name"
                />
              ) : (
                <h2 className="text-lg font-bold text-foreground">{provider.name}</h2>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {provider.provider_type === "openai" &&
                  "Supports GPT-4o, GPT-4 Turbo, and specialized embedding models."}
                {provider.provider_type === "glm" &&
                  "Official Zhipu BigModel API endpoint for GLM family models."}
                {provider.provider_type === "anthropic" &&
                  "Claude 3.5 Sonnet, Claude 3 Opus, and Haiku for fast processing."}
                {provider.provider_type === "google" &&
                  "Gemini 1.5 Pro and Flash. Advanced reasoning with massive context windows."}
                {provider.provider_type === "volcengine" &&
                  "Volcengine ARK endpoint with official OpenAI Responses API compatibility."}
                {provider.provider_type === "custom" &&
                  "Custom OpenAI-compatible API endpoint."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              title="Delete Provider"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <span className="material-symbols-outlined text-[18px]">
                delete
              </span>
            </button>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {provider.is_active ? "Active" : "Disabled"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                className="sr-only peer"
                type="checkbox"
                checked={provider.is_active}
                onChange={handleToggleActive}
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-background after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              API Key
            </span>
            {typeInfo.keyUrl && (
              <a
                className="text-[10px] text-primary hover:underline font-medium"
                href={typeInfo.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get key from {typeInfo.label} dashboard
              </a>
            )}
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                className="w-full h-9 px-3 pr-10 border border-input rounded-md text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all bg-background text-foreground"
                placeholder={
                  provider.provider_type === "openai"
                    ? "sk-..."
                    : provider.provider_type === "glm"
                      ? "your_glm_api_key"
                      : provider.provider_type === "anthropic"
                        ? "sk-ant-..."
                        : provider.provider_type === "google"
                          ? "AIzaSy..."
                          : provider.provider_type === "volcengine"
                            ? "your_ark_api_key"
                            : "API Key"
                }
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowApiKey((prev) => !prev)}
                title={showApiKey ? "Hide API Key" : "Show API Key"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showApiKey ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            <button
              type="button"
              className="px-4 h-9 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              onClick={handleSaveApiKey}
              disabled={isSavingApiKey}
            >
              {isSavingApiKey ? "Saving..." : "Save Key"}
            </button>
          </div>
          {apiKeyLoadError && (
            <p className="text-[11px] text-destructive">
              Failed to load API key: {apiKeyLoadError}
            </p>
          )}
          {apiKeySaveError && (
            <p className="text-[11px] text-destructive">
              Failed to save API key: {apiKeySaveError}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <div className="flex-1">
              <label
                htmlFor={`model-${provider.id}`}
                className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1 block"
              >
                Model
              </label>
              {isEditing ? (
                <input
                  id={`model-${provider.id}`}
                  className="w-full h-9 px-3 border border-input rounded-md text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all bg-background text-foreground"
                  value={editedModel}
                  onChange={(e) => setEditedModel(e.target.value)}
                  placeholder={typeInfo.defaultModel}
                />
              ) : (
                <div className="h-9 px-3 flex items-center text-xs text-muted-foreground border border-input rounded-md bg-muted/50">
                  {provider.model || "(not set)"}
                </div>
              )}
            </div>
            <div className="flex-1">
              <label
                htmlFor={`baseurl-${provider.id}`}
                className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1 block"
              >
                Base URL
              </label>
              {isEditing ? (
                <input
                  id={`baseurl-${provider.id}`}
                  className="w-full h-9 px-3 border border-input rounded-md text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all bg-background text-foreground"
                  value={editedBaseUrl}
                  onChange={(e) => setEditedBaseUrl(e.target.value)}
                  placeholder={
                    typeInfo.defaultBaseUrl ?? "https://api.example.com/v1"
                  }
                />
              ) : (
                <div className="h-9 px-3 flex items-center text-xs text-muted-foreground border border-input rounded-md bg-muted/50 truncate">
                  {provider.base_url || "(default)"}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="px-3 h-8 border border-input text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors bg-background text-foreground"
                  onClick={() => {
                    setIsEditing(false);
                    setSettingsSaveError(null);
                    setEditedName(provider.name);
                    setEditedModel(provider.model);
                    setEditedBaseUrl(provider.base_url ?? "");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 h-8 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  onClick={handleSave}
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`px-3 h-8 border text-xs font-medium rounded-md transition-colors ${
                    testResult === "success"
                      ? "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                      : testResult === "error"
                        ? "border-destructive/20 bg-destructive/10 text-destructive dark:text-red-400"
                        : "border-input hover:bg-accent hover:text-accent-foreground text-foreground bg-background"
                  }`}
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {testResult === "success"
                    ? "Success"
                    : testResult === "error"
                      ? "Failed"
                      : isTesting
                        ? "Testing..."
                        : "Test Connection"}
                </button>
                <button
                  type="button"
                  className="px-3 h-8 border border-input text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors bg-background text-foreground"
                  onClick={() => {
                    setSettingsSaveError(null);
                    setIsEditing(true);
                  }}
                >
                  Edit
                </button>
              </>
            )}
          </div>
          {settingsSaveError && (
            <p className="text-[11px] text-destructive mt-2">
              Failed to save settings: {settingsSaveError}
            </p>
          )}
          {testMessage && (
            <p
              className={`text-[11px] mt-2 ${
                testResult === "success" ? "text-green-700 dark:text-green-400" : "text-destructive"
              }`}
            >
              {testMessage}
            </p>
          )}
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{provider.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="px-4 h-9 border border-input text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm bg-background text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 h-9 bg-destructive text-destructive-foreground text-xs font-medium rounded-md hover:bg-destructive/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
