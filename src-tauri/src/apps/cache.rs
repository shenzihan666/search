use crate::apps::{scanner, AppInfo};
use once_cell::sync::Lazy;
use std::sync::Arc;
use tokio::sync::RwLock;

static APP_CACHE: Lazy<Arc<RwLock<Vec<AppInfo>>>> = Lazy::new(|| Arc::new(RwLock::new(Vec::new())));

pub async fn get_cached_apps() -> Vec<AppInfo> {
    let cache = APP_CACHE.read().await;
    cache.clone()
}

pub async fn refresh_cache() {
    let mut cache = APP_CACHE.write().await;

    // Scan both registry and start menu
    let mut apps = scanner::scan_installed_apps();
    apps.extend(scanner::scan_start_menu());

    // Deduplicate by name (case-insensitive)
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name));

    // Filter out entries with empty paths
    apps.retain(|app| !app.path.is_empty());

    *cache = apps;
}

pub async fn initialize_cache() {
    refresh_cache().await;
}
