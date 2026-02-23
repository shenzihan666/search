# Window Behavior Checklist (Tauri Desktop)

## Objective
Quick regression checklist for launcher window behavior.

## Checks
1. Press `Alt+Space`:
- Window toggles show/hide correctly.

2. Press `Esc` while input is focused:
- Window hides immediately.

3. Press `Esc` with focus on non-input area:
- Window hides immediately.

4. Click another application window:
- Current launcher window hides on focus loss.

5. Reopen from tray:
- Window is visible and focused.

## Failure Triage
- If `Esc` fails: inspect `src/App.tsx` keyboard handlers.
- If blur-hide fails: inspect `src-tauri/src/lib.rs` `WindowEvent::Focused(false)`.
