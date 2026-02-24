# Implementation Notes: Chat Persistence Schema Refactor

## Design Decisions

### D1: Per-Provider Message Ownership

**Decision**: Each provider has its own copy of user messages.

**Rationale**:
- Enables independent conversation history per provider
- Simplifies history reconstruction for API calls
- Allows per-provider retry without affecting others
- Future: Per-provider message editing/deletion

**Trade-off**: Storage duplication (N user messages for N providers)
- Acceptable given typical session sizes (<1000 messages)

### D2: Computed Turns

**Decision**: `turns` is computed at read time via `COUNT(user messages)`.

**Rationale**:
- Single source of truth (no sync issues)
- No migration needed when message structure changes
- Negligible performance impact (subquery)

**Implementation**:
```sql
SELECT s.*, (SELECT COUNT(*) FROM chat_messages m
             WHERE m.session_id = s.id AND m.role = 'user') AS turns
FROM chat_sessions s
```

### D3: System Prompt Per Session

**Decision**: Optional `system_prompt` column on `chat_sessions`.

**Rationale**:
- Allows session-specific persona tuning
- Empty by default (backwards compatible)
- Sent to all providers in session

### D4: FTS5 for Message Search

**Decision**: Use SQLite FTS5 virtual table for full-text search.

**Rationale**:
- Native SQLite feature, no external dependencies
- Fast prefix and phrase matching
- Built-in snippet generation with highlighting

**Implementation**:
```sql
CREATE VIRTUAL TABLE chat_messages_fts USING fts5(
    content,
    content='chat_messages',
    content_rowid='rowid',
    tokenize='unicode61'
);
```

### D5: Pagination Strategy

**Decision**: Offset-based pagination with 100-message pages.

**Rationale**:
- Simpler than cursor-based for our use case
- 100 messages balances latency and UX
- "Load More" button per provider column

**Implementation**:
```typescript
const PAGE_SIZE = 100;
// Initial load: all messages (limit=0)
// Load more: PAGE_SIZE from current offset
```

## Key Algorithms

### Message History Building (for API)

```typescript
function buildHistory(providerId: string): ProviderHistoryMessage[] {
  const messages = getColumnMessages(providerId);
  return messages
    .filter(m => m.status !== 'error')
    .map(m => ({ role: m.role, content: m.content }));
}
```

### Streaming Message Update

```typescript
// On chunk received
updateMessage(messageId, accumulatedContent, 'streaming');

// On completion
updateMessage(messageId, finalContent, 'done');

// On error
updateMessage(messageId, errorContent, 'error');
```

### Session State Persistence

```typescript
// On mode exit or provider change
await saveSessionState(sessionId, providerIds, prompt);

// Does NOT persist:
// - turns (computed)
// - panes (frontend state only)
```

## Error Handling

### Provider Call Failure
1. Mark message as `status: 'error'`
2. Preserve error content for display
3. Show retry button in UI
4. Allow per-provider retry without affecting others

### Database Lock
- SQLite connection uses `thread_local!` for thread safety
- All operations through `with_connection` wrapper
- Timeout: 10s for reads, 15s for writes

### Migration Failure
- Transactional: all migrations in single transaction
- On failure: database unchanged
- App continues with memory-only mode

## Concurrency Considerations

### Thread-Local Connection
```rust
thread_local! {
    static CONNECTION: RefCell<Option<Connection>> = const { RefCell::new(None) };
}
```

### Async Command Handling
- Tauri commands use `spawn_blocking` for DB operations
- Prevents blocking main thread during I/O
- Results in clean async/await on frontend

## Future Considerations

### P14: Message Branching
- Store `parent_message_id` for conversation trees
- Enable "what if" exploration

### P15: Export Formats
- JSON export (implemented)
- Markdown export (planned)
- PDF export (considering)

### P16: Sync
- Conflict-free replicated data types (CRDTs)
- Multi-device sync via iCloud/OneDrive
