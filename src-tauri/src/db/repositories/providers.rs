use crate::db::connection;
use crate::db::error::{DbError, DbResult};
use crate::provider::{
    CreateProviderRequest, Provider, ProviderType, ProviderView, UpdateProviderRequest,
};
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub struct ProvidersRepository;

impl ProvidersRepository {
    /// Create a new provider.
    pub fn create(req: CreateProviderRequest) -> DbResult<Provider> {
        connection::with_connection(|conn| {
            let id = uuid::Uuid::new_v4().to_string();
            let now = now_unix_ms();
            let provider_type = req.provider_type;
            let name = req.name;
            let base_url = req
                .base_url
                .or_else(|| provider_type.default_base_url().map(|s| s.to_string()));
            let model = req
                .model
                .unwrap_or_else(|| provider_type.default_model().to_string());
            let api_key = req
                .api_key
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty());

            // Get the next display order.
            let max_order: i32 = conn
                .query_row(
                    "SELECT COALESCE(MAX(display_order), -1) FROM providers",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(-1);
            let display_order = max_order + 1;

            // If this is the first provider, make it active.
            let is_active = if max_order < 0 { 1 } else { 0 };

            conn.execute(
                "INSERT INTO providers (
                    id, name, provider_type, base_url, model, api_key, is_active, display_order, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
                rusqlite::params![
                    id,
                    name,
                    provider_type.to_string(),
                    base_url,
                    model,
                    api_key,
                    is_active,
                    display_order,
                    now
                ],
            )?;

            Ok(Provider {
                id,
                name,
                provider_type,
                base_url,
                model,
                is_active: is_active == 1,
                display_order,
                created_at: now,
                updated_at: now,
            })
        })
    }

    /// List all providers with API key status.
    pub fn list() -> DbResult<Vec<ProviderView>> {
        connection::with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, provider_type, base_url, model, is_active, display_order, created_at, updated_at,
                        CASE WHEN api_key IS NULL OR TRIM(api_key) = '' THEN 0 ELSE 1 END AS has_api_key
                 FROM providers
                 ORDER BY display_order ASC",
            )?;

            let providers = stmt.query_map([], |row| {
                let provider_type_str: String = row.get(2)?;
                let provider_type =
                    ProviderType::from_str(&provider_type_str).unwrap_or(ProviderType::Custom);

                Ok(ProviderView {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    provider_type,
                    base_url: row.get(3)?,
                    model: row.get(4)?,
                    is_active: row.get::<_, i32>(5)? == 1,
                    display_order: row.get(6)?,
                    has_api_key: row.get::<_, i32>(9)? == 1,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?;

            let mut result = Vec::new();
            for provider in providers {
                result.push(provider?);
            }

            Ok(result)
        })
    }

    /// Get a provider by ID.
    pub fn get(id: &str) -> DbResult<Option<Provider>> {
        connection::with_connection(|conn| {
            let result = conn.query_row(
                "SELECT id, name, provider_type, base_url, model, is_active, display_order, created_at, updated_at
                 FROM providers WHERE id = ?1",
                [id],
                |row| {
                    let provider_type_str: String = row.get(2)?;
                    let provider_type = ProviderType::from_str(&provider_type_str).unwrap_or(ProviderType::Custom);

                    Ok(Provider {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        provider_type,
                        base_url: row.get(3)?,
                        model: row.get(4)?,
                        is_active: row.get::<_, i32>(5)? == 1,
                        display_order: row.get(6)?,
                        created_at: row.get(7)?,
                        updated_at: row.get(8)?,
                    })
                },
            );

            match result {
                Ok(provider) => Ok(Some(provider)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// Get the active provider with its API key.
    pub fn get_active_with_key() -> DbResult<Option<(Provider, String)>> {
        connection::with_connection(|conn| {
            let result = conn.query_row(
                "SELECT id, name, provider_type, base_url, model, is_active, display_order, created_at, updated_at, api_key
                 FROM providers WHERE is_active = 1
                 ORDER BY display_order ASC LIMIT 1",
                [],
                |row| {
                    let provider_type_str: String = row.get(2)?;
                    let provider_type = ProviderType::from_str(&provider_type_str).unwrap_or(ProviderType::Custom);

                    Ok((
                        Provider {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            provider_type,
                            base_url: row.get(3)?,
                            model: row.get(4)?,
                            is_active: row.get::<_, i32>(5)? == 1,
                            display_order: row.get(6)?,
                            created_at: row.get(7)?,
                            updated_at: row.get(8)?,
                        },
                        row.get::<_, Option<String>>(9)?,
                    ))
                },
            );

            match result {
                Ok((provider, api_key)) => {
                    let api_key = api_key.unwrap_or_default();
                    if api_key.trim().is_empty() {
                        Ok(None)
                    } else {
                        Ok(Some((provider, api_key)))
                    }
                }
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// Update a provider.
    pub fn update(id: &str, req: UpdateProviderRequest) -> DbResult<Provider> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();

            // Build dynamic update query.
            let mut updates = Vec::new();
            let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(name) = &req.name {
                updates.push("name = ?");
                params.push(Box::new(name.clone()));
            }
            if let Some(base_url) = &req.base_url {
                updates.push("base_url = ?");
                params.push(Box::new(base_url.clone()));
            }
            if let Some(model) = &req.model {
                updates.push("model = ?");
                params.push(Box::new(model.clone()));
            }

            if updates.is_empty() {
                return Self::get(id)?
                    .ok_or_else(|| DbError::Query("Provider not found".to_string()));
            }

            updates.push("updated_at = ?");
            params.push(Box::new(now));
            params.push(Box::new(id.to_string()));

            let sql = format!("UPDATE providers SET {} WHERE id = ?", updates.join(", "));
            let params_refs: Vec<&dyn rusqlite::ToSql> =
                params.iter().map(|p| p.as_ref()).collect();
            conn.execute(&sql, params_refs.as_slice())?;

            Self::get(id)?.ok_or_else(|| DbError::Query("Provider not found".to_string()))
        })
    }

    /// Delete a provider.
    pub fn delete(id: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            // Check if this is the active provider.
            let was_active: bool = conn
                .query_row(
                    "SELECT is_active FROM providers WHERE id = ?",
                    [id],
                    |row| Ok(row.get::<_, i32>(0)? == 1),
                )
                .unwrap_or(false);

            // Delete the provider.
            conn.execute("DELETE FROM providers WHERE id = ?", [id])?;

            // If the deleted provider was active, activate the next one.
            if was_active {
                conn.execute(
                    "UPDATE providers SET is_active = 1 WHERE id = (
                        SELECT id FROM providers ORDER BY display_order ASC LIMIT 1
                    )",
                    [],
                )?;
            }

            Ok(())
        })
    }

    /// Set provider enabled/disabled state. Multiple providers can be enabled.
    pub fn set_active(id: &str, is_active: bool) -> DbResult<()> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();
            let rows_affected = conn.execute(
                "UPDATE providers SET is_active = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![if is_active { 1 } else { 0 }, now, id],
            )?;

            if rows_affected == 0 {
                return Err(DbError::Query("Provider not found".to_string()));
            }

            Ok(())
        })
    }

    /// Set the API key for a provider.
    pub fn set_api_key(provider_id: &str, api_key: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();
            let value = if api_key.trim().is_empty() {
                None
            } else {
                Some(api_key.trim().to_string())
            };

            let rows_affected = conn.execute(
                "UPDATE providers SET api_key = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![value, now, provider_id],
            )?;

            if rows_affected == 0 {
                return Err(DbError::Query("Provider not found".to_string()));
            }

            Ok(())
        })
    }

    /// Get the API key for a provider.
    pub fn get_api_key(provider_id: &str) -> DbResult<String> {
        connection::with_connection(|conn| {
            let result = conn.query_row(
                "SELECT api_key FROM providers WHERE id = ?1",
                [provider_id],
                |row| row.get::<_, Option<String>>(0),
            );

            match result {
                Ok(api_key) => Ok(api_key.unwrap_or_default()),
                Err(rusqlite::Error::QueryReturnedNoRows) => {
                    Err(DbError::Query("Provider not found".to_string()))
                }
                Err(e) => Err(e.into()),
            }
        })
    }
}
