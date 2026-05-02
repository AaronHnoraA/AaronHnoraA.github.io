# Org Roam Index

| Title | Path | Tags | Summary |
| --- | --- | --- | --- |
| Hermitian Matrix | [roam/math/hermitian_matrix.org](../../roam/math/hermitian_matrix.org) | math, QC, concept | 埃尔米特矩阵（英语：Hermitian matrix，又译作厄米特矩阵，厄米矩阵），也称自伴随矩阵，是共轭对称的方阵。埃尔米特矩阵中每一个第 \(i\) 行第 \(j\) 列的元素都与第 \(j\) 行第 \(i\) 列的元素的复共轭。例如$\begin{bmatrix}3&2+i\\2-i&1\end{bmatrix}$ 就是一个埃尔米特矩阵。 显然，埃尔米特矩阵主对角线上的元素都是实数，其特征值也是实数。对于实矩阵，如果它是对称矩阵，则它也满足埃尔米特矩阵的定义，即，实对称矩阵是埃尔米特矩阵的特例。 - 若 $A$ 和 $B$ 是埃尔米特矩阵，那么它们的和 $A+B$ 也是埃尔米特矩阵；而只有在 $A$ 和 $B$ 满足交换性（即 $AB=BA$）时，它们的积才是埃尔米特矩阵。 - 可逆的埃尔米特矩阵 $A$ 的逆矩阵 $A^{-1}$ 仍然是埃尔米特矩阵。 - 如果 $A$ 是埃尔米特矩阵，对于正整数 $n$，$A^{n... |
| Hilbert Space | [roam/math/hilbert_space.org](../../roam/math/hilbert_space.org) | math, structure, concept, intuition, working, QC, algebra, linear_algebra | 本质是将欧几里得空间 ($\mathbb{R}^n$) 推广到无限维，并保留几何直观。 - 核心定义: 一个完备 (Complete) 的内积空间 (Inner Product Space)。 - 内积 ($\langle u, v \rangle$): 定义了“角度”和“投影”。若内积为 0，则两向量正交。 - 范数 ($\|\|v\|\|$): 由内积导出 ($\|\|v\|\| = \sqrt{\langle v, v \rangle}$)，定义了向量的“长度”。 - 完备性: 空间内的柯西序列收敛于空间内（保证极限存在，微积分可行）。 - 常见例子: - $\mathbb{R}^n$ (有限维希尔伯特空间)。 - $L^2$ 空间 (平方可积函数空间，量子力学中最常用)。 量子力学的公理化数学基础。 - 态 (State): 物理系统的状态由希尔伯特空间中的射线（归一化向量 $\|\psi\rangle$）描述。 - 叠加原理: 向量的... |
| Inner Product Space | [roam/math/inner_product_space.org](../../roam/math/inner_product_space.org) | math, QC, concept, algebra, linear_algebra | - 标量域 $F$： - $\mathbb{R}$（实数） - $\mathbb{C}$（复数） - $V$ 是定义在域 $(F,+,\times)$ 上的向量空间 - 向量加法：$\oplus$ - 标量乘法：$\cdot$ - 给定一个二元函数 \[ f: V \times V \to F \] 通常记作： \[ f(v,w) = \langle v,w\rangle \] 若 $\langle\cdot,\cdot\rangle$ 满足下表中的全部条件，则称其为 $V$ 上的一个 内积。 📌 以上线性条件是指 对第一个变量线性。 - 若 $F=\mathbb{R}$，称 $V$ 为 实内积空间 - 若 $F=\mathbb{C}$，称 $V$ 为 复内积空间 若 \[ \langle v,w\rangle = 0 \] 则记为 \[ v \perp w \] 称 $v$ 与 $w$ 正交（orthogonal / per... |
| Density Operator | [roam/QC/density_operator.org](../../roam/QC/density_operator.org) | quantum, density, state, operator | 并不是所有状态(Quantum State)都能用一个 \|ψ⟩ 描述。 例如： - 我们只知道系统以概率 p_i 处于 \|ψ_i⟩ - 但不知道“到底是哪一个” 这时，用“态矢”已经不够了。 一个量子态可以用算符 ρ 表示，满足： - ρ ≥ 0（非负） - ρ = ρ†（自共轭） - tr(ρ) = 1（归一化） 期望值公式统一为： ⟨A⟩ = tr(A ρ) 若系统处于纯态 \|ψ⟩， 定义： ρ_ψ = \|ψ⟩⟨ψ\| 这是一个： - 一维正交投影 - 秩为 1 - ρ² = ρ 此时： tr(A ρ_ψ) = ⟨ψ\|A\|ψ⟩ 与态矢公式完全一致。 - 所有密度算符构成一个 凸集 - 纯态 = 极端点（不可再分） - 混合态 = 纯态的凸组合 可以理解为： 纯态是“信息最完整的状态”， 混合态是“经典不确定性 + 量子不确定性”的叠加。 |
| Observable & Expectation | [roam/QC/observable_expectation.org](../../roam/QC/observable_expectation.org) | quantum, observable, expectation, operator | 在量子力学中： - 每一个物理可观测量 A - 都对应一个厄米算符 Â, 在希尔伯特空间(Hilbert Space)内. 原因有两个： 1. 本征值必须是实数（实验结果） 2. 本征态可以正交分解（概率解释） 设系统处于态 \|ψ⟩， 对同一个系统做大量重复实验： 每一次测量得到一个本征值 a_n 出现概率为 p_n 统计平均值是： ⟨A⟩ = ∑ a_n p_n 谱定理告诉我们： - p_n = \|⟨a_n\|ψ⟩\|² 代入并整理，得到一个极其紧凑的表达式： ⟨A⟩ = ⟨ψ\| Â \|ψ⟩ 这不是“定义”， 而是从统计平均 严格推导出来的结果。 对任意厄米算符 A： - 所有可能测量结果 ∈ A 的谱 - 离散谱 → 本征值 - 连续谱 → 广义本征态 如果将 \|ψ⟩ 在本征基中展开： 那么： - \|c_n\|² = 测到 a_n 的概率 量子力学的概率性， 并不是“测量扰动”， 而是状态在谱分解中的 几何投影。 |
| Quantum State | [roam/QC/quantum_state.org](../../roam/QC/quantum_state.org) | qc, state, hilbert, geometry | 在量子力学中，每一个物理系统，都对应一个 复希尔伯特空间 H。 H 具备三个关键结构： - 线性结构（可以相加、数乘） - 内积 ⟨·,·⟩（用来算概率与期望值） - 完备性（极限不会“跑丢”） 在实际物理中，我们通常假设 H 是 可分的， 意思是：它有一个可数的正交基， 这与“有限次实验可以确定状态”这一物理事实相匹配。 关键结论： 量子态 ≠ 希尔伯特空间中的某一个具体矢量 量子态 = 一维子空间（又叫“束”） 原因是： 如果两个矢量只差一个整体相位 那么： - 所有可观测量的概率 - 所有期望值 完全一样，实验无法区分。 因此，真正的物理状态是： - 所有长度为 1 的矢量 - 按“相差一个相位”分成的等价类 数学上，这叫： 射影希尔伯特空间 P(H) 虽然严格来说量子态是“束”， 但在很多情形下： - 选定一个代表元 \|ψ⟩ 计算 - 最终结果与相位无关 所以物理学家常常： - 用 \|ψ⟩ 代指这个束 - 称之为“态矢” |
| Variance | [roam/QC/variance.org](../../roam/QC/variance.org) | qc, measurement, statistics, concept | 对于算符 $M^2$，其期望值写作： \[ \langle M^2 \rangle = \langle \psi \| M^2 \| \psi \rangle = \langle \psi \| M \cdot M \| \psi \rangle \] 考察算符 $M$ 的本征方程 $M\|m_i\rangle = m_i\|m_i\rangle$，则 $M^2$ 的作用如下： \[ M \cdot M \Rightarrow m_i' = m_i^2 \] 即 $M^2$ 的本征值为 $m_i^2$。 此时对应的概率 $p_i'$ 为： \[ p_i' = \|\langle m_i' \| \psi \rangle\|^2 \] 但在笔记中特别强调了一个核心性质（红色标注部分）： 这意味着算符平方后，本征态没有改变，因此概率分布保持一致： \[ p_i' = \|\langle m_i \| \psi \rangle\|^2 = p_i \] 因... |

## Note Links

### Hermitian Matrix
- Source: [roam/math/hermitian_matrix.org](../../roam/math/hermitian_matrix.org)
- Wiki: [Hermitian Matrix](../wiki/notes/math/hermitian_matrix.md)
- Outgoing: None
- Backlinks: [Observable & Expectation](../wiki/notes/QC/observable_expectation.md)

### Hilbert Space
- Source: [roam/math/hilbert_space.org](../../roam/math/hilbert_space.org)
- Wiki: [Hilbert Space](../wiki/notes/math/hilbert_space.md)
- Outgoing: [Inner Product Space](../wiki/notes/math/inner_product_space.md)
- Backlinks: [Observable & Expectation](../wiki/notes/QC/observable_expectation.md), [Quantum State](../wiki/notes/QC/quantum_state.md)

### Inner Product Space
- Source: [roam/math/inner_product_space.org](../../roam/math/inner_product_space.org)
- Wiki: [Inner Product Space](../wiki/notes/math/inner_product_space.md)
- Outgoing: None
- Backlinks: [Hilbert Space](../wiki/notes/math/hilbert_space.md)

### Density Operator
- Source: [roam/QC/density_operator.org](../../roam/QC/density_operator.org)
- Wiki: [Density Operator](../wiki/notes/QC/density_operator.md)
- Outgoing: [Quantum State](../wiki/notes/QC/quantum_state.md)
- Backlinks: None

### Observable & Expectation
- Source: [roam/QC/observable_expectation.org](../../roam/QC/observable_expectation.org)
- Wiki: [Observable & Expectation](../wiki/notes/QC/observable_expectation.md)
- Outgoing: [Hermitian Matrix](../wiki/notes/math/hermitian_matrix.md), [Hilbert Space](../wiki/notes/math/hilbert_space.md)
- Backlinks: None

### Quantum State
- Source: [roam/QC/quantum_state.org](../../roam/QC/quantum_state.org)
- Wiki: [Quantum State](../wiki/notes/QC/quantum_state.md)
- Outgoing: [Hilbert Space](../wiki/notes/math/hilbert_space.md)
- Backlinks: [Density Operator](../wiki/notes/QC/density_operator.md)

### Variance
- Source: [roam/QC/variance.org](../../roam/QC/variance.org)
- Wiki: [Variance](../wiki/notes/QC/variance.md)
- Outgoing: None
- Backlinks: None
