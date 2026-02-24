import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types/chat";
import { MarkdownContent } from "./MarkdownContent";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  sourceLabel: string;
  onRetry?: () => void;
  onDelete?: () => void;
}

export function ChatMessageBubble({
  message,
  sourceLabel,
  onRetry,
  onDelete,
}: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!bubbleRef.current) return;
      if (!bubbleRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
        setConfirmDelete(false);
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable
    }
  };

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete?.();
      setConfirmDelete(false);
      return;
    }
    setConfirmDelete(true);
    setTimeout(() => setConfirmDelete(false), 3_000);
  };

  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";
  const showActions = isError || actionsOpen;
  const label = isUser ? `You - ${sourceLabel}` : sourceLabel;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {/* biome-ignore lint/a11y/useSemanticElements: Complex bubble with nested interactive elements */}
      <div
        ref={bubbleRef}
        role="button"
        tabIndex={0}
        onClick={() => setActionsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setActionsOpen(true);
          }
        }}
        className={`max-w-[94%] rounded-xl px-3 py-2 relative cursor-pointer ${
          isError
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-[#F5F5F5] border border-border-gray text-text-main"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.06em] text-text-secondary mb-1">
          {label}
        </p>

        {isStreaming ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <MarkdownContent content={message.content} />
        )}

        {!isStreaming && (
          <div
            className={`flex items-center gap-1.5 ${
              showActions
                ? "mt-1.5 max-h-8 opacity-100"
                : "mt-0 max-h-0 overflow-hidden opacity-0"
            } transition-all`}
          >
            {!isError && (
              <button
                type="button"
                onClick={handleCopy}
                title="Copy response"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-secondary hover:text-black hover:bg-white border border-transparent hover:border-border-gray transition-all"
              >
                <span className="material-symbols-outlined text-[12px]">
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Copied" : "Copy"}
              </button>
            )}

            {isError && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                title="Retry this request"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-red-600 hover:text-red-800 hover:bg-red-100 border border-red-200 transition-all"
              >
                <span className="material-symbols-outlined text-[12px]">
                  refresh
                </span>
                Retry
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                title={
                  confirmDelete
                    ? "Click again to confirm deletion"
                    : "Delete message"
                }
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                  confirmDelete
                    ? "text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                    : "text-text-secondary border-transparent hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">
                  delete
                </span>
                {confirmDelete ? "Confirm" : "Delete"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
