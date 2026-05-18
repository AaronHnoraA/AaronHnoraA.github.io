# Aaronnote Performance Optimization

本页是 Aaronnote 大文件性能维护账本。后续改性能时，先在这里找到对应条目，改动完成后同步更新状态、代码入口和验证方式。

## 目标

目标不是让 Markdown 本身承担所有复杂度，而是把高成本工作从输入关键路径移走：

- 打开大文件时避免整篇同步 parse / render / scan。
- 输入时只更新受影响 block、selection 或 viewport。
- 保存、索引、补全、图表等非编辑核心工作尽量异步、懒加载或后台执行。
- 对 1MB、5MB、10MB Markdown 建立可重复的性能基准。

## 优化账本

| 区域                   | 问题                                       | 大文件下表现                      | 是否 Markdown 必须承担       | 优化方向                                     | 状态                                                                       |
| -------------------- | ---------------------------------------- | --------------------------- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| 文档模型                 | 当前更像整篇文档一次性解析/渲染                         | 1MB+ 文件打开、输入、保存都会拖慢         | 不是必须                   | 改成分块模型，按 block/段落增量更新                    | P0 收口：1MB+ 首次打开默认 source，输入侧已 block 增量；真分块模型留后续架构                        |
| Markdown 解析          | 编辑时容易触发全量 parse/normalize                | 每次输入后 CPU 抖动明显              | 部分必须，但不该全量             | 用 dirty range / affected block 重算        | 部分完成：inline normalize 按 changed textblock 增量重算                           |
| DOM 渲染               | 大量块一次性挂 DOM                              | 打开慢、滚动卡、内存涨                 | 不是必须                   | 可视区虚拟化，只渲染 viewport 附近                   | P1 起步：已有 viewport range plugin；超大文件默认 source，完整 DOM 虚拟化待后续架构             |
| Decoration           | links/math/code/todo 等装饰可能全量扫描           | 输入一个字符也会触发整篇扫描              | 不是必须                   | decoration 分层缓存，按 block invalidation     | P0 收口：normalize block cache + viewport/window 二分扫描；ref-def 大文档窗口化        |
| 序列化                  | 保存/同步时整篇 serialize                       | 大文件保存卡顿、输入后同步 serialize 会拖慢 | 部分必须，但可异步              | 后台 serialize，或 patch-based text 更新       | 部分完成：输入 transaction 懒序列化，autosave 通过 idle 异步取 Markdown                   |
| normalize            | ProseMirror normalize/schema 修复成本高       | 粘贴/输入复杂块时容易级联更新             | 不是 Markdown 必须，是 PM 成本 | 减少 schema 复杂度，避免全树 normalize             | 部分完成：inline parse plan 复用旧 block，只重算 dirty block                         |
| 数学渲染                 | Temml/KaTeX 渲染可能压在 widget 创建路径上          | 多公式文件打开慢                    | 不是必须                   | hash 缓存公式 HTML，只重算变更公式，编辑态空闲渲染           | 部分完成：已有 LRU cache，编辑器 inline widget idle 渲染，equation tag 增量索引          |
| 代码高亮                 | fenced code 高亮同步执行                       | 长代码块、大量代码块打开慢               | 不是必须                   | lazy highlight，可见区高亮，worker 化            | 部分完成：viewport/window 扫描，12k+ 代码块走 Web Worker 异步高亮                        |
| Mermaid/图表           | 图表渲染重且通常阻塞主线程                            | 含图表文档打开极慢                   | 不是必须                   | 默认占位，点击/可见时渲染                            | 已有 idle + cache，需改成可见/点击触发                                               |
| Roam 功能              | backlinks、refs、tags、todos 可能全篇扫描         | 大文件/多文件 workspace 下启动慢      | 不是 Markdown 必须         | 建索引，增量更新，worker 后台扫                      | P0 收口：refs/backlinks per-file cache，todos per-file cache，roam.db 延迟后台同步  |
| TOC                  | 标题扫描可能每次全量                               | 输入标题附近也重扫全文                 | 不是必须                   | heading index 增量维护                       | 部分完成：TOC NodeView 使用 PM plugin heading index，输入只更新 changed heading block |
| Floating TOC         | 滚动时可能频繁计算 heading/position               | 滚动掉帧                        | 不是必须                   | 缓存 heading index，滚动/selection 只更新 active | 部分完成：heading list 按 PM doc identity 缓存                                   |
| 粘贴 HTML              | turndown/DOMPurify/markdown 转换偏重         | 粘贴大 HTML 卡住 UI              | 不是必须                   | worker 转换，先插入 loading block              | 待设计                                                                      |
| 图片/资源                | 图片尺寸、链接解析、资源清理可能同步                       | 打开含图文文档慢                    | 不是必须                   | lazy load image metadata，异步 asset scan   | 部分完成：大文档 image probe 只扫 viewport/window                                  |
| Copilot/LSP          | 语言服务上下文可能吃整篇文档                           | 输入延迟、内存涨                    | 不是 Markdown 必须         | 限制上下文窗口，debounce，后台请求                    | 部分完成：debounce 阶段不读整篇 Markdown，补全请求发送光标窗口                                 |
| Vim cursor           | 自定义 cursor/deco 可能随 selection 高频更新       | 光标移动卡                       | 不是必须                   | selection-only update，避免全文 decoration    | 待核对                                                                      |
| 输入规则                 | auto-pair、list、math、link/org 规则过多        | 每次 keypress 规则链过长           | 不是必须                   | 按字符前缀短路，避免 regex 全行/全文扫                  | 部分完成：auto-pair 只读 next char，org-env 只扫 changed textblock                 |
| block draft          | block 状态如果和主文档同步粗                        | 编辑块时触发多层状态更新                | 不是必须                   | 当前 block 局部状态，commit 时合并                 | 待核对                                                                      |
| undo history         | 大块变更进入 history                           | 粘贴/批量编辑内存涨                  | 编辑器必须有，但可控             | history 压缩，限制大 transaction               | 待设计                                                                      |
| CSS/layout           | widget、inline math、table、code block 布局复杂 | 打开后 layout/reflow 慢         | 不是 Markdown 必须         | contain/content-visibility，减少嵌套 DOM      | 部分完成：重块启用 content-visibility / contain                                   |
| Table                | 表格 widget 通常最重                           | 大表格编辑非常卡                    | 不是必须                   | 表格单独组件虚拟化，或退化为源码模式                       | 待设计                                                                      |
| Scroll sync/position | positions/recent 状态频繁写入                  | 滚动或打开文件 I/O 干扰              | 不是必须                   | debounce 写入，退出/空闲时写                      | 完成：cursor positions 和 recent localStorage 写入均延迟落盘，flush 时强制写             |
| 文件监听                 | workspace scan/watch 过宽                  | 大目录启动慢                      | 不是必须                   | ignore node_modules/dist，延迟建索引           | 待核对                                                                      |
| 初始化                  | 插件、snippets、Roam 套件一起启动                  | 冷启动慢                        | 不是必须                   | lazy plugin init，打开文件后再加载非关键功能           | 部分完成：snippet block 定位在大文档下按插入点/viewport window 查找                         |
| 打包体积                 | Mermaid/Prism/KaTeX 等全量进入主包              | 首屏加载慢                       | 不是必须                   | dynamic import，按需加载语言/图表                 | 部分完成：移除 vendor-diagrams 强制合包；Mermaid 仍有 593KB parser runtime chunk       |
| 主线程                  | 解析、索引、渲染都在 renderer 主线程                  | UI 卡死                       | 不是 Markdown 必须         | parser/index/highlight worker 化          | 部分完成：12k+ code highlight worker；parse/index worker 仍待协议设计                |
| 存储                   | recent/positions/cache 频繁 JSON 全量写       | 小文件无感，大状态文件卡                | 不是必须                   | 小型 KV/SQLite 或 append/update 写           | 待核对                                                                      |
| 测试缺口                 | 缺少 1MB/5MB/10MB 性能基准                     | 优化容易凭感觉                     | 不是必须                   | 加 perf fixture 和打开/输入/滚动指标               | 待补                                                                       |

## 优先级队列

| 优先级 | 优化项                                 | 预期收益   | 状态                                                       |
| --- | ----------------------------------- | ------ | -------------------------------------------------------- |
| P0  | 打开文件只解析可见区/按 block 分块               | 最大     | 收口：1MB+ 默认 source，输入 normalize 按 block 增量                |
| P0  | decoration/code/math 改成 block cache | 最大     | 收口：normalize block cache，decorations/code/math 窗口化/idle  |
| P0  | Roam refs/todos/backlinks 后台索引      | 很大     | 收口：refs/backlinks 文件缓存，todos 文件缓存，roam.db 后台同步           |
| P1  | Mermaid/KaTeX/code lazy render      | 很大     | 部分完成：math idle、diagram 可见后 render、code worker highlight  |
| P1  | 滚动虚拟化/DOM 数量控制                      | 很大     | 起步：viewport range 已接入扫描层；DOM 虚拟化未实现                      |
| P1  | 保存和 serialize 异步化                   | 中到大    | 部分完成：autosave idle 取 Markdown，keepalive 仍同步              |
| P2  | snippets/plugin lazy init           | 中      | 未开始                                                      |
| P2  | recent/positions debounce           | 中      | 完成                                                       |
| P2  | bundle dynamic import               | 中      | 部分完成：Mermaid 不再强制合成 vendor-diagrams，但仍有内部 parser 大 chunk |
| P3  | UI/CSS contain 优化                   | 中小，低风险 | 未开始                                                      |

## 维护方式

每次性能改动都按这个顺序维护：

1. 先在本页标记目标条目，确认它属于打开、输入、滚动、保存、初始化中的哪条关键路径。
2. 改代码时保持单点切入；不要把 parse、DOM、插件、存储一起改。
3. 改完在 `## 重构经验记录` 增加一条：动机、改动入口、风险、验证。
4. 有测试或基准就记录命令；没有基准也要明确“未验证性能数据”。
5. 如果优化只是移出关键路径，不要把状态写成“完成”，应写“部分完成”。

## 重构经验记录

### 2026-05-19: 输入 transaction 避免同步全量 serialize

- 动机：`Aaronnote/src/editor-api.ts` 在每次 rendered-mode doc transaction 后立刻 `serialize(doc)`，即使应用层 `onChange` 没有使用 Markdown 字符串。大文件输入会被保存/同步前的全量串行化拖住。
- 改动：新增 `currentRenderedMarkdown()` 作为按需读取入口；transaction 后只安排 idle prewarm，并把 `onChange` 改为 thunk。只有调用方真的需要 Markdown 时才 serialize。
- 风险：source 模式切换、保存、Markdown selection mapping 必须拿到最新 Markdown，所以这些入口仍然会按需同步 serialize。
- 维护经验：不要把 `lastSourceMarkdown` 当 rendered-mode authority；真实 authority 仍是 ProseMirror doc。`lastSourceMarkdown` 只是缓存和 source-mode 边界值。
- 状态：部分完成。保存仍需要整篇内容，但输入关键路径不再无条件做全量 serialize。

### 2026-05-19: Copilot debounce 阶段避免读取整篇 Markdown

- 动机：Copilot autoload 插件的 `onChange -> schedule -> eligible/requestKey` 会调用 `getMarkdown()` / `getMarkdownSelection()`，等于绕过 editor 层懒序列化。
- 改动：`plugin/copilot/index.ts` 在 debounce eligibility 和 request key 阶段改用 rendered selection、局部 cursor context；只在真正发起补全请求时读取 Markdown。
- 风险：request key 不再包含全文长度，改用文件、selection 和光标附近上下文判定请求是否过期。极端情况下远处文档变化但光标上下文不变，可能不会取消请求；补全插入仍由当前 selection 和后续校验保护。
- 维护经验：插件层要避免在高频 `onChange` 中调用 `getMarkdown()`。大文档下，`getMarkdown()` 是一个明确的昂贵边界，应该只出现在保存、导出、source-mode、真正请求上下文这些时刻。
- 状态：部分完成。已移出 debounce 关键路径；下一步是限制真正的请求 payload。

### 2026-05-19: Copilot 补全请求限制为光标附近窗口

- 动机：即使 debounce 阶段不再读整篇 Markdown，真正发起 Copilot inline 请求时仍把全文发送给服务端和 language server。大文件下这会放大内存、JSON encode/decode 和 LSP 文档同步成本。
- 改动：`plugin/copilot/index.ts` 新增 request window 构造，使用现有 `largeBufferThresholdKb` 作为最大请求上下文大小。全文超过阈值时，只发送光标前后窗口，并把 offset 改成窗口内 offset；trimming 也基于同一窗口内容完成。
- 风险：Copilot 在超大文档中看不到远离光标的上下文。这个取舍符合编辑性能优先目标，后续如需要更强语义，可改成“当前 block + 附近 heading + 最近 refs”的结构化上下文。
- 验证：新增 `large documents send only a cursor-local completion window` 测试，确认请求 body 不超过窗口大小、offset 映射正确、ghost text 仍可 trim。
- 维护经验：一旦给外部服务发送截断文本，所有返回 range 的解释都必须相对同一份截断文本处理；不要混用“全文 offset”和“窗口 range”。
- 状态：部分完成。仍需进一步把 request window 从纯字符窗口升级为 block/heading-aware 窗口。

### 2026-05-19: Floating TOC heading 列表按 doc 缓存

- 动机：`scheduleAssistUpdate()` 会在输入、selectionchange、scroll 后高频调用 `updateFloatingToc()`；旧实现每次都 `doc.descendants()` 扫一遍 heading。大文件滚动或移动光标时，这会把 TOC 变成全树扫描热点。
- 改动：`Aaronnote/aaronnote/floating-toc.ts` 缓存 heading list 和 signature，缓存键是 ProseMirror doc object identity。PM doc 不变时，TOC 更新只复用 heading list 并计算 active index。
- 风险：缓存依赖 ProseMirror doc immutable 语义；如果后续绕过 PM 直接 mutate doc，这个假设会失效，但当前架构不允许这种写法。
- 验证：`npm test` 和 `npm run build:aaronnote` 通过。缺口是还没有滚动 FPS / heading scan 次数的性能基准。
- 维护经验：对于 PM 派生索引，优先用 doc identity 做粗粒度缓存，再按 transaction/docChanged 收敛到更细的 block index；不要在 scroll/selection 高频路径直接 descendants 全树。
- 状态：部分完成。下一步可以把 heading index 做成 PM plugin state，只在 docChanged 时维护。

### 2026-05-19: 编辑态数学 widget 未缓存渲染移到 idle

- 动机：`decorations.ts` 创建 math widget 时会直接调用 Temml 渲染。多公式文档打开或重建 decorations 时，未缓存公式会把渲染成本压在 DOM/widget 创建路径上。
- 改动：`renderMathLazy()` 增加 `deferUntilIdle` 选项；缓存命中仍立即写入 HTML，未缓存且开启 defer 的公式先显示 TeX source，再在 idle callback 中渲染。`decorations.ts` 的 math widget 开启该选项，导出 HTML 和 math block preview 保持原来的即时渲染。
- 风险：编辑器里未缓存公式会短暂显示 TeX 文本，idle 后替换为渲染结果。导出路径不能使用 defer，因为导出 DOM 不一定连接到浏览器 viewport。
- 验证：`npm test` 和 `npm run build:aaronnote` 通过。
- 维护经验：公共 render helper 要保持默认同步语义，针对编辑器高频路径通过显式 option 开启懒渲染，避免影响 export/server 渲染。
- 状态：部分完成。下一步可以改成 viewport-aware idle queue，并限制单帧渲染数量。

### 2026-05-19: cursor positions localStorage 写入延迟落盘

- 动机：cursor position 虽然外层已有 debounce，但保存时仍同步写整份 positions JSON 到 localStorage。滚动/selection 后的状态保存不应阻塞当前交互帧。
- 改动：`Aaronnote/aaronnote/main.ts` 增加 `saveCursorPositionsLocalNow()` 和 `scheduleCursorPositionsLocalSave()`。普通 cursor 保存只更新内存 map 并延迟写 localStorage；`force`、`keepalive`、删除 note、merge server positions 和 `beforeunload` 仍立即落盘。
- 风险：普通非强制保存后、延迟落盘前如果进程崩溃，localStorage 可能落后一小段；server `/api/position` 持久化仍照常发出。
- 验证：`npm test` 和 `npm run build:aaronnote` 通过。
- 维护经验：交互态存储可以分成两层：内存 map 立即更新保证 UI 正确，磁盘/localStorage 写入按 idle/debounce 批处理；退出和跨文件切换边界再强制 flush。
- 状态：部分完成。后续可把 positions/recent 统一迁到小型 KV 或 append/update API。

### 2026-05-19: 输入辅助避免无意义文本读取和 decoration 重算

- 动机：auto-pair 输入开括号时读取光标到段落末尾的全部文本，但判断是否需要补全只依赖下一个字符；leave-line draft decoration 也会在无 doc/selection 变化的 transaction 上重算。
- 改动：`auto-pair.ts` 改为只用已读取的 `nextChar` 判断行尾/空白；`block-draft.ts` 在 `tr.docChanged || tr.selectionSet` 之外复用旧 decorations。
- 风险：auto-pair 行为应保持一致，因为旧 `shouldAutoPair(after)` 只检测首字符是否空白或空字符串；`nextChar` 等价表达这个条件。
- 验证：`npm test` 和 `npm run build:aaronnote` 通过。
- 维护经验：输入路径的 helper 不要为了判断一个字符读取整段余文；ProseMirror plugin state 的 `apply` 也应先检查 transaction 是否真的影响该派生状态。
- 状态：部分完成。后续继续核对 emoji/snippet/quick insert 的 prefix 扫描窗口。

### 2026-05-19: inline normalize 按 changed block 增量重算

- 动机：`normalize.ts` 的 plugin state 在每个 `docChanged` transaction 后都会 `doc.descendants()` 扫全文并对每个 textblock 运行 `parseInline`。大文件里输入一个字符也会触发全文件 inline parse plan 重建。
- 改动：把 plan 构造拆成 `appendBlockPlan()`；新增 dirty range -\> changed textblock 计算。普通 doc change 先把旧 block/delim/widget plan 通过 transaction mapping 映射到新文档，再只丢弃并重算受影响 textblock。mark-only transaction 没有位置变化时直接复用旧 plan。
- 风险：增量缓存依赖 ProseMirror mapping 和 doc immutable 语义；多 step transaction 必须把每一步的 changed range 映射到最终文档坐标。相邻 block 的重叠判断必须按半开区间处理，否则会误删未变 block 的 plan。
- 验证：新增 `normalizeInlinePlugin keeps unchanged adjacent block plans when incrementally parsing edits` 回归测试；`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：按 block 增量化时，不要只缓存 decoration 输出，也要缓存 appendTransaction 需要的内部 parse plan；否则后续 mark-sync 仍会把全文扫回来。先保证映射和失效边界正确，再考虑更细的 viewport/index 层。
- 状态：部分完成。输入后的 inline normalize 已避开全文件扫描；打开文件初始 parse、跨 block 大粘贴和 DOM 可视区渲染仍需要继续拆分。

### 2026-05-19: large-doc decorations 按窗口二分扫描

- 动机：`decorations.ts` 已有大文档 selection window，但实现仍从 delims/extras/widgets 数组开头扫描到窗口结束。光标在大文件后半段时，窗口模式仍会遍历大量窗口外装饰。
- 改动：normalize plan 输出在全量和增量路径都显式排序；decorations 在 large-doc 模式下用二分查找跳到窗口附近，只扫描 selection window 附近的 ranges/widgets。无 doc/selection 变化且非 image/normalize meta 的 transaction 直接复用旧 DecorationSet。
- 风险：窗口二分依赖 normalize 输出按位置排序，因此排序必须属于 normalize 输出契约。跨窗口边界的长 range 通过向前回退覆盖，避免漏掉从窗口前开始、延伸进窗口内的 decoration。
- 验证：`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：先把“窗口化”做成稳定的数组索引边界，再拆真正的 viewport observer / block cache。否则即使做了窗口过滤，数组前缀扫描仍会在大文件后半段变成隐藏的 O(n)。
- 状态：部分完成。大文档 decorations 创建不再从头扫到窗口；下一步是由 view plugin 提供真实 viewport range，而不是只围绕 selection。

### 2026-05-19: P0 大文件打开与重扫描收口

- 动机：P0 剩余风险集中在三个地方：1MB+ 文件首次进入 rendered mode 会同步 parse 并挂全 DOM；fenced code 高亮仍要在大文档里全树找 code\_block；image probe 和 agenda todo 会在大文件/多文件 workspace 下重复全量扫描。
- 改动：`main.ts` 对 1MB+ 且没有存储位置模式的文件默认进入 source mode，避免首开立即 rendered parse/DOM；`fenced-code.ts` 在大文档下改用 `nodesBetween(selection window)` 扫 code block，不再 `doc.descendants()` 全树找块；`image.ts` 在大文档下只 probe selection window 内图片；`aaronnote-server.mjs` 增加 todo per-file mtime/size cache，agenda 刷新只重读变更文件。
- 风险：超大文件首次打开会优先显示 source，需要用户切到 Preview 才进入完整 rendered mode；大文档里远离光标的图片错误状态会延后到光标靠近时 probe。这个取舍是为了把首开和输入关键路径上的全量扫描降下来。
- 验证：`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：P0 收口不等于完成最终架构。对于当前代码形态，先用 source fallback、selection window、per-file cache 把全量工作移出首开/输入路径；真正的 viewport 虚拟化、worker parser 和块级持久索引应作为下一轮架构改造。
- 状态：P0 收口完成。后续 P1 继续做真实 viewport range、DOM 虚拟化、worker 化和 bundle 拆分。

### 2026-05-19: autosave 序列化让到 idle

- 动机：输入 transaction 已不再同步 serialize，但 autosave 定时触发时仍会直接 `editor.getMarkdown()`。如果 idle prewarm 没来得及完成，保存会在当前任务里同步 serialize 大文档。
- 改动：`editor-api.ts` 增加 `getMarkdownAsync()`；rendered mode 未命中缓存时先等待 idle/timeout，再读取当前 Markdown。`main.ts` 的普通 autosave 改用异步入口；退出/keepalive 保存仍使用同步入口，保证关闭页面时尽量带上内容。
- 风险：普通 autosave 会多等待一次 idle，用户连续输入时旧 save 可能被新 save 取代；已有 `saveRequestSeq` 会丢弃 stale save。keepalive 不等待 idle，仍可能同步 serialize，这是退出边界的必要取舍。
- 验证：`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：保存不可能完全避免整篇内容，但可以把“何时 serialize”从交互任务挪到 idle 边界。异步读取必须和 stale save 序号配套，否则容易把旧内容覆盖新内容。
- 状态：部分完成。下一步是 patch-based save 或 worker serialize。

### 2026-05-19: 重块 layout containment 和 recent 延迟落盘

- 动机：code/table/math/org-env 等块的布局成本高，滚动时不应让离屏重块持续参与布局；recent notes 和 positions 类状态也不应在打开/滚动时频繁同步写 localStorage。
- 改动：`style.css` 给 ProseMirror 顶层 `pre/table/math-block/org-env-block` 加 `content-visibility: auto`、`contain` 和 intrinsic size；`main.ts` 将 recent notes localStorage 写入改为 debounce，`flushState()` 时强制落盘。
- 风险：`content-visibility` 只加在重块上，避免影响普通段落的 caret/selection；如果后续发现某类 NodeView 需要精确离屏测量，应单独排除该节点。
- 验证：`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：CSS containment 是虚拟化之前的低成本止血手段，只适合重块和离屏布局；状态写入则保持“内存立即更新、磁盘延迟落盘、退出强制 flush”的模式。
- 状态：部分完成。滚动虚拟化仍未实现，但布局和存储抖动已下降。

### 2026-05-19: 大代码块高亮迁到 Web Worker

- 动机：fenced code 已经按 selection window 扫描，但窗口内如果包含长代码块，`highlightCode()` 仍会在 renderer 主线程同步跑正则扫描，影响输入和滚动响应。
- 改动：新增 `code-highlight-worker.ts` 和 `code-highlight-async.ts`。12k 字符以下代码块继续同步高亮；12k+ 代码块先返回空高亮并发给 Web Worker，完成后通过 `code-highlight-ready` meta transaction 重建 fenced-code decorations。无 Worker 环境自动回退同步路径。
- 风险：大代码块第一次进入窗口时会短暂无高亮，worker 返回后补上；这是可接受的渐进渲染。worker 结果按文本缓存，避免滚动回来重复计算。
- 验证：`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过，并产出独立 `code-highlight-worker` chunk。
- 维护经验：多线程适合 CPU-bound、可用纯数据输入输出表达的任务。不要把小代码块也丢给 worker，否则通信和重绘开销会抵消收益；主线程保留小任务同步，worker 只处理会造成长任务的大块文本。
- 状态：部分完成。后续可把 Markdown parse/index 也做成 worker，但需要更清晰的增量协议。

### 2026-05-19: TOC/task/ref-def/org-env 从全文扫描推进到 block/window

- 动机：用户输入后仍有几个插件处在情况 A：TOC NodeView 重扫全 doc headings，task marker propagation 在任何 doc change 后扫全树，ref-def draft decorations 每次 decorations 读取都 `doc.descendants()`，org-env commit 插件甚至 selection transaction 也会扫全文。
- 改动：新增 `transaction-ranges.ts` 统一维护 changed range / changed textblock 计算；TOC 增加 `toc-heading-index` plugin state，普通输入只映射旧 headings 并重算 changed heading block；task propagation 在大文档下只扫描变化附近和当前 selection 的 list；ref-def draft decorations 改成 plugin state，并在大文档下只扫 selection window；org-env commit 只在 docChanged 后检查 changed textblock。
- 风险：这些优化把大文档远离光标的部分延后更新，尤其 ref-def placeholder 只有靠近 selection window 时才装饰。TOC heading index 和 org-env changed-block commit 依赖 transaction mapping 和 PM doc immutable 语义，后续跨 block 大粘贴需要继续靠测试覆盖。
- 验证：`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：情况 B 的关键是把“全局派生视图”拆成两类：确实全局的索引用 plugin state 增量维护；纯视觉装饰用 selection/viewport window 渐进呈现。不要在 `props.decorations()` 或 NodeView `update()` 里直接做 `doc.descendants()`。
- 状态：部分完成。输入路径又减少了四个全树扫描点；真正情况 C 还需要 PM DOM 层 viewport virtualization。

### 2026-05-19: Mermaid 强制合包拆除

- 动机：虽然 Mermaid 渲染入口已经是 `import("mermaid")`，Vite 配置仍把 `mermaid`、`d3-*`、`cytoscape` 强制打进单个 `vendor-diagrams` chunk，构建产物曾出现约 2.8MB 的图表 chunk。
- 改动：移除 `vite.aaronnote.config.ts` 中的 `vendor-diagrams` manual chunk 规则，让 rolldown 按 Mermaid 自身动态导入图谱拆分。
- 风险：构建仍有 Mermaid/langium parser runtime chunk 约 593KB，超过 500KB warning。继续压缩需要换更轻量的 Mermaid 加载策略或替换图表渲染器，而不是简单调高 warning 阈值。
- 验证：`npm run build:aaronnote` 通过；产物不再有 `vendor-diagrams`，但仍保留上述 Mermaid parser warning。
- 维护经验：bundle 优化要区分“首屏主包”和“懒加载大包”。强制 manual chunk 可能让动态依赖聚成更大的懒加载包；先看真实产物，再决定是否手动分包。
- 状态：部分完成。首屏和图表懒加载边界更清晰，Mermaid 内部大 runtime 待后续专项处理。

### 2026-05-19: 引入 viewport range，扫描层从 selection window 过渡到可见区域

- 动机：前一轮大文档优化主要围绕 selection window。它能保护输入位置，但滚动浏览大文件时，可见区域和光标可能不一致，code/ref-def/image/decorations 仍无法真正按 viewport 渐进更新。
- 改动：新增 `viewport.ts`，通过 `EditorView.posAtCoords()` 在 scroll/resize 后节流维护 `{ from, to }` 可见范围，并通过 `aaronnote-viewport-range` meta transaction 通知插件。`decorations.ts`、`fenced-code.ts`、`ref-def.ts`、`image.ts` 在大文档下优先使用 viewport range，缺失时回退 selection window。
- 风险：这是扫描层 viewport 化，不是 ProseMirror DOM 虚拟化。PM 仍会保留完整 rendered DOM；真正情况 C 还需要 NodeView/block renderer 层面的占位和回收机制。scroll meta transaction 已做 RAF 和最小变化阈值，避免滚动时每个像素都重建 decorations。
- 验证：`npm test` 通过 `45` 个测试文件、`571` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：先把“可见范围”做成独立 plugin state，再让重扫描消费者逐个接入。不要让每个 feature 自己监听 scroll，否则会形成多套节流和多次 DOM 坐标查询。
- 状态：P1 起步完成。下一步是真正 DOM virtualization：离屏 block 不挂 DOM 或退化为占位源码块。

### 2026-05-19: snippet 定位和 equation tag 改为局部/增量索引

- 动机：snippet 展开后寻找目标 `math_block` / `org_env_block` 会全篇 `doc.descendants()`；数学标签跳转和建议也会临时扫 math blocks 或读取整篇 Markdown。它们不是每个 keypress 都跑，但在大文档交互中仍会造成明显卡顿。
- 改动：`snippets.ts` 的目标块查找改为大文档下只查插入点和 viewport 附近窗口，小文档保留全量 fallback；新增 `equation-tags.ts` PM plugin，按 math block 增量维护 `\tag{...}` 的位置索引，rendered mode 下跳转和 tag 建议直接读索引。
- 风险：snippet 大文档 fallback 不再扫全篇，假设 snippet 转换后的目标块出现在插入点附近；这是该功能的真实语义。equation tag index 依赖 transaction mapping，已补基础回归测试。
- 验证：新增 `equation-tags.test.ts`；`npm test` 通过 `46` 个测试文件、`573` 个测试；`npm run build:aaronnote` 通过。
- 维护经验：面向命令/弹窗的功能也要避免把“全篇 Markdown 字符串”当默认数据源。只要结果可以表示成 `{ blockPos, from, to }`，优先做 PM plugin state 增量索引。
- 状态：部分完成。数学 tag 已索引化；后续可用同样方式处理 backlinks/todos 在 renderer 侧的局部查询。
