# Result Comparison Specification

多模型回答并排对比展示能力。

## ADDED Requirements

### Requirement: 并排布局展示

系统 SHALL 以并排布局展示多个模型的响应结果。

#### Scenario: 两个模型并排
- **WHEN** 用户选择 2 个模型进行查询
- **THEN** 两个结果以左右并排方式展示，各占 50% 宽度

#### Scenario: 多个模型网格布局
- **WHEN** 用户选择 3 个或更多模型进行查询
- **THEN** 结果以网格布局展示，自动适应屏幕宽度

#### Scenario: 单个模型全宽
- **WHEN** 用户只选择 1 个模型进行查询
- **THEN** 结果区域占据全部可用宽度

### Requirement: 响应式布局

系统 SHALL 根据窗口大小自动调整布局。

#### Scenario: 窗口变窄时调整
- **WHEN** 用户缩小窗口宽度到不足以并排显示
- **THEN** 布局自动切换为纵向堆叠

#### Scenario: 窗口变宽时调整
- **WHEN** 用户扩大窗口宽度
- **THEN** 布局自动恢复为并排展示

### Requirement: 模型标识

系统 SHALL 在每个结果区域清晰标识对应的模型名称。

#### Scenario: 显示模型名称
- **WHEN** 查询结果显示
- **THEN** 每个结果区域顶部显示对应的模型名称和图标

#### Scenario: 显示提供商名称
- **WHEN** 查询结果显示
- **THEN** 每个结果区域显示该模型所属的提供商

### Requirement: 响应内容格式化

系统 SHALL 支持 Markdown 格式化显示响应内容。

#### Scenario: Markdown 渲染
- **WHEN** 模型返回包含 Markdown 格式的响应
- **THEN** 系统正确渲染标题、列表、代码块、链接等元素

#### Scenario: 代码高亮
- **WHEN** 响应中包含代码块
- **THEN** 系统根据语言自动进行语法高亮

### Requirement: 结果同步滚动

系统 SHALL 支持可选的结果同步滚动功能。

#### Scenario: 开启同步滚动
- **WHEN** 用户开启同步滚动选项
- **THEN** 滚动任一结果区域时，其他结果区域同步滚动

#### Scenario: 关闭同步滚动
- **WHEN** 用户关闭同步滚动选项
- **THEN** 每个结果区域独立滚动

### Requirement: 复制单个结果

系统 SHALL 允许用户复制单个模型的完整响应。

#### Scenario: 复制响应内容
- **WHEN** 用户点击某结果区域的复制按钮
- **THEN** 该模型的完整响应内容被复制到剪贴板

### Requirement: 导出对比结果

系统 SHALL 支持导出所有模型的对比结果。

#### Scenario: 导出为 Markdown
- **WHEN** 用户点击导出并选择 Markdown 格式
- **THEN** 系统生成包含问题和所有模型回答的 Markdown 文件

#### Scenario: 导出为 JSON
- **WHEN** 用户点击导出并选择 JSON 格式
- **THEN** 系统生成结构化的 JSON 文件，包含完整的对话数据
