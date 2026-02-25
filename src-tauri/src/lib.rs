use serde::Serialize;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

mod apps;
mod db;
mod provider;
use apps::{
    get_app_icon, get_suggestions, initialize_cache, launch_app, refresh_app_cache, search_apps,
};
use db::{
    ChatMessageRecord, ChatMessagesRepository, ChatSessionColumnRecord,
    ChatSessionColumnsRepository, ChatSessionRecord, ChatSessionsRepository, MessageSearchResult,
    ProvidersRepository, SettingsRepository,
};
use provider::{
    query_provider_once, query_stream, query_stream_provider,
    test_provider_connection as run_provider_connection_test, ConnectionTestResult,
    CreateProviderRequest, Provider, ProviderView, UpdateProviderRequest,
};

const SETTING_LAUNCH_ON_STARTUP: &str = "launch_on_startup";
const SETTING_HIDE_ON_BLUR: &str = "hide_on_blur";
const SETTING_HOTKEY_TOGGLE_SEARCH: &str = "hotkey_toggle_search";
const SETTING_HOTKEY_OPEN_SETTINGS: &str = "hotkey_open_settings";
const SETTING_THEME: &str = "theme";
const SETTING_DEFAULT_SYSTEM_PROMPT: &str = "default_system_prompt";
const AUTOSTART_RUN_KEY: &str = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run";
const AUTOSTART_VALUE_NAME: &str = "AIQuickSearch";
const DEFAULT_HOTKEY_TOGGLE_SEARCH: &str = "Alt + Space";
const DEFAULT_HOTKEY_OPEN_SETTINGS: &str = "Ctrl + ,";
const DEFAULT_THEME: &str = "system";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppSettingsPayload {
    launch_on_startup: bool,
    hide_on_blur: bool,
    hotkey_toggle_search: String,
    hotkey_open_settings: String,
    theme: String,
    default_system_prompt: String,
}

#[derive(Debug, Clone, Serialize)]
struct SettingUpdatedPayload {
    key: String,
    value: String,
}

#[derive(Debug)]
struct HotkeyState {
    toggle_search: Mutex<String>,
    open_settings: Mutex<String>,
}

impl HotkeyState {
    fn new(toggle_search: String, open_settings: String) -> Self {
        Self {
            toggle_search: Mutex::new(toggle_search),
            open_settings: Mutex::new(open_settings),
        }
    }

    fn current_toggle_search(&self) -> Option<String> {
        self.toggle_search.lock().ok().map(|v| v.clone())
    }

    fn current_open_settings(&self) -> Option<String> {
        self.open_settings.lock().ok().map(|v| v.clone())
    }

    fn set_toggle_search(&self, shortcut: String) {
        if let Ok(mut guard) = self.toggle_search.lock() {
            *guard = shortcut;
        }
    }

    fn set_open_settings(&self, shortcut: String) {
        if let Ok(mut guard) = self.open_settings.lock() {
            *guard = shortcut;
        }
    }
}

fn parse_bool_setting(raw: Option<String>, default: bool) -> bool {
    match raw.as_deref().map(|v| v.trim().to_ascii_lowercase()) {
        Some(v) if matches!(v.as_str(), "1" | "true" | "yes" | "on") => true,
        Some(v) if matches!(v.as_str(), "0" | "false" | "no" | "off") => false,
        _ => default,
    }
}

fn bool_to_setting(value: bool) -> &'static str {
    if value {
        "1"
    } else {
        "0"
    }
}

fn is_launch_on_startup_enabled() -> Result<bool, String> {
    let run_key = windows_registry::CURRENT_USER
        .create(AUTOSTART_RUN_KEY)
        .map_err(|e| e.to_string())?;

    Ok(run_key
        .get_string(AUTOSTART_VALUE_NAME)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false))
}

fn set_launch_on_startup_enabled(enabled: bool) -> Result<(), String> {
    let run_key = windows_registry::CURRENT_USER
        .create(AUTOSTART_RUN_KEY)
        .map_err(|e| e.to_string())?;

    if enabled {
        let exe_path = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('"', "");
        let command = format!("\"{exe_path}\" --autostart --hidden");
        run_key
            .set_string(AUTOSTART_VALUE_NAME, command)
            .map_err(|e| e.to_string())?;
    } else if run_key.get_string(AUTOSTART_VALUE_NAME).is_ok() {
        run_key
            .remove_value(AUTOSTART_VALUE_NAME)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn normalize_hotkey_setting(raw: Option<String>, fallback: &str) -> String {
    let value = raw.unwrap_or_default().trim().replace('，', ",");
    if value.is_empty() {
        fallback.to_string()
    } else {
        value
    }
}

fn position_main_window(window: &tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let scale = monitor.scale_factor().max(1.0);
        let size = monitor.size();
        let window_size = window
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(900, 600));

        let monitor_width = size.width as f64 / scale;
        let monitor_height = size.height as f64 / scale;
        let window_width = window_size.width as f64 / scale;
        let x = ((monitor_width - window_width) / 2.0).floor();
        let y = (monitor_height * 0.2).floor();

        let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(
            x, y,
        )));
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        position_main_window(&window);
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("launcher:opened", ());
    }
}

fn show_settings_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn register_toggle_search_shortcut(app: &tauri::AppHandle, shortcut: &str) -> Result<(), String> {
    let app_handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state != ShortcutState::Released {
                return;
            }
            if let Some(window) = app_handle.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    show_main_window(&app_handle);
                }
            }
        })
        .map_err(|e| e.to_string())
}

fn register_open_settings_shortcut(app: &tauri::AppHandle, shortcut: &str) -> Result<(), String> {
    let app_handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state != ShortcutState::Released {
                return;
            }
            show_settings_window(&app_handle);
        })
        .map_err(|e| e.to_string())
}

fn register_hotkey_or_log(
    app: &tauri::AppHandle,
    shortcut: &str,
    register: fn(&tauri::AppHandle, &str) -> Result<(), String>,
) -> Result<(), String> {
    if let Err(err) = register(app, shortcut) {
        if err.contains("HotKey already registered") {
            eprintln!(
                "Global shortcut '{}' is already in use. Continuing without it.",
                shortcut
            );
            Ok(())
        } else {
            Err(err)
        }
    } else {
        Ok(())
    }
}

fn load_hotkeys_from_settings() -> Result<(String, String), String> {
    let toggle = normalize_hotkey_setting(
        SettingsRepository::get(SETTING_HOTKEY_TOGGLE_SEARCH).map_err(|e| e.to_string())?,
        DEFAULT_HOTKEY_TOGGLE_SEARCH,
    );
    let open_settings = normalize_hotkey_setting(
        SettingsRepository::get(SETTING_HOTKEY_OPEN_SETTINGS).map_err(|e| e.to_string())?,
        DEFAULT_HOTKEY_OPEN_SETTINGS,
    );
    Ok((toggle, open_settings))
}

fn apply_hotkey_change(
    app: &tauri::AppHandle,
    state: &HotkeyState,
    key: &str,
    raw_value: &str,
) -> Result<String, String> {
    let (current, fallback, register, set_state): (
        Option<String>,
        &str,
        fn(&tauri::AppHandle, &str) -> Result<(), String>,
        fn(&HotkeyState, String),
    ) = match key {
        SETTING_HOTKEY_TOGGLE_SEARCH => (
            state.current_toggle_search(),
            DEFAULT_HOTKEY_TOGGLE_SEARCH,
            register_toggle_search_shortcut,
            HotkeyState::set_toggle_search,
        ),
        SETTING_HOTKEY_OPEN_SETTINGS => (
            state.current_open_settings(),
            DEFAULT_HOTKEY_OPEN_SETTINGS,
            register_open_settings_shortcut,
            HotkeyState::set_open_settings,
        ),
        _ => return Err(format!("unsupported hotkey setting key: {key}")),
    };

    let normalized = normalize_hotkey_setting(Some(raw_value.to_string()), fallback);
    let old = current.unwrap_or_else(|| fallback.to_string());
    if old == normalized {
        return Ok(normalized);
    }

    if app.global_shortcut().is_registered(old.as_str()) {
        let _ = app.global_shortcut().unregister(old.as_str());
    }

    if let Err(err) = register(app, normalized.as_str()) {
        if !app.global_shortcut().is_registered(old.as_str()) {
            let _ = register(app, old.as_str());
        }
        return Err(err);
    }

    set_state(state, normalized.clone());
    Ok(normalized)
}

fn ensure_default_app_settings() -> Result<(), String> {
    SettingsRepository::set_if_absent(SETTING_HIDE_ON_BLUR, bool_to_setting(true))
        .map_err(|e| e.to_string())?;
    SettingsRepository::set_if_absent(SETTING_HOTKEY_TOGGLE_SEARCH, DEFAULT_HOTKEY_TOGGLE_SEARCH)
        .map_err(|e| e.to_string())?;
    SettingsRepository::set_if_absent(SETTING_HOTKEY_OPEN_SETTINGS, DEFAULT_HOTKEY_OPEN_SETTINGS)
        .map_err(|e| e.to_string())?;
    SettingsRepository::set_if_absent(SETTING_THEME, DEFAULT_THEME).map_err(|e| e.to_string())?;
    SettingsRepository::set_if_absent(SETTING_DEFAULT_SYSTEM_PROMPT, "")
        .map_err(|e| e.to_string())?;

    let launch_setting =
        SettingsRepository::get(SETTING_LAUNCH_ON_STARTUP).map_err(|e| e.to_string())?;
    match launch_setting {
        Some(raw) => {
            let enabled = parse_bool_setting(Some(raw), false);
            set_launch_on_startup_enabled(enabled)?;
            SettingsRepository::set(SETTING_LAUNCH_ON_STARTUP, bool_to_setting(enabled))
                .map_err(|e| e.to_string())?;
        }
        None => {
            let enabled = is_launch_on_startup_enabled()?;
            SettingsRepository::set(SETTING_LAUNCH_ON_STARTUP, bool_to_setting(enabled))
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_app_settings(_app: tauri::AppHandle) -> Result<AppSettingsPayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut launch_on_startup = parse_bool_setting(
            SettingsRepository::get(SETTING_LAUNCH_ON_STARTUP).map_err(|e| e.to_string())?,
            false,
        );

        if let Ok(registry_enabled) = is_launch_on_startup_enabled() {
            launch_on_startup = registry_enabled;
            let _ = SettingsRepository::set(
                SETTING_LAUNCH_ON_STARTUP,
                bool_to_setting(registry_enabled),
            );
        }

        let hide_on_blur = parse_bool_setting(
            SettingsRepository::get(SETTING_HIDE_ON_BLUR).map_err(|e| e.to_string())?,
            true,
        );
        let hotkey_toggle_search = SettingsRepository::get(SETTING_HOTKEY_TOGGLE_SEARCH)
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| DEFAULT_HOTKEY_TOGGLE_SEARCH.to_string());
        let hotkey_open_settings = SettingsRepository::get(SETTING_HOTKEY_OPEN_SETTINGS)
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| DEFAULT_HOTKEY_OPEN_SETTINGS.to_string());
        let theme = SettingsRepository::get(SETTING_THEME)
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| DEFAULT_THEME.to_string());
        let default_system_prompt = SettingsRepository::get(SETTING_DEFAULT_SYSTEM_PROMPT)
            .map_err(|e| e.to_string())?
            .unwrap_or_default();

        Ok(AppSettingsPayload {
            launch_on_startup,
            hide_on_blur,
            hotkey_toggle_search,
            hotkey_open_settings,
            theme,
            default_system_prompt,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn set_app_setting(
    key: String,
    value: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let normalized_value = if key == SETTING_LAUNCH_ON_STARTUP {
        let enabled = parse_bool_setting(Some(value), false);
        set_launch_on_startup_enabled(enabled)?;
        let normalized = bool_to_setting(enabled).to_string();
        SettingsRepository::set(&key, &normalized).map_err(|e| e.to_string())?;
        normalized
    } else if key == SETTING_HOTKEY_TOGGLE_SEARCH || key == SETTING_HOTKEY_OPEN_SETTINGS {
        let state = app.state::<HotkeyState>();
        let normalized = apply_hotkey_change(&app, &state, &key, &value)?;
        SettingsRepository::set(&key, &normalized).map_err(|e| e.to_string())?;
        normalized
    } else if key == SETTING_DEFAULT_SYSTEM_PROMPT {
        let normalized = value.trim().to_string();
        SettingsRepository::set(&key, &normalized).map_err(|e| e.to_string())?;
        normalized
    } else {
        SettingsRepository::set(&key, &value).map_err(|e| e.to_string())?;
        value
    };

    app.emit(
        "app-settings-updated",
        SettingUpdatedPayload {
            key,
            value: normalized_value.clone(),
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(normalized_value)
}

// Legacy commands (kept for backwards compatibility)
#[tauri::command]
async fn set_config(
    config: provider::ProviderConfig,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || SettingsRepository::save_provider_config(&config))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_config(_app: tauri::AppHandle) -> Result<provider::ProviderConfig, String> {
    tauri::async_runtime::spawn_blocking(SettingsRepository::load_provider_config)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

// Provider CRUD commands
#[tauri::command]
async fn list_providers(_app: tauri::AppHandle) -> Result<Vec<ProviderView>, String> {
    tauri::async_runtime::spawn_blocking(ProvidersRepository::list)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_provider(
    req: CreateProviderRequest,
    _app: tauri::AppHandle,
) -> Result<Provider, String> {
    tauri::async_runtime::spawn_blocking(move || ProvidersRepository::create(req))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_provider(
    id: String,
    req: UpdateProviderRequest,
    _app: tauri::AppHandle,
) -> Result<Provider, String> {
    tauri::async_runtime::spawn_blocking(move || ProvidersRepository::update(&id, req))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_provider(id: String, _app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ProvidersRepository::delete(&id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_active_provider(
    id: String,
    is_active: bool,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ProvidersRepository::set_active(&id, is_active))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_provider_api_key(id: String, _app: tauri::AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || ProvidersRepository::get_api_key(&id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_provider_api_key(
    id: String,
    api_key: String,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ProvidersRepository::set_api_key(&id, &api_key))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_provider_connection(
    id: String,
    _app: tauri::AppHandle,
) -> Result<ConnectionTestResult, String> {
    run_provider_connection_test(id).await
}

// Chat session persistence commands
#[tauri::command]
async fn list_chat_sessions(_app: tauri::AppHandle) -> Result<Vec<ChatSessionRecord>, String> {
    tauri::async_runtime::spawn_blocking(ChatSessionsRepository::list)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_chat_session(
    id: String,
    title: String,
    provider_ids: Vec<String>,
    _app: tauri::AppHandle,
) -> Result<ChatSessionRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatSessionsRepository::create(&id, &title, &provider_ids)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_chat_session_columns(
    session_id: String,
    _app: tauri::AppHandle,
) -> Result<Vec<ChatSessionColumnRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatSessionColumnsRepository::list_by_session(&session_id)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_chat_session_column_provider(
    column_id: String,
    provider_id: String,
    _app: tauri::AppHandle,
) -> Result<ChatSessionColumnRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatSessionColumnsRepository::set_provider(&column_id, &provider_id)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_chat_session(
    id: String,
    title: String,
    _app: tauri::AppHandle,
) -> Result<ChatSessionRecord, String> {
    tauri::async_runtime::spawn_blocking(move || ChatSessionsRepository::rename(&id, &title))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_chat_session_state(
    id: String,
    provider_ids: Vec<String>,
    prompt: String,
    _app: tauri::AppHandle,
) -> Result<ChatSessionRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatSessionsRepository::save_state(&id, &provider_ids, &prompt)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_session_system_prompt(
    id: String,
    system_prompt: String,
    _app: tauri::AppHandle,
) -> Result<ChatSessionRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatSessionsRepository::set_system_prompt(&id, &system_prompt)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_chat_session(id: String, _app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ChatSessionsRepository::delete(&id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// P10: Pagination support. limit=0 returns all messages.
#[tauri::command]
async fn list_chat_messages(
    session_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
    _app: tauri::AppHandle,
) -> Result<Vec<ChatMessageRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatMessagesRepository::list_by_session(
            &session_id,
            limit.unwrap_or(0),
            offset.unwrap_or(0),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn count_chat_messages(session_id: String, _app: tauri::AppHandle) -> Result<i64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatMessagesRepository::count_by_session(&session_id)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_chat_message(
    id: String,
    session_id: String,
    column_id: String,
    provider_id: String,
    role: String,
    content: String,
    status: String,
    created_at: Option<i64>,
    updated_at: Option<i64>,
    _app: tauri::AppHandle,
) -> Result<ChatMessageRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatMessagesRepository::create(
            &id,
            &session_id,
            &column_id,
            &provider_id,
            &role,
            &content,
            &status,
            created_at,
            updated_at,
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_chat_message(
    id: String,
    content: String,
    status: String,
    _app: tauri::AppHandle,
) -> Result<ChatMessageRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatMessagesRepository::update_content(&id, &content, &status)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// P11: Delete a single message by id.
#[tauri::command]
async fn delete_chat_message(id: String, _app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ChatMessagesRepository::delete(&id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// P13: Full-text search across all messages.
#[tauri::command]
async fn search_chat_messages(
    query: String,
    limit: Option<i64>,
    _app: tauri::AppHandle,
) -> Result<Vec<MessageSearchResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatMessagesRepository::search(&query, limit.unwrap_or(20))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// P13: Export a session's messages as JSON-serialisable records.
#[tauri::command]
async fn export_session_messages(
    session_id: String,
    _app: tauri::AppHandle,
) -> Result<Vec<ChatMessageRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ChatMessagesRepository::export_session(&session_id)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Initialize database
            if let Err(err) = db::initialize(&app.handle()) {
                eprintln!(
                    "Database initialization failed, continuing with memory cache only: {err}"
                );
            }

            if let Err(err) = ensure_default_app_settings() {
                eprintln!("App settings initialization failed: {err}");
            }

            let (toggle_shortcut, open_settings_shortcut) = load_hotkeys_from_settings()?;
            app.manage(HotkeyState::new(
                toggle_shortcut.clone(),
                open_settings_shortcut.clone(),
            ));

            if let Err(err) = register_hotkey_or_log(
                &app.handle(),
                &toggle_shortcut,
                register_toggle_search_shortcut,
            ) {
                eprintln!("Failed to register '{}': {err}", toggle_shortcut);
                let fallback = DEFAULT_HOTKEY_TOGGLE_SEARCH.to_string();
                let _ = register_hotkey_or_log(
                    &app.handle(),
                    &fallback,
                    register_toggle_search_shortcut,
                );
                if let Some(state) = app.try_state::<HotkeyState>() {
                    state.set_toggle_search(fallback.clone());
                }
                let _ = SettingsRepository::set(SETTING_HOTKEY_TOGGLE_SEARCH, &fallback);
            }

            if let Err(err) = register_hotkey_or_log(
                &app.handle(),
                &open_settings_shortcut,
                register_open_settings_shortcut,
            ) {
                eprintln!("Failed to register '{}': {err}", open_settings_shortcut);
                let fallback = DEFAULT_HOTKEY_OPEN_SETTINGS.to_string();
                let _ = register_hotkey_or_log(
                    &app.handle(),
                    &fallback,
                    register_open_settings_shortcut,
                );
                if let Some(state) = app.try_state::<HotkeyState>() {
                    state.set_open_settings(fallback.clone());
                }
                let _ = SettingsRepository::set(SETTING_HOTKEY_OPEN_SETTINGS, &fallback);
            }

            // Setup system tray
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        show_main_window(app);
                    }
                    "settings" => {
                        show_settings_window(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        show_main_window(&app);
                    }
                })
                .build(app)?;

            // Setup window auto-hide on focus loss
            let window = app.get_webview_window("main").unwrap();

            // Position window at middle-top
            position_main_window(&window);

            // Initialize app cache in background
            tauri::async_runtime::spawn(async {
                initialize_cache().await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Legacy single-provider commands
            query_stream,
            query_provider_once,
            query_stream_provider,
            set_config,
            get_config,
            get_app_settings,
            set_app_setting,
            // Multi-provider CRUD commands
            list_providers,
            create_provider,
            update_provider,
            delete_provider,
            set_active_provider,
            get_provider_api_key,
            set_provider_api_key,
            test_provider_connection,
            // Chat session persistence commands
            list_chat_sessions,
            create_chat_session,
            list_chat_session_columns,
            rename_chat_session,
            save_chat_session_state,
            set_chat_session_column_provider,
            set_session_system_prompt,
            delete_chat_session,
            list_chat_messages,
            count_chat_messages,
            create_chat_message,
            update_chat_message,
            delete_chat_message,
            search_chat_messages,
            export_session_messages,
            // App commands
            search_apps,
            get_suggestions,
            launch_app,
            refresh_app_cache,
            get_app_icon
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
