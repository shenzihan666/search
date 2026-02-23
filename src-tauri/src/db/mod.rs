mod connection;
mod error;
mod migrations;
mod repositories;
mod schema;

use error::{DbError, DbResult};
use tauri::{AppHandle, Manager};

pub fn initialize(app: &AppHandle) -> DbResult<()> {
    let db_path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| DbError::Connection(format!("Failed to get app data dir: {e}")))?
        .join("data.db");

    connection::initialize(db_path)
}

pub use repositories::{AppsRepository, SettingsRepository};
