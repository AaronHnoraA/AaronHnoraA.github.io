# Roam DB 增量同步 + Git 版本管理

## 目标

1. **仓库物理分离**：`roam/` 移出顶层 Org 仓，独立维护 git 历史；发布时不再带出私密笔记记录
2. **统一增量同步**：所有 `syncRoamDb` 调用默认走增量，避免全量重建；手动菜单 / 后端保存路径都受益
3. **自动版本管理**：每次 sync 成功后自动 `git add + commit`（不 push），笔记版本控制自然产生
4. **自我纠错**：增量 1/100 概率升级全量；启动时 ≥7 天未全量则后台补一次

---

## Phase 0：仓库物理分离（一次性操作）

### 目标状态

```
~/Documents/AaronNote/          ← 真实目录，自己的 git 仓
  .git/
  .gitignore               # roam.db / .aaronnote-sync-state.json
  daily/
  math/
  ...

/Users/hc/HC/Org/
  roam -> ~/Documents/AaronNote  ← symlink，对应用代码完全透明
  .gitignore                 # 含 `roam`（symlink 不入 Org 仓）
  .git/                      # orphan-reinit，历史从这个版本开始
```

### 操作脚本

脚本位于 `bin/split-roam-repo.sh`，含关键步骤前 `read -p` 二次确认。不会自动 `git push`，push 留给用户手动确认。

```bash
# 高层步骤（详见脚本）：
1. git add -A && git commit -m "pre-split snapshot"     # 在旧历史里留最后一个快照
2. mv roam ~/Documents/AaronNote                             # 物理迁移
3. ln -s ~/Documents/AaronNote ./roam                        # symlink 透明回来
4. cd ~/Documents/AaronNote && git init && git add -A && git commit "initial roam snapshot"
5. cd /Users/hc/HC/Org && echo 'roam' >> .gitignore
6. git checkout --orphan __fresh && git add -A && git commit "fresh start"
7. git branch -D master && git branch -m master
8. git gc --prune=now --aggressive
# 用户手动: git push --force origin master
```

### 注意事项

- `runtime.mjs` 的 `noteRoot` 解析到 `/Users/hc/HC/Org/roam`，symlink 透明，**无需改任何路径代码**
- `roam-git.mjs` 里的 git 命令用 `git -C noteRoot ...`；macOS git 跟随 symlink，实际操作 `~/Documents/AaronNote` 仓
- Org 仓 orphan 后远程 push 需要 `--force`（一次性）；之后 `make all` 的 `git push` 恢复正常

---

## 架构：syncRoamDb 调用流程

```
调用方
  │
  ├── 知道改了哪些文件（saveNote / createNode / move / delete）
  │      └─ 显式传 changedFiles → incrementalRoamDbStatements (fast path)
  │
  └── 不知道（手动菜单 / IPC roam-sync / 启动检查）
         └─ syncRoamDb 内部:
               ├── mode === "full"  OR  DB 不存在  OR  schema 版本变 → fullSync
               ├── changedRoamFilesSince(lastSyncedCommit)
               │      ├── len === 0 → early return（没变化）
               │      └── len > 0  → incrementalSync
               │                    ↑ 1/100 概率升级 fullSync
               └── commitRoam + writeSyncState（两种 sync 都做）
```

---

## 新模块：`Aaronnote/server/lib/roam-git.mjs`

```js
// 所有函数均 async，spawn git 进程，限制在 noteRoot（roam 仓）内操作

export async function headSha()
// git rev-parse HEAD

export async function changedRoamFilesSince(commit)
// git diff --name-only --diff-filter=AMRCD <commit> HEAD -- .
// + git status --porcelain --
// → 过滤 *.md/*.markdown，返回绝对路径数组

export async function commitRoam(message)
// git add '*.md' '**/*.md'
// git diff --cached --quiet || git commit -m <message>
// → 返回新 HEAD sha（无变化则返回当前 sha）

export async function fileHistory(absFile, limit = 20)
// git log --format='%H%x09%cI%x09%s' -n <limit> -- <relPath>
// → [{ sha, date, subject }]

export async function restoreFileFromCommit(absFile, sha)
// git show <sha>:<relPath>  写到 absFile（工作区，不修改 index）
```

---

## 状态文件：`roam/.aaronnote-sync-state.json`

```json
{
  "lastSyncedCommit": "<sha>",
  "lastSyncedAt": "2026-05-22T…",
  "lastFullAt": "2026-05-15T…",
  "dbSchemaVersion": 1
}
```

- 加入 `roam/.gitignore`（本地索引，不入版本控制）
- 读写在 `syncRoamDb` 内，helper 函数 `readSyncState()` / `writeSyncState(patch)`
- `dbSchemaVersion` 与 `CURRENT_DB_SCHEMA = 1` 比对，不一致时强制全量

---

## syncRoamDb 修改

### 新增签名选项

```js
syncRoamDb(notes?, options?)
options.mode:    "auto" (默认) | "full"
options.changedFiles: string[]  // 由调用方显式提供
```

### 全量升级条件（任一满足）

| 条件 | 触发源 |
|---|---|
| `mode === "full"` | 菜单 Force Full Refresh / IPC roam-sync-full |
| DB 文件不存在 | 首次 / 删除后 |
| `dbSchemaVersion !== CURRENT_DB_SCHEMA` | schema 迁移 |
| `!lastSyncedCommit`（无 state 文件） | 首次 |
| `Math.random() < 0.01` | 1/100 随机纠错 |
| 启动时 `Date.now() - lastFullAt > 7d` | 周期纠错（后台 30s 延迟执行） |

### 后端调用点修改

| 位置 | 变更 |
|---|---|
| `createNode`（runtime.mjs:3468） | 加 `changedFiles: [file]` |
| `saveNote` 后台分支（:3537） | 加 `changedFiles: [file]` |
| 保存索引同步（:3554） | 加 `changedFiles: [file]` |
| `moveNote` remove 分支（:3795） | 加 `changedFiles: [file]`（按路径删行） |

---

## 应用菜单变更（`desktop/main.mjs`）

在 Roam 子菜单 "Sync Roam DB" 下方加：

```js
{
  label: "Force Full Refresh Roam DB",
  click: () => runInWindow(dispatchCommandScript("sync-roamdb-full")),
},
```

底部（separator 之后）加：

```js
{
  label: "Restore Current File from Commit…",
  click: () => runInWindow(dispatchCommandScript("roam-restore-file-version")),
},
```

两个命令在 `aaronnote/main.ts` 注册，对应 IPC：
- `aaronnote:api:notes:roam-sync-full` → `syncRoamDb(null, { mode: "full" })`
- `aaronnote:api:roam-tools:restore-file-version` → `fileHistory()` + `restoreFileFromCommit()` + 增量 sync

---

## 验证清单

- [ ] Phase 0 脚本跑完：`ls -la Org/roam` 是 symlink；`git -C ~/Documents/AaronNote log` = 1 commit
- [ ] 打开 Aaronnote，正常读写笔记（路径透明）
- [ ] 改一篇笔记 → 保存 → 控制台见 `[roam-sync] incremental 1 file`；DB 更新正确
- [ ] 手动 "Sync Roam DB"：无改动时 early return；有改动时 incremental + `git log -1` 见 "roam sync: …"
- [ ] "Force Full Refresh Roam DB"：全量重建 + `lastFullAt` 更新
- [ ] 改 `lastFullAt` 为 8 天前重启：30s 后见后台全量日志
- [ ] 改 state 文件 `dbSchemaVersion` → 不一致 → 下次 sync 强制全量
- [ ] Restore：改笔记 2 次 commit → 菜单 Restore → 选旧版 → 文件内容回退，DB 同步
