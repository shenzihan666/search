# IMPLEMENTATION - 2026-02-25 Theme Sync and Layout Fixes

## 1) Design Decisions

### Decision A: Centralize theme lifecycle at app root
- Added `ThemeProvider` wrapper at the `App` root to avoid per-page theme divergence.
- `ThemeSync` reads persisted app settings and listens for `app-settings-updated` events to keep theme in sync.
- `Settings` still controls user preference, but rendering authority is centralized.

### Decision B: Use logical coordinates for cross-DPI window behavior
- Window repositioning and resizing paths were updated to logical units.
- Monitor scale factor is now used when deriving workspace size/position constraints.
- Backend initial launcher positioning (`position_main_window`) now sets logical position to match frontend behavior.

### Decision C: Make search results area adaptive instead of fixed
- Search list max height now derives from current viewport height with reserved space for:
  - input header,
  - section heading,
  - footer status/shortcuts,
  - safety margin.
- This preserves footer visibility while still allowing scrollable result lists.

### Decision D: Normalize UI tokens to semantic theme vars
- Components were migrated from legacy token names to semantic tokens (`background`, `foreground`, `muted`, `border`, `primary`, `destructive`).
- This makes dark mode and system theme behavior consistent without per-component manual overrides.

## 2) Key Algorithms

### A) Search list max-height calculation
- `searchListMaxHeight = clamp(160, 400, viewportHeight - reservedHeight)`
- `reservedHeight` budget keeps fixed UI segments visible.
- Applied via inline `style={{ maxHeight: ... }}` on `CommandList`.

### B) Scale-aware monitor conversion for frontend resize loop
- Read monitor work area in physical units.
- Divide by scale factor to convert to logical units.
- Compute target size and centered position in logical coordinates.
- Apply with `LogicalSize` and `LogicalPosition`.

### C) Theme normalization
- Accepted values: `light`, `dark`, `system`.
- Unknown values normalize to `system` to keep behavior deterministic.
- Settings rollback path restores both stored value and visual theme state.

## 3) Error Handling
- Theme synchronization:
  - `AppSettingsApi.getAll()` failures are logged and do not crash the UI.
  - Tauri event unlisten promise failures are ignored safely on cleanup.
- Window resize/position:
  - Resize side effects are wrapped in `try/catch` with error logging.
  - Animation frame is cancelled on effect cleanup and stale run IDs are ignored.

## 4) Concurrency Considerations
- Theme sync and settings save flows can race during rapid toggles:
  - settings rollback callback and normalized callback both call `setTheme(...)`,
  - current implementation keeps final state consistent with normalized persisted value.
- Launcher resize loop uses run IDs plus `requestAnimationFrame` cancellation to avoid overlapping async size/position writes.

## 5) Future Considerations
- Add a dedicated integration test matrix for DPI scaling (100/125/150/200) and multi-monitor setups.
- Add E2E checks for runtime system theme toggling while launcher and settings windows are both open.
- Consider extracting shared layout constants (header/footer/reserved heights) into a dedicated UI config module.
