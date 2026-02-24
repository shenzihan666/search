/**
 * Main launcher orchestrator.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatProviderColumn } from "@/components/chat/ChatProviderColumn";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatQuery } from "@/hooks/useChatQuery";
import { createSessionId, useChatSessions } from "@/hooks/useChatSessions";
import { useProviders } from "@/hooks/useProviders";
import { AppSettingsApi } from "@/lib/appSettings";
import { withTimeout } from "@/lib/utils";
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
interface AppSettingUpdateEvent {
  key: string;
  value: string;
}

function Main() {
  const [inputValue, setInputValue] = useState("");
  const [appResults, setAppResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [appIcons, setAppIcons] = useState<Record<string, string | null>>({});
  const [selectedItemValue, setSelectedItemValue] = useState("");
  const [multiplier, setMultiplier] = useState(1);

  const [mode, setMode] = useState<"search" | "chat">("search");
  const [hideOnBlurEnabled, setHideOnBlurEnabled] = useState(true);
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  // Track pagination per session column.
  const [hasMoreByColumn, setHasMoreByColumn] = useState<
    Record<string, boolean>
  >({});
  const [pageOffsetByColumn, setPageOffsetByColumn] = useState<
    Record<string, number>
  >({});
  const PAGE_SIZE = 100;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const modeRef = useRef<"search" | "chat">("search");
  const hideOnBlurRef = useRef(true);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    hideOnBlurRef.current = hideOnBlurEnabled;
  }, [hideOnBlurEnabled]);

  const { providers } = useProviders();
  const sessions = useChatSessions();
  const messages = useChatMessages();

  // Monotonically-increasing turn counter that survives React's async state
  // batching.  getActiveTurns() can return a stale value if React has not yet
  // flushed the setSessions call from a previous send; this ref acts as a local
  // high-water mark so rapid follow-ups always get distinct nextTurns values.
  const pendingTurnsRef = useRef(0);
  const prevSessionIdRef = useRef(sessions.activeSessionId);
  if (prevSessionIdRef.current !== sessions.activeSessionId) {
    prevSessionIdRef.current = sessions.activeSessionId;
    pendingTurnsRef.current = 0;
  }

  const query = useChatQuery({
    appendMessage: messages.append,
    updateMessage: messages.update,
    buildHistory: messages.buildHistory,
    removeLastError: messages.removeLastError,
    updateSessionLocal: sessions.updateSessionLocal,
    persistSessionState: sessions.persistState,
  });

  const providersWithKeys = useMemo(
    () =>
      [...providers]
        .filter((p) => p.has_api_key)
        .sort((a, b) =>
          a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1,
        ),
    [providers],
  );

  const selectableProviders = useMemo(
    () => providersWithKeys.filter((p) => p.is_active),
    [providersWithKeys],
  );

  const maxMultiplier = Math.min(selectableProviders.length, 4);

  const providerById = useMemo(
    () => new Map(providersWithKeys.map((p) => [p.id, p])),
    [providersWithKeys],
  );
  const getProviderLabel = useCallback(
    (providerId: string) => providerById.get(providerId)?.name ?? providerId,
    [providerById],
  );

  const activeChatColumns = useMemo(
    () =>
      sessions.activeSessionColumns
        .map((column) => ({
          column,
          provider: providerById.get(column.providerId) ?? null,
        }))
        .filter(
          (
            item,
          ): item is {
            column: (typeof sessions.activeSessionColumns)[number];
            provider: ProviderView;
          } => item.provider !== null,
        ),
    [sessions.activeSessionColumns, providerById],
  );

  const fetchFreshProviders = useCallback(async (): Promise<ProviderView[]> => {
    try {
      const latest = await withTimeout(
        invoke<ProviderView[]>("list_providers"),
        10_000,
        "list_providers",
      );
      return latest
        .filter((p) => p.has_api_key && p.is_active)
        .sort((a, b) =>
          a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1,
        );
    } catch {
      return selectableProviders;
    }
  }, [selectableProviders]);

  const activeModelCount =
    mode === "chat" ? Math.max(1, activeChatColumns.length) : 1;

  const desiredWindowWidth =
    mode !== "chat"
      ? 900
      : activeModelCount >= 4
        ? 2260
        : activeModelCount === 3
          ? 2120
          : activeModelCount === 2
            ? 1940
            : 1680;

  const desiredWindowHeight = mode === "chat" ? 1200 : 600;
  const prevWindowSizeRef = useRef({
    width: desiredWindowWidth,
    height: desiredWindowHeight,
  });
  const windowResizeFrameRef = useRef<number | null>(null);
  const windowResizeRunRef = useRef(0);

  const cardMaxWidth =
    mode !== "chat"
      ? "max-w-[900px]"
      : activeModelCount >= 4
        ? "max-w-[2260px]"
        : activeModelCount === 3
          ? "max-w-[2120px]"
          : activeModelCount === 2
            ? "max-w-[1940px]"
            : "max-w-[1680px]";

  const hideLauncher = useCallback(async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  }, []);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const results = await invoke<SearchResult[]>("get_suggestions", {
        limit: 8,
      });
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void AppSettingsApi.getAll()
      .then((settings) => {
        if (!cancelled) {
          setHideOnBlurEnabled(settings.hideOnBlur);
          setDefaultSystemPrompt(settings.defaultSystemPrompt);
        }
      })
      .catch((error) => {
        console.error("Failed to load app settings:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<AppSettingUpdateEvent>(
      "app-settings-updated",
      (event) => {
        if (event.payload.key === "hide_on_blur") {
          const normalized = event.payload.value.trim().toLowerCase();
          setHideOnBlurEnabled(
            normalized === "1" || normalized === "true" || normalized === "yes",
          );
          return;
        }
        if (event.payload.key === "default_system_prompt") {
          setDefaultSystemPrompt(event.payload.value);
        }
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      cleanup = await win.onFocusChanged(({ payload: focused }) => {
        if (!focused && modeRef.current === "search" && hideOnBlurRef.current) {
          void win.hide();
        }
      });
    })();
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (windowResizeFrameRef.current !== null) {
      cancelAnimationFrame(windowResizeFrameRef.current);
      windowResizeFrameRef.current = null;
    }
    const runId = windowResizeRunRef.current + 1;
    windowResizeRunRef.current = runId;
    let cancelled = false;
    void (async () => {
      try {
        const {
          getCurrentWindow,
          currentMonitor,
          PhysicalPosition,
          PhysicalSize,
        } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const monitor = await currentMonitor();
        const areaSize = monitor?.workArea?.size ?? monitor?.size;
        const areaPos = monitor?.workArea?.position ?? monitor?.position;

        const maxW = areaSize
          ? Math.max(900, Math.floor(areaSize.width * 0.98))
          : desiredWindowWidth;
        const maxH = areaSize
          ? Math.max(600, Math.floor(areaSize.height * 0.96))
          : desiredWindowHeight;

        const targetW = Math.min(desiredWindowWidth, maxW);
        const targetH = Math.min(desiredWindowHeight, maxH);
        if (cancelled) return;

        const startW = Math.min(prevWindowSizeRef.current.width, maxW);
        const startH = Math.min(prevWindowSizeRef.current.height, maxH);
        const deltaW = targetW - startW;
        const deltaH = targetH - startH;
        const distance = Math.max(Math.abs(deltaW), Math.abs(deltaH));
        const durationMs = distance > 320 ? 140 : 95;
        let lastAppliedW = -1;
        let lastAppliedH = -1;

        const applySize = async (width: number, height: number) => {
          const roundedW = Math.round(width);
          const roundedH = Math.round(height);
          if (roundedW === lastAppliedW && roundedH === lastAppliedH) return;
          lastAppliedW = roundedW;
          lastAppliedH = roundedH;
          prevWindowSizeRef.current = { width: roundedW, height: roundedH };
          await win.setSize(new PhysicalSize(roundedW, roundedH));
          if (cancelled || windowResizeRunRef.current !== runId) return;
          if (areaSize && areaPos) {
            const x = Math.floor(areaPos.x + (areaSize.width - roundedW) / 2);
            const y = Math.floor(
              areaPos.y + (areaSize.height - roundedH) * 0.2,
            );
            await win.setPosition(new PhysicalPosition(x, y));
          }
        };

        if (deltaW === 0 && deltaH === 0) {
          await applySize(targetW, targetH);
          return;
        }

        const startedAt = performance.now();
        const tick = async () => {
          if (cancelled || windowResizeRunRef.current !== runId) {
            windowResizeFrameRef.current = null;
            return;
          }
          const elapsed = performance.now() - startedAt;
          const progress = Math.min(1, elapsed / durationMs);
          const eased = 1 - (1 - progress) * (1 - progress);
          await applySize(startW + deltaW * eased, startH + deltaH * eased);
          if (cancelled || windowResizeRunRef.current !== runId) {
            windowResizeFrameRef.current = null;
            return;
          }
          if (progress < 1) {
            windowResizeFrameRef.current = requestAnimationFrame(() => {
              void tick();
            });
          } else {
            await applySize(targetW, targetH);
            windowResizeFrameRef.current = null;
          }
        };
        windowResizeFrameRef.current = requestAnimationFrame(() => {
          void tick();
        });
      } catch (err) {
        console.error("Failed to resize window:", err);
      }
    })();
    return () => {
      cancelled = true;
      if (windowResizeFrameRef.current !== null) {
        cancelAnimationFrame(windowResizeFrameRef.current);
        windowResizeFrameRef.current = null;
      }
    };
  }, [desiredWindowWidth, desiredWindowHeight]);

  const { loadForSession, clear: clearMessages } = messages;
  const { activeSessionId, activeSessionIdRef, loadSessionColumns } = sessions;

  useEffect(() => {
    if (!activeSessionId) {
      clearMessages();
      setHasMoreByColumn({});
      setPageOffsetByColumn({});
      return;
    }
    void loadForSession(activeSessionId, activeSessionIdRef);
    void loadSessionColumns(activeSessionId);
  }, [
    activeSessionId,
    activeSessionIdRef,
    loadForSession,
    clearMessages,
    loadSessionColumns,
  ]);

  const { selectSession, sessions: sessionsList } = sessions;
  useEffect(() => {
    if (mode !== "chat" || activeSessionId || sessionsList.length === 0) return;
    selectSession(sessionsList[0].id);
  }, [mode, activeSessionId, sessionsList, selectSession]);

  useEffect(() => {
    const unlisten = listen("launcher:opened", () => {
      focusInput();
      if (modeRef.current === "search") void loadSuggestions();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [focusInput, loadSuggestions]);

  const isSearchQuery = mode === "search" && inputValue.trim().length > 0;
  const visibleResults = isSearchQuery ? appResults : suggestions;

  useEffect(() => {
    if (mode !== "search") return;
    const timer = setTimeout(async () => {
      if (isSearchQuery) {
        try {
          setAppResults(
            await invoke<SearchResult[]>("search_apps", { query: inputValue }),
          );
        } catch {
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
    if (mode !== "search" || visibleResults.length === 0) return;
    const pending = visibleResults
      .map((r) => r.app.path)
      .filter((p) => appIcons[p] === undefined);
    if (pending.length === 0) return;
    let cancelled = false;
    void Promise.all(
      pending.map(async (path) => {
        try {
          return [
            path,
            await invoke<string | null>("get_app_icon", { path }),
          ] as const;
        } catch {
          return [path, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setAppIcons((prev) => {
        const next = { ...prev };
        for (const [p, icon] of entries) next[p] = icon;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [appIcons, mode, visibleResults]);

  useEffect(() => {
    if (mode !== "search" || visibleResults.length === 0) return;
    if (!visibleResults.some((r) => r.app.path === selectedItemValue)) {
      setSelectedItemValue(visibleResults[0].app.path);
    }
  }, [mode, selectedItemValue, visibleResults]);

  const { cancelAll, setChatPrompt } = query;
  const { clearSession } = sessions;

  const exitChatToSearch = useCallback(() => {
    cancelAll();
    setChatPrompt("");
    clearMessages();
    clearSession();
    setMode("search");
    setInputValue("");
    setHasMoreByColumn({});
    setPageOffsetByColumn({});
    focusInput();
  }, [cancelAll, setChatPrompt, clearMessages, clearSession, focusInput]);

  const { activeSession } = sessions;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2" && mode === "chat" && activeSession) {
        e.preventDefault();
        setEditingSessionId(activeSession.id);
        setEditingTitle(activeSession.title || "New Session");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (editingSessionId) {
          setEditingSessionId(null);
          return;
        }
        if (mode === "chat") {
          exitChatToSearch();
          return;
        }
        void hideLauncher();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, activeSession, editingSessionId, hideLauncher, exitChatToSearch]);

  const handleSessionSelect = useCallback(
    (id: string) => {
      const target = sessionsList.find((s) => s.id === id);
      if (!target) return;
      if (id === sessions.activeSessionId) return;
      clearMessages();
      selectSession(id);
      query.setChatPrompt(target.prompt);
      setHasMoreByColumn({});
      setPageOffsetByColumn({});
    },
    [
      sessionsList,
      sessions.activeSessionId,
      selectSession,
      query,
      clearMessages,
    ],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      if (id === sessions.activeSessionId) {
        query.cancelAll();
        clearMessages();
        query.setChatPrompt("");
      }
      const nextId = await sessions.deleteSession(id);
      if (nextId) handleSessionSelect(nextId);
    },
    [sessions, query, clearMessages, handleSessionSelect],
  );

  const commitRenameSession = useCallback(
    async (id: string) => {
      if (editingTitle.trim()) {
        await sessions.renameSession(id, editingTitle.trim());
      }
      setEditingSessionId(null);
      setEditingTitle("");
    },
    [sessions, editingTitle],
  );

  const resolveSystemPrompt = useCallback(() => {
    const sessionPrompt = sessions.activeSession?.systemPrompt?.trim();
    if (sessionPrompt) return sessionPrompt;
    const fallback = defaultSystemPrompt.trim();
    return fallback || undefined;
  }, [sessions.activeSession, defaultSystemPrompt]);

  const handleLoadMore = useCallback(
    async (columnId: string) => {
      if (!sessions.activeSessionId) return;
      const currentOffset = pageOffsetByColumn[columnId] ?? 0;
      const newOffset = currentOffset + PAGE_SIZE;
      try {
        const { ChatDb } = await import("@/lib/chatDb");
        const rows = await ChatDb.listMessages(
          sessions.activeSessionId,
          PAGE_SIZE,
          newOffset,
        );
        const filtered = rows.filter(
          (r) => (r.column_id || r.provider_id) === columnId,
        );
        if (filtered.length === 0) {
          setHasMoreByColumn((prev) => ({ ...prev, [columnId]: false }));
          return;
        }
        const mapped = filtered.map((r) => ({
          id: r.id,
          sessionId: r.session_id,
          columnId: r.column_id || r.provider_id,
          providerId: r.provider_id,
          role: r.role as "user" | "assistant",
          content: r.content ?? "",
          status: (r.status === "streaming" || r.status === "error"
            ? r.status
            : "done") as "done" | "error" | "streaming",
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        for (const msg of mapped) messages.append(msg);
        setPageOffsetByColumn((prev) => ({
          ...prev,
          [columnId]: newOffset,
        }));
        setHasMoreByColumn((prev) => ({
          ...prev,
          [columnId]: filtered.length === PAGE_SIZE,
        }));
      } catch (err) {
        console.error("Failed to load more messages:", err);
      }
    },
    [sessions.activeSessionId, pageOffsetByColumn, messages],
  );

  const startChatFromInput = useCallback(async () => {
    const prompt = inputValue.trim();
    if (!prompt) return;
    setMode("chat");
    setInputValue("");

    const available = await fetchFreshProviders();
    const count = Math.max(1, Math.min(multiplier, available.length));
    const selected = available.slice(0, count);
    if (selected.length === 0) {
      setMode("search");
      setInputValue(prompt);
      return;
    }

    let sessionId: string;
    try {
      const session = await sessions.createSession({
        id: createSessionId(),
        title: prompt.slice(0, 50),
        providerIds: selected.map((p) => p.id),
        prompt,
      });
      sessionId = session.id;
    } catch (err) {
      console.error("Failed to create chat session:", err);
      setMode("search");
      setInputValue(prompt);
      return;
    }

    const targets = selected.map((provider, index) => ({
      columnId: `${sessionId}:c${index}`,
      provider,
    }));
    const fallbackSystemPrompt = defaultSystemPrompt.trim() || undefined;
    void query.queryAllColumns(
      prompt,
      targets,
      sessionId,
      1,
      fallbackSystemPrompt,
    );
  }, [
    inputValue,
    multiplier,
    fetchFreshProviders,
    sessions,
    query,
    defaultSystemPrompt,
  ]);

  const startEmptyChatSession = useCallback(async () => {
    setMode("chat");
    const available = await fetchFreshProviders();
    const count = Math.max(1, Math.min(multiplier, available.length));
    const selected = available.slice(0, count);

    try {
      await sessions.createSession({
        id: createSessionId(),
        title: "New Session",
        providerIds: selected.map((p) => p.id),
        prompt: "",
      });
    } catch (err) {
      console.error("Failed to create empty chat session:", err);
      setMode("search");
    }
  }, [multiplier, fetchFreshProviders, sessions]);

  const submitChatFollowUp = useCallback(async () => {
    const prompt = inputValue.trim();
    if (!prompt || !sessions.activeSessionId) return;

    const fallbackProviders = selectableProviders.slice(
      0,
      Math.max(1, Math.min(multiplier, maxMultiplier)),
    );
    const columnSource =
      sessions.activeSessionColumns.length > 0
        ? sessions.activeSessionColumns
        : fallbackProviders.map((provider, index) => ({
            id: `${sessions.activeSessionId}:c${index}`,
            sessionId: sessions.activeSessionId as string,
            position: index,
            providerId: provider.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));

    const targets = columnSource
      .map((column) => ({
        columnId: column.id,
        provider: providerById.get(column.providerId) ?? null,
      }))
      .filter((item) => item.provider !== null)
      .map((item) => ({
        columnId: item.columnId,
        provider: item.provider as ProviderView,
      }));

    if (targets.length === 0) return;

    pendingTurnsRef.current =
      Math.max(pendingTurnsRef.current, sessions.getActiveTurns()) + 1;
    const nextTurns = pendingTurnsRef.current;
    setInputValue("");
    void query.queryAllColumns(
      prompt,
      targets,
      sessions.activeSessionId,
      nextTurns,
      resolveSystemPrompt(),
    );
  }, [
    inputValue,
    sessions,
    selectableProviders,
    multiplier,
    maxMultiplier,
    query,
    resolveSystemPrompt,
    providerById,
  ]);

  const submitProviderFollowUp = useCallback(
    async (columnId: string, provider: ProviderView, prompt: string) => {
      if (!sessions.activeSessionId) return;
      pendingTurnsRef.current =
        Math.max(pendingTurnsRef.current, sessions.getActiveTurns()) + 1;
      const nextTurns = pendingTurnsRef.current;
      const allIds =
        sessions.activeSessionColumns.length > 0
          ? sessions.activeSessionColumns.map((column) => column.providerId)
          : [provider.id];
      void query.queryOneColumn(
        prompt,
        columnId,
        provider,
        sessions.activeSessionId,
        nextTurns,
        allIds,
        resolveSystemPrompt(),
      );
    },
    [sessions, query, resolveSystemPrompt],
  );

  const handleColumnProviderChange = useCallback(
    async (columnId: string, providerId: string) => {
      if (!providerById.has(providerId)) return;
      await sessions.setColumnProvider(columnId, providerId);
    },
    [providerById, sessions],
  );

  const handleAppSelect = useCallback(
    async (app: AppInfo) => {
      try {
        await invoke("launch_app", { path: app.path });
        if (!isSearchQuery) void loadSuggestions();
        void hideLauncher();
      } catch (err) {
        console.error("Failed to launch app:", err);
      }
    },
    [hideLauncher, isSearchQuery, loadSuggestions],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <main className="desktop-canvas relative z-10 w-full px-8 pointer-events-auto">
        <div
          className={`w-full ${cardMaxWidth} transform-gpu transition-[max-width] duration-180 ease-out`}
        >
          <Command
            className={`vercel-launcher-container bg-bg-main border border-border-gray rounded-xl overflow-hidden flex flex-col ${
              mode === "chat" ? "h-[1000px] max-h-[calc(100vh-48px)]" : ""
            }`}
            shouldFilter={false}
            value={selectedItemValue}
            onValueChange={setSelectedItemValue}
          >
            <CommandInput
              placeholder={
                mode === "chat"
                  ? "Ask follow-up... (Enter to send, Esc for app search)"
                  : "Search apps or ask AI (Tab to chat)"
              }
              ref={inputRef}
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (mode === "chat") exitChatToSearch();
                  else void hideLauncher();
                  return;
                }
                if (e.key === "Tab" && mode === "search") {
                  e.preventDefault();
                  if (inputValue.trim()) void startChatFromInput();
                  else void startEmptyChatSession();
                  return;
                }
                if (e.key === "Tab" && mode === "chat" && !inputValue.trim()) {
                  e.preventDefault();
                  void startEmptyChatSession();
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (mode === "chat") {
                    void submitChatFollowUp();
                    return;
                  }
                  if (visibleResults.length > 0) {
                    const selected =
                      visibleResults.find(
                        (r) => r.app.path === selectedItemValue,
                      ) ?? visibleResults[0];
                    void handleAppSelect(selected.app);
                  }
                }
              }}
              autoFocus
            />

            <div
              className={`border-t border-border-gray ${
                mode === "chat" ? "flex-1 min-h-0 flex flex-col" : ""
              }`}
            >
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
                <div className="bg-white flex-1 min-h-0 flex overflow-hidden">
                  {/* Session sidebar */}
                  <ChatSidebar
                    sessions={sessions.sessions}
                    activeSessionId={sessions.activeSessionId}
                    editingSessionId={editingSessionId}
                    editingTitle={editingTitle}
                    onSelect={handleSessionSelect}
                    onNewSession={() => void startEmptyChatSession()}
                    onBeginRename={(s) => {
                      setEditingSessionId(s.id);
                      setEditingTitle(s.title || "New Session");
                    }}
                    onCommitRename={(id) => void commitRenameSession(id)}
                    onCancelRename={() => setEditingSessionId(null)}
                    onEditingTitleChange={setEditingTitle}
                    onDelete={(id) => void handleDeleteSession(id)}
                    onSearchResultSelect={handleSessionSelect}
                  />

                  {/* Provider columns */}
                  <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <div className="px-5 py-2.5 bg-[#FAFAFA] border-b border-border-gray flex items-center justify-between shrink-0">
                      <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em]">
                        Model Responses
                      </span>
                      <div className="flex items-center gap-3">
                        {query.chatPrompt && query.isBroadcastPrompt && (
                          <span className="text-[11px] text-text-secondary truncate max-w-[40%]">
                            {query.chatPrompt}
                          </span>
                        )}
                      </div>
                    </div>

                    {!sessions.activeSession ? (
                      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                        Create a session to start multi-model chat.
                      </div>
                    ) : activeChatColumns.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                        No providers with API keys. Add API keys in Settings.
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0 flex overflow-x-auto">
                        {activeChatColumns.map(({ column, provider }) => (
                          <ChatProviderColumn
                            key={column.id}
                            columnId={column.id}
                            provider={provider}
                            selectedProviderId={column.providerId}
                            availableProviders={selectableProviders}
                            messages={messages.getColumnMessages(column.id)}
                            isTruncated={messages.isTruncated(column.id)}
                            hasMore={hasMoreByColumn[column.id]}
                            onLoadMore={() => void handleLoadMore(column.id)}
                            onProviderChange={(columnId, providerId) =>
                              void handleColumnProviderChange(
                                columnId,
                                providerId,
                              )
                            }
                            onFollowUpSubmit={(prompt) =>
                              void submitProviderFollowUp(
                                column.id,
                                provider,
                                prompt,
                              )
                            }
                            onRetry={(prompt) =>
                              sessions.activeSessionId
                                ? query.retryColumn(
                                    column.id,
                                    provider,
                                    prompt,
                                    sessions.activeSessionId,
                                    sessions.activeSession?.turns ?? 0,
                                    sessions.activeSessionColumns.map(
                                      (item) => item.providerId,
                                    ),
                                    sessions.activeSession?.systemPrompt,
                                  )
                                : undefined
                            }
                            onDeleteMessage={(msgId) =>
                              void messages.deleteMessage(column.id, msgId)
                            }
                            getProviderLabel={getProviderLabel}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border-gray bg-[#FAFAFA] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-5">
                {mode === "search" ? (
                  <>
                    <Kbd label="ENTER" hint="select" />
                    <Kbd label="TAB" hint="chat" />
                    <Kbd label="ESC" hint="close" />
                  </>
                ) : (
                  <>
                    <Kbd label="ENTER" hint="send follow-up" />
                    <Kbd label="TAB" hint="new session" />
                    <Kbd label="F2" hint="rename session" />
                    <Kbd label="ESC" hint="app search" />
                  </>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      query.isRunning ? "bg-amber-500" : "bg-green-500"
                    }`}
                  />
                  <span className="text-[12px] text-text-secondary font-medium">
                    {query.isRunning ? "AI Generating..." : "AI Online"}
                  </span>
                </div>

                {maxMultiplier > 1 && (
                  <>
                    <div className="h-3 w-px bg-border-gray" />
                    <button
                      type="button"
                      onClick={() =>
                        setMultiplier((prev) =>
                          prev >= maxMultiplier ? 1 : prev + 1,
                        )
                      }
                      title={`Query ${multiplier} model${multiplier > 1 ? "s" : ""} simultaneously`}
                      className="px-2 py-0.5 rounded border border-border-gray bg-white text-[11px] font-bold text-text-secondary hover:border-black hover:text-black transition-colors"
                    >
                      {multiplier}x
                    </button>
                  </>
                )}

                <div className="h-3 w-px bg-border-gray" />

                <button
                  type="button"
                  className="flex items-center gap-1.5 text-text-secondary hover:text-black transition-colors group bg-transparent border-0 p-0 cursor-pointer"
                  onClick={async () => {
                    const { Window } = await import("@tauri-apps/api/window");
                    const w = new Window("settings");
                    await w.show();
                    await w.setFocus();
                  }}
                >
                  <span className="material-symbols-outlined text-[16px] group-hover:text-black">
                    settings
                  </span>
                  <span className="text-[12px] font-medium">Settings</span>
                </button>
              </div>
            </div>
          </Command>
        </div>
      </main>
    </div>
  );
}

function Kbd({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
        {label}
      </kbd>
      <span className="text-[12px] text-text-secondary">{hint}</span>
    </div>
  );
}

export default Main;
