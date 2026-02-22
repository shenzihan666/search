# Single Model Query Specification (MVP)

单模型查询能力，MVP 阶段仅支持 OpenAI。

## ADDED Requirements

### Requirement: OpenAI API 查询

系统 SHALL 支持 OpenAI API 进行查询。

#### Scenario: 发送查询请求
- **WHEN** 用户输入问题并提交
- **THEN** 系统向 OpenAI API 发送请求并返回响应

#### Scenario: 流式响应
- **WHEN** OpenAI 返回流式响应
- **THEN** 系统实时显示响应内容

### Requirement: API Key 配置

系统 SHALL 允许用户配置 OpenAI API Key。

#### Scenario: 首次配置
- **WHEN** 用户首次使用且未配置 API Key
- **THEN** 系统提示用户输入 API Key

#### Scenario: 保存 API Key
- **WHEN** 用户输入 API Key 并确认
- **THEN** 系统保存到本地配置文件

### Requirement: 查询错误处理

系统 SHALL 处理查询错误并显示友好提示。

#### Scenario: API Key 无效
- **WHEN** API Key 无效或过期
- **THEN** 系统显示错误提示并引导用户更新 Key

#### Scenario: 网络错误
- **WHEN** 网络连接失败
- **THEN** 系统显示网络错误提示
