# VALIDATION - SQLite Persistence and Settings UI

## Verification Checklist

### Database Initialization
- [ ] Database file created at `{app_local_data_dir}/data.db` on first run
- [ ] Schema migrations execute without errors
- [ ] `schema_version` table shows current version (2)

### App Cache Persistence
- [ ] Apps scanned and saved to database on first launch
- [ ] Subsequent launches load from database (faster startup)
- [ ] Stale apps removed during sync when no longer installed

### Icon Cache
- [ ] Icons extracted and stored in database
- [ ] Icons loaded from database on subsequent requests
- [ ] Memory cache used for in-session lookups

### Usage Statistics
- [ ] App launches recorded to `app_usage` table
- [ ] Launch count increments correctly
- [ ] Last launched timestamp updates
- [ ] Suggestions sorted by launch count, then recency

### JSON Migration
- [ ] Legacy `usage-stats.json` migrated to database
- [ ] JSON file deleted after successful migration
- [ ] Migration only runs once

### Settings Persistence
- [ ] Provider config saved to database
- [ ] API key stored in system keyring (not database)
- [ ] Config loads correctly on app restart
- [ ] Settings page displays saved values

### Settings Window
- [ ] Tray "Settings" menu opens settings window
- [ ] Settings window shows and focuses
- [ ] Settings window can be hidden/closed

### Frontend Routing
- [ ] Main route (`/`) displays launcher
- [ ] Settings route (`/settings`) displays settings page
- [ ] Navigation works without page reload

## Manual Test Scenarios

### Scenario 1: Fresh Install
1. Delete `{app_local_data_dir}/ai-quick-search/` directory
2. Launch app
3. Verify database created with apps populated
4. Launch an app, verify usage recorded
5. Restart app, verify suggestions appear

### Scenario 2: Migration from JSON
1. Create legacy `usage-stats.json` with sample data
2. Launch app
3. Verify data migrated to database
4. Verify JSON file deleted

### Scenario 3: API Key Security
1. Open settings, enter API key
2. Save settings
3. Check database: API key should NOT be present
4. Check system keyring: API key should be present
5. Restart app, verify API key loads

## Error Handling Verified
- Database connection failure: App continues with memory-only cache
- Migration failure: Logged to stderr, app continues
- Keyring unavailable: Error returned to frontend
