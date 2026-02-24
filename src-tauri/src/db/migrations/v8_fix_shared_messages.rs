use crate::db::error::DbResult;
use std::time::{SystemTime, UNIX_EPOCH};

pub const VERSION: u32 = 8;

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// V8: Migrate shared user messages (provider_id='') to per-provider copies.
/// This is a data migration: for each shared message, we create one copy per
/// provider in the session, then delete the original.
pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    // Find all sessions that have shared messages
    let session_ids: Vec<String> = {
        let mut stmt =
            conn.prepare("SELECT DISTINCT session_id FROM chat_messages WHERE provider_id = ''")?;
        let ids = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut result = Vec::new();
        for id in ids {
            result.push(id?);
        }
        result
    };

    for session_id in &session_ids {
        // Get provider_ids for this session
        let provider_ids_json: Option<String> = conn
            .query_row(
                "SELECT provider_ids_json FROM chat_sessions WHERE id = ?1",
                [session_id],
                |row| row.get(0),
            )
            .ok();

        let provider_ids: Vec<String> = provider_ids_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        if provider_ids.is_empty() {
            // No providers — just delete the orphan shared messages
            conn.execute(
                "DELETE FROM chat_messages WHERE session_id = ?1 AND provider_id = ''",
                [session_id],
            )?;
            continue;
        }

        // Get all shared messages for this session ordered by creation time
        let shared_messages: Vec<(String, String, String, String, i64)> = {
            let mut stmt = conn.prepare(
                "SELECT id, role, content, status, created_at
                 FROM chat_messages
                 WHERE session_id = ?1 AND provider_id = ''
                 ORDER BY created_at ASC",
            )?;
            let rows = stmt.query_map([session_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            result
        };

        // For each shared message, create a copy per provider
        let now = now_unix_ms();
        for (orig_id, role, content, status, created_at) in &shared_messages {
            for (i, provider_id) in provider_ids.iter().enumerate() {
                let new_id = format!("{}-p{}", orig_id, i);
                conn.execute(
                    "INSERT OR IGNORE INTO chat_messages
                     (id, session_id, provider_id, role, content, status, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    rusqlite::params![
                        new_id,
                        session_id,
                        provider_id,
                        role,
                        content,
                        status,
                        created_at,
                        now
                    ],
                )?;
            }
        }

        // Delete the original shared messages
        conn.execute(
            "DELETE FROM chat_messages WHERE session_id = ?1 AND provider_id = ''",
            [session_id],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(VERSION, 8);
    }
}
