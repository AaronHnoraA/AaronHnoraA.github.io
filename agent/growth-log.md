# Growth Log

2026-05-02：建立 AI 维护层。`agent/` 保存索引、压缩 wiki、只读 DB 工具和 Codex 提示词。`make llm` 负责长期维护与提交；`make lookup` 打开交互式只读检索，会先用快速索引定位，但精确定义、公式和关系必须回到 Org 原文核验。
