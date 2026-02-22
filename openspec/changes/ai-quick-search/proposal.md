# AI Quick Search - 多模型对比搜索框

> **规划文档** - 拆分为多阶段实施

## 阶段划分

| 阶段 | 变更名 | 状态 |
|------|--------|------|
| Phase 1 | `ai-search-mvp` | 🚀 待实施 |
| Phase 2 | `ai-search-multi` | ⏳ 待规划 |
| Phase 3 | `ai-search-polish` | ⏳ 待规划 |

---

## Why

当想要了解一个问题时，经常需要对比多个 AI 模型的回答来获得更全面的视角。目前的体验是：打开多个浏览器标签页，在每个标签页输入相同的问题，然后在标签页间频繁切换查看结果。这种体验割裂、效率低下，脑子容易绕晕。

我们需要一个轻量级的桌面工具：随时唤出、一次提问、多模型同时响应、结果并排对比。

## What Changes

构建一个跨平台桌面应用，核心功能：

- **全局快速唤出**: 通过快捷键（如 `Alt+Space`）随时随地唤出搜索框，无需切换应用
- **多模型并行查询**: 一次提问，同时发送给多个选中的 AI 模型
- **并排对比展示**: 多个模型的回答并排显示，方便对比
- **模型灵活配置**: 支持接入任意大模型（OpenAI、Claude、Gemini、本地模型等）
- **后台无感运行**: 最小化到系统托盘，开机自启，占用低、启动快
- **历史记录**: 保存查询历史，方便回顾

技术选型：
- **Tauri + Rust**: 轻量级桌面应用框架，打包体积小，内存占用低
- **Svelte 5**: 编译型前端框架，运行时小，响应快
- **Tailwind CSS**: 快速构建简洁现代的 UI

## Capabilities

### New Capabilities

- `global-hotkey`: 全局快捷键唤出/隐藏搜索窗口
- `multi-model-query`: 多模型并行查询能力
- `model-provider`: AI 模型提供商管理（配置、切换、增删）
- `result-comparison`: 多模型回答并排对比展示
- `system-tray`: 系统托盘常驻、右键菜单
- `autostart`: 开机自启动
- `query-history`: 查询历史记录与搜索

### Modified Capabilities

(无 - 这是全新项目)

## Impact

**新建项目**，无现有代码影响。

**外部依赖**:
- Tauri v2.x
- Svelte 5.x
- Tailwind CSS v4.x
- 各 AI 提供商 API (OpenAI、Anthropic、Google 等)

**目标平台**: Windows、macOS、Linux
