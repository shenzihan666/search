import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import type {
  ConnectionTestResult,
  CreateProviderRequest,
  Provider,
  ProviderView,
  UpdateProviderRequest,
} from "../types/provider";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

export function useProviders() {
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeProvider = providers.find((p) => p.is_active);

  const loadProviders = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const result = await withTimeout(
        invoke<ProviderView[]>("list_providers"),
        10000,
        "list_providers",
      );
      setProviders(result);
    } catch (err) {
      console.error("Failed to load providers:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const createProvider = useCallback(
    async (req: CreateProviderRequest): Promise<ProviderView | null> => {
      try {
        const created = await invoke<Provider>("create_provider", { req });
        const result = await withTimeout(
          invoke<ProviderView[]>("list_providers"),
          10000,
          "list_providers",
        );
        setProviders(result);
        return result.find((item) => item.id === created.id) ?? null;
      } catch (err) {
        console.error("Failed to create provider:", err);
        throw err;
      }
    },
    [],
  );

  const updateProvider = useCallback(
    async (id: string, req: UpdateProviderRequest): Promise<void> => {
      try {
        await withTimeout(
          invoke("update_provider", { id, req }),
          10000,
          "update_provider",
        );
        await loadProviders();
      } catch (err) {
        console.error("Failed to update provider:", err);
        throw err;
      }
    },
    [loadProviders],
  );

  const deleteProvider = useCallback(
    async (id: string): Promise<void> => {
      try {
        await invoke("delete_provider", { id });
        await loadProviders();
      } catch (err) {
        console.error("Failed to delete provider:", err);
        throw err;
      }
    },
    [loadProviders],
  );

  const setActiveProvider = useCallback(
    async (id: string, isActive: boolean): Promise<void> => {
      try {
        await invoke("set_active_provider", { id, isActive });
        await loadProviders();
      } catch (err) {
        console.error("Failed to set active provider:", err);
        throw err;
      }
    },
    [loadProviders],
  );

  const getApiKey = useCallback(async (id: string): Promise<string> => {
    try {
      return await invoke<string>("get_provider_api_key", { id });
    } catch (err) {
      console.error("Failed to get API key:", err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const setApiKey = useCallback(
    async (id: string, apiKey: string): Promise<void> => {
      try {
        await withTimeout(
          invoke("set_provider_api_key", { id, apiKey }),
          10000,
          "set_provider_api_key",
        );
        // Silent reload avoids blocking UI with a global loading state.
        await loadProviders(true);
      } catch (err) {
        console.error("Failed to set API key:", err);
        throw err;
      }
    },
    [loadProviders],
  );

  const testConnection = useCallback(
    async (id: string): Promise<ConnectionTestResult> => {
      try {
        return await withTimeout(
          invoke<ConnectionTestResult>("test_provider_connection", { id }),
          15000,
          "test_provider_connection",
        );
      } catch (err) {
        console.error("Failed to test provider connection:", err);
        throw err;
      }
    },
    [],
  );

  return {
    providers,
    activeProvider,
    isLoading,
    error,
    createProvider,
    updateProvider,
    deleteProvider,
    setActiveProvider,
    getApiKey,
    setApiKey,
    testConnection,
    reload: loadProviders,
  };
}
