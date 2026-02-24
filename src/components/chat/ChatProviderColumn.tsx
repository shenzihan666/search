/**
 * ChatProviderColumn — one vertical column for a single AI provider.
 *
 * Changes from previous version:
 *   P1  — pane prop removed. Loading / error state is now derived directly
 *         from the messages array (last assistant message status).
 *   P7  — isTruncated now reflects character-budget trim, not message count.
 *   P10 — "Load earlier" button appears when hasMore is true.
 *   P11 — onDeleteMessage prop allows individual message deletion.
 */
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types/chat";
import type { ProviderView } from "../../types/provider";
import { ChatMessageBubble } from "./ChatMessageBubble";

interface ChatProviderColumnProps {
  provider: ProviderView;
  messages: ChatMessage[];
  isTruncated: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onFollowUpSubmit: (prompt: string) => void;
  onRetry: (prompt: string) => void;
  onDeleteMessage: (msgId: string) => void;
}

export function ChatProviderColumn({
  provider,
  messages,
  isTruncated,
  hasMore,
  onLoadMore,
  onFollowUpSubmit,
  onRetry,
  onDeleteMessage,
}: ChatProviderColumnProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive loading / error state from the last assistant message.
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const isStreaming = lastAssistant?.status === "streaming";
  const showThinking = isStreaming && !lastAssistant?.content.trim();

  // Auto-scroll to bottom when new content arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onFollowUpSubmit(trimmed);
    setInput("");
  };

  // Last user message content used for retry context.
  const lastUserContent = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  // D4: Copy all assistant content from this column.
  const handleCopyAll = async () => {
    const assistantContent = messages
      .filter((m) => m.role === "assistant" && m.content.trim())
      .map((m) => m.content)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(assistantContent);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="min-w-[320px] flex-1 min-h-0 flex flex-col h-full border-r border-border-gray last:border-r-0">
      {/* Column header */}
      <header className="px-4 py-3 border-b border-border-gray bg-white flex items-start justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em]">
              {provider.name}
            </p>
            {isTruncated && (
              <span
                title="Older messages have been trimmed from the context window"
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200"
              >
                Context trimmed
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-secondary mt-0.5">{provider.model}</p>
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          title="Copy all responses"
          className="p-1 rounded text-text-secondary hover:text-black hover:bg-[#F5F5F5] transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">content_copy</span>
        </button>
      </header>

      {/* Message thread */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 chat-scrollbar"
      >
        {/* P10: Load earlier messages */}
        {hasMore && onLoadMore && (
          <button
            type="button"
            onClick={onLoadMore}
            className="w-full text-[11px] text-text-secondary hover:text-black py-1.5 border border-border-gray rounded-md hover:border-black/30 transition-colors"
          >
            Load earlier messages
          </button>
        )}

        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            onRetry={
              msg.status === "error" ? () => onRetry(lastUserContent) : undefined
            }
            onDelete={() => onDeleteMessage(msg.id)}
          />
        ))}

        {showThinking && (
          <div className="flex items-center gap-2 text-text-secondary pl-1">
            <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span className="text-[12px]">Thinking…</span>
          </div>
        )}
      </div>

      {/* Per-provider follow-up input */}
      <div className="border-t border-border-gray bg-[#FCFCFC] px-3 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={`Ask ${provider.name}…`}
            className="w-full h-9 rounded-md border border-border-gray bg-white px-3 text-[12px] outline-none focus:border-black/40 transition-colors"
          />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={!input.trim() || isStreaming}
            className="h-9 px-3 rounded-md border border-border-gray bg-white text-[11px] font-semibold text-text-secondary hover:border-black hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
