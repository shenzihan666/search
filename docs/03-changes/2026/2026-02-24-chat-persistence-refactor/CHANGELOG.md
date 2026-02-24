# Changelog: Chat Persistence Schema Refactor

## Issue Statement

The original chat persistence implementation (v5-v6) stored user messages in a shared bucket with empty `provider_id`, causing:
- Data integrity issues when reconstructing per-provider conversation history
- Complexity in message ownership tracking
- Inconsistent behavior across multi-model chat sessions

Additionally, the schema included derived fields (`panes_json`, `turns`) that were redundant with computed values and should not be persisted.

## Root Cause

1. **Design Oversight**: Initial implementation assumed shared user messages would simplify storage, but this created complexity in the frontend's per-provider message handling.
2. **Schema Bloat**: `panes_json` and `turns` were persisted despite being derivable from `chat_messages` at query time.

## Implemented Changes

### Database Migrations

| Version | File | Description |
|---------|------|-------------|
| v5 | `v5_chat_sessions.rs` | Chat sessions table with provider list |
| v6 | `v6_chat_messages.rs` | Chat messages table with per-provider tracking |
| v7 | `v7_refactor_schema.rs` | Remove `panes_json`/`turns`, add `system_prompt`, FTS5 |
| v8 | `v8_fix_shared_messages.rs` | Migrate shared user messages to per-provider copies |

### Frontend Changes

| Component | Change |
|-----------|--------|
| `useChatMessages` | Per-provider message management, pagination (P10), delete (P11) |
| `useChatSessions` | Session lifecycle, system prompt support (P8) |
| `useChatQuery` | Per-provider history building, retry logic |
| `Main.tsx` | System prompt editor, pagination UI, message deletion |
| `ChatProviderColumn` | Load more, delete message, retry actions |
| `ChatSidebar` | FTS5 search integration (P13) |

### Backend Commands Added

```rust
// Session commands
list_chat_sessions
create_chat_session
rename_chat_session
save_chat_session_state
set_session_system_prompt  // P8
delete_chat_session

// Message commands
list_chat_messages         // P10 pagination
count_chat_messages
create_chat_message
update_chat_message
delete_chat_message        // P11
search_chat_messages       // P13 FTS5
export_session_messages    // P13 export
```

## Affected Files

### Frontend
- `src/pages/Main.tsx` - Orchestrator with chat mode state machine
- `src/hooks/useChatSessions.ts` - Session persistence hook
- `src/hooks/useChatMessages.ts` - Message CRUD with pagination
- `src/hooks/useChatQuery.ts` - Multi-provider query orchestration
- `src/components/chat/ChatProviderColumn.tsx` - Per-provider message display
- `src/components/chat/ChatSidebar.tsx` - Session list with search
- `src/components/chat/ChatMessageBubble.tsx` - Message display with actions
- `src/components/chat/MarkdownContent.tsx` - Markdown rendering
- `src/lib/chatDb.ts` - Tauri invoke abstraction layer
- `src/types/chat.ts` - TypeScript type definitions

### Backend
- `src-tauri/src/lib.rs` - Tauri command registration
- `src-tauri/src/db/mod.rs` - Module exports
- `src-tauri/src/db/migrations/mod.rs` - Migration runner (v5-v8)
- `src-tauri/src/db/migrations/v5_chat_sessions.rs`
- `src-tauri/src/db/migrations/v6_chat_messages.rs`
- `src-tauri/src/db/migrations/v7_refactor_schema.rs`
- `src-tauri/src/db/migrations/v8_fix_shared_messages.rs`
- `src-tauri/src/db/repositories/chat_sessions.rs`
- `src-tauri/src/db/repositories/chat_messages.rs`

## Validation Results

### Database Migration Test
```bash
# Fresh install → v8 in single run
npm run tauri:dev
# Expected: No migration errors, schema_version = 8
```

### Per-Provider Message Test
1. Create session with 2 providers
2. Send "Hello"
3. Verify: 2 user messages created (one per provider)
4. Send follow-up
5. Verify: Each provider has independent conversation history

### FTS5 Search Test
1. Create sessions with distinct content
2. Search from sidebar
3. Verify: Results show snippet with highlighted match

### Rollback Test
1. Delete database file
2. Restart app
3. Verify: Fresh database created at v8

## Rollback Plan

### If v8 migration fails:
1. Delete `%APPDATA%\com.search.app\search.db`
2. App recreates database at v8 on next launch
3. All chat history lost (acceptable for alpha)

### If frontend incompatible:
1. Revert frontend to pre-P7 commit
2. Database remains at v8 (backward compatible read)
3. New features disabled but app functional

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| DB Version | 4 | 8 |
| Migration Count | 4 | 8 |
| Tauri Commands | 14 | 28 |
| Frontend Hooks | 3 | 6 |
| Chat Tables | 0 | 3 (sessions, messages, fts) |
