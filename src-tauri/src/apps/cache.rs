use crate::apps::{scanner, AppInfo};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

static APP_CACHE: Lazy<Arc<RwLock<Vec<AppInfo>>>> = Lazy::new(|| Arc::new(RwLock::new(Vec::new())));
static ICON_CACHE: Lazy<Arc<RwLock<HashMap<String, Option<String>>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));
static USAGE_CACHE: Lazy<Arc<RwLock<HashMap<String, UsageEntry>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct UsageEntry {
    launch_count: u64,
    last_launched_at: u64,
}

fn normalize_path_key(path: &str) -> String {
    path.trim()
        .trim_matches('"')
        .replace('/', "\\")
        .to_lowercase()
}

fn normalize_display_name(name: &str) -> String {
    name.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn usage_file_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|dir| dir.join("ai-quick-search").join("usage-stats.json"))
}

fn read_usage_from_disk() -> HashMap<String, UsageEntry> {
    let Some(path) = usage_file_path() else {
        return HashMap::new();
    };

    let Ok(contents) = fs::read_to_string(path) else {
        return HashMap::new();
    };

    serde_json::from_str(&contents).unwrap_or_default()
}

fn write_usage_to_disk(stats: &HashMap<String, UsageEntry>) {
    let Some(path) = usage_file_path() else {
        return;
    };

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(serialized) = serde_json::to_string(stats) {
        let _ = fs::write(path, serialized);
    }
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub async fn get_cached_apps() -> Vec<AppInfo> {
    let cache = APP_CACHE.read().await;
    cache.clone()
}

pub async fn refresh_cache() {
    let mut cache = APP_CACHE.write().await;

    // Scan both registry and start menu
    let mut apps = scanner::scan_installed_apps();
    apps.extend(scanner::scan_start_menu());

    // Deduplicate by normalized executable path and keep richer publisher metadata.
    let mut deduped: HashMap<String, AppInfo> = HashMap::new();
    for mut app in apps {
        app.name = normalize_display_name(&app.name);
        app.path = app.path.trim().trim_matches('"').to_string();

        if app.name.is_empty() || app.path.is_empty() {
            continue;
        }

        let path_key = normalize_path_key(&app.path);
        if path_key.is_empty() {
            continue;
        }

        deduped
            .entry(path_key)
            .and_modify(|existing| {
                if existing.publisher.is_none() && app.publisher.is_some() {
                    *existing = app.clone();
                }
            })
            .or_insert(app);
    }

    let mut unique_apps: Vec<AppInfo> = deduped.into_values().collect();
    unique_apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    *cache = unique_apps;
}

pub async fn initialize_cache() {
    refresh_cache().await;
    let usage = read_usage_from_disk();
    *USAGE_CACHE.write().await = usage;
}

pub async fn get_or_extract_icon(path: String) -> Option<String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }

    let cache_key = normalize_path_key(trimmed);
    if let Some(icon) = ICON_CACHE.read().await.get(&cache_key).cloned() {
        return icon;
    }

    let icon = scanner::extract_icon_data_url(trimmed);
    ICON_CACHE.write().await.insert(cache_key, icon.clone());
    icon
}

pub async fn record_app_launch(path: &str) {
    let key = normalize_path_key(path);
    if key.is_empty() {
        return;
    }

    let mut usage = USAGE_CACHE.write().await;
    let entry = usage.entry(key).or_default();
    entry.launch_count += 1;
    entry.last_launched_at = now_unix_seconds();
    let snapshot = usage.clone();
    drop(usage);

    write_usage_to_disk(&snapshot);
}

pub async fn get_suggested_apps(limit: usize) -> Vec<AppInfo> {
    let limit = limit.clamp(1, 20);
    let apps = APP_CACHE.read().await.clone();
    if apps.is_empty() {
        return Vec::new();
    }

    let usage = USAGE_CACHE.read().await.clone();
    let mut ranked: Vec<(AppInfo, u64, u64)> = apps
        .into_iter()
        .filter_map(|app| {
            let key = normalize_path_key(&app.path);
            let stat = usage.get(&key)?;
            if stat.launch_count == 0 {
                return None;
            }
            Some((app, stat.launch_count, stat.last_launched_at))
        })
        .collect();

    ranked.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| b.2.cmp(&a.2))
            .then_with(|| a.0.name.cmp(&b.0.name))
    });

    let suggestions: Vec<AppInfo> = ranked
        .into_iter()
        .take(limit)
        .map(|(app, _, _)| app)
        .collect();

    suggestions
}
