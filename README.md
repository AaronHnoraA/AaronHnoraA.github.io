# Org / Aaronnote Workspace

这个仓库主要服务两件事：

1. `Aaronnote/` 的开发、测试和打包。
2. 基于 Markdown `roam/` 数据源的发布、索引和维护。

这里的重点不是笔记内容本身，而是编辑器、发布链路、数据结构和维护流程。

## 文档入口

- [docs/README.md](/Users/hc/HC/Org/docs/README.md): 文档总览
- [docs/project.md](/Users/hc/HC/Org/docs/project.md): 项目结构、职责边界、维护约定
- [docs/codebase.md](/Users/hc/HC/Org/docs/codebase.md): 代码结构与关键模块
- [docs/status.md](/Users/hc/HC/Org/docs/status.md): 当前开发进度、测试状态、已知问题

## 仓库结构

- `Aaronnote/`: Typora 风格 Markdown 编辑器，含 Web/desktop/server 构建。
- `roam/`: Markdown 数据源；这里是事实来源，不是派生输出。
- `public/`: 发布后的站点产物。
- `bin/publish-site`: 从 `roam/` 生成 `public/` 的发布脚本。
- `agent/`: AI 检索和维护用的派生索引、压缩 wiki、维护脚本。
- `CV/`: 简历源码与构建产物，和主编辑器/发布链路基本独立。

## 常用命令

根目录：

```sh
make publish
make maintain
make build
```

`Aaronnote/` 目录：

```sh
npm install
npm test
npm run start
npm run build
```

## 当前状态

- `Aaronnote` 测试已在 2026-05-18 跑过一次：`39` 个测试文件、`550` 个测试全部通过。
- 发布链路当前仍以文件系统和派生数据为中心，不是中心化数据库应用。
- 已知限制和后续工作见 [docs/status.md](/Users/hc/HC/Org/docs/status.md)。