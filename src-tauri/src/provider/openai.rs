use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: Option<String>,
    pub model: String,
    pub provider_type: String,
    pub base_url: Option<String>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            model: "gpt-4o-mini".to_string(),
            provider_type: "openai".to_string(),
            base_url: None,
        }
    }
}

#[tauri::command]
pub async fn query_stream(prompt: String, app: AppHandle) -> Result<(), String> {
    // Placeholder implementation
    // In production, this would use async-openai to stream responses

    // Simulate streaming response
    let response = format!("You asked: '{}'\n\nThis is a placeholder response. Configure your API key in settings to get real AI responses.", prompt);

    for chunk in response.chars() {
        app.emit("query:chunk", chunk.to_string())
            .map_err(|e| e.to_string())?;
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }

    Ok(())
}
