# Database Migration Verification Runbook

Use this runbook to verify database migrations after schema changes.

## Prerequisites

- [ ] Rust toolchain installed
- [ ] SQLite CLI available (`sqlite3` command)
- [ ] Backup of existing database (if applicable)

## Migration Versions

| Version | Description | File |
|---------|-------------|------|
| v1 | Initial schema | `v1_initial.rs` |
| v2 | Normalized paths + indexes | `v2_normalized_path.rs` |
| v3 | Multi-provider support | `v3_providers.rs` |
| v4 | API key in SQLite | `v4_provider_api_key_sqlite.rs` |
| v5 | Chat sessions | `v5_chat_sessions.rs` |
| v6 | Chat messages | `v6_chat_messages.rs` |
| v7 | Schema refactor + FTS5 | `v7_refactor_schema.rs` |
| v8 | Per-provider messages | `v8_fix_shared_messages.rs` |
| v9 | Session columns abstraction | `v9_session_columns.rs` |

## Test Scenarios

### Scenario 1: Fresh Install

1. Delete existing database:
   ```powershell
   Remove-Item "$env:APPDATA\com.search.app\search.db" -ErrorAction SilentlyContinue
   ```

2. Launch application:
   ```powershell
   npm run tauri:dev
   ```

3. Verify schema version:
   ```powershell
   sqlite3 "$env:APPDATA\com.search.app\search.db" "SELECT * FROM schema_version;"
   ```
   Expected: `9|<timestamp>`

4. Verify all tables exist:
   ```powershell
   sqlite3 "$env:APPDATA\com.search.app\search.db" ".tables"
   ```
   Expected: `apps chat_messages chat_messages_fts chat_session_columns chat_sessions providers schema_version settings`

### Scenario 2: Upgrade from v4

1. Start with v4 database (pre-chat tables)
2. Launch application
3. Verify migration to v8:
   ```sql
   SELECT version FROM schema_version ORDER BY version;
   ```
   Expected rows: `1, 2, 3, 4, 5, 6, 7, 8, 9`

4. Verify chat tables created:
   ```sql
   SELECT sql FROM sqlite_master WHERE name='chat_sessions';
   SELECT sql FROM sqlite_master WHERE name='chat_messages';
   ```

### Scenario 3: Upgrade from v6 (Pre-v8 Fix)

1. Start with v6 database containing shared messages (`provider_id=''`)
2. Launch application
3. Verify v8 migration:
   ```sql
   SELECT COUNT(*) FROM chat_messages WHERE provider_id='';
   ```
   Expected: `0` (all migrated)

4. Verify messages duplicated:
   ```sql
   -- Each user message should have N copies for N providers in session
   SELECT session_id, COUNT(*) FROM chat_messages WHERE role='user' GROUP BY session_id;
   ```

### Scenario 4: Idempotent Migrations

1. Run migrations once
2. Restart application
3. Verify no duplicate migrations:
   ```sql
   SELECT COUNT(*) FROM schema_version WHERE version=8;
   ```
   Expected: `1`

## Schema Verification Queries

### chat_sessions

```sql
PRAGMA table_info(chat_sessions);
-- Expected columns: id, title, provider_ids_json, prompt, system_prompt, created_at, updated_at
```

### chat_messages

```sql
PRAGMA table_info(chat_messages);
-- Expected columns: id, session_id, provider_id, role, content, status, created_at, updated_at
```

### FTS5 Table

```sql
-- Verify FTS5 exists
SELECT sql FROM sqlite_master WHERE name='chat_messages_fts';
-- Should show: CREATE VIRTUAL TABLE... USING fts5(...)

-- Test FTS5 functionality
INSERT INTO chat_messages (id, session_id, provider_id, role, content, status, created_at, updated_at)
VALUES ('test-1', 'test-session', 'test-provider', 'user', 'hello world test', 'done', 0, 0);

SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'hello';
-- Should return the inserted row

DELETE FROM chat_messages WHERE id='test-1';
```

### Foreign Keys

```sql
PRAGMA foreign_key_list(chat_messages);
-- Expected: session_id -> chat_sessions(id) ON DELETE CASCADE
```

## Performance Checks

### Migration Time

Fresh install with v8 migrations should complete in < 500ms:
```rust
// In migrations/mod.rs, log timing
let start = std::time::Instant::now();
run_migrations(&conn)?;
println!("Migrations completed in {:?}", start.elapsed());
```

### Query Performance

```sql
-- List sessions with turns (subquery)
EXPLAIN QUERY PLAN
SELECT s.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id AND m.role = 'user') AS turns
FROM chat_sessions s ORDER BY s.updated_at DESC;

-- FTS5 search
EXPLAIN QUERY PLAN
SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'test' ORDER BY rank LIMIT 20;
```

## Rollback Procedures

### Full Database Reset

```powershell
# Stop application
# Delete database
Remove-Item "$env:APPDATA\com.search.app\search.db" -Force
# Restart application (creates fresh v8 database)
```

### Partial Rollback (Not Recommended)

Downgrading schema is not supported. If migration fails:
1. Check migration error in logs
2. Delete database and restart (data loss)
3. Report issue with migration version and error message

## Troubleshooting

### Migration Fails with "Table already exists"
- Cause: Partial migration from previous crash
- Fix: Delete database and restart

### FTS5 Not Available
- Cause: SQLite compiled without FTS5
- Fix: Use system SQLite or recompile with `-DSQLITE_ENABLE_FTS5`

### Foreign Key Constraint Failed
- Cause: Orphaned messages from v6
- Fix: v8 migration includes cleanup, or delete database

## Sign-Off

| Tester | Date | DB Version | Result |
|--------|------|------------|--------|
| | | 9 | Pass / Fail |
