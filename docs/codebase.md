# Codebase Guide

## 总览

代码可以按两条主线理解：

1. `Aaronnote` 编辑器
2. `roam -> publish -> public` 发布与数据派生链路

这两条线是耦合的，但职责不同。`Aaronnote` 负责把 Markdown 渲染和编辑好，发布链路负责把 Markdown 数据变成站点和索引。

如果你需要更细的技术栈、内核组合和状态机说明，直接看 [architecture.md](/Users/hc/HC/Org/docs/architecture.md)。

## Aaronnote

### 顶层结构

- `Aaronnote/src/`: 编辑器核心库
- `Aaronnote/specs/`: 行为规格和事件脚本
- `Aaronnote/tests/`: Vitest 测试
- `Aaronnote/website/`: Web harness / demo
- `Aaronnote/aaronnote/`: 应用壳和附加 UI
- `Aaronnote/server/`: 本地服务入口
- `Aaronnote/desktop/`: Electron 入口

### 核心模块

- `src/lib.ts`: 对外 API 入口
- `src/schema.ts`: ProseMirror schema
- `src/parser.ts`: Markdown -> ProseMirror
- `src/serializer.ts`: ProseMirror -> Markdown
- `src/inline-parse.ts`: Method-B inline 解析
- `src/normalize.ts`: 交易后统一修正 inline marks
- `src/decorations.ts`: 分隔符提示和隐藏
- `src/editor.ts`: 默认插件栈

### Feature 组织方式

`src/features/*.ts` 一类语法一个文件，负责：

- schema 扩展
- parser token 处理
- serializer 规则
- inline scan
- 输入规则或插件

对应测试与规格分别在：

- `specs/features/*.specs.ts`
- `tests/features/*.test.ts`

这是当前最重要的开发约定。新增语法时，尽量沿这条路径扩展，不要绕开它往核心塞分散逻辑。

### 编辑器架构要点

当前 `Aaronnote` 明确采用 Method B：

- 文档文本里保留 Markdown 源分隔符
- inline marks 不是输入时直接写死，而是在 `normalize.ts` 里统一推导
- 视图显示通过 decorations 隐藏或提示这些分隔符

这套设计的好处是 round-trip 更稳，但代价是：

- 新 inline 语法必须兼容 `parseInline` / `normalize`
- 插件如果自己偷偷改 inline mark，通常会被 normalize 覆盖

## 发布链路

入口在 `bin/publish-site`。

### 主要职责

- 扫描 `roam/**/*.md`
- 解析元数据
- 构建 note 列表
- 解析引用关系和 backlinks
- 调用 `Aaronnote/scripts/render-html.mjs` 渲染正文
- 输出 HTML 到 `public/roam/**/*.html`
- 生成 `public/js/data.js`
- 复制公开静态资源
- 过滤私有内容和私有资源

### 当前数据模型

发布脚本里的 `Note` 结构基本就是当前读模型的核心：

- `path`
- `rel_path`
- `id`
- `title`
- `date`
- `tags`
- `aliases`
- `summary`
- `search_text`
- `refs`
- `backlinks`
- `private`

前端站点消费的是派生后的 `SITE_DATA`，不是直接读 Markdown。

## 站点前端数据

`public/js/data.js` 当前是单文件常量：

- `meta.generatedAt`
- `meta.noteCount`
- `meta.tagCount`
- `notes[]`

每条 note 至少包含：

- 标识：`key` / `id`
- 展示：`title` / `link` / `date`
- 分组：`groupKey` / `groupLabel` / `section`
- 检索：`summary` / `searchText`
- 图关系：`refs` / `backlinks`
- 可见性：`hidden` / `private`

这说明目前前端是静态站点 + 预计算数据模型，不依赖服务端查询。

## AI 维护层

### 关键文件

- `agent/project-overview.md`: 极简项目摘要
- `agent/growth-log.md`: 变更脉络
- `agent/index/*`: 派生索引
- `agent/wiki/*`: 压缩 wiki
- `agent/skill/maintain.py`: 索引生成器
- `agent/develop.md`: 维护门禁

### 设计意图

这层不是产品功能，而是维护基础设施：

- 帮 AI 快速找到相关文档
- 减少读取大仓库时的上下文成本
- 强制回到原始 Markdown 做事实核对

## 构建和测试入口

根目录：

- `make publish`
- `make maintain`
- `make build`

`Aaronnote/`：

- `npm test`
- `npm run start`
- `npm run build`
- `npm run build:aaronnote`
- `npm run build:desktop`

## 读代码建议

如果要改 Aaronnote：

1. 先看 `Aaronnote/CLAUDE.md`
2. 再看 `src/features/` 对应语法实现
3. 最后看对应 `specs/` 和 `tests/`

如果要改发布或“数据库”层：

1. 先看 `bin/publish-site`
2. 再看 `public/js/data.js` 的输出结构
3. 然后看 `js/knowledge.js` / `public/js/app.js` 的消费逻辑
