/**
 * useChatMessages — owns all message state and the conversation-history builder.
 *
 * Changes from previous version:
 *   P4  — No more shared "" providerId bucket. Each provider owns its full
 *         message chain. getColumnMessages / buildHistory are now simple
 *         single-provider lookups — no merge needed.
 *   P6  — createMessageId uses crypto.randomUUID().
 *   P7  — buildHistory uses a character-budget trim instead of a hard
 *         24-message cap.
 *   P3  — mapDbMessage preserves DB status ("streaming" | "error" | "done")
 *         so in-flight background requests remain visible when revisiting a session.
 *   P12 — loadForSession merge prefers the message with the higher updatedAt
 *         (Last-Write-Wins) instead of always preferring in-memory.
 *   P11 — deleteMessage removes a message from state and DB.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { ChatDb } from "../lib/chatDb";
import type {
  ChatMessage,
  ChatMessageRole,
  ChatMessageStatus,
  DbChatMessageRecord,
  ProviderHistoryMessage,
} from "../types/chat";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * P7: Token budget for conversation history sent to the LLM.
 * ~3 chars per token (conservative average across English + CJK).
 * 8 000 tokens keeps us comfortably inside every common context window.
 */
const CHARS_PER_TOKEN = 3;
const MAX_CONTEXT_TOKENS = 8_000;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

function trimToTokenBudget(msgs: ProviderHistoryMessage[]): ProviderHistoryMessage[] {
  let chars = 0;
  const result: ProviderHistoryMessage[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    chars += msgs[i].content.length;
    if (chars > MAX_CONTEXT_CHARS) break;
    result.unshift(msgs[i]);
  }
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** P6: Use the browser's cryptographic UUID generator. */
export function createMessageId(): string {
  return crypto.randomUUID();
}

/**
 * Monotonic timestamp — stays > any previously returned value even when
 * multiple messages are created within the same millisecond.
 */
let _lastTs = 0;
export function monotonicNow(): number {
  const now = Date.now();
  _lastTs = now > _lastTs ? now : _lastTs + 1;
  return _lastTs;
}

function mapDbMessage(r: DbChatMessageRecord): ChatMessage {
  const role: ChatMessageRole = r.role === "assistant" ? "assistant" : "user";
  const status: ChatMessageStatus =
    r.status === "streaming" || r.status === "error" ? r.status : "done";
  return {
    id: r.id,
    sessionId: r.session_id,
    providerId: r.provider_id,
    role,
    content: r.content ?? "",
    status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseChatMessagesReturn {
  messagesByProvider: Record<string, ChatMessage[]>;
  messagesRef: React.MutableRefObject<Record<string, ChatMessage[]>>;
  /** Returns provider-specific messages sorted by createdAt. */
  getColumnMessages: (providerId: string) => ChatMessage[];
  /**
   * Builds the conversation history array passed to the LLM.
   * Scoped to a single provider. Trims to MAX_CONTEXT_CHARS budget.
   */
  buildHistory: (providerId: string, systemPrompt?: string) => ProviderHistoryMessage[];
  /** True when the total character length for this provider exceeds the budget. */
  isTruncated: (providerId: string) => boolean;
  append: (msg: ChatMessage) => void;
  update: (
    providerId: string,
    msgId: string,
    updater: (m: ChatMessage) => ChatMessage,
  ) => void;
  removeLastError: (providerId: string) => string | null;
  deleteMessage: (providerId: string, msgId: string) => Promise<void>;
  loadForSession: (
    sessionId: string,
    activeSessionIdRef: React.MutableRefObject<string | null>,
  ) => Promise<void>;
  clear: () => void;
}

export function useChatMessages(): UseChatMessagesReturn {
  const [messagesByProvider, setMessagesByProvider] = useState<
    Record<string, ChatMessage[]>
  >({});
  const messagesRef = useRef<Record<string, ChatMessage[]>>({});

  const setMessages = useCallback(
    (
      updater:
        | Record<string, ChatMessage[]>
        | ((prev: Record<string, ChatMessage[]>) => Record<string, ChatMessage[]>),
    ) => {
      setMessagesByProvider((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const append = useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => {
        const existing = prev[msg.providerId] ?? [];
        return { ...prev, [msg.providerId]: [...existing, msg] };
      });
    },
    [setMessages],
  );

  const update = useCallback(
    (providerId: string, msgId: string, updater: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const msgs = prev[providerId] ?? [];
        return {
          ...prev,
          [providerId]: msgs.map((m) => (m.id === msgId ? updater(m) : m)),
        };
      });
    },
    [setMessages],
  );

  const clear = useCallback(() => {
    setMessages({});
  }, [setMessages]);

  const removeLastError = useCallback(
    (providerId: string): string | null => {
      let removedId: string | null = null;
      setMessages((prev) => {
        const msgs = prev[providerId] ?? [];
        const idx = [...msgs].reverse().findIndex((m) => m.status === "error");
        if (idx === -1) return prev;
        const actualIdx = msgs.length - 1 - idx;
        removedId = msgs[actualIdx].id;
        return { ...prev, [providerId]: msgs.filter((_, i) => i !== actualIdx) };
      });
      return removedId;
    },
    [setMessages],
  );

  /** P11: Remove a message from state and from the DB. */
  const deleteMessage = useCallback(
    async (providerId: string, msgId: string) => {
      setMessages((prev) => {
        const msgs = prev[providerId] ?? [];
        return { ...prev, [providerId]: msgs.filter((m) => m.id !== msgId) };
      });
      try {
        await ChatDb.deleteMessage(msgId);
      } catch (err) {
        console.error("Failed to delete message:", err);
      }
    },
    [setMessages],
  );

  // ── DB load ───────────────────────────────────────────────────────────────

  const loadForSession = useCallback(
    async (
      sessionId: string,
      activeSessionIdRef: React.MutableRefObject<string | null>,
    ) => {
      try {
        const rows = await ChatDb.listMessages(sessionId);
        if (activeSessionIdRef.current !== sessionId) return;

        const next: Record<string, ChatMessage[]> = {};
        for (const row of rows) {
          const msg = mapDbMessage(row);
          (next[msg.providerId] ??= []).push(msg);
        }

        const current = messagesRef.current;
        if (Object.keys(current).length === 0) {
          setMessages(next);
          return;
        }

        // P12: Merge with Last-Write-Wins on updatedAt.
        // DB records are loaded first; in-memory records override only when
        // their updatedAt is >= the persisted version (streaming state wins).
        const merged: Record<string, ChatMessage[]> = { ...current };
        for (const [pid, persisted] of Object.entries(next)) {
          const byId = new Map<string, ChatMessage>();
          for (const m of persisted) byId.set(m.id, m);
          for (const m of merged[pid] ?? []) {
            const existing = byId.get(m.id);
            if (!existing || m.updatedAt >= existing.updatedAt) {
              byId.set(m.id, m);
            }
          }
          merged[pid] = Array.from(byId.values()).sort(
            (a, b) => a.createdAt - b.createdAt,
          );
        }
        setMessages(merged);
      } catch (err) {
        if (activeSessionIdRef.current !== sessionId) return;
        console.error("Failed to load messages:", err);
        setMessages({});
      }
    },
    [setMessages],
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  /**
   * P4: No merge with a shared "" bucket needed anymore.
   * Each provider holds its own complete message chain.
   */
  const columnMessagesCache = useMemo(() => {
    const cache = new Map<string, ChatMessage[]>();
    for (const [pid, msgs] of Object.entries(messagesByProvider)) {
      cache.set(pid, [...msgs].sort((a, b) => a.createdAt - b.createdAt));
    }
    return cache;
  }, [messagesByProvider]);

  const getColumnMessages = useCallback(
    (providerId: string): ChatMessage[] => {
      return columnMessagesCache.get(providerId) ?? [];
    },
    [columnMessagesCache],
  );

  /**
   * P7: Build LLM context for a provider. Trims to MAX_CONTEXT_CHARS budget.
   * P8: Prepends system prompt when provided.
   * Uses ref (not state) so it's safe inside async callbacks.
   * Excludes error and streaming messages from history.
   */
  const buildHistory = useCallback(
    (providerId: string, systemPrompt?: string): ProviderHistoryMessage[] => {
      const msgs = messagesRef.current[providerId] ?? [];
      const conversation = msgs
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            m.status === "done" &&
            m.content.trim().length > 0,
        )
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const trimmed = trimToTokenBudget(conversation);

      if (systemPrompt?.trim()) {
        return [{ role: "system", content: systemPrompt.trim() }, ...trimmed];
      }
      return trimmed;
    },
    [],
  );

  /** P7: whether context was trimmed for this provider by character budget. */
  const isTruncated = useCallback((providerId: string): boolean => {
    const msgs = messagesRef.current[providerId] ?? [];
    const total = msgs
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          m.status === "done" &&
          m.content.trim().length > 0,
      )
      .reduce((sum, m) => sum + m.content.length, 0);
    return total > MAX_CONTEXT_CHARS;
  }, []);

  return {
    messagesByProvider,
    messagesRef,
    getColumnMessages,
    buildHistory,
    isTruncated,
    append,
    update,
    removeLastError,
    deleteMessage,
    loadForSession,
    clear,
  };
}
