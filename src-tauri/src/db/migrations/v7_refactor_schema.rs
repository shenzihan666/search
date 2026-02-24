use crate::db::error::DbResult;

pub const VERSION: u32 = 7;

/// V7: Remove panes_json and turns from chat_sessions (UI state → not persisted).
/// Add system_prompt column for per-session system instructions.
/// Add FTS5 virtual table for full-text search on chat messages.
pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    conn.execute_batch(
        "
        -- Recreate chat_sessions without panes_json and turns, adding system_prompt
        CREATE TABLE IF NOT EXISTS chat_sessions_v7 (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            provider_ids_json TEXT NOT NULL DEFAULT '[]',
            prompt TEXT NOT NULL DEFAULT '',
            system_prompt TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        INSERT INTO chat_sessions_v7 (id, title, provider_ids_json, prompt, created_at, updated_at)
        SELECT id, title, provider_ids_json, prompt, created_at, updated_at
        FROM chat_sessions;

        DROP TABLE chat_sessions;
        ALTER TABLE chat_sessions_v7 RENAME TO chat_sessions;

        CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
            ON chat_sessions(updated_at DESC);

        -- FTS5 virtual table for message full-text search
        CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts
        USING fts5(
            id UNINDEXED,
            session_id UNINDEXED,
            content,
            tokenize = 'unicode61'
        );

        -- Populate FTS from existing messages
        INSERT OR IGNORE INTO chat_messages_fts (id, session_id, content)
        SELECT id, session_id, content FROM chat_messages WHERE content != '';

        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS trg_messages_fts_insert
        AFTER INSERT ON chat_messages BEGIN
            INSERT INTO chat_messages_fts (id, session_id, content)
            VALUES (new.id, new.session_id, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS trg_messages_fts_update
        AFTER UPDATE ON chat_messages BEGIN
            UPDATE chat_messages_fts SET content = new.content WHERE id = new.id;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_messages_fts_delete
        AFTER DELETE ON chat_messages BEGIN
            DELETE FROM chat_messages_fts WHERE id = old.id;
        END;
        ",
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(VERSION, 7);
    }
}
