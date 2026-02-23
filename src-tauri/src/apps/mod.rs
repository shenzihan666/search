mod cache;
mod scanner;

use fuzzy_matcher::FuzzyMatcher;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

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

pub use cache::{
    get_cached_apps, get_or_extract_icon, get_suggested_apps, initialize_cache, record_app_launch,
    refresh_cache,
};

fn path_basename(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn search_apps(query: String) -> Result<Vec<SearchResult>, String> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let apps = get_cached_apps().await;

    if apps.is_empty() {
        return Ok(Vec::new());
    }

    let matcher = fuzzy_matcher::skim::SkimMatcherV2::default();
    let query_lower = query.to_lowercase();
    let query_len = query.chars().count();
    let min_fuzzy_score = if query_len <= 2 {
        35
    } else if query_len <= 4 {
        55
    } else {
        70
    };
    let non_ascii_query = !query.is_ascii();

    let mut seen_paths = HashSet::new();
    let mut results: Vec<SearchResult> = apps
        .into_iter()
        .filter_map(|app| {
            let path_key = app.path.to_lowercase();
            if !seen_paths.insert(path_key) {
                return None;
            }

            let name_lower = app.name.to_lowercase();
            let publisher_lower = app.publisher.clone().unwrap_or_default().to_lowercase();
            let basename_lower = path_basename(&app.path).to_lowercase();

            let name_contains = name_lower.contains(&query_lower);
            let publisher_contains = publisher_lower.contains(&query_lower);
            let basename_contains = basename_lower.contains(&query_lower);
            let contains_match = name_contains || publisher_contains || basename_contains;

            // For CJK/non-ASCII input, require direct contains to avoid unrelated fuzzy noise.
            if non_ascii_query && !contains_match {
                return None;
            }

            let fuzzy_name = matcher.fuzzy_match(&name_lower, &query_lower);
            let fuzzy_basename = matcher.fuzzy_match(&basename_lower, &query_lower);
            let fuzzy_score = fuzzy_name
                .into_iter()
                .chain(fuzzy_basename)
                .max()
                .unwrap_or(i64::MIN);

            if !contains_match && fuzzy_score < min_fuzzy_score {
                return None;
            }

            let mut score = fuzzy_score.max(0);
            if name_lower.starts_with(&query_lower) {
                score += 5000;
            } else if name_contains {
                score += 3500;
            } else if basename_lower.starts_with(&query_lower) {
                score += 3200;
            } else if basename_contains {
                score += 2200;
            } else if publisher_contains {
                score += 1000;
            }

            Some(SearchResult { app, score })
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

    let requested_path = path.trim();
    if requested_path.is_empty() {
        return Err("Launch denied: empty app path".to_string());
    }

    let apps = get_cached_apps().await;
    let is_allowed = apps
        .iter()
        .any(|app| app.path.eq_ignore_ascii_case(requested_path));
    if !is_allowed {
        return Err("Launch denied: app path is not in indexed search results".to_string());
    }

    if !Path::new(requested_path).exists() {
        return Err(format!(
            "Launch denied: executable not found at '{}'",
            requested_path
        ));
    }

    Command::new(requested_path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to launch {}: {}", requested_path, e))?;

    record_app_launch(requested_path).await;

    Ok(())
}

#[tauri::command]
pub async fn refresh_app_cache() -> Result<(), String> {
    refresh_cache().await;
    Ok(())
}

#[tauri::command]
pub async fn get_app_icon(path: String) -> Result<Option<String>, String> {
    Ok(get_or_extract_icon(path).await)
}

#[tauri::command]
pub async fn get_suggestions(limit: Option<usize>) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(8).clamp(1, 20);
    let apps = get_suggested_apps(limit).await;

    let suggestions = apps
        .into_iter()
        .map(|app| SearchResult { app, score: 0 })
        .collect();

    Ok(suggestions)
}
