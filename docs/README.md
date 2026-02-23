# Project Documentation

## Purpose
- Provide an auditable documentation structure for engineering changes.
- Preserve implementation decisions, validation evidence, and rollback guidance.

## Structure
- `00-governance/`: documentation standards, naming rules, templates.
- `01-architecture/`: architecture overviews and component ownership notes.
- `02-runbooks/`: operational procedures and troubleshooting playbooks.
- `03-changes/`: dated change archives with implementation and validation evidence.

## Change Archive Rules
- One directory per change batch.
- Directory naming: `YYYY-MM-DD-<short-topic>`.
- Mandatory files:
  - `CHANGELOG.md`
  - `IMPLEMENTATION.md`
  - `VALIDATION.md`
