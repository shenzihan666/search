# Global Hotkey Specification

全局快捷键唤出/隐藏搜索窗口的能力。

## ADDED Requirements

### Requirement: 默认快捷键唤出

系统 SHALL 默认使用 `Alt+Space` 快捷键来切换搜索窗口的显示/隐藏状态。

#### Scenario: 按下快捷键显示窗口
- **WHEN** 搜索窗口处于隐藏状态且用户按下 `Alt+Space`
- **THEN** 系统显示搜索窗口并将焦点设置到输入框

#### Scenario: 按下快捷键隐藏窗口
- **WHEN** 搜索窗口处于显示状态且用户按下 `Alt+Space`
- **THEN** 系统隐藏搜索窗口

### Requirement: 自定义快捷键

系统 SHALL 允许用户自定义快捷键组合。

#### Scenario: 用户修改快捷键
- **WHEN** 用户在设置中修改快捷键为 `Ctrl+Shift+Space`
- **THEN** 系统保存新的快捷键配置并立即生效

#### Scenario: 快捷键冲突提示
- **WHEN** 用户设置的新快捷键与系统或其他应用冲突
- **THEN** 系统显示警告提示，但允许用户继续设置

### Requirement: 跨应用响应

系统 SHALL 确保快捷键在任何应用程序中都能响应。

#### Scenario: 在其他应用中唤出
- **WHEN** 用户正在使用浏览器或其他应用并按下快捷键
- **THEN** 搜索窗口显示在最顶层并获得焦点

### Requirement: 全局快捷键在后台时生效

系统 SHALL 在应用最小化到系统托盘时仍能响应快捷键。

#### Scenario: 后台状态唤出
- **WHEN** 应用在系统托盘运行且主窗口隐藏时用户按下快捷键
- **THEN** 主窗口显示并获得焦点
