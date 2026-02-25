# AI Quick Search

A fast, lightweight desktop launcher with multi-model AI chat capabilities. Built with Tauri v2, React 19, and Rust.

## Features

### App Search
- Global shortcut `Alt+Space` to toggle the launcher
- Fuzzy search across installed Windows applications
- Usage-based suggestions (frequently used apps appear first)
- Auto-hide on focus loss for seamless workflow

### Multi-Model AI Chat
- **Tab to Chat**: Press Tab in the launcher to switch to chat mode
- **Parallel Queries**: Query 1-4 AI providers simultaneously
- **Provider Support**: OpenAI, Anthropic, Google Gemini, Volcengine (Doubao), GLM (Zhipu), and custom OpenAI-compatible APIs
- **Streaming Responses**: Real-time character-by-character output
- **Session Persistence**: All conversations saved locally in SQLite
- **Full-Text Search**: Search across all chat history

### Privacy-First
- All data stored locally (SQLite)
- API keys encrypted in database
- No cloud sync, no telemetry

## Installation

### Prerequisites
- Windows 10/11
- No additional runtime required (self-contained executable)

### Download

Download the latest release from [GitHub Releases](https://github.com/your-username/ai-quick-search/releases).

### Build from Source

```bash
# Requirements
# - Node.js 20+
# - npm 10+
# - Rust toolchain (latest stable)

# Clone and install
git clone https://github.com/your-username/ai-quick-search.git
cd ai-quick-search
npm install

# Development mode
npm run tauri:dev

# Build release
npm run tauri:build
```

The built executable will be at `src-tauri/target/release/ai-quick-search.exe`.

## Usage

### Basic Workflow

1. **Launch**: Press `Alt+Space` anywhere in Windows
2. **Search Apps**: Type to search installed applications, press Enter to launch
3. **Chat Mode**: Press Tab to switch to AI chat
4. **Multi-Model**: Click the multiplier button (1x-4x) to query multiple providers
5. **Escape**: Press Esc to hide the window

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Space` | Toggle launcher window |
| `Tab` | Switch from search to chat mode |
| `Enter` | Launch first app (search) / Send message (chat) |
| `Escape` | Hide window / Exit chat mode |
| `F2` | Rename chat session |

### Configuring Providers

1. Click the Settings icon (gear) in the launcher
2. Navigate to "LLM Models" in the sidebar
3. Add a provider with your API key
4. Click "Test Connection" to verify
5. Set as active provider

## Development

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| UI Components | shadcn/cmdk, Radix UI, Lucide icons |
| Backend | Tauri v2, Rust |
| Database | SQLite with FTS5 |
| API Keys | System keyring (optional) |

### Project Structure

```
ai-quick-search/
├── src/                    # React frontend
│   ├── pages/              # Route components (Main, Settings)
│   ├── components/         # UI components
│   ├── hooks/              # React hooks for state
│   ├── lib/                # Utilities and Tauri API layer
│   └── types/              # TypeScript definitions
├── src-tauri/              # Rust backend
│   └── src/
│       ├── apps/           # Windows app scanner
│       ├── db/             # SQLite persistence
│       └── provider/       # AI provider integrations
└── docs/                   # Documentation
```

### Commands

```bash
npm run dev          # Start Vite dev server
npm run tauri:dev    # Start Tauri in dev mode
npm run build        # Build frontend
npm run tauri:build  # Build release executable
npm run typecheck    # TypeScript check
npm run test:rust    # Run Rust tests
```

### Git Hooks

This project uses:
- **husky** for Git hook management
- **lint-staged** for fast pre-commit checks
- **commitlint** for Conventional Commits

Pre-commit runs:
- Biome lint + format on staged JS/TS/CSS/JSON
- TypeScript type check on staged files
- rustfmt on staged Rust files

Pre-push runs:
- Full typecheck
- Rust test suite

## Documentation

See [docs/](./docs/) for:
- [Architecture Overview](./docs/01-architecture/README.md)
- [Change History](./docs/03-changes/CHANGE-INDEX.md)
- [Development Standards](./docs/00-governance/documentation-standards.md)

## License

MIT
