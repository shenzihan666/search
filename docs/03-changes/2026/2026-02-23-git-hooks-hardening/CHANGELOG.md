# CHANGELOG - 2026-02-23 Git Hooks Hardening

## Change ID
- `CHG-2026-02-23-002`

## Status
- Completed

## Summary
- Added a production-grade Git hooks workflow using Husky.
- Added staged-file quality checks via lint-staged.
- Added commit message validation via commitlint (Conventional Commits).
- Added pre-push verification (`typecheck` + Rust tests).
- Added root `README.md` setup instructions for new contributors.

## Affected Files
- `package.json`
- `package-lock.json`
- `.husky/pre-commit`
- `.husky/pre-push`
- `.husky/commit-msg`
- `.lintstagedrc.cjs`
- `commitlint.config.cjs`
- `biome.json`
- `.biomeignore`
- `README.md`
