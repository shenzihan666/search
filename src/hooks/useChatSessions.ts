/**
 * useChatSessions — manages the session list, active selection, and DB persistence.
 *
 * Changes from previous version:
 *   P1  — panes no longer stored in DB or in session state.
 *   P2  — turns is derived from DB message count at read time; not hand-maintained.
 *   P6  — createSessionId uses crypto.randomUUID().
 *   P8  — ChatSession gains systemPrompt; setSystemPrompt action added.
 *   P14 — deleteSession only removes UI state after DB deletion succeeds.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatDb } from "../lib/chatDb";
import type { ChatSession, DbChatSessionRecord } from "../types/chat";

// ─── Mappers ────────────────────────────────────────────────────────────────

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

// ─── ID helpers ──────────────────────────────────────────────────────────────

/** P6: Use cryptographically random UUIDs. */
export function createSessionId(): string {
  return crypto.randomUUID();
}

// ─── Hook ────────────────────────────────────────────────────────────────────

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
  activeSessionIdRef: React.MutableRefObject<string | null>;
  /**
   * P2: Returns the current turns count for the active session synchronously.
   * Reads from sessionsRef so it's always up-to-date even across rapid
   * state updates.
   */
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
  /** P14: Deletes a session from DB first, then from UI. Returns next active id or null. */
  deleteSession: (id: string) => Promise<string | null>;
  persistState: (
    id: string,
    providerIds: string[],
    prompt: string,
  ) => Promise<void>;
  setSystemPrompt: (id: string, systemPrompt: string) => Promise<void>;
  reload: () => Promise<void>;
}

function sortByUpdated(arr: ChatSession[]): ChatSession[] {
  return [...arr].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useChatSessions(): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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

  // ── Load from DB on mount ──────────────────────────────────────────────────

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

  // ── P2: Read turns synchronously from ref ─────────────────────────────────

  const getActiveTurns = useCallback((): number => {
    const id = activeSessionIdRef.current;
    if (!id) return 0;
    return sessionsRef.current.find((s) => s.id === id)?.turns ?? 0;
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const clearSession = useCallback(() => {
    setActiveSessionId(null);
  }, []);

  const updateSessionLocal = useCallback(
    (id: string, updater: (s: ChatSession) => ChatSession, fallback?: ChatSession) => {
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

  const createSession = useCallback(
    async (params: CreateSessionParams): Promise<ChatSession> => {
      try {
        const saved = await ChatDb.createSession(
          params.id,
          params.title || "New Session",
          params.providerIds,
        );
        const persisted = mapDbSession(saved);
        const session: ChatSession = {
          ...persisted,
          prompt: params.prompt,
        };
        setSessions((prev) =>
          sortByUpdated([session, ...prev.filter((s) => s.id !== session.id)]),
        );
        setActiveSessionId(session.id);
        return session;
      } catch (err) {
        console.error("Failed to persist new session:", err);
        throw err instanceof Error
          ? err
          : new Error(`Failed to persist new session: ${String(err)}`);
      }
    },
    [],
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

  /**
   * P14: DB deletion happens first. UI state is only updated on success.
   * Returns the new active session id (or null) when deleting the active session.
   */
  const deleteSession = useCallback(async (id: string): Promise<string | null> => {
    try {
      await ChatDb.deleteSession(id);
    } catch (err) {
      console.error("Failed to delete session:", err);
      // Do NOT update UI state — deletion failed, session should remain visible.
      return null;
    }

    const currentActiveId = activeSessionIdRef.current;
    const remaining = sessionsRef.current.filter((s) => s.id !== id);
    const isDeletingActive = currentActiveId === id;
    const nextActiveId = isDeletingActive ? (remaining[0]?.id ?? null) : currentActiveId;

    setSessions(remaining);
    setActiveSessionId(nextActiveId);

    return isDeletingActive ? nextActiveId : null;
  }, []);

  /**
   * P1+P2: Only persists provider list and last prompt.
   * panes and turns are derived at read time — not stored.
   */
  const persistState = useCallback(
    async (id: string, providerIds: string[], prompt: string) => {
      try {
        await ChatDb.saveSessionState(id, providerIds, prompt);
      } catch (err) {
        console.error("Failed to persist session state:", err);
      }
    },
    [],
  );

  /** P8: Update the system prompt for a session. */
  const setSystemPrompt = useCallback(
    async (id: string, systemPrompt: string) => {
      try {
        const saved = await ChatDb.setSystemPrompt(id, systemPrompt);
        updateSessionLocal(id, (s) => ({ ...s, systemPrompt: saved.system_prompt }));
      } catch (err) {
        console.error("Failed to set system prompt:", err);
      }
    },
    [updateSessionLocal],
  );

  return {
    sessions,
    activeSessionId,
    activeSession,
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
    reload,
  };
}
