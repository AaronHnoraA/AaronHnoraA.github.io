#+begin meta
id: 20260126T000000-hilbert-space
title: Hilbert Space
date: 2026-01-26
tags: math, structure, concept, intuition, working, QC, algebra, linear_algebra
source: roam/math/hilbert_space.md
#+end meta

# Hilbert Space 希尔伯特空间

#+begin attention Hilbert
"Hilbert space is a big space." --- Carlton Caves
#+end attention

#+begin summary
A Hilbert space is a complete inner product space.

Conceptually, it generalises Euclidean space while preserving the geometric notions of length, angle, orthogonality, projection, and convergence.

The key chain is:

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

If an inner product space is complete with respect to the metric induced by its norm, then it is a Hilbert space.
#+end summary

## 1. Mathematical Understanding 数学理解

The essential idea is to generalise Euclidean space

$$
\mathbb{R}^n
$$

to possibly infinite-dimensional settings while preserving geometric intuition.

#+begin define
A Hilbert space is a complete inner product space.
#+end define

Equivalently, a Hilbert space is a vector space $H$ equipped with an inner product

$$
\langle \cdot,\cdot \rangle : H \times H \to F,
$$

where usually $F=\mathbb{R}$ or $F=\mathbb{C}$, such that every Cauchy sequence in $H$ converges to an element of $H$.

### Core Components 核心组成

- **Inner product 内积**

  The inner product

  $$
  \langle u,v\rangle
  $$

  defines geometric notions such as angle, orthogonality, and projection.

  If

  $$
  \langle u,v\rangle = 0,
  $$

  then $u$ and $v$ are orthogonal.

- **Norm 范数**

  The norm is induced by the inner product:

  $$
  \|v\|
  =
  \sqrt{\langle v,v\rangle}.
  $$

  It measures the length of a vector.

- **Metric 距离**

  The norm induces a distance function:

  $$
  d(u,v)
  =
  \|u-v\|.
  $$

- **Completeness 完备性**

  Completeness means that every Cauchy sequence converges to an element inside the same space.

  In symbols, if $(v_n)$ is Cauchy, then there exists $v \in H$ such that

  $$
  v_n \to v.
  $$

  中文直觉：完备性保证“应该存在的极限”不会跑到空间外面去。

### Common Examples 常见例子

1. Finite-dimensional Euclidean spaces:

   $$
   \mathbb{R}^n.
   $$

2. Finite-dimensional complex spaces:

   $$
   \mathbb{C}^n.
   $$

3. The space of square-integrable functions:

   $$
   L^2(X).
   $$

   This is one of the most important examples in quantum mechanics.

## 2. Quantum Application 量子应用

Hilbert spaces provide the mathematical foundation for the axiomatic formulation of quantum mechanics.

### States 态

A quantum state is represented by a ray in a Hilbert space.

Equivalently, one often represents a state by a normalised vector

$$
|\psi\rangle \in H
$$

with

$$
\langle \psi \mid \psi \rangle = 1.
$$

Strictly speaking, two nonzero vectors that differ by a nonzero scalar represent the same physical ray. In ordinary quantum mechanics, global phase does not change the physical state:

$$
|\psi\rangle
\sim
e^{i\theta}|\psi\rangle.
$$

### Superposition 叠加原理

If $|\psi\rangle$ and $|\phi\rangle$ are state vectors, then their linear combination

$$
\alpha |\psi\rangle + \beta |\phi\rangle
$$

is also a vector in the Hilbert space.

After normalisation, it can represent another quantum state.

### Observables 可观测量

Physical observables are represented by Hermitian operators.

An operator $A$ is Hermitian if

$$
A^\dagger = A.
$$

The eigenvalues of a Hermitian operator are possible measurement outcomes.

The eigenvectors or eigenspaces describe the corresponding states after measurement.

### Born Rule 玻恩规则

The inner product gives probability amplitudes.

If a system is in state $|\psi\rangle$ and we measure whether it is in state $|\phi\rangle$, then the probability is

$$
P
=
|\langle \phi \mid \psi\rangle|^2.
$$

This is one of the main reasons Hilbert spaces are central in quantum theory.

## 3. Finite-Dimensional Inner Product Spaces Are Complete

有限维内积空间必然完备。

#+begin theorem
Every finite-dimensional inner product space is complete.

Equivalently, every finite-dimensional inner product space is a Hilbert space.
#+end theorem

#+begin proof
Let $V$ be an $N$-dimensional inner product space over $\mathbb{C}$.

The real case is similar and slightly simpler.

### Proof Idea 证明思路

We prove completeness by reducing vector convergence to coordinate convergence.

The steps are:

1. choose an orthonormal basis;
2. write each vector in coordinates;
3. show that a Cauchy sequence of vectors gives Cauchy sequences of coordinates;
4. use completeness of $\mathbb{C}$;
5. reconstruct the limit vector.

### Step 1: Choose an orthonormal basis

Since $V$ is finite-dimensional, by the Gram--Schmidt process there exists an orthonormal basis

$$
\{e_1,e_2,\dots,e_N\}.
$$

Thus every vector $v \in V$ can be written uniquely as

$$
v
=
\sum_{k=1}^N z_k e_k,
$$

where $z_k \in \mathbb{C}$.

### Step 2: Let $(v_i)$ be a Cauchy sequence

Let $(v_i)_{i \in \mathbb{N}}$ be a Cauchy sequence in $V$.

By definition, for every $\varepsilon > 0$, there exists $M \in \mathbb{N}$ such that for all $i,j \ge M$,

$$
\|v_i-v_j\| < \varepsilon.
$$

Equivalently,

$$
d(v_i,v_j) < \varepsilon.
$$

### Step 3: Write each vector in coordinates

For each $i$, write

$$
v_i
=
\sum_{k=1}^N z_{ik} e_k,
$$

where $z_{ik} \in \mathbb{C}$.

Then

$$
v_i-v_j
=
\sum_{k=1}^N (z_{ik}-z_{jk})e_k.
$$

### Step 4: Use the norm formula in an orthonormal basis

Because $\{e_1,\dots,e_N\}$ is orthonormal,

$$
\|v_i-v_j\|^2
=
\sum_{k=1}^N |z_{ik}-z_{jk}|^2.
$$

Since $(v_i)$ is Cauchy, for all sufficiently large $i,j$,

$$
\sum_{k=1}^N |z_{ik}-z_{jk}|^2
<
\varepsilon^2.
$$

Therefore, for each fixed $k$,

$$
|z_{ik}-z_{jk}|^2
\le
\sum_{\ell=1}^N |z_{i\ell}-z_{j\ell}|^2
<
\varepsilon^2.
$$

Hence

$$
|z_{ik}-z_{jk}|
<
\varepsilon.
$$

So for each $k$, the coordinate sequence $(z_{ik})_{i \in \mathbb{N}}$ is Cauchy in $\mathbb{C}$.

### Step 5: Use completeness of $\mathbb{C}$

Since $\mathbb{C}$ is complete, for each $k$ there exists $z_k \in \mathbb{C}$ such that

$$
z_{ik} \to z_k
$$

as $i \to \infty$.

### Step 6: Construct the candidate limit vector

Define

$$
v
=
\sum_{k=1}^N z_k e_k.
$$

Since $V$ is a vector space and $e_1,\dots,e_N \in V$, we have

$$
v \in V.
$$

### Step 7: Show that $v_i \to v$

We compute

$$
v_i-v
=
\sum_{k=1}^N (z_{ik}-z_k)e_k.
$$

Again using orthonormality,

$$
\|v_i-v\|^2
=
\sum_{k=1}^N |z_{ik}-z_k|^2.
$$

For each fixed $k$,

$$
z_{ik} \to z_k.
$$

Since the sum is finite,

$$
\sum_{k=1}^N |z_{ik}-z_k|^2
\to 0.
$$

Therefore,

$$
\|v_i-v\| \to 0.
$$

So

$$
v_i \to v.
$$

Thus every Cauchy sequence in $V$ converges to an element of $V$.

Therefore $V$ is complete.

Hence every finite-dimensional inner product space is a Hilbert space.
#+end proof

#+begin important
The finite-dimensional assumption is essential.

In infinite-dimensional spaces, an inner product space need not be complete. A Hilbert space is precisely an inner product space where this completeness condition has been imposed.
#+end important

## 4. Interaction of Hilbert Spaces 希尔伯特空间之间的构造

Hilbert spaces can be combined to form larger Hilbert spaces.

There are two especially important operations:

$$
H_1 \oplus H_2
$$

and

$$
H_1 \otimes H_2.
$$

### Direct Sum 直和

#+begin define
Given two Hilbert spaces $H_1$ and $H_2$, their direct sum is

$$
H_1 \oplus H_2
=
\{(v_1,v_2) : v_1 \in H_1,\ v_2 \in H_2\}.
$$

The inner product is defined by

$$
\langle (v_1,v_2),(w_1,w_2)\rangle
=
\langle v_1,w_1\rangle_{H_1}
+
\langle v_2,w_2\rangle_{H_2}.
$$
#+end define

The direct sum describes a space where states or vectors are placed side by side.

Intuitively:

$$
H_1 \oplus H_2
\quad
\text{means choosing between sectors/components.}
$$

### Tensor Product 张量积

#+begin define
Given two Hilbert spaces $H_1$ and $H_2$, their tensor product is a Hilbert space

$$
H_1 \otimes H_2
$$

generated by formal tensors

$$
v_1 \otimes v_2,
$$

where $v_1 \in H_1$ and $v_2 \in H_2$.
#+end define

The tensor product is the fundamental construction for combining quantum systems.

If one system has Hilbert space $H_A$ and another has Hilbert space $H_B$, then the joint system has Hilbert space

$$
H_A \otimes H_B.
$$

For example, if

$$
|\psi\rangle \in H_A
$$

and

$$
|\phi\rangle \in H_B,
$$

then the product state is

$$
|\psi\rangle \otimes |\phi\rangle
\in
H_A \otimes H_B.
$$

But not every vector in $H_A \otimes H_B$ is a simple product vector. Some vectors are entangled states.

For example,

$$
\frac{1}{\sqrt{2}}
\left(
|00\rangle + |11\rangle
\right)
$$

is an entangled state in

$$
\mathbb{C}^2 \otimes \mathbb{C}^2.
$$

#+begin important
For quantum mechanics, the tensor product is more fundamental than the direct sum for describing composite systems.

If two systems are considered together, their joint state space is usually

$$
H_A \otimes H_B,
$$

not

$$
H_A \oplus H_B.
$$
#+end important

## 5. Conceptual Summary 概念总结

A Hilbert space is a vector space with enough structure to do both geometry and analysis.

The structure can be viewed as the following chain:

$$
\text{vector space}
\Longrightarrow
\text{inner product space}
\Longrightarrow
\text{normed vector space}
\Longrightarrow
\text{metric space}
\Longrightarrow
\text{complete metric structure}.
$$

So:

$$
\text{Hilbert space}
=
\text{inner product space}
+
\text{completeness}.
$$

In quantum computing, Hilbert spaces matter because:

1. quantum states are vectors or rays in Hilbert spaces;
2. amplitudes are computed using inner products;
3. measurement probabilities are given by the Born rule;
4. observables are represented by Hermitian operators;
5. composite systems are represented by tensor products.

#+begin summary
A Hilbert space is the natural mathematical home for quantum theory.

It is linear enough to support superposition, geometric enough to support orthogonality and projection, and complete enough to support limits, approximation, and analysis.
#+end summary