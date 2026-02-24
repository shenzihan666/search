# Architecture Overview

## System Architecture

AI Quick Search is a Tauri-based desktop application following a hybrid architecture pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tauri Application Shell                      │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)          │  Backend (Rust)       │
│  ───────────────────────────────────────│──────────────────────│
│  • React 19 with React Router           │  • Tauri v2 Runtime   │
│  • shadcn/cmdk UI Components            │  • SQLite Persistence │
│  • Custom Hooks (State Management)      │  • System Keyring     │
│  • Tauri API Integration                │  • HTTP Client        │
├─────────────────────────────────────────┴───────────────────────┤
│                      Platform Layer (Windows)                     │
│  • Registry Scanner • System Tray • Global Shortcuts             │
└─────────────────────────────────────────────────────────────────┘
```

## Module Boundaries

### Frontend Modules (`src/`)

| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| **Pages** | Route-level components | `Main.tsx`, `Settings.tsx` |
| **Components** | Reusable UI primitives | `components/ui/`, `components/chat/` |
| **Hooks** | State & business logic | `useProviders`, `useChatSessions`, `useChatMessages`, `useChatQuery` |
| **Types** | TypeScript definitions | `types/provider.ts`, `types/chat.ts` |
| **Lib** | Utilities & API layer | `lib/utils.ts`, `lib/chatDb.ts` |

### Backend Modules (`src-tauri/src/`)

| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| **apps** | Windows app discovery & launch | `apps/scanner.rs`, `apps/cache.rs` |
| **db** | SQLite persistence layer | `db/connection.rs`, `db/repositories/` |
| **provider** | AI provider integrations | `provider/openai.rs`, `provider/mod.rs` |

## Database Schema (v8)

### Tables

```
schema_version
├── version: u32 (primary)
└── applied_at: u64

apps
├── id: integer (primary)
├── name, path, publisher, normalized_path
├── usage_count, last_used_at
└── icon_data (base64)

providers
├── id: string (UUID, primary)
├── name, provider_type, base_url, model
├── api_key (encrypted in SQLite)
├── is_active, created_at, updated_at

settings
├── key: string (primary)
└── value: string (JSON)

chat_sessions
├── id: string (UUID, primary)
├── title, provider_ids_json, prompt, system_prompt
├── created_at, updated_at

chat_messages
├── id: string (UUID, primary)
├── session_id, provider_id (FK → chat_sessions)
├── role, content, status
├── created_at, updated_at

chat_messages_fts (FTS5 virtual table)
└── Full-text search index on message content
```

### Migration History

| Version | Description |
|---------|-------------|
| v1 | Initial schema (apps, settings) |
| v2 | Normalized paths + indexes |
| v3 | Multi-provider support |
| v4 | API key storage in SQLite |
| v5 | Chat sessions persistence |
| v6 | Chat messages persistence |
| v7 | Schema refactor (remove panes, add FTS5) |
| v8 | Per-provider message ownership |

## Data Flow

### Multi-Model Chat Flow

```
User Input
    │
    ▼
┌─────────────────┐
│   Main.tsx      │
│  (Orchestrator) │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│Prov 1 │ │Prov 2 │ │Prov N │  ← Parallel queries
└───┬───┘ └───┬───┘ └───┬───┘
    │         │         │
    ▼         ▼         ▼
┌─────────────────────────────┐
│    useChatQuery (Hook)       │
│  • Stream handling           │
│  • Error recovery            │
│  • Message persistence       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│    ChatDb (Tauri Invoke)     │
│  • create_chat_message       │
│  • update_chat_message       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│    SQLite (Rust Backend)     │
│  • ChatMessagesRepository    │
│  • ChatSessionsRepository    │
└─────────────────────────────┘
```

## Window Management

### Window Types

| Window | Route | Behavior |
|--------|-------|----------|
| Main | `/` | Tray toggle, `Alt+Space` shortcut, auto-hide on focus loss |
| Settings | `/settings` | Independent window, custom titlebar |

### Lifecycle

1. **App Start**: Main window hidden, database initialized, app cache loaded
2. **Alt+Space**: Toggle main window visibility, re-center on monitor
3. **Focus Loss**: Auto-hide main window (search mode only)
4. **Escape**: Hide window (search) or exit to search (chat)

## Provider Integration

### Supported Providers

| Provider | API Format | Features |
|----------|-----------|----------|
| OpenAI | OpenAI-compatible | Streaming, connection test |
| Anthropic | Native | Streaming, connection test |
| Google (Gemini) | Native | Streaming, connection test |
| Volcengine (Doubao) | OpenAI-compatible | Streaming, connection test |
| GLM (Zhipu) | OpenAI-compatible | Streaming, connection test |
| Custom | OpenAI-compatible | Streaming, connection test |

### API Flow

```
Frontend                    Backend
   │                           │
   │ invoke("query_stream_     │
   │        provider", ...)    │
   │──────────────────────────▶│
   │                           │  ┌───────────────┐
   │                           │  │ Build request │
   │                           │  │ per provider  │
   │                           │  └───────┬───────┘
   │                           │          │
   │  ◀──── emit("chunk") ◀────│──────────┘
   │  ◀──── emit("chunk") ◀────│  (streaming)
   │  ◀──── emit("done") ◀─────│
   │                           │
```

## Security Considerations

1. **API Key Storage**: Stored in SQLite database, optionally in system keyring (legacy)
2. **No Network Exposure**: All backend operations through Tauri IPC
3. **Local-First**: All data stored locally, no cloud sync

## Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| App Search Latency | < 50ms | Fuzzy match on cached apps |
| Cold Start | < 2s | First launch with cache population |
| Window Show | < 100ms | From hidden to visible + focused |
| Chat Response Start | < 1s | First token from provider |
