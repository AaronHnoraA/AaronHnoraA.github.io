# 把 Tensor Isomorphism 归约到 Tensor Automorphism

- Source: [roam/project/UNSW/ISO(202603)/meeting.typ](../../../../../../roam/project/UNSW/ISO(202603)/meeting.typ)
- ID: `missing`
- Date: unknown
- Tags: None

## Summary

执行摘要 本文目标有两个：其一，给出从 Tensor Isomorphism（TI）到 Tensor Automorphism（TA）的一个可执行、可写入论文的证明框架；其二，把这件事拆成小组可并行推进的工作包。 本文的主线并不是“把 TI 直接压成一个最弱版本的 TA 判定问题”，而是先区分三类 oracle：返回整群、返回生成元、只做非平凡自同构判定。对前两类 oracle，我们给出完整的构造、正确性证明与复杂性分析；对第三类 oracle，我们说明一般情形下它不够强，除非再加刚性化（rigidification）或 promise 条件。 在结构上，本文先把输入张量化为 minimal support spaces 上的 concise / non-degenerate 形式，再构造 $ S := A ⊕ B $ 并引入 switching automorphism。核心命题是：当 $A, B$ 都在其 minimal...

## Structure

- 执行摘要
- 小组分工与合作流程
- 引言与优先文献
- 形式化定义与精确模型
- 主要定理与证明结构
- 完整证明与证明骨架
- 算法、归约与复杂性分析
- 需要修正的漏洞与代码验证计划
- 文中直接可引用的定理陈述草稿

## Links

- None

## Backlinks

- None
