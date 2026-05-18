#+begin meta
id: 20260127T000000-hermitian-matrix
title: Hermitian Matrix
date: 2026-01-27
kind: note
tags: concept, math, QC
refs:
source: roam/math/hermitian_matrix.md
#+end meta

# Hermitian Matrix 厄米矩阵

#+begin summary
A Hermitian matrix is a complex square matrix that equals its own conjugate transpose.

Equivalently, a matrix $A \in M_n(\mathbb{C})$ is Hermitian if

$$
A^\dagger = A.
$$

In coordinates, this means

$$
A_{ij} = \overline{A_{ji}}
$$

for all $1 \le i,j \le n$.

Hermitian matrices are the complex analogue of real symmetric matrices. They are central in linear algebra, spectral theory, and quantum mechanics because their eigenvalues are real and they can be diagonalised by unitary matrices.
#+end summary

# Definition 定义

#+begin define
Let $A \in M_n(\mathbb{C})$ be a complex square matrix. We say that $A$ is Hermitian if

$$
A^\dagger = A,
$$

where

$$
A^\dagger = \overline{A}^{\,T}
$$

is the conjugate transpose of $A$.
#+end define

Equivalently, $A$ is Hermitian if and only if

$$
A_{ij}
=
\overline{A_{ji}}
$$

for all $i,j$.

For example,

$$
A
=
\begin{pmatrix}
3 & 2+i \\
2-i & 1
\end{pmatrix}
$$

is Hermitian, because

$$
A^\dagger
=
\begin{pmatrix}
3 & 2+i \\
2-i & 1
\end{pmatrix}
=
A.
$$

#+begin note
For a real matrix, conjugation has no effect. Therefore, a real Hermitian matrix is exactly a real symmetric matrix.
#+end note

# Basic Consequences 基本结论

## Diagonal entries are real 主对角线元素为实数

If $A$ is Hermitian, then for every diagonal entry,

$$
A_{ii}
=
\overline{A_{ii}}.
$$

Hence

$$
A_{ii} \in \mathbb{R}.
$$

So every diagonal entry of a Hermitian matrix is real.

## Eigenvalues are real 特征值为实数

#+begin theorem
Every eigenvalue of a Hermitian matrix is real.
#+end theorem

#+begin proof
Let $A$ be Hermitian, and suppose

$$
Av = \lambda v
$$

for some nonzero vector $v \in \mathbb{C}^n$.

Then

$$
\langle Av,v\rangle
=
\langle \lambda v,v\rangle
=
\lambda \langle v,v\rangle,
$$

using the convention that the inner product is linear in the first variable.

Since $A$ is Hermitian,

$$
\langle Av,v\rangle
=
\langle v,Av\rangle.
$$

But

$$
\langle v,Av\rangle
=
\langle v,\lambda v\rangle
=
\overline{\lambda}\langle v,v\rangle.
$$

Therefore,

$$
\lambda \langle v,v\rangle
=
\overline{\lambda}\langle v,v\rangle.
$$

Since $v \neq 0$,

$$
\langle v,v\rangle > 0.
$$

Hence

$$
\lambda = \overline{\lambda}.
$$

Therefore,

$$
\lambda \in \mathbb{R}.
$$
#+end proof

# Properties 性质

Let $A,B \in M_n(\mathbb{C})$.

## 1. Sums are Hermitian 加法封闭

If $A$ and $B$ are Hermitian, then

$$
A+B
$$

is Hermitian.

Indeed,

$$
(A+B)^\dagger
=
A^\dagger+B^\dagger
=
A+B.
$$

## 2. Scalar multiplication 标量乘法

If $A$ is Hermitian and $\lambda \in \mathbb{R}$, then

$$
\lambda A
$$

is Hermitian.

Indeed,

$$
(\lambda A)^\dagger
=
\overline{\lambda}A^\dagger
=
\lambda A.
$$

#+begin warning
If $\lambda \in \mathbb{C}$ is not real, then $\lambda A$ is generally not Hermitian.
#+end warning

## 3. Products are Hermitian only under commutativity 乘积需要交换性

If $A$ and $B$ are Hermitian, then $AB$ is Hermitian if and only if

$$
AB = BA.
$$

Indeed,

$$
(AB)^\dagger
=
B^\dagger A^\dagger
=
BA.
$$

Thus $AB$ is Hermitian exactly when

$$
(AB)^\dagger = AB,
$$

i.e.

$$
BA = AB.
$$

## 4. Inverses are Hermitian 逆矩阵仍为 Hermitian

If $A$ is Hermitian and invertible, then $A^{-1}$ is Hermitian.

Indeed,

$$
(A^{-1})^\dagger
=
(A^\dagger)^{-1}
=
A^{-1}.
$$

## 5. Powers are Hermitian 幂仍为 Hermitian

If $A$ is Hermitian, then for every positive integer $n$,

$$
A^n
$$

is Hermitian.

This follows because $A$ commutes with itself, and

$$
(A^n)^\dagger
=
(A^\dagger)^n
=
A^n.
$$

## 6. Hermitian and skew-Hermitian parts Hermitian 与斜 Hermitian 分解

For any square matrix $C \in M_n(\mathbb{C})$,

$$
C+C^\dagger
$$

is Hermitian, because

$$
(C+C^\dagger)^\dagger
=
C^\dagger + C
=
C+C^\dagger.
$$

Also,

$$
C-C^\dagger
$$

is skew-Hermitian, because

$$
(C-C^\dagger)^\dagger
=
C^\dagger-C
=
-(C-C^\dagger).
$$

Every square matrix $C$ can be decomposed as

$$
C = A+B,
$$

where $A$ is Hermitian and $B$ is skew-Hermitian:

$$
A
=
\frac{1}{2}(C+C^\dagger),
$$

and

$$
B
=
\frac{1}{2}(C-C^\dagger).
$$

#+begin note
Here $B$ is skew-Hermitian because

$$
B^\dagger = -B.
$$

Sometimes one also writes

$$
C
=
\frac{C+C^\dagger}{2}
+
i\frac{C-C^\dagger}{2i},
$$

where both

$$
\frac{C+C^\dagger}{2}
$$

and

$$
\frac{C-C^\dagger}{2i}
$$

are Hermitian.
#+end note

## 7. Hermitian matrices are normal Hermitian 矩阵是正规矩阵

A matrix $A$ is normal if

$$
AA^\dagger = A^\dagger A.
$$

If $A$ is Hermitian, then $A^\dagger=A$, so

$$
AA^\dagger
=
AA
=
A^\dagger A.
$$

Therefore every Hermitian matrix is normal.

## 8. Unitary diagonalisation 酉对角化

#+begin theorem Spectral Theorem for Hermitian Matrices
If $A \in M_n(\mathbb{C})$ is Hermitian, then there exists a unitary matrix $U$ and real numbers $\lambda_1,\dots,\lambda_n$ such that

$$
A
=
U
\begin{pmatrix}
\lambda_1 & & 0 \\
& \ddots & \\
0 & & \lambda_n
\end{pmatrix}
U^\dagger.
$$

Equivalently,

$$
U^\dagger A U
=
\operatorname{diag}(\lambda_1,\dots,\lambda_n).
$$
#+end theorem

This means:

- all eigenvalues of $A$ are real;
- eigenvectors corresponding to distinct eigenvalues are orthogonal;
- $\mathbb{C}^n$ has an orthonormal basis consisting of eigenvectors of $A$.

## 9. Dimension as a real vector space 实向量空间维数

The set of $n \times n$ Hermitian matrices forms a real vector space of dimension

$$
n^2.
$$

Reason:

- diagonal entries are real, giving $n$ real degrees of freedom;
- entries above the diagonal are arbitrary complex numbers, giving $2$ real degrees of freedom for each pair $i<j$;
- there are $\frac{n(n-1)}{2}$ such pairs.

Hence the total real dimension is

$$
n + 2\cdot \frac{n(n-1)}{2}
=
n+n(n-1)
=
n^2.
$$

#+begin warning
The Hermitian matrices do not form a complex vector space under arbitrary complex scalar multiplication, because multiplying a Hermitian matrix by a non-real scalar usually destroys Hermiticity.

They form a real vector space.
#+end warning

## 10. Positive definite and positive semidefinite matrices 正定与半正定

If all eigenvalues of a Hermitian matrix $A$ are positive, then $A$ is positive definite.

We write

$$
A > 0.
$$

Equivalently,

$$
\langle Av,v\rangle > 0
$$

for all nonzero $v \in \mathbb{C}^n$.

If all eigenvalues are nonnegative, then $A$ is positive semidefinite.

We write

$$
A \ge 0.
$$

Equivalently,

$$
\langle Av,v\rangle \ge 0
$$

for all $v \in \mathbb{C}^n$.

# Hermitian Operators 自伴算子 / 厄米算符

In quantum mechanics, an observable is represented by a Hermitian operator.

In finite-dimensional quantum mechanics, this means a matrix $\hat{O}$ satisfying

$$
\hat{O}^\dagger = \hat{O}.
$$

More generally, on a Hilbert space, a Hermitian or self-adjoint operator is an operator equal to its adjoint.

#+begin define
An operator $\hat{O}$ on a Hilbert space is self-adjoint if

$$
\hat{O}^\dagger = \hat{O}.
$$
#+end define

#+begin warning
In finite dimensions, “Hermitian” and “self-adjoint” are essentially the same.

In infinite-dimensional Hilbert spaces, one must be more careful: a symmetric operator and a self-adjoint operator are not always the same, because domain issues matter.
#+end warning

# Why Observables Are Hermitian 为什么物理量对应 Hermitian 算符

The physical motivation is:

1. measurement outcomes must be real numbers;
2. Hermitian operators have real eigenvalues;
3. by the spectral theorem, Hermitian operators admit an orthonormal eigenbasis or spectral decomposition;
4. this allows measurement to be described probabilistically using projections onto eigenspaces.

Therefore, Hermitian operators are the natural mathematical model for quantum observables.

#+begin theorem
Let $\hat{O}$ be a linear operator on a finite-dimensional complex Hilbert space. If

$$
\langle \psi|\hat{O}|\psi\rangle \in \mathbb{R}
$$

for every state vector $|\psi\rangle$, then

$$
\hat{O} = \hat{O}^\dagger.
$$

Thus $\hat{O}$ is Hermitian.
#+end theorem

#+begin proof
Define

$$
B
=
\hat{O}-\hat{O}^\dagger.
$$

We want to prove $B=0$.

For every vector $|\psi\rangle$, since

$$
\langle \psi|\hat{O}|\psi\rangle
$$

is real, we have

$$
\langle \psi|\hat{O}|\psi\rangle
=
\overline{\langle \psi|\hat{O}|\psi\rangle}.
$$

By the definition of adjoint,

$$
\overline{\langle \psi|\hat{O}|\psi\rangle}
=
\langle \psi|\hat{O}^\dagger|\psi\rangle.
$$

Therefore,

$$
\langle \psi|\hat{O}|\psi\rangle
=
\langle \psi|\hat{O}^\dagger|\psi\rangle.
$$

So

$$
\langle \psi|(\hat{O}-\hat{O}^\dagger)|\psi\rangle
=
0.
$$

That is,

$$
\langle \psi|B|\psi\rangle = 0
$$

for every $|\psi\rangle$.

By the polarization identity, if a sesquilinear form has zero quadratic form for every vector, then the sesquilinear form itself is zero. Hence

$$
\langle \phi|B|\psi\rangle = 0
$$

for all $|\phi\rangle,|\psi\rangle$.

Therefore $B=0$, so

$$
\hat{O}-\hat{O}^\dagger = 0.
$$

Thus

$$
\hat{O} = \hat{O}^\dagger.
$$

Hence $\hat{O}$ is Hermitian.
#+end proof

#+begin important
The key point is not merely that one expectation value is real.

The correct statement is:

$$
\langle \psi|\hat{O}|\psi\rangle \in \mathbb{R}
\quad
\text{for all } |\psi\rangle
\Longrightarrow
\hat{O} = \hat{O}^\dagger.
$$

This “for all states” condition is essential.
#+end important

# Operator Representation of Observables 物理量的算符化表示

In quantum mechanics, an observable is not treated as a pre-existing definite value possessed by the system at each instant.

Instead, an observable is modelled as a Hermitian operator

$$
\hat{A}
$$

acting on the state space.

This modelling choice has two core consequences:

1. Hermiticity guarantees that measurement outcomes are real.
2. The spectrum of $\hat{A}$ gives all possible measurement outcomes.

If

$$
\hat{A}|a_n\rangle
=
a_n |a_n\rangle,
$$

then the eigenvalues

$$
a_n
$$

are the possible outcomes of measuring the observable $A$.

In this sense, the operator $\hat{A}$ is not itself a measurement result. Rather, it is a mathematical structure whose spectral decomposition generates the possible measurement results.

# Expectation Value as a Statistical Average 统计意义下的期望值

From elementary statistics, if a measurement outcome $a_n$ occurs with probability $p_n$, then the expected value of the observable $A$ is

$$
\langle A\rangle
=
\sum_n a_n p_n.
$$

This quantity describes the stable average value obtained after many repetitions of the same experiment.

It is not, in general, the definite value obtained in a single measurement.

# Quantum States and Probability Weights 量子态与概率权重

In quantum mechanics, the system state is described by a state vector

$$
|\psi\rangle.
$$

When measuring the observable $A$, the state $|\psi\rangle$ does not usually determine a single definite outcome.

Instead, it assigns probability weights to the spectral outcomes of $\hat{A}$.

If

$$
\hat{A}|a_n\rangle
=
a_n|a_n\rangle,
$$

and the eigenvectors $|a_n\rangle$ form an orthonormal eigenbasis, then the probability of obtaining outcome $a_n$ is

$$
p_n
=
|\langle a_n|\psi\rangle|^2.
$$

Thus the role of the quantum state is not to specify a hidden definite value of the observable. Instead, it specifies a probability distribution over possible measurement outcomes.

# Operator Formula for Expectation Values 期望值的算符形式

Suppose $\hat{A}$ has an orthonormal eigenbasis

$$
\{|a_n\rangle\}_n
$$

with

$$
\hat{A}|a_n\rangle = a_n|a_n\rangle.
$$

The completeness relation is

$$
I
=
\sum_n |a_n\rangle\langle a_n|.
$$

The Born rule gives

$$
p_n
=
|\langle a_n|\psi\rangle|^2.
$$

Therefore the statistical expectation is

$$
\langle A\rangle
=
\sum_n a_n p_n.
$$

Substituting the Born probabilities,

$$
\langle A\rangle
=
\sum_n a_n |\langle a_n|\psi\rangle|^2.
$$

Since

$$
|\langle a_n|\psi\rangle|^2
=
\langle \psi|a_n\rangle \langle a_n|\psi\rangle,
$$

we get

$$
\langle A\rangle
=
\sum_n a_n
\langle \psi|a_n\rangle
\langle a_n|\psi\rangle.
$$

Rearranging,

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

is the linear-algebraic compression of the statistical average

$$
\sum_n a_n p_n.
$$

It is not saying that $\hat{A}$ itself is the measured number. The measured numbers are the eigenvalues of $\hat{A}$.
#+end important

# Modelling Perspective 量化建模的视角

From a modelling perspective, quantum mechanics does not represent an observable simply as a definite value attached to the microscopic system.

Instead, it represents an observable as a spectral structure together with a probability rule.

The roles are:

- the operator $\hat{A}$ encodes the structure of possible observable outcomes;
- the eigenvalues of $\hat{A}$ are the possible measurement results;
- the state $|\psi\rangle$ determines the probability weights of those results;
- the expectation value $\langle A\rangle$ describes the experimentally reproducible statistical average.

Thus, representing physical quantities by Hermitian operators is an abstract but highly effective mathematical model.

It does not aim to assign a definite pre-existing value to every observable in every state. Rather, it gives a precise rule for predicting reproducible statistical outcomes of experiments.

# Conceptual Summary 概念总结

#+begin summary
A Hermitian matrix is a complex square matrix satisfying

$$
A^\dagger = A.
$$

The main reasons Hermitian matrices are important are:

1. their diagonal entries are real;
2. their eigenvalues are real;
3. eigenvectors for distinct eigenvalues are orthogonal;
4. they are unitarily diagonalizable;
5. they model quantum observables.

In quantum mechanics, the chain is:

$$
\text{observable}
\Longrightarrow
\text{Hermitian operator}
\Longrightarrow
\text{real spectrum}
\Longrightarrow
\text{possible measurement outcomes}
\Longrightarrow
\text{Born probabilities}
\Longrightarrow
\text{expectation value}.
$$
#+end summary