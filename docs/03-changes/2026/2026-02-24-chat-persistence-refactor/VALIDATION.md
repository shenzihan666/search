# Validation Checklist: Chat Persistence Schema Refactor

## Pre-Deployment Verification

### Database Integrity
- [ ] Fresh install creates v8 schema
- [ ] Migration from v4 succeeds
- [ ] Migration from v5 succeeds
- [ ] Migration from v6 succeeds
- [ ] Migration from v7 succeeds
- [ ] `schema_version` table shows version 8
- [ ] All tables have expected columns
- [ ] FTS5 table `chat_messages_fts` exists
- [ ] Foreign key constraints enabled

### Functional Tests

#### Session Management
- [ ] Create session with 1 provider
- [ ] Create session with 2 providers
- [ ] Create session with 4 providers
- [ ] Rename session via F2 shortcut
- [ ] Delete session (cascades to messages)
- [ ] Auto-activate most recent session on chat mode entry

#### Message Flow
- [ ] User message creates N copies for N providers
- [ ] Assistant message creates 1 copy per provider
- [ ] Streaming updates message content in real-time
- [ ] Error status shows retry button
- [ ] Retry sends same prompt to single provider

#### Pagination
- [ ] Initial load fetches all messages
- [ ] "Load More" fetches next 100 messages
- [ ] "Load More" disabled when no more messages
- [ ] Pagination offset tracked per-provider

#### Search
- [ ] Sidebar search returns matching messages
- [ ] Search results show session title
- [ ] Search results show highlighted snippet
- [ ] Clicking result opens target session

#### System Prompt
- [ ] Toggle system prompt editor button visible
- [ ] Empty prompt shows placeholder
- [ ] Saved prompt persists across sessions
- [ ] Prompt sent to all providers on query

### Edge Cases

#### Concurrent Operations
- [ ] Rapid message creation doesn't deadlock
- [ ] Session switch while streaming continues background
- [ ] Multiple provider responses update independently

#### Data Integrity
- [ ] Empty session title defaults to "New Session"
- [ ] Deleted message removes from UI and DB
- [ ] Export session returns all messages in order

### Performance Benchmarks

| Operation | Target | Measured |
|-----------|--------|----------|
| List 50 sessions | < 50ms | ___ |
| Load 100 messages | < 100ms | ___ |
| FTS5 search | < 50ms | ___ |
| Create message | < 10ms | ___ |
| Update message | < 10ms | ___ |

### Regression Tests

#### App Search (Unchanged)
- [ ] `Alt+Space` toggles window
- [ ] Fuzzy search returns results
- [ ] Enter launches first result
- [ ] Focus loss hides window

#### Provider CRUD (Unchanged)
- [ ] List providers
- [ ] Create provider
- [ ] Update provider
- [ ] Delete provider
- [ ] Set API key
- [ ] Test connection

### Platform-Specific

#### Windows
- [ ] Database path: `%APPDATA%\com.search.app\search.db`
- [ ] Keyring integration (legacy)
- [ ] Registry scanner unaffected

### Accessibility

- [ ] Keyboard navigation in chat mode
- [ ] Focus visible on interactive elements
- [ ] Screen reader announces message updates
- [ ] Color contrast meets WCAG AA

## Post-Deployment Monitoring

### Error Rates
- Monitor `DbError::Query` frequency
- Track streaming timeout occurrences
- Alert on migration failures (fresh installs)

### Usage Metrics
- Average messages per session
- Average providers per session
- Search query frequency
- System prompt usage rate

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Developer | | |
| QA | | |
| Product | | |
