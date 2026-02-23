use crate::apps::AppInfo;
use std::collections::HashSet;
use std::path::PathBuf;
use std::process::Command;

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
    let lower = input.to_lowercase();

    if let Some(exe_pos) = lower.find(".exe") {
        let exe_end = exe_pos + 4;

        // Prefer a quoted executable path if present.
        if let Some(quote_start) = input[..exe_end].rfind('"') {
            let candidate = input[quote_start + 1..exe_end].trim();
            if !candidate.is_empty() {
                return candidate.to_string();
            }
        }

        return input[..exe_end].trim_matches('"').trim().to_string();
    }

    input.to_string()
}

pub fn extract_icon_data_url(path: &str) -> Option<String> {
    let clean_path = extract_exe_path(path);
    if clean_path.is_empty() {
        return None;
    }

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$p = $env:APP_ICON_PATH
if ([string]::IsNullOrWhiteSpace($p) -or -not (Test-Path -LiteralPath $p)) { return }
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($p)
if ($null -eq $icon) { return }
$bitmap = $icon.ToBitmap()
$memory = New-Object System.IO.MemoryStream
$bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
[Convert]::ToBase64String($memory.ToArray())
$memory.Dispose()
$bitmap.Dispose()
$icon.Dispose()
"#,
        ])
        .env("APP_ICON_PATH", clean_path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let base64 = String::from_utf8(output.stdout).ok()?;
    let icon = base64.trim();
    if icon.is_empty() {
        return None;
    }

    Some(format!("data:image/png;base64,{}", icon))
}

pub fn scan_start_menu() -> Vec<AppInfo> {
    let mut apps = Vec::new();
    let mut scanned_paths = HashSet::new();

    let mut roots = Vec::new();
    if let Ok(app_data) = std::env::var("APPDATA") {
        roots.push(PathBuf::from(app_data).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }
    if let Ok(program_data) = std::env::var("ProgramData") {
        roots.push(PathBuf::from(program_data).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }

    for root in roots {
        if !root.exists() {
            continue;
        }

        let dedup_key = root.to_string_lossy().to_lowercase();
        if scanned_paths.insert(dedup_key) {
            scan_shortcuts_recursive(&root, &mut apps);
        }
    }

    apps
}

fn scan_shortcuts_recursive(path: &PathBuf, apps: &mut Vec<AppInfo>) {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();

            if entry_path.extension().map(|e| e == "lnk").unwrap_or(false) {
                if let Some(target_path) = resolve_shortcut_target(&entry_path) {
                    if target_path.to_lowercase().ends_with(".exe") {
                        let name = entry_path
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();

                        if !name.is_empty() {
                            apps.push(AppInfo {
                                name,
                                path: target_path,
                                publisher: None,
                            });
                        }
                    }
                }
            } else if entry_path.is_dir() {
                scan_shortcuts_recursive(&entry_path, apps);
            }
        }
    }
}

fn resolve_shortcut_target(shortcut_path: &PathBuf) -> Option<String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            r#"
$ErrorActionPreference = 'Stop'
$p = $env:APP_SHORTCUT_PATH
if ([string]::IsNullOrWhiteSpace($p) -or -not (Test-Path -LiteralPath $p)) { return }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($p)
$target = $shortcut.TargetPath
if (-not [string]::IsNullOrWhiteSpace($target)) { $target }
"#,
        ])
        .env("APP_SHORTCUT_PATH", shortcut_path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    let target = stdout.trim();
    if target.is_empty() {
        return None;
    }

    Some(target.to_string())
}
