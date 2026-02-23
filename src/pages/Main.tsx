import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface AppInfo {
  name: string;
  path: string;
  publisher: string | null;
}

interface SearchResult {
  app: AppInfo;
  score: number;
}

function Main() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [appResults, setAppResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [appIcons, setAppIcons] = useState<Record<string, string | null>>({});
  const [selectedItemValue, setSelectedItemValue] = useState("ask-ai");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isQueryMode = query.trim().length > 0;
  const visibleResults = useMemo(
    () => (isQueryMode ? appResults : suggestions),
    [appResults, isQueryMode, suggestions],
  );

  const focusSearchInput = useCallback(() => {
    // Delay one frame so focus happens after window show/activation settles.
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

  useEffect(() => {
    // Listen for streaming chunks
    const unlisten = listen<string>("query:chunk", (event) => {
      setResponse((prev) => prev + event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen("launcher:opened", () => {
      focusSearchInput();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [focusSearchInput]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void hideLauncher();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hideLauncher]);

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

  // Debounced app search + suggestions mode
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isQueryMode) {
        try {
          const results = await invoke<SearchResult[]>("search_apps", {
            query,
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
  }, [isQueryMode, loadSuggestions, query]);

  useEffect(() => {
    if (visibleResults.length === 0) {
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
      if (cancelled) {
        return;
      }

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
  }, [appIcons, visibleResults]);

  useEffect(() => {
    if (visibleResults.length === 0) {
      if (selectedItemValue !== "ask-ai") {
        setSelectedItemValue("ask-ai");
      }
      return;
    }

    const selectedExists = visibleResults.some(
      (result) => result.app.path === selectedItemValue,
    );
    if (!selectedExists) {
      setSelectedItemValue(visibleResults[0].app.path);
    }
  }, [selectedItemValue, visibleResults]);

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isLoading) return;

    setIsLoading(true);
    setResponse("");

    try {
      await invoke("query_stream", { prompt: value });
    } catch (error) {
      console.error("Query failed:", error);
      setResponse(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppSelect = async (app: AppInfo) => {
    try {
      await invoke("launch_app", { path: app.path });
      if (!isQueryMode) {
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
        <div className="w-full max-w-[900px]">
          <Command
            className="vercel-launcher-container bg-bg-main border border-border-gray rounded-xl overflow-hidden"
            shouldFilter={false}
            value={selectedItemValue}
            onValueChange={setSelectedItemValue}
          >
            <CommandInput
              placeholder="Search apps or ask AI (Tab to chat)"
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  void hideLauncher();
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (visibleResults.length > 0) {
                    const selected =
                      visibleResults.find(
                        (result) => result.app.path === selectedItemValue,
                      ) ?? visibleResults[0];
                    void handleAppSelect(selected.app);
                  } else {
                    void handleSubmit(query);
                  }
                }
              }}
              autoFocus
            />

            <div className="border-t border-border-gray">
              <CommandList className="max-h-[400px] overflow-y-auto no-scrollbar">
                <div className="px-5 py-2.5 bg-[#FAFAFA]">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em]">
                    {isQueryMode ? "Applications" : "Suggestions"}
                  </span>
                </div>

                <div className="py-1">
                  {/* App Results */}
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

                  {/* Ask AI - shown when no app results or as fallback */}
                  {visibleResults.length === 0 && (
                    <CommandItem
                      value="ask-ai"
                      className="w-full flex items-center px-5 py-3.5 hover:bg-[#F9F9F9] transition-all group text-left cursor-pointer data-[selected=true]:bg-[#F9F9F9]"
                      onSelect={() => handleSubmit(query)}
                    >
                      <div className="w-9 h-9 rounded bg-black flex items-center justify-center text-white shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">
                          auto_awesome
                        </span>
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-[15px] font-medium tracking-tight">
                          Ask AI Assistant
                        </p>
                        <p className="text-[13px] text-text-secondary">
                          Query multiple LLMs simultaneously
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
                  )}
                </div>
              </CommandList>
            </div>

            {response && (
              <div className="border-t border-border-gray p-5 bg-white">
                <div className="text-[14px] text-text-main whitespace-pre-wrap">
                  {response}
                </div>
              </div>
            )}

            <div className="px-5 py-3 border-t border-border-gray bg-[#FAFAFA] flex justify-between items-center">
              <div className="flex items-center gap-6">
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
                    ESC
                  </kbd>
                  <span className="text-[12px] text-text-secondary">
                    to close
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[12px] text-text-secondary font-medium">
                    AI Systems Online
                  </span>
                </div>
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
