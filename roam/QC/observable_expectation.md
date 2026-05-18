#+begin meta
id: 20260128T000000-observable-expectation
title: Observable & Expectation
date: 2026-01-28
tags: quantum, observable, expectation, operator
source: roam/QC/observable_expectation.md
#+end meta

# Observable & Expectation 可观测量与期望值

#+begin summary
In quantum mechanics, an observable is represented by a Hermitian operator on a Hilbert space.

The key chain is:

$$
\text{observable}
\Longrightarrow
\text{Hermitian operator}
\Longrightarrow
\text{spectral decomposition}
\Longrightarrow
\text{measurement outcomes}
\Longrightarrow
\text{Born probabilities}
\Longrightarrow
\text{expectation value}.
$$

For a pure state $|\psi\rangle$ and an observable $\hat{A}$, the expectation value is

$$
\langle A\rangle
=
\langle \psi|\hat{A}|\psi\rangle.
$$

For a density operator $\rho$, the expectation value is

$$
\langle A\rangle
=
\operatorname{tr}(\rho \hat{A}).
$$
#+end summary

# 1. Why Observables Are Hermitian Operators 为什么可观测量是厄米算符

In quantum mechanics, every physical observable $A$ is represented by a Hermitian operator

$$
\hat{A}
$$

acting on a Hilbert space $H$.

That is,

$$
\hat{A}^\dagger = \hat{A}.
$$

There are two main reasons.

## 1.1 Measurement outcomes must be real 测量结果必须是实数

Experimental measurement outcomes are real numbers.

Hermitian operators have real eigenvalues. If

$$
\hat{A}|a_n\rangle
=
a_n |a_n\rangle,
$$

then

$$
a_n \in \mathbb{R}.
$$

Thus the eigenvalues of $\hat{A}$ can consistently represent possible measurement outcomes.

## 1.2 Hermitian operators admit orthogonal spectral decompositions 厄米算符允许正交谱分解

By the spectral theorem, a Hermitian operator has an orthonormal eigenbasis in the finite-dimensional case.

So we can write

$$
\hat{A}
=
\sum_n a_n |a_n\rangle\langle a_n|,
$$

where

$$
\hat{A}|a_n\rangle = a_n |a_n\rangle,
$$

and

$$
\langle a_m|a_n\rangle = \delta_{mn}.
$$

This orthogonal decomposition is what makes the probability interpretation possible.

#+begin important
A measurement of the observable $A$ does not directly output the operator $\hat{A}$.

It outputs one of the eigenvalues of $\hat{A}$.

The operator encodes the full structure of possible outcomes.
#+end important

# 2. Physical Meaning of Expectation Value 期望值的物理意义

Suppose the system is in a normalized pure state

$$
|\psi\rangle \in H,
\qquad
\langle \psi|\psi\rangle = 1.
$$

We repeatedly prepare the same state $|\psi\rangle$ and measure the same observable $\hat{A}$.

Each measurement produces one eigenvalue

$$
a_n
$$

with probability

$$
p_n.
$$

The statistical average is

$$
\langle A\rangle
=
\sum_n a_n p_n.
$$

This is the expectation value.

#+begin note
The expectation value is not usually the result of a single measurement.

It is the average value obtained in the limit of many repeated experiments with the same preparation.
#+end note

# 3. Born Rule and Spectral Expansion 玻恩规则与谱展开

Assume for now that $\hat{A}$ has a discrete non-degenerate spectrum with orthonormal eigenbasis

$$
\{|a_n\rangle\}_n.
$$

Then every state $|\psi\rangle$ can be expanded as

$$
|\psi\rangle
=
\sum_n c_n |a_n\rangle,
$$

where

$$
c_n
=
\langle a_n|\psi\rangle.
$$

Since $|\psi\rangle$ is normalized,

$$
\sum_n |c_n|^2 = 1.
$$

The Born rule says that the probability of obtaining outcome $a_n$ is

$$
p_n
=
|\langle a_n|\psi\rangle|^2
=
|c_n|^2.
$$

Therefore,

$$
\langle A\rangle
=
\sum_n a_n |c_n|^2.
$$

# 4. Derivation of the Operator Formula 期望值算符公式的推导

Starting from the statistical average,

$$
\langle A\rangle
=
\sum_n a_n p_n.
$$

Using Born's rule,

$$
p_n
=
|\langle a_n|\psi\rangle|^2.
$$

Therefore,

$$
\langle A\rangle
=
\sum_n a_n |\langle a_n|\psi\rangle|^2.
$$

Now,

$$
|\langle a_n|\psi\rangle|^2
=
\langle \psi|a_n\rangle\langle a_n|\psi\rangle.
$$

So

$$
\langle A\rangle
=
\sum_n a_n
\langle \psi|a_n\rangle
\langle a_n|\psi\rangle.
$$

Move the scalar expression into bra-ket form:

$$
\langle A\rangle
=
\left\langle
\psi
\middle|
\left(
\sum_n a_n |a_n\rangle\langle a_n|
\right)
\middle|
\psi
\right\rangle.
$$

By the spectral decomposition,

$$
\hat{A}
=
\sum_n a_n |a_n\rangle\langle a_n|.
$$

Hence

$$
\langle A\rangle
=
\langle \psi|\hat{A}|\psi\rangle.
$$

#+begin important
The formula

$$
\langle A\rangle
=
\langle \psi|\hat{A}|\psi\rangle
$$

is not an arbitrary definition.

It is the compact linear-algebraic expression of the statistical average

$$
\sum_n a_n p_n.
$$

However, in the axiomatic formulation of quantum mechanics, this formula is often taken as part of the measurement postulate.
#+end important

# 5. Degenerate Eigenvalues 简并本征值情形

If an eigenvalue $a$ has eigenspace $E_a$, then measurement outcome $a$ corresponds not to one eigenvector but to the whole eigenspace.

Let $P_a$ be the orthogonal projection onto $E_a$.

Then the spectral decomposition is

$$
\hat{A}
=
\sum_a a P_a.
$$

The probability of measuring outcome $a$ is

$$
p(a)
=
\|P_a|\psi\rangle\|^2.
$$

Equivalently,

$$
p(a)
=
\langle \psi|P_a|\psi\rangle.
$$

The expectation value is

$$
\langle A\rangle
=
\sum_a a\,\langle \psi|P_a|\psi\rangle.
$$

Using

$$
\hat{A}
=
\sum_a aP_a,
$$

we again obtain

$$
\langle A\rangle
=
\langle \psi|\hat{A}|\psi\rangle.
$$

#+begin note
The non-degenerate formula

$$
p_n = |\langle a_n|\psi\rangle|^2
$$

is a special case of the projection formula

$$
p(a)=\langle \psi|P_a|\psi\rangle.
$$

When $E_a$ is one-dimensional,

$$
P_a = |a\rangle\langle a|.
$$
#+end note

# 6. Core Spectral-Theoretic Statement 谱理论的核心结论

For a Hermitian operator $\hat{A}$:

- possible measurement outcomes lie in the spectrum of $\hat{A}$;
- in the finite-dimensional case, the spectrum consists of eigenvalues;
- for discrete spectra, outcomes correspond to eigenvalues;
- for degenerate spectra, outcomes correspond to eigenspaces and projections;
- for continuous spectra, one needs the spectral measure formulation.

In finite dimensions, the clean statement is:

$$
\hat{A}
=
\sum_a a P_a,
$$

where $P_a$ is the orthogonal projection onto the eigenspace of eigenvalue $a$.

The corresponding probability rule is:

$$
\Pr(A=a)
=
\langle \psi|P_a|\psi\rangle.
$$

The expectation value is:

$$
\mathbb{E}[A]
=
\sum_a a\,\Pr(A=a)
=
\langle \psi|\hat{A}|\psi\rangle.
$$

# 7. Continuous Spectrum 连续谱情形

For observables with continuous spectrum, such as position or momentum, the eigenvectors are not ordinary Hilbert-space vectors. They are generalized eigenvectors.

For example, one often formally writes

$$
\hat{X}|x\rangle
=
x|x\rangle.
$$

But $|x\rangle$ is not usually an element of the Hilbert space $L^2(\mathbb{R})$.

The rigorous formulation uses a projection-valued measure $E_A$ such that

$$
\hat{A}
=
\int_{\mathbb{R}} \lambda \, dE_A(\lambda).
$$

For a state $|\psi\rangle$, the probability of getting a result in a measurable set $S \subseteq \mathbb{R}$ is

$$
\Pr(A \in S)
=
\langle \psi|E_A(S)|\psi\rangle.
$$

The expectation value is

$$
\langle A\rangle
=
\int_{\mathbb{R}} \lambda \, d\mu_\psi(\lambda),
$$

where

$$
\mu_\psi(S)
=
\langle \psi|E_A(S)|\psi\rangle.
$$

#+begin note
In introductory quantum computing, we usually work in finite-dimensional Hilbert spaces, so the finite-dimensional spectral decomposition is enough.

Continuous-spectrum issues become important in functional analysis and continuous-variable quantum mechanics.
#+end note

# 8. Geometric Interpretation 几何解释

If

$$
|\psi\rangle
=
\sum_n c_n |a_n\rangle,
$$

then each coefficient

$$
c_n
=
\langle a_n|\psi\rangle
$$

is the amplitude of $|\psi\rangle$ in the $|a_n\rangle$ direction.

The probability of measuring $a_n$ is

$$
|c_n|^2.
$$

Thus the probabilistic nature of quantum measurement is not merely “measurement disturbance.”

Rather, it is encoded in the geometric projection of the state vector onto the spectral subspaces of the observable.

More precisely:

$$
\text{state}
+
\text{observable}
\Longrightarrow
\text{projection onto spectral subspaces}
\Longrightarrow
\text{probabilities}.
$$

#+begin important
For a given observable $\hat{A}$, if $|\psi\rangle$ is an eigenstate of $\hat{A}$, then measuring $A$ is deterministic.

If $|\psi\rangle$ is a superposition of different eigenspaces of $\hat{A}$, then the measurement outcomes are probabilistic.
#+end important

# 9. Density-Operator Form 密度算符形式

If the state is represented by a density operator $\rho$, then the expectation value of observable $\hat{A}$ is

$$
\langle A\rangle
=
\operatorname{tr}(\rho \hat{A}).
$$

For a pure state

$$
\rho_\psi
=
|\psi\rangle\langle \psi|,
$$

we recover

$$
\operatorname{tr}(\rho_\psi \hat{A})
=
\langle \psi|\hat{A}|\psi\rangle.
$$

Thus the density-operator formula generalises the pure-state formula.

# Conceptual Summary 概念总结

#+begin summary
An observable $A$ is represented by a Hermitian operator $\hat{A}$.

The spectral theorem gives

$$
\hat{A}
=
\sum_a aP_a.
$$

The eigenvalues $a$ are possible measurement outcomes.

The projections $P_a$ determine the probabilities:

$$
\Pr(A=a)
=
\langle \psi|P_a|\psi\rangle.
$$

The expectation value is

$$
\langle A\rangle
=
\sum_a a\,\Pr(A=a)
=
\langle \psi|\hat{A}|\psi\rangle.
$$

For a density operator $\rho$,

$$
\langle A\rangle
=
\operatorname{tr}(\rho\hat{A}).
$$

Therefore, expectation value is the bridge between spectral measurement outcomes and experimentally reproducible statistical averages.
#+end summary