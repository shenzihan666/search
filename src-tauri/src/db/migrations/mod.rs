mod v1_initial;
mod v2_normalized_path;
mod v3_providers;
mod v4_provider_api_key_sqlite;
mod v5_chat_sessions;
mod v6_chat_messages;
mod v7_refactor_schema;
mod v8_fix_shared_messages;

use crate::db::error::{DbError, DbResult};
use std::time::{SystemTime, UNIX_EPOCH};
use v1_initial as V1;
use v2_normalized_path as V2;
use v3_providers as V3;
use v4_provider_api_key_sqlite as V4;
use v5_chat_sessions as V5;
use v6_chat_messages as V6;
use v7_refactor_schema as V7;
use v8_fix_shared_messages as V8;

#[allow(dead_code)]
pub const CURRENT_VERSION: u32 = 8;

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

    // V3: multi-provider support with providers table.
    if current < V3::VERSION {
        V3::apply(conn)?;
        set_version(conn, V3::VERSION)?;
    }

    // V4: move provider API keys into SQLite (providers.api_key).
    if current < V4::VERSION {
        V4::apply(conn)?;
        set_version(conn, V4::VERSION)?;
    }

    // V5: chat sessions persistence.
    if current < V5::VERSION {
        V5::apply(conn)?;
        set_version(conn, V5::VERSION)?;
    }

    // V6: chat messages persistence for multi-turn/model threads.
    if current < V6::VERSION {
        V6::apply(conn)?;
        set_version(conn, V6::VERSION)?;
    }

    // V7: Remove panes_json/turns from sessions; add system_prompt; add FTS5 search.
    if current < V7::VERSION {
        V7::apply(conn)?;
        set_version(conn, V7::VERSION)?;
    }

    // V8: Migrate shared user messages (provider_id='') to per-provider copies.
    if current < V8::VERSION {
        V8::apply(conn)?;
        set_version(conn, V8::VERSION)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(CURRENT_VERSION, 8);
    }
}
