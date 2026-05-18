# Architecture Guide

## 技术堆栈

### 编辑器内核

- `TypeScript`
- `ProseMirror`
  - `prosemirror-model`
  - `prosemirror-state`
  - `prosemirror-view`
  - `prosemirror-keymap`
  - `prosemirror-history`
  - `prosemirror-inputrules`
- `markdown-it`: Markdown parse
- `turndown` + `turndown-plugin-gfm`: HTML -> Markdown 辅助转换
- `temml`: 数学公式渲染
- `mermaid`: 图表预览
- `DOMPurify`: Mermaid SVG sanitize

### 应用与构建

- `Vite` / `vite-plus`
- `Vitest` 风格测试运行时（通过 `vite-plus-test`）
- `happy-dom`: headless DOM 测试环境
- `Electron` + `electron-builder`: desktop 包装
- `Node.js`: 本地 server、发布渲染、构建脚本

### 数据与发布

- `Python`: `bin/publish-site`
- 文件系统作为主存储
- `public/js/data.js` 作为静态读模型

## 组合关系

仓库不是单体应用，而是几层组合：

1. `Aaronnote/src/`: 编辑器内核
2. `Aaronnote/aaronnote/`, `server/`, `desktop/`: 应用壳
3. `bin/publish-site`: 离线发布器
4. `public/js/*.js`: 静态站点消费层
5. `agent/*`: AI 检索和维护层

关键组合关系如下：

- `Aaronnote` 既是交互式编辑器，也是发布链路的渲染内核。
- `roam/**/*.md` 是事实来源。
- 发布脚本不直接实现一套单独的 Markdown renderer，而是调用 `Aaronnote/scripts/render-html.mjs`。
- 站点前端不读原始 Markdown，只读预生成的 `SITE_DATA`。
- `agent/` 不参与产品运行时，只提供维护辅助。

## Aaronnote 内核组合

### 核心模块拼装

内核的组合顺序大致是：

1. `schema.ts` 定义文档结构白名单
2. `parser.ts` 把 Markdown 解析成 PM doc
3. `editor.ts` 组装插件栈和 keymap
4. `normalize.ts` 在每次 transaction 后修正 inline marks
5. `decorations.ts` 和相关 NodeView/widget 做可视化
6. `serializer.ts` 把 PM doc 写回 Markdown

对外导出在 `src/lib.ts`，真正面向消费方的控制器在 `editor-api.ts`。

### Feature 拼装

每个 feature 都通过注册方式进入核心，而不是硬编码进单一大文件。

一个 feature 通常可以贡献：

- schema nodes / marks
- markdown-it parser token handlers
- serializer 规则
- inline scanner
- keymap
- ProseMirror plugins

统一入口在 `src/features/index.ts` 的 `collect*()` 系列函数。

这意味着当前系统是“内核 + feature registry”结构，不是传统的巨型 switch。

## 状态模型

### 权威状态

编辑器运行时真正的 authority 是 `EditorState`：

- `doc`
- `selection`
- `storedMarks`
- `plugins`

Markdown 字符串不是运行时 authority。它只在下面几个边界出现：

1. 初始载入
2. 导出 / 保存
3. source 模式切换
4. 发布渲染

### Method B

当前最核心的设计是 Method B：

- 文本节点里保留 Markdown 源分隔符
- inline marks 不在输入当下永久写死
- 每次 transaction 后重新从 text content 推导 marks

例如强调、删除线、链接、inline math 这类 inline feature，最终都要经过：

`textContent -> parseInline -> normalize -> decorations`

所以：

- `doc.textContent` 更接近原始 source
- marks 是从 source 推导出来的结构化视图
- decorations 是对 source 的视觉处理，不是 source 本身

## 事务和状态机运行逻辑

### 单次编辑事务

一次典型输入的运行链路是：

1. 用户输入字符 / 按键
2. ProseMirror 生成 transaction
3. input rules / keymap / feature plugin 先处理
4. `normalizeInlinePlugin()` 在 `appendTransaction` 阶段重新扫描 textblock
5. 计算目标 marks，与当前 marks 对比
6. 必要时发出补充 transaction 做 mark reconciliation
7. decoration/plugin state 更新
8. `EditorView` 重绘

这里最重要的一点是：inline 语义不是“在 keydown 时就固定完成”，而是“transaction 后归一化完成”。

### normalize 状态机

`normalize.ts` 本身也维护一个小型派生状态机：

- `state.init`: 基于 doc 计算首份 plan
- `state.apply`: doc 变更时重算 plan；纯 selection 变更时复用旧 plan
- `appendTransaction`: 根据 plan 做 mark 对齐

这个 plan 里保存：

- 每个 textblock 的 inline parse 结果
- delimiter ranges
- extra decorations
- widget decorations

因此 normalize 既是：

1. inline 语义归一化器
2. decoration 数据的生产者

### inline parser 状态机

`inline-parse.ts` 不是完整 parser generator，而是轻量 orchestration：

- 所有 inline feature 按 priority 排序运行
- 共用一个 `consumed bitmap`
- 先占用字符的 feature 会屏蔽后续 feature 对同一段字符的识别

这套机制解决的是“多个 inline 语法竞争同一段文本”的问题。

可以把它理解成一个有限状态扫描器组合器：

- 输入：text + parent block context
- 中间状态：`consumed`
- 输出：`InlineSpan[]`

## 插件栈运行顺序

`editor.ts` 里的默认栈顺序很关键：

1. `history()`
2. undo/redo keymap
3. `markdownInputRules()`
4. `spaceBreaksStoredMarks()`
5. `normalizeInlinePlugin()`
6. feature-contributed plugins
7. `syntaxHintsPlugin()`
8. link open plugin
9. `cursorRenderPlugin()`（可选）
10. feature keymap
11. `baseKeymap`

这套排序表达了两个约束：

- normalize 必须早于多数视觉插件运行
- feature keymap 必须优先于 `baseKeymap`

否则像 Enter / Backspace 这类 Typora 风格 block 退出逻辑会被基础行为抢走。

## NodeView 和可视层

当前可视层不是纯 Markdown 文本渲染，也不是单纯 marks：

- inline syntax hints 走 decorations
- math block 走自定义 `NodeView`
- org-env block 走自定义 `NodeView`
- code fence 的 diagram preview 也带有自定义预览逻辑

所以这套系统是三层显示组合：

1. PM 原生文档节点
2. marks / decorations
3. NodeView / widget UI

维护时要先分清 bug 落在哪一层。

## 发布链路状态机

`bin/publish-site` 可以理解为离线导出状态机：

1. 扫描 `roam/**/*.md`
2. 读取 metadata
3. 构造 `Note`
4. 解析 refs / backlinks
5. 判断 private / hidden
6. 计算是否可跳过渲染
7. 调用 Aaronnote renderer 产出 HTML
8. 生成 `SITE_DATA`
9. 复制静态资源
10. 记录 `.publish-state.json`

其中有两层缓存/增量机制：

- note 级别 `.deps/*.json`
- 整体 publish 级别 `.publish-state.json`

因此发布不是“每次全量重建”，而是带增量跳过策略的。

## 维护时的判断准则

### 改 Aaronnote 行为

先判断问题属于哪层：

1. parser / serializer
2. normalize / inline parse
3. decorations / NodeView
4. keymap / transaction flow

### 改发布链路

先判断变更影响的是：

1. source metadata 解析
2. note graph
3. privacy sealing
4. static data contract
5. incremental build

### 改“状态机”

这里的状态机不只是一个 reducer，而是多段组合：

- PM transaction lifecycle
- normalize 派生状态
- NodeView 的 active/rendered UI 状态
- publish script 的增量导出状态

所以改状态机时，最好明确你改的是哪一段，而不是笼统说“编辑器状态”。
