# Query History Specification

查询历史记录与搜索能力。

## ADDED Requirements

### Requirement: 自动保存查询历史

系统 SHALL 自动保存每次查询的完整记录。

#### Scenario: 保存查询记录
- **WHEN** 用户提交一次查询
- **THEN** 系统保存查询记录，包含：
  - 时间戳
  - 问题内容
  - 选中的模型列表
  - 每个模型的响应内容
  - 响应时间

### Requirement: 历史记录列表

系统 SHALL 提供可浏览的历史记录列表。

#### Scenario: 显示历史列表
- **WHEN** 用户打开历史面板
- **THEN** 显示按时间倒序排列的查询历史列表

#### Scenario: 历史记录预览
- **WHEN** 历史列表显示
- **THEN** 每条记录显示问题摘要、时间和使用的模型图标

### Requirement: 历史搜索

系统 SHALL 支持搜索历史记录。

#### Scenario: 搜索历史
- **WHEN** 用户在历史面板中输入搜索关键词
- **THEN** 系统过滤并显示包含该关键词的历史记录

#### Scenario: 全文搜索
- **WHEN** 用户搜索某个词
- **THEN** 系统同时搜索问题和所有响应内容

### Requirement: 查看历史详情

系统 SHALL 允许用户查看历史查询的完整内容。

#### Scenario: 打开历史记录
- **WHEN** 用户点击某条历史记录
- **THEN** 显示完整的查询内容，包含所有模型的响应

#### Scenario: 从历史恢复查询
- **WHEN** 用户点击"重新查询"按钮
- **THEN** 问题内容和模型选择恢复到输入区域，可重新提交

### Requirement: 删除历史记录

系统 SHALL 允许用户删除单条或全部历史记录。

#### Scenario: 删除单条记录
- **WHEN** 用户删除某条历史记录
- **THEN** 该记录从历史中移除

#### Scenario: 清空所有历史
- **WHEN** 用户点击"清空历史"
- **THEN** 系统提示确认后删除所有历史记录

### Requirement: 历史记录保留策略

系统 SHALL 支持配置历史记录的保留时间。

#### Scenario: 自动清理过期历史
- **WHEN** 历史记录超过配置的保留天数（默认 30 天）
- **THEN** 系统自动删除过期记录

#### Scenario: 永久保留
- **WHEN** 用户将保留时间设置为"永久"
- **THEN** 历史记录永不自动删除

### Requirement: 历史数据导出

系统 SHALL 支持导出历史数据。

#### Scenario: 导出为 JSON
- **WHEN** 用户点击导出历史
- **THEN** 系统生成包含所有历史记录的 JSON 文件
