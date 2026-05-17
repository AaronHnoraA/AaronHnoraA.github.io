#+begin meta
id: 20260126T000000-hilbert-space
title: Hilbert Space
date: 2026-01-26
tags: math, structure, concept, intuition, working, QC, algebra, linear\_algebra
source: roam/math/hilbert\_space.md
#+end meta

# Hilbert Space

# Hilbert Space 希尔伯特空间

#+begin attention
Hilbert space is a big space.
----- Carlton Caves
#+end attention

## 1. 数学理解 (Mathematical Understanding)

本质是将欧几里得空间 ($bb(R)^(n)$) 推广到*无限维*，并保留几何直观。

- *核心定义*: 一个*完备 (Complete)* 的*内积空间 (Inner Product Space)*。

  - *内积 ($ lr(angle.l u, v angle.r) $)*: 定义了“角度”和“投影”。若内积为 0，则两向量正交。
  - *范数 ($||v||$)*: 由内积导出 ($||v|| = sqrt( lr(angle.l v, v angle.r) )$)，定义了向量的“长度”。
  - *完备性*: 空间内的柯西序列收敛于空间内（保证极限存在，微积分可行）。
- *常见例子*:

  - $bb(R)^n$ (有限维希尔伯特空间)。
  - $L^2$ 空间 (平方可积函数空间，量子力学中最常用)。

## 2. 量子应用 (Quantum Applications)

量子力学的公理化数学基础。

- *态 (State)*: 物理系统的状态由希尔伯特空间中的*射线*（归一化向量 $ lr(|psi angle.r) $）描述。
- *叠加原理*: 向量的线性组合仍然是空间中的一个有效向量。
- *可观测量*: 对应于作用在空间上的*厄米算符 (Hermitian Operators)*。

  - 算符的*本征值*是测量的可能结果。
  - 算符的*本征态*构成空间的基底。
- *概率 (Born Rule)*: 概率幅由内积给出，概率为内积的模方 ($P = | lr(angle.l phi | psi angle.r) |^2$)。

# 有限维必完备

#+begin theorem
在有限维内积空间中，所有柯西序列均收敛于该空间内的某个向量。因此，有限维内积空间([Inner Product Space](inner_product_space.md))天然是完备的，即有限维内积空间即为希尔伯特空间。
#+end theorem

#+begin proof
# 证明思路

```
- 选取正交基
- 将向量柯西列转化为坐标柯西列
- 利用实数/复数的完备性
- 再拼回向量极限
```

# 证明

```
设 $V$ 是 $N$ 维复内积空间。
```

## Step 1：选取正交基

```
由 Gram–Schmidt 正交化，存在正交基：
```

$     {e_1,e_2, dots ,e_N} $

## Step 2：设 ${v_i}$ 为柯西列

```
对任意 $ epsilon.alt >0$，存在 $n$，
使得当 $i,j>n$ 时：
```

$     d(v_i,v_j)< epsilon.alt  $

## Step 3：写成坐标形式

```
对每个 $i$，存在唯一的 $z_(i k) in bb(C)$，
使得：
```

$     v_i= sum _(k=1)^N z_(i k)e_k $

## Step 4：距离的坐标表达

```
由正交性：
```

$    d(v_i,v_j)^2 = sum _(k=1)^N |z_(i k)-z_(j k)|^2 < epsilon.alt ^2 $

## Step 5：拆分为实部与虚部

```
记：
```

$     z_(i k)=x_(i k)+i y_(i k) $

```
则：
$$  sum _(k=1)^N |x_(i k)-x_(j k)|^2

+ sum _(k=1)^N |y_(i k)-y_(j k)|^2
<  epsilon.alt ^2 $$
```

## Step 6：坐标收敛

```
对每个 $k$，
${x_(i k)}_i,{y_(i k)}_i$ 为实数柯西列。

由 $bb(R)$ 的完备性，
存在 $x_k,y_k in bb(R)$，
使得：
```

$     x_(i k) ->  x_k, quad  y_(i k) ->  y_(k) $

## Step 7：构造极限向量

```
令：
```

$     z\_k=x\_k+i y\_k, quad
v= sum \_(k=1)^N z\_k e\_k $

```
则：
```

$     d(v_i,v) ->  0 $

```
故：
```

$     v_i ->  v $

# 结论

```
有限维内积空间是完备的。
```
#+end proof

# 希尔伯特空间的相互作用

#+begin theorem
希尔伯特空间的相互作用
给定任意两个（或更多）希尔伯特空间，利用直和或张量积的方式，可以给出一个更大的希尔伯特空间。
#+end theorem

这意味着 这为量子力学中张量积干涉两个量子系统提供了理论支撑.