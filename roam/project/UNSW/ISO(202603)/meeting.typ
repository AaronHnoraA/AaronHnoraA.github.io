
#import "/_typst/note.typ": *
#show: note-entry
#set heading(numbering: "1.")


#metadata((
  kind: "note",
  title: "  把 Tensor Isomorphism 归约到 Tensor Automorphism",
)) <note>

= 执行摘要

本文目标有两个：其一，给出从 Tensor Isomorphism（TI）到 Tensor Automorphism（TA）的一个可执行、可写入论文的证明框架；其二，把这件事拆成小组可并行推进的工作包。

本文的主线并不是“把 TI 直接压成一个最弱版本的 TA 判定问题”，而是先区分三类 oracle：返回整群、返回生成元、只做非平凡自同构判定。对前两类 oracle，我们给出完整的构造、正确性证明与复杂性分析；对第三类 oracle，我们说明一般情形下它不够强，除非再加刚性化（rigidification）或 promise 条件。

在结构上，本文先把输入张量化为 *minimal support spaces* 上的 concise / non-degenerate 形式，再构造
$ S := A ⊕ B $
并引入 *switching automorphism*。核心命题是：当 $A, B$ 都在其 minimal support spaces 上看待时，
$ A G tilde.equiv H  B $
当且仅当
$ S $
存在把三条腿上的第一块与第二块同时交换的 switching automorphism。

这个命题本身不需要有限域、也不需要先假设 indecomposable；它只是一个块交换与限制映射的双向证明。真正的算法难点不在这个 iff，而在“如何从 TA oracle 的输出中*检测* switch”。

为了把 Strassen／Krull–Schmidt 语言补全到论文可用程度，本文另外整理了 direct sum、indecomposable、non-degenerate、minimal support spaces、center / centroid 与 idempotent 的关系。对“为什么 direct sum 分解应当由 idempotent 控制、为什么 refined decomposition 本质唯一”，本文给出一个适合写作的证明骨架：多线性形式情形使用中心代数；Segre 格式的一般张量情形使用 centroid 的 commutative algebra 版本，并把最精细 direct-sum 分解与 local / primitive idempotent 对应起来。

最后，本文把项目推进拆成四个同步接口：Aaron 负责 Strassen 语言、最小支撑化、switching lemma 与“生成集 vs 生成群”的漏洞修正；Euan 负责 Krull–Schmidt 主命题与现有 Lemma 3.1 / Lemma 4.1 的对表；Murray 负责有限维代数、Jacobson radical、primitive idempotents 与算法部分；Youming 负责 oracle 模型冻结、复杂度表述与整文口径统一。


= 小组分工与合作流程

下表先给出“谁做什么、什么时候交、与谁对接”。这一段是给组会开场直接使用的。

#table(
  columns: (1.2fr, 2.4fr, 2.5fr, 2.1fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
  table.header([成员], [核心职责], [会议前交付物], [主要接口]),
  [Aaron], [
    把 Strassen 的 bilinear-map / tensor 语言翻成项目统一记号；写清楚 isomorphism、automorphism、direct sum、cross terms vanish、switching automorphism；补 minimal support spaces 的内在性证明；指出“any generating set contains a switching automorphism”措辞错误并改成“generated group contains one”。
  ], [
    一页证明草稿：
    (i) minimal support spaces 内在性；
      (ii) $A ≅ B <=> A plus.o B$ 含 switching automorphism；
    (iii) 一段 caveat：generator set 不必字面含 switch。
  ], [
    先与 Euan 对表，再把 oracle 问题抛给 Youming；与 Murray 对接 idempotent 记号。
  ],
  [Euan], [
    Krull–Schmidt 主线；核对现有 Lemma 3.1 是否真等于 Strassen Proposition 1.2；核对 Lemma 4.1 是否需要“group contains switch”而不是“generating set contains switch”；整理一般／对称／交替三类 tensor category 不要混写。
  ], [
    一页 note：
    (i) Krull–Schmidt statement 的精确对象；
    (ii) Lemma 3.1 与 Strassen 命题的逐项对比；
    (iii) 当前 proof gap 的位置清单。
  ], [
    直接与 Aaron 共用记号；把 category-level 假设发给 Youming 定稿。
  ],
  [Murray], [
    有限维代数路线：structure constants、Jacobson radical、semisimple quotient、primitive idempotents、$A / "Rad"(A)$ 的 Wedderburn 型分解；把 “idempotent ↔ direct sum block” 写成算法语言；给出 Rónyai–Ivanyos 路线是否足以在有限域上求 primitive idempotents。
  ], [
    一页 note：
    (i) 从 structure constants 到 idempotent 的算法骨架；
    (ii) 哪些步骤在有限域是随机多项式时间；
    (iii) 哪些步骤在特征 $0$ / 任意有效域只剩结构结论。
  ], [
    与 Aaron 对接 block projection 记号；与 Youming 对接复杂度口径。
  ],
  [Youming], [
    冻结问题模型：TA oracle 究竟返回整群、生成元还是只做判定；决定最后论文主命题写成 many-one reduction 还是 Turing reduction；统一 TI-complete 语境中的复杂度表述。
  ], [
    半页到一页模型说明：
    (i) oracle 输入输出；
    (ii) 允许的后处理；
    (iii) 最终希望的 theorem statement。
  ], [
    与 Euan 决定 theorem wording；与 Aaron 决定 switch 检测到底走 group route 还是 idempotent route。
  ],
)

#summary("Aaron 的任务定位")[
  Aaron 的定位不是“把整篇论文从头到尾写完”，而是把现在最容易导致全篇崩掉的三件事先钉死：

  其一，*语言统一*：Strassen 的 bilinear map 语言、Euan note 中的 Krull–Schmidt 语言、项目最终要写的 $U times.o V times.o W$ 群作用语言，要放进同一个字典里。

  其二，*关键 iff 的证明封口*：
  $ A ≅ B ⟺ A ⊕ B $
  含 switch 要能在一页内写得完全清楚。

  其三，*漏洞修正*：必须把“生成集里有 switch”改成“生成群里有 switch”；并且尽早确认 TA oracle 的输出模型，否则算法节会写错方向。
]


#table(
  columns: (1.6fr, 2fr, 2fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
  table.header([Aaron 的步骤], [具体动作], [成果形式]),
  [读取 Euan note], [先不陷入 hard proof，先把对象、同构、分解、假设全部摘出来。], [半页对象字典],
  [对照 Strassen], [核对 bilinear map 与 tensor 的对应、三条腿的角色、direct sum 的语言、field 假设。], [Strassen–Euan–Project 对照表],
  [修 Lemma 3.1], [判断它与 Strassen 命题是否完全一致；把漏掉的 concise / nonzero / non-degenerate 假设补齐。], [一页 proof sketch],
  [修 Lemma 4.1], [把 “generating set contains switch” 改成 “generated group contains switch”；加一句说明为什么生成集字面不必含 switch。], [措辞修订稿],
  [分离 tensor categories], [把一般、对称、交替三类 tensor action 分开写；在 char $2$ 下标红 caveat。], [两段 warning],
  [准备会议摘要], [做一个三分钟版本，只讲对象、主 iff、oracle caveat、需要谁拍板。], [口头 summary + 一页 handout],
)



= 引言与优先文献

把“张量同构”放到复杂度与群作用的交叉点去看，已经形成了一条相对清晰的文献链。

Strassen 在 1987 年把 bilinear complexity、tensor、restriction、degeneration、matrix multiplication exponent 放进同一个框架中；这是今天仍然最自然的语言起点（Strassen 1987）。

之后，环同构／环自同构与多项式等价问题被证明与 automorphism / isomorphism 问题紧密纠缠。Kayal–Saxena 的工作以及 Agrawal–Saxena 的综述特别强调：在 basis representation 下，有限环的 automorphism / isomorphism 问题有明确复杂度上界；图同构可以归约到 ring isomorphism，而 ring isomorphism 又与 cubic form equivalence 发生连接（Kayal–Saxena；Agrawal–Saxena）。

在复杂度论一侧，Grochow–Qiao 把 tensors、groups、polynomials、algebras 的一大类同构问题统一为 TI-complete 现象，明确提出 Tensor Isomorphism 作为一个稳健的等价类。其后续 2025 工作又继续把这条链扩展到线性长度 gadget 与交换环情形（Grochow–Qiao 2023；Grochow–Qiao–Stange–Sun 2025）。

在分解与 automorphism 的算法侧，Wilson 发展了 direct product / Remak decomposition 的群论算法框架，并把 bilinear-map 观点放到 central decomposition、pseudo-isometry 与相关 algebraic invariant 上。Brooksbank–Maglione–Wilson 又继续推进了 tensor 的 automorphism / derivation / densor 路线（Wilson 2012；Brooksbank–Maglione–Wilson 2020/2022）。

最后，在本文最需要的“direct sum 与 indecomposable 如何由 centroid / center 控制”这个点上，有两条特别重要的文献：一条是 Huang–Lu–Ye–Zhang 对非退化 multilinear forms / multilinear maps 的中心代数理论；另一条是 Canino 等人在一般 Segre / Segre–Veronese 格式下对 centroid、refined direct-sum decomposition 及其 locality 判别的系统处理。前者给出“中心代数交换、正交幂等元对应 direct sum、indecomposable 分解唯一”的清晰原型；后者则把这件事真正推到一般 Segre 格式张量（Huang–Lu–Ye–Zhang 2023；Canino 等 2025）。

#table(
  columns: (0.9fr, 2.2fr, 2.5fr, 2.4fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
  table.header([优先级], [文献], [本文使用位置], [备注]),
  [A], [Strassen 1987], [引言、bilinear map / tensor 语言、direct sum 直觉、复杂度背景], [起始语言],
  [A], [Grochow–Qiao 2023；Grochow–Qiao 等 2025], [TI-complete 语境、oracle 和复杂度定位], [复杂度主线],
  [A], [Kayal–Saxena；Agrawal–Saxena], [automorphism / isomorphism / cubic form 相关工作], [与 TA 主题最接近],
  [A], [Wilson 2012], [Remak/Krull–Schmidt 算法视角；bilinear map 相关背景], [算法性分解背景],
  [A], [Rónyai 1990；Ivanyos 系列], [finite-dimensional algebra、idempotent、有限域算法], [Murray 路线核心],
  [A], [Huang–Lu–Ye–Zhang 2023], [中心代数与 direct sum 唯一性原型], [proof template],
  [A], [Canino 等 2025], [Segre 格式 centroid 与 refined decomposition], [直接支撑本文张量情形],
)

= 形式化定义与精确模型

#definition("Tensor Isomorphism")[
  设
  $ A ∈ U_1 ⊗ V_1 ⊗ W_1 $
  与
  $ B ∈ U_2 ⊗ V_2 ⊗ W_2 $
  是有限维向量空间上的三阶张量。若存在可逆线性映射
  $ P: U_1 → U_2, Q: V_1 → V_2, R: W_1 → W_2 $
  使得
  $
    (P ⊗ Q ⊗ R) A = B,
  $
  则称 $A$ 与 $B$ 同构，记作
  $ A ≅ B $。
  TI 判定问题就是判断这样的三元组是否存在。
]

#definition("Tensor Automorphism")[
  对单个张量
  $ T ∈ U ⊗ V ⊗ W $，
  定义其自同构群
  $
    "Aut"(T)
    :=
    { (P, Q, R) ∈ "GL"(U) × "GL"(V) × "GL"(W) : (P ⊗ Q ⊗ R)T = T }.
  $
  TA 不是一个唯一的问题名，而是一簇问题：可以问整群、可以问生成元、也可以只问是否存在非恒等自同构。
]

#definition("minimal support spaces")[
  对
  $ T ∈ U ⊗ V ⊗ W $，
  定义
  $
    U_min(T)
    :=
    span { (id_U ⊗ φ ⊗ ψ)(T) : φ ∈ V^*, ψ ∈ W^* } ⊆ U,
  $
  并循环定义
  $V_min(T)$、$W_min(T)$。

  若
  $
    U_min(T) = U,
    V_min(T) = V,
    W_min(T) = W,
  $
  则称 $T$ 是 *non-degenerate* 或 *concise* 的。
]
#definition("direct sum")[
  设
  $ A ∈ U_A ⊗ V_A ⊗ W_A $
  与
  $ B ∈ U_B ⊗ V_B ⊗ W_B $。
  在
  $
    (U_A ⊕ U_B) ⊗ (V_A ⊕ V_B) ⊗ (W_A ⊕ W_B)
  $
  中，把 $A$ 和 $B$ 通过自然嵌入看成两个块。

  定义
  $
    A ⊕ B := A + B.
  $

  这里的关键不是“加法符号”，而是 *cross terms 必须为零*：只有块
  $
    U_A ⊗ V_A ⊗ W_A
  $
  与
  $
    U_B ⊗ V_B ⊗ W_B
  $
  出现，所有混合块都不出现。
]

#warning("direct sum 不是单纯的向量空间直和")[
  在 tensor 语境里，
  $ U = U_A ⊕ U_B $
  只是 ambient decomposition；真正的 direct sum 还要求张量本身只落在对应的纯块里。

  换言之，*“三条腿都同色”* 的项才允许出现；任何
  $
    U_A ⊗ V_A ⊗ W_B
  $
  或类似混合块都必须消失。
]

#definition("switching automorphism")[
  对
  $ S = A ⊕ B $，
  若
  $ (P, Q, R) ∈ "Aut"(S) $
  满足
  $
    P(U_A) = U_B, quad P(U_B) = U_A,
  $
  $
    Q(V_A) = V_B, quad Q(V_B) = V_A,
  $
  $
    R(W_A) = W_B, quad R(W_B) = W_A,
  $
  则称它是相对于该二块分解的 *switching automorphism*。
]

#definition("indecomposable")[
  非零张量 $T$ 若在其 minimal support spaces 上不能写成非平凡 direct sum，
  则称 $T$ 为 indecomposable。
]
#table(
  columns: (1.6fr, 1.5fr, 2.6fr, 2.3fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
  table.header([对象类别], [主作用群], [本文状态], [主要 caveat]),
  [Segre 三张量 $U ⊗ V ⊗ W$], [独立三腿 $"GL(U)" × "GL"(V) × "GL"(W)$], [本文主线完整处理], [无额外特征限制],
  [对称张量 $"Sym"^3(V)$ / cubic form], [对角作用 $"GL"(V)$], [只作比较与 caveat，不在本文主定理里完全展开], [若用 polarization 或 Jacobian-ideal 语言，常需要 char $0$ 或 $> 3$],
  [交替张量 $∧^3(V)$], [对角作用 $"GL"(V)$], [仅作提醒], [char $2$ 下 alternating / skew-symmetric 现象退化，不能与一般特征混写],
)

#table(
  columns: (1.3fr, 2.6fr, 2.6fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
  table.header([TA oracle 模型], [输入输出], [对 TI 到 TA 归约的影响]),
  [整群 oracle], [输入 $T$，返回 $"Aut"(T)$ 的全部元素（有限域时才现实）], [最直接：逐个检测是否存在 switch],
  [生成元 oracle], [输入 $T$，返回 $"Aut"(T)$ 的一个生成元集合], [可行，但必须补矩阵群或置换群后处理；“生成集里未必字面含 switch”],
  [判定 oracle], [输入 $T$，只回答 $"Aut"(T)$ 是否非平凡], [一般不足；会被 $"Aut"(A)$、$"Aut"(B)$ 的内部对称性误伤；只在刚性 promise 下可用],
)


= 主要定理与证明结构

#theorem("minimal support spaces 的内在性")[
  对任意
  $ T ∈ U ⊗ V ⊗ W $，
  上述
  $U_min(T), V_min(T), W_min(T)$
  由 $T$ 内在决定，并且满足：

  1. $T ∈ U_min(T) ⊗ V_min(T) ⊗ W_min(T)$；
  2. 若
     $
       T ∈ U' ⊗ V' ⊗ W'
     $
     且
     $
       U' ⊆ U, quad
       V' ⊆ V, quad
       W' ⊆ W,
     $
     则
     $
       U_min(T) ⊆ U', quad
       V_min(T) ⊆ V', quad
       W_min(T) ⊆ W';
     $
  3. 若
     $
       T' = (P ⊗ Q ⊗ R)T,
     $
     则
     $
       P(U_min(T)) = U_min(T'),
       Q(V_min(T)) = V_min(T'),
       R(W_min(T)) = W_min(T').
     $
]

#theorem("switching criterion")[
  设 $A$ 与 $B$ 都在各自的 minimal support spaces 上给出，记
  $
    S := A ⊕ B.
  $
  则以下两件事等价：

  1. $ A ≅ B $；
  2. $ S $ 存在相对于其二块分解的 switching automorphism。
]

#proposition("Krull–Schmidt 型 refined decomposition 的使用方式")[
  对 concise 的一般 Segre 格式张量，centroid 是交换含幺代数；最精细 direct-sum decomposition 由其 maximal ideals / primitive idempotents 控制；特别地，张量 indecomposable 当且仅当其 centroid 是 local。这个命题在一般 Segre 格式上可直接调用最新 centroid 理论；在 equal-space multilinear form 情形，则可用中心代数的幂等元证明直接导出。
]

#summary("为什么本文主证明不必在一开始就假设 indecomposable")[
  核心 iff
  $
    A ≅ B ⟺ A plus.o B
  $
  含 switch，本身只是一个“块交换”命题，不要求 $A$、$B$ 预先 indecomposable。

  indecomposable / Krull–Schmidt 在本文里承担的是 *第二层职责*：

  一是为后续“如何检测 switch”提供 canonical decomposition 语言；
  二是解释为什么 Murray 的 idempotent 路线自然出现。
]

= 完整证明与证明骨架

#lemma("minimal support spaces 的最小性")[
  对任意
  $ T ∈ U ⊗ V ⊗ W $，
  第一腿的空间
  $
    U_min(T)
  $
  是所有满足
  $
    T ∈ U' ⊗ V ⊗ W
  $
  的子空间 $U' ⊆ U$ 中最小的一个；其余两腿同理。
]

#proof[
  只证第一腿。由定义，所有
  $
    (id_U ⊗ φ ⊗ ψ)(T)
  $
  都在任何允许的 $U'$ 中，因此
  $
    U_min(T) ⊆ U'
  $
  对一切这样的 $U'$ 成立，于是 $U_min(T)$ 确实最小。

  另一方面，取 $u_1, ..., u_r$ 为 $U_min(T)$ 的一组基，令
  $
    T = sum_i u_i ⊗ M_i
  $
  其中
  $
    M_i ∈ V ⊗ W
  $。
  于是
  $
    T ∈ U_min(T) ⊗ V ⊗ W.
  $
  对另外两腿同理，立得
  $
    T ∈ U_min(T) ⊗ V_min(T) ⊗ W_min(T).
  $
]


#proof[
  由上引理，定理中的第一、第二条已经得到。第三条只需注意 contraction 与基变换可交换：若
  $
    T' = (P ⊗ Q ⊗ R)T,
  $
  则
  $
    (id_{U_2} ⊗ φ' ⊗ ψ')(T')
    =
    P "big"((id_{U_1} ⊗ (φ' ∘ Q) ⊗ (ψ' ∘ R))(T) "big").
  $
  因此
  $
    U_min(T') = P(U_min(T)).
  $
  另外两腿同理。
]

#remark("写作意义")[
  这一定理告诉我们：任何 TI 证明在正式陈述时都应当先把输入压到 minimal support spaces 上。否则 ambient zero directions 会制造“伪 switch”与“伪 automorphism”，把 statement 写得不干净。
]

#lemma("switching automorphism 给出同构")[
  设
  $
    S = A ⊕ B
  $
  且
  $
    (P, Q, R) ∈ "Aut"(S)
  $
  是一个 switch。则
  $
    A ≅ B.
  $
]

#proof[
  因为 $P, Q, R$ 把三条腿上的第一块分别送到第二块，所以
  $
    (P ⊗ Q ⊗ R)A
    ∈
    U_B ⊗ V_B ⊗ W_B.
  $
  同理
  $
    (P ⊗ Q ⊗ R)B
    ∈
    U_A ⊗ V_A ⊗ W_A.
  $

  另一方面，
  $
    (P ⊗ Q ⊗ R)S = S.
  $
  又由于
  $
    S = A + B
  $
  且两块互不相交，比较两个纯块分量即可得到
  $
    (P ⊗ Q ⊗ R)A = B,
  $
  $
    (P ⊗ Q ⊗ R)B = A.
  $
  因而
  $
    (P|_{U_A}, Q|_{V_A}, R|_{W_A})
  $
  就是从 $A$ 到 $B$ 的同构。
]
#lemma("同构给出 switching automorphism")[
  若
  $
    A ≅ B,
  $
  则
  $
    S := A ⊕ B
  $
  存在 switching automorphism。
]
#proof[
  取一个同构
  $
    (p, q, r): A mapsto B,
  $
  其中
  $
    p: U_A → U_B, quad
    q: V_A → V_B, quad
    r: W_A → W_B
  $
  可逆。

  在三条腿上分别定义“交换两块”的可逆线性映射：从第一块到第二块用 $p, q, r$，从第二块回第一块用 $p^{-1}, q^{-1}, r^{-1}$。于是得到可逆映射
  $
    P: U_A ⊕ U_B → U_A ⊕ U_B,
  $
  $
    Q: V_A ⊕ V_B → V_A ⊕ V_B,
  $
  $
    R: W_A ⊕ W_B → W_A ⊕ W_B
  $
  且它们都交换两块。并且
  $
    (P ⊗ Q ⊗ R)A = B, quad
    (P ⊗ Q ⊗ R)B = A.
  $
  所以
  $
    (P ⊗ Q ⊗ R)S = S,
  $
  即得到一个 switching automorphism。
]


#proof[
  定理 “switching criterion” 由以上两个引理立即推出。
]

#proposition("equal-space 多线性形式的幂等元分解骨架")[
  设
  $
    Θ: V × V × V → k
  $
  是非退化三线性形式。定义其中心代数
  $
    Z(V, Θ)
    :=
    { φ ∈ "End"(V) :
       Θ(φ x, y, z)
       =
       Θ(x, φ y, z)
       =
       Θ(x, y, φ z)\ "for all" x,y,z }.
  $
  则：

  1. $Z(V, Θ)$ 是交换代数；
  2. 完整的两两正交幂等元组
     $
       e_1, ..., e_s
     $
     与
     $
       (V, Θ)
     $
     的 direct-sum decomposition 一一对应；
  3. 因而 indecomposable decomposition 唯一到排列。
]

#proof[
  这正是 Huang–Lu–Ye–Zhang 的中心代数理论最直接的三步：

  第一步，交换性来自“把一个中心元沿不同槽位来回移动”的计算，再用 non-degeneracy 杀掉交换子。

  第二步，若已有分解
  $
    V = V_1 ⊕ ... ⊕ V_s
  $
  且 mixed terms vanish，则各块投影
  $
    e_i: V ↠ V_i ↪ V
  $
  是两两正交幂等元；反过来，若给定一组完整正交幂等元，则令
  $
      V_i := e_(i v)
  $
  并利用
  $
      e_(i e)_j = 0
  $
  推出 mixed terms vanish。

  第三步，因为有限维交换代数的 primitive idempotent decomposition 唯一，所以对应的 indecomposable summands 也唯一到排列。

  对详细逐行证明，可直接平移 Huang–Lu–Ye–Zhang 2023 的 Theorem 1.2 及其证明；本文在这里只取其“幂等元对应分解”这一骨架，用来解释 Strassen / Krull–Schmidt 语言为何在 tensor 写法中自然。
]

#remark("一般 Segre 格式的张量版本")[
  对一般
  $
    T ∈ V_1 ⊗ V_2 ⊗ V_3
  $
  甚至更高阶的 Segre / Segre–Veronese 格式，最近的 centroid 理论已经把上面这套骨架推广出去：centroid 是交换代数，投影到每个因子的映射单射，且 refined direct-sum decomposition 由其 maximal ideals / primitive idempotents 控制；特别地，张量 indecomposable 当且仅当 centroid 是 local。本文在算法节里会把这条定理当作 Murray 路线的结构基础。
]
= 算法、归约与复杂性分析

#definition("三种 TA oracle")[
  为避免“问题名相同、含义不同”，本文把 TA 分成三种 oracle：

  1. *TA-all*: 返回有限群 $"Aut"(T)$ 的全部元素；
  2. *TA-gen*: 返回 $"Aut"(T)$ 的一个生成元集合；
  3. *TA-dec*: 只回答 $"Aut"(T)$ 是否含非恒等元。
]

#proposition("对 TA-all 的一跳归约")[
  在有限域上，TI 对 TA-all 有直接的一跳 many-one 归约：输入 $(A, B)$，先做 minimal support reduction，构造
  $
    S := A ⊕ B,
  $
  然后检查 $"Aut"(S)$ 中是否存在 switch。
]

#proof[
  正确性由 switching criterion 给出。后处理只需逐个枚举整个自同构群并检测是否满足
  $
    P(U_A)=U_B,\ Q(V_A)=V_B,\ R(W_A)=W_B
  $
  以及反向交换。因为整群已经由 oracle 提供，所以这是输出敏感但概念上最干净的版本。
]

#proposition("对 TA-gen 的 Turing reduction")[
  在有限域上，若 TA oracle 返回生成元，则 TI 仍可归约到 TA，但需要补一层 group post-processing；更准确地说，这是一个 polynomial-time Turing reduction，而不是“单次查询后立刻读出 yes/no”的裸 many-one reduction。
]

#proof[
  还是构造
  $
    S := A ⊕ B.
  $
  正确性仍由 switching criterion 保证。困难只在检测：给定生成元
  $
    Γ ⊆ "Aut"(S),
  $
  生成群
  $
     Γ
  $
  可能包含 switch，但 *Γ 自身未必含 switch*。所以仅仅“扫描生成集里有没有一个交换块的元素”是不对的。

  检测 switch 有两条路线。

  路线 A 是矩阵群路线：把问题变成
  $
     Γ
  $
  对三对块子空间
  $
    (U_A, U_B), (V_A, V_B), (W_A, W_B)
  $
  的 transporter / orbit 问题。有限域上的 matrix-group polynomial-time theory 与 constructive membership 已经提供了这类后处理的标准工具。

  路线 B 是幂等元路线：求出 $S$ 的 centroid / 中心代数中的相关 idempotent，再看自同构群对这些 idempotent 或 primitive factors 的作用。对于 indecomposable promise，这条路线特别干净；一般情形则要处理 subset transport 或递归 refine decomposition。

  因此，TA-gen 模型成立，但 theorem statement 必须把“group generated by the oracle output”写清楚。
]


#proposition("TA-dec 一般不足")[
  只用 TA-dec，不能在一般情形下完成 TI 对 TA 的直接归约。
]

#proof[
  设
  $
    S = A ⊕ B.
  $
  即使
  $
    A not ≅ B,
  $
  也完全可能出现
  $
    "Aut"(A) != \{1\}
  $
  或
  $
    "Aut"(B) != \{1\},
  $
  从而
  $
    "Aut"(S) != \{1\}.
  $
  这时 TA-dec 只会返回“有非平凡自同构”，却无法告诉你这个自同构是内部对称性，还是能真正交换两块的 switch。

  因此，除非再施加刚性 promise（例如 $"Aut"(A)="Aut"(B)=\{1\}$ 且分解中没有等同型重复块），或者另外构造 rigidification gadget，否则 TA-dec 太弱。
]

#remark("一个可接受的限制版 positive result")[
  若限制在 *rigid indecomposable promise instances*：
  $
    "Aut"(A) = \{1\},\ "Aut"(B) = \{1\},
  $
  且不存在别的等同型干扰块，则
  $
    "Aut"(A ⊕ B)
  $
  非平凡当且仅当含 switch。

  所以在这个 promise 下，TI 确实可归约到 TA-dec。

  但这不是一般情形；把一般情形 rigidify 成这种 promise，是单独的 gadget 课题。
]

#table(
  columns: (1.6fr, 2.1fr, 2.8fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
  table.header([模型], [是否足以完成一般 TI → TA], [原因]),
  [TA-all], [可以], [整群已知，直接检测是否存在 switch],
  [TA-gen], [可以，但要后处理], [要解 transporter / orbit / membership 型群算法子问题],
  [TA-dec], [一般不可以], [非平凡 automorphism 可能来自内部对称，不一定来自 switch],
)

#proposition("复杂性估计")[
  记输入尺寸为 $N$。则：

  1. minimal support reduction 是线性代数问题，时间多项式于 $N$；
  2. 构造 $S = A ⊕ B$ 也是多项式时间；
      3. 若采用 TA-all，后处理复杂度是 $ "Pol"(n) $ 乘以 oracle 输出长度；
  4. 若采用 TA-gen 且底域为有限域，则后处理可以借助标准矩阵群与有限置换群的标准算法，在维数与 $log q$ 的多项式时间内完成；
  5. 若采用 centroid / idempotent 路线，则在有限域上可调用有限维代数结构算法求 primitive idempotents，通常为随机多项式时间。
]

#remark("有限域与无限域对比")[
  结构定理与 switching criterion 本身并不依赖有限域；真正依赖有限域的是“oracle 返回有限生成元后，我们怎样把它变成一个可计算的有限对象”。

  在有限域上，$"GL"_n(F_q)$ 本身是有限群，matrix-group 与 permutation-group 理论都比较成熟；而在无限域上，$"Aut"(T)$ 往往是无限的，甚至不应期望存在一个简短的“整群生成元表”。因此，若底域未指定，本文建议明确分开：

  *结构层面*：任意域。

  *算法层面*：有限域为主；特征 $0$ 或一般有效域需要额外规定 factorization / algebraic-group / Lie-theoretic oracle。
]

#table(
  columns: (1.3fr, 2.7fr, 2.8fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
    table.header([底域], [结构性结论], [算法性结论]),
  [有限域 $F_q$], [minimal support、switching lemma、centroid/direct-sum 结构都成立], [最适合写成 polynomial-time reduction；Rónyai / matrix-group routines 可接上],
  [char $0$ 的有效域], [结构仍成立], [若要算法化，需要额外规定因式分解、finite-vs-infinite group handling、algebraic-group 表示],
  [任意域], [主 iff 与 minimal support 内在性成立], [若 oracle 模型不加强，通常只能保留结构定理，不宜贸然声称统一多项式时间算法],
)

#summary("本文推荐的 theorem wording")[
  *最稳妥的写法* 是分三层：

  第一层（纯结构）：
  $
    A ≅ B ⟺ A ⊕ B
  $
  含 switching automorphism。

  第二层（有限域 + TA-gen / TA-all）：
  TI 对相应的 TA 版本存在 polynomial-time Turing reduction。

  第三层（TA-dec）：
  一般不成立；仅在 rigid promise 或额外 gadget 下成立。
]

= 需要修正的漏洞与代码验证计划

#warning("生成集 vs 生成群")[
  这是当前最需要在正文中就地修补的漏洞。只要 theorem proof 里出现“the oracle returns generators, hence one of them is a switch”，整段就不成立。
]

#warning("finite field vs infinite field")[
  若底域不先冻结，不能把“返回 generators of $"Aut"(T)$”当成无害假设。有限域中这是自然的，因为相关群有限；无限域中这件事经常根本不是一个合理输出模型。
]

#warning("对称／交替情形不要与一般三腿 GL 情形混写")[
  最终写作时应保持分类分离：本文主证明只服务于一般三腿 $"GL"(U) × "GL"(V) × "GL"(W)$ 的 Segre 格式；对称与交替只在 remark / future work 中点到为止。
]

#table(
  columns: (1.6fr, 2.8fr, 2.6fr),
  inset: 6pt,
  stroke: (paint: luma(180), thickness: 0.4pt),
    table.header([验证项], [最小代码实验], [预期现象]),
  [minimal support], [随机生成小尺寸张量，计算三条腿的 contraction span], [去掉零方向后，TI 实例尺寸下降但同构结论不变],
  [switch positive case], [取随机 $A$ 与其基变换副本 $B$，再构造 $S = A ⊕ B$], [$"Au"t(S)$ 中存在明显的块交换元素],
  [switch negative case], [取 $A ! ≅ B$ 但让 $"Aut"(A)$ 或 $"Aut"(B)$ 非平凡], [TA-dec 给出假阳性；说明 decision oracle 不够],
  [idempotent route], [从 structure constants 求有限维交换代数的 primitive idempotents], [完全分解时得到块投影；indecomp 时只得到 local algebra],
)



#pagebreak()

= 文中直接可引用的定理陈述草稿

#theorem("主结构定理草稿")[
  设
  $
    A ∈ U_A ⊗ V_A ⊗ W_A, quad
    B ∈ U_B ⊗ V_B ⊗ W_B
  $
  为有限维向量空间上的三阶张量。令它们都取在各自的 minimal support spaces 上，并记
  $
    S := A ⊕ B.
  $
  则下列条件等价：

  1. $A$ 与 $B$ 在 $"GL"(U_A) × "GL"(V_A) × "GL"(W_A)$ 意义下同构；
  2. 张量 $S$ 的自同构群中存在一个相对于二块分解的 switching automorphism。

  此外：

  (a) 若 TA oracle 返回整群 $"Aut"(S)$，则在有限域上可对该群直接做 switch 检测；
  (b) 若 TA oracle 返回生成元，则可在有限域上借助标准矩阵群 / 置换群后处理完成检测；
  (c) 若 TA oracle 只做“是否存在非平凡自同构”判定，则上述归约一般不成立。
]

#proposition("算法节中的推荐表述")[
  本文把 “TI 归约到 TA” 解释为：

  *结构层面*：单次构造
  $
    (A, B) mapsto S = A ⊕ B
  $
  加上 switching criterion；

  *算法层面*：视 oracle 模型不同，添加对应的群后处理，因而在 TA-gen / TA-all 下是 polynomial-time Turing reduction，在 TA-dec 下仅有受限版本。
]

#remark("成文时建议直接括注的参考口径")[
  相关工作建议在正文中直接写成：
  “张量—双线性复杂度语言取自 Strassen 1987；TI-complete 语境取自 Grochow–Qiao 2023 及其后续；环 automorphism / isomorphism 与 cubic-form equivalence 的复杂度背景见 Kayal–Saxena 与 Agrawal–Saxena；direct-sum / centroid / refined decomposition 的一般 Segre 处理见 Canino 等 2025，而 multilinear form 的中心代数原型见 Huang–Lu–Ye–Zhang 2023；有限维代数与 idempotent 的算法骨架参见 Rónyai 1990 与其后续。”
]
