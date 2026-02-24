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
pub struct ChatMessageRecord {
    pub id: String,
    pub session_id: String,
    pub column_id: String,
    pub provider_id: String,
    pub role: String,
    pub content: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSearchResult {
    pub message_id: String,
    pub session_id: String,
    pub session_title: String,
    pub snippet: String,
    pub created_at: i64,
}

pub struct ChatMessagesRepository;

impl ChatMessagesRepository {
    /// Load all messages for a session (oldest first).
    /// P10: Use limit/offset for pagination. Pass limit=0 to load all.
    pub fn list_by_session(
        session_id: &str,
        limit: i64,
        offset: i64,
    ) -> DbResult<Vec<ChatMessageRecord>> {
        connection::with_connection(|conn| {
            let sql = if limit > 0 {
                format!(
                    "SELECT id, session_id, column_id, provider_id, role, content, status, created_at, updated_at
                     FROM chat_messages
                     WHERE session_id = '{session_id}'
                     ORDER BY created_at ASC, id ASC
                     LIMIT {limit} OFFSET {offset}"
                )
            } else {
                format!(
                    "SELECT id, session_id, column_id, provider_id, role, content, status, created_at, updated_at
                     FROM chat_messages
                     WHERE session_id = '{session_id}'
                     ORDER BY created_at ASC, id ASC"
                )
            };

            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map([], |row| {
                Ok(ChatMessageRecord {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    column_id: row.get(2)?,
                    provider_id: row.get(3)?,
                    role: row.get(4)?,
                    content: row.get(5)?,
                    status: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?;

            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            Ok(result)
        })
    }

    /// Count messages for a session (used for checking if there are more pages).
    pub fn count_by_session(session_id: &str) -> DbResult<i64> {
        connection::with_connection(|conn| {
            conn.query_row(
                "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1",
                [session_id],
                |row| row.get(0),
            )
            .map_err(Into::into)
        })
    }

    pub fn create(
        id: &str,
        session_id: &str,
        column_id: &str,
        provider_id: &str,
        role: &str,
        content: &str,
        status: &str,
        created_at: Option<i64>,
        updated_at: Option<i64>,
    ) -> DbResult<ChatMessageRecord> {
        connection::with_connection(|conn| {
            if role != "user" && role != "assistant" {
                return Err(DbError::Query("Invalid message role".to_string()));
            }
            if status != "streaming" && status != "done" && status != "error" {
                return Err(DbError::Query("Invalid message status".to_string()));
            }

            let now = now_unix_ms();
            let created = created_at.unwrap_or(now);
            let updated = updated_at.unwrap_or(created);
            conn.execute(
                "INSERT INTO chat_messages (
                    id, session_id, column_id, provider_id, role, content, status, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![
                    id,
                    session_id,
                    column_id,
                    provider_id,
                    role,
                    content,
                    status,
                    created,
                    updated,
                ],
            )?;

            conn.execute(
                "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
                rusqlite::params![now, session_id],
            )?;

            Ok(ChatMessageRecord {
                id: id.to_string(),
                session_id: session_id.to_string(),
                column_id: column_id.to_string(),
                provider_id: provider_id.to_string(),
                role: role.to_string(),
                content: content.to_string(),
                status: status.to_string(),
                created_at: created,
                updated_at: updated,
            })
        })
    }

    pub fn update_content(id: &str, content: &str, status: &str) -> DbResult<ChatMessageRecord> {
        connection::with_connection(|conn| {
            if status != "streaming" && status != "done" && status != "error" {
                return Err(DbError::Query("Invalid message status".to_string()));
            }

            let now = now_unix_ms();
            let rows = conn.execute(
                "UPDATE chat_messages
                 SET content = ?1, status = ?2, updated_at = ?3
                 WHERE id = ?4",
                rusqlite::params![content, status, now, id],
            )?;

            if rows == 0 {
                return Err(DbError::Query("Message not found".to_string()));
            }

            // Keep all DB operations on this connection handle to avoid
            // re-entering with_connection and deadlocking the global mutex.
            let record = conn
                .query_row(
                    "SELECT id, session_id, column_id, provider_id, role, content, status, created_at, updated_at
                     FROM chat_messages WHERE id = ?1",
                    [id],
                    |row| {
                        Ok(ChatMessageRecord {
                            id: row.get(0)?,
                            session_id: row.get(1)?,
                            column_id: row.get(2)?,
                            provider_id: row.get(3)?,
                            role: row.get(4)?,
                            content: row.get(5)?,
                            status: row.get(6)?,
                            created_at: row.get(7)?,
                            updated_at: row.get(8)?,
                        })
                    },
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        DbError::Query("Message not found".to_string())
                    }
                    _ => e.into(),
                })?;

            conn.execute(
                "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
                rusqlite::params![now, record.session_id],
            )?;

            Ok(record)
        })
    }

    /// P11: Delete a single message by id.
    pub fn delete(id: &str) -> DbResult<()> {
        connection::with_connection(|conn| {
            let rows = conn.execute("DELETE FROM chat_messages WHERE id = ?1", [id])?;
            if rows == 0 {
                return Err(DbError::Query("Message not found".to_string()));
            }
            Ok(())
        })
    }

    /// P13: Full-text search across all messages using FTS5.
    pub fn search(query: &str, limit: i64) -> DbResult<Vec<MessageSearchResult>> {
        connection::with_connection(|conn| {
            let escaped = query.replace('"', "\"\"");
            let fts_query = format!("\"{escaped}\"");

            let mut stmt = conn.prepare(
                "SELECT
                    f.id,
                    f.session_id,
                    COALESCE(s.title, 'Unknown') AS session_title,
                    snippet(chat_messages_fts, 2, '<b>', '</b>', '…', 12) AS snippet,
                    m.created_at
                 FROM chat_messages_fts f
                 JOIN chat_messages m ON m.id = f.id
                 JOIN chat_sessions s ON s.id = f.session_id
                 WHERE chat_messages_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            )?;

            let rows = stmt.query_map(rusqlite::params![fts_query, limit], |row| {
                Ok(MessageSearchResult {
                    message_id: row.get(0)?,
                    session_id: row.get(1)?,
                    session_title: row.get(2)?,
                    snippet: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?;

            let mut result: Vec<MessageSearchResult> = Vec::new();
            for row in rows {
                result.push(row?);
            }
            Ok(result)
        })
    }

    /// P13: Export all messages for a session as an array of records (for JSON/Markdown export).
    pub fn export_session(session_id: &str) -> DbResult<Vec<ChatMessageRecord>> {
        // Reuse list_by_session with no limit
        Self::list_by_session(session_id, 0, 0)
    }
}
