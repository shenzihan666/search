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
    <aside className="w-[230px] border-r border-border bg-sidebar flex flex-col shrink-0">
      <div className="p-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onNewSession}
          className="w-full h-9 rounded-md border border-border bg-background text-[11px] font-semibold tracking-wide text-foreground hover:border-primary hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[15px]">add</span>
          New Session
        </button>
      </div>

      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 px-2 h-8 rounded-md border border-border bg-background focus-within:border-primary/50 transition-colors">
          <span className="material-symbols-outlined text-[16px] text-muted-foreground">
            search
          </span>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 w-full min-w-0 text-[12px] outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground shrink-0 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[16px]">
                close
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 chat-scrollbar">
        {isSearchMode ? (
          /* Search results */
          isSearching ? (
            <div className="px-2 py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <span className="material-symbols-outlined text-[20px] animate-spin">
                progress_activity
              </span>
              <p className="text-[11px]">Searching messages...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="px-2 py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]">
                search_off
              </span>
              <p className="text-[11px]">No matching messages found</p>
            </div>
          ) : (
            searchResults.map((result) => (
              <button
                key={result.message_id} // Unique key for search result
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  onSearchResultSelect(result.session_id);
                }}
                className="w-full text-left px-3 py-2.5 rounded-md border border-transparent hover:bg-accent hover:border-border transition-colors group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[12px] font-semibold truncate text-foreground flex-1">
                    {result.session_title}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
                    {formatTime(result.created_at)}
                  </span>
                </div>
                <div
                  className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed opacity-90 group-hover:opacity-100"
                  dangerouslySetInnerHTML={{ __html: result.snippet }}
                />
              </button>
            ))
          )
        ) : sessions.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-3 text-muted-foreground opacity-60">
            <span className="material-symbols-outlined text-[32px]">forum</span>
            <p className="text-[12px]">
              No chat sessions yet.
              <br />
              Start a new conversation!
            </p>
          </div>
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
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onBeginRename(session);
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                    e.preventDefault();
                    onSelect(session.id);
                  }
                }}
                className={`group relative w-full text-left p-2.5 rounded-md border transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-background border-border shadow-sm ring-1 ring-border/50"
                    : "bg-transparent border-transparent hover:bg-sidebar-accent hover:border-sidebar-border text-sidebar-foreground"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      chat_bubble
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
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
                        className="w-full h-5 px-1 rounded border border-input bg-background text-[12px] font-medium outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                    ) : (
                      <p
                        className={`text-[12px] font-medium truncate leading-5 ${
                          isActive ? "text-foreground" : "text-sidebar-foreground"
                        }`}
                        title={session.title || "New Session"}
                      >
                        {session.title || "New Session"}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{formatTime(session.updatedAt)}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-border" />
                      <span>{session.turns} msgs</span>
                    </div>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-sidebar/90 backdrop-blur-sm rounded-md pl-1 shadow-sm border border-border/50">
                   <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportSessionToMarkdown(session);
                    }}
                    title="Export Markdown"
                    className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      download
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBeginRename(session);
                    }}
                    title="Rename (F2)"
                    className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                    title="Delete"
                    className="p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-border shrink-0 bg-sidebar/50">
        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1.5 opacity-70">
          Double-click or <kbd className="font-sans font-bold bg-muted px-1 rounded border border-border">F2</kbd> to rename
        </p>
      </div>
    </aside>
  );
}
