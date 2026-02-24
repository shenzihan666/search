use crate::db::error::DbResult;

pub const VERSION: u32 = 6;

pub fn up_sql() -> &'static str {
    r#"
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('streaming', 'done', 'error')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_provider_created
        ON chat_messages(session_id, provider_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
        ON chat_messages(session_id, created_at ASC);
    "#
}

#[allow(dead_code)]
pub fn down_sql() -> &'static str {
    r#"
    DROP INDEX IF EXISTS idx_chat_messages_session_created;
    DROP INDEX IF EXISTS idx_chat_messages_session_provider_created;
    DROP TABLE IF EXISTS chat_messages;
    "#
}

pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    conn.execute_batch(up_sql())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(VERSION, 6);
    }
}
