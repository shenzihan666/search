mod provider;

use provider::{OpenAIClient, ProviderConfig};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tokio::sync::RwLock;

// Tauri command to query OpenAI
#[tauri::command]
async fn query(
    prompt: String,
    client: tauri::State<'_, Arc<RwLock<OpenAIClient>>>,
) -> Result<String, String> {
    let client = client.read().await;
    client.query(prompt).await
}

// Tauri command to query with streaming
#[tauri::command]
async fn query_stream(
    prompt: String,
    app: tauri::AppHandle,
    client: tauri::State<'_, Arc<RwLock<OpenAIClient>>>,
) -> Result<(), String> {
    let client = client.read().await;
    let app = app.clone();

    client
        .query_stream(prompt, move |chunk| {
            let _ = app.emit("query:chunk", chunk);
        })
        .await?;

    Ok(())
}

// Tauri command to set full config
#[tauri::command]
async fn set_config(
    config: ProviderConfig,
    client: tauri::State<'_, Arc<RwLock<OpenAIClient>>>,
) -> Result<(), String> {
    let client = client.read().await;
    client.set_config(config).await;
    Ok(())
}

// Tauri command to set API key (backward compatible)
#[tauri::command]
async fn set_api_key(
    api_key: String,
    model: Option<String>,
    client: tauri::State<'_, Arc<RwLock<OpenAIClient>>>,
) -> Result<(), String> {
    let client = client.read().await;
    let mut config = client.get_config().await;
    config.api_key = api_key;
    if let Some(m) = model {
        config.model = m;
    }
    client.set_config(config).await;
    Ok(())
}

// Tauri command to get current config
#[tauri::command]
async fn get_config(
    client: tauri::State<'_, Arc<RwLock<OpenAIClient>>>,
) -> Result<ProviderConfig, String> {
    let client = client.read().await;
    Ok(client.get_config().await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let openai_client = Arc::new(RwLock::new(OpenAIClient::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(openai_client)
        .invoke_handler(tauri::generate_handler![
            query,
            query_stream,
            set_config,
            set_api_key,
            get_config,
        ])
        .setup(|app| {
            // Setup logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Register global shortcut: Alt+Space to toggle window
            let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
            let app_handle = app.handle().clone();

            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }

                if let Some(window) = app_handle.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })?;

            // Setup system tray
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let app_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
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
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Handle window close event - hide instead of close (close to tray)
            let window = app.get_webview_window("main").unwrap();
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        // Hide the window instead of closing
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    WindowEvent::Focused(false) => {
                        // Hide window when it loses focus
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
