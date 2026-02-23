# Implementation: Multi-Model Chat

## Architecture

### Dual Chat Modes

The application supports two chat modes:

1. **Embedded Chat** (Main.tsx)
   - Triggered by Tab key from search mode
   - Transforms launcher UI in-place
   - Uses `chatPanes` state to track each provider's response
   - Calls `query_provider_once` for each selected provider

2. **Standalone Chat** (Chat.tsx)
   - Separate window at `/chat` route
   - Manages chat sessions with message history
   - Uses `chat:init` event to receive initial query

### Provider Selection

```typescript
const maxMultiplier = Math.min(providersWithKeys.length, 4);
// Cycles: 1x -> 2x -> 3x -> 4x -> 1x
```

Providers are prioritized by `is_active` flag.

### API Response Parsing

Each provider has different response format:

| Provider | Response Path |
|----------|---------------|
| OpenAI | `choices[0].message.content` |
| Anthropic | `content[0].text` |
| Google | `candidates[0].content.parts[0].text` |
| Volcengine | `output[0].content[0].text` or `output_text` |

### Error Handling

- 30-second timeout per provider query
- Individual provider failures don't block others
- Error messages displayed in respective pane

## Key Files

```
src/pages/Main.tsx          # Embedded chat mode
src/pages/Chat.tsx          # Standalone chat window
src-tauri/src/provider/
  mod.rs                    # Provider types
  openai.rs                 # API calls and parsing
```

## State Management

### Main.tsx Chat State

```typescript
interface ChatPaneState {
  isLoading: boolean;
  response: string;
  error: string | null;
}

const [mode, setMode] = useState<"search" | "chat">("search");
const [chatPanes, setChatPanes] = useState<Record<string, ChatPaneState>>({});
```

### Chat.tsx Session State

```typescript
interface ChatSession {
  id: string;
  providerIds: string[];
  messages: ChatMessage[];
  createdAt: number;
}
```
