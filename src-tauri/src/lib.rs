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
use db::SettingsRepository;
use provider::{query_stream, ProviderConfig};

#[tauri::command]
async fn set_config(config: ProviderConfig, _app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || SettingsRepository::save_provider_config(&config))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_config(_app: tauri::AppHandle) -> Result<ProviderConfig, String> {
    tauri::async_runtime::spawn_blocking(SettingsRepository::load_provider_config)
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
            query_stream,
            set_config,
            get_config,
            search_apps,
            get_suggestions,
            launch_app,
            refresh_app_cache,
            get_app_icon
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
