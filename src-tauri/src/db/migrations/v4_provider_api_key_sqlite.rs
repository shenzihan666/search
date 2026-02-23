use crate::db::error::DbResult;

pub const VERSION: u32 = 4;

fn has_table(conn: &rusqlite::Connection, table: &str) -> DbResult<bool> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
        [table],
        |row| row.get(0),
    )?;
    Ok(exists)
}

fn has_column(conn: &rusqlite::Connection, table: &str, column: &str) -> DbResult<bool> {
    let pragma = format!("PRAGMA table_info({table})");
    let mut stmt = conn.prepare(&pragma)?;
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }

    Ok(false)
}

fn migrate_legacy_single_provider_api_key(conn: &rusqlite::Connection) -> DbResult<()> {
    let provider_config: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'provider_config'",
            [],
            |row| row.get(0),
        )
        .ok();

    let Some(raw) = provider_config else {
        return Ok(());
    };

    let parsed: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };

    let Some(api_key) = parsed
        .get("api_key")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
    else {
        return Ok(());
    };

    // If there is exactly one provider and it has no key, hydrate it from legacy config.
    conn.execute(
        "UPDATE providers
         SET api_key = ?1
         WHERE id = (
           SELECT id FROM providers
           WHERE (api_key IS NULL OR TRIM(api_key) = '')
           ORDER BY is_active DESC, display_order ASC
           LIMIT 1
         )",
        [api_key],
    )?;

    Ok(())
}

pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    if !has_table(conn, "providers")? {
        return Ok(());
    }

    if !has_column(conn, "providers", "api_key")? {
        conn.execute("ALTER TABLE providers ADD COLUMN api_key TEXT", [])?;
    }

    migrate_legacy_single_provider_api_key(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_is_correct() {
        assert_eq!(VERSION, 4);
    }
}
