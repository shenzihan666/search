use serde::{Deserialize, Serialize};

/// Represents a setting entry in the database
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SettingEntry {
    pub key: String,
    pub value: String,
    pub updated_at: u64,
}

/// Represents an app record in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AppRecord {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub normalized_path: String,
    pub publisher: Option<String>,
    pub icon_data: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Represents app usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AppUsageRecord {
    pub app_id: i64,
    pub launch_count: u64,
    pub last_launched_at: u64,
    pub first_launched_at: u64,
}

/// Schema version record
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SchemaVersion {
    pub version: u32,
    pub applied_at: u64,
}
