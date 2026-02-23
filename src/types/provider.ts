export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "volcengine"
  | "custom";

export interface Provider {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  is_active: boolean;
  display_order: number;
  created_at: number;
  updated_at: number;
}

export interface ProviderView {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  is_active: boolean;
  display_order: number;
  has_api_key: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateProviderRequest {
  name: string;
  provider_type: ProviderType;
  base_url?: string;
  model?: string;
  api_key?: string;
}

export interface UpdateProviderRequest {
  name?: string;
  base_url?: string;
  model?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  status_code: number | null;
  latency_ms: number;
}

export const PROVIDER_TYPE_INFO: Record<
  ProviderType,
  {
    label: string;
    defaultModel: string;
    defaultBaseUrl: string | null;
    keyUrl: string;
  }
> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-3-5-sonnet-latest",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  google: {
    label: "Google Gemini",
    defaultModel: "gemini-1.5-pro",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  volcengine: {
    label: "Volcengine ARK",
    defaultModel: "deepseek-v3-2-251201",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    keyUrl: "https://www.volcengine.com/docs/82379/1399008",
  },
  custom: {
    label: "Custom",
    defaultModel: "",
    defaultBaseUrl: null,
    keyUrl: "",
  },
};
