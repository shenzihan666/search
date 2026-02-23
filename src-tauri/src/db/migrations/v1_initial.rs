use crate::db::error::DbResult;

pub const VERSION: u32 = 1;

pub fn up_sql() -> &'static str {
    r#"
    -- Settings table (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    );

    -- Apps table
    CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        normalized_path TEXT NOT NULL UNIQUE,
        publisher TEXT,
        icon_data TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    -- Create index on path for fast lookups
    CREATE INDEX IF NOT EXISTS idx_apps_path ON apps(path);
    CREATE INDEX IF NOT EXISTS idx_apps_normalized_path ON apps(normalized_path);

    -- Create index on name for search
    CREATE INDEX IF NOT EXISTS idx_apps_name ON apps(name);

    -- App usage statistics table
    CREATE TABLE IF NOT EXISTS app_usage (
        app_id INTEGER PRIMARY KEY,
        launch_count INTEGER DEFAULT 0,
        last_launched_at INTEGER,
        first_launched_at INTEGER,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );

    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
    );
    "#
}

#[allow(dead_code)]
pub fn down_sql() -> &'static str {
    r#"
    DROP TABLE IF EXISTS app_usage;
    DROP TABLE IF EXISTS apps;
    DROP TABLE IF EXISTS settings;
    DROP TABLE IF EXISTS schema_version;
    "#
}

pub fn apply(conn: &rusqlite::Connection) -> DbResult<()> {
    conn.execute_batch(up_sql())?;
    Ok(())
}
