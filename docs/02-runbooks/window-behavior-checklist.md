# Window Behavior Verification Checklist

Use this runbook to verify window behavior after changes to Tauri window management.

## Prerequisites

- [ ] Application built successfully (`npm run tauri:build` or dev mode)
- [ ] No other instances running
- [ ] Clean database state (optional: delete `%APPDATA%\com.search.app\search.db`)

## Test Sequence

### 1. Application Launch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Launch app | Main window hidden, tray icon visible |
| 1.2 | Check tray | Icon appears in system tray |
| 1.3 | Check database | `search.db` created at expected path |

### 2. Global Shortcut (Alt+Space)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Press Alt+Space (release) | Main window appears, centered, focused |
| 2.2 | Press Alt+Space again | Main window hidden |
| 2.3 | Press Alt+Space rapidly | No double-toggle, single show/hide |

### 3. Tray Interaction

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Left-click tray icon | Main window shows, focused |
| 3.2 | Right-click tray icon | Context menu appears |
| 3.3 | Click "Show" menu | Main window shows, focused |
| 3.4 | Click "Settings" menu | Settings window opens |
| 3.5 | Click "Quit" menu | Application exits |

### 4. Focus Loss Behavior

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | Show main window (search mode) | Window visible |
| 4.2 | Click another application | Main window hides |
| 4.3 | Show main window, switch to chat mode | Window visible |
| 4.4 | Click another application | Main window stays visible (chat mode) |

### 5. Keyboard Shortcuts (Search Mode)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | Type in search box | App results appear |
| 5.2 | Press Enter | First app launches, window hides |
| 5.3 | Press Tab | Switches to chat mode |
| 5.4 | Press Escape | Window hides |

### 6. Keyboard Shortcuts (Chat Mode)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Press Enter | Message sent |
| 6.2 | Press Tab (empty input) | New session created |
| 6.3 | Press F2 | Session rename starts |
| 6.4 | Press Escape | Exit to search mode |
| 6.5 | Press Escape again | Window hides |

### 7. Settings Window

| Step | Action | Expected Result |
|------|--------|-----------------|
| 7.1 | Open Settings | Separate window appears |
| 7.2 | Click minimize | Window minimizes |
| 7.3 | Click maximize | Window maximizes |
| 7.4 | Click close | Window closes, app remains running |
| 7.5 | Reopen from tray | Settings window shows |

### 8. Multi-Monitor (If Available)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 8.1 | Show window on primary | Centered on primary |
| 8.2 | Move mouse to secondary | Window position unchanged |
| 8.3 | Trigger Alt+Space | Window centered on current monitor |

## Edge Cases

### Rapid Interaction
- [ ] Alt+Space spam: No flicker, final state correct
- [ ] Tray click during shortcut: No deadlock
- [ ] Settings open/close rapidly: No zombie windows

### Resource Cleanup
- [ ] Close main window: No memory leak
- [ ] Quit from tray: All windows close, process exits
- [ ] Force kill: Database intact on next launch

## Troubleshooting

### Window Not Showing
1. Check if process running: `tasklist | findstr search`
2. Check tray icon presence
3. Verify shortcut not registered by another app
4. Check Tauri logs: `~/.tauri/logs/`

### Window Not Hiding (Search Mode)
1. Check focus loss handler in `lib.rs`
2. Verify `modeRef.current` correctly tracks mode in `Main.tsx`
3. Check for blocking JavaScript in console

### Shortcut Not Working
1. Check for Alt+Space system menu conflict (Windows)
2. Verify shortcut registered: Look for "already registered" warning in logs
3. Try alternative shortcut in `tauri.conf.json`

### Esc Key Not Working
- **Search mode**: Inspect `Main.tsx` keyboard handler for Escape key
- **Chat mode**: Check exit-to-search logic in `exitChatToSearch` callback
- **Both modes**: Verify event listener attached correctly

### Focus Loss Not Hiding
- Inspect `lib.rs` for `WindowEvent::Focused(false)` handler
- Check `Main.tsx` for `onFocusChanged` listener (search mode only)
- Verify mode detection in `modeRef.current`

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | Pass / Fail |
