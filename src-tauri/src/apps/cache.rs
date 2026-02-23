use crate::apps::{scanner, AppInfo};
use crate::db::AppsRepository;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// In-memory caches for fast access
static APP_CACHE: Lazy<Arc<RwLock<Vec<AppInfo>>>> = Lazy::new(|| Arc::new(RwLock::new(Vec::new())));
static ICON_CACHE: Lazy<Arc<RwLock<HashMap<String, Option<String>>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

fn normalize_path_key(path: &str) -> String {
    path.trim()
        .trim_matches('"')
        .replace('/', "\\")
        .to_lowercase()
}

fn normalize_display_name(name: &str) -> String {
    name.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub async fn get_cached_apps() -> Vec<AppInfo> {
    let cache = APP_CACHE.read().await;
    cache.clone()
}

pub async fn refresh_cache() {
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

    // Persist atomically to database.
    let apps_to_save = unique_apps.clone();
    match tokio::task::spawn_blocking(move || AppsRepository::sync_apps(&apps_to_save)).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => eprintln!("Failed to sync apps to database: {e}"),
        Err(e) => eprintln!("Failed to join app sync task: {e}"),
    }

    *APP_CACHE.write().await = unique_apps;
}

pub async fn initialize_cache() {
    // Try to load from database first.
    let db_apps = tokio::task::spawn_blocking(AppsRepository::get_all_apps).await;
    let loaded_from_db = match db_apps {
        Ok(Ok(apps)) if !apps.is_empty() => {
            *APP_CACHE.write().await = apps;
            true
        }
        Ok(Ok(_)) => false,
        Ok(Err(e)) => {
            eprintln!("Failed to read apps from database: {e}");
            false
        }
        Err(e) => {
            eprintln!("Failed to join database read task: {e}");
            false
        }
    };

    if !loaded_from_db {
        // Database empty or unavailable, scan system.
        refresh_cache().await;
    }

    // Always attempt one-time JSON usage migration after app list is available.
    match tokio::task::spawn_blocking(AppsRepository::migrate_from_json).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => eprintln!("Failed to migrate usage stats: {e}"),
        Err(e) => eprintln!("Failed to join usage migration task: {e}"),
    }
}

pub async fn get_or_extract_icon(path: String) -> Option<String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }

    let cache_key = normalize_path_key(trimmed);

    // Check in-memory cache first
    if let Some(icon) = ICON_CACHE.read().await.get(&cache_key).cloned() {
        return icon;
    }

    // Try database cache
    let path_for_db = trimmed.to_string();
    let db_result =
        tokio::task::spawn_blocking(move || AppsRepository::get_icon(&path_for_db)).await;

    if let Ok(Ok(Some(ref icon))) = db_result {
        ICON_CACHE
            .write()
            .await
            .insert(cache_key.clone(), Some(icon.clone()));
        return Some(icon.clone());
    }

    // Extract from executable
    let icon = scanner::extract_icon_data_url(trimmed);

    // Save to caches
    if let Some(ref icon_data) = icon {
        let path_for_save = trimmed.to_string();
        let icon_data_clone = icon_data.clone();
        match tokio::task::spawn_blocking(move || {
            AppsRepository::save_icon(&path_for_save, &icon_data_clone)
        })
        .await
        {
            Ok(Ok(())) => {}
            Ok(Err(e)) => eprintln!("Failed to persist app icon: {e}"),
            Err(e) => eprintln!("Failed to join icon save task: {e}"),
        }
    }

    ICON_CACHE.write().await.insert(cache_key, icon.clone());
    icon
}

pub async fn record_app_launch(path: &str) {
    let key = normalize_path_key(path);
    if key.is_empty() {
        return;
    }

    let path_for_db = path.to_string();
    match tokio::task::spawn_blocking(move || AppsRepository::record_launch(&path_for_db)).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => eprintln!("Failed to record app launch: {e}"),
        Err(e) => eprintln!("Failed to join app launch task: {e}"),
    }
}

pub async fn get_suggested_apps(limit: usize) -> Vec<AppInfo> {
    let limit = limit.clamp(1, 20);

    // Try to get from database (has usage stats)
    let db_result =
        tokio::task::spawn_blocking(move || AppsRepository::get_suggested_apps(limit)).await;

    if let Ok(Ok(apps)) = db_result {
        if !apps.is_empty() {
            return apps;
        }
    }

    Vec::new()
}
