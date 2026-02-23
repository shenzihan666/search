# Validation: Multi-Provider CRUD

## Manual Testing Checklist

### Provider Management

- [ ] Create new provider with each type (OpenAI, Anthropic, Google, Custom)
- [ ] Verify first provider is auto-activated
- [ ] Edit provider name, base URL, model
- [ ] Set provider as active (only one can be active)
- [ ] Delete non-active provider
- [ ] Delete active provider (next should auto-activate)
- [ ] Verify provider list order matches display_order

### API Key Management

- [ ] Set API key for provider
- [ ] Verify `has_api_key` indicator updates
- [ ] Clear API key (set empty)
- [ ] API key persists across app restarts

### Connection Testing

- [ ] Test connection with valid API key - success
- [ ] Test connection with invalid API key - failure with message
- [ ] Test connection with no API key - appropriate error
- [ ] Connection test timeout works (15s)

### Query Integration

- [ ] AI query uses active provider's config
- [ ] AI query fails gracefully with no active provider
- [ ] AI query fails gracefully with no API key

### Migration

- [ ] Fresh install: V3, V4 migrations apply cleanly
- [ ] Existing install: V3, V4 migrations apply on update
- [ ] Legacy `get_config`/`set_config` still work

## Build Verification

```bash
# Frontend build
npm run build

# Backend check
cd src-tauri && cargo check
```
