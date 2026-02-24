# Session Columns Refactor

## Issue
The previous architecture tracked messages directly by `provider_id`, which created tight coupling between providers and message storage. This made it difficult to:
- Reorder provider columns within a session
- Switch providers for a specific column
- Track column-specific state independently of providers

## Root Cause
The original design conflated "which provider to use" with "which column to display messages in". This meant provider changes required complex message migration logic.

## Solution
Introduce a `chat_session_columns` table that acts as an indirection layer:
- Each session has N columns (1-4 based on multiplier)
- Each column has a position and a provider_id
- Messages are linked to columns via `column_id`, not directly to providers

## Changes

### Database (Rust)
- **v9 migration**: Creates `chat_session_columns` table with indexes
- **chat_session_columns.rs**: New repository with CRUD operations
- **chat_sessions.rs**: Updated to create columns on session create/update
- **chat_messages.rs**: Now uses `column_id` instead of direct provider linkage
- **mod.rs**: Exports new `ChatSessionColumnsRepository`

### Frontend (TypeScript/React)
- **chat.ts**: New `ChatSessionColumn` and `DbChatSessionColumnRecord` types
- **useChatSessions.ts**: Added `activeSessionColumns`, `loadSessionColumns`, `setColumnProvider`
- **Main.tsx**: Uses column-based pagination (`hasMoreByColumn`), selectable providers filter
- **ChatProviderColumn.tsx**: Adapted to column-based state
- **ChatMessageBubble.tsx**: Simplified message handling
- **useChatMessages.ts**: Column-aware message operations
- **useChatQuery.ts**: Column-based query dispatch
- **chatDb.ts**: Column-aware database operations

## Affected Files
- `src-tauri/src/db/migrations/mod.rs`
- `src-tauri/src/db/migrations/v9_session_columns.rs` (new)
- `src-tauri/src/db/mod.rs`
- `src-tauri/src/db/repositories/mod.rs`
- `src-tauri/src/db/repositories/chat_session_columns.rs` (new)
- `src-tauri/src/db/repositories/chat_sessions.rs`
- `src-tauri/src/db/repositories/chat_messages.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/provider/openai.rs`
- `src/types/chat.ts`
- `src/hooks/useChatSessions.ts`
- `src/hooks/useChatMessages.ts`
- `src/hooks/useChatQuery.ts`
- `src/pages/Main.tsx`
- `src/components/chat/ChatProviderColumn.tsx`
- `src/components/chat/ChatMessageBubble.tsx`
- `src/lib/chatDb.ts`
