import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useProviders } from "@/hooks/useProviders";
import type { ProviderView } from "@/types/provider";

interface AppInfo {
  name: string;
  path: string;
  publisher: string | null;
}

interface SearchResult {
  app: AppInfo;
  score: number;
}

interface ChatPaneState {
  isLoading: boolean;
  response: string;
  error: string | null;
}

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

function Main() {
  const [inputValue, setInputValue] = useState("");
  const [appResults, setAppResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [appIcons, setAppIcons] = useState<Record<string, string | null>>({});
  const [selectedItemValue, setSelectedItemValue] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [mode, setMode] = useState<"search" | "chat">("search");
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatProviderIds, setChatProviderIds] = useState<string[]>([]);
  const [chatPanes, setChatPanes] = useState<Record<string, ChatPaneState>>({});
  const [isChatRunning, setIsChatRunning] = useState(false);

  const chatRequestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { providers } = useProviders();

  const providersWithKeys = useMemo(
    () => providers.filter((p) => p.has_api_key),
    [providers],
  );

  const providersWithKeysPrioritized = useMemo(() => {
    return [...providersWithKeys].sort((a, b) => {
      if (a.is_active === b.is_active) return 0;
      return a.is_active ? -1 : 1;
    });
  }, [providersWithKeys]);

  const fetchFreshProviders = useCallback(async (): Promise<ProviderView[]> => {
    try {
      const latest = await withTimeout(
        invoke<ProviderView[]>("list_providers"),
        10000,
        "list_providers",
      );
      return latest
        .filter((p) => p.has_api_key)
        .sort((a, b) => {
          if (a.is_active === b.is_active) return 0;
          return a.is_active ? -1 : 1;
        });
    } catch (error) {
      console.error("Failed to refresh providers before chat query:", error);
      return providersWithKeysPrioritized;
    }
  }, [providersWithKeysPrioritized]);

  const maxMultiplier = Math.min(providersWithKeysPrioritized.length, 4);
  const canUseMultiplier = maxMultiplier > 1;

  const isSearchQuery = mode === "search" && inputValue.trim().length > 0;
  const visibleResults = useMemo(
    () => (isSearchQuery ? appResults : suggestions),
    [appResults, isSearchQuery, suggestions],
  );

  const activeChatProviders = useMemo(() => {
    if (chatProviderIds.length === 0) return [] as ProviderView[];
    return providersWithKeysPrioritized.filter((provider) =>
      chatProviderIds.includes(provider.id),
    );
  }, [chatProviderIds, providersWithKeysPrioritized]);

  const cardMaxWidth =
    mode === "chat"
      ? activeChatProviders.length > 1
        ? "max-w-[1240px]"
        : "max-w-[980px]"
      : "max-w-[900px]";

  const cycleMultiplier = useCallback(() => {
    if (maxMultiplier <= 1) return;
    setMultiplier((prev) => (prev >= maxMultiplier ? 1 : prev + 1));
  }, [maxMultiplier]);

  const focusSearchInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, []);

  const hideLauncher = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    } catch (e) {
      console.error("Failed to hide launcher window:", e);
    }
  }, []);

  const exitChatToSearch = useCallback(() => {
    setMode("search");
    setChatPrompt("");
    setChatProviderIds([]);
    setChatPanes({});
    setIsChatRunning(false);
    focusSearchInput();
  }, [focusSearchInput]);

  const loadSuggestions = useCallback(async () => {
    try {
      const results = await invoke<SearchResult[]>("get_suggestions", {
        limit: 8,
      });
      setSuggestions(results);
    } catch (e) {
      console.error("Failed to load suggestions:", e);
      setSuggestions([]);
    }
  }, []);

  const runChatQuery = useCallback(
    async (prompt: string, selectedProviders: ProviderView[]) => {
      const requestId = chatRequestIdRef.current + 1;
      chatRequestIdRef.current = requestId;

      setChatPrompt(prompt);
      setChatProviderIds(selectedProviders.map((p) => p.id));

      if (selectedProviders.length === 0) {
        setChatPanes({});
        setIsChatRunning(false);
        return;
      }

      const initial: Record<string, ChatPaneState> = {};
      for (const provider of selectedProviders) {
        initial[provider.id] = {
          isLoading: true,
          response: "",
          error: null,
        };
      }
      setChatPanes(initial);
      setIsChatRunning(true);

      await Promise.all(
        selectedProviders.map(async (provider) => {
          const eventName = `query:chunk:${provider.id}`;
          const unlisten = await listen<string>(eventName, (event) => {
            if (chatRequestIdRef.current !== requestId) return;
            setChatPanes((prev) => {
              const current = prev[provider.id] ?? {
                isLoading: true,
                response: "",
                error: null,
              };
              return {
                ...prev,
                [provider.id]: {
                  ...current,
                  response: `${current.response}${event.payload}`,
                },
              };
            });
          });

          try {
            await withTimeout(
              invoke("query_stream_provider", {
                providerId: provider.id,
                provider_id: provider.id,
                prompt,
              }),
              45000,
              "query_stream_provider",
            );

            if (chatRequestIdRef.current !== requestId) return;

            setChatPanes((prev) => ({
              ...prev,
              [provider.id]: {
                isLoading: false,
                response: prev[provider.id]?.response ?? "",
                error: null,
              },
            }));
          } catch (error) {
            if (chatRequestIdRef.current !== requestId) return;
            const message =
              error instanceof Error ? error.message : String(error);
            setChatPanes((prev) => ({
              ...prev,
              [provider.id]: {
                isLoading: false,
                response: "",
                error: message,
              },
            }));
          } finally {
            unlisten();
          }
        }),
      );

      if (chatRequestIdRef.current === requestId) {
        setIsChatRunning(false);
      }
    },
    [],
  );

  const startChatFromInput = useCallback(async () => {
    const prompt = inputValue.trim();
    if (!prompt) return;

    const availableProviders = await fetchFreshProviders();
    const autoMultiCount =
      multiplier === 1 && maxMultiplier > 1 ? maxMultiplier : multiplier;
    const count = Math.max(1, Math.min(autoMultiCount, maxMultiplier || 1));
    const selectedProviders = availableProviders.slice(0, count);

    if (multiplier === 1 && maxMultiplier > 1) {
      setMultiplier(count);
    }

    setMode("chat");
    setInputValue("");
    void runChatQuery(prompt, selectedProviders);
  }, [
    fetchFreshProviders,
    inputValue,
    maxMultiplier,
    multiplier,
    runChatQuery,
  ]);

  const submitChatFollowUp = useCallback(async () => {
    const prompt = inputValue.trim();
    if (!prompt || isChatRunning) return;

    const availableProviders = await fetchFreshProviders();
    const selectedProviders =
      activeChatProviders.length > 0
        ? availableProviders.filter((provider) =>
            chatProviderIds.includes(provider.id),
          )
        : availableProviders.slice(
            0,
            Math.max(1, Math.min(multiplier, maxMultiplier || 1)),
          );
    const fallbackProviders =
      selectedProviders.length > 0
        ? selectedProviders
        : availableProviders.slice(
            0,
            Math.max(1, Math.min(multiplier, maxMultiplier || 1)),
          );

    setInputValue("");
    void runChatQuery(prompt, fallbackProviders);
  }, [
    activeChatProviders,
    chatProviderIds,
    fetchFreshProviders,
    inputValue,
    isChatRunning,
    maxMultiplier,
    multiplier,
    runChatQuery,
  ]);

  useEffect(() => {
    const unlisten = listen("launcher:opened", () => {
      focusSearchInput();
      if (mode === "search") {
        void loadSuggestions();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [focusSearchInput, loadSuggestions, mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();

      if (mode === "chat") {
        exitChatToSearch();
        return;
      }

      void hideLauncher();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitChatToSearch, hideLauncher, mode]);

  useEffect(() => {
    if (mode !== "search") return;

    const timer = setTimeout(async () => {
      if (isSearchQuery) {
        try {
          const results = await invoke<SearchResult[]>("search_apps", {
            query: inputValue,
          });
          setAppResults(results);
        } catch (e) {
          console.error("App search failed:", e);
          setAppResults([]);
        }
      } else {
        setAppResults([]);
        void loadSuggestions();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [inputValue, isSearchQuery, loadSuggestions, mode]);

  useEffect(() => {
    if (mode !== "search" || visibleResults.length === 0) {
      return;
    }

    const pendingPaths = visibleResults
      .map((result) => result.app.path)
      .filter((path) => appIcons[path] === undefined);

    if (pendingPaths.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      pendingPaths.map(async (path) => {
        try {
          const icon = await invoke<string | null>("get_app_icon", { path });
          return [path, icon] as const;
        } catch (e) {
          console.error("App icon extraction failed:", e);
          return [path, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;

      setAppIcons((prev) => {
        const next = { ...prev };
        for (const [path, icon] of entries) {
          next[path] = icon;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [appIcons, mode, visibleResults]);

  useEffect(() => {
    if (mode !== "search" || visibleResults.length === 0) {
      return;
    }

    const selectedExists = visibleResults.some(
      (result) => result.app.path === selectedItemValue,
    );
    if (!selectedExists) {
      setSelectedItemValue(visibleResults[0].app.path);
    }
  }, [mode, selectedItemValue, visibleResults]);

  const handleAppSelect = async (app: AppInfo) => {
    try {
      await invoke("launch_app", { path: app.path });
      if (!isSearchQuery) {
        void loadSuggestions();
      }
      void hideLauncher();
    } catch (e) {
      console.error("Failed to launch app:", e);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <main className="desktop-canvas relative z-10 w-full px-8 pointer-events-auto">
        <div className={`w-full ${cardMaxWidth} transition-all duration-300`}>
          <Command
            className="vercel-launcher-container bg-bg-main border border-border-gray rounded-xl overflow-hidden"
            shouldFilter={false}
            value={selectedItemValue}
            onValueChange={setSelectedItemValue}
          >
            <CommandInput
              placeholder={
                mode === "chat"
                  ? "Ask follow-up... (Enter to send, Esc to app search)"
                  : "Search apps or ask AI (Tab to chat)"
              }
              ref={inputRef}
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (mode === "chat") {
                    exitChatToSearch();
                  } else {
                    void hideLauncher();
                  }
                  return;
                }

                if (e.key === "Tab" && mode === "search") {
                  e.preventDefault();
                  if (inputValue.trim()) {
                    startChatFromInput();
                  }
                  return;
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  if (mode === "chat") {
                    submitChatFollowUp();
                    return;
                  }

                  if (visibleResults.length > 0) {
                    const selected =
                      visibleResults.find(
                        (result) => result.app.path === selectedItemValue,
                      ) ?? visibleResults[0];
                    void handleAppSelect(selected.app);
                  }
                }
              }}
              autoFocus
            />

            <div className="border-t border-border-gray">
              {mode === "search" ? (
                <CommandList className="max-h-[400px] overflow-y-auto no-scrollbar">
                  <div className="px-5 py-2.5 bg-[#FAFAFA]">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em]">
                      {isSearchQuery ? "Applications" : "Suggestions"}
                    </span>
                  </div>

                  <div className="py-1">
                    {visibleResults.map((result) => (
                      <CommandItem
                        key={result.app.path}
                        value={result.app.path}
                        className="w-full flex items-center px-5 py-3.5 hover:bg-[#F9F9F9] transition-all group text-left cursor-pointer data-[selected=true]:bg-[#F9F9F9]"
                        onSelect={() => handleAppSelect(result.app)}
                      >
                        <div className="w-9 h-9 rounded border border-border-gray flex items-center justify-center bg-white">
                          {appIcons[result.app.path] ? (
                            <img
                              src={appIcons[result.app.path] ?? ""}
                              alt={`${result.app.name} icon`}
                              className="w-5 h-5 object-contain"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-[20px] text-text-main">
                              apps
                            </span>
                          )}
                        </div>
                        <div className="ml-4 flex-1">
                          <p className="text-[15px] font-medium tracking-tight">
                            {result.app.name}
                          </p>
                          <p className="text-[13px] text-text-secondary">
                            {result.app.publisher ?? "Application"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[12px] text-text-secondary font-medium">
                            Open
                          </span>
                          <span className="material-symbols-outlined text-text-secondary text-[18px]">
                            keyboard_return
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </div>
                </CommandList>
              ) : (
                <div className="bg-white transition-all duration-300 min-h-[260px]">
                  <div className="px-5 py-2.5 bg-[#FAFAFA] border-b border-border-gray flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em]">
                      Model Responses
                    </span>
                    {chatPrompt && (
                      <span className="text-[11px] text-text-secondary truncate max-w-[60%]">
                        {chatPrompt}
                      </span>
                    )}
                  </div>

                  {activeChatProviders.length === 0 ? (
                    <div className="px-6 py-10 text-center text-text-secondary text-sm">
                      No providers with API keys configured. Add API keys in
                      Settings first.
                    </div>
                  ) : (
                    <div className="flex divide-x divide-border-gray overflow-x-auto">
                      {activeChatProviders.map((provider) => {
                        const pane = chatPanes[provider.id];
                        return (
                          <section
                            key={provider.id}
                            className="min-w-[320px] flex-1 flex flex-col max-h-[460px]"
                          >
                            <header className="px-4 py-3 border-b border-border-gray bg-white">
                              <p className="text-[11px] font-bold uppercase tracking-[0.08em]">
                                {provider.name}
                              </p>
                              <p className="text-[11px] text-text-secondary mt-1">
                                {provider.model}
                              </p>
                            </header>
                            <div className="p-4 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap min-h-[220px]">
                              {pane?.error ? (
                                <p className="text-red-600">
                                  Error: {pane.error}
                                </p>
                              ) : pane?.isLoading && !pane?.response ? (
                                <div className="flex items-center gap-2 text-text-secondary">
                                  <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                                  <span>Thinking...</span>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p>{pane?.response ?? ""}</p>
                                  {pane?.isLoading && (
                                    <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                                      <div className="w-1.5 h-1.5 rounded-full bg-black/60 animate-pulse" />
                                      <span>Generating...</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border-gray bg-[#FAFAFA] flex justify-between items-center">
              <div className="flex items-center gap-6">
                {mode === "search" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
                        ENTER
                      </kbd>
                      <span className="text-[12px] text-text-secondary">
                        to select
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
                        TAB
                      </kbd>
                      <span className="text-[12px] text-text-secondary">
                        to chat
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
                        ESC
                      </kbd>
                      <span className="text-[12px] text-text-secondary">
                        to close
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
                        ENTER
                      </kbd>
                      <span className="text-[12px] text-text-secondary">
                        send follow-up
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
                        ESC
                      </kbd>
                      <span className="text-[12px] text-text-secondary">
                        back to app search
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[12px] text-text-secondary font-medium">
                    AI Systems Online
                  </span>
                </div>

                {canUseMultiplier && (
                  <>
                    <div className="h-3 w-[1px] bg-border-gray"></div>
                    <button
                      type="button"
                      onClick={cycleMultiplier}
                      className="px-2 py-0.5 rounded border border-border-gray bg-white text-[11px] font-bold text-text-secondary hover:border-black hover:text-black transition-colors cursor-pointer"
                      title={`${multiplier}x = Query ${multiplier} model${multiplier > 1 ? "s" : ""} simultaneously`}
                    >
                      {multiplier}x
                    </button>
                  </>
                )}

                <div className="h-3 w-[1px] bg-border-gray"></div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 hover:text-black cursor-pointer group bg-transparent border-0 p-0"
                  onClick={async () => {
                    const { Window } = await import("@tauri-apps/api/window");
                    const settingsWindow = new Window("settings");
                    await settingsWindow.show();
                    await settingsWindow.setFocus();
                  }}
                >
                  <span className="material-symbols-outlined text-[16px] text-text-secondary group-hover:text-black">
                    settings
                  </span>
                  <span className="text-[12px] text-text-secondary group-hover:text-black font-medium">
                    Settings
                  </span>
                </button>
              </div>
            </div>
          </Command>
        </div>
      </main>
    </div>
  );
}

export default Main;
