# Technical Design - AI Search MVP

## Context

Phase 1 目标：快速验证核心交互，构建可用的 MVP。

## Goals / Non-Goals

**Goals:**
- Tauri 项目初始化
- 全局快捷键唤出/隐藏窗口
- OpenAI API 单模型查询
- 系统托盘常驻
- 基础输入和结果展示 UI

**Non-Goals:**
- 多模型对比（Phase 2）
- 历史记录（Phase 3）
- 自定义快捷键（Phase 3）
- 多提供商支持（Phase 2）
- 设置界面（Phase 3）

## Decisions

### 技术栈
- Tauri v2 + Rust
- Svelte 5 + Tailwind CSS v4
- 仅支持 OpenAI API（MVP）

### 简化决策
- API Key 存储在本地配置文件（Phase 3 再迁移到系统密钥库）
- 无历史持久化（Phase 3）
- 固定快捷键 `Alt+Space`

## Module Design

```
┌─────────────────────────────────────┐
│  Frontend (Svelte)                  │
│  ┌───────────┬───────────────────┐  │
│  │ SearchBox │ ResultPanel       │  │
│  └───────────┴───────────────────┘  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  Backend (Rust)                      │
│  Hotkey | Window | OpenAI Client     │
│  System Tray                         │
└─────────────────────────────────────┘
```

## Risks

| 风险 | 缓解 |
|------|------|
| API Key 明文存储 | 提示用户风险，Phase 3 迁移 |
