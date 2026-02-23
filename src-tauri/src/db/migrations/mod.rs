mod v1_initial;
mod v2_normalized_path;

use crate::db::error::{DbError, DbResult};
use std::time::{SystemTime, UNIX_EPOCH};
use v1_initial as V1;
use v2_normalized_path as V2;

#[allow(dead_code)]
pub const CURRENT_VERSION: u32 = 2;

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn get_current_version(conn: &rusqlite::Connection) -> DbResult<u32> {
    // First check if the schema_version table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_version')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !table_exists {
        return Ok(0);
    }

    let result = conn.query_row(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
        [],
        |row| row.get::<_, u32>(0),
    );

    match result {
        Ok(version) => Ok(version),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
        Err(e) => Err(DbError::from(e)),
    }
}

fn set_version(conn: &rusqlite::Connection, version: u32) -> DbResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
        rusqlite::params![version, now_unix_ms()],
    )?;
    Ok(())
}

pub fn run_migrations(conn: &rusqlite::Connection) -> DbResult<()> {
    let current = get_current_version(conn)?;

    // V1: Initial schema
    if current < V1::VERSION {
        V1::apply(conn)?;
        set_version(conn, V1::VERSION)?;
    }

    // V2: add normalized_path and supporting indexes.
    if current < V2::VERSION {
        V2::apply(conn)?;
        set_version(conn, V2::VERSION)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(CURRENT_VERSION, 2);
    }
}
