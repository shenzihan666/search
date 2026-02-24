import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatDb } from "../lib/chatDb";
import { withTimeout } from "../lib/utils";
import type {
  ChatMessage,
  ChatSession,
  ProviderHistoryMessage,
} from "../types/chat";
import type { ProviderView } from "../types/provider";
import { createMessageId, monotonicNow } from "./useChatMessages";

export interface ChatQueryColumnTarget {
  columnId: string;
  provider: ProviderView;
}

export interface ChatQueryDeps {
  appendMessage: (msg: ChatMessage) => void;
  updateMessage: (
    columnId: string,
    msgId: string,
    updater: (m: ChatMessage) => ChatMessage,
  ) => void;
  buildHistory: (
    columnId: string,
    systemPrompt?: string,
  ) => ProviderHistoryMessage[];
  removeLastError: (columnId: string) => string | null;
  updateSessionLocal: (
    id: string,
    updater: (s: ChatSession) => ChatSession,
    fallback?: ChatSession,
  ) => void;
  persistSessionState: (
    id: string,
    providerIds: string[],
    prompt: string,
  ) => Promise<void>;
}

export interface UseChatQueryReturn {
  isRunning: boolean;
  chatPrompt: string;
  isBroadcastPrompt: boolean;
  setChatPrompt: (p: string) => void;
  queryAllColumns: (
    prompt: string,
    columns: ChatQueryColumnTarget[],
    sessionId: string,
    nextTurns: number,
    systemPrompt?: string,
  ) => Promise<void>;
  queryOneColumn: (
    prompt: string,
    columnId: string,
    provider: ProviderView,
    sessionId: string,
    nextTurns: number,
    allProviderIds: string[],
    systemPrompt?: string,
  ) => Promise<void>;
  retryColumn: (
    columnId: string,
    provider: ProviderView,
    prompt: string,
    sessionId: string,
    turns: number,
    allProviderIds: string[],
    systemPrompt?: string,
  ) => void;
  cancelAll: () => void;
}

export function useChatQuery(deps: ChatQueryDeps): UseChatQueryReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [isBroadcastPrompt, setIsBroadcastPrompt] = useState(false);

  const requestIdRef = useRef(0);
  const columnRequestIdsRef = useRef<Record<string, number>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  const markInFlight = useCallback((columnId: string, active: boolean) => {
    if (active) inFlightRef.current.add(columnId);
    else inFlightRef.current.delete(columnId);
    setIsRunning(inFlightRef.current.size > 0);
  }, []);

  const cancelAll = useCallback(() => {
    requestIdRef.current += 1;
    columnRequestIdsRef.current = {};
    inFlightRef.current.clear();
    setIsRunning(false);
    setIsBroadcastPrompt(false);
  }, []);

  useEffect(
    () => () => {
      cancelAll();
    },
    [cancelAll],
  );

  const generateTitle = useCallback(
    async (
      sessionId: string,
      providerId: string,
      userMsg: string,
      assistantMsg: string,
    ) => {
      if (!userMsg.trim()) return;
      const prompt = `Summarize this conversation in 5 words or fewer. Reply with ONLY the title, no punctuation.\n\nUser: ${userMsg.slice(0, 300)}\nAssistant: ${assistantMsg.slice(0, 300)}`;
      try {
        const title = await withTimeout(
          invoke<string>("query_provider_once", {
            providerId,
            prompt,
            history: null,
          }),
          15_000,
          "generate_title",
        );
        const clean = title
          .trim()
          .replace(/^["']|["']$/g, "")
          .slice(0, 60);
        if (clean) {
          const saved = await ChatDb.renameSession(sessionId, clean);
          deps.updateSessionLocal(sessionId, (s) => ({
            ...s,
            title: saved.title,
            updatedAt: saved.updated_at,
          }));
        }
      } catch {
        // best effort
      }
    },
    [deps],
  );

  const streamColumn = useCallback(
    async (
      prompt: string,
      columnId: string,
      provider: ProviderView,
      sessionId: string,
      nextTurns: number,
      allProviderIds: string[],
      createUserMessage: boolean,
      systemPrompt?: string,
    ) => {
      const normalizedPrompt = prompt.trim();
      if (!normalizedPrompt) return;

      const providerIds = [...allProviderIds];
      setChatPrompt(normalizedPrompt);
      if (createUserMessage) setIsBroadcastPrompt(false);

      if (createUserMessage) {
        const ts = monotonicNow();
        const userMsg: ChatMessage = {
          id: createMessageId(),
          sessionId,
          columnId,
          providerId: provider.id,
          role: "user",
          content: normalizedPrompt,
          status: "done",
          createdAt: ts,
          updatedAt: ts,
        };
        deps.appendMessage(userMsg);
        try {
          await ChatDb.createMessage(userMsg);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const finalContent = `Error: Failed to persist user message. ${errMsg}`;
          deps.updateMessage(columnId, userMsg.id, (m) => ({
            ...m,
            content: finalContent,
            status: "error",
            updatedAt: monotonicNow(),
          }));
          void ChatDb.updateMessage(userMsg.id, finalContent, "error");
          return;
        }
      }

      const history = deps.buildHistory(columnId, systemPrompt);
      const last = history[history.length - 1];
      if (!(last?.role === "user" && last.content === normalizedPrompt)) {
        history.push({ role: "user", content: normalizedPrompt });
      }

      const assistantMsgId = createMessageId();
      const assistantTs = monotonicNow();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        sessionId,
        columnId,
        providerId: provider.id,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: assistantTs,
        updatedAt: assistantTs,
      };
      deps.appendMessage(assistantMsg);
      try {
        await ChatDb.createMessage(assistantMsg);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const finalContent = `Error: Failed to persist assistant message. ${errMsg}`;
        deps.updateMessage(columnId, assistantMsgId, (m) => ({
          ...m,
          content: finalContent,
          status: "error",
          updatedAt: monotonicNow(),
        }));
        void ChatDb.updateMessage(assistantMsgId, finalContent, "error");
        return;
      }

      deps.updateSessionLocal(sessionId, (s) => ({
        ...s,
        title: s.turns === 0 ? normalizedPrompt.slice(0, 50) : s.title,
        updatedAt: monotonicNow(),
        providerIds,
        prompt: normalizedPrompt,
        turns: nextTurns,
      }));

      requestIdRef.current += 1;
      const reqId = requestIdRef.current;
      columnRequestIdsRef.current[columnId] = reqId;
      markInFlight(columnId, true);

      let accumulated = "";
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const scheduleFlush = () => {
        if (flushTimer !== null) return;
        flushTimer = setTimeout(() => {
          flushTimer = null;
          if (accumulated) {
            void ChatDb.updateMessage(assistantMsgId, accumulated, "streaming");
          }
        }, 2_000);
      };

      const cancelFlush = () => {
        if (flushTimer !== null) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      };

      const eventName = `query:chunk:${columnId}`;
      const unlisten = await listen<string>(eventName, (event) => {
        if (columnRequestIdsRef.current[columnId] !== reqId) return;
        accumulated = `${accumulated}${event.payload}`;
        deps.updateMessage(columnId, assistantMsgId, (m) => ({
          ...m,
          content: accumulated,
          status: "streaming",
          updatedAt: monotonicNow(),
        }));
        scheduleFlush();
      });

      try {
        await withTimeout(
          invoke("query_stream_provider", {
            providerId: provider.id,
            prompt: normalizedPrompt,
            history,
            streamKey: columnId,
          }),
          180_000,
          "query_stream_provider",
        );

        if (columnRequestIdsRef.current[columnId] !== reqId) return;

        cancelFlush();
        deps.updateMessage(columnId, assistantMsgId, (m) => ({
          ...m,
          content: accumulated,
          status: "done",
          updatedAt: monotonicNow(),
        }));
        void ChatDb.updateMessage(assistantMsgId, accumulated, "done");

        if (nextTurns === 1) {
          void generateTitle(
            sessionId,
            provider.id,
            normalizedPrompt,
            accumulated,
          );
        }
      } catch (err) {
        if (columnRequestIdsRef.current[columnId] !== reqId) return;
        cancelFlush();
        const errMsg = err instanceof Error ? err.message : String(err);
        const finalContent = accumulated.trim() || `Error: ${errMsg}`;
        deps.updateMessage(columnId, assistantMsgId, (m) => ({
          ...m,
          content: finalContent,
          status: "error",
          updatedAt: monotonicNow(),
        }));
        void ChatDb.updateMessage(assistantMsgId, finalContent, "error");
      } finally {
        cancelFlush();
        unlisten();
        if (columnRequestIdsRef.current[columnId] === reqId) {
          delete columnRequestIdsRef.current[columnId];
          markInFlight(columnId, false);
        }
      }

      await deps.persistSessionState(sessionId, providerIds, normalizedPrompt);
    },
    [deps, generateTitle, markInFlight],
  );

  const queryAllColumns = useCallback(
    async (
      prompt: string,
      columns: ChatQueryColumnTarget[],
      sessionId: string,
      nextTurns: number,
      systemPrompt?: string,
    ) => {
      if (!prompt.trim() || columns.length === 0) return;
      setChatPrompt(prompt.trim());
      setIsBroadcastPrompt(true);
      const providerIds = columns.map((c) => c.provider.id);
      await Promise.all(
        columns.map(({ columnId, provider }) =>
          streamColumn(
            prompt,
            columnId,
            provider,
            sessionId,
            nextTurns,
            providerIds,
            true,
            systemPrompt,
          ),
        ),
      );
    },
    [streamColumn],
  );

  const queryOneColumn = useCallback(
    async (
      prompt: string,
      columnId: string,
      provider: ProviderView,
      sessionId: string,
      nextTurns: number,
      allProviderIds: string[],
      systemPrompt?: string,
    ) => {
      await streamColumn(
        prompt,
        columnId,
        provider,
        sessionId,
        nextTurns,
        allProviderIds,
        true,
        systemPrompt,
      );
    },
    [streamColumn],
  );

  const retryColumn = useCallback(
    (
      columnId: string,
      provider: ProviderView,
      prompt: string,
      sessionId: string,
      turns: number,
      allProviderIds: string[],
      systemPrompt?: string,
    ) => {
      deps.removeLastError(columnId);
      void streamColumn(
        prompt,
        columnId,
        provider,
        sessionId,
        turns,
        allProviderIds,
        false,
        systemPrompt,
      );
    },
    [deps, streamColumn],
  );

  return {
    isRunning,
    chatPrompt,
    isBroadcastPrompt,
    setChatPrompt,
    queryAllColumns,
    queryOneColumn,
    retryColumn,
    cancelAll,
  };
}
