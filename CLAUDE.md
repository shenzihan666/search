# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Quick Search is a lightweight desktop AI search bar application with multi-model support. It runs as a system tray app with a global hotkey (Alt+Space) to quickly toggle the search window.

## Development Environment

- **Platform**: Windows 11
- **Shell**: PowerShell (NOT Git Bash)
- Always use PowerShell syntax for shell commands
- Path separator: backslash `\` or forward slash `/` both work in PowerShell
- Examples:
  - List files: `Get-ChildItem` or `ls` (alias)
  - Remove file: `Remove-Item path` or `rm path` (alias)
  - Copy file: `Copy-Item src dest` or `cp src dest` (alias)
  - Environment variables: `$env:VAR_NAME` (e.g., `$env:TAURI_DEBUG`)

## Commands

```bash
# Development
npm run dev          # Start Vite dev server only
npm run tauri:dev    # Start full Tauri dev mode (frontend + backend)

# Build
npm run build        # Build frontend only
npm run tauri:build  # Build production app

# Other
npm run preview      # Preview built frontend
npm run tauri        # Run Tauri CLI commands
```

## Key Features

- **Simplified UI**: Minimal search bar with input and send button only
- **Separate Settings Window**: Configuration accessed via system tray (not inline modal)
- **Focus-based Hiding**: Main window auto-hides when losing focus
- **Better Error Messages**: User-friendly messages for rate limits (429), auth errors (401), permission errors (403)
- **Multi-Provider Support**: OpenAI and Google Gemini with easy switching

## Architecture

### Tech Stack
- **Frontend**: Svelte 5 (with runes: `$state`, `$props`, `$derived`) + Vite + Tailwind CSS v4
- **Backend**: Tauri v2 + Rust
- **AI Integration**: async-openai crate (supports OpenAI and Gemini via OpenAI-compatible API)

### Frontend Structure (`src/`)
- `App.svelte` - Main app component, handles window events and streaming responses (simplified UI - search box only)
- `lib/components/SearchBox.svelte` - Input field with submit handling
- `lib/components/ResultPanel.svelte` - Displays streaming AI responses

### Settings Window
- `settings.html` - Standalone settings window for provider/API key/model configuration
- Accessible via system tray right-click menu (Settings option)

### Backend Structure (`src-tauri/src/`)
- `main.rs` - Entry point, calls `app_lib::run()`
- `lib.rs` - Tauri app setup: window management, system tray, global shortcut (Alt+Space), Tauri commands
- `provider/mod.rs` - Re-exports OpenAIClient and ProviderConfig
- `provider/openai.rs` - OpenAIClient implementation with streaming support, handles both OpenAI and Gemini providers

### Tauri Commands (Rust -> Frontend)
- `query(prompt)` - Non-streaming query (returns full response)
- `query_stream(prompt)` - Streaming query, emits `query:chunk` events to frontend
- `set_config(config)` - Set full provider configuration
- `get_config()` - Get current configuration
- `set_api_key(api_key, model?)` - Legacy command for backward compatibility

### Frontend-Backend Communication
- Frontend uses `@tauri-apps/api/core` invoke for commands
- Streaming: Backend emits `query:chunk` events, frontend listens via `@tauri-apps/api/event`

### Window Behavior
- Main window starts hidden, toggles via Alt+Space global shortcut
- Main window auto-hides when it loses focus (clicking outside)
- Close button hides window instead of closing (close-to-tray)
- System tray icon with Show/Settings/Quit menu
- Settings window accessible from system tray

### Configuration
- `ProviderConfig` struct holds: `api_key`, `model`, `provider_type` (openai/gemini), optional `base_url`
- Configuration is stored in-memory (not persisted between sessions)
- Default model: `gpt-4o-mini` for OpenAI, `gemini-2.0-flash` for Gemini

## Key Dependencies

### Rust (Cargo.toml)
- `tauri` v2.10.0 with tray-icon feature
- `tauri-plugin-global-shortcut` v2 - Global hotkey support (Alt+Space)
- `tauri-plugin-global-shortcut` v2
- `async-openai` v0.28 - OpenAI API client with streaming
- `tokio` with full features for async runtime

### JavaScript (package.json)
- `svelte` v5.53.2 - Frontend framework
- `@tauri-apps/api` v2.10.1 - Tauri frontend API
- `tailwindcss` v4.2.0 with `@tailwindcss/vite` plugin

## OpenSpec

This project uses OpenSpec for change management. Specs are in `openspec/changes/ai-quick-search/specs/` covering features like global-hotkey, multi-model-query, model-provider, result-comparison, system-tray, autostart, and query-history.

## Documentation

### Documentation Structure

All project documentation is organized in the `docs/` directory with enterprise-level structure:

- `docs/architecture/` - System design and technical architecture
- `docs/api/` - API references and command documentation
- `docs/guides/` - User and developer guides
- `docs/development/` - Development workflow and code standards
- `docs/operations/` - Installation, deployment, and maintenance
- `docs/ai-generated/` - AI-assistant generated documentation

### AI-Generated Documentation Policy

**AI-generated documentation MUST be archived in the `docs/ai-generated/` directory according to type:**

- **`docs/ai-generated/features/`** - New features, enhancements, implementations
- **`docs/ai-generated/fixes/`** - Bug fixes, patches, technical resolutions
- **`docs/ai-generated/reviews/`** - Code reviews, analysis summaries
- **`docs/ai-generated/investigations/`** - Research, debugging, exploration results

**Documentation Template:**
```markdown
# [Title]

**Generated**: {Date}
**AI Assistant**: Claude Code
**Related Files**: [file paths]

## Overview
[Brief description]

## Context
[Background information]

## Implementation/Analysis
[Technical content]

## Results/Outcomes
[What was achieved/discovered]

## Related Files
- [path/to/file.ext](../../path/to/file.ext) - Description
```

**Naming Conventions:**
- Features: `{feature-name}.md` (e.g., `global-hotkey.md`)
- Fixes: `{issue-id}-{description}.md` or `{description}-fix.md`
- Reviews: `review-{date}-{component}.md`
- Investigations: `investigation-{topic}.md`

**Always update the corresponding INDEX.md file when adding new documentation.**

See `docs/ai-generated/README.md` for detailed guidelines and templates.
