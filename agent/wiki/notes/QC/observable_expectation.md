# Observable & Expectation

- Source: [roam/QC/observable_expectation.typ](../../../../roam/QC/observable_expectation.typ)
- ID: `20260128T000000-observable-expectation`
- Date: 2026-01-28
- Tags: quantum, observable, expectation, operator

## Summary

1. 可观测量为什么是厄米算符(Hermitian Matrix) 在量子力学中： - 每一个物理可观测量 A - 都对应一个厄米算符 Â, 在希尔伯特空间(Hilbert Space)内. 原因有两个： 1. 本征值必须是实数（实验结果） 2. 本征态可以正交分解（概率解释） 2. 期望值的物理意义 设系统处于态 |ψ⟩， 对同一个系统做大量重复实验： 每一次测量得到一个本征值 a_n 出现概率为 p_n 统计平均值是： ⟨A⟩ = ∑ a_n p_n 谱定理告诉我们： - p_n = |⟨a_n|ψ⟩|² 代入并整理，得到一个极其紧凑的表达式： ⟨A⟩ = ⟨ψ| Â |ψ⟩ 这不是“定义”， 而是从统计平均 严格推导出来的结果。 3. 谱理论的核心结论 对任意厄米算符 A： - 所有可能测量结果 ∈ A 的谱 - 离散谱 → 本征值 - 连续谱 → 广义本征态 如果将 |ψ⟩ 在本征基中展开： columns: 2, [...

## Structure

- 1. 可观测量为什么是厄米算符(Hermitian Matrix)
- 2. 期望值的物理意义
- 3. 谱理论的核心结论

## Links

- [Hermitian Matrix](../math/hermitian_matrix.md)
- [Hilbert Space](../math/hilbert_space.md)

## Backlinks

- None
