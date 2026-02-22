# Basic UI Specification (MVP)

基础界面能力。

## ADDED Requirements

### Requirement: 搜索输入框

系统 SHALL 提供搜索输入框。

#### Scenario: 输入问题
- **WHEN** 窗口显示时
- **THEN** 输入框自动获得焦点

#### Scenario: 提交查询
- **WHEN** 用户按 Enter 键或点击发送按钮
- **THEN** 系统提交查询请求

### Requirement: 结果显示

系统 SHALL 显示 AI 响应结果。

#### Scenario: 显示响应
- **WHEN** AI 返回响应
- **THEN** 结果区域显示响应内容

#### Scenario: Markdown 渲染
- **WHEN** 响应包含 Markdown 格式
- **THEN** 系统正确渲染格式化内容

### Requirement: 加载状态

系统 SHALL 显示查询加载状态。

#### Scenario: 查询中
- **WHEN** 查询正在进行
- **THEN** 显示加载指示器

### Requirement: 关闭窗口

系统 SHALL 支持关闭窗口。

#### Scenario: 按 Esc 关闭
- **WHEN** 用户按 Esc 键
- **THEN** 窗口隐藏（应用继续运行）
