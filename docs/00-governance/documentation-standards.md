# Documentation Standards

## Purpose

This standard establishes consistent documentation practices for the AI Quick Search project. All documentation under `docs/` must follow these guidelines to ensure maintainability, discoverability, and auditability.

## Scope

This standard applies to all files under `docs/`, including:
- Architecture documentation
- Operational runbooks
- Change archives
- Governance documents

## Directory Structure

```
docs/
├── 00-governance/          # Standards, policies, templates
│   └── documentation-standards.md
├── 01-architecture/        # System design, module boundaries
│   └── README.md
├── 02-runbooks/            # Operational procedures, troubleshooting
│   ├── window-behavior-checklist.md
│   └── database-migration-verification.md
├── 03-changes/             # Dated change archives
│   ├── CHANGE-INDEX.md
│   └── YYYY/
│       └── YYYY-MM-DD-<topic>/
│           ├── CHANGELOG.md
│           ├── IMPLEMENTATION.md
│           └── VALIDATION.md
└── README.md               # Documentation index
```

## Naming Conventions

### Directories
- Use lowercase with hyphens: `chat-persistence-refactor`
- Use ISO date prefix for change folders: `YYYY-MM-DD`
- Format: `YYYY-MM-DD-<short-topic>`

### Files
- Use lowercase with hyphens or underscores
- Markdown files use `.md` extension
- Standard file names per directory type:
  - `README.md` - Index/overview
  - `CHANGELOG.md` - Change summary
  - `IMPLEMENTATION.md` - Technical details
  - `VALIDATION.md` - Test evidence

## Change Archive Requirements

Every meaningful code change (feature, fix, behavior modification) must include a change archive with:

### CHANGELOG.md
Required sections:
1. **Issue Statement** - Business/UX problem being solved
2. **Root Cause** - Why the issue occurred
3. **Implemented Changes** - Summary of modifications
4. **Affected Files** - Explicit list of touched files
5. **Validation Results** - Test outcomes
6. **Rollback Plan** - Steps to revert if needed

### IMPLEMENTATION.md
Required sections:
1. **Design Decisions** - Key architectural choices with rationale
2. **Key Algorithms** - Important logic explanations
3. **Error Handling** - Failure modes and recovery
4. **Concurrency Considerations** - Thread safety, async behavior
5. **Future Considerations** - Planned enhancements

### VALIDATION.md
Required sections:
1. **Pre-Deployment Verification** - Checklist of tests
2. **Functional Tests** - Feature-specific test cases
3. **Edge Cases** - Boundary conditions
4. **Performance Benchmarks** - Target metrics
5. **Regression Tests** - Ensures existing functionality intact
6. **Sign-Off Table** - Approver signatures

## Review Checklist

Before submitting documentation:

### Accuracy
- [ ] Technical details match current codebase
- [ ] File paths are correct
- [ ] Commands work as documented
- [ ] Version numbers are accurate

### Completeness
- [ ] All required sections present
- [ ] Affected files explicitly listed
- [ ] Validation steps are reproducible
- [ ] Rollback path is clear

### Quality
- [ ] Clear, concise language
- [ ] Consistent formatting
- [ ] No TODO placeholders in production docs
- [ ] Links resolve correctly

### Auditability
- [ ] Change is traceable to issue/requirement
- [ ] Decision rationale is documented
- [ ] Test evidence is sufficient

## Writing Style

### Voice and Tone
- Use imperative mood for instructions: "Run the test" not "You should run the test"
- Use present tense for system behavior: "The app hides" not "The app will hide"
- Be concise: Aim for clarity over completeness

### Formatting
- Use tables for structured data and checklists
- Use code blocks for commands and queries
- Use headers hierarchically (H1 → H2 → H3)
- Bold for **important terms**, italics for *emphasis*

### Code Examples
- Include language hint for syntax highlighting
- Provide context comments for complex snippets
- Show expected output where relevant

```rust
// Example: Migration version check
let current = get_current_version(conn)?;
if current < V8::VERSION {
    V8::apply(conn)?;
}
```

## Document Lifecycle

### Creation
1. Author creates document following template
2. Peer review for accuracy
3. Merge with code change

### Maintenance
1. Update when code changes affect documented behavior
2. Mark outdated sections with `[DEPRECATED]` header
3. Remove obsolete documents, update index

### Archival
1. Completed changes remain in `03-changes/`
2. Active documentation updated to reflect changes
3. Index updated to reflect new entries

## Exceptions

Requests to deviate from these standards require:
1. Documented justification
2. Approval from tech lead
3. Comment in PR explaining exception

## References

- [Keep a Changelog](https://keepachangelog.com/)
- [Write the Docs](https://www.writethedocs.org/)
- [Microsoft Style Guide](https://docs.microsoft.com/en-us/style-guide/)
