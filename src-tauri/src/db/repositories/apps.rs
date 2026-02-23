use crate::apps::AppInfo;
use crate::db::connection;
use crate::db::error::DbResult;
use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn normalize_path_key(path: &str) -> String {
    path.trim()
        .trim_matches('"')
        .replace('/', "\\")
        .to_lowercase()
}

pub struct AppsRepository;

impl AppsRepository {
    /// Insert/update current apps and remove stale rows in one transaction.
    pub fn sync_apps(apps: &[AppInfo]) -> DbResult<()> {
        connection::with_connection(|conn| {
            let tx = conn.unchecked_transaction()?;
            let now = now_unix_ms();
            let mut seen_paths = HashSet::new();

            {
                let mut stmt = tx.prepare_cached(
                    "INSERT INTO apps (name, path, normalized_path, publisher, icon_data, created_at, updated_at)
                     VALUES (
                         ?1, ?2, ?3, ?4,
                         COALESCE((SELECT icon_data FROM apps WHERE normalized_path = ?3), NULL),
                         COALESCE((SELECT created_at FROM apps WHERE normalized_path = ?3), ?5),
                         ?5
                     )
                     ON CONFLICT(normalized_path) DO UPDATE SET
                        name = excluded.name,
                        path = excluded.path,
                        publisher = excluded.publisher,
                        updated_at = excluded.updated_at",
                )?;

                for app in apps {
                    let normalized_path = normalize_path_key(&app.path);
                    if normalized_path.is_empty() || !seen_paths.insert(normalized_path.clone()) {
                        continue;
                    }

                    stmt.execute(rusqlite::params![
                        app.name,
                        app.path,
                        normalized_path,
                        app.publisher,
                        now
                    ])?;
                }
            }

            if seen_paths.is_empty() {
                tx.execute("DELETE FROM app_usage", [])?;
                tx.execute("DELETE FROM apps", [])?;
                tx.commit()?;
                return Ok(());
            }

            let stale_ids = {
                let mut stmt = tx.prepare("SELECT id, normalized_path FROM apps")?;
                let mut rows = stmt.query([])?;
                let mut ids = Vec::new();
                while let Some(row) = rows.next()? {
                    let id: i64 = row.get(0)?;
                    let normalized_path: String = row.get(1)?;
                    if !seen_paths.contains(&normalized_path) {
                        ids.push(id);
                    }
                }
                ids
            };

            {
                let mut delete_stmt = tx.prepare("DELETE FROM apps WHERE id = ?1")?;
                for stale_id in stale_ids {
                    delete_stmt.execute([stale_id])?;
                }
            }

            tx.commit()?;
            Ok(())
        })
    }

    /// Get all apps from database
    pub fn get_all_apps() -> DbResult<Vec<AppInfo>> {
        connection::with_connection(|conn| {
            let mut stmt = conn.prepare_cached(
                "SELECT name, path, publisher FROM apps ORDER BY name COLLATE NOCASE",
            )?;

            let apps = stmt
                .query_map([], |row| {
                    Ok(AppInfo {
                        name: row.get(0)?,
                        path: row.get(1)?,
                        publisher: row.get(2)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(apps)
        })
    }

    /// Get app count
    #[allow(dead_code)]
    pub fn get_app_count() -> DbResult<usize> {
        connection::with_connection(|conn| {
            let count: usize = conn.query_row("SELECT COUNT(*) FROM apps", [], |row| row.get(0))?;
            Ok(count)
        })
    }

    /// Record an app launch (increment usage count)
    pub fn record_launch(path: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            let normalized = normalize_path_key(path);

            // First get the app_id
            let app_id: Option<i64> = conn
                .query_row(
                    "SELECT id FROM apps WHERE normalized_path = ?1",
                    [&normalized],
                    |row| row.get(0),
                )
                .ok();

            let app_id = match app_id {
                Some(id) => id,
                None => return Ok(()), // App not in database, skip
            };

            let now = now_unix_ms();

            // Insert or update usage record
            conn.execute(
                "INSERT INTO app_usage (app_id, launch_count, last_launched_at, first_launched_at)
                 VALUES (?1, 1, ?2, ?2)
                 ON CONFLICT(app_id) DO UPDATE SET
                    launch_count = launch_count + 1,
                    last_launched_at = ?2",
                rusqlite::params![app_id, now],
            )?;

            Ok(())
        })
    }

    /// Get suggested apps based on usage statistics
    pub fn get_suggested_apps(limit: usize) -> DbResult<Vec<AppInfo>> {
        connection::with_connection(|conn| {
            let mut stmt = conn.prepare_cached(
                "SELECT a.name, a.path, a.publisher
                 FROM apps a
                 JOIN app_usage u ON a.id = u.app_id
                 WHERE u.launch_count > 0
                 ORDER BY u.launch_count DESC, u.last_launched_at DESC
                 LIMIT ?1",
            )?;

            let apps = stmt
                .query_map([limit as i64], |row| {
                    Ok(AppInfo {
                        name: row.get(0)?,
                        path: row.get(1)?,
                        publisher: row.get(2)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(apps)
        })
    }

    /// Save icon data for an app
    pub fn save_icon(path: &str, icon_data: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            let normalized = normalize_path_key(path);
            conn.execute(
                "UPDATE apps SET icon_data = ?1, updated_at = ?3 WHERE normalized_path = ?2",
                rusqlite::params![icon_data, normalized, now_unix_ms()],
            )?;
            Ok(())
        })
    }

    /// Get icon data for an app
    pub fn get_icon(path: &str) -> DbResult<Option<String>> {
        connection::with_connection(|conn| {
            let normalized = normalize_path_key(path);
            let result = conn.query_row(
                "SELECT icon_data FROM apps WHERE normalized_path = ?1",
                [normalized],
                |row| row.get::<_, Option<String>>(0),
            );

            match result {
                Ok(icon) => Ok(icon),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// Migrate usage stats from JSON file to database
    pub fn migrate_from_json() -> DbResult<()> {
        use dirs::data_local_dir;
        use std::fs;

        let json_path =
            data_local_dir().map(|dir| dir.join("ai-quick-search").join("usage-stats.json"));

        let json_path = match json_path {
            Some(path) if path.exists() => path,
            _ => return Ok(()), // No JSON file to migrate
        };

        let contents =
            fs::read_to_string(&json_path).map_err(|e| crate::db::error::DbError::Io(e))?;

        let usage: HashMap<String, UsageEntryJson> = serde_json::from_str(&contents)?;

        connection::with_connection(|conn| {
            let tx = conn.unchecked_transaction()?;

            for (path_key, entry) in usage {
                let normalized_path = normalize_path_key(&path_key);
                if normalized_path.is_empty() {
                    continue;
                }

                // Find app by normalized path
                let app_id: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM apps WHERE normalized_path = ?1",
                        [&normalized_path],
                        |row| row.get(0),
                    )
                    .ok();

                if let Some(app_id) = app_id {
                    let timestamp = normalize_usage_timestamp(entry.last_launched_at);
                    tx.execute(
                        "INSERT INTO app_usage (app_id, launch_count, last_launched_at, first_launched_at)
                         VALUES (?1, ?2, ?3, ?3)
                         ON CONFLICT(app_id) DO UPDATE SET
                            launch_count = MAX(app_usage.launch_count, excluded.launch_count),
                            last_launched_at = MAX(app_usage.last_launched_at, excluded.last_launched_at),
                            first_launched_at = MIN(app_usage.first_launched_at, excluded.first_launched_at)",
                        rusqlite::params![app_id, entry.launch_count, timestamp],
                    )?;
                }
            }

            tx.commit()?;
            Ok(())
        })?;

        // Optionally remove the JSON file after successful migration
        let _ = std::fs::remove_file(&json_path);

        Ok(())
    }
}

/// JSON structure for migration from old format
#[derive(Debug, serde::Deserialize)]
struct UsageEntryJson {
    launch_count: u64,
    last_launched_at: u64,
}

fn normalize_usage_timestamp(value: u64) -> u64 {
    // Legacy JSON stored seconds; SQLite stores milliseconds.
    if value < 1_000_000_000_000 {
        value.saturating_mul(1000)
    } else {
        value
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path_key("C:\\Test\\App.exe"), "c:\\test\\app.exe");
        assert_eq!(normalize_path_key("C:/Test/App.exe"), "c:\\test\\app.exe");
    }
}
