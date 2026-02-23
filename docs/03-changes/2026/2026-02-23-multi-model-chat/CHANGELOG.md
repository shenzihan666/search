# Changelog: Multi-Model Chat

## Summary

Implemented Tab-to-query multi-model chat functionality with embedded chat mode in the launcher and real API calls to multiple LLM providers simultaneously.

## Changes

### Backend (Rust)

- **Modified**: `src-tauri/src/provider/openai.rs`
  - Added `call_provider_and_get_text()` for real HTTP API calls
  - Added response parsing for OpenAI, Anthropic, Google, Volcengine formats
  - Added `query_provider_once` command for single provider query
  - Added `query_stream_provider` command for per-provider streaming
- **Modified**: `src-tauri/src/provider/mod.rs`
  - Added Glm and Volcengine provider types
  - Updated provider type parsing and defaults
- **Modified**: `src-tauri/src/lib.rs`
  - Registered new commands
  - Added chat window focus-loss auto-hide

### Frontend (TypeScript/React)

- **New**: `src/pages/Chat.tsx` - Standalone multi-model chat interface
- **Modified**: `src/pages/Main.tsx`
  - Added dual mode (search/chat) with Tab key toggle
  - Added multiplier button (1x-4x) for provider count selection
  - Added embedded chat panes with `query_provider_once` calls
  - Added chat session management
- **Modified**: `src/types/provider.ts`
  - Added Volcengine provider type
  - Added provider type info with defaults

### New Tauri Commands

- `query_provider_once(provider_id, prompt)` - Query specific provider, returns full text
- `query_stream_provider(provider_id, prompt, app)` - Query with streaming chunks

## Supported Providers

- OpenAI (GPT models)
- Anthropic (Claude models)
- Google (Gemini models)
- Volcengine (ARK/DeepSeek models)
- Glm (智谱 models)
- Custom (OpenAI-compatible APIs)

## User Experience

1. User types query in launcher
2. Press **Tab** to switch to chat mode
3. Click multiplier (1x-4x) to select number of providers
4. Responses appear in parallel columns
5. Press **Esc** to hide window
