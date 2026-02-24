# Change Index

All changes are archived with implementation details, validation evidence, and rollback guidance.

## 2026

### 2026-02-24: Session Columns Refactor
- **Status**: Completed
- **Scope**: v9 database migration, chat_session_columns table, column-based message linkage
- **Archive**: `docs/03-changes/2026/2026-02-24-session-columns/`
- **Key Changes**:
  - New `chat_session_columns` table for column abstraction
  - Messages linked to columns via `column_id` instead of direct provider linkage
  - Enables column reordering and provider switching per column
  - Backfill migration for existing data

### 2026-02-24: Chat Persistence Schema Refactor
- **Status**: Completed
- **Scope**: v5-v8 database migrations, per-provider message ownership, FTS5 search, pagination, system prompts
- **Archive**: `docs/03-changes/2026/2026-02-24-chat-persistence-refactor/`
- **Key Changes**:
  - Each provider maintains independent message history
  - Turns computed at read time (not persisted)
  - Per-session system prompts
  - Full-text search across all messages
  - Pagination support for large conversations

### 2026-02-23: Multi-Model Chat
- **Status**: Completed
- **Scope**: Tab-to-query, embedded chat mode, multiplier button, real API calls to OpenAI/Anthropic/Google/Volcengine/Glm
- **Archive**: `docs/03-changes/2026/2026-02-23-multi-model-chat/`

### 2026-02-23: Multi-Provider CRUD
- **Status**: Completed
- **Scope**: Multi-provider CRUD with database migrations, React hook, connection testing
- **Archive**: `docs/03-changes/2026/2026-02-23-multi-provider-crud/`

### 2026-02-23: SQLite Persistence and Settings UI
- **Status**: Completed
- **Scope**: SQLite database layer, repository pattern, keyring API storage, React Router routing, Settings page
- **Archive**: `docs/03-changes/2026/2026-02-23-sqlite-persistence-and-settings-ui/`

### 2026-02-23: Window Interaction Polish
- **Status**: Completed
- **Scope**: ESC hide, focus-loss auto-hide, visual outer-shadow cleanup
- **Archive**: `docs/03-changes/2026/2026-02-23-window-interaction-polish/`

### 2026-02-23: Git Hooks Hardening
- **Status**: Completed
- **Scope**: Husky + lint-staged + commitlint setup, pre-push verification, contributor setup docs
- **Archive**: `docs/03-changes/2026/2026-02-23-git-hooks-hardening/`

---

## Index Legend

| Status | Description |
|--------|-------------|
| Completed | Implemented, tested, and documented |
| In Progress | Currently being implemented |
| Planned | Scheduled for future sprint |
| Rolled Back | Reverted due to issues |

## Archive Requirements

Each change archive must contain:
- `CHANGELOG.md` - Issue, root cause, changes, affected files
- `IMPLEMENTATION.md` - Design decisions, algorithms, technical details
- `VALIDATION.md` - Test checklist, performance benchmarks, sign-off
