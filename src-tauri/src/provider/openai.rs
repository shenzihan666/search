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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderChatMessage {
    pub role: String,
    pub content: String,
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

fn parse_openai_like_text(body: &serde_json::Value) -> Option<String> {
    body.get("choices")
        .and_then(|v| v.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn parse_openai_delta_text(body: &serde_json::Value) -> Option<String> {
    let delta = body
        .get("choices")
        .and_then(|v| v.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("delta"))?;

    if let Some(content) = delta.get("content") {
        if let Some(text) = content.as_str() {
            if !text.is_empty() {
                return Some(text.to_string());
            }
        }

        if let Some(parts) = content.as_array() {
            let text = parts
                .iter()
                .filter_map(|part| part.get("text").and_then(|v| v.as_str()))
                .collect::<String>();
            if !text.is_empty() {
                return Some(text);
            }
        }
    }

    None
}

fn parse_responses_text(body: &serde_json::Value) -> Option<String> {
    if let Some(output_text) = body.get("output_text").and_then(|v| v.as_str()) {
        let trimmed = output_text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    body.get("output")
        .and_then(|v| v.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("content"))
        .and_then(|content| content.as_array())
        .and_then(|parts| parts.first())
        .and_then(|part| part.get("text"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn parse_stream_delta(provider_type: ProviderType, body: &serde_json::Value) -> Option<String> {
    match provider_type {
        ProviderType::OpenAI | ProviderType::Glm | ProviderType::Custom => {
            parse_openai_delta_text(body)
        }
        ProviderType::Volcengine => {
            if body.get("type").and_then(|v| v.as_str()) == Some("response.output_text.delta") {
                if let Some(delta) = body.get("delta").and_then(|v| v.as_str()) {
                    if !delta.is_empty() {
                        return Some(delta.to_string());
                    }
                }
                if let Some(delta) = body
                    .get("delta")
                    .and_then(|v| v.get("text"))
                    .and_then(|v| v.as_str())
                {
                    if !delta.is_empty() {
                        return Some(delta.to_string());
                    }
                }
            }
            parse_openai_delta_text(body).or_else(|| {
                body.get("delta")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(str::to_string)
            })
        }
        ProviderType::Anthropic => body
            .get("delta")
            .and_then(|delta| delta.get("text"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string),
        ProviderType::Google => parse_google_text(body),
    }
}

fn parse_anthropic_text(body: &serde_json::Value) -> Option<String> {
    body.get("content")
        .and_then(|v| v.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("text"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn parse_google_text(body: &serde_json::Value) -> Option<String> {
    body.get("candidates")
        .and_then(|v| v.as_array())
        .and_then(|items| items.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.as_array())
        .and_then(|parts| parts.first())
        .and_then(|part| part.get("text"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn parse_provider_text(provider_type: ProviderType, body: &serde_json::Value) -> Option<String> {
    match provider_type {
        ProviderType::OpenAI | ProviderType::Glm | ProviderType::Custom => {
            parse_openai_like_text(body)
        }
        ProviderType::Anthropic => parse_anthropic_text(body),
        ProviderType::Google => parse_google_text(body),
        ProviderType::Volcengine => parse_responses_text(body),
    }
}

fn role_for_google(role: &str) -> &'static str {
    match role {
        "assistant" => "model",
        _ => "user",
    }
}

fn normalize_messages(
    history: Option<Vec<ProviderChatMessage>>,
    prompt: &str,
) -> Result<Vec<ProviderChatMessage>, String> {
    let mut messages = history
        .unwrap_or_default()
        .into_iter()
        .filter_map(|m| {
            let role = m.role.trim().to_lowercase();
            let content = m.content.trim().to_string();
            if content.is_empty() {
                return None;
            }
            if role != "user" && role != "assistant" && role != "system" {
                return None;
            }
            Some(ProviderChatMessage { role, content })
        })
        .collect::<Vec<_>>();

    let has_user_msg = messages.iter().any(|m| m.role == "user");
    if !has_user_msg {
        let normalized_prompt = prompt.trim();
        if normalized_prompt.is_empty() {
            return Err("Prompt is empty.".to_string());
        }
        messages.push(ProviderChatMessage {
            role: "user".to_string(),
            content: normalized_prompt.to_string(),
        });
    }

    Ok(messages)
}

fn take_sse_frames(buffer: &mut String) -> Vec<String> {
    let mut frames = Vec::new();

    loop {
        let Some(delim_idx) = buffer.find("\n\n") else {
            break;
        };

        let block = buffer[..delim_idx].to_string();
        buffer.drain(..delim_idx + 2);

        let mut data_lines = Vec::new();
        for line in block.lines() {
            let line = line.trim_end();
            if let Some(rest) = line.strip_prefix("data:") {
                data_lines.push(rest.trim_start().to_string());
            }
        }

        if !data_lines.is_empty() {
            frames.push(data_lines.join("\n"));
        }
    }

    frames
}

fn take_ndjson_lines(buffer: &mut String) -> Vec<String> {
    let mut frames = Vec::new();

    loop {
        let Some(newline_idx) = buffer.find('\n') else {
            break;
        };

        let line = buffer[..newline_idx].trim().to_string();
        buffer.drain(..newline_idx + 1);

        if line.is_empty() {
            continue;
        }
        if line == "[DONE]" {
            frames.push(line);
            continue;
        }
        if line.starts_with("data:") {
            continue;
        }
        if line.starts_with('{') || line.starts_with('[') {
            frames.push(line);
        }
    }

    frames
}

async fn stream_sse_response(
    app: &AppHandle,
    event_name: &str,
    provider_type: ProviderType,
    mut response: reqwest::Response,
) -> Result<usize, String> {
    let mut emitted_chars = 0usize;
    let mut buffer = String::new();

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Failed reading SSE stream: {e}"))?
    {
        let chunk_text = String::from_utf8_lossy(&chunk);
        let normalized = chunk_text.replace("\r\n", "\n").replace('\r', "\n");
        buffer.push_str(&normalized);

        for payload in take_sse_frames(&mut buffer) {
            if payload.trim() == "[DONE]" {
                return Ok(emitted_chars);
            }

            let parsed: serde_json::Value = match serde_json::from_str(payload.trim()) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(delta) = parse_stream_delta(provider_type, &parsed) {
                emitted_chars += delta.chars().count();
                app.emit(event_name, delta)
                    .map_err(|e| format!("Failed to emit stream chunk: {e}"))?;
            }
        }

        // Some providers stream as line-delimited JSON (no `data:` prefix).
        if !buffer.contains("data:") {
            for payload in take_ndjson_lines(&mut buffer) {
                if payload.trim() == "[DONE]" {
                    return Ok(emitted_chars);
                }

                let parsed: serde_json::Value = match serde_json::from_str(payload.trim()) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                if let Some(delta) = parse_stream_delta(provider_type, &parsed) {
                    emitted_chars += delta.chars().count();
                    app.emit(event_name, delta)
                        .map_err(|e| format!("Failed to emit stream chunk: {e}"))?;
                }
            }
        }
    }

    // If nothing was streamed, try parsing the full buffered payload once.
    if emitted_chars == 0 {
        let tail = buffer.trim();
        if !tail.is_empty() && tail != "[DONE]" {
            if let Ok(body) = serde_json::from_str::<serde_json::Value>(tail) {
                if let Some(text) = parse_provider_text(provider_type, &body) {
                    emitted_chars = text.chars().count();
                    app.emit(event_name, text)
                        .map_err(|e| format!("Failed to emit stream chunk: {e}"))?;
                }
            }
        }
    }

    Ok(emitted_chars)
}

async fn stream_provider_and_emit(
    app: &AppHandle,
    event_name: &str,
    provider: &Provider,
    api_key: &str,
    messages: &[ProviderChatMessage],
) -> Result<usize, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty.".to_string());
    }
    if messages.is_empty() {
        return Err("Messages are empty.".to_string());
    }

    let base_url = resolve_base_url(provider)
        .ok_or_else(|| "Base URL is empty. Configure provider base URL.".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = match provider.provider_type {
        ProviderType::OpenAI | ProviderType::Glm | ProviderType::Custom => {
            let url = format!("{base_url}/chat/completions");
            client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&serde_json::json!({
                    "model": provider.model,
                    "messages": messages,
                    "temperature": 0.7,
                    "stream": true
                }))
                .send()
                .await
        }
        ProviderType::Volcengine => {
            let url = format!("{base_url}/responses");
            client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&serde_json::json!({
                    "model": provider.model,
                    "input": messages,
                    "stream": true
                }))
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
                    "max_tokens": 4096,
                    "messages": messages,
                    "stream": true
                }))
                .send()
                .await
        }
        ProviderType::Google => {
            let url = format!("{base_url}/models/{}:streamGenerateContent", provider.model);
            let contents = messages
                .iter()
                .map(|msg| {
                    serde_json::json!({
                        "role": role_for_google(&msg.role),
                        "parts": [{ "text": msg.content }]
                    })
                })
                .collect::<Vec<_>>();
            client
                .post(url)
                .query(&[("key", api_key.trim()), ("alt", "sse")])
                .json(&serde_json::json!({
                    "contents": contents,
                    "generationConfig": { "maxOutputTokens": 4096 }
                }))
                .send()
                .await
        }
    }
    .map_err(|e| format!("Network error: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let detail = response_excerpt(response).await;
        return Err(classify_http_failure(status, &provider.model, &detail));
    }

    stream_sse_response(app, event_name, provider.provider_type, response).await
}

async fn call_provider_and_get_text(
    provider: &Provider,
    api_key: &str,
    messages: &[ProviderChatMessage],
) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty.".to_string());
    }
    if messages.is_empty() {
        return Err("Messages are empty.".to_string());
    }

    let base_url = resolve_base_url(provider)
        .ok_or_else(|| "Base URL is empty. Configure provider base URL.".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(40))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = match provider.provider_type {
        ProviderType::OpenAI | ProviderType::Glm | ProviderType::Custom => {
            let url = format!("{base_url}/chat/completions");
            client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&serde_json::json!({
                    "model": provider.model,
                    "messages": messages,
                    "temperature": 0.7
                }))
                .send()
                .await
        }
        ProviderType::Volcengine => {
            let url = format!("{base_url}/responses");
            client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&serde_json::json!({
                    "model": provider.model,
                    "input": messages,
                    "max_output_tokens": 4096
                }))
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
                    "max_tokens": 4096,
                    "messages": messages
                }))
                .send()
                .await
        }
        ProviderType::Google => {
            let url = format!("{base_url}/models/{}:generateContent", provider.model);
            let contents = messages
                .iter()
                .map(|msg| {
                    serde_json::json!({
                        "role": role_for_google(&msg.role),
                        "parts": [{ "text": msg.content }]
                    })
                })
                .collect::<Vec<_>>();
            client
                .post(url)
                .query(&[("key", api_key.trim())])
                .json(&serde_json::json!({
                    "contents": contents,
                    "generationConfig": { "maxOutputTokens": 4096 }
                }))
                .send()
                .await
        }
    }
    .map_err(|e| format!("Network error: {e}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse provider response: {e}"))?;

    if !status.is_success() {
        let detail = body.to_string();
        let detail_excerpt: String = detail.chars().take(220).collect();
        return Err(classify_http_failure(
            status,
            &provider.model,
            &detail_excerpt,
        ));
    }

    let parsed = parse_provider_text(provider.provider_type, &body);

    parsed.ok_or_else(|| {
        let excerpt: String = body.to_string().chars().take(220).collect();
        format!("Provider returned no readable text. Response excerpt: {excerpt}")
    })
}

fn placeholder_response(provider: &Provider, prompt: &str, api_key: &str) -> String {
    format!(
        "You asked: '{}'\n\nUsing provider: {} (model: {})\nAPI key configured: {}\n\nThis is a placeholder response. Configure your API key in settings to get real AI responses.",
        prompt,
        provider.name,
        provider.model,
        if api_key.is_empty() { "No" } else { "Yes" }
    )
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
        ProviderType::Glm => {
            let url = format!("{base_url}/chat/completions");
            client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&serde_json::json!({
                    "model": provider.model,
                    "messages": [{ "role": "user", "content": "ping" }],
                    "max_tokens": 8
                }))
                .send()
                .await
        }
        ProviderType::Volcengine => {
            let url = format!("{base_url}/responses");
            client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&serde_json::json!({
                    "model": provider.model,
                    "input": [{ "role": "user", "content": "ping" }],
                    "max_output_tokens": 1
                }))
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
    let messages = normalize_messages(None, &prompt)?;

    // Get the active provider with its API key
    let active_provider =
        tauri::async_runtime::spawn_blocking(ProvidersRepository::get_active_with_key)
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;

    match active_provider {
        Some((provider, api_key)) => {
            let streamed =
                stream_provider_and_emit(&app, "query:chunk", &provider, &api_key, &messages)
                    .await
                    .unwrap_or(0);

            if streamed > 0 {
                return Ok(());
            }

            let response = match call_provider_and_get_text(&provider, &api_key, &messages).await {
                Ok(text) => text,
                Err(err) => {
                    eprintln!("query_stream provider call failed: {err}");
                    placeholder_response(&provider, &prompt, &api_key)
                }
            };

            app.emit("query:chunk", response)
                .map_err(|e| e.to_string())?;

            Ok(())
        }
        None => {
            // No active provider or no API key
            let response =
                "No active provider configured. Please configure a provider in Settings.";

            app.emit("query:chunk", response.to_string())
                .map_err(|e| e.to_string())?;

            Ok(())
        }
    }
}

#[tauri::command]
pub async fn query_provider_once(
    provider_id: String,
    prompt: String,
    history: Option<Vec<ProviderChatMessage>>,
) -> Result<String, String> {
    let provider_data = tauri::async_runtime::spawn_blocking(move || {
        let provider = ProvidersRepository::get(&provider_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Provider not found".to_string())?;
        let api_key = ProvidersRepository::get_api_key(&provider.id).map_err(|e| e.to_string())?;
        Ok::<(Provider, String), String>((provider, api_key))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let (provider, api_key) = provider_data;
    let messages = normalize_messages(history, &prompt)?;
    call_provider_and_get_text(&provider, &api_key, &messages).await
}

#[tauri::command]
pub async fn query_stream_provider(
    provider_id: String,
    prompt: String,
    history: Option<Vec<ProviderChatMessage>>,
    app: AppHandle,
) -> Result<(), String> {
    // Get the specific provider with its API key
    let provider_data = tauri::async_runtime::spawn_blocking(move || {
        let provider = ProvidersRepository::get(&provider_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Provider not found".to_string())?;
        let api_key = ProvidersRepository::get_api_key(&provider.id).map_err(|e| e.to_string())?;
        Ok::<(Provider, String), String>((provider, api_key))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let (provider, api_key) = provider_data;

    // Emit chunks with provider-specific event name
    let event_name = format!("query:chunk:{}", provider.id);
    let messages = normalize_messages(history, &prompt)?;
    let streamed = stream_provider_and_emit(&app, &event_name, &provider, &api_key, &messages)
        .await
        .unwrap_or(0);
    if streamed > 0 {
        return Ok(());
    }

    let response = call_provider_and_get_text(&provider, &api_key, &messages).await?;
    app.emit(&event_name, response).map_err(|e| e.to_string())?;

    Ok(())
}
