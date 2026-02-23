use crate::db::error::DbResult;

pub const VERSION: u32 = 3;

pub fn up_sql() -> &'static str {
    r#"
    -- Providers table for multi-provider support
    CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,              -- UUID v4
        name TEXT NOT NULL,               -- "OpenAI", "Anthropic", etc.
        provider_type TEXT NOT NULL,      -- 'openai', 'anthropic', 'google', 'volcengine', 'custom'
        base_url TEXT,                    -- API base URL (optional)
        model TEXT NOT NULL,              -- Default model
        is_active INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    -- Index for quick active provider lookup
    CREATE INDEX IF NOT EXISTS idx_providers_is_active ON providers(is_active);
    -- Index for ordered listing
    CREATE INDEX IF NOT EXISTS idx_providers_display_order ON providers(display_order);
    "#
}

#[allow(dead_code)]
pub fn down_sql() -> &'static str {
    r#"
    DROP INDEX IF EXISTS idx_providers_display_order;
    DROP INDEX IF EXISTS idx_providers_is_active;
    DROP TABLE IF EXISTS providers;
    "#
}

/// Apply V3 migration: create providers table and migrate existing config
pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    // Create the providers table
    conn.execute_batch(up_sql())?;

    // Migrate existing single-provider config if present
    migrate_existing_config(conn)?;

    Ok(())
}

/// Migrate the old single-provider config from settings table to providers table
fn migrate_existing_config(conn: &rusqlite::Connection) -> DbResult<()> {
    use std::time::{SystemTime, UNIX_EPOCH};

    // Check if there's existing config to migrate
    let existing_config: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'provider_config'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok();

    // Check if providers table already has data
    let has_providers: bool = conn
        .query_row("SELECT COUNT(*) FROM providers", [], |row| {
            Ok(row.get::<_, i32>(0)? > 0)
        })
        .unwrap_or(false);

    // Only migrate if we have existing config and no providers yet
    if let Some(config_json) = existing_config {
        if has_providers {
            return Ok(()); // Already have providers, skip migration
        }

        // Parse the old config
        #[derive(serde::Deserialize)]
        struct OldConfig {
            model: Option<String>,
            provider_type: Option<String>,
            base_url: Option<String>,
        }

        let old_config: OldConfig = match serde_json::from_str(&config_json) {
            Ok(c) => c,
            Err(_) => return Ok(()), // Invalid config, skip migration
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        // Generate a UUID for the migrated provider
        let id = uuid::Uuid::new_v4().to_string();

        // Determine provider type and name
        let provider_type = old_config
            .provider_type
            .unwrap_or_else(|| "openai".to_string());
        let name = match provider_type.as_str() {
            "openai" => "OpenAI".to_string(),
            "anthropic" => "Anthropic".to_string(),
            "google" => "Google".to_string(),
            "volcengine" | "ark" => "Volcengine ARK".to_string(),
            _ => "Custom".to_string(),
        };

        let model = old_config
            .model
            .unwrap_or_else(|| "gpt-4o-mini".to_string());
        let base_url = old_config.base_url;

        // Insert the migrated provider as active
        conn.execute(
            "INSERT INTO providers (id, name, provider_type, base_url, model, is_active, display_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, ?6, ?6)",
            rusqlite::params![id, name, provider_type, base_url, model, now],
        )?;

        // Note: legacy API key data is reconciled in later migrations.
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(VERSION, 3);
    }
}
