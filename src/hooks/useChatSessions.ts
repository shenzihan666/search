import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatDb } from "../lib/chatDb";
import type {
  ChatSession,
  ChatSessionColumn,
  DbChatSessionColumnRecord,
  DbChatSessionRecord,
} from "../types/chat";

export function mapDbSession(r: DbChatSessionRecord): ChatSession {
  return {
    id: r.id,
    title: r.title || "New Session",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    providerIds: Array.isArray(r.provider_ids) ? r.provider_ids : [],
    prompt: r.prompt ?? "",
    systemPrompt: r.system_prompt ?? "",
    turns: typeof r.turns === "number" ? r.turns : 0,
  };
}

function mapDbSessionColumn(r: DbChatSessionColumnRecord): ChatSessionColumn {
  return {
    id: r.id,
    sessionId: r.session_id,
    position: r.position,
    providerId: r.provider_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export interface CreateSessionParams {
  id: string;
  title: string;
  providerIds: string[];
  prompt: string;
}

export interface UseChatSessionsReturn {
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  activeSessionColumns: ChatSessionColumn[];
  activeSessionIdRef: React.MutableRefObject<string | null>;
  getActiveTurns: () => number;
  selectSession: (id: string) => void;
  clearSession: () => void;
  createSession: (params: CreateSessionParams) => Promise<ChatSession>;
  updateSessionLocal: (
    id: string,
    updater: (s: ChatSession) => ChatSession,
    fallback?: ChatSession,
  ) => void;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<string | null>;
  persistState: (
    id: string,
    providerIds: string[],
    prompt: string,
  ) => Promise<void>;
  setSystemPrompt: (id: string, systemPrompt: string) => Promise<void>;
  loadSessionColumns: (sessionId: string) => Promise<ChatSessionColumn[]>;
  setColumnProvider: (
    columnId: string,
    providerId: string,
  ) => Promise<ChatSessionColumn | null>;
  reload: () => Promise<void>;
}

function sortByUpdated(arr: ChatSession[]): ChatSession[] {
  return [...arr].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useChatSessions(): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionColumns, setActiveSessionColumns] = useState<
    ChatSessionColumn[]
  >([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionsRef = useRef<ChatSession[]>([]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const reload = useCallback(async () => {
    try {
      const rows = await ChatDb.listSessions();
      setSessions(sortByUpdated(rows.map(mapDbSession)));
    } catch (err) {
      console.error("Failed to load chat sessions:", err);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const getActiveTurns = useCallback((): number => {
    const id = activeSessionIdRef.current;
    if (!id) return 0;
    return sessionsRef.current.find((s) => s.id === id)?.turns ?? 0;
  }, []);

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setActiveSessionColumns([]);
  }, []);

  const clearSession = useCallback(() => {
    setActiveSessionId(null);
    setActiveSessionColumns([]);
  }, []);

  const updateSessionLocal = useCallback(
    (
      id: string,
      updater: (s: ChatSession) => ChatSession,
      fallback?: ChatSession,
    ) => {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx === -1) {
          if (!fallback) return prev;
          return sortByUpdated([fallback, ...prev]);
        }
        const next = [...prev];
        next[idx] = updater(next[idx]);
        return sortByUpdated(next);
      });
    },
    [],
  );

  const loadSessionColumns = useCallback(
    async (sessionId: string): Promise<ChatSessionColumn[]> => {
      try {
        const rows = await ChatDb.listSessionColumns(sessionId);
        const columns = rows
          .map(mapDbSessionColumn)
          .sort((a, b) => a.position - b.position);
        if (activeSessionIdRef.current === sessionId) {
          setActiveSessionColumns(columns);
        }
        return columns;
      } catch (err) {
        console.error("Failed to load session columns:", err);
        if (activeSessionIdRef.current === sessionId) {
          setActiveSessionColumns([]);
        }
        return [];
      }
    },
    [],
  );

  const createSession = useCallback(
    async (params: CreateSessionParams): Promise<ChatSession> => {
      try {
        const saved = await ChatDb.createSession(
          params.id,
          params.title || "New Session",
          params.providerIds,
        );
        const persisted = mapDbSession(saved);
        const session: ChatSession = { ...persisted, prompt: params.prompt };
        setSessions((prev) =>
          sortByUpdated([session, ...prev.filter((s) => s.id !== session.id)]),
        );
        setActiveSessionId(session.id);
        activeSessionIdRef.current = session.id;
        await loadSessionColumns(session.id);
        return session;
      } catch (err) {
        console.error("Failed to persist new session:", err);
        throw err instanceof Error
          ? err
          : new Error(`Failed to persist new session: ${String(err)}`);
      }
    },
    [loadSessionColumns],
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      try {
        const saved = await ChatDb.renameSession(id, title);
        updateSessionLocal(id, (s) => ({ ...s, ...mapDbSession(saved) }));
      } catch (err) {
        console.error("Failed to rename session:", err);
      }
    },
    [updateSessionLocal],
  );

  const deleteSession = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        await ChatDb.deleteSession(id);
      } catch (err) {
        console.error("Failed to delete session:", err);
        return null;
      }

      const currentActiveId = activeSessionIdRef.current;
      const remaining = sessionsRef.current.filter((s) => s.id !== id);
      const isDeletingActive = currentActiveId === id;
      const nextActiveId = isDeletingActive
        ? (remaining[0]?.id ?? null)
        : currentActiveId;

      setSessions(remaining);
      setActiveSessionId(nextActiveId);
      activeSessionIdRef.current = nextActiveId;
      if (isDeletingActive) {
        setActiveSessionColumns([]);
      }

      return isDeletingActive ? nextActiveId : null;
    },
    [],
  );

  const persistState = useCallback(
    async (id: string, providerIds: string[], prompt: string) => {
      try {
        await ChatDb.saveSessionState(id, providerIds, prompt);
        updateSessionLocal(id, (s) => ({
          ...s,
          providerIds: [...providerIds],
          prompt,
          updatedAt: Date.now(),
        }));
        if (activeSessionIdRef.current === id) {
          await loadSessionColumns(id);
        }
      } catch (err) {
        console.error("Failed to persist session state:", err);
      }
    },
    [loadSessionColumns, updateSessionLocal],
  );

  const setSystemPrompt = useCallback(
    async (id: string, systemPrompt: string) => {
      try {
        const saved = await ChatDb.setSystemPrompt(id, systemPrompt);
        updateSessionLocal(id, (s) => ({
          ...s,
          systemPrompt: saved.system_prompt,
        }));
      } catch (err) {
        console.error("Failed to set system prompt:", err);
      }
    },
    [updateSessionLocal],
  );

  const setColumnProvider = useCallback(
    async (
      columnId: string,
      providerId: string,
    ): Promise<ChatSessionColumn | null> => {
      try {
        const saved = await ChatDb.setSessionColumnProvider(
          columnId,
          providerId,
        );
        const mapped = mapDbSessionColumn(saved);
        setActiveSessionColumns((prev) =>
          prev
            .map((col) => (col.id === mapped.id ? mapped : col))
            .sort((a, b) => a.position - b.position),
        );
        updateSessionLocal(mapped.sessionId, (s) => {
          const providerIds = [...s.providerIds];
          while (providerIds.length <= mapped.position) {
            providerIds.push("");
          }
          providerIds[mapped.position] = mapped.providerId;
          return {
            ...s,
            providerIds,
            updatedAt: mapped.updatedAt,
          };
        });
        return mapped;
      } catch (err) {
        console.error("Failed to set column provider:", err);
        return null;
      }
    },
    [updateSessionLocal],
  );

  return {
    sessions,
    activeSessionId,
    activeSession,
    activeSessionColumns,
    activeSessionIdRef,
    getActiveTurns,
    selectSession,
    clearSession,
    createSession,
    updateSessionLocal,
    renameSession,
    deleteSession,
    persistState,
    setSystemPrompt,
    loadSessionColumns,
    setColumnProvider,
    reload,
  };
}
