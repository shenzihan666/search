# Implementation Details

## Design Decisions

### Column ID Format
```
{session_id}:c{position}
```
Example: `abc123:c0`, `abc123:c1`, etc.

This format ensures:
- Uniqueness across all sessions
- Deterministic generation (no random IDs)
- Easy parsing for debugging

### Column-Message Relationship
```
chat_sessions
    └── chat_session_columns (N, ordered by position)
            └── chat_messages (N, linked via column_id)
```

### Migration Strategy (v9)
1. Create `chat_session_columns` table
2. Add `column_id` column to `chat_messages`
3. Backfill columns from existing session `provider_ids_json`
4. Backfill message `column_id` by matching `provider_id` to column

### State Management
- `activeSessionColumns`: Array of columns for the active session
- `hasMoreByColumn`: Pagination state keyed by column ID
- `pageOffsetByColumn`: Page offset per column

## Key Algorithms

### Column Creation
```rust
// On session create/update:
for (idx, provider_id) in provider_ids.iter().enumerate() {
    let column_id = format!("{session_id}:c{idx}");
    // INSERT OR REPLACE to handle updates
}
// Delete any stale columns if count shrank
```

### Message Column Assignment
```rust
// Find column by provider_id match, fallback to first column
let column_id = query(
    "SELECT id FROM chat_session_columns
     WHERE session_id = ?1 AND provider_id = ?2
     ORDER BY position LIMIT 1"
).or(query(
    "SELECT id FROM chat_session_columns
     WHERE session_id = ?1 ORDER BY position LIMIT 1"
));
```

## Backward Compatibility
- Migration v9 handles all legacy data
- Empty provider_ids defaults to single column with empty provider_id
- Fallback logic for orphaned messages
