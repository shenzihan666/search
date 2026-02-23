use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

mod apps;
mod db;
mod provider;
use apps::{
    get_app_icon, get_suggestions, initialize_cache, launch_app, refresh_app_cache, search_apps,
};
use db::{ProvidersRepository, SettingsRepository};
use provider::{
    query_stream, test_provider_connection as run_provider_connection_test, ConnectionTestResult,
    CreateProviderRequest, Provider, ProviderView, UpdateProviderRequest,
};

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
async fn set_active_provider(id: String, _app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ProvidersRepository::set_active(&id))
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

            const TOGGLE_SHORTCUT: &str = "alt+space";

            // Handle shortcut events (this call also registers the shortcut).
            let app_handle = app.handle().clone();
            if let Err(err) =
                app.global_shortcut()
                    .on_shortcut(TOGGLE_SHORTCUT, move |_app, _shortcut, event| {
                        // Trigger on key release to avoid Windows Alt+Space system menu conflicts.
                        if event.state != ShortcutState::Released {
                            return;
                        }

                        if let Some(window) = app_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                // Re-center when showing
                                if let Ok(Some(monitor)) = window.current_monitor() {
                                    let size = monitor.size();
                                    let window_size = window
                                        .outer_size()
                                        .unwrap_or(tauri::PhysicalSize::new(900, 600));
                                    let x = (size.width as i32 - window_size.width as i32) / 2;
                                    let y = (size.height as f64 * 0.2) as i32;
                                    let _ = window.set_position(tauri::Position::Physical(
                                        tauri::PhysicalPosition::new(x, y),
                                    ));
                                }
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("launcher:opened", ());
                            }
                        }
                    })
            {
                if err.to_string().contains("HotKey already registered") {
                    eprintln!(
                        "Global shortcut '{}' is already in use. Continuing without it.",
                        TOGGLE_SHORTCUT
                    );
                } else {
                    return Err(err.into());
                }
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
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(Some(monitor)) = window.current_monitor() {
                                let size = monitor.size();
                                let window_size = window
                                    .outer_size()
                                    .unwrap_or(tauri::PhysicalSize::new(900, 600));
                                let x = (size.width as i32 - window_size.width as i32) / 2;
                                let y = (size.height as f64 * 0.2) as i32;
                                let _ = window.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition::new(x, y),
                                ));
                            }
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("launcher:opened", ());
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("settings") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
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
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(Some(monitor)) = window.current_monitor() {
                                let size = monitor.size();
                                let window_size = window
                                    .outer_size()
                                    .unwrap_or(tauri::PhysicalSize::new(900, 600));
                                let x = (size.width as i32 - window_size.width as i32) / 2;
                                let y = (size.height as f64 * 0.2) as i32;
                                let _ = window.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition::new(x, y),
                                ));
                            }
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("launcher:opened", ());
                        }
                    }
                })
                .build(app)?;

            // Setup window auto-hide on focus loss
            let window = app.get_webview_window("main").unwrap();

            // Position window at middle-top
            if let Ok(Some(monitor)) = window.current_monitor() {
                let size = monitor.size();
                let window_size = window
                    .outer_size()
                    .unwrap_or(tauri::PhysicalSize::new(900, 600));

                let x = (size.width as i32 - window_size.width as i32) / 2;
                let y = (size.height as f64 * 0.2) as i32; // 20% from top

                let _ = window.set_position(tauri::Position::Physical(
                    tauri::PhysicalPosition::new(x, y),
                ));
            }

            let window_for_events = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    // Auto-hide when losing focus
                    let _ = window_for_events.hide();
                }
            });

            // Initialize app cache in background
            tauri::async_runtime::spawn(async {
                initialize_cache().await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Legacy single-provider commands
            query_stream,
            set_config,
            get_config,
            // Multi-provider CRUD commands
            list_providers,
            create_provider,
            update_provider,
            delete_provider,
            set_active_provider,
            get_provider_api_key,
            set_provider_api_key,
            test_provider_connection,
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
