# Changelog: Multi-Provider CRUD

## Summary

Implemented full CRUD operations for managing multiple LLM providers, replacing the single-provider configuration with a flexible multi-provider system.

## Changes

### Backend (Rust)

- **New**: `src-tauri/src/db/migrations/v3_providers.rs` - Database migration for providers table
- **New**: `src-tauri/src/db/migrations/v4_provider_api_key_sqlite.rs` - Migration to store API keys in SQLite
- **New**: `src-tauri/src/db/repositories/providers.rs` - Full CRUD repository for providers
- **New**: `src-tauri/src/provider/mod.rs` - Provider types and request/response structures
- **Modified**: `src-tauri/src/lib.rs` - Added new Tauri commands for provider management
- **Modified**: `src-tauri/src/provider/openai.rs` - Connection testing and query integration
- **Modified**: `src-tauri/src/db/migrations/mod.rs` - Added V3 and V4 migrations
- **Modified**: `src-tauri/src/db/repositories/mod.rs` - Export ProvidersRepository
- **Modified**: `src-tauri/src/db/mod.rs` - Export ProvidersRepository
- **Modified**: `src-tauri/src/db/error.rs` - Added Query variant
- **Modified**: `src-tauri/Cargo.toml` - Added uuid and reqwest dependencies

### Frontend (TypeScript/React)

- **New**: `src/types/provider.ts` - TypeScript types for providers
- **New**: `src/hooks/useProviders.ts` - React hook for provider state management
- **New**: `src/components/ProviderCard.tsx` - Provider card component
- **Modified**: `src/pages/Settings.tsx` - Refactored to use multi-provider UI

### New Tauri Commands

- `list_providers` - List all providers with API key status
- `create_provider` - Create a new provider
- `update_provider` - Update provider settings
- `delete_provider` - Delete a provider
- `set_active_provider` - Set the active provider
- `get_provider_api_key` - Get API key for a provider
- `set_provider_api_key` - Set API key for a provider
- `test_provider_connection` - Test connection to a provider

## Migration Notes

- V3 migration creates the providers table with all necessary fields
- V4 migration moves API keys from keyring to SQLite for reliability
- First created provider is automatically set as active
- Deleting active provider auto-activates next available provider
