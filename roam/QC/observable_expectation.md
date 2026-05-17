#+begin meta
id: 20260128T000000-observable-expectation
title: Observable & Expectation
date: 2026-01-28
tags: quantum, observable, expectation, operator
source: roam/QC/observable\_expectation.md
#+end meta

# Observable & Expectation

# 1. 可观测量为什么是厄米算符([Hermitian Matrix](../math/hermitian_matrix.md))

在量子力学中：

- 每一个物理可观测量 A
- 都对应一个厄米算符 Â, 在希尔伯特空间([Hilbert Space](../math/hilbert_space.md))内.

原因有两个：

1. 本征值必须是实数（实验结果）
2. 本征态可以正交分解（概率解释）

# 2. 期望值的物理意义

设系统处于态 |ψ⟩，
对同一个系统做大量重复实验：

每一次测量得到一个本征值 a\_n
出现概率为 p\_n

统计平均值是：
⟨A⟩ = ∑ a\_n p\_n

谱定理告诉我们：

- p\_n = |⟨a\_n|ψ⟩|²

代入并整理，得到一个*极其紧凑的表达式*：

⟨A⟩ = ⟨ψ| Â |ψ⟩

这不是“定义”，
而是从统计平均 *严格推导出来的结果*。

# 3. 谱理论的核心结论

对任意厄米算符 A：

- 所有可能测量结果 ∈ A 的谱
- 离散谱 → 本征值
- 连续谱 → 广义本征态

如果将 |ψ⟩ 在本征基中展开：

```typst
#table(
  columns: 2,
  [ψ⟩ = ∑ c_n], [a_n⟩],
)
```

那么：

- |c\_n|² = 测到 a\_n 的概率

量子力学的概率性，
并不是“测量扰动”，
而是状态在谱分解中的 *几何投影*。