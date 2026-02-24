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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSessionColumnRecord {
    pub id: String,
    pub session_id: String,
    pub position: i64,
    pub provider_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct ChatSessionColumnsRepository;

impl ChatSessionColumnsRepository {
    pub fn list_by_session(session_id: &str) -> DbResult<Vec<ChatSessionColumnRecord>> {
        connection::with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, session_id, position, provider_id, created_at, updated_at
                 FROM chat_session_columns
                 WHERE session_id = ?1
                 ORDER BY position ASC",
            )?;
            let rows = stmt.query_map([session_id], |row| {
                Ok(ChatSessionColumnRecord {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    position: row.get(2)?,
                    provider_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            Ok(result)
        })
    }

    pub fn create_for_session(
        session_id: &str,
        provider_ids: &[String],
    ) -> DbResult<Vec<ChatSessionColumnRecord>> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();
            let ids = if provider_ids.is_empty() {
                vec![String::new()]
            } else {
                provider_ids.to_vec()
            };
            for (idx, provider_id) in ids.iter().enumerate() {
                let column_id = format!("{session_id}:c{idx}");
                conn.execute(
                    "INSERT OR REPLACE INTO chat_session_columns
                     (id, session_id, position, provider_id, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, COALESCE((SELECT created_at FROM chat_session_columns WHERE id = ?1), ?5), ?5)",
                    rusqlite::params![
                        column_id,
                        session_id,
                        idx as i64,
                        provider_id,
                        now
                    ],
                )?;
            }
            // Delete stale columns if count shrank.
            conn.execute(
                "DELETE FROM chat_session_columns
                 WHERE session_id = ?1 AND position >= ?2",
                rusqlite::params![session_id, ids.len() as i64],
            )?;

            let provider_ids_json = serde_json::to_string(&ids)?;
            conn.execute(
                "UPDATE chat_sessions SET provider_ids_json = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![provider_ids_json, now, session_id],
            )?;

            let mut stmt = conn.prepare(
                "SELECT id, session_id, position, provider_id, created_at, updated_at
                 FROM chat_session_columns
                 WHERE session_id = ?1
                 ORDER BY position ASC",
            )?;
            let rows = stmt.query_map([session_id], |row| {
                Ok(ChatSessionColumnRecord {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    position: row.get(2)?,
                    provider_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            Ok(result)
        })
    }

    pub fn set_provider(column_id: &str, provider_id: &str) -> DbResult<ChatSessionColumnRecord> {
        connection::with_connection(|conn| {
            let now = now_unix_ms();
            let updated = conn.execute(
                "UPDATE chat_session_columns
                 SET provider_id = ?1, updated_at = ?2
                 WHERE id = ?3",
                rusqlite::params![provider_id, now, column_id],
            )?;

            if updated == 0 {
                return Err(DbError::Query("Column not found".to_string()));
            }

            // Keep provider_ids_json in sync with current ordered columns.
            let session_id: String = conn.query_row(
                "SELECT session_id FROM chat_session_columns WHERE id = ?1",
                [column_id],
                |row| row.get(0),
            )?;
            let ordered: Vec<String> = {
                let mut stmt = conn.prepare(
                    "SELECT provider_id FROM chat_session_columns
                     WHERE session_id = ?1
                     ORDER BY position ASC",
                )?;
                let rows = stmt.query_map([&session_id], |row| row.get::<_, String>(0))?;
                let mut values = Vec::new();
                for row in rows {
                    values.push(row?);
                }
                values
            };
            let provider_ids_json = serde_json::to_string(&ordered)?;
            conn.execute(
                "UPDATE chat_sessions SET provider_ids_json = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![provider_ids_json, now, session_id],
            )?;

            conn.query_row(
                "SELECT id, session_id, position, provider_id, created_at, updated_at
                 FROM chat_session_columns
                 WHERE id = ?1",
                [column_id],
                |row| {
                    Ok(ChatSessionColumnRecord {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        position: row.get(2)?,
                        provider_id: row.get(3)?,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .map_err(Into::into)
        })
    }
}
