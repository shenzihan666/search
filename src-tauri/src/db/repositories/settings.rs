use crate::db::connection;
use crate::db::error::DbResult;
use crate::provider::ProviderConfig;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

const KEY_PROVIDER_CONFIG: &str = "provider_config";

pub struct SettingsRepository;

impl SettingsRepository {
    /// Get a setting value by key.
    pub fn get(key: &str) -> DbResult<Option<String>> {
        connection::with_connection(|conn| {
            let result =
                conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                    row.get::<_, String>(0)
                });

            match result {
                Ok(value) => Ok(Some(value)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// Set a setting value.
    pub fn set(key: &str, value: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![key, value, now_unix_ms()],
            )?;
            Ok(())
        })
    }

    /// Delete a setting.
    #[allow(dead_code)]
    pub fn delete(key: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            conn.execute("DELETE FROM settings WHERE key = ?1", [key])?;
            Ok(())
        })
    }

    /// Save provider configuration to SQLite.
    pub fn save_provider_config(config: &ProviderConfig) -> DbResult<()> {
        let json = serde_json::to_string(config)?;
        Self::set(KEY_PROVIDER_CONFIG, &json)
    }

    /// Load provider configuration from SQLite.
    pub fn load_provider_config() -> DbResult<ProviderConfig> {
        match Self::get(KEY_PROVIDER_CONFIG)? {
            Some(json) => Ok(serde_json::from_str(&json)?),
            None => Ok(ProviderConfig::default()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_constant() {
        assert_eq!(KEY_PROVIDER_CONFIG, "provider_config");
    }
}
