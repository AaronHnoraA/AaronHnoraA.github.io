# Growth Log

2026-05-02：建立 AI 维护层。根入口 `agent.md` 指向 `agent/`；`index/` 负责可检索索引，`wiki/` 负责压缩阅读，`skill/` 保存 Codex 可调用工具，`db/` 链接 org-roam SQLite。`make llm` 被设计为调用 Codex 的长期维护入口，由提示词决定本次应做的索引、工具、日志和提交工作。
