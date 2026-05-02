# Growth Log

2026-05-02：建立 AI 维护层。`agent/` 保存索引、压缩 wiki、只读 DB 工具和 Codex 提示词。`make llm` 负责维护提交；`make lookup` 做只读检索并回到 Org 原文核验。`maintain.py` 摘要截断后仍继续扫完整文件的标题与 id 链接，避免长笔记漏掉后文结构和关系。
