use crate::apps::AppInfo;
use std::panic::catch_unwind;
use std::path::PathBuf;

pub fn scan_installed_apps() -> Vec<AppInfo> {
    let mut apps = Vec::new();

    // Scan 64-bit apps
    if let Ok(key) = windows_registry::LOCAL_MACHINE
        .open("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall")
    {
        apps.extend(extract_apps_from_key(&key));
    }

    // Scan 32-bit apps on 64-bit Windows
    if let Ok(key) = windows_registry::LOCAL_MACHINE
        .open("SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall")
    {
        apps.extend(extract_apps_from_key(&key));
    }

    // Scan user-specific apps
    if let Ok(key) = windows_registry::CURRENT_USER
        .open("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall")
    {
        apps.extend(extract_apps_from_key(&key));
    }

    apps
}

fn extract_apps_from_key(key: &windows_registry::Key) -> Vec<AppInfo> {
    let mut apps = Vec::new();

    if let Ok(key_iter) = key.keys() {
        let keys: Vec<String> = key_iter.collect();
        for subkey_name in keys {
            if let Ok(subkey) = key.open(&subkey_name) {
                if let Ok(name) = subkey.get_string("DisplayName") {
                    if !name.is_empty() {
                        // Try to get executable path from DisplayIcon or InstallLocation
                        let path = subkey
                            .get_string("DisplayIcon")
                            .or_else(|_| subkey.get_string("InstallLocation"))
                            .or_else(|_| subkey.get_string("UninstallString"))
                            .unwrap_or_default();

                        // Extract executable path from uninstall string if needed
                        let clean_path = extract_exe_path(&path);

                        if !clean_path.is_empty() {
                            apps.push(AppInfo {
                                name,
                                path: clean_path,
                                publisher: subkey.get_string("Publisher").ok(),
                            });
                        }
                    }
                }
            }
        }
    }

    apps
}

fn extract_exe_path(input: &str) -> String {
    let input = input.trim();

    // If it's already a path to an executable
    if input.to_lowercase().ends_with(".exe") {
        // Remove quotes if present
        return input.trim_matches('"').to_string();
    }

    // Try to extract path from uninstall command
    if input.contains(".exe") {
        if let Some(start) = input.find('"') {
            if let Some(end) = input[start + 1..].find('"') {
                return input[start + 1..start + 1 + end].to_string();
            }
        }
        // Try to find the exe without quotes
        let lower = input.to_lowercase();
        if let Some(pos) = lower.find(".exe") {
            // Find the start of the path (look backwards for space or start)
            let mut start = pos;
            while start > 0 && !input.chars().nth(start - 1).unwrap().is_whitespace() {
                start -= 1;
            }
            return input[start..pos + 4].trim_matches('"').to_string();
        }
    }

    input.to_string()
}

pub fn scan_start_menu() -> Vec<AppInfo> {
    // Temporarily disabled due to lnk crate panics on malformed shortcuts
    // TODO: Re-enable with proper error handling or alternative library
    Vec::new()
}

fn scan_shortcuts_recursive(path: &PathBuf, apps: &mut Vec<AppInfo>) {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();

            if entry_path.extension().map(|e| e == "lnk").unwrap_or(false) {
                // Use catch_unwind to prevent panics from malformed shortcuts
                let result = catch_unwind(|| {
                    if let Ok(link) = lnk::ShellLink::open(&entry_path) {
                        if let Some(target) = link.relative_path() {
                            let target_path = if target.contains(':') {
                                target.to_string()
                            } else {
                                // Relative path, try to resolve
                                entry_path
                                    .parent()
                                    .map(|p| p.join(target).to_string_lossy().to_string())
                                    .unwrap_or_default()
                            };

                            if !target_path.is_empty()
                                && target_path.to_lowercase().ends_with(".exe")
                            {
                                let name = entry_path
                                    .file_stem()
                                    .map(|s| s.to_string_lossy().to_string())
                                    .unwrap_or_default();

                                if !name.is_empty() {
                                    return Some(AppInfo {
                                        name,
                                        path: target_path,
                                        publisher: None,
                                    });
                                }
                            }
                        }
                    }
                    None
                });

                if let Ok(Some(app_info)) = result {
                    apps.push(app_info);
                }
            } else if entry_path.is_dir() {
                scan_shortcuts_recursive(&entry_path, apps);
            }
        }
    }
}
