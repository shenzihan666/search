/**
 * ChatSidebar — session list with rename, delete, export, and search.
 *
 * Changes from previous version:
 *   P13 — Export button per session (downloads Markdown).
 *   P13 — Search box at top for cross-session FTS search.
 *   P2  — turns is now derived from DB (already in session.turns) — display unchanged.
 */
import { useEffect, useRef, useState } from "react";
import type { ChatSession, MessageSearchResult } from "../../types/chat";
import { ChatDb } from "../../lib/chatDb";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  editingSessionId: string | null;
  editingTitle: string;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onBeginRename: (session: ChatSession) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onEditingTitleChange: (title: string) => void;
  onDelete: (id: string) => void;
  onSearchResultSelect: (sessionId: string) => void;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${d}d`;
}

async function exportSessionToMarkdown(session: ChatSession): Promise<void> {
  try {
    const rows = await ChatDb.exportSession(session.id);
    const lines: string[] = [`# ${session.title}`, ""];
    for (const row of rows) {
      const speaker = row.role === "user" ? "**You**" : `**${row.provider_id || "Assistant"}**`;
      lines.push(`${speaker}`, "", row.content, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title.slice(0, 40).replace(/[^a-z0-9]/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed:", err);
  }
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  editingSessionId,
  editingTitle,
  onSelect,
  onNewSession,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onEditingTitleChange,
  onDelete,
  onSearchResultSelect,
}: ChatSidebarProps) {
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (editingSessionId) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 0);
    }
  }, [editingSessionId]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await ChatDb.searchMessages(searchQuery.trim(), 15);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearchMode = searchQuery.trim().length > 0;

  return (
    <aside className="w-[230px] border-r border-border-gray bg-[#FAFAFA] flex flex-col shrink-0">
      {/* New session button */}
      <div className="p-3 border-b border-border-gray shrink-0">
        <button
          type="button"
          onClick={onNewSession}
          className="w-full h-9 rounded-md border border-border-gray bg-white text-[11px] font-semibold tracking-wide text-text-main hover:border-black hover:bg-[#F5F5F5] transition-colors flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[15px]">add</span>
          New Session
        </button>
      </div>

      {/* P13: Search box */}
      <div className="px-2 pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 px-2 h-8 rounded-md border border-border-gray bg-white focus-within:border-black/30 transition-colors">
          <span className="material-symbols-outlined text-[14px] text-text-secondary">search</span>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 text-[11px] outline-none bg-transparent text-text-main placeholder:text-text-secondary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-text-secondary hover:text-black"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Session list or search results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 chat-scrollbar">
        {isSearchMode ? (
          /* Search results */
          isSearching ? (
            <p className="px-2 py-4 text-center text-[11px] text-text-secondary">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] text-text-secondary">No results</p>
          ) : (
            searchResults.map((result) => (
              <button
                key={result.message_id}
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  onSearchResultSelect(result.session_id);
                }}
                className="w-full text-left px-2.5 py-2 rounded-md border border-transparent hover:bg-white hover:border-black/10 transition-colors"
              >
                <p className="text-[11px] font-semibold truncate text-text-main">
                  {result.session_title}
                </p>
                <p
                  className="text-[10px] text-text-secondary mt-0.5 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: result.snippet }}
                />
              </button>
            ))
          )
        ) : (
          /* Normal session list */
          sessions.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] text-text-secondary">
              No sessions yet
            </p>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = session.id === editingSessionId;

              return (
                <div
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !isEditing && onSelect(session.id)}
                  onDoubleClick={() => onBeginRename(session)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                      e.preventDefault();
                      onSelect(session.id);
                    }
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-white border-black/20 shadow-[inset_3px_0_0_0_#111] text-black"
                      : "bg-transparent border-transparent hover:bg-white hover:border-black/10 text-text-main"
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          ref={renameInputRef}
                          value={editingTitle}
                          onChange={(e) => onEditingTitleChange(e.target.value)}
                          onBlur={onCancelRename}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onCommitRename(session.id);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              onCancelRename();
                            }
                          }}
                          className="w-full h-6 px-1 rounded border border-black/20 bg-white text-[12px] font-medium outline-none"
                        />
                      ) : (
                        <p className="text-[12px] font-medium truncate">
                          {session.title || "New Session"}
                        </p>
                      )}
                      <p className="text-[10px] mt-0.5 text-text-secondary">
                        {formatTime(session.updatedAt)} · {session.turns} turn
                        {session.turns === 1 ? "" : "s"}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {/* P13: Export button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void exportSessionToMarkdown(session);
                        }}
                        title="Export session as Markdown"
                        className="w-5 h-5 rounded text-text-secondary hover:text-black hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <span className="material-symbols-outlined text-[12px]">download</span>
                      </button>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(session.id);
                        }}
                        title="Delete session"
                        className="w-5 h-5 rounded text-text-secondary hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Footer hints */}
      <div className="p-2 border-t border-border-gray shrink-0">
        <p className="text-[10px] text-text-secondary text-center">
          Double-click or <span className="font-bold">F2</span> to rename
        </p>
      </div>
    </aside>
  );
}
