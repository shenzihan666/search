use crate::db::connection;
use crate::db::error::{DbError, DbResult};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// V7: panes_json and turns removed from the DB. turns is now derived from
/// chat_messages at read time. system_prompt is a new optional column.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSessionRecord {
    pub id: String,
    pub title: String,
    pub provider_ids: Vec<String>,
    pub prompt: String,
    pub system_prompt: String,
    /// Derived at read time: COUNT of user messages for this session.
    pub turns: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct ChatSessionsRepository;

impl ChatSessionsRepository {
    pub fn list() -> DbResult<Vec<ChatSessionRecord>> {
        connection::with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT
                    s.id,
                    s.title,
                    s.provider_ids_json,
                    s.prompt,
                    s.system_prompt,
                    s.created_at,
                    s.updated_at,
                    (SELECT COUNT(*) FROM chat_messages m
                     WHERE m.session_id = s.id AND m.role = 'user') AS turns
                 FROM chat_sessions s
                 ORDER BY s.updated_at DESC",
            )?;

            let rows = stmt.query_map([], |row| {
                let provider_ids_json: String = row.get(2)?;
                let provider_ids =
                    serde_json::from_str::<Vec<String>>(&provider_ids_json).unwrap_or_default();
                Ok(ChatSessionRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    provider_ids,
                    prompt: row.get(3)?,
                    system_prompt: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                    turns: row.get(7)?,
                })
            })?;

            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            Ok(result)
        })
    }

    pub fn create(id: &str, title: &str, provider_ids: &[String]) -> DbResult<ChatSessionRecord> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();
            let normalized_title = if title.trim().is_empty() {
                "New Session".to_string()
            } else {
                title.trim().to_string()
            };

            let provider_ids_json = serde_json::to_string(provider_ids)?;

            conn.execute(
                "INSERT INTO chat_sessions
                    (id, title, provider_ids_json, prompt, system_prompt, created_at, updated_at)
                 VALUES (?1, ?2, ?3, '', '', ?4, ?4)",
                rusqlite::params![id, normalized_title, provider_ids_json, now],
            )?;

            let column_provider_ids = if provider_ids.is_empty() {
                vec![String::new()]
            } else {
                provider_ids.to_vec()
            };
            for (idx, provider_id) in column_provider_ids.iter().enumerate() {
                let column_id = format!("{id}:c{idx}");
                conn.execute(
                    "INSERT OR REPLACE INTO chat_session_columns
                     (id, session_id, position, provider_id, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                    rusqlite::params![column_id, id, idx as i64, provider_id, now],
                )?;
            }

            Ok(ChatSessionRecord {
                id: id.to_string(),
                title: normalized_title,
                provider_ids: provider_ids.to_vec(),
                prompt: String::new(),
                system_prompt: String::new(),
                turns: 0,
                created_at: now,
                updated_at: now,
            })
        })
    }

    pub fn rename(id: &str, title: &str) -> DbResult<ChatSessionRecord> {
        connection::with_connection(|conn| {
            let normalized_title = title.trim();
            if normalized_title.is_empty() {
                return Err(DbError::Query("Session title cannot be empty".to_string()));
            }

            let now = now_unix_ms();
            let rows = conn.execute(
                "UPDATE chat_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![normalized_title, now, id],
            )?;

            if rows == 0 {
                return Err(DbError::Query("Session not found".to_string()));
            }

            conn.query_row(
                "SELECT
                    s.id,
                    s.title,
                    s.provider_ids_json,
                    s.prompt,
                    s.system_prompt,
                    s.created_at,
                    s.updated_at,
                    (SELECT COUNT(*) FROM chat_messages m
                     WHERE m.session_id = s.id AND m.role = 'user') AS turns
                 FROM chat_sessions s
                 WHERE s.id = ?1",
                [id],
                |row| {
                    let provider_ids_json: String = row.get(2)?;
                    let provider_ids =
                        serde_json::from_str::<Vec<String>>(&provider_ids_json).unwrap_or_default();
                    Ok(ChatSessionRecord {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        provider_ids,
                        prompt: row.get(3)?,
                        system_prompt: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                        turns: row.get(7)?,
                    })
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::Query("Session not found".to_string())
                }
                _ => e.into(),
            })
        })
    }

    /// Save session metadata (provider list and last prompt).
    /// panes and turns are no longer persisted — they are derived from messages.
    pub fn save_state(
        id: &str,
        provider_ids: &[String],
        prompt: &str,
    ) -> DbResult<ChatSessionRecord> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();
            let provider_ids_json = serde_json::to_string(provider_ids)?;

            let rows = conn.execute(
                "UPDATE chat_sessions
                 SET provider_ids_json = ?1, prompt = ?2, updated_at = ?3
                 WHERE id = ?4",
                rusqlite::params![provider_ids_json, prompt, now, id],
            )?;

            if rows == 0 {
                return Err(DbError::Query("Session not found".to_string()));
            }

            let column_provider_ids = if provider_ids.is_empty() {
                vec![String::new()]
            } else {
                provider_ids.to_vec()
            };
            for (idx, provider_id) in column_provider_ids.iter().enumerate() {
                let column_id = format!("{id}:c{idx}");
                conn.execute(
                    "INSERT OR REPLACE INTO chat_session_columns
                     (id, session_id, position, provider_id, created_at, updated_at)
                     VALUES (
                        ?1, ?2, ?3, ?4,
                        COALESCE((SELECT created_at FROM chat_session_columns WHERE id = ?1), ?5),
                        ?5
                     )",
                    rusqlite::params![column_id, id, idx as i64, provider_id, now],
                )?;
            }
            conn.execute(
                "DELETE FROM chat_session_columns
                 WHERE session_id = ?1 AND position >= ?2",
                rusqlite::params![id, column_provider_ids.len() as i64],
            )?;

            conn.query_row(
                "SELECT
                    s.id,
                    s.title,
                    s.provider_ids_json,
                    s.prompt,
                    s.system_prompt,
                    s.created_at,
                    s.updated_at,
                    (SELECT COUNT(*) FROM chat_messages m
                     WHERE m.session_id = s.id AND m.role = 'user') AS turns
                 FROM chat_sessions s
                 WHERE s.id = ?1",
                [id],
                |row| {
                    let provider_ids_json: String = row.get(2)?;
                    let provider_ids =
                        serde_json::from_str::<Vec<String>>(&provider_ids_json).unwrap_or_default();
                    Ok(ChatSessionRecord {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        provider_ids,
                        prompt: row.get(3)?,
                        system_prompt: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                        turns: row.get(7)?,
                    })
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::Query("Session not found".to_string())
                }
                _ => e.into(),
            })
        })
    }

    pub fn set_system_prompt(id: &str, system_prompt: &str) -> DbResult<ChatSessionRecord> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();
            let rows = conn.execute(
                "UPDATE chat_sessions SET system_prompt = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![system_prompt, now, id],
            )?;

            if rows == 0 {
                return Err(DbError::Query("Session not found".to_string()));
            }

            conn.query_row(
                "SELECT
                    s.id,
                    s.title,
                    s.provider_ids_json,
                    s.prompt,
                    s.system_prompt,
                    s.created_at,
                    s.updated_at,
                    (SELECT COUNT(*) FROM chat_messages m
                     WHERE m.session_id = s.id AND m.role = 'user') AS turns
                 FROM chat_sessions s
                 WHERE s.id = ?1",
                [id],
                |row| {
                    let provider_ids_json: String = row.get(2)?;
                    let provider_ids =
                        serde_json::from_str::<Vec<String>>(&provider_ids_json).unwrap_or_default();
                    Ok(ChatSessionRecord {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        provider_ids,
                        prompt: row.get(3)?,
                        system_prompt: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                        turns: row.get(7)?,
                    })
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::Query("Session not found".to_string())
                }
                _ => e.into(),
            })
        })
    }

    pub fn delete(id: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            // Explicitly delete messages first as a safety net alongside FK cascade.
            conn.execute("DELETE FROM chat_messages WHERE session_id = ?1", [id])?;
            conn.execute("DELETE FROM chat_sessions WHERE id = ?1", [id])?;
            Ok(())
        })
    }
}
