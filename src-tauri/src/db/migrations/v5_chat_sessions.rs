use crate::db::error::DbResult;

pub const VERSION: u32 = 5;

pub fn up_sql() -> &'static str {
    r#"
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        provider_ids_json TEXT NOT NULL DEFAULT '[]',
        prompt TEXT NOT NULL DEFAULT '',
        panes_json TEXT NOT NULL DEFAULT '{}',
        turns INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
    "#
}

#[allow(dead_code)]
pub fn down_sql() -> &'static str {
    r#"
    DROP INDEX IF EXISTS idx_chat_sessions_updated_at;
    DROP TABLE IF EXISTS chat_sessions;
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
        assert_eq!(VERSION, 5);
    }
}
