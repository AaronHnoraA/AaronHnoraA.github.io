#+begin meta
id: 20260128T000000-quantum-state
title: Quantum State
date: 2026-01-28
tags: qc, state, hilbert, geometry
source: roam/QC/quantum_state.md
#+end meta

# Quantum State 量子态

#+begin summary
A quantum state describes the physical state of a quantum system.

Mathematically, a closed quantum system is associated with a complex Hilbert space $H$.

A pure quantum state is not literally a single vector in $H$, but a ray, namely a one-dimensional subspace of $H$.

In calculations, we usually choose a normalized representative vector $|\psi\rangle$ from that ray.
#+end summary

# 1. Mathematical Carrier of Quantum States 量子态的数学载体

In quantum mechanics, every physical system is associated with a complex Hilbert space

$$
H.
$$

This Hilbert space has three key structures.

1. Linear structure:

   $$
   \alpha |\psi\rangle + \beta |\phi\rangle \in H.
   $$

   This supports the superposition principle.

2. Inner product:

   $$
   \langle \phi|\psi\rangle.
   $$

   The inner product is used to compute amplitudes, probabilities, orthogonality, projections, and expectation values.

3. Completeness:

   Cauchy sequences converge inside the space. This guarantees that limiting processes do not leave the state space.

中文直觉：

$$
\text{Hilbert space}
=
\text{linear structure}
+
\text{geometry}
+
\text{limit structure}.
$$

So Hilbert space is the mathematical environment in which quantum states live.

# 2. Separable Hilbert Spaces 可分希尔伯特空间

In many physical settings, one assumes that the Hilbert space is separable.

#+begin define
A Hilbert space $H$ is separable if it contains a countable dense subset.

Equivalently, for Hilbert spaces, separability means that $H$ has a countable orthonormal basis.
#+end define

This means that there exists an orthonormal basis

$$
\{|e_n\rangle\}_{n \in \mathbb{N}}
$$

such that every vector $|\psi\rangle \in H$ can be approximated by finite linear combinations of these basis vectors.

In finite-dimensional quantum computing, the Hilbert spaces are automatically separable. For example, an $n$-qubit system has state space

$$
(\mathbb{C}^2)^{\otimes n}
\cong
\mathbb{C}^{2^n}.
$$

#+begin note
It is better to say that separability makes the Hilbert space manageable by countable coordinates.

The phrase “finite experiments can determine the state” is not quite accurate, because exact quantum state determination generally requires infinitely many samples in principle. In practice, one estimates a state statistically.
#+end note

# 3. A Quantum State Is Not Literally a Vector 量子态不是单个矢量

The key conceptual point is:

$$
\text{quantum state}
\neq
\text{one specific vector in } H.
$$

Rather,

$$
\text{pure quantum state}
=
\text{a ray in } H.
$$

A ray is a one-dimensional subspace of $H$.

If $|\psi\rangle \neq 0$, then the corresponding ray is

$$
[|\psi\rangle]
=
\{\lambda |\psi\rangle : \lambda \in \mathbb{C},\ \lambda \neq 0\}.
$$

When we restrict to normalized vectors, this becomes the equivalence relation

$$
|\psi\rangle
\sim
e^{i\theta}|\psi\rangle,
$$

where

$$
\theta \in \mathbb{R}.
$$

Thus two normalized vectors that differ only by a global phase represent the same physical pure state.

#+begin important
A global phase has no physical effect:

$$
|\psi\rangle
\quad \text{and} \quad
e^{i\theta}|\psi\rangle
$$

represent the same physical state.
#+end important

# 4. Why Global Phase Is Unobservable 为什么整体相位不可观测

Suppose

$$
|\psi'\rangle
=
e^{i\theta}|\psi\rangle.
$$

Let $|\phi\rangle$ be any measurement basis vector. Then the probability amplitude changes as

$$
\langle \phi|\psi'\rangle
=
\langle \phi|e^{i\theta}\psi\rangle
=
e^{i\theta}\langle \phi|\psi\rangle.
$$

But the probability is the squared modulus:

$$
|\langle \phi|\psi'\rangle|^2
=
|e^{i\theta}\langle \phi|\psi\rangle|^2.
$$

Since

$$
|e^{i\theta}|=1,
$$

we get

$$
|\langle \phi|\psi'\rangle|^2
=
|\langle \phi|\psi\rangle|^2.
$$

So measurement probabilities do not change.

The same holds for expectation values. Let $\hat{A}$ be an observable. Then

$$
\langle \psi'|\hat{A}|\psi'\rangle
=
\langle e^{i\theta}\psi|\hat{A}|e^{i\theta}\psi\rangle.
$$

Since the bra transforms as

$$
\langle \psi'|
=
e^{-i\theta}\langle \psi|,
$$

we have

$$
\langle \psi'|\hat{A}|\psi'\rangle
=
e^{-i\theta}e^{i\theta}
\langle \psi|\hat{A}|\psi\rangle.
$$

Therefore,

$$
\langle \psi'|\hat{A}|\psi'\rangle
=
\langle \psi|\hat{A}|\psi\rangle.
$$

Thus all probabilities and expectation values are unchanged by a global phase.

# 5. Projective Hilbert Space 射影希尔伯特空间

The set of physical pure states is the projective Hilbert space

$$
\mathbb{P}(H).
$$

It is defined as

$$
\mathbb{P}(H)
=
(H \setminus \{0\})/\mathbb{C}^{\times},
$$

where two nonzero vectors are identified if they differ by a nonzero complex scalar.

Equivalently, if we restrict to normalized vectors, then

$$
\mathbb{P}(H)
=
\{|\psi\rangle \in H : \langle \psi|\psi\rangle = 1\}/U(1),
$$

where

$$
U(1)
=
\{e^{i\theta} : \theta \in \mathbb{R}\}.
$$

中文直觉：

- Hilbert space $H$ contains vectors.
- Physical pure states are rays in $H$.
- Choosing $|\psi\rangle$ is choosing one representative of the ray.

# 6. Why We Still Use State Vectors 为什么平时还说“态矢”

Although a pure quantum state is strictly a ray, in calculations we usually choose one normalized representative

$$
|\psi\rangle
$$

and call it a state vector.

This is convenient because:

1. linear algebra is done with vectors;
2. amplitudes are written as inner products;
3. global phase cancels out in probabilities and expectation values;
4. choosing a representative does not change physical predictions.

Thus the phrase “state vector” is a computational shorthand.

#+begin important
Strictly speaking:

$$
\text{state vector}
=
\text{chosen representative},
$$

while

$$
\text{physical pure state}
=
\text{ray / equivalence class}.
$$

So using $|\psi\rangle$ is a calculation convention, not a conceptual identity.
#+end important

# 7. Pure States and Mixed States 纯态与混合态

The discussion above concerns pure states.

A pure state can be represented by a ray

$$
[|\psi\rangle]
$$

or equivalently by the rank-one density operator

$$
\rho_\psi
=
|\psi\rangle\langle \psi|.
$$

This density operator is invariant under global phase. Indeed, if

$$
|\psi'\rangle
=
e^{i\theta}|\psi\rangle,
$$

then

$$
|\psi'\rangle\langle \psi'|
=
e^{i\theta}|\psi\rangle
e^{-i\theta}\langle \psi|
=
|\psi\rangle\langle \psi|.
$$

So the density-operator representation removes the global-phase ambiguity automatically.

A mixed state is represented by a density operator

$$
\rho
=
\sum_i p_i |\psi_i\rangle\langle \psi_i|,
$$

where

$$
p_i \ge 0,
\qquad
\sum_i p_i = 1.
$$

Mixed states are not generally rays. They represent classical probabilistic mixtures of pure states.

# 8. Qubit Example 单量子比特例子

For one qubit, the Hilbert space is

$$
H = \mathbb{C}^2.
$$

A normalized state vector can be written as

$$
|\psi\rangle
=
\alpha |0\rangle + \beta |1\rangle,
$$

where

$$
\alpha,\beta \in \mathbb{C},
$$

and

$$
|\alpha|^2 + |\beta|^2 = 1.
$$

The vectors

$$
|\psi\rangle
$$

and

$$
e^{i\theta}|\psi\rangle
$$

represent the same physical state.

The probabilities of measuring $0$ and $1$ are

$$
\Pr(0)=|\alpha|^2,
$$

and

$$
\Pr(1)=|\beta|^2.
$$

These probabilities are unchanged by multiplying the whole state vector by $e^{i\theta}$.

#+begin note
Global phase is unobservable, but relative phase is observable.

For example,

$$
\frac{|0\rangle+|1\rangle}{\sqrt{2}}
$$

and

$$
\frac{|0\rangle-|1\rangle}{\sqrt{2}}
$$

are physically different states.

They differ by a relative phase between the $|0\rangle$ and $|1\rangle$ components, not merely by a global phase.
#+end note

# Conceptual Summary 概念总结

#+begin summary
A quantum system is associated with a complex Hilbert space $H$.

A pure quantum state is a ray in $H$:

$$
[|\psi\rangle]
=
\{\lambda|\psi\rangle : \lambda \in \mathbb{C},\ \lambda \neq 0\}.
$$

For normalized representatives,

$$
|\psi\rangle
\sim
e^{i\theta}|\psi\rangle.
$$

Thus:

$$
\text{physical pure state}
=
\text{ray}
=
\text{one-dimensional subspace}
=
\text{equivalence class up to global phase}.
$$

In calculations, we usually choose a normalized representative $|\psi\rangle$ and call it the state vector.

This is convenient because all physical predictions are invariant under global phase.
#+end summary