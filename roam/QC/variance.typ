#import "/_typst/note.typ": *
#show: note-entry
#set heading(numbering: "1.")

#metadata((
  kind: "note",
  id: "20260130T000000-variance",
  title: "Variance",
  date: "2026-01-30",
  tags: ("qc", "measurement", "statistics", "concept",),
  aliases: (),
)) <note>

= 方差 (Variance)
#definition[
$ [ Delta  (M)]^(2)
  &= angle.l (M  -  lr(angle.l M angle.r) )^2 angle.r  \

  &=  lr(angle.l M^(2) angle.r)  -  lr(angle.l M angle.r) ^(2) $
]

#proof[
    设方差 (Variance) 的定义为：
$     "Var" =  sum _i p_i (m_i -  lr(angle.l M angle.r) )^2 $

    展开括号内的平方项：
    $     &=  sum _i p_i (m_i^2 - 2m_i lr(angle.l M angle.r)  +  lr(angle.l M angle.r) ^2)  \

    &=  sum _i p_i m_i^2 - 2 lr(angle.l M angle.r)   sum _i p_i m_i +  lr(angle.l M angle.r) ^2  sum _i p_i
     $

#important[
    其中利用以下统计性质：
    1. $ sum _i p_i m_i =  lr(angle.l M angle.r) $ (期望值的定义)
    2. $ sum _i p_i = 1$ (概率归一化条件)
    代入上式进行化简：
]

    $     &= (  sum _i p_i m_i^2 ) - 2 lr(angle.l M angle.r)   dot.op   lr(angle.l M angle.r)  +  lr(angle.l M angle.r) ^2  dot.op  1  \

    &= (  sum _i p_i m_i^2 ) - 2 lr(angle.l M angle.r) ^2 +  lr(angle.l M angle.r) ^2  \

    &= (  sum _i p_i m_i^2 ) -  lr(angle.l M angle.r) ^2
     $

    对于算符 $M^2$，其期望值写作：
$      lr(angle.l M^2 angle.r)  =  lr(angle.l psi | M^2 | psi angle.r)  =  lr(angle.l psi | M  dot.op  M | psi angle.r)  $

    考察算符 $M$ 的本征方程 $M lr(|m_i angle.r)  = m_i lr(|m_i angle.r) $，则 $M^2$ 的作用如下：
$     M  dot.op  M  =>  m_i' = m_i^2 $
    即 $M^2$ 的本征值为 $m_i^2$。

    此时对应的概率 $p_i'$ 为：
$     p_i' = | lr(angle.l m_i' | psi angle.r) |^2 $

    但在笔记中特别强调了一个核心性质（红色标注部分）：

    这意味着算符平方后，本征态没有改变，因此概率分布保持一致：
$     p_i' = | lr(angle.l m_i | psi angle.r) |^2 = p_i $

    因此，$M^2$ 的期望值就是 $m_i^2$ 的加权和：
$      lr(angle.l M^2 angle.r)  =  sum  m_i^2 p_i =  sum  p_i m_i^2 $

    结合第 1 部分的展开结果与第 2 部分的算符期望定义，得证：
$      therefore  "Var" =  lr(angle.l M^2 angle.r)  -  lr(angle.l M angle.r) ^2 $
    ■
]

// #+INCLUDE: "./quantum_state.org"

end of file
