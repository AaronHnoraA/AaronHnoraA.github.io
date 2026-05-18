# Status

## 当前状态

截至 2026-05-18，这个仓库已经形成一条可工作的开发链路：

- `Aaronnote` 可开发、测试、构建
- 发布脚本可把 Markdown 数据源转换为静态站点
- AI 维护层可生成索引和压缩 wiki

最近两条明确的项目演进记录：

- 2026-05-02：AI 维护层改成“索引可常规刷新，工具改动需过门禁”
- 2026-05-18：事实来源切回 `roam/**/*.md`，分发层改读 Markdown meta 与相对链接

## 测试状态

我在 2026-05-18 本地执行过：

```sh
cd Aaronnote
npm test
```

结果：

- `39` 个测试文件通过
- `550` 个测试通过
- 无失败

这说明当前 `Aaronnote` 主干逻辑至少在现有规格覆盖下是稳定的。

## 进度判断

### 已经比较稳的部分

- Markdown -> ProseMirror -> Markdown 的主循环
- 主流 inline 语法与若干 Typora 风格扩展
- feature/spec/test 的组织方式
- 站点发布与增量跳过逻辑
- 私有内容密封逻辑

### 已完成但还值得留意的部分

- `public/js/data.js` 作为静态读模型已经可用，但字段一旦调整，会波及站点搜索、关系图和列表展示
- `agent/` 维护层已可用，但它本质上仍然依赖正确的源数据约定和维护纪律

### 还在演进中的部分

- 更完整的 CommonMark / Typora 边界兼容
- 数学、HTML、图表类能力的最终边界
- 编辑器样式与应用壳之间的进一步解耦

## 已知问题

下面这些更像“真实的已知 bug / 兼容性缺口”，不是单纯待开发功能。

1. 参考式链接定义 reload 后会丢失定义节点  
   现象：`[id]: url` 在 live entry 后可以提交成 block，但重新加载时定义节点会被 `markdown-it` 吃掉。  
   影响：参考式链接的 round-trip 和编辑体验不完整。

2. 链接扫描器还有边界情况  
   现象：`[text](url)` 的实现对嵌套 `]`、转义 `\]`、带空格 href 等情况不完整。  
   影响：复杂链接文本和部分合法 Markdown 可能不能稳定往返。

3. 三重强调 `***...***` / `___...___` 规则不完整  
   现象：当前只覆盖部分情况，完整 rule-of-three 还没实现。  
   影响：复杂嵌套 emphasis 的结果可能和 Typora / CommonMark 不一致。

4. 缩进代码块会被序列化成 fenced code  
   现象：4 空格缩进代码块可解析，但原始形态不保留。  
   影响：形态级 round-trip 不完整。

5. 反斜杠转义缺少输入期 UX  
   现象：结果能 round-trip，但输入过程没有完整的交互支持。  
   影响：编辑体验不够自然。

## 已知限制

这些是当前明确还没做完，应该按“限制”理解，不应误认为 bug。

1. HTML block / inline HTML 还未开放  
   原因：需要明确 sanitizer 策略。

2. 数学公式能力仍在收口  
   README 里仍标记为规划项，但仓库中已经有部分 math 相关测试和依赖；说明能力边界尚未统一对外说明。

3. diagram fences 仍未正式落定  
   Mermaid 依赖已在仓库里，但文档仍把它视为计划能力。

## 维护风险

1. `Aaronnote/README.md` 的能力矩阵和代码现状可能出现偏差  
   仓库里已有 math/mermaid 相关依赖与测试，但 README 的状态描述仍偏旧。

2. 发布链路是单脚本集中实现  
   `bin/publish-site` 体量已经不小，后续如果继续扩字段或加导出模式，维护成本会上升。

3. 数据模型变更会有多点联动  
   `roam` 元数据、发布脚本、`SITE_DATA`、前端消费逻辑、AI 索引都存在耦合。

## 后续建议

1. 先统一 `Aaronnote` 对外能力说明  
   把 README 里“planned / partial”的条目和真实代码状态重新对齐。

2. 给发布层补一份稳定的数据契约说明  
   至少固定 `SITE_DATA` 字段含义和兼容边界。

3. 把 `bin/publish-site` 拆出几个纯函数模块  
   比如 metadata、link graph、privacy sealing、render/export。

4. 明确数学与图表支持的产品边界  
   现在代码、依赖、README 三者之间还有轻微错位。
