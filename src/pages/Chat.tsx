import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProviders } from "@/hooks/useProviders";
import type { ProviderView } from "@/types/provider";

interface ChatInitData {
  sessionId?: string;
  query: string;
  providers: string;
  createdAt?: number;
}

interface ChatMessage {
  id: string;
  role: "user";
  content: string;
  createdAt: number;
}

interface ChatSession {
  id: string;
  providerIds: string[];
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatColumnProps {
  provider: ProviderView;
  prompt: string;
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

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ChatColumn({ provider, prompt }: ChatColumnProps) {
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!prompt.trim()) {
      setResponse("");
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setResponse("");

    void (async () => {
      try {
        const text = await withTimeout(
          invoke<string>("query_provider_once", {
            providerId: provider.id,
            provider_id: provider.id,
            prompt,
          }),
          45000,
          "query_provider_once",
        );

        if (requestIdRef.current !== requestId) {
          return;
        }

        setResponse(text);
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Query failed for ${provider.name}:`, error);
        setResponse(`Error: ${message}`);
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    })();
  }, [prompt, provider.id, provider.name]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  return (
    <section className="flex-1 flex flex-col h-full min-w-0">
      <div className="px-6 py-4 border-b border-border-gray flex justify-between items-center bg-white shrink-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold tracking-[0.2em] text-black uppercase">
            {provider.name.toUpperCase()}
          </span>
          <span className="text-[10px] text-text-secondary uppercase tracking-wider">
            {provider.model}
          </span>
        </div>
        <button
          type="button"
          className="material-symbols-outlined text-[18px] text-text-secondary cursor-pointer hover:text-black transition-colors bg-transparent border-0"
        >
          tune
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-8 py-8 space-y-8 no-scrollbar"
      >
        <div className="space-y-3">
          <p className="text-[15px] font-medium leading-relaxed text-black">
            {prompt}
          </p>
        </div>

        <div className="space-y-6">
          {isLoading && response === "" ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <span className="text-[13px] text-text-secondary">
                Thinking...
              </span>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-black whitespace-pre-wrap">
              {response}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Chat() {
  const { providers } = useProviders();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const activePrompt = activeSession
    ? (activeSession.messages[activeSession.messages.length - 1]?.content ?? "")
    : "";

  const activeProviders = useMemo(() => {
    if (!activeSession) {
      return providers.filter((p) => p.has_api_key);
    }

    if (activeSession.providerIds.length === 0) {
      return providers.filter((p) => p.has_api_key);
    }

    return providers.filter(
      (p) => p.has_api_key && activeSession.providerIds.includes(p.id),
    );
  }, [activeSession, providers]);

  useEffect(() => {
    const unlisten = listen<ChatInitData>("chat:init", (event) => {
      const initQuery = event.payload.query.trim();
      if (!initQuery) {
        return;
      }

      const providerIds = event.payload.providers
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const sessionId = event.payload.sessionId?.trim() || createSessionId();

      const firstMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content: initQuery,
        createdAt: event.payload.createdAt ?? Date.now(),
      };

      setSessions((prev) => {
        if (prev.some((session) => session.id === sessionId)) {
          return prev;
        }
        return [
          {
            id: sessionId,
            providerIds,
            messages: [firstMessage],
            createdAt: event.payload.createdAt ?? Date.now(),
          },
          ...prev,
        ];
      });
      setActiveSessionId(sessionId);
      setQuery("");
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.show();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void getCurrentWindow().hide();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pushMessageToSession = (content: string) => {
    const text = content.trim();
    if (!text) return;

    const fallbackProviderIds = providers
      .filter((p) => p.has_api_key)
      .map((p) => p.id);
    const nextSessionId = activeSessionId ?? createSessionId();

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    setSessions((prev) => {
      const index = prev.findIndex((session) => session.id === nextSessionId);
      if (index === -1) {
        return [
          {
            id: nextSessionId,
            providerIds: fallbackProviderIds,
            messages: [message],
            createdAt: Date.now(),
          },
          ...prev,
        ];
      }

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        messages: [...updated[index].messages, message],
      };
      return updated;
    });

    setActiveSessionId(nextSessionId);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      pushMessageToSession(query);
    }
  };

  const handleSubmit = () => {
    pushMessageToSession(query);
  };

  return (
    <div className="w-screen h-screen bg-white text-black font-sans flex flex-col overflow-hidden rounded-xl border border-border-gray shadow-2xl">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="w-full border-b border-border-gray bg-white pt-6 pb-4 px-8 z-30 flex justify-center shrink-0">
          <div className="w-full max-w-[800px] flex items-center bg-white border border-border-gray rounded-lg px-4 py-2 shadow-sm focus-within:ring-1 focus-within:ring-black transition-all">
            <span className="material-symbols-outlined text-text-secondary mr-3 text-[18px]">
              search
            </span>
            <input
              className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder-text-secondary font-normal outline-none"
              placeholder="Search across models..."
              type="text"
              value={activePrompt}
              readOnly
            />
            <div className="flex items-center gap-2 ml-2">
              <span className="text-[10px] font-bold tracking-widest border border-border-gray px-1.5 py-0.5 rounded bg-[#FAFAFA] text-text-secondary">
                ESC
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden bg-white">
          {!activeSession ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[15px] text-text-secondary">
                  No chat session yet.
                </p>
                <p className="text-[13px] text-text-secondary mt-2">
                  Press Tab in launcher or send a message below to start.
                </p>
              </div>
            </div>
          ) : activeProviders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[15px] text-text-secondary">
                  No providers with API keys configured.
                </p>
                <p className="text-[13px] text-text-secondary mt-2">
                  Add API keys in Settings to use multi-model chat.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full divide-x divide-border-gray">
              {activeProviders.map((provider) => (
                <ChatColumn
                  key={`${activeSession.id}-${provider.id}`}
                  provider={provider}
                  prompt={activePrompt}
                />
              ))}
            </div>
          )}
        </main>

        <footer className="p-6 border-t border-border-gray bg-white flex flex-col items-center shrink-0">
          <div className="w-full max-w-[850px] relative">
            <div className="flex items-end gap-3 border border-border-gray rounded-xl px-4 py-3 shadow-sm focus-within:border-black transition-all bg-white">
              <button
                type="button"
                className="mb-0.5 text-text-secondary hover:text-black transition-colors bg-transparent border-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  add
                </span>
              </button>
              <textarea
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none focus:ring-0 text-[14px] p-0 placeholder-text-secondary resize-none min-h-[24px] max-h-32 outline-none"
                placeholder={`Send a message to ${activeProviders.length} model${activeProviders.length > 1 ? "s" : ""}...`}
                rows={1}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_upward
                  </span>
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center mt-4 px-1">
              <div className="flex gap-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    {activeProviders.length} Model
                    {activeProviders.length !== 1 ? "s" : ""} Active
                  </span>
                </div>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                Press <span className="text-black">Shift + Enter</span> for new
                line
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
