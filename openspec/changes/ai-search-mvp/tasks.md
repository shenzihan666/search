# Implementation Tasks - AI Search MVP

## 1. Project Setup

- [x] 1.1 Initialize Tauri v2 project with Svelte template
- [x] 1.2 Configure Tailwind CSS v4 with Vite plugin
- [x] 1.3 Configure tauri.conf.json (transparent window, always-on-top)
- [x] 1.4 Add tauri-plugin-global-shortcut dependency

## 2. Window Management

- [x] 2.1 Implement window show/hide toggle
- [x] 2.2 Configure frameless transparent window
- [x] 2.3 Implement window position persistence

## 3. Global Hotkey

- [x] 3.1 Register Alt+Space hotkey
- [x] 3.2 Connect hotkey to window toggle

## 4. System Tray

- [x] 4.1 Create system tray icon
- [x] 4.2 Add tray menu (Show, Quit)
- [x] 4.3 Implement close-to-tray behavior

## 5. OpenAI Integration

- [x] 5.1 Create OpenAI API client in Rust
- [x] 5.2 Implement streaming chat completion
- [x] 5.3 Add API Key configuration command
- [x] 5.4 Implement error handling

## 6. Frontend Components

- [x] 6.1 Create SearchBox.svelte (input + submit)
- [x] 6.2 Create ResultPanel.svelte (display response)
- [x] 6.3 Add Markdown rendering
- [x] 6.4 Implement loading state
- [x] 6.5 Handle keyboard shortcuts (Enter, Esc)

## 7. Polish

- [x] 7.1 Add dark theme
- [x] 7.2 Style UI with Tailwind
- [x] 7.3 Test end-to-end flow
