# Density Operator

- Source: [roam/QC/density_operator.org](../../../../roam/QC/density_operator.org)
- ID: `35CB5287-89BD-4C89-A9AC-AF09CE758331`
- Date: [2026-01-28 Wed]
- Tags: quantum, density, state, operator

## Summary

并不是所有状态(Quantum State)都能用一个 |ψ⟩ 描述。 例如： - 我们只知道系统以概率 p_i 处于 |ψ_i⟩ - 但不知道“到底是哪一个” 这时，用“态矢”已经不够了。 一个量子态可以用算符 ρ 表示，满足： - ρ ≥ 0（非负） - ρ = ρ†（自共轭） - tr(ρ) = 1（归一化） 期望值公式统一为： ⟨A⟩ = tr(A ρ) 若系统处于纯态 |ψ⟩， 定义： ρ_ψ = |ψ⟩⟨ψ| 这是一个： - 一维正交投影 - 秩为 1 - ρ² = ρ 此时： tr(A ρ_ψ) = ⟨ψ|A|ψ⟩ 与态矢公式完全一致。 - 所有密度算符构成一个 凸集 - 纯态 = 极端点（不可再分） - 混合态 = 纯态的凸组合 可以理解为： 纯态是“信息最完整的状态”， 混合态是“经典不确定性 + 量子不确定性”的叠加。

## Structure

- 1. 为什么要引入密度算符
- 2. 密度算符的定义
- 3. 纯态是特殊的密度算符
- 4. 纯态与混合态的几何结构

## Links

- [Quantum State](quantum_state.md)

## Backlinks

- None
