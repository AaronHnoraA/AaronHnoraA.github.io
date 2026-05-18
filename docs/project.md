# Project Guide

## 目标

这个仓库当前承担的是一套本地知识库工具链，而不是单一应用：

- `Aaronnote` 负责编辑 Markdown。
- `roam/` 保存长期数据。
- `bin/publish-site` 把数据源转成公开站点。
- `agent/` 生成给 AI 检索和维护用的派生索引。

因此，维护时要先分清楚你是在改：

1. 编辑器行为
2. 数据模型
3. 发布流程
4. AI 辅助索引

这四层不能混着处理。

## Source Of Truth

当前真实数据源是 `roam/**/*.md`。

这意味着：

- 笔记 ID、标题、日期、标签等元信息来自 Markdown 文件头部的 `#+begin meta` 块。
- 跨文档关系来自相对 Markdown 链接。
- `public/`、`agent/index/`、`agent/wiki/` 都是派生结果，不应手工作为事实来源维护。

当前设计更接近“文件数据库 + 派生读模型”，不是单独的运行时数据库服务。

## 数据分层

### 1. 持久层

- `roam/**/*.md`

职责：

- 保存原始 Markdown
- 保存元数据
- 保存相对链接关系

### 2. 发布层

- `bin/publish-site`
- `public/`

职责：

- 把 Markdown 渲染为 HTML
- 生成站点可消费的数据文件
- 复制公开静态资源
- 对私有路径和私有笔记做密封处理

### 3. AI 检索层

- `agent/index/`
- `agent/wiki/`
- `agent/skill/maintain.py`

职责：

- 为 AI 提供更快的索引入口
- 压缩文档视图，减少上下文开销
- 保留“可回到原始 Markdown 核对”的工作方式

### 4. 编辑器层

- `Aaronnote/src/`
- `Aaronnote/aaronnote/`
- `Aaronnote/server/`
- `Aaronnote/desktop/`

职责：

- 编辑、渲染、序列化 Markdown
- 提供 Web/desktop 的运行入口
- 为发布链路提供 HTML 渲染能力

## 目录职责

- `Aaronnote/`: 主开发区。编辑器逻辑、测试、桌面壳、站点壳都在这里。
- `roam/`: 内容与元数据源。
- `public/`: 已发布文件。可以重建，不应作为开发事实来源。
- `bin/`: 发布脚本入口。
- `agent/`: AI 维护资料和派生索引。
- `CV/`: 独立的 LaTeX 简历工程。

## 维护边界

### 改 Aaronnote 时

优先检查：

- `Aaronnote/src/`
- `Aaronnote/tests/`
- `Aaronnote/specs/`
- `Aaronnote/CLAUDE.md`

不要顺手改：

- `public/` 的发布产物
- `agent/index/` 和 `agent/wiki/` 的派生内容

除非这次变更明确要求同步发布或刷新索引。

### 改数据模型或发布链路时

优先检查：

- `bin/publish-site`
- `public/js/data.js` 的输出结构
- `js/knowledge.js` / `public/js/knowledge.js` 的消费逻辑

核心问题是兼容性：

- 新字段是否会破坏已有站点读取逻辑
- 私有内容是否仍然被正确密封
- 依赖快照和增量发布是否还能工作

### 改 AI 维护层时

先看：

- [agent/develop.md](/Users/hc/HC/Org/agent/develop.md)
- [agent/skill/README.md](/Users/hc/HC/Org/agent/skill/README.md)

这里有门禁规则。平时允许刷新派生索引，不默认允许改维护工具本身。

## 常用工作流

### 编辑器开发

```sh
cd Aaronnote
npm install
npm test
npm run start
```

### 站点发布

```sh
make publish
```

### AI 派生索引刷新

```sh
make maintain
```

### 桌面构建

```sh
make build
```

## 需要记住的事实

- 当前仓库的“数据库设计”是文件优先，不是 SQL 优先。
- `public/js/data.js` 是站点前端的读模型，不是主存储。
- 私有内容密封逻辑在发布阶段做，不是在内容源里做二次拷贝。
- `agent/` 是检索优化层，不是内容层。
