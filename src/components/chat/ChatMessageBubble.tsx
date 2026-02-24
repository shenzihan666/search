/**
 * ChatMessageBubble — renders a single chat message.
 *
 * Changes from previous version:
 *   P11 — onDelete prop enables individual message deletion (shown on hover).
 */
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types/chat";
import { MarkdownContent } from "./MarkdownContent";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
  onDelete?: () => void;
}

export function ChatMessageBubble({
  message,
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
      /* clipboard may be unavailable */
    }
  };

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete?.();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-cancel confirm after 3 s
      setTimeout(() => setConfirmDelete(false), 3_000);
    }
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
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
          className="max-w-[94%] rounded-xl px-3 py-2 bg-[#F5F5F5] border border-border-gray text-text-main cursor-pointer"
        >
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          <div
            className={`flex items-center justify-end gap-1.5 transition-all ${
              actionsOpen
                ? "mt-1.5 max-h-8 opacity-100"
                : "mt-0 max-h-0 overflow-hidden opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={handleCopy}
              title="Copy message"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-secondary hover:text-black hover:bg-white border border-transparent hover:border-border-gray transition-all"
            >
              <span className="material-symbols-outlined text-[12px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied" : "Copy"}
            </button>

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
        </div>
      </div>
    );
  }

  // Assistant message
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";
  const showActions = isError || actionsOpen;

  return (
    <div className="flex justify-start">
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
        {isStreaming ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <MarkdownContent content={message.content} />
        )}

        {/* Action buttons — visible on hover or on error */}
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

            {/* Retry button on error messages */}
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

            {/* P11: Delete button */}
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
