# CLAUDE.md

This file provides working guidance for coding agents in this repository.

## Project Overview

AI Quick Search is a Tauri desktop launcher-style app.
- Tray application with global shortcut `Alt+Space` to toggle the main window.
- React frontend with command-palette style UI.
- Rust backend currently exposes a placeholder streaming response pipeline.

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
- `src/App.tsx`: main UI and user interactions.
  - Invokes `query_stream`.
  - Listens to `query:chunk` events for streaming text.
  - Handles `Esc` to hide the window.
- `src/components/ui/*`: shadcn/cmdk-based UI primitives.
- There is no standalone `settings.html` settings window implemented.

### Backend (`src-tauri/src/`)
- `src-tauri/src/main.rs`: entry point calling `app_lib::run()`.
- `src-tauri/src/lib.rs`: Tauri setup and window/tray/shortcut behavior.
  - Registers global shortcut `alt+space`.
  - Tray menu: `Show`, `Settings` (currently TODO), `Quit`.
  - Hides window on focus loss (`WindowEvent::Focused(false)`).
- `src-tauri/src/provider/openai.rs`:
  - Defines `ProviderConfig`.
  - Implements `query_stream` as placeholder simulated streaming.

### Exposed Tauri Commands
- `query_stream(prompt)`
- `set_config(config)`
- `get_config()`

Do not reference removed/non-existent commands such as `query` or `set_api_key`.

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
