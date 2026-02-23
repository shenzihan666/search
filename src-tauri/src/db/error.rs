use thiserror::Error;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Migration error: {0}")]
    Migration(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Secret storage error: {0}")]
    Secret(String),
}

pub type DbResult<T> = Result<T, DbError>;
