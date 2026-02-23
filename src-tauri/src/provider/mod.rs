mod openai;

pub use openai::{query_stream, test_provider_connection, ConnectionTestResult, ProviderConfig};

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// Supported provider types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Google,
    Custom,
}

impl ProviderType {
    /// Get default base URL for known provider types
    pub fn default_base_url(&self) -> Option<&'static str> {
        match self {
            ProviderType::OpenAI => Some("https://api.openai.com/v1"),
            ProviderType::Anthropic => Some("https://api.anthropic.com/v1"),
            ProviderType::Google => Some("https://generativelanguage.googleapis.com/v1beta"),
            ProviderType::Custom => None,
        }
    }

    /// Get default model for known provider types
    pub fn default_model(&self) -> &'static str {
        match self {
            ProviderType::OpenAI => "gpt-4o-mini",
            ProviderType::Anthropic => "claude-3-5-sonnet-latest",
            ProviderType::Google => "gemini-1.5-pro",
            ProviderType::Custom => "",
        }
    }
}

impl fmt::Display for ProviderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProviderType::OpenAI => write!(f, "openai"),
            ProviderType::Anthropic => write!(f, "anthropic"),
            ProviderType::Google => write!(f, "google"),
            ProviderType::Custom => write!(f, "custom"),
        }
    }
}

impl FromStr for ProviderType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "openai" => Ok(ProviderType::OpenAI),
            "anthropic" => Ok(ProviderType::Anthropic),
            "google" | "gemini" => Ok(ProviderType::Google),
            "custom" => Ok(ProviderType::Custom),
            _ => Ok(ProviderType::Custom), // Unknown types become Custom
        }
    }
}

/// Provider configuration stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub base_url: Option<String>,
    pub model: String,
    pub is_active: bool,
    pub display_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Provider view with API key status (for frontend display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderView {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub base_url: Option<String>,
    pub model: String,
    pub is_active: bool,
    pub display_order: i32,
    pub has_api_key: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Request to create a new provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProviderRequest {
    pub name: String,
    pub provider_type: ProviderType,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
}

/// Request to update an existing provider
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateProviderRequest {
    pub name: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_type_display() {
        assert_eq!(ProviderType::OpenAI.to_string(), "openai");
        assert_eq!(ProviderType::Anthropic.to_string(), "anthropic");
        assert_eq!(ProviderType::Google.to_string(), "google");
        assert_eq!(ProviderType::Custom.to_string(), "custom");
    }

    #[test]
    fn test_provider_type_from_str() {
        assert_eq!(
            ProviderType::from_str("openai").unwrap(),
            ProviderType::OpenAI
        );
        assert_eq!(
            ProviderType::from_str("ANTHROPIC").unwrap(),
            ProviderType::Anthropic
        );
        assert_eq!(
            ProviderType::from_str("gemini").unwrap(),
            ProviderType::Google
        );
        assert_eq!(
            ProviderType::from_str("unknown").unwrap(),
            ProviderType::Custom
        );
    }

    #[test]
    fn test_provider_type_defaults() {
        assert_eq!(
            ProviderType::OpenAI.default_base_url(),
            Some("https://api.openai.com/v1")
        );
        assert_eq!(ProviderType::Custom.default_base_url(), None);
        assert_eq!(ProviderType::OpenAI.default_model(), "gpt-4o-mini");
    }
}
