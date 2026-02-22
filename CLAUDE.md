# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Quick Search is a lightweight desktop AI search bar application with multi-model support. It runs as a system tray app with a global hotkey (Alt+Space) to quickly toggle the search window.

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

## Architecture

### Tech Stack
- **Frontend**: Svelte 5 (with runes: `$state`, `$props`, `$derived`) + Vite + Tailwind CSS v4
- **Backend**: Tauri v2 + Rust
- **AI Integration**: async-openai crate (supports OpenAI and Gemini via OpenAI-compatible API)

### Frontend Structure (`src/`)
- `App.svelte` - Main app component, handles window events and streaming responses
- `lib/components/SearchBox.svelte` - Input field with submit handling
- `lib/components/ResultPanel.svelte` - Displays streaming AI responses
- `lib/components/ConfigModal.svelte` - Provider/API key/model settings

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
- Window starts hidden, toggles via Alt+Space global shortcut
- Close button hides window instead of closing (close-to-tray)
- System tray icon with Show/Quit menu

### Configuration
- `ProviderConfig` struct holds: `api_key`, `model`, `provider_type` (openai/gemini), optional `base_url`
- Configuration is stored in-memory (not persisted between sessions)
- Default model: `gpt-4o-mini` for OpenAI, `gemini-2.0-flash` for Gemini

## Key Dependencies

### Rust (Cargo.toml)
- `tauri` v2.10.0 with tray-icon feature
- `tauri-plugin-global-shortcut` v2
- `async-openai` v0.28 - OpenAI API client with streaming
- `tokio` with full features for async runtime

### JavaScript (package.json)
- `svelte` v5.53.2 - Frontend framework
- `@tauri-apps/api` v2.10.1 - Tauri frontend API
- `tailwindcss` v4.2.0 with `@tailwindcss/vite` plugin

## OpenSpec

This project uses OpenSpec for change management. Specs are in `openspec/changes/ai-quick-search/specs/` covering features like global-hotkey, multi-model-query, model-provider, result-comparison, system-tray, autostart, and query-history.
