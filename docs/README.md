# AI Quick Search - Project Documentation

## Overview

This directory contains the engineering documentation for AI Quick Search, a Tauri-based desktop launcher with multi-model AI chat capabilities.

## Documentation Structure

```
docs/
├── 00-governance/           # Standards and policies
│   └── documentation-standards.md   # Documentation conventions
│
├── 01-architecture/         # System design
│   └── README.md           # Architecture overview, module boundaries
│
├── 02-runbooks/             # Operational procedures
│   ├── window-behavior-checklist.md     # Window behavior verification
│   └── database-migration-verification.md # Migration testing
│
├── 03-changes/              # Change archives
│   ├── CHANGE-INDEX.md     # Master index of all changes
│   └── 2026/               # Year-based organization
│       └── YYYY-MM-DD-<topic>/  # Individual change archives
│
└── README.md               # This file
```

## Quick Links

### For Developers
- [Architecture Overview](./01-architecture/README.md) - System design and module boundaries
- [Documentation Standards](./00-governance/documentation-standards.md) - How to write docs
- [Change Index](./03-changes/CHANGE-INDEX.md) - History of all changes

### For QA
- [Window Behavior Checklist](./02-runbooks/window-behavior-checklist.md)
- [Database Migration Verification](./02-runbooks/database-migration-verification.md)

## Current System State

| Component | Version | Status |
|-----------|---------|--------|
| Database Schema | v9 | Active |
| Frontend | React 19 | Active |
| Backend | Tauri v2 | Active |
| Platform | Windows | Supported |

## Key Features

### Search Mode
- Global shortcut `Alt+Space` to toggle launcher
- Fuzzy app search with usage-based suggestions
- Auto-hide on focus loss

### Chat Mode
- Tab to switch from search to chat
- Multi-model parallel queries (1-4 providers)
- Per-provider conversation history
- Session persistence with SQLite
- Full-text search across messages
- System prompt per session

### Supported Providers
- OpenAI
- Anthropic
- Google (Gemini)
- Volcengine (Doubao)
- GLM (Zhipu)
- Custom (OpenAI-compatible)

## Contributing

When making changes:
1. Follow [Documentation Standards](./00-governance/documentation-standards.md)
2. Create change archive in `03-changes/YYYY/YYYY-MM-DD-<topic>/`
3. Update `CHANGE-INDEX.md`
4. Include CHANGELOG, IMPLEMENTATION, and VALIDATION files

## Contact

For questions about documentation:
- Open an issue on GitHub
- Reference the relevant document path
