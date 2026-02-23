# IMPLEMENTATION - 2026-02-23 Window Interaction Polish

## 1) ESC Hide Behavior
### Problem
- `Esc` key had no actual hide action wired to the window.

### Implementation
- Added `getCurrentWindow()` usage in `src/App.tsx`.
- Added global `keydown` listener to hide on `Escape`.
- Added input-level `onKeyDown` fallback for `Escape`.

## 2) Hide on Focus Loss
### Problem
- `WindowEvent::Focused(false)` existed but hide action was commented out.

### Implementation
- Enabled hide behavior in `src-tauri/src/lib.rs` under `WindowEvent::Focused(false)`.

## 3) Visual Outer Shadow Cleanup
### Problem
- Decorative blur layers and bottom ornament were perceived as outer border/shadow on transparent window.

### Implementation
- Removed decorative top-left and bottom-right blur circles in `src/App.tsx`.
- Removed bottom center ornamental strip in `src/App.tsx`.
- Removed decorative three-dot indicator block in `src/App.tsx` (purely visual, no business function).
- Ensured transparent root surface in `src/index.css` to avoid edge tinting.

## Risk Notes
- Low risk: changes are scoped to window UX behavior and non-functional decoration.
- No API contract changes.
