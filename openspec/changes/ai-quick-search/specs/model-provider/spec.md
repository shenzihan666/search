# Model Provider Specification

AI 模型提供商管理能力，支持配置、切换、增删不同的 AI 提供商。

## ADDED Requirements

### Requirement: 支持多种 AI 提供商

系统 SHALL 支持以下 AI 提供商类型：
- OpenAI (GPT-4, GPT-3.5, etc.)
- Anthropic (Claude series)
- Google (Gemini series)
- Ollama (本地模型)
- 自定义 OpenAI 兼容 API

#### Scenario: 添加 OpenAI 提供商
- **WHEN** 用户选择添加 OpenAI 提供商并输入 API Key
- **THEN** 系统验证 API Key 有效性后保存配置，并自动获取可用模型列表

#### Scenario: 添加 Ollama 本地模型
- **WHEN** 用户选择添加 Ollama 提供商并配置本地地址（如 http://localhost:11434）
- **THEN** 系统连接 Ollama 服务并获取可用本地模型列表

### Requirement: API Key 安全存储

系统 SHALL 使用系统密钥库安全存储 API Key，不在配置文件中明文保存。

#### Scenario: Windows 存储 API Key
- **WHEN** 用户在 Windows 上保存 API Key
- **THEN** 系统使用 DPAPI 加密存储 API Key

#### Scenario: macOS 存储 API Key
- **WHEN** 用户在 macOS 上保存 API Key
- **THEN** 系统使用 Keychain 存储 API Key

#### Scenario: Linux 存储 API Key
- **WHEN** 用户在 Linux 上保存 API Key
- **THEN** 系统使用 Secret Service API (如 GNOME Keyring) 存储 API Key

### Requirement: 提供商启用/禁用

系统 SHALL 允许用户启用或禁用已配置的提供商。

#### Scenario: 禁用提供商
- **WHEN** 用户禁用某个提供商
- **THEN** 该提供商的模型不再出现在模型选择列表中

#### Scenario: 启用提供商
- **WHEN** 用户启用之前禁用的提供商
- **THEN** 该提供商的模型重新出现在模型选择列表中

### Requirement: 提供商配置验证

系统 SHALL 在保存提供商配置时验证连接有效性。

#### Scenario: 验证 API Key
- **WHEN** 用户保存 OpenAI/Anthropic/Google 配置
- **THEN** 系统发送测试请求验证 API Key 是否有效

#### Scenario: 验证失败提示
- **WHEN** API Key 验证失败
- **THEN** 系统显示具体错误原因（无效 Key、余额不足、网络问题等）

### Requirement: 模型列表管理

系统 SHALL 自动获取并显示每个提供商支持的模型列表。

#### Scenario: 自动获取模型
- **WHEN** 用户成功配置提供商
- **THEN** 系统自动获取该提供商的所有可用模型

#### Scenario: 手动刷新模型
- **WHEN** 用户点击刷新模型列表
- **THEN** 系统重新获取提供商的最新模型列表

### Requirement: 删除提供商

系统 SHALL 允许用户删除已配置的提供商。

#### Scenario: 删除提供商
- **WHEN** 用户删除某个提供商配置
- **THEN** 系统删除该提供商的所有配置和存储的 API Key
