use crate::db::error::{DbError, DbResult};
use crate::db::migrations;
use once_cell::sync::Lazy;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

static DB_CONNECTION: Lazy<Arc<Mutex<Option<Connection>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

/// Initialize the database connection and run migrations
pub fn initialize(db_path: PathBuf) -> DbResult<()> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(DbError::Io)?;
    }

    // Open connection
    let conn = Connection::open(&db_path)?;

    // Configure SQLite for desktop app usage.
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        ",
    )?;
    conn.busy_timeout(Duration::from_secs(5))?;

    // Run migrations
    migrations::run_migrations(&conn)?;

    // Store connection
    {
        let mut guard = DB_CONNECTION
            .lock()
            .map_err(|_| DbError::Connection("Failed to acquire lock".to_string()))?;
        *guard = Some(conn);
    }

    Ok(())
}

/// Execute a closure with the database connection
pub fn with_connection<F, T>(f: F) -> DbResult<T>
where
    F: FnOnce(&Connection) -> DbResult<T>,
{
    let guard = DB_CONNECTION
        .lock()
        .map_err(|_| DbError::Connection("Failed to acquire lock".to_string()))?;

    let conn = guard
        .as_ref()
        .ok_or_else(|| DbError::Connection("Database not initialized".to_string()))?;

    f(conn)
}

/// Shutdown and close the database connection
#[allow(dead_code)]
pub fn shutdown() {
    if let Ok(mut guard) = DB_CONNECTION.lock() {
        *guard = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn test_initialize_db_path() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ai-quick-search-test-{unique}.db"));

        initialize(path.clone()).unwrap();
        assert!(path.exists());

        let _ = std::fs::remove_file(path);
    }
}
