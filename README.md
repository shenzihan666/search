# AI Quick Search

A Tauri desktop launcher-style app with a React frontend and Rust backend.

## Requirements

- Node.js 20+
- npm 10+
- Rust toolchain (for Tauri backend checks/tests)

## Install

```bash
npm install
```

`npm install` runs `prepare` automatically and installs Git hooks via Husky.

If Git reports a safe directory error, run:

```bash
git config --global --add safe.directory D:/Project/search
npm run prepare
```

## Development

```bash
npm run tauri:dev
```

## Git Hooks

This project uses:
- `husky` for Git hook wiring
- `lint-staged` for fast staged-file checks
- `commitlint` for Conventional Commits

### pre-commit

Runs on staged files only:
- `biome check --write` for JS/TS/CSS/JSON lint + format
- `tsc-files --noEmit` for staged TS/TSX type checks
- `rustfmt` for staged Rust files

### pre-push

Runs repository-level checks:
- `npm run typecheck`
- `npm run test:rust`

### commit-msg

Enforces Conventional Commit messages:

Allowed types:
- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `test`
- `chore`
- `perf`
- `ci`
- `build`
- `revert`

## CI Behavior

Hooks auto-skip in CI (`CI` environment variable set). CI should run dedicated pipeline checks independently.

## Escape Hatch

To bypass hooks in emergencies:

```bash
git commit --no-verify
git push --no-verify
```
