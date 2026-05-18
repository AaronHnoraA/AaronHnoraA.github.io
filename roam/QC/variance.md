#+begin meta
id: 20260130T000000-variance
title: Variance
date: 2026-01-30
tags: qc, measurement, statistics, concept
source: roam/QC/variance.md
#+end meta

# Variance 方差

#+begin summary
In quantum measurement, the variance of an observable $M$ measures how spread out the measurement outcomes are around their expectation value.

For an observable $M$ and a state $|\psi\rangle$, the variance is

$$
(\Delta M)^2
=
\langle (M-\langle M\rangle)^2\rangle.
$$

Equivalently,

$$
(\Delta M)^2
=
\langle M^2\rangle
-
\langle M\rangle^2.
$$

The standard deviation is

$$
\Delta M
=
\sqrt{\langle M^2\rangle-\langle M\rangle^2}.
$$
#+end summary

# 1. Setup 测量设定

Let $M$ be an observable, so $M$ is a Hermitian operator.

Assume first that $M$ has a discrete non-degenerate spectral decomposition

$$
M
=
\sum_i m_i |m_i\rangle\langle m_i|,
$$

where

$$
M|m_i\rangle
=
m_i |m_i\rangle.
$$

Let the system be in a normalized state

$$
|\psi\rangle.
$$

The probability of measuring the outcome $m_i$ is

$$
p_i
=
|\langle m_i|\psi\rangle|^2.
$$

The expectation value of $M$ is

$$
\langle M\rangle
=
\sum_i p_i m_i.
$$

Equivalently,

$$
\langle M\rangle
=
\langle \psi|M|\psi\rangle.
$$

# 2. Definition of Variance 方差的定义

#+begin define
The variance of the observable $M$ in the state $|\psi\rangle$ is

$$
(\Delta M)^2
=
\langle (M-\langle M\rangle I)^2\rangle.
$$

Since $\langle M\rangle$ is a scalar, we often write this more simply as

$$
(\Delta M)^2
=
\langle (M-\langle M\rangle)^2\rangle.
$$
#+end define

In terms of measurement outcomes, this is exactly the classical variance:

$$
(\Delta M)^2
=
\sum_i p_i (m_i-\langle M\rangle)^2.
$$

Here:

- $m_i$ is a possible measurement outcome;
- $p_i$ is the probability of obtaining $m_i$;
- $\langle M\rangle$ is the average measurement outcome.

# 3. Main Formula 主公式

#+begin theorem
For any observable $M$ and normalized state $|\psi\rangle$,

$$
(\Delta M)^2
=
\langle M^2\rangle
-
\langle M\rangle^2.
$$
#+end theorem

#+begin proof
Start from the classical variance formula for measurement outcomes:

$$
(\Delta M)^2
=
\sum_i p_i (m_i-\langle M\rangle)^2.
$$

Expand the square:

$$
(\Delta M)^2
=
\sum_i p_i
\left(
m_i^2
-
2m_i\langle M\rangle
+
\langle M\rangle^2
\right).
$$

Distribute the sum:

$$
(\Delta M)^2
=
\sum_i p_i m_i^2
-
2\langle M\rangle \sum_i p_i m_i
+
\langle M\rangle^2 \sum_i p_i.
$$

Now use the two basic facts:

$$
\sum_i p_i m_i
=
\langle M\rangle,
$$

and

$$
\sum_i p_i
=
1.
$$

Substituting gives

$$
(\Delta M)^2
=
\sum_i p_i m_i^2
-
2\langle M\rangle^2
+
\langle M\rangle^2.
$$

Therefore,

$$
(\Delta M)^2
=
\sum_i p_i m_i^2
-
\langle M\rangle^2.
$$

It remains to identify the first term as $\langle M^2\rangle$.

Since

$$
M|m_i\rangle
=
m_i |m_i\rangle,
$$

we have

$$
M^2|m_i\rangle
=
M(M|m_i\rangle)
=
M(m_i|m_i\rangle)
=
m_i M|m_i\rangle
=
m_i^2 |m_i\rangle.
$$

Thus $|m_i\rangle$ is also an eigenvector of $M^2$, with eigenvalue $m_i^2$.

The probability of obtaining the eigenstate component $|m_i\rangle$ is still

$$
p_i
=
|\langle m_i|\psi\rangle|^2,
$$

because squaring the operator changes the eigenvalues from $m_i$ to $m_i^2$, but does not change the eigenvectors.

Hence

$$
\langle M^2\rangle
=
\sum_i p_i m_i^2.
$$

Therefore,

$$
(\Delta M)^2
=
\langle M^2\rangle
-
\langle M\rangle^2.
$$

This proves the formula.
#+end proof

# 4. Operator Derivation 算符推导

There is also a shorter operator-level derivation.

#+begin proof
By definition,

$$
(\Delta M)^2
=
\langle (M-\langle M\rangle I)^2\rangle.
$$

Expand the operator square:

$$
(M-\langle M\rangle I)^2
=
M^2
-
2\langle M\rangle M
+
\langle M\rangle^2 I.
$$

Taking expectation values gives

$$
(\Delta M)^2
=
\langle M^2\rangle
-
2\langle M\rangle \langle M\rangle
+
\langle M\rangle^2 \langle I\rangle.
$$

Since the state is normalized,

$$
\langle I\rangle
=
\langle \psi|I|\psi\rangle
=
\langle \psi|\psi\rangle
=
1.
$$

Therefore,

$$
(\Delta M)^2
=
\langle M^2\rangle
-
2\langle M\rangle^2
+
\langle M\rangle^2.
$$

Hence

$$
(\Delta M)^2
=
\langle M^2\rangle
-
\langle M\rangle^2.
$$
#+end proof

# 5. Degenerate Spectrum 简并谱情形

If $M$ has degenerate eigenvalues, then we should use spectral projections.

Let

$$
M
=
\sum_m m P_m,
$$

where $P_m$ is the orthogonal projection onto the eigenspace with eigenvalue $m$.

Then the probability of obtaining outcome $m$ is

$$
p(m)
=
\langle \psi|P_m|\psi\rangle.
$$

The expectation value is

$$
\langle M\rangle
=
\sum_m m\,p(m).
$$

The second moment is

$$
\langle M^2\rangle
=
\sum_m m^2 p(m).
$$

Hence the same variance formula holds:

$$
(\Delta M)^2
=
\langle M^2\rangle
-
\langle M\rangle^2.
$$

# 6. Density Operator Form 密度算符形式

If the quantum state is represented by a density operator $\rho$, then

$$
\langle M\rangle
=
\operatorname{tr}(\rho M),
$$

and

$$
\langle M^2\rangle
=
\operatorname{tr}(\rho M^2).
$$

Therefore,

$$
(\Delta M)^2
=
\operatorname{tr}(\rho M^2)
-
\operatorname{tr}(\rho M)^2.
$$

Equivalently,

$$
(\Delta M)^2
=
\operatorname{tr}\left(\rho (M-\langle M\rangle I)^2\right).
$$

# 7. Interpretation 物理解释

The variance measures how uncertain the measurement outcomes of $M$ are in the state $|\psi\rangle$.

If

$$
(\Delta M)^2 = 0,
$$

then the measurement of $M$ is deterministic in that state.

For a pure state, this happens exactly when $|\psi\rangle$ lies in an eigenspace of $M$.

If

$$
(\Delta M)^2 > 0,
$$

then repeated measurements of $M$ on identically prepared systems can give different outcomes.

中文直觉：

$$
\Delta M
$$

measures the typical size of fluctuation around the mean value

$$
\langle M\rangle.
$$

# 8. Important Special Case: Eigenstates 本征态情形

Suppose

$$
M|\psi\rangle
=
m|\psi\rangle.
$$

Then measuring $M$ always gives the value $m$.

Indeed,

$$
\langle M\rangle
=
\langle \psi|M|\psi\rangle
=
m,
$$

and

$$
\langle M^2\rangle
=
\langle \psi|M^2|\psi\rangle
=
m^2.
$$

Therefore,

$$
(\Delta M)^2
=
m^2-m^2
=
0.
$$

So eigenstates have zero variance for their corresponding observable.

# 9. Conceptual Summary 概念总结

#+begin summary
Variance in quantum mechanics is the variance of measurement outcomes.

Starting from the classical statistical formula,

$$
(\Delta M)^2
=
\sum_i p_i(m_i-\langle M\rangle)^2,
$$

we obtain the compact operator formula

$$
(\Delta M)^2
=
\langle M^2\rangle
-
\langle M\rangle^2.
$$

For a pure state,

$$
\langle M\rangle
=
\langle \psi|M|\psi\rangle.
$$

For a density operator,

$$
\langle M\rangle
=
\operatorname{tr}(\rho M).
$$

Thus variance measures the statistical spread of possible measurement outcomes around their expectation value.
#+end summary