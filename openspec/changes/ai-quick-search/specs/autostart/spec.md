# Autostart Specification

开机自启动能力。

## ADDED Requirements

### Requirement: 开机自启动配置

系统 SHALL 允许用户配置是否开机自启动。

#### Scenario: 启用开机自启动
- **WHEN** 用户在设置中启用"开机自启动"选项
- **THEN** 系统注册自启动项，下次开机时自动启动应用

#### Scenario: 禁用开机自启动
- **WHEN** 用户在设置中禁用"开机自启动"选项
- **THEN** 系统移除自启动项，下次开机时不自动启动应用

### Requirement: 跨平台自启动

系统 SHALL 在所有支持的平台实现开机自启动。

#### Scenario: Windows 自启动
- **WHEN** 用户在 Windows 上启用自启动
- **THEN** 系统在注册表中添加启动项

#### Scenario: macOS 自启动
- **WHEN** 用户在 macOS 上启用自启动
- **THEN** 系统添加到登录项 (Launch Agent)

#### Scenario: Linux 自启动
- **WHEN** 用户在 Linux 上启用自启动
- **THEN** 系统创建 .desktop 文件到 autostart 目录

### Requirement: 自启动状态同步

系统 SHALL 确保设置中的自启动状态与系统实际状态一致。

#### Scenario: 外部修改检测
- **WHEN** 用户通过系统设置或其他方式移除了自启动项
- **THEN** 应用中的自启动设置自动更新为禁用状态

### Requirement: 自启动后最小化

系统 SHALL 支持配置自启动后是否最小化到托盘。

#### Scenario: 自启动并最小化
- **WHEN** 应用通过自启动启动且启用了"启动时最小化"
- **THEN** 应用直接最小化到系统托盘，不显示主窗口

#### Scenario: 自启动并显示窗口
- **WHEN** 应用通过自启动启动且禁用了"启动时最小化"
- **THEN** 应用启动后显示主窗口
