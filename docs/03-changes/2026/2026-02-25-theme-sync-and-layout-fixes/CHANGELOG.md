# CHANGELOG - 2026-02-25 Theme Sync and Layout Fixes

## Change ID
- `CHG-2026-02-25-001`

## Status
- Completed

## Issue Statement
- Search mode launcher footer could be visually clipped when result lists were longer, especially on high-DPI displays.
- Theme behavior needed to consistently follow persisted app setting values, including `system`.
- UI surfaces across search/chat/settings were using mixed token sets, causing inconsistent appearance between light/dark contexts.

## Root Cause
- Search result area used a fixed max height and the main window positioning/sizing path mixed physical and logical pixel assumptions.
- Theme sync relied on local page handling without a shared app-level theme provider.
- Several components still referenced legacy color utility tokens instead of semantic theme tokens.

## Implemented Changes
- Added app-level theme provider integration with setting-to-theme synchronization and live `app-settings-updated` event handling.
- Added `next-themes` dependency and introduced `src/components/theme-provider.tsx`.
- Updated settings page theme behavior to normalize persisted values and call `setTheme(...)` on selection/rollback.
- Switched launcher window positioning in Tauri backend to logical coordinates.
- Switched frontend resize/reposition flow in main launcher to logical coordinates and monitor scale-aware calculations.
- Added dynamic search result max-height calculation so the bottom status/shortcut area remains visible.
- Removed fixed internal max-height from `CommandList` so caller-level height control applies.
- Applied semantic theme tokens across settings/search/chat/provider surfaces for consistent light/dark rendering.
- Added `.mcp.json` with `shadcn` MCP server configuration.
- Refreshed generated Tauri schema JSON formatting artifacts.

## Affected Files
- `.mcp.json`
- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/index.css`
- `src/pages/Main.tsx`
- `src/pages/Settings.tsx`
- `src/components/theme-provider.tsx`
- `src/components/ui/command.tsx`
- `src/components/ProviderCard.tsx`
- `src/components/chat/ChatSidebar.tsx`
- `src/components/chat/ChatProviderColumn.tsx`
- `src/components/chat/ChatMessageBubble.tsx`
- `src/components/chat/MarkdownContent.tsx`
- `src-tauri/src/lib.rs`
- `src-tauri/Cargo.lock`
- `src-tauri/gen/schemas/desktop-schema.json`
- `src-tauri/gen/schemas/windows-schema.json`

## Validation Results
- `npm run typecheck`: passed.
- `npm run test:rust`: passed (`14` tests passed, `0` failed).

## Rollback Plan
1. Revert this commit.
2. Verify launcher search panel and footer layout in search mode.
3. Verify theme selection behavior (`light`, `dark`, `system`) in settings and main window.
4. Keep this archive for audit history.
