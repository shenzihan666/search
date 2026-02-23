use crate::db::connection;
use crate::db::error::{DbError, DbResult};
use crate::provider::ProviderConfig;
use keyring::Entry;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

const KEY_PROVIDER_CONFIG: &str = "provider_config";
const KEYRING_SERVICE: &str = "ai-quick-search";
const KEYRING_ACCOUNT: &str = "provider_api_key";

pub struct SettingsRepository;

impl SettingsRepository {
    /// Get a setting value by key
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

    /// Set a setting value
    pub fn set(key: &str, value: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![key, value, now_unix_ms()],
            )?;
            Ok(())
        })
    }

    /// Delete a setting
    #[allow(dead_code)]
    pub fn delete(key: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            conn.execute("DELETE FROM settings WHERE key = ?1", [key])?;
            Ok(())
        })
    }

    /// Save provider configuration to database
    pub fn save_provider_config(config: &ProviderConfig) -> DbResult<()> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| DbError::Secret(format!("Failed to create keyring entry: {e}")))?;

        match config.api_key.as_deref().map(str::trim) {
            Some(api_key) if !api_key.is_empty() => entry
                .set_password(api_key)
                .map_err(|e| DbError::Secret(format!("Failed to persist API key: {e}")))?,
            _ => match entry.delete_credential() {
                Ok(()) => {}
                Err(keyring::Error::NoEntry) => {}
                Err(e) => {
                    return Err(DbError::Secret(format!("Failed to clear API key: {e}")));
                }
            },
        }

        let mut sanitized = config.clone();
        sanitized.api_key = None;
        let json = serde_json::to_string(&sanitized)?;
        Self::set(KEY_PROVIDER_CONFIG, &json)
    }

    /// Load provider configuration from database
    pub fn load_provider_config() -> DbResult<ProviderConfig> {
        let mut config = match Self::get(KEY_PROVIDER_CONFIG)? {
            Some(json) => {
                let parsed: ProviderConfig = serde_json::from_str(&json)?;
                parsed
            }
            None => ProviderConfig::default(),
        };

        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| DbError::Secret(format!("Failed to create keyring entry: {e}")))?;
        match entry.get_password() {
            Ok(api_key) if !api_key.trim().is_empty() => config.api_key = Some(api_key),
            Ok(_) => config.api_key = None,
            Err(keyring::Error::NoEntry) => config.api_key = None,
            Err(e) => return Err(DbError::Secret(format!("Failed to load API key: {e}"))),
        }

        Ok(config)
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
