# IMPLEMENTATION - SQLite Persistence and Settings UI

## Architecture Overview

### Database Layer (`src-tauri/src/db/`)

```
db/
  mod.rs              - Module entry, exports repositories
  connection.rs       - Lazy SQLite connection with thread-local storage
  error.rs            - DbError enum (Connection, Query, Io, Secret, Json)
  schema.rs           - AppRecord, AppUsageRecord, SettingEntry, SchemaVersion
  migrations/
    mod.rs            - Migration runner with version tracking
    v1_initial.rs     - Creates apps, app_usage, settings, schema_version tables
    v2_normalized_path.rs - Adds normalized_path column, migrates existing data
  repositories/
    mod.rs            - Re-exports AppsRepository, SettingsRepository
    apps.rs           - App CRUD, usage tracking, icon storage, JSON migration
    settings.rs       - Key-value settings with keyring for API keys
```

### Database Schema

```sql
-- apps table
CREATE TABLE apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    normalized_path TEXT UNIQUE NOT NULL,
    publisher TEXT,
    icon_data TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- app_usage table
CREATE TABLE app_usage (
    app_id INTEGER PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
    launch_count INTEGER NOT NULL DEFAULT 0,
    last_launched_at INTEGER NOT NULL,
    first_launched_at INTEGER NOT NULL
);

-- settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- schema_version table
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);
```

### Frontend Routing

```tsx
// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Main />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</BrowserRouter>
```

### Key Design Decisions

1. **Thread-local connection**: SQLite connection stored in thread-local storage for sync access from `spawn_blocking` tasks.

2. **Normalized paths**: Paths normalized (lowercase, backslashes) to handle Windows path variations reliably.

3. **Keyring for secrets**: API keys stored in system keyring (Windows Credential Manager) instead of database.

4. **Migration strategy**: Versioned migrations run on startup; v1 creates tables, v2 adds normalized_path.

5. **Cache hierarchy**:
   - Memory cache for hot data (APP_CACHE, ICON_CACHE)
   - Database for persistence
   - JSON migration for backwards compatibility

### Data Flow

```
App Launch
    |
    v
initialize_cache()
    |
    +-- Try load from database --> APP_CACHE (memory)
    |       |
    |       +-- Empty? --> refresh_cache() --> scan + save to DB
    |
    +-- migrate_from_json() --> one-time JSON migration
```

### Settings Window Configuration (tauri.conf.json)

```json
{
  "title": "Settings",
  "label": "settings",
  "url": "/settings",
  "width": 1000,
  "height": 700,
  "resizable": true,
  "visible": false,
  "decorations": false,
  "transparent": true,
  "shadow": true
}
```

### Settings Window Flow

```
Tray "Settings" click
    |
    v
lib.rs: "settings" handler
    |
    v
get_webview_window("settings")
    |
    v
window.show() + window.set_focus()
```
