# Implementation Tasks - AI Quick Search

## 1. Project Setup

- [ ] 1.1 Initialize Tauri v2 project with Svelte template
- [ ] 1.2 Configure Tailwind CSS v4 with Vite plugin
- [ ] 1.3 Set up project structure (src-tauri, src, lib/components)
- [ ] 1.4 Configure tauri.conf.json (window settings, permissions)
- [ ] 1.5 Add Tauri plugins dependencies (global-shortcut, autostart, store)

## 2. Rust Backend - Window Management

- [ ] 2.1 Implement window show/hide toggle logic
- [ ] 2.2 Configure transparent, frameless, always-on-top window
- [ ] 2.3 Implement window position persistence
- [ ] 2.4 Handle window focus and blur events

## 3. Rust Backend - Global Hotkey

- [ ] 3.1 Set up tauri-plugin-global-shortcut
- [ ] 3.2 Implement Alt+Space default hotkey registration
- [ ] 3.3 Connect hotkey to window toggle
- [ ] 3.4 Implement custom hotkey configuration
- [ ] 3.5 Handle hotkey conflicts gracefully

## 4. Rust Backend - System Tray

- [ ] 4.1 Create system tray icon and menu
- [ ] 4.2 Implement tray menu items (Show/Hide, Settings, Quit)
- [ ] 4.3 Handle tray icon click events
- [ ] 4.4 Implement close-to-tray behavior

## 5. Rust Backend - Autostart

- [ ] 5.1 Set up tauri-plugin-autostart
- [ ] 5.2 Implement enable/disable autostart commands
- [ ] 5.3 Add autostart status check command

## 6. Rust Backend - Provider System

- [ ] 6.1 Define AIProvider trait
- [ ] 6.2 Implement OpenAI provider client with streaming
- [ ] 6.3 Implement Anthropic provider client with streaming
- [ ] 6.4 Implement Ollama provider client with streaming
- [ ] 6.5 Implement custom OpenAI-compatible provider
- [ ] 6.6 Create ProviderRegistry for managing providers

## 7. Rust Backend - Query Engine

- [ ] 7.1 Implement parallel query execution
- [ ] 7.2 Implement streaming response via Tauri events
- [ ] 7.3 Add per-query timeout handling
- [ ] 7.4 Implement query cancellation
- [ ] 7.5 Add error isolation between providers

## 8. Rust Backend - Secure Storage

- [ ] 8.1 Implement API key storage using system keyring
- [ ] 8.2 Create provider config management (JSON)
- [ ] 8.3 Set up SQLite for history storage
- [ ] 8.4 Implement config CRUD commands

## 9. Rust Backend - History Management

- [ ] 9.1 Create history database schema
- [ ] 9.2 Implement save query record command
- [ ] 9.3 Implement list history command with pagination
- [ ] 9.4 Implement search history command (full-text)
- [ ] 9.5 Implement delete history commands (single/all)
- [ ] 9.6 Add auto-cleanup for expired records

## 10. Svelte Frontend - Core Components

- [ ] 10.1 Create App.svelte root layout
- [ ] 10.2 Create SearchBox.svelte (input + submit)
- [ ] 10.3 Create ModelPicker.svelte (multi-select)
- [ ] 10.4 Create ResultPanel.svelte (single model result)
- [ ] 10.5 Create ResultGrid.svelte (multi-panel layout)

## 11. Svelte Frontend - Result Display

- [ ] 11.1 Implement Markdown rendering
- [ ] 11.2 Add code syntax highlighting
- [ ] 11.3 Implement streaming text display
- [ ] 11.4 Add copy response button
- [ ] 11.5 Add response time display

## 12. Svelte Frontend - Settings

- [ ] 12.1 Create SettingsPanel.svelte
- [ ] 12.2 Create ProviderConfig.svelte (add/edit/delete providers)
- [ ] 12.3 Create HotkeyConfig.svelte
- [ ] 12.4 Create GeneralSettings.svelte (autostart, minimize, etc.)
- [ ] 12.5 Implement API key secure input

## 13. Svelte Frontend - History

- [ ] 13.1 Create HistoryPanel.svelte
- [ ] 13.2 Implement history list with search
- [ ] 13.3 Create history detail view
- [ ] 13.4 Add "re-query" functionality
- [ ] 13.5 Implement delete/clear history

## 14. Svelte Frontend - State Management

- [ ] 14.1 Create results store (reactive state)
- [ ] 14.2 Create settings store
- [ ] 14.3 Create history store
- [ ] 14.4 Create providers store
- [ ] 14.5 Implement Tauri event listeners

## 15. Integration & Polish

- [ ] 15.1 Connect frontend to all backend commands
- [ ] 15.2 Implement dark/light theme support
- [ ] 15.3 Add keyboard shortcuts (Enter to submit, Esc to close)
- [ ] 15.4 Implement responsive layout adjustments
- [ ] 15.5 Add loading states and error displays

## 16. Testing & Optimization

- [ ] 16.1 Test all provider integrations
- [ ] 16.2 Verify cross-platform hotkey behavior
- [ ] 16.3 Test autostart on all platforms
- [ ] 16.4 Optimize startup time
- [ ] 16.5 Profile and reduce memory usage
- [ ] 16.6 Test system tray behavior

## 17. Build & Distribution

- [ ] 17.1 Configure Windows installer (NSIS/MSI)
- [ ] 17.2 Configure macOS DMG/APP bundle
- [ ] 17.3 Configure Linux AppImage/deb/rpm
- [ ] 17.4 Add app icons for all platforms
- [ ] 17.5 Configure auto-update (optional)
