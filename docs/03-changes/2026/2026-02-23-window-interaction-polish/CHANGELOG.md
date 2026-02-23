# CHANGELOG - 2026-02-23 Window Interaction Polish

## Change ID
- `CHG-2026-02-23-001`

## Status
- Completed

## Summary
- Fixed window not closing on `Esc`.
- Fixed window not auto-hiding when clicking other applications.
- Removed decorative UI layers causing perceived outer shadow around the transparent launcher window.

## Affected Files
- `src/App.tsx`
- `src-tauri/src/lib.rs`
- `src/index.css`

## User-Visible Outcome
- `Esc` now closes/hides launcher reliably.
- Launcher auto-hides on focus loss.
- Outer visual glow/shadow artifacts around window edge are removed.
