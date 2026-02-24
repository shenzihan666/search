use crate::db::error::DbResult;
use std::time::{SystemTime, UNIX_EPOCH};

pub const VERSION: u32 = 9;

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn parse_provider_ids(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw).unwrap_or_default()
}

/// V9: introduce session columns and assign every message to a column.
///
/// - New table: chat_session_columns(session_id, position, provider_id)
/// - New column on chat_messages: column_id
/// - Startup migration backfills columns for old sessions and assigns message.column_id
pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS chat_session_columns (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            provider_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_session_columns_session_position
            ON chat_session_columns(session_id, position);
        CREATE INDEX IF NOT EXISTS idx_chat_session_columns_session
            ON chat_session_columns(session_id);
        ",
    )?;

    // Add column_id if absent.
    let has_column_id: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1
                FROM pragma_table_info('chat_messages')
                WHERE name='column_id'
            )",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_column_id {
        conn.execute("ALTER TABLE chat_messages ADD COLUMN column_id TEXT", [])?;
    }

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_session_column_created
         ON chat_messages(session_id, column_id, created_at ASC)",
        [],
    )?;

    let now = now_unix_ms();

    // Build columns for each session if missing.
    let sessions: Vec<(String, String)> = {
        let mut stmt = conn.prepare("SELECT id, provider_ids_json FROM chat_sessions")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        out
    };

    for (session_id, provider_ids_json) in sessions {
        let mut provider_ids = parse_provider_ids(&provider_ids_json);
        if provider_ids.is_empty() {
            // Fallback for legacy/inconsistent rows.
            let mut stmt = conn.prepare(
                "SELECT DISTINCT provider_id
                 FROM chat_messages
                 WHERE session_id = ?1 AND provider_id != ''
                 ORDER BY provider_id ASC",
            )?;
            let rows = stmt.query_map([&session_id], |row| row.get::<_, String>(0))?;
            for row in rows {
                provider_ids.push(row?);
            }
        }

        // If still empty create a single placeholder column to keep schema consistent.
        if provider_ids.is_empty() {
            provider_ids.push(String::new());
        }

        // Insert only if no columns exist for this session.
        let existing_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chat_session_columns WHERE session_id = ?1",
            [&session_id],
            |row| row.get(0),
        )?;

        if existing_count == 0 {
            for (idx, provider_id) in provider_ids.iter().enumerate() {
                let column_id = format!("{session_id}:c{idx}");
                conn.execute(
                    "INSERT OR IGNORE INTO chat_session_columns
                     (id, session_id, position, provider_id, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                    rusqlite::params![column_id, session_id, idx as i64, provider_id, now],
                )?;
            }
        }
    }

    // Backfill message.column_id for old rows.
    let message_rows: Vec<(String, String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, provider_id
             FROM chat_messages
             WHERE column_id IS NULL OR column_id = ''",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        out
    };

    for (message_id, session_id, provider_id) in message_rows {
        let candidate = conn
            .query_row(
                "SELECT id
                 FROM chat_session_columns
                 WHERE session_id = ?1 AND provider_id = ?2
                 ORDER BY position ASC
                 LIMIT 1",
                rusqlite::params![session_id, provider_id],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .or_else(|| {
                conn.query_row(
                    "SELECT id
                     FROM chat_session_columns
                     WHERE session_id = ?1
                     ORDER BY position ASC
                     LIMIT 1",
                    [&session_id],
                    |row| row.get::<_, String>(0),
                )
                .ok()
            });

        if let Some(column_id) = candidate {
            conn.execute(
                "UPDATE chat_messages SET column_id = ?1 WHERE id = ?2",
                rusqlite::params![column_id, message_id],
            )?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(VERSION, 9);
    }
}
