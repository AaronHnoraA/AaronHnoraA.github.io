#+begin meta
id: 20260128T000000-density-operator
title: Density Operator
date: 2026-01-28
tags: quantum, density, state, operator
source: roam/QC/density_operator.md
#+end meta

# Density Operator 密度算符

#+begin summary
A density operator is the most general mathematical representation of a quantum state.

It includes both:

- pure states, which can be represented by a single state vector $|\psi\rangle$;
- mixed states, which describe probabilistic uncertainty over possible pure states.

The density-operator formalism unifies the expectation-value formula as

$$
\langle A\rangle
=
\operatorname{tr}(\rho A).
$$
#+end summary

# 1. Why Density Operators Are Needed 为什么要引入密度算符

Not every quantum state is best described by a single vector $|\psi\rangle$.

A state vector describes a **pure state**. However, in many situations we only know that the system is in one of several possible pure states with certain classical probabilities.

For example, suppose we know that the system is in state

$$
|\psi_i\rangle
$$

with probability

$$
p_i,
$$

where

$$
p_i \ge 0,
\qquad
\sum_i p_i = 1.
$$

But we do not know which $|\psi_i\rangle$ was actually prepared.

In this situation, a single state vector is not enough. We need an object that can encode both:

1. quantum superposition inside each $|\psi_i\rangle$;
2. classical uncertainty over which $|\psi_i\rangle$ was prepared.

This object is the density operator.

中文直觉：

- $|\psi\rangle$ 描述“系统就在这个纯量子态里”；
- $\rho$ 描述“系统可能以不同概率处于不同量子态里”。

# 2. Definition of Density Operator 密度算符的定义

#+begin define
Let $H$ be a Hilbert space. A density operator on $H$ is a linear operator

$$
\rho : H \to H
$$

satisfying:

1. positivity:

   $$
   \rho \ge 0,
   $$

   meaning

   $$
   \langle \psi|\rho|\psi\rangle \ge 0
   $$

   for all $|\psi\rangle \in H$;

2. self-adjointness:

   $$
   \rho^\dagger = \rho;
   $$

3. trace normalization:

   $$
   \operatorname{tr}(\rho)=1.
   $$
#+end define

#+begin note
Actually, positivity already implies self-adjointness in the standard finite-dimensional setting. But it is common and pedagogically useful to list both conditions.
#+end note

The expectation value of an observable $A$ in state $\rho$ is

$$
\langle A\rangle
=
\operatorname{tr}(\rho A).
$$

Equivalently, using cyclicity of trace,

$$
\operatorname{tr}(\rho A)
=
\operatorname{tr}(A\rho).
$$

So both conventions are common:

$$
\langle A\rangle
=
\operatorname{tr}(\rho A)
=
\operatorname{tr}(A\rho).
$$

# 3. Density Operator from an Ensemble 从系综得到密度算符

Suppose the system is prepared as follows:

- with probability $p_i$, prepare the pure state $|\psi_i\rangle$;
- the probabilities satisfy

  $$
  p_i \ge 0,
  \qquad
  \sum_i p_i = 1.
  $$

Then the corresponding density operator is

$$
\rho
=
\sum_i p_i |\psi_i\rangle\langle \psi_i|.
$$

This is called a mixed-state ensemble representation.

#+begin important
The same density operator can have many different ensemble decompositions.

That is,

$$
\rho
=
\sum_i p_i |\psi_i\rangle\langle \psi_i|
$$

does not uniquely determine the ensemble $\{p_i,|\psi_i\rangle\}_i$.

Physically, the density operator $\rho$ is what determines all measurement statistics, not a particular ensemble decomposition.
#+end important

# 4. Pure States as Density Operators 纯态是特殊的密度算符

If the system is in a pure state $|\psi\rangle$, where

$$
\langle \psi|\psi\rangle = 1,
$$

then its density operator is

$$
\rho_\psi
=
|\psi\rangle\langle \psi|.
$$

This operator is:

1. a rank-one orthogonal projection;
2. positive semidefinite;
3. trace-one;
4. idempotent:

   $$
   \rho_\psi^2 = \rho_\psi.
   $$

Indeed,

$$
\rho_\psi^2
=
|\psi\rangle\langle \psi|\psi\rangle\langle \psi|
=
|\psi\rangle \langle \psi|\psi\rangle \langle \psi|
=
|\psi\rangle\langle \psi|
=
\rho_\psi.
$$

Here we used

$$
\langle \psi|\psi\rangle = 1.
$$

# 5. Expectation Value for Pure States 纯态期望值公式

For a pure state

$$
\rho_\psi
=
|\psi\rangle\langle \psi|,
$$

the density-operator expectation formula becomes

$$
\langle A\rangle
=
\operatorname{tr}(\rho_\psi A).
$$

Substituting $\rho_\psi$,

$$
\langle A\rangle
=
\operatorname{tr}(|\psi\rangle\langle \psi|A).
$$

Using cyclicity of trace,

$$
\operatorname{tr}(|\psi\rangle\langle \psi|A)
=
\operatorname{tr}(\langle \psi|A|\psi\rangle).
$$

Since $\langle \psi|A|\psi\rangle$ is a scalar,

$$
\operatorname{tr}(\langle \psi|A|\psi\rangle)
=
\langle \psi|A|\psi\rangle.
$$

Therefore,

$$
\operatorname{tr}(\rho_\psi A)
=
\langle \psi|A|\psi\rangle.
$$

So the density-operator formula agrees with the usual state-vector formula.

#+begin summary
For a pure state,

$$
\rho_\psi = |\psi\rangle\langle \psi|,
$$

and

$$
\operatorname{tr}(\rho_\psi A)
=
\langle \psi|A|\psi\rangle.
$$
#+end summary

# 6. Pure States and Mixed States 纯态与混合态

#+begin define
A density operator $\rho$ is called a pure state if there exists a unit vector $|\psi\rangle$ such that

$$
\rho
=
|\psi\rangle\langle \psi|.
$$
#+end define

#+begin define
A density operator $\rho$ is called a mixed state if it is not pure.
#+end define

Equivalently, in finite dimensions:

$$
\rho \text{ is pure}
\Longleftrightarrow
\rho^2 = \rho
\Longleftrightarrow
\operatorname{tr}(\rho^2)=1.
$$

A mixed state satisfies

$$
\operatorname{tr}(\rho^2)<1.
$$

The quantity

$$
\operatorname{tr}(\rho^2)
$$

is called the purity of $\rho$.

# 7. Geometric Structure 几何结构

The set of all density operators on a Hilbert space forms a convex set.

That means if $\rho_1$ and $\rho_2$ are density operators, and

$$
0 \le \lambda \le 1,
$$

then

$$
\rho
=
\lambda \rho_1 + (1-\lambda)\rho_2
$$

is also a density operator.

The interpretation is:

- with probability $\lambda$, prepare $\rho_1$;
- with probability $1-\lambda$, prepare $\rho_2$.

Thus classical probabilistic mixing corresponds exactly to convex combination of density operators.

#+begin summary
The geometry is:

$$
\text{all density operators}
=
\text{a convex set}.
$$

Inside this convex set:

$$
\text{pure states}
=
\text{extreme points},
$$

and

$$
\text{mixed states}
=
\text{non-extreme points}.
$$
#+end summary

# 8. Pure States as Extreme Points 纯态作为极端点

A pure state cannot be written as a nontrivial convex combination of two different density operators.

That is, if

$$
|\psi\rangle\langle \psi|
=
\lambda \rho_1 + (1-\lambda)\rho_2
$$

with

$$
0<\lambda<1,
$$

then necessarily

$$
\rho_1 = \rho_2 = |\psi\rangle\langle \psi|.
$$

So pure states are extreme points of the convex set of density operators.

Mixed states, by contrast, can be decomposed as nontrivial convex combinations of other density operators.

中文直觉：

- 纯态是凸集合的“顶点”；
- 混合态在凸集合的“内部”或“边上”；
- 混合态可以被看成多个状态的概率混合。

# 9. Classical and Quantum Uncertainty 经典不确定性与量子不确定性

A pure state can still have quantum uncertainty.

For example, even if the system is exactly in state $|\psi\rangle$, measuring an observable $A$ may still produce random outcomes unless $|\psi\rangle$ is an eigenstate of $A$.

A mixed state contains an additional layer of uncertainty: classical uncertainty about which state was prepared.

Thus:

$$
\text{pure state}
=
\text{quantum uncertainty only},
$$

whereas

$$
\text{mixed state}
=
\text{classical uncertainty}
+
\text{quantum uncertainty}.
$$

#+begin important
A pure state does not mean measurement outcomes are deterministic for every observable.

It means the quantum state is maximally specified.

测量是否随机，取决于被测 observable 与当前态的关系；不是由“纯态/混合态”单独决定。
#+end important

# 10. Spectral Decomposition 谱分解

Since every density operator is positive semidefinite and Hermitian, it has a spectral decomposition

$$
\rho
=
\sum_i \lambda_i |i\rangle\langle i|,
$$

where

$$
\lambda_i \ge 0,
\qquad
\sum_i \lambda_i = 1,
$$

and $\{|i\rangle\}_i$ is an orthonormal basis of eigenvectors.

This looks like an ensemble decomposition, but it has a special status: it is the eigen-decomposition of $\rho$.

The eigenvalues $\lambda_i$ behave like probabilities.

# Conceptual Summary 概念总结

#+begin summary
A density operator is a positive semidefinite trace-one operator:

$$
\rho \ge 0,
\qquad
\rho^\dagger = \rho,
\qquad
\operatorname{tr}(\rho)=1.
$$

It generalises state vectors:

$$
|\psi\rangle
\quad \leadsto \quad
\rho_\psi = |\psi\rangle\langle \psi|.
$$

The expectation-value formula becomes:

$$
\langle A\rangle
=
\operatorname{tr}(\rho A).
$$

The conceptual hierarchy is:

$$
\text{state vector}
\subset
\text{pure density operators}
\subset
\text{all density operators}.
$$

Geometrically:

$$
\text{density operators form a convex set},
$$

with

$$
\text{pure states as extreme points}
$$

and

$$
\text{mixed states as convex combinations}.
$$
#+end summary