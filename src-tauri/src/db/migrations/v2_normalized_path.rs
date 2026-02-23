use crate::db::error::DbResult;

pub const VERSION: u32 = 2;

fn has_normalized_path_column(conn: &rusqlite::Connection) -> DbResult<bool> {
    let mut stmt = conn.prepare("PRAGMA table_info(apps)")?;
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == "normalized_path" {
            return Ok(true);
        }
    }

    Ok(false)
}

pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    let has_column = has_normalized_path_column(conn)?;
    let tx = conn.unchecked_transaction()?;

    if !has_column {
        tx.execute("ALTER TABLE apps ADD COLUMN normalized_path TEXT", [])?;
    }

    tx.execute_batch(
        r#"
        -- Normalize existing rows.
        UPDATE apps
        SET normalized_path = LOWER(REPLACE(REPLACE(TRIM(path), '/', char(92)), char(34), ''))
        WHERE normalized_path IS NULL OR normalized_path = '';

        -- Keep one row per normalized path before creating unique index.
        DELETE FROM apps
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM apps
            GROUP BY normalized_path
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_normalized_path ON apps(normalized_path);
        CREATE INDEX IF NOT EXISTS idx_apps_updated_at ON apps(updated_at);
        "#,
    )?;

    tx.commit()?;
    Ok(())
}
