# CHANGELOG - 2026-02-23 SQLite Persistence and Settings UI

## Change ID
- `CHG-2026-02-23-003`

## Status
- Completed

## Summary
- Added SQLite-based data persistence layer replacing JSON file storage.
- Implemented repository pattern for apps and settings data access.
- Migrated app cache, icon cache, and usage statistics to database.
- Added system keyring integration for secure API key storage.
- Restructured frontend with React Router for multi-page navigation.
- Implemented full-featured Settings UI page with LLM provider configuration.
- Added one-time migration from legacy JSON usage stats to SQLite.
- Connected tray "Settings" menu to open settings window.

## Affected Files
### Frontend
- `src/App.tsx` - Refactored to React Router with two routes
- `src/pages/Main.tsx` - Main launcher page (extracted from App.tsx)
- `src/pages/Settings.tsx` - New settings page with LLM configuration

### Backend - Database Module
- `src-tauri/src/db/mod.rs` - Database module entry point
- `src-tauri/src/db/connection.rs` - SQLite connection management
- `src-tauri/src/db/error.rs` - Database error types
- `src-tauri/src/db/schema.rs` - Data structure definitions
- `src-tauri/src/db/migrations/mod.rs` - Migration runner
- `src-tauri/src/db/migrations/v1_initial.rs` - Initial schema migration
- `src-tauri/src/db/migrations/v2_normalized_path.rs` - Path normalization migration
- `src-tauri/src/db/repositories/mod.rs` - Repository exports
- `src-tauri/src/db/repositories/apps.rs` - Apps data repository
- `src-tauri/src/db/repositories/settings.rs` - Settings repository with keyring

### Backend - Modified
- `src-tauri/src/lib.rs` - Database initialization, settings window handler
- `src-tauri/src/apps/cache.rs` - Refactored to use database instead of JSON

### Dependencies
- `src-tauri/Cargo.toml` - Added rusqlite, keyring dependencies
- `package.json` - Added react-router-dom

## Breaking Changes
- Legacy `usage-stats.json` file is automatically migrated and deleted
- Database file stored at `{app_local_data_dir}/data.db`
