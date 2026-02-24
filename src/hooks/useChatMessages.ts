import { useCallback, useMemo, useRef, useState } from "react";
import { ChatDb } from "../lib/chatDb";
import type {
  ChatMessage,
  ChatMessageRole,
  ChatMessageStatus,
  DbChatMessageRecord,
  ProviderHistoryMessage,
} from "../types/chat";

const CHARS_PER_TOKEN = 3;
const MAX_CONTEXT_TOKENS = 8_000;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

function trimToTokenBudget(
  msgs: ProviderHistoryMessage[],
): ProviderHistoryMessage[] {
  let chars = 0;
  const result: ProviderHistoryMessage[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    chars += msgs[i].content.length;
    if (chars > MAX_CONTEXT_CHARS) break;
    result.unshift(msgs[i]);
  }
  return result;
}

export function createMessageId(): string {
  return crypto.randomUUID();
}

let lastTs = 0;
export function monotonicNow(): number {
  const now = Date.now();
  lastTs = now > lastTs ? now : lastTs + 1;
  return lastTs;
}

function mapDbMessage(r: DbChatMessageRecord): ChatMessage {
  const role: ChatMessageRole = r.role === "assistant" ? "assistant" : "user";
  const status: ChatMessageStatus =
    r.status === "streaming" || r.status === "error" ? r.status : "done";
  return {
    id: r.id,
    sessionId: r.session_id,
    columnId: r.column_id || r.provider_id,
    providerId: r.provider_id,
    role,
    content: r.content ?? "",
    status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface UseChatMessagesReturn {
  messagesByColumn: Record<string, ChatMessage[]>;
  messagesRef: React.MutableRefObject<Record<string, ChatMessage[]>>;
  getColumnMessages: (columnId: string) => ChatMessage[];
  buildHistory: (
    columnId: string,
    systemPrompt?: string,
  ) => ProviderHistoryMessage[];
  isTruncated: (columnId: string) => boolean;
  append: (msg: ChatMessage) => void;
  update: (
    columnId: string,
    msgId: string,
    updater: (m: ChatMessage) => ChatMessage,
  ) => void;
  removeLastError: (columnId: string) => string | null;
  deleteMessage: (columnId: string, msgId: string) => Promise<void>;
  loadForSession: (
    sessionId: string,
    activeSessionIdRef: React.MutableRefObject<string | null>,
  ) => Promise<void>;
  clear: () => void;
}

export function useChatMessages(): UseChatMessagesReturn {
  const [messagesByColumn, setMessagesByColumn] = useState<
    Record<string, ChatMessage[]>
  >({});
  const messagesRef = useRef<Record<string, ChatMessage[]>>({});

  const setMessages = useCallback(
    (
      updater:
        | Record<string, ChatMessage[]>
        | ((
            prev: Record<string, ChatMessage[]>,
          ) => Record<string, ChatMessage[]>),
    ) => {
      setMessagesByColumn((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  const append = useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => {
        const existing = prev[msg.columnId] ?? [];
        return { ...prev, [msg.columnId]: [...existing, msg] };
      });
    },
    [setMessages],
  );

  const update = useCallback(
    (
      columnId: string,
      msgId: string,
      updater: (m: ChatMessage) => ChatMessage,
    ) => {
      setMessages((prev) => {
        const msgs = prev[columnId] ?? [];
        return {
          ...prev,
          [columnId]: msgs.map((m) => (m.id === msgId ? updater(m) : m)),
        };
      });
    },
    [setMessages],
  );

  const clear = useCallback(() => {
    setMessages({});
  }, [setMessages]);

  const removeLastError = useCallback(
    (columnId: string): string | null => {
      let removedId: string | null = null;
      setMessages((prev) => {
        const msgs = prev[columnId] ?? [];
        const idx = [...msgs].reverse().findIndex((m) => m.status === "error");
        if (idx === -1) return prev;
        const actualIdx = msgs.length - 1 - idx;
        removedId = msgs[actualIdx].id;
        return { ...prev, [columnId]: msgs.filter((_, i) => i !== actualIdx) };
      });
      return removedId;
    },
    [setMessages],
  );

  const deleteMessage = useCallback(
    async (columnId: string, msgId: string) => {
      setMessages((prev) => {
        const msgs = prev[columnId] ?? [];
        return { ...prev, [columnId]: msgs.filter((m) => m.id !== msgId) };
      });
      try {
        await ChatDb.deleteMessage(msgId);
      } catch (err) {
        console.error("Failed to delete message:", err);
      }
    },
    [setMessages],
  );

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
          if (!next[msg.columnId]) next[msg.columnId] = [];
          next[msg.columnId].push(msg);
        }

        const current = messagesRef.current;
        if (Object.keys(current).length === 0) {
          setMessages(next);
          return;
        }

        const merged: Record<string, ChatMessage[]> = { ...current };
        for (const [columnId, persisted] of Object.entries(next)) {
          const byId = new Map<string, ChatMessage>();
          for (const m of persisted) byId.set(m.id, m);
          for (const m of merged[columnId] ?? []) {
            const existing = byId.get(m.id);
            if (!existing || m.updatedAt >= existing.updatedAt) {
              byId.set(m.id, m);
            }
          }
          merged[columnId] = Array.from(byId.values()).sort(
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

  const columnMessagesCache = useMemo(() => {
    const cache = new Map<string, ChatMessage[]>();
    for (const [columnId, msgs] of Object.entries(messagesByColumn)) {
      cache.set(
        columnId,
        [...msgs].sort((a, b) => a.createdAt - b.createdAt),
      );
    }
    return cache;
  }, [messagesByColumn]);

  const getColumnMessages = useCallback(
    (columnId: string): ChatMessage[] => {
      return columnMessagesCache.get(columnId) ?? [];
    },
    [columnMessagesCache],
  );

  const buildHistory = useCallback(
    (columnId: string, systemPrompt?: string): ProviderHistoryMessage[] => {
      const msgs = messagesRef.current[columnId] ?? [];
      const conversation = msgs
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            m.status === "done" &&
            m.content.trim().length > 0,
        )
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const trimmed = trimToTokenBudget(conversation);
      if (systemPrompt?.trim()) {
        return [{ role: "system", content: systemPrompt.trim() }, ...trimmed];
      }
      return trimmed;
    },
    [],
  );

  const isTruncated = useCallback((columnId: string): boolean => {
    const msgs = messagesRef.current[columnId] ?? [];
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
    messagesByColumn,
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
