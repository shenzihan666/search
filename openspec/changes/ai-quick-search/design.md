# Technical Design - AI Quick Search

## Context

构建一个轻量级跨平台桌面应用，解决多 AI 模型对比查询的痛点。应用需要：

- 随时随地快速唤出（全局快捷键）
- 后台常驻、开机自启
- 多模型并行查询、结果并排展示
- 低内存占用、快速启动

**约束条件**：
- 目标打包体积 < 10MB（不含 WebView）
- 目标内存占用 < 100MB（空闲状态）
- 冷启动时间 < 500ms
- 支持 Windows / macOS / Linux

## Goals / Non-Goals

**Goals:**
- 全局快捷键唤出搜索窗口
- 支持主流 AI 提供商（OpenAI、Anthropic、Google、本地模型）
- 多模型并行查询，流式响应
- 结果并排对比展示
- 系统托盘常驻 + 开机自启
- 本地持久化配置和历史

**Non-Goals:**
- 不支持移动端
- 不做 AI 模型微调/训练
- 不做团队协作/云端同步（MVP 阶段）
- 不支持图片/语音输入（MVP 阶段）

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Tauri Application                     │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Svelte 5 + Tailwind)                             │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐│
│  │ SearchBox   │ ModelPicker │ ResultPanel │ HistoryPanel ││
│  │ Component   │ Component   │ (x N)       │ Component    ││
│  └─────────────┴─────────────┴─────────────┴──────────────┘│
│           │                 ▲                               │
│           │ Tauri Commands  │ Events (streaming)            │
│           ▼                 │                               │
├─────────────────────────────────────────────────────────────┤
│  Backend (Rust)                                              │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐│
│  │ Hotkey      │ Window      │ Provider    │ Query        ││
│  │ Manager     │ Manager     │ Registry    │ Orchestrator ││
│  └─────────────┴─────────────┴─────────────┴──────────────┘│
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────┬─────────────┬──────────────┐               │
│  │ OpenAI      │ Anthropic   │ Ollama       │ ...           │
│  │ Client      │ Client      │ Client       │               │
│  └─────────────┴─────────────┴──────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │ Storage (SQLite / JSON file)             │               │
│  │ - Provider configs (API keys encrypted)  │               │
│  │ - Query history                          │               │
│  │ - App settings                           │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## Decisions

### D1: Tauri vs Electron

**选择**: Tauri

**理由**:
| 维度 | Tauri | Electron |
|------|-------|----------|
| 打包体积 | ~3-10 MB | ~150+ MB |
| 内存占用 | ~50-100 MB | ~200-500 MB |
| 启动速度 | 快 | 较慢 |
| 后端语言 | Rust | Node.js |
| 系统集成 | 原生 | 需要额外 native 模块 |

本项目追求轻量、快速、无感，Tauri 更符合需求。

**Trade-off**: Rust 学习曲线较陡，但生态成熟，Tauri 官方插件覆盖大部分需求。

### D2: Svelte 5 vs React

**选择**: Svelte 5

**理由**:
- 编译时框架，无虚拟 DOM，运行时极小
- 响应式语法简洁 (`$state`, `$derived`)
- 与 Tauri 官方模板集成良好
- 适合中小型 UI，组件数量可控

**Trade-off**: 生态小于 React，但本项目 UI 复杂度低，够用。

### D3: 数据存储方案

**选择**: SQLite + 加密 JSON 文件

**方案**:
- **配置文件**: `~/.ai-quick-search/config.json`（明文设置）
- **API Keys**: 系统密钥库 (Windows DPAPI / macOS Keychain / Linux Secret Service)
- **历史记录**: SQLite (`~/.ai-quick-search/history.db`)

**理由**:
- SQLite 查询灵活，支持全文搜索
- API Keys 使用系统密钥库，安全性高
- 配置文件便于用户手动编辑/备份

### D4: 流式响应处理

**选择**: Server-Sent Events (SSE) 风格，通过 Tauri Events 推送

**方案**:
```rust
// Rust 后端：流式调用 AI API，逐块发送事件
async fn query_stream(models: Vec<String>, prompt: String, app: AppHandle) {
    for model in models {
        let stream = provider_client.stream_chat(prompt.clone());
        while let Some(chunk) = stream.next().await {
            app.emit("query:chunk", ChunkPayload { model, chunk })?;
        }
        app.emit("query:complete", CompletePayload { model })?;
    }
}
```

```svelte
<!-- Svelte 前端：监听事件，实时更新 -->
<script>
  import { listen } from '@tauri-apps/api/event';

  let results = $state({});

  onMount(() => {
    listen('query:chunk', ({ payload }) => {
      results[payload.model] += payload.chunk;
    });
  });
</script>
```

**理由**: 流式响应提升用户体验，避免长时间等待空白。

### D5: 窗口管理策略

**选择**: 单例浮动窗口

**方案**:
- 主窗口：无边框、透明背景、始终置顶、点击外部可选隐藏
- 快捷键：`Alt+Space` 切换显示/隐藏
- 窗口位置：记住上次位置，或屏幕居中

**实现**:
```rust
// tauri.conf.json
{
  "windows": [{
    "label": "main",
    "visible": false,  // 启动时隐藏
    "decorations": false,  // 无边框
    "alwaysOnTop": true,
    "transparent": true
  }]
}
```

## Module Design

### M1: Hotkey Manager (Rust)

使用 `tauri-plugin-global-shortcut`

```rust
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

fn setup_hotkey(app: &AppHandle) {
    let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
    app.global_shortcut().register(shortcut)?;
}
```

### M2: Window Manager (Rust)

```rust
fn toggle_window(app: &AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    if window.is_visible().unwrap() {
        window.hide().unwrap();
    } else {
        window.show().unwrap();
        window.set_focus().unwrap();
    }
}
```

### M3: Provider Registry (Rust)

```rust
struct ProviderRegistry {
    providers: HashMap<String, Box<dyn AIProvider>>,
}

trait AIProvider {
    async fn chat(&self, messages: Vec<Message>) -> Result<String>;
    async fn chat_stream(&self, messages: Vec<Message>) -> impl Stream<Item = Result<String>>;
}

struct OpenAIProvider { api_key: String, model: String }
struct AnthropicProvider { api_key: String, model: String }
struct OllamaProvider { base_url: String, model: String }
```

### M4: Query Orchestrator (Rust)

```rust
async fn query_parallel(
    providers: Vec<String>,
    prompt: String,
    app: AppHandle,
) -> Result<()> {
    let handles: Vec<_> = providers
        .iter()
        .map(|p| spawn_query(p.clone(), prompt.clone(), app.clone()))
        .collect();

    join_all(handles).await;
    Ok(())
}
```

### M5: Frontend Components (Svelte)

```
src/
├── lib/
│   ├── components/
│   │   ├── SearchBox.svelte      # 输入框 + 模型选择
│   │   ├── ResultPanel.svelte    # 单个模型结果展示
│   │   ├── ResultGrid.svelte     # 多结果并排布局
│   │   ├── ModelPicker.svelte    # 模型选择器
│   │   ├── HistoryPanel.svelte   # 历史记录
│   │   └── SettingsPanel.svelte  # 设置页面
│   └── stores/
│       ├── results.ts            # 响应式结果状态
│       ├── settings.ts           # 应用设置
│       └── history.ts            # 历史记录
├── App.svelte
└── main.ts
```

## Data Models

### Provider Config

```typescript
interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
  apiKey?: string;  // 存储在系统密钥库，运行时注入
  baseUrl?: string;
  models: ModelConfig[];
  enabled: boolean;
}

interface ModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  supportsStreaming: boolean;
}
```

### Query History

```typescript
interface QueryRecord {
  id: string;
  timestamp: number;
  prompt: string;
  results: {
    modelId: string;
    modelName: string;
    response: string;
    latency: number;
    tokensUsed?: number;
  }[];
  selectedModels: string[];
}
```

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| API Key 泄露 | 使用系统密钥库存储，不在配置文件明文保存 |
| 多模型并行请求成本高 | 提供模型选择，默认只选一个，用户自主选择 |
| 流式响应不稳定 | 添加超时和重试机制，降级为非流式 |
| 跨平台快捷键冲突 | 允许用户自定义快捷键 |
| 窗口焦点管理复杂 | 参考 Raycast/Spotlight 实现模式 |
| 本地存储损坏 | 定期备份，提供恢复机制 |

## Open Questions

1. **默认支持哪些 AI 提供商？** MVP 建议：OpenAI、Anthropic、Ollama
2. **历史记录保留多久？** 建议默认 30 天，可配置
3. **是否支持自定义 Prompt 模板？** MVP 后考虑
4. **是否支持导出对比结果？** MVP 后考虑
