/**
 * useChatQuery — drives streaming queries against one or many providers.
 *
 * Changes from previous version:
 *   P4  — queryAllProviders creates ONE user message PER provider (no more
 *         shared "" providerId). Each provider has a self-contained history.
 *         The skipUserMessage / historyOverride pattern is removed.
 *   P3  — streamProvider throttles DB flushes every 2 s during streaming
 *         so partial content survives a crash.
 *   P9  — After the first turn completes, fires an async LLM call to
 *         generate a concise session title.
 *   P1  — persistSessionState no longer takes panes or turns.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatDb } from "../lib/chatDb";
import { withTimeout } from "../lib/utils";
import { createMessageId, monotonicNow } from "./useChatMessages";
import type {
  ChatMessage,
  ChatSession,
  ProviderHistoryMessage,
} from "../types/chat";
import type { ProviderView } from "../types/provider";

// ─── Dependency injection contract ────────────────────────────────────────────

export interface ChatQueryDeps {
  appendMessage: (msg: ChatMessage) => void;
  updateMessage: (
    providerId: string,
    msgId: string,
    updater: (m: ChatMessage) => ChatMessage,
  ) => void;
  buildHistory: (providerId: string, systemPrompt?: string) => ProviderHistoryMessage[];
  removeLastError: (providerId: string) => string | null;
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

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UseChatQueryReturn {
  isRunning: boolean;
  chatPrompt: string;
  isBroadcastPrompt: boolean;
  chatProviderIds: string[];
  setChatPrompt: (p: string) => void;
  setChatProviderIds: (ids: string[]) => void;
  queryAllProviders: (
    prompt: string,
    providers: ProviderView[],
    sessionId: string,
    nextTurns: number,
    systemPrompt?: string,
  ) => Promise<void>;
  queryOneProvider: (
    prompt: string,
    provider: ProviderView,
    sessionId: string,
    nextTurns: number,
    allProviderIds: string[],
    systemPrompt?: string,
  ) => Promise<void>;
  retryProvider: (
    provider: ProviderView,
    prompt: string,
    sessionId: string,
    turns: number,
    allProviderIds: string[],
    systemPrompt?: string,
  ) => void;
  cancelAll: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChatQuery(deps: ChatQueryDeps): UseChatQueryReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [isBroadcastPrompt, setIsBroadcastPrompt] = useState(false);
  const [chatProviderIds, setChatProviderIds] = useState<string[]>([]);

  const requestIdRef = useRef(0);
  const providerRequestIdsRef = useRef<Record<string, number>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  // ── In-flight tracking ────────────────────────────────────────────────────

  const markInFlight = useCallback((providerId: string, active: boolean) => {
    if (active) {
      inFlightRef.current.add(providerId);
    } else {
      inFlightRef.current.delete(providerId);
    }
    setIsRunning(inFlightRef.current.size > 0);
  }, []);

  const cancelAll = useCallback(() => {
    requestIdRef.current += 1;
    providerRequestIdsRef.current = {};
    inFlightRef.current.clear();
    setIsRunning(false);
    setIsBroadcastPrompt(false);
  }, []);

  // cleanup on unmount
  useEffect(() => () => { cancelAll(); }, [cancelAll]);

  // ── P9: Generate a short session title via LLM ────────────────────────────

  const generateTitle = useCallback(
    async (sessionId: string, providerId: string, userMsg: string, assistantMsg: string) => {
      if (!userMsg.trim()) return;
      const prompt =
        `Summarize this conversation in 5 words or fewer. Reply with ONLY the title, no punctuation.\n\nUser: ${userMsg.slice(0, 300)}\nAssistant: ${assistantMsg.slice(0, 300)}`;
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
        const clean = title.trim().replace(/^["']|["']$/g, "").slice(0, 60);
        if (clean) {
          const saved = await ChatDb.renameSession(sessionId, clean);
          deps.updateSessionLocal(sessionId, (s) => ({
            ...s,
            title: saved.title,
            updatedAt: saved.updated_at,
          }));
        }
      } catch {
        // Title generation is best-effort — silently ignore failures.
      }
    },
    [deps],
  );

  // ── Core streaming runner for a single provider ───────────────────────────

  const streamProvider = useCallback(
    async (
      prompt: string,
      provider: ProviderView,
      sessionId: string,
      nextTurns: number,
      allProviderIds: string[],
      createUserMessage: boolean,
      systemPrompt?: string,
    ) => {
      const normalizedPrompt = prompt.trim();
      if (!normalizedPrompt) return;

      const providerIds = Array.from(new Set(allProviderIds));
      setChatPrompt(normalizedPrompt);
      if (createUserMessage) setIsBroadcastPrompt(false);
      setChatProviderIds(providerIds);

      // ── User message (skipped on retry — message already exists) ─────────
      if (createUserMessage) {
        const ts = monotonicNow();
        const userMsg: ChatMessage = {
          id: createMessageId(),
          sessionId,
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
          deps.updateMessage(provider.id, userMsg.id, (m) => ({
            ...m,
            content: finalContent,
            status: "error",
            updatedAt: monotonicNow(),
          }));
          void ChatDb.updateMessage(userMsg.id, finalContent, "error");
          return;
        }
      }

      // ── Build history snapshot (includes the new user message as a guard) ─
      const history = deps.buildHistory(provider.id, systemPrompt);
      const last = history[history.length - 1];
      if (!(last?.role === "user" && last.content === normalizedPrompt)) {
        history.push({ role: "user", content: normalizedPrompt });
      }

      // ── Assistant message placeholder ─────────────────────────────────────
      const assistantMsgId = createMessageId();
      const assistantTs = monotonicNow();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        sessionId,
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
        deps.updateMessage(provider.id, assistantMsgId, (m) => ({
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
        // Title is set on first turn as a placeholder; LLM will generate the real one.
        title: s.turns === 0 ? normalizedPrompt.slice(0, 50) : s.title,
        updatedAt: monotonicNow(),
        providerIds,
        prompt: normalizedPrompt,
        turns: nextTurns,
      }));


      // ── Request id for cancellation ───────────────────────────────────────
      // Each streamProvider invocation gets a unique id so that a stale
      // stream's finally block cannot delete the new stream's mapping entry,
      // which was the root cause of "no reply on follow-up" messages.
      requestIdRef.current += 1;
      const reqId = requestIdRef.current;
      providerRequestIdsRef.current[provider.id] = reqId;
      markInFlight(provider.id, true);

      // ── P3: Periodic flush timer during streaming ─────────────────────────
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

      // ── Stream ────────────────────────────────────────────────────────────
      const eventName = `query:chunk:${provider.id}`;
      const unlisten = await listen<string>(eventName, (event) => {
        if (providerRequestIdsRef.current[provider.id] !== reqId) return;
        accumulated = `${accumulated}${event.payload}`;

        deps.updateMessage(provider.id, assistantMsgId, (m) => ({
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
          }),
          180_000,
          "query_stream_provider",
        );

        if (providerRequestIdsRef.current[provider.id] !== reqId) return;

        cancelFlush();
        deps.updateMessage(provider.id, assistantMsgId, (m) => ({
          ...m,
          content: accumulated,
          status: "done",
          updatedAt: monotonicNow(),
        }));
        void ChatDb.updateMessage(assistantMsgId, accumulated, "done");

        // P9: Generate an LLM title after the first turn.
        if (nextTurns === 1) {
          void generateTitle(sessionId, provider.id, normalizedPrompt, accumulated);
        }
      } catch (err) {
        if (providerRequestIdsRef.current[provider.id] !== reqId) return;
        cancelFlush();
        const errMsg = err instanceof Error ? err.message : String(err);
        const finalContent = accumulated.trim() || `Error: ${errMsg}`;

        deps.updateMessage(provider.id, assistantMsgId, (m) => ({
          ...m,
          content: finalContent,
          status: "error",
          updatedAt: monotonicNow(),
        }));
        void ChatDb.updateMessage(assistantMsgId, finalContent, "error");
      } finally {
        cancelFlush();
        unlisten();
        // Only clean up state if this stream is still the active one for this
        // provider.  A newer stream overwrites the mapping entry, so stale
        // streams must not remove the new entry or reset the in-flight flag.
        if (providerRequestIdsRef.current[provider.id] === reqId) {
          delete providerRequestIdsRef.current[provider.id];
          markInFlight(provider.id, false);
        }
      }

      await deps.persistSessionState(sessionId, providerIds, normalizedPrompt);
    },
    [deps, markInFlight, generateTitle],
  );

  // ── Public: broadcast to all providers ───────────────────────────────────

  /**
   * P4: Creates one user message per provider (no shared "" bucket).
   * Each provider gets its own full conversation chain.
   */
  const queryAllProviders = useCallback(
    async (
      prompt: string,
      providers: ProviderView[],
      sessionId: string,
      nextTurns: number,
      systemPrompt?: string,
    ) => {
      if (!prompt.trim() || providers.length === 0) return;

      const providerIds = providers.map((p) => p.id);
      setChatPrompt(prompt.trim());
      setIsBroadcastPrompt(true);
      setChatProviderIds(providerIds);

      await Promise.all(
        providers.map((provider) =>
          streamProvider(
            prompt,
            provider,
            sessionId,
            nextTurns,
            providerIds,
            true, // each provider creates its own user message
            systemPrompt,
          ),
        ),
      );
    },
    [streamProvider],
  );

  // ── Public: single-provider follow-up ─────────────────────────────────────

  const queryOneProvider = useCallback(
    async (
      prompt: string,
      provider: ProviderView,
      sessionId: string,
      nextTurns: number,
      allProviderIds: string[],
      systemPrompt?: string,
    ) => {
      await streamProvider(
        prompt,
        provider,
        sessionId,
        nextTurns,
        allProviderIds,
        true,
        systemPrompt,
      );
    },
    [streamProvider],
  );

  // ── Retry a failed provider ───────────────────────────────────────────────

  const retryProvider = useCallback(
    (
      provider: ProviderView,
      prompt: string,
      sessionId: string,
      turns: number,
      allProviderIds: string[],
      systemPrompt?: string,
    ) => {
      deps.removeLastError(provider.id);
      void streamProvider(
        prompt,
        provider,
        sessionId,
        turns,
        allProviderIds,
        false, // retry reuses the existing user message — don't create a new one
        systemPrompt,
      );
    },
    [deps, streamProvider],
  );

  return {
    isRunning,
    chatPrompt,
    isBroadcastPrompt,
    chatProviderIds,
    setChatPrompt,
    setChatProviderIds,
    queryAllProviders,
    queryOneProvider,
    retryProvider,
    cancelAll,
  };
}
