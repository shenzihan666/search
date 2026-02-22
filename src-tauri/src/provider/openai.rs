use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs,
    },
    Client,
};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProviderType {
    #[serde(rename = "openai")]
    OpenAI,
    #[serde(rename = "gemini")]
    Gemini,
}

impl Default for ProviderType {
    fn default() -> Self {
        Self::OpenAI
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub provider_type: ProviderType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "gpt-4o-mini".to_string(),
            provider_type: ProviderType::OpenAI,
            base_url: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct OpenAIClient {
    config: Arc<RwLock<ProviderConfig>>,
}

impl OpenAIClient {
    pub fn new() -> Self {
        Self {
            config: Arc::new(RwLock::new(ProviderConfig::default())),
        }
    }

    pub async fn set_config(&self, config: ProviderConfig) {
        let mut current = self.config.write().await;
        *current = config;
    }

    pub async fn get_config(&self) -> ProviderConfig {
        self.config.read().await.clone()
    }

    fn create_client(&self, config: &ProviderConfig) -> Client<OpenAIConfig> {
        let openai_config = match config.provider_type {
            ProviderType::Gemini => {
                // Gemini OpenAI-compatible API
                let base = config.base_url.as_deref()
                    .unwrap_or("https://generativelanguage.googleapis.com/v1beta/openai");
                OpenAIConfig::new()
                    .with_api_key(&config.api_key)
                    .with_api_base(base)
            }
            ProviderType::OpenAI => {
                if let Some(base_url) = &config.base_url {
                    OpenAIConfig::new()
                        .with_api_key(&config.api_key)
                        .with_api_base(base_url)
                } else {
                    OpenAIConfig::new().with_api_key(&config.api_key)
                }
            }
        };
        Client::with_config(openai_config)
    }

    pub async fn query(&self, prompt: String) -> Result<String, String> {
        let config = self.config.read().await;

        if config.api_key.is_empty() {
            return Err("API key not configured. Please set your API key in settings.".to_string());
        }

        let client = self.create_client(&config);

        let request = CreateChatCompletionRequestArgs::default()
            .model(&config.model)
            .max_tokens(4096u32)
            .messages([ChatCompletionRequestUserMessageArgs::default()
                .content(prompt)
                .build()
                .map_err(|e| e.to_string())?
                .into()])
            .build()
            .map_err(|e| e.to_string())?;

        let response = client
            .chat()
            .create(request)
            .await
            .map_err(|e| {
                let error_str = e.to_string();
                if error_str.contains("429") {
                    "Rate limit exceeded (429). Please wait a moment and try again.".to_string()
                } else if error_str.contains("401") {
                    "Invalid API key. Please check your API key in settings.".to_string()
                } else {
                    format!("API error: {}", error_str)
                }
            })?;

        let content = response
            .choices
            .first()
            .and_then(|choice| choice.message.content.clone())
            .unwrap_or_default();

        Ok(content)
    }

    pub async fn query_stream<F>(
        &self,
        prompt: String,
        mut on_chunk: F,
    ) -> Result<(), String>
    where
        F: FnMut(String) + Send,
    {
        let config = self.config.read().await;

        if config.api_key.is_empty() {
            return Err("API key not configured. Please set your API key in settings.".to_string());
        }

        let client = self.create_client(&config);

        let request = CreateChatCompletionRequestArgs::default()
            .model(&config.model)
            .max_tokens(4096u32)
            .messages([ChatCompletionRequestUserMessageArgs::default()
                .content(prompt)
                .build()
                .map_err(|e| e.to_string())?
                .into()])
            .build()
            .map_err(|e| e.to_string())?;

        let mut stream = client
            .chat()
            .create_stream(request)
            .await
            .map_err(|e| {
                // Provide more helpful error messages
                let error_str = e.to_string();
                if error_str.contains("429") {
                    "Rate limit exceeded (429). Please wait a moment and try again, or check your API quota.".to_string()
                } else if error_str.contains("401") {
                    "Invalid API key. Please check your API key in settings.".to_string()
                } else if error_str.contains("403") {
                    "Access forbidden. Please check your API key permissions.".to_string()
                } else {
                    format!("API error: {}", error_str)
                }
            })?;

        while let Some(result) = stream.next().await {
            match result {
                Ok(response) => {
                    for choice in response.choices.iter() {
                        if let Some(ref content) = choice.delta.content {
                            on_chunk(content.clone());
                        }
                    }
                }
                Err(e) => {
                    let error_str = e.to_string();
                    if error_str.contains("429") {
                        return Err("Rate limit exceeded during stream. Please wait and try again.".to_string());
                    }
                    return Err(format!("Stream error: {}", error_str));
                }
            }
        }

        Ok(())
    }
}

impl Default for OpenAIClient {
    fn default() -> Self {
        Self::new()
    }
}
