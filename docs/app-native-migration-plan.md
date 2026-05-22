# Aaronnote: 去 C/S 化 · 走 App-Native

## Context

Aaronnote 的迁移起点是 **Electron 壳 + 本地 Node HTTP server
(127.0.0.1:5179)**，但实际场景只有"单人单机单进程"。HTTP 层只是历史抽象：

- 每次 save / open / list / rename 都走 `fetch('/api/...')` HTTP round-trip + JSON 序列化
- 拖拽资源必须 base64 编码 POST
- 发布管线（`bin/publish-site` → `public/`）早已与运行时 server 完全独立
- 插件 SPI 曾硬编码 `/api/copilot/*`、`/api/roamlookup/*`
- 多窗口共享状态通过 server 单点
- 旧测试曾直接覆盖 HTTP API；核心 server 行为测试现已改为直接 import server/lib 函数，插件测试 mock native bridge

**目标**：把 HTTP 边界整体换成 Electron IPC + 主进程直 fs，同时给原本由 HTTP server 提供的静态资源（媒体、字体、note-kind、roam-tools）一条 native 通路。

**底线**：每个 Phase 4 native 改造都必须 **性能净正或中性**，不为"看起来更 native"加常驻负担。

---

## 旧依赖摸底（不能漏的几条线）

仓库实际有 **三类** 来自 server 的运行时依赖，不只是 `/api/*`：

| 类别 | 渲染端使用方式 | 文件位置 |
|---|---|---|
| ① JSON API（~40 个端点） | `fetch('/api/...')` | 旧 `routeApi` HTTP 分发 |
| ② 媒体 / 资源 | `<img src="aaronnote-asset://media?...">`（动态构造） | `aaronnote/main.ts` `resolveAssetUrl` |
| ③ 字体 / note-kind / roam-tools | CSS `@font-face`、`<link href>`、`<script src>`、动态 `import()` | `aaronnote/style.css:12`、`aaronnote/main.ts:2799-2805`、`aaronnote/graph-panel.ts:97-100` |

① 可换 IPC；② / ③ 无法走 IPC（它们由浏览器 / Webview 直接发起 URL 加载），必须改走 **Electron 自定义 protocol**（`protocol.handle("aaronnote-asset:", ...)`）或 `file://`。这是原 draft 最大的缺口，本计划补齐。

还有一处隐含依赖：renderer 自身的 HTML/CSS/JS 也曾来自 server
（packaged 时是 `staticDir`，dev 时是 Vite middleware）。迁移后 packaged
窗口改走 `loadFile(staticDir/index.html)`，dev 模式单独跑 Vite。

`flushSaveKeepalive` 当前用 `navigator.sendBeacon` 和 `fetch keepalive` 保证关窗时 save 落盘（`aaronnote/main.ts:5601-5694`）。Electron 已经在 `desktop/main.mjs:69-75` 通过 `flushRendererState` 在关窗前 `executeJavaScript` 等渲染端 flush，所以 IPC 化之后改成普通 `await ipc.save(...)` 就行，beacon 路径整体可删。

`desktop/main.mjs` 现有的菜单（行 390-650）**已经** 通过 `dispatchCommandScript` 接上了渲染端 command palette；4b 真正缺的是 `globalShortcut`。

---

## 总体架构（前 / 后对比）

```
迁移前：
┌──────────┐   HTTP /api/*    ┌────────────────┐  fs
│ renderer │ ───────────────▶ │  Node HTTP     │ ──▶ disk
│  (BV)    │ ◀─── img/font ── │  server :5179  │
└──────────┘ ◀── /kinds JS ── │  (vite middl.) │
                              │  fs.watch      │
                              └────────────────┘

目标：
┌──────────┐   ipcRenderer    ┌────────────────┐  fs
│ renderer │ ───────────────▶ │  Electron main │ ──▶ disk
│  (BV)    │ ◀── via lib/* ── │  (libs direct) │
│          │                  │                │
│  <img>   │  aaronnote-asset │ protocol.handle│
│  @font   │ ────URL────────▶ │ (custom scheme)│
│  /kinds  │                  │                │
└──────────┘                  └────────────────┘
```

---

## 阶段拆分（每段可独立 ship、可回滚）

### Phase 0 · 抽象 API 客户端（零行为变化）

把渲染端 26+ 处 `fetch('/api/*')` 全部收口到一个客户端，后面切 IPC 只改这一个文件。

- 新建 `Aaronnote/aaronnote/api-client.ts`，按 server lib 的 6 个域分组导出类型化方法：
  - `api.notes.{bootstrap, openFile, list, save, forceSave, createNode, createFolder, delete, pathSuggestions}`
  - `api.fs.{rename, move, duplicate, trash}`
  - `api.assets.{store, listOrphans, trashOrphans}`
  - `api.meta.{add, remove, tag}`
  - `api.session.{recent, touchRecent, positions, touchPosition}`
  - `api.index.{templates, snippets, plugins, pluginOverrides, todos, tags, graph, roamDbSync}`
  - `api.copilot.{status, inline, shown, accept, signIn, signOut, quota, log}`
  - `api.roamlookup.{status, start, query, close}`
- 内部仍调 `fetch`；签名严格对齐现有 server 的请求/响应 JSON 形状（不重新设计协议）。
- 替换调用点：`Aaronnote/aaronnote/main.ts`（26 处）、`Aaronnote/aaronnote/asset-cleanup.ts:112,139`、`Aaronnote/aaronnote/agenda.ts:155-156`
- 插件 SPI：本阶段不动 `plugin/copilot/index.ts:81-98`、`plugin/roamlookup/index.ts:32-41`（避免外部 surface 提前破坏）。Phase 3 一并处理。
- **perf 影响**：0（结构改造）
- **验证**：`npm test` 全绿；手动 open / edit / save / rename / drag-insert image / copilot 一轮。

### Phase 1 · server 模块化（HTTP 行为不变）

把旧 service monolith 按功能拆成可单独 import 的 lib，HTTP handler
先退化为薄壳。这一阶段后，每个 endpoint 都对应一个纯函数。

- 新建 `Aaronnote/server/lib/`：
  - `save.mjs` — `saveNote({file, content, mode, clientId, seq, baseMtimeMs, force, refresh})`，封装 `enqueueSaveWrite` + `atomicWriteFile` + dirty bookkeeping
  - `index.mjs` — `notesIndexPayload`、`scanNotes`、`graphPayload`、`tagIndexPayload`、`scanTodos`、`pathSuggestionsForFile`（已存在的内部函数，搬过去）
  - `assets.mjs` — `storeAsset`、`scanUnusedAssets`、`trashUnusedAssets`、`assetRefsFromContent`（行 349、`/api/assets/orphans` 路由对应函数）
  - `fs-ops.mjs` — `createNode`、`createFolder`、`renameManagedPath`、`moveManagedPath`、`duplicateManagedFile`、`trashManagedPath`、`deleteNote`
  - `session.mjs` — `readRecentNotes`、`touchRecentNote`、`readCursorPositions`、`touchCursorPosition`
  - `meta.mjs` — `updateCurrentNoteMeta` 的三个分支
  - `copilot.mjs` — `handleCopilotRequest`（含 `CopilotLspClient`）
  - `roamlookup.mjs` — `handleRoamLookupRequest`（含 session）
  - `media.mjs` — `resolveMediaFile` + `fileContentType`（被 protocol handler 复用）
  - `state.mjs` — 共享单例（`noteRoot`、`pluginRoot`、`workspaceRoot`、`noteCache` 等），提供 `configure({root, workspaceRoot, pluginRoot})` 初始化函数
- `routeApi` 改写为薄路由：每个分支只做 `sendJson(res, 200, await lib.fn(body))`，错误集中处理保持现状。
- **不改的内部行为**：dirty 标记、conflict 检测、`scheduleRoamDbSync`，全部跟着函数搬。
- **perf 影响**：0（重构）
- **验证**：HTTP 行为完全不变；`npm test` 全绿（server tests 仍打 HTTP）。

### Phase 2 · 建 IPC 桥 + 自定义 protocol（HTTP 与 IPC 双轨）

让渲染端的 `api-client` 既能走 HTTP 也能走 IPC；Electron 启动时默认 IPC，HTTP 留作回退。同步引入自定义 protocol 解决静态资源依赖。

**2026-05-21 进度同步**：

- 已在 `desktop/main.mjs` 注册 `aaronnote:api:*` IPC handlers，覆盖 notes / assets / session / plugins / fs / meta / copilot / roamlookup；handler 直接调用 `server/lib/*` 导出。
- 已在 `desktop/preload.cjs` 暴露 `window.aaronnoteApi`；`aaronnote/api-client.ts` 已改为 native-only，缺失 bridge 会显式报错。
- 已注册 `aaronnote-asset://` 自定义 protocol，覆盖 `media`、`font`、`kinds`、`roam-tools` 四类资源。
- 已将 renderer 资源入口切 native：`resolveAssetUrl()`、note-kind CSS/JS、graph panel `knowledge.js` / `graph.js`；字体因 Vite 会打包 CSS `url(...)`，改为 Electron 运行时注入 `aaronnote-asset://font/...`。
- 已将 `plugin/copilot` 与 `plugin/roamlookup` 改为 native bridge；Phase 3 后 bridge 不存在时直接报错，不再回退 `/api/*` fetch。
- 已将 renderer 自身加载从 `serverHandle.url` 切到 `AARONNOTE_DEV_VITE_URL` 或 `loadFile(dist/aaronnote/index.html)`。
- 已将 `Open Markdown...`、macOS `open-file`、second-instance 文件打开、Reload Current Note 从整页 HTTP reload 改为 `webContents.send("aaronnote:open-file", file)`，preload 转发给 renderer 后复用 `openStandaloneFile()`。
- 已将 copilot / roamlookup 插件测试 mock 从 fetch 切到 `window.aaronnoteApi`，覆盖 native bridge 优先路径。
- 已新增 `tests/api-client.test.ts` 覆盖 api-client native-first：IPC save conflict、`ok:false` 错误抛出、keepalive/session fire-and-forget 均不触发 fetch。
- Electron GUI smoke 首次暴露 `loadFile()` 空白页：原因是 `vite.aaronnote.config.ts` production `base: "/"` 生成 `/assets/...`，`file://` 下无法加载；已改为 build 使用 `base: "./"`，dev 仍为 `/`。
- 已将 Electron 默认 zoom 调到 `+2.0`（等同四次 Zoom In，沿用现有 `ZOOM_STEP=0.5`），解决 native 窗口默认 UI 偏小；Reset Zoom 仍回到 `0`。
- 已完成 Phase 4a 的性能净正资源路径：新增 `storeAssetFromPath()`，Electron 拖拽/选取文件若提供原生 `File.path` 则主进程直接 `copyFile()` 到附件目录，跳过 renderer `arrayBuffer -> base64 -> JSON`；无 path 的粘贴路径仍保留原 base64 fallback。
- 已补 Phase 4a 的 Shell bridge：preload 暴露 `api.shell.showInFolder/openPath`，文件系统面板在 native bridge 存在时给 note / file / folder 预览增加 `Reveal` 动作。
- 已补 Phase 4a 的事件型错误通知：PDF publish/export 和 unused asset 批量 trash 报错时由 Electron main 发通知；成功和取消不弹，不给 renderer 增加常驻 OS bridge。
- 已落 Phase 4b 的最小全局快捷键：`CommandOrControl+Shift+N` 在 app 未聚焦时唤起 / 聚焦主窗口并 dispatch `new-markdown-note`。
- Phase 4c 的外部改动自动刷新本轮不纳入：native app 不常驻 `fs.watch`；外部改动仍由 save conflict 检测和显式 reload 处理。
- 已完成 Phase 3：Electron desktop 不再 import 或启动 `startAaronnoteServer()`；桌面运行时已不依赖 `127.0.0.1` HTTP server。历史 `server/aaronnote-server.mjs` 已删除，service implementation 位于 `server/lib/runtime.mjs`，domain exports 位于 `server/lib/*`。
- 已清理 desktop 构建入口：删除 `npm start` 的 HTTP server 脚本，`build:desktop` 检查 `desktop/main.mjs`、`desktop/preload.cjs` 和 `server/lib/runtime.mjs`。
- 已将 renderer `api-client.ts` 改为 native-only，删除所有 `fetch` / `sendBeacon` / `keepalive` fallback；缺失 IPC bridge 时显式报错。
- 已将 ranger filesystem 与 metadata 更新从旧 `/api/fs/*`、`/api/meta/*` action 字符串收成显式 native methods：`fs.rename/move/duplicate/trash` 与 `meta.add/remove/tag`。
- `npm run build:desktop` 已通过并输出 `release/mac-arm64/AaronNote.app`；早先一次 `corrupted Electron dist` 未复现。
- 已将 server tests 从旧 HTTP/server entry 改为 `server/lib/*` direct calls；当前测试中不再有 `startAaronnoteServer` 或 `server/aaronnote-server.mjs` 依赖。
- 已清理渲染端资源 fallback：`resolveAssetUrl()` 固定生成 `aaronnote-asset://media/...`；graph panel 的 `knowledge.js` / `graph.js` 固定走 `aaronnote-asset://roam-tools`。
- 已完成代码侧 native runtime 切换；手动 smoke 仍覆盖 native URL、图片、字体、note-kind、graph panel。

**IPC 桥**：

- `Aaronnote/desktop/main.mjs`：在 `app.whenReady` 早期 `configure(state)` 一次，然后注册 IPC handlers，按 lib 函数 1:1 映射：
  ```
  ipcMain.handle('aaronnote:api:notes:save', (_e, body) => save.saveNote(body))
  ipcMain.handle('aaronnote:api:notes:openFile', (_e, file) => index.readNote(file))
  ...
  ```
  错误同样转为 `{ ok: false, message }`，与 HTTP 路径形状一致。
- `Aaronnote/desktop/preload.cjs`：扩展 contextBridge 暴露 `window.aaronnoteApi.<domain>.<method>(...)`。
- `api-client.ts`：检测 `window.aaronnoteApi` 存在则走 IPC，否则 fetch。**只改这一文件**。

**自定义 protocol（关键补充）**：

注册一个 scheme `aaronnote-asset://` 取代 HTTP server 的静态资源职责。这条线必须在 Phase 2 落，否则 Phase 3 拆 HTTP 就会断图、断字体、断 note-kind。

- `desktop/main.mjs` 在 `app.whenReady` 之前 `protocol.registerSchemesAsPrivileged([{ scheme: "aaronnote-asset", privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true, bypassCSP: true } }])`
- `app.whenReady` 之后 `protocol.handle("aaronnote-asset", (request) => ...)` 处理三种 host：
  - `aaronnote-asset://media/?file=...&base=...` → `media.resolveMediaFile(file, base)` → `net.fetch(pathToFileURL(resolved))`
  - `aaronnote-asset://font/<name>` → 走 `liuGongQuanFontCandidates` 解析
  - `aaronnote-asset://kinds/<rest>` → `resolve(workspaceRoot, "kinds", rest)` + `inside` 边界校验
  - `aaronnote-asset://roam-tools/knowledge.js|graph.js` → `join(publishJsDir, name)`
- 渲染端三处改写（也只是字符串改前缀）：
  - `aaronnote/style.css:12` 的 `/aaronnote-fonts/...` → `aaronnote-asset://font/FZLiuGongQuanKaiShuJF.ttf`
  - `aaronnote/main.ts` 的 `resolveAssetUrl` 把本地媒体拼装成 `aaronnote-asset://media/?file=...&base=...`
  - `aaronnote/main.ts:2799-2805` 的 `/kinds/...` 改成 `aaronnote-asset://kinds/...`
  - `aaronnote/graph-panel.ts:98-99` 的 `/roam-tools/...` 改成 `aaronnote-asset://roam-tools/...`
- `/roam-tools/data.js` 在渲染端从未被加载（graph-panel 直接
  `window.SITE_DATA = ...` 客户端构造；published site 仍有独立数据输出），不必迁。

**HTML / dev 服务器（renderer 自己怎么加载）**：

- Packaged：`createWindow` 改为 `win.loadFile(join(staticDir, "index.html"))`。`appBaseUrl` 检测（`desktop/main.mjs:137-148`）改为基于 `file://` + `aaronnote-asset://` 前缀，外链仍 `shell.openExternal`。
- Dev：在 `main.mjs` 启动时如果 `process.env.AARONNOTE_DEV_VITE_URL` 存在，则 `loadURL(it)`；否则 `loadFile(staticDir/index.html)`。`npm run dev` 用 vite-plus 单跑（已存在的 `npm run start:vite` 脚本），不再通过 server middleware。

**bootstrap 路径**：

- 当前 `bootstrapStandalone`（`aaronnote/main.ts:5861-5877`）依赖 `/api/bootstrap` 拿初始 file + index。改为 IPC 时，初始 file 通过 `process.argv` 已经传到主进程；preload 暴露 `window.aaronnoteApi.bootstrap()`，内部主进程调用 `index.bootstrapPayload(initialFile)`。文件切换从 `win.loadURL(urlForFile(...))`（行 173、385、206）改为 `mainWindow.webContents.send("aaronnote:open-file", resolved)`，渲染端监听并复用 `applyOpen`，不再触发 reload。

**flushSaveKeepalive 简化**：

- `aaronnote/main.ts:5601-5694` 的 `sendBeaconJson` / `keepalive: true` 整体可删；改成 `await api.notes.save(payload)`。`desktop/main.mjs:69-75` 的 `flushRendererState` 已经在关窗前 `executeJavaScript('flush-state')` 等待渲染端 flush，IPC 是同步的，自然落盘。这里也是 perf 净正。

**插件 SPI（copilot / roamlookup）**：

- `plugin/copilot/index.ts:81-98` 的 `postJson/getJson` 改为 `window.aaronnoteApi.copilot.<action>(body)`，签名与现有 JSON 一致。
- `plugin/roamlookup/index.ts:32-41` 同样。
- 测试 mock（`tests/copilot-plugin.test.ts:62-79` 等）从覆盖 `globalThis.fetch` 改为 `globalThis.window.aaronnoteApi = { copilot: { inline: async () => ... } }`。

- **perf 影响**：+（save / open / fs 等高频路径从 HTTP 落到 IPC，省掉 HTTP parse + socket 拷贝；keepalive 路径删除）
- **验证**：
  - tap log 确认 IPC handler 被命中；自动化跑 save × 100 对比 HTTP vs IPC 的 p50/p95
  - 手动：图片显示（`aaronnote-asset://media`）、字体加载（DevTools network 看 ttf 状态）、note-kind CSS 切换、graph panel 弹出（roam-tools js 加载）
  - `npm test` 全绿（server tests 走 HTTP，仍可用）

### Phase 3 · 拆 HTTP server

确认 Phase 2 在日常使用 1-2 周稳定无回滚后再做。

- `desktop/main.mjs`：删除 `startAaronnoteServer` 调用、`serverHandle`、`urlForFile`、所有基于 `serverHandle.url` 的 `loadURL` 分支（行 9、28、136-148、173-176、180-183、201-209、217-222、298、380-388、672-681、684、697）。
- `api-client.ts`：删 fetch 分支，只留 IPC。
- `server/aaronnote-server.mjs`：删除；service implementation 迁到 `server/lib/runtime.mjs`，domain exports 留在 `server/lib/*`。
- `Aaronnote/package.json`：删 `start` 脚本；`build:desktop` 检查 native main/preload/runtime；`start:vite` 保留用于 dev。
- 测试改造（已完成）：
  - `tests/server-save.test.ts`、`tests/server-standalone.test.ts`、`tests/server-refs.test.ts`：从 `startTestServer` + `jsonRequest` 改为直接 `import` lib 函数 + `configure({root, workspaceRoot, pluginRoot})` + 直接调用。期望值不变。
  - `tests/copilot-plugin.test.ts`：mock 从 `globalThis.fetch` 改为 `globalThis.window.aaronnoteApi.copilot`（参考上一阶段已有的代码改造）。
- **perf 影响**：++（启动少 1 个 HTTP server；端口冲突消除；状态拓扑简化）
- **验证**：`lsof -i :5179` 应为空；完整 smoke（编辑 / 保存 / 检索 / copilot inline / publish PDF / 多窗口）跑通；测试套耗时下降。

### Phase 4 · Native 增强（按 perf-first 排序）

只做以下三项，每项性能净正或中性。SQLite 索引、主进程 draft、Dock badge 等本轮不做。

#### 4a. 原生资源插入 + Shell 集成 + OS 通知 — perf 影响 **+**

- 资源插入（拖拽 / 选文件）：渲染端拿到 `File` 时如果 `file.path` 存在（Electron 给原生 path）→ 走新 IPC `api.assets.storeFromPath(file.path)`，主进程 `fs.copyFile` 到 `targetDir`（沿用 `storeAsset` 的目录/重名/sanitize 逻辑，新增一个 `from-path` 入口）。**直接砍掉 `fileToBase64`**（`aaronnote/main.ts:1444-1454`）这条 base64 编码 + JSON 大 body 的最贵旧路径。粘贴板路径（`file.path` 为空）保留现有 buffer 通路。
- Shell：现有 `shell.openPath` / `openExternal` 已在 main.mjs 用到；扩展给渲染端：`api.shell.showInFolder(file)`、`api.shell.openPath(file)`。
- OS 通知：仅给长任务错误用（publish/export 失败、批量 trash 失败）。Electron `new Notification({...}).show()`，事件触发，无常驻。

#### 4b. globalShortcut — perf 影响 **0**

注意：macOS 菜单已经在 `desktop/main.mjs:390-650` 接好命令，**不需要再做**。这一项专门做全局快捷键。

- `globalShortcut.register("CommandOrControl+Shift+N", () => quickCapture())` —— quickCapture 唤起 / 聚焦主窗口并 dispatch `new-markdown-note` 命令。OS 内核钩子，无每秒成本。

#### 4c. 外部改动自动刷新 — 本轮不做

当前功能边界不需要为了外部编辑常驻 watcher。AaronNote 自己的 save / rename /
move / trash 会显式 dirty 索引；外部写入继续依赖 save conflict 检测和用户显式
reload，避免 desktop runtime 常开 `fs.watch`。

---

## 关键文件改动清单

**新增**
- `Aaronnote/aaronnote/api-client.ts`
- `Aaronnote/server/lib/{runtime,save,index,assets,fs-ops,session,meta,copilot,roamlookup,media,state}.mjs`

**修改（按 phase 顺序）**
- Phase 0：`aaronnote/main.ts`、`aaronnote/asset-cleanup.ts`、`aaronnote/agenda.ts`（26+3 处 fetch → `api.*`）
- Phase 1：service code 抽到 `server/lib/*`
- Phase 2：`desktop/main.mjs`（IPC handlers + custom protocol + loadFile 切换 + webContents.send open-file）、`desktop/preload.cjs`（暴露 `aaronnoteApi`）、`api-client.ts`（IPC 双轨）、`aaronnote/style.css`、`aaronnote/main.ts`（`resolveAssetUrl` + `/kinds/`）、`aaronnote/graph-panel.ts`、`plugin/copilot/index.ts:81-98`、`plugin/roamlookup/index.ts:32-41`、`tests/copilot-plugin.test.ts`
- Phase 3：`desktop/main.mjs`（删 server）、`server/aaronnote-server.mjs`（删除，由 lib 取代）、`api-client.ts`（删 fetch 分支）、server tests（legacy entry → domain lib import）、`package.json`
- Phase 4：`desktop/main.mjs`（globalShortcut + native asset import）、`aaronnote/main.ts`（`insertFiles` 走原生 path 分支）

**不动**
- `bin/publish-site`、`Aaronnote/scripts/render-html.mjs`、`Aaronnote/src/render-html.ts`、`public/` 整个发布管线
- `Aaronnote/src/cm6/**`（编辑器内部）
- 测试期望值（只换调用方式）

---

## 端到端验证

每 phase 都跑：

1. `npm test`（Phase 3 之后 server tests 走 import，时间应下降）
2. 手动 smoke：
   - 启动 → 看到 bootstrap notes / scratch
   - 打开已有 note → 编辑 → `Cmd+S` 保存 → 关窗 → 重开见持久化
   - 拖入图片 → 显示（`aaronnote-asset://media/...`）
   - DevTools Network 看 `FZLiuGongQuanKaiShuJF.ttf` 200（aaronnote-asset 或 file://）
   - 切换 note-kind → CSS / JS 加载（`aaronnote-asset://kinds/...`）
   - 打开 graph panel → d3 + knowledge.js + graph.js 都加载（roam-tools 经自定义 protocol）
   - Copilot inline 触发 → 走 IPC 而非 app HTTP fetch
   - Publish PDF → `bin/publish-site` 正常输出
3. 性能基线（Phase 2 / Phase 3）：
   - 自动化脚本 save × 100，记 p50 / p95；Phase 2 应比 Phase 0 base 下降；Phase 3 进一步下降
   - 启动到首帧时间（main.mjs 加 perf hook 打 console）
4. 边界检查（Phase 2 / Phase 3）：
   - `lsof -i :5179` 在 Phase 3 后为空

## 风险与回滚

- Phase 2 是安全网：IPC 出问题 → `api-client.ts` 一行 flag 切回 fetch；HTTP server 仍在跑
- Phase 3 必须在 Phase 2 稳定 1-2 周后才动
- 自定义 protocol 注册失败会导致全黑：在 `app.whenReady` 之前 `registerSchemesAsPrivileged`，handle 内部包 try/catch + 失败时 `console.error` 不抛
