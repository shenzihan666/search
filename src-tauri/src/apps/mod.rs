mod cache;
mod scanner;

use fuzzy_matcher::FuzzyMatcher;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub publisher: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub app: AppInfo,
    pub score: i64,
}

pub use cache::{get_cached_apps, initialize_cache, refresh_cache};

#[tauri::command]
pub async fn search_apps(query: String) -> Result<Vec<SearchResult>, String> {
    let apps = get_cached_apps().await;

    if apps.is_empty() {
        return Ok(Vec::new());
    }

    let matcher = fuzzy_matcher::skim::SkimMatcherV2::default();

    let mut results: Vec<SearchResult> = apps
        .into_iter()
        .filter_map(|app| {
            matcher
                .fuzzy_match(&app.name, &query)
                .map(|score| SearchResult { app, score })
        })
        .collect();

    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(10);

    Ok(results)
}

#[tauri::command]
pub async fn launch_app(path: String) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    Command::new(&path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to launch {}: {}", path, e))?;

    Ok(())
}

#[tauri::command]
pub async fn refresh_app_cache() -> Result<(), String> {
    refresh_cache().await;
    Ok(())
}
