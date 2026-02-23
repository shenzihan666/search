# CLAUDE.md

This file provides working guidance for coding agents in this repository.

## Project Overview

AI Quick Search is a Tauri desktop launcher-style app.
- Tray application with global shortcut `Alt+Space` to toggle the main window.
- React frontend with command-palette style UI using shadcn/cmdk.
- Rust backend with:
  - Windows application search via registry scanning
  - Placeholder AI streaming response pipeline

## Development Environment

- Platform: Windows
- Shell: PowerShell (use PowerShell syntax for commands)
- Workspace root: `D:\Project\search`

Common commands:
```bash
# Development
npm run dev
npm run tauri:dev

# Build
npm run build
npm run tauri:build

# Utility
npm run preview
npm run tauri
```

## Current Codebase Reality (Do Not Assume Missing Parts Exist)

### Frontend (`src/`)
- `src/App.tsx`: React Router setup with two routes (`/` and `/settings`).
- `src/pages/Main.tsx`: Main launcher UI.
  - Real-time app search with 150ms debounce via `search_apps` command.
  - Invokes `query_stream` for AI queries.
  - Listens to `query:chunk` events for streaming text.
  - Handles `Esc` to hide the window.
  - Enter launches first app result or submits AI query.
  - Settings button opens settings window via Tauri Window API.
- `src/pages/Settings.tsx`: Settings page with multi-provider configuration.
  - Uses `useProviders` hook for provider state management.
  - Custom titlebar with minimize, maximize, close controls.
  - Sidebar navigation structure (General, LLM Models, Hotkeys, Appearance, About).
- `src/components/ui/*`: shadcn/cmdk-based UI primitives.
- `src/components/ProviderCard.tsx`: Provider card component for CRUD UI.
- `src/hooks/useProviders.ts`: React hook for provider state and operations.
- `src/types/provider.ts`: TypeScript types for providers (Provider, ProviderView, etc.).

### Backend (`src-tauri/src/`)
- `src-tauri/src/main.rs`: entry point calling `app_lib::run()`.
- `src-tauri/src/lib.rs`: Tauri setup and window/tray/shortcut behavior.
  - Registers global shortcut `alt+space`.
  - Tray menu: `Show`, `Settings` (opens settings window), `Quit`.
  - Hides window on focus loss (`WindowEvent::Focused(false)`).
  - Initializes database and app cache at startup.
- `src-tauri/src/db/`: SQLite database module.
  - `mod.rs`: Module entry point, exports repositories.
  - `connection.rs`: Thread-local SQLite connection management.
  - `error.rs`: Database error types (Connection, Query, Io, Secret, Json).
  - `schema.rs`: Data structures (AppRecord, AppUsageRecord, SettingEntry).
  - `migrations/`: Versioned schema migrations (v1_initial, v2_normalized_path, v3_providers, v4_provider_api_key_sqlite).
  - `repositories/apps.rs`: Apps CRUD, usage tracking, icon storage, JSON migration.
  - `repositories/settings.rs`: Key-value settings with system keyring for API keys.
  - `repositories/providers.rs`: Multi-provider CRUD with API key management.
- `src-tauri/src/provider/mod.rs`: Provider types, request/response structures.
- `src-tauri/src/provider/openai.rs`: Connection testing and query integration.
- `src-tauri/src/apps/`: Windows application search module.
  - `mod.rs`: Tauri commands (`search_apps`, `launch_app`, `refresh_app_cache`).
  - `scanner.rs`: Registry-based app discovery (Start Menu scanning disabled).
  - `cache.rs`: In-memory cache backed by SQLite database.

### Exposed Tauri Commands
- `query_stream(prompt)` - AI query with streaming response
- `set_config(config)` - Set provider configuration (legacy, persists to database + keyring)
- `get_config()` - Get current provider configuration (legacy, loads from database + keyring)
- `list_providers()` - List all providers with API key status
- `create_provider(req)` - Create a new provider
- `update_provider(id, req)` - Update provider settings
- `delete_provider(id)` - Delete a provider
- `set_active_provider(id)` - Set the active provider
- `get_provider_api_key(id)` - Get API key for a provider
- `set_provider_api_key(id, api_key)` - Set API key for a provider
- `test_provider_connection(id)` - Test connection to a provider
- `search_apps(query)` - Fuzzy search installed applications
- `launch_app(path)` - Launch application by executable path
- `refresh_app_cache()` - Force refresh app cache
- `get_suggestions(limit)` - Get suggested apps based on usage statistics
- `get_app_icon(path)` - Get base64 icon data for an application

### Key Dependencies (Rust)
- `windows-registry` - Windows registry access for app scanning
- `fuzzy-matcher` - Fuzzy string matching for app search
- `dirs` - Cross-platform directory paths
- `rusqlite` - SQLite database for persistence
- `keyring` - System keyring for secure API key storage
- `uuid` - UUID generation for provider IDs
- `reqwest` - HTTP client for provider connection testing

### Key Dependencies (Frontend)
- `react-router-dom` - Client-side routing

## Window Behavior Contract

- App window starts hidden and is toggled by `Alt+Space`.
- Pressing `Esc` hides the window.
- Losing focus hides the window.
- Tray left click or `Show` menu item shows and focuses the window.

## Documentation Policy (docs/)

Documentation is standardized under `docs/`:
- `docs/00-governance/` - standards and documentation rules
- `docs/01-architecture/` - architecture notes
- `docs/02-runbooks/` - operational checklists/runbooks
- `docs/03-changes/` - dated change archives

Key files:
- `docs/README.md`
- `docs/00-governance/documentation-standards.md`
- `docs/03-changes/CHANGE-INDEX.md`

### Mandatory Change Archival

For every meaningful code change (feature, fix, behavior change), add an archive folder:
- Path format: `docs/03-changes/YYYY/YYYY-MM-DD-<short-topic>/`
- Required files:
  - `CHANGELOG.md`
  - `IMPLEMENTATION.md`
  - `VALIDATION.md`
- Update `docs/03-changes/CHANGE-INDEX.md` in the same change.

## Accuracy Rules for Agents

- Verify repository state before documenting architecture/features.
- Do not document planned functionality as implemented behavior.
- If behavior is TODO/placeholder, mark it explicitly.
