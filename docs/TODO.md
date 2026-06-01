# TODO 
这个页面主要用来记录需要开发的特性, bug等需求
---
## 功能需求
- slide/assgin kind


## Bugs

- [x] new file UI选择tag后生成文件等时候不会同步选择的tag
  （regular 笔记现在也写入 #+begin meta 块的 tags，但不注入 roam id）
- [x] '''中仍然渲染md（代码围栏内的 inline math/wikilink/CJK/高亮已排除；导出 HTML 本就受 markdown-it 保护）
- [x] $$中也仍然渲染md（block math 区间在编辑器与导出中均受保护）
- [ ] table中snippet 公式预览等 (但是有公式渲染), table内部应该要和外部表现一致
  （$公式$ / `代码` / **加粗** 已与正文一致；唯一差异是内联 @@todo/@@tag 在单元格里仍是原始文本，暂不做）
- [x] 光标vim移动不符合预期 select mode下尤为明显（visual 模式选择方向已保留，可向锚点反向扩展）
