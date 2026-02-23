use crate::db::ProvidersRepository;
use crate::provider::{Provider, ProviderType};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Legacy provider config (kept for backwards compatibility with settings)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: Option<String>,
    pub model: String,
    pub provider_type: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub status_code: Option<u16>,
    pub latency_ms: u64,
}

impl ConnectionTestResult {
    fn success(status_code: Option<u16>, latency_ms: u64, message: String) -> Self {
        Self {
            success: true,
            message,
            status_code,
            latency_ms,
        }
    }

    fn failure(status_code: Option<u16>, latency_ms: u64, message: String) -> Self {
        Self {
            success: false,
            message,
            status_code,
            latency_ms,
        }
    }
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

fn resolve_base_url(provider: &Provider) -> Option<String> {
    provider
        .base_url
        .clone()
        .or_else(|| {
            provider
                .provider_type
                .default_base_url()
                .map(str::to_string)
        })
        .map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
}

fn elapsed_ms(started_at: Instant) -> u64 {
    started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64
}

async fn response_excerpt(resp: reqwest::Response) -> String {
    match resp.text().await {
        Ok(text) => {
            let compact = text.replace('\n', " ").replace('\r', " ");
            compact.chars().take(220).collect::<String>()
        }
        Err(_) => String::new(),
    }
}

fn classify_http_failure(status: StatusCode, model: &str, details: &str) -> String {
    let prefix = match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            "Authentication failed. Check API key and permissions."
        }
        StatusCode::NOT_FOUND => "Model or endpoint not found. Check model/base URL.",
        StatusCode::TOO_MANY_REQUESTS => "Rate limited by provider.",
        s if s.is_server_error() => "Provider server error.",
        _ => "Connection test failed.",
    };

    if details.is_empty() {
        format!("{prefix} (model: {model}, status: {})", status.as_u16())
    } else {
        format!(
            "{prefix} (model: {model}, status: {}, detail: {details})",
            status.as_u16()
        )
    }
}

pub async fn test_provider_connection(id: String) -> Result<ConnectionTestResult, String> {
    let (provider, api_key) = tauri::async_runtime::spawn_blocking(move || {
        let provider = ProvidersRepository::get(&id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Provider not found".to_string())?;
        let api_key = ProvidersRepository::get_api_key(&provider.id).map_err(|e| e.to_string())?;
        Ok::<(Provider, String), String>((provider, api_key))
    })
    .await
    .map_err(|e| e.to_string())??;

    if api_key.trim().is_empty() {
        return Ok(ConnectionTestResult::failure(
            None,
            0,
            "API key is empty. Save API key before testing.".to_string(),
        ));
    }

    let Some(base_url) = resolve_base_url(&provider) else {
        return Ok(ConnectionTestResult::failure(
            None,
            0,
            "Base URL is empty. Set a valid base URL before testing.".to_string(),
        ));
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let started_at = Instant::now();
    let request_result = match provider.provider_type {
        ProviderType::OpenAI | ProviderType::Custom => {
            let url = format!("{base_url}/models/{}", provider.model);
            client
                .get(url)
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .send()
                .await
        }
        ProviderType::Anthropic => {
            let url = format!("{base_url}/messages");
            client
                .post(url)
                .header("x-api-key", api_key.trim())
                .header("anthropic-version", "2023-06-01")
                .json(&serde_json::json!({
                    "model": provider.model,
                    "max_tokens": 1,
                    "messages": [{ "role": "user", "content": "ping" }]
                }))
                .send()
                .await
        }
        ProviderType::Google => {
            let url = format!("{base_url}/models/{}:generateContent", provider.model);
            client
                .post(url)
                .query(&[("key", api_key.trim())])
                .json(&serde_json::json!({
                    "contents": [{ "parts": [{ "text": "ping" }] }],
                    "generationConfig": { "maxOutputTokens": 1 }
                }))
                .send()
                .await
        }
    };

    match request_result {
        Ok(resp) => {
            let latency = elapsed_ms(started_at);
            let status = resp.status();
            if status.is_success() {
                Ok(ConnectionTestResult::success(
                    Some(status.as_u16()),
                    latency,
                    format!("Connection successful (model: {}).", provider.model),
                ))
            } else {
                let detail = response_excerpt(resp).await;
                Ok(ConnectionTestResult::failure(
                    Some(status.as_u16()),
                    latency,
                    classify_http_failure(status, &provider.model, &detail),
                ))
            }
        }
        Err(err) => Ok(ConnectionTestResult::failure(
            None,
            elapsed_ms(started_at),
            format!("Network error: {err}"),
        )),
    }
}

#[tauri::command]
pub async fn query_stream(prompt: String, app: AppHandle) -> Result<(), String> {
    // Get the active provider with its API key
    let active_provider =
        tauri::async_runtime::spawn_blocking(ProvidersRepository::get_active_with_key)
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;

    match active_provider {
        Some((provider, api_key)) => {
            // TODO: Implement actual streaming with async-openai
            // For now, simulate streaming with provider info
            let response = format!(
                "You asked: '{}'\n\nUsing provider: {} (model: {})\nAPI key configured: {}\n\nThis is a placeholder response. Configure your API key in settings to get real AI responses.",
                prompt,
                provider.name,
                provider.model,
                if api_key.is_empty() { "No" } else { "Yes" }
            );

            for chunk in response.chars() {
                app.emit("query:chunk", chunk.to_string())
                    .map_err(|e| e.to_string())?;
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }

            Ok(())
        }
        None => {
            // No active provider or no API key
            let response =
                "No active provider configured. Please configure a provider in Settings.";

            for chunk in response.chars() {
                app.emit("query:chunk", chunk.to_string())
                    .map_err(|e| e.to_string())?;
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }

            Ok(())
        }
    }
}
