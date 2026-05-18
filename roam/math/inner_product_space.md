#+begin meta
id: 20260127T000000-inner-product-space
title: Inner Product Space
date: 2026-01-27
tags: math, QC, concept, algebra, linear\_algebra
source: roam/math/inner\_product\_space.md
#+end meta

# Inner Product Space 内积空间

#+begin summary
An inner product space is a vector space equipped with an additional operation called an inner product. The inner product allows us to define geometric notions such as length, angle, orthogonality, norm, distance, convergence, and completeness.

The conceptual chain is:

$$
\text{inner product}
\Longrightarrow
\text{norm}
\Longrightarrow
\text{metric}
\Longrightarrow
\text{convergence}
\Longrightarrow
\text{completeness}.
$$
#+end summary

# Basic Setup 基本设定

Let $F$ be a scalar field. Usually,

$$
F = \mathbb{R}
$$

or

$$
F = \mathbb{C}.
$$

Let $V$ be a vector space over $F$.

That is, $V$ is equipped with:

- vector addition

  $$
        + : V \times V \to V,
  $$
- scalar multiplication

  $$
        \cdot : F \times V \to V.
  $$

An inner product is a function

$$
\langle \cdot,\cdot \rangle : V \times V \to F.
$$

For $v,w \in V$, we usually write

$$
\langle v,w \rangle \in F.
$$

# Axiomatic Definition of an Inner Product 内积的公理化定义

#+begin define
Let $V$ be a vector space over $F$, where $F = \mathbb{R}$ or $F = \mathbb{C}$.

An inner product on $V$ is a function

$$
\langle \cdot,\cdot \rangle : V \times V \to F
$$

satisfying the following axioms.

1. Conjugate symmetry 共轭对称性:

   $$
   \langle v,w \rangle
===

      \overline{\langle w,v \rangle}

   $$
   
         for all $v,w \in V$.
   
      2. Additivity in the first variable 第一变量加法线性:
   
   $$

   \\langle v\_1 + v\_2, w \\rangle
===

      \\langle v\_1,w \\rangle
   +
   \\langle v\_2,w \\rangle

   $$
   
         for all $v_1,v_2,w \in V$.
   
      3. Homogeneity in the first variable 第一变量齐次线性:
   
   $$

   \\langle \\lambda v,w \\rangle
===

      \\lambda \\langle v,w \\rangle

   $$
   
         for all $\lambda \in F$ and all $v,w \in V$.
   
      4. Positive-definiteness 正定性:
   
   $$

      \\langle v,v \\rangle \\ge 0

   $$
   
         for all $v \in V$, and
   
   $$

      \\langle v,v \\rangle = 0
   \\Longleftrightarrow
   v = 0.
   $$

If such a function is given, then $V$ is called an inner product space.
#+end define

#+begin note
Here we use the mathematical convention: the inner product is linear in the first variable and conjugate-linear in the second variable.

也就是说，这里采用数学约定：第一变量线性，第二变量共轭线性。
#+end note

# Consequence: Conjugate Linearity in the Second Variable

Because of conjugate symmetry and linearity in the first variable, the inner product is conjugate-linear in the second variable.

For example,

$$
\\langle v, w\_1 + w\_2 \\rangle
===

\\langle v,w\_1 \\rangle
+
\\langle v,w\_2 \\rangle,

$$

and

$$

\\langle v, \\lambda w \\rangle
===

\\overline{\\lambda}\\langle v,w \\rangle.

$$

#+begin proof
Using conjugate symmetry,

$$

\\langle v,\\lambda w \\rangle
===

\\overline{\\langle \\lambda w,v \\rangle}.

$$

By linearity in the first variable,

$$

\\langle \\lambda w,v \\rangle
===

\\lambda \\langle w,v \\rangle.

$$

Therefore,

$$

\\langle v,\\lambda w \\rangle
===

\\overline{\\lambda \\langle w,v \\rangle}
===

\\overline{\\lambda},\\overline{\\langle w,v \\rangle}.

$$

Again using conjugate symmetry,

$$

\\overline{\\langle w,v \\rangle}
===

\\langle v,w \\rangle.

$$

Hence,

$$

\\langle v,\\lambda w \\rangle
===

\\overline{\\lambda}\\langle v,w \\rangle.

$$
#+end proof

# Real and Complex Inner Product Spaces 实内积空间与复内积空间

If $F = \mathbb{R}$, then $V$ is called a real inner product space.

If $F = \mathbb{C}$, then $V$ is called a complex inner product space.

In the real case, complex conjugation is trivial, so conjugate symmetry becomes ordinary symmetry:

$$

\\langle v,w \\rangle
===

\\langle w,v \\rangle.

$$

In the complex case, one must keep the conjugation:

$$

\\langle v,w \\rangle
===

\\overline{\\langle w,v \\rangle}.

$$

# Orthogonality 正交

#+begin define
Let $V$ be an inner product space. Two vectors $v,w \in V$ are called orthogonal if

$$

\\langle v,w \\rangle = 0.

$$

We write

$$

v \\perp w.

$$
#+end define

Intuitively, orthogonality generalises the idea of perpendicular vectors in Euclidean geometry.

中文直觉：正交就是“内积为零”的抽象垂直性。

# From Inner Product to Length 从内积到长度

The inner product gives a notion of squared length.

For $v \in V$, define

$$

|v|^2
===

\\langle v,v \\rangle.

$$

Since the inner product is positive-definite,

$$

\\langle v,v \\rangle \\ge 0.

$$

Therefore it makes sense to define

$$

|v|
===

\\sqrt{\\langle v,v \\rangle}.

$$

This is the length of $v$ induced by the inner product.

# Norm Induced by an Inner Product 内积诱导的范数

#+begin define
Let $V$ be an inner product space. The norm induced by the inner product is

$$

|v|
===

\\sqrt{\\langle v,v \\rangle}.

$$

This function

$$

|\\cdot| : V \\to \\mathbb{R}\_{\\ge 0}

$$

is called the induced norm.
#+end define

The induced norm satisfies:

1. Non-negativity:

$$

   |v| \\ge 0.

$$

2. Definiteness:

$$

   |v| = 0
\\Longleftrightarrow
v = 0.

$$

3. Homogeneity:

$$

|\\lambda v|
===

   |\\lambda||v|.

$$

4. Triangle inequality:

$$

   |v+w|
\\le
|v|+|w|.

$$

Thus every inner product space is naturally a normed vector space.

# Distance Induced by the Norm 范数诱导的距离

#+begin define
Let $V$ be an inner product space with induced norm $\|\cdot\|$.

Define

$$

d(v,w)
===

|v-w|.

$$

Then

$$

d : V \\times V \\to \\mathbb{R}\_{\\ge 0}

$$

is called the metric induced by the inner product.
#+end define

This metric satisfies:

1. Non-negativity:

$$

   d(v,w) \\ge 0.

$$

2. Definiteness:

$$

   d(v,w)=0
\\Longleftrightarrow
v=w.

$$

3. Symmetry:

$$

d(v,w)
===

   d(w,v).

$$

4. Triangle inequality:

$$

   d(u,w)
\\le
d(u,v)+d(v,w).

$$

Thus every inner product space is naturally a metric space.

# Convergence 极限与收敛

Once a distance function is available, we can define convergence.

#+begin define
Let $(V,d)$ be the metric space induced by an inner product space.

A sequence $(v_n)_{n \in \mathbb{N}}$ converges to $v \in V$ if

$$

\\lim\_{n \\to \\infty} d(v\_n,v)=0.

$$

Equivalently,

$$

\\lim\_{n \\to \\infty} |v\_n-v|=0.

$$

We write

$$

v\_n \\to v.

$$
#+end define

So in an inner product space,

$$

v\_n \\to v

$$

means that the distance between $v_n$ and $v$ goes to zero.

中文直觉：收敛就是“越来越靠近”，而“靠近”由内积诱导出的距离来衡量。

# Cauchy Sequences 柯西列

To define completeness, we first need Cauchy sequences.

#+begin define
Let $(V,d)$ be the metric space induced by an inner product space.

A sequence $(v_n)_{n \in \mathbb{N}}$ is called a Cauchy sequence if for every $\varepsilon > 0$, there exists $N \in \mathbb{N}$ such that for all $m,n \ge N$,

$$

d(v\_m,v\_n) \< \\varepsilon.

$$

Equivalently,

$$

|v\_m-v\_n| \< \\varepsilon.

$$
#+end define

Intuitively, a Cauchy sequence is a sequence whose terms eventually become arbitrarily close to each other.

注意：Cauchy 条件只要求序列内部越来越接近，不直接指定它要收敛到哪个点。

# Completeness 完备性

#+begin define
An inner product space $V$ is complete if every Cauchy sequence in $V$ converges to an element of $V$.
#+end define

In symbols, $V$ is complete if

$$

(v\_n) \\text{ is Cauchy}
\\Longrightarrow
\\exists v \\in V
\\text{ such that }
v\_n \\to v.

$$

A complete inner product space is called a Hilbert space.

#+begin define
A Hilbert space is a complete inner product space.
#+end define

Thus the hierarchy is:

$$

\\text{inner product space}
\\Longrightarrow
\\text{normed vector space}
\\Longrightarrow
\\text{metric space}.

$$

If the induced metric is complete, then we get:

$$

\\text{complete inner product space}
===

\\text{Hilbert space}.

$$

# Mathematical vs Physical Convention 数学与物理约定的区别

There are two common conventions for complex inner products.

## Mathematical Convention 数学约定

In mathematics, especially in linear algebra and functional analysis, the inner product is usually taken to be linear in the first variable:

$$

\\langle \\lambda v,w \\rangle
===

\\lambda \\langle v,w \\rangle,

$$

and conjugate-linear in the second variable:

$$

\\langle v,\\lambda w \\rangle
===

\\overline{\\lambda}\\langle v,w \\rangle.

$$

## Physical Convention 物理约定

In physics, especially in Dirac notation, the inner product is usually taken to be linear in the second variable:

$$

\\langle v,\\lambda w \\rangle
===

\\lambda \\langle v,w \\rangle,

$$

and conjugate-linear in the first variable:

$$

\\langle \\lambda v,w \\rangle
===

\\overline{\\lambda}\\langle v,w \\rangle.

$$

This convention is natural for expressions like

$$

\\langle \\psi \\mid \\phi \\rangle.

$$

Here the ket $|\phi\rangle$ is treated as the vector input, so linearity is placed on the ket side.

#+begin important
The two conventions are mathematically equivalent, but one must be consistent.

真正重要的不是哪一个变量线性，而是整篇文章中必须保持同一个约定。
#+end important

# Conceptual Chain 概念链条

The whole structure can be summarised as follows.

1. Start with a vector space:

$$

   V.

$$

2. Add an inner product:

$$

   \\langle v,w \\rangle.

$$

3. The inner product gives squared length:

$$

|v|^2
===

   \\langle v,v \\rangle.

$$

4. Squared length gives a norm:

$$

|v|
===

   \\sqrt{\\langle v,v \\rangle}.

$$

5. The norm gives a distance:

$$

d(v,w)
===

   |v-w|.

$$

6. The distance gives a notion of convergence:

$$

   v\_n \\to v
\\Longleftrightarrow
d(v\_n,v) \\to 0.

$$

7. The distance also gives a notion of Cauchy sequence:

$$

   (v\_n) \\text{ is Cauchy}
\\Longleftrightarrow
\\forall \\varepsilon \> 0,\\ \\exists N,\\ \\forall m,n \\ge N,\\ d(v\_m,v\_n)\<\\varepsilon.

$$

8. Completeness means every Cauchy sequence converges inside the space:

$$

   (v\_n) \\text{ is Cauchy}
\\Longrightarrow
\\exists v \\in V,\\ v\_n \\to v.

$$

9. A complete inner product space is a Hilbert space:

$$

\\text{Hilbert space}
===

   \\text{complete inner product space}.

$$

#+begin summary
An inner product space is not just a vector space with an extra operation. The inner product generates the whole analytic structure:

$$

\\langle \\cdot,\\cdot \\rangle
\\Longrightarrow
|\\cdot|
\\Longrightarrow
d
\\Longrightarrow
\\text{convergence}
\\Longrightarrow
\\text{completeness}.
$$

This is why inner product spaces are central in linear algebra, functional analysis, and quantum computing.
#+end summary