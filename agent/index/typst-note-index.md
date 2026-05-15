# Typst Note Index

| Title | Path | Tags | Summary |
| --- | --- | --- | --- |
| Basic Algebra (Reading Note) | [roam/daily/reading/basic algebra.typ](../../roam/daily/reading/basic algebra.typ) | book, reading, summary, draft | Basic Algebra (Reading Note) Book: Jacobson (1985) The Krull-schmit Theorem The results we shall give in this secyino are valid for groups with operators and are of insterest for thes also. |
| Some QC related projects | [roam/daily/uni/qc/ReadingGroup/20260508.typ](../../roam/daily/uni/qc/ReadingGroup/20260508.typ) | note | Ron Steinfeld Privacy-Oriented Cryptographic Protocols (Problem) Quantum-Powered Public-Key Cryptography (Problem) Khoa Nguyen New Post-Quantum Hardness Landscapes from Combinatoria Structures Privacy-Preserving Cryptography with Controlled Information Exposure Privacy-Preserving Interaction with AI Systems Clement Canonne |
| Hermitian Matrix | [roam/math/hermitian_matrix.typ](../../roam/math/hermitian_matrix.typ) | math, QC, concept | Hermitian Matrix 厄米矩阵 埃尔米特矩阵（英语：Hermitian matrix，又译作厄米特矩阵，厄米矩阵），也称自伴随矩阵，是共轭对称的方阵。埃尔米特矩阵中每一个第 $i$ 行第 $j$ 列的元素都与第 $j$ 行第 $i$ 列的元素的复共轭。例如$mat(3, 2+i; 2-i, 1)$ 就是一个埃尔米特矩阵。 显然，埃尔米特矩阵主对角线上的元素都是实数，其特征值也是实数。对于实矩阵，如果它是对称矩阵，则它也满足埃尔米特矩阵的定义，即，实对称矩阵是埃尔米特矩阵的特例。 性质 - 若 $A$ 和 $B$ 是埃尔米特矩阵，那么它们的和 $A+B$ 也是埃尔米特矩阵；而只有在 $A$ 和 $B$ 满足交换性（即 $A B=B A$）时，它们的积才是埃尔米特矩阵。 - 可逆的埃尔米特矩阵 $A$ 的逆矩阵 $A^(-1)$ 仍然是埃尔米特矩阵。 - 如果 $A$ 是埃尔米特矩阵，对于正整数 $n$，$A^(n)$... |
| Hilbert Space | [roam/math/hilbert_space.typ](../../roam/math/hilbert_space.typ) | math, structure, concept, intuition, working, QC, algebra, linear_algebra | Hilbert Space 希尔伯特空间 Hilbert space is a big space. ----- Carlton Caves ] 1. 数学理解 (Mathematical Understanding) 本质是将欧几里得空间 ($bb(R)^(n)$) 推广到无限维，并保留几何直观。 - 核心定义: 一个完备 (Complete) 的内积空间 (Inner Product Space)。 - 内积 ($ lr(angle.l u, v angle.r) $): 定义了“角度”和“投影”。若内积为 0，则两向量正交。 - 范数 ($\|\|v\|\|$): 由内积导出 ($\|\|v\|\| = sqrt( lr(angle.l v, v angle.r) )$)，定义了向量的“长度”。 - 完备性: 空间内的柯西序列收敛于空间内（保证极限存在，微积分可行）。 - 常见例子: - $bb(R)^n$ (有限维希尔伯特空间)。 -... |
| Inner Product Space | [roam/math/inner_product_space.typ](../../roam/math/inner_product_space.typ) | math, QC, concept, algebra, linear_algebra | Inner Product Space 内积空间 - 标量域 $F$： - $bb(R)$（实数） - $bb(C)$（复数） - $V$ 是定义在域 $(F,+, times )$ 上的向量空间 - 向量加法：$ plus.circle $ - 标量乘法：$ dot.op $ - 给定一个二元函数 $ f: V times V -> F $ 通常记作： $ f(v,w) = lr(angle.l v,w angle.r) $ 内积的公理化定义 若 $ lr(angle.l dot.op , dot.op angle.r) $ 满足下表中的全部条件，则称其为 $V$ 上的一个 内积。 columns: 3, [性质名称], [前提条件], [数学表述], [共轭对称], [$ forall v,w in V$], [$ lr(angle.l v,w angle.r) = overline( lr(angle.l w,v ang... |
| Progress in Theoretical Computer Science | [roam/project/UNSW/ISO(202603)/Kobler.typ](../../roam/project/UNSW/ISO(202603)/Kobler.typ) |  | This is a note for Kobler, 2020, "ISO(2026-03)". My task is to use scam the book and then try to contribute connection between: note-equation("eq:1")[ $ d"GA" <=_p "GI" <=_p "GA" $ ] and $ note-pin("a") d"TA" <=_p "TI" note-pin("b") <=_p "cTA" $. In @eq:1, $d"GA" <=_p "GI"$ can be understanded by coloring operations. And @eq:1 is proved true by others. $"TI" <=_p "cTA"$ is known by us. note-pinit-point-from(("a", "b... |
| 把 Tensor Isomorphism 归约到 Tensor Automorphism | [roam/project/UNSW/ISO(202603)/meeting.typ](../../roam/project/UNSW/ISO(202603)/meeting.typ) |  | 执行摘要 本文目标有两个：其一，给出从 Tensor Isomorphism（TI）到 Tensor Automorphism（TA）的一个可执行、可写入论文的证明框架；其二，把这件事拆成小组可并行推进的工作包。 本文的主线并不是“把 TI 直接压成一个最弱版本的 TA 判定问题”，而是先区分三类 oracle：返回整群、返回生成元、只做非平凡自同构判定。对前两类 oracle，我们给出完整的构造、正确性证明与复杂性分析；对第三类 oracle，我们说明一般情形下它不够强，除非再加刚性化（rigidification）或 promise 条件。 在结构上，本文先把输入张量化为 minimal support spaces 上的 concise / non-degenerate 形式，再构造 $ S := A ⊕ B $ 并引入 switching automorphism。核心命题是：当 $A, B$ 都在其 minimal... |
| Strassen | [roam/project/UNSW/ISO(202603)/strassen.typ](../../roam/project/UNSW/ISO(202603)/strassen.typ) | math, tensor_complexity, Strassen, bilinear_maps, summary, project, reading | Overview This note is about Strassen, 1969. ] Reading Note Degeneration of tensors Self Understanding |
| Density Operator | [roam/QC/density_operator.typ](../../roam/QC/density_operator.typ) | quantum, density, state, operator | 1. 为什么要引入密度算符 并不是所有状态(Quantum State)都能用一个 \|ψ⟩ 描述。 例如： - 我们只知道系统以概率 p_i 处于 \|ψ_i⟩ - 但不知道“到底是哪一个” 这时，用“态矢”已经不够了。 2. 密度算符的定义 一个量子态可以用算符 ρ 表示，满足： - ρ ≥ 0（非负） - ρ = ρ†（自共轭） - tr(ρ) = 1（归一化） 期望值公式统一为： ⟨A⟩ = tr(A ρ) 3. 纯态是特殊的密度算符 若系统处于纯态 \|ψ⟩， 定义： ρ_ψ = \|ψ⟩⟨ψ\| 这是一个： - 一维正交投影 - 秩为 1 - ρ² = ρ 此时： tr(A ρ_ψ) = ⟨ψ\|A\|ψ⟩ 与态矢公式完全一致。 4. 纯态与混合态的几何结构 - 所有密度算符构成一个 凸集 - 纯态 = 极端点（不可再分） - 混合态 = 纯态的凸组合 可以理解为： 纯态是“信息最完整的状态”， 混合态是“经典不确定性 + 量子... |
| Observable & Expectation | [roam/QC/observable_expectation.typ](../../roam/QC/observable_expectation.typ) | quantum, observable, expectation, operator | 1. 可观测量为什么是厄米算符(Hermitian Matrix) 在量子力学中： - 每一个物理可观测量 A - 都对应一个厄米算符 Â, 在希尔伯特空间(Hilbert Space)内. 原因有两个： 1. 本征值必须是实数（实验结果） 2. 本征态可以正交分解（概率解释） 2. 期望值的物理意义 设系统处于态 \|ψ⟩， 对同一个系统做大量重复实验： 每一次测量得到一个本征值 a_n 出现概率为 p_n 统计平均值是： ⟨A⟩ = ∑ a_n p_n 谱定理告诉我们： - p_n = \|⟨a_n\|ψ⟩\|² 代入并整理，得到一个极其紧凑的表达式： ⟨A⟩ = ⟨ψ\| Â \|ψ⟩ 这不是“定义”， 而是从统计平均 严格推导出来的结果。 3. 谱理论的核心结论 对任意厄米算符 A： - 所有可能测量结果 ∈ A 的谱 - 离散谱 → 本征值 - 连续谱 → 广义本征态 如果将 \|ψ⟩ 在本征基中展开： columns: 2, [... |
| Quantum State | [roam/QC/quantum_state.typ](../../roam/QC/quantum_state.typ) | qc, state, hilbert, geometry | 1. 量子态的数学载体：希尔伯特空间(Hilbert Space) 在量子力学中，每一个物理系统，都对应一个 复希尔伯特空间 H。 H 具备三个关键结构： - 线性结构（可以相加、数乘） - 内积 ⟨·,·⟩（用来算概率与期望值） - 完备性（极限不会“跑丢”） 在实际物理中，我们通常假设 H 是 可分的， 意思是：它有一个可数的正交基， 这与“有限次实验可以确定状态”这一物理事实相匹配。 2. 量子态不是矢量，而是“束” 关键结论： 量子态 ≠ 希尔伯特空间中的某一个具体矢量 量子态 = 一维子空间（又叫“束”） 原因是： 如果两个矢量只差一个整体相位 columns: 2, [ψ⟩ 和 e^{iθ}], [ψ⟩], ) 那么： - 所有可观测量的概率 - 所有期望值 完全一样，实验无法区分。 因此，真正的物理状态是： - 所有长度为 1 的矢量 - 按“相差一个相位”分成的等价类 数学上，这叫： 射影希尔伯特空间 P(H)... |
| Variance | [roam/QC/variance.typ](../../roam/QC/variance.typ) | qc, measurement, statistics, concept | 方差 (Variance) $ [ Delta (M)]^(2) &= angle.l (M - lr(angle.l M angle.r) )^2 angle.r \ &= lr(angle.l M^(2) angle.r) - lr(angle.l M angle.r) ^(2) $ ] 设方差 (Variance) 的定义为： $ "Var" = sum _i p_i (m_i - lr(angle.l M angle.r) )^2 $ 展开括号内的平方项： $ &= sum _i p_i (m_i^2 - 2m_i lr(angle.l M angle.r) + lr(angle.l M angle.r) ^2) \ &= sum _i p_i m_i^2 - 2 lr(angle.l M angle.r) sum _i p_i m_i + lr(angle.l M angle.r) ^2 sum _i p_i $ 其... |

## Note Links

### Basic Algebra (Reading Note)
- Source: [roam/daily/reading/basic algebra.typ](../../roam/daily/reading/basic algebra.typ)
- Wiki: [Basic Algebra (Reading Note)](../wiki/notes/daily/reading/basic algebra.md)
- Outgoing: None
- Backlinks: None

### Some QC related projects
- Source: [roam/daily/uni/qc/ReadingGroup/20260508.typ](../../roam/daily/uni/qc/ReadingGroup/20260508.typ)
- Wiki: [Some QC related projects](../wiki/notes/daily/uni/qc/ReadingGroup/20260508.md)
- Outgoing: None
- Backlinks: None

### Hermitian Matrix
- Source: [roam/math/hermitian_matrix.typ](../../roam/math/hermitian_matrix.typ)
- Wiki: [Hermitian Matrix](../wiki/notes/math/hermitian_matrix.md)
- Outgoing: None
- Backlinks: [Observable & Expectation](../wiki/notes/QC/observable_expectation.md)

### Hilbert Space
- Source: [roam/math/hilbert_space.typ](../../roam/math/hilbert_space.typ)
- Wiki: [Hilbert Space](../wiki/notes/math/hilbert_space.md)
- Outgoing: [Inner Product Space](../wiki/notes/math/inner_product_space.md)
- Backlinks: [Observable & Expectation](../wiki/notes/QC/observable_expectation.md), [Quantum State](../wiki/notes/QC/quantum_state.md)

### Inner Product Space
- Source: [roam/math/inner_product_space.typ](../../roam/math/inner_product_space.typ)
- Wiki: [Inner Product Space](../wiki/notes/math/inner_product_space.md)
- Outgoing: None
- Backlinks: [Hilbert Space](../wiki/notes/math/hilbert_space.md)

### Progress in Theoretical Computer Science
- Source: [roam/project/UNSW/ISO(202603)/Kobler.typ](../../roam/project/UNSW/ISO(202603)/Kobler.typ)
- Wiki: [Progress in Theoretical Computer Science](../wiki/notes/project/UNSW/ISO(202603)/Kobler.md)
- Outgoing: None
- Backlinks: None

### 把 Tensor Isomorphism 归约到 Tensor Automorphism
- Source: [roam/project/UNSW/ISO(202603)/meeting.typ](../../roam/project/UNSW/ISO(202603)/meeting.typ)
- Wiki: [把 Tensor Isomorphism 归约到 Tensor Automorphism](../wiki/notes/project/UNSW/ISO(202603)/meeting.md)
- Outgoing: None
- Backlinks: None

### Strassen
- Source: [roam/project/UNSW/ISO(202603)/strassen.typ](../../roam/project/UNSW/ISO(202603)/strassen.typ)
- Wiki: [Strassen](../wiki/notes/project/UNSW/ISO(202603)/strassen.md)
- Outgoing: None
- Backlinks: None

### Density Operator
- Source: [roam/QC/density_operator.typ](../../roam/QC/density_operator.typ)
- Wiki: [Density Operator](../wiki/notes/QC/density_operator.md)
- Outgoing: [Quantum State](../wiki/notes/QC/quantum_state.md)
- Backlinks: None

### Observable & Expectation
- Source: [roam/QC/observable_expectation.typ](../../roam/QC/observable_expectation.typ)
- Wiki: [Observable & Expectation](../wiki/notes/QC/observable_expectation.md)
- Outgoing: [Hermitian Matrix](../wiki/notes/math/hermitian_matrix.md), [Hilbert Space](../wiki/notes/math/hilbert_space.md)
- Backlinks: None

### Quantum State
- Source: [roam/QC/quantum_state.typ](../../roam/QC/quantum_state.typ)
- Wiki: [Quantum State](../wiki/notes/QC/quantum_state.md)
- Outgoing: [Hilbert Space](../wiki/notes/math/hilbert_space.md)
- Backlinks: [Density Operator](../wiki/notes/QC/density_operator.md)

### Variance
- Source: [roam/QC/variance.typ](../../roam/QC/variance.typ)
- Wiki: [Variance](../wiki/notes/QC/variance.md)
- Outgoing: None
- Backlinks: None
