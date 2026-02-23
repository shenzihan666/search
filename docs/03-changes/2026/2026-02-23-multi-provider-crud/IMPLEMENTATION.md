# Implementation: Multi-Provider CRUD

## Architecture

### Database Schema (V3/V4)

```sql
CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    base_url TEXT,
    model TEXT NOT NULL,
    api_key TEXT,  -- Moved from keyring in V4
    is_active INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### Repository Pattern

`ProvidersRepository` provides:
- `create(req)` - Create with auto-UUID, auto-activate first provider
- `list()` - Returns `ProviderView` with `has_api_key` computed field
- `get(id)` - Get single provider
- `get_active_with_key()` - Get active provider with API key for queries
- `update(id, req)` - Dynamic field updates
- `delete(id)` - Delete with auto-activate fallback
- `set_active(id)` - Exclusive active selection
- `set_api_key(id, key)` / `get_api_key(id)` - API key management

### Frontend Hook

`useProviders()` hook manages:
- Provider list state with loading/error states
- CRUD operations with automatic UI refresh
- Active provider tracking
- Connection testing with timeout

### Provider Types

Supported provider types:
- `openai` - OpenAI GPT models
- `anthropic` - Claude models
- `google` - Gemini models
- `custom` - User-defined endpoints

## Key Design Decisions

1. **API Key Storage**: Moved from keyring to SQLite for reliability (V4 migration)
2. **Auto-activation**: First provider automatically active; deletion triggers fallback
3. **Display Order**: Providers ordered by `display_order` field
4. **Legacy Compatibility**: Kept `set_config`/`get_config` commands for backwards compatibility
