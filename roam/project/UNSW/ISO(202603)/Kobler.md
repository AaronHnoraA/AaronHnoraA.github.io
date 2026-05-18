#+begin meta
id: Kobler
title: Progress in Theoretical Computer Science
source: roam/project/UNSW/ISO(202603)/Kobler.md
#+end meta

# Progress in Theoretical Computer Science

# Basic Concepts

#+begin summary Reading Note
This is a note for [Köbler, 2020, "ISO(2026-03)"](zotero://select/items/1_54IJ8DAF).

My current task is to skim Köbler's book and identify possible correspondences between known graph-side reductions and their possible tensor-side analogues.

The guiding comparison is:

$$
\begin{array}{ccccc}
 d\mathrm{GA} & \le_p & \mathrm{GI} & \le_p & \mathrm{GA} \\
 \downarrow & & \downarrow & & \downarrow \\
 d\mathrm{TA} & \overset{?}{\le_p} & \mathrm{TI} & \le_p & \mathrm{cTA}
\end{array}
$$

Here the graph-side chain

$$
d\mathrm{GA} \le_p \mathrm{GI} \le_p \mathrm{GA}
$$

is already established. In particular, the reduction

$$
d\mathrm{GA} \le_p \mathrm{GI}
$$

can be understood through graph-colouring or graph-encoding operations.

On the tensor side, the reduction

$$
\mathrm{TI} \le_p \mathrm{cTA}
$$

is already known in our current setting. The unclear part is the remaining tensor analogue, namely whether the graph-side idea behind

$$
d\mathrm{GA} \le_p \mathrm{GI}
$$

admits a valid tensor-side counterpart.

#+begin comment Open point
The main open point is whether the proposed tensor-side analogue

$$
d\mathrm{TA} \overset{?}{\le_p} \mathrm{TI}
$$

can be proved by adapting the graph-side reduction

$$
d\mathrm{GA} \le_p \mathrm{GI}.
$$
#+end comment
#+end summary

# Complexity Theory

# Reductions

## Basic Reductions

## Reductions in Our Paper

# Today

## Title

From Graph Isomorphism/Automorphism to Tensor Isomorphism/Automorphism

## Goal

## 1. Graph-Side Definitions

For graphs $G$ and $H$, the graph isomorphism problem asks whether there exists a bijection between their vertex sets preserving adjacency. I write

$$
\mathrm{GI}
=
\{(G,H) : G \cong H\}.
$$

The automorphism group of a graph $G$ is

$$
\operatorname{Aut}(G)
=
\{\varphi \in S_n : \varphi(G) = G\}.
$$

The graph automorphism problem asks whether $\operatorname{Aut}(G)$ contains a non-identity element.

The corresponding counting versions are

$$
\#\mathrm{GI}(G,H)
=
|\operatorname{Iso}(G,H)|,
$$

and

$$
\#\mathrm{GA}(G)
=
|\operatorname{Aut}(G)|.
$$

## 2. Reduction from $\mathrm{GA}$ to $\mathrm{GI}$

For a vertex $i \in V(G)$, let $G[i]$ denote the graph $G$ with vertex $i$ distinguished or labelled.

Then $G$ has a nontrivial automorphism if and only if there exist distinct vertices $i \neq j$ such that

$$
G[i] \cong G[j].
$$

Indeed, if an automorphism $\varphi \in \operatorname{Aut}(G)$ moves $i$ to $j$, then $\varphi$ gives an isomorphism

$$
G[i] \cong G[j].
$$

Conversely, any isomorphism

$$
G[i] \cong G[j]
$$

with $i \neq j$ induces a nontrivial automorphism of $G$.

Therefore $\mathrm{GA}$ can be decided using polynomially many $\mathrm{GI}$-queries.

## 3. The Disjoint-Union Trick

For connected graphs $G$ and $H$,

$$
G \cong H
$$

if and only if the disjoint union $G \sqcup H$ has an automorphism that switches the two connected components.

This is the key graph-side mechanism:

$$
\text{isomorphism between two objects}
\quad \leadsto \quad
\text{symmetry of their disjoint union}.
$$

## 4. Counting Relation

For connected graphs $G$ and $H$, one has

$$
\#\mathrm{GA}(G \sqcup H)
=
\#\mathrm{GA}(G)\#\mathrm{GA}(H)
+
\#\mathrm{GI}(G,H)^2.
$$

If $G \not\cong H$, then there are no automorphisms switching the two connected components, so every automorphism of $G \sqcup H$ preserves each component.

If $G \cong H$, then the additional automorphisms are exactly those that switch the two components. These are determined by choosing an isomorphism $G \to H$ and an isomorphism $H \to G$, giving the $\#\mathrm{GI}(G,H)^2$ term.

## 5. Tensor Analogue

For tensors

$$
A,B \in U \otimes V \otimes W,
$$

the tensor isomorphism problem asks whether there exists

$$
(P,Q,R) \in \mathrm{GL}(U) \times \mathrm{GL}(V) \times \mathrm{GL}(W)
$$

such that

$$
B = (P,Q,R) \cdot A.
$$

The automorphism group of $A$ is

$$
\operatorname{Aut}(A)
=
\{(P,Q,R) : (P,Q,R) \cdot A = A\}.
$$

The natural graph-to-tensor analogy is

$$
G \sqcup H
\quad \leadsto \quad
A \oplus B.
$$

The desired tensor-side statement would be something like:

$$
A \cong B
$$

if and only if

$$
A \oplus B
$$

has an automorphism that switches the two direct summands.

## 6. Main Obstruction

In graph theory, the connected components of $G \sqcup H$ are canonical and combinatorially visible.

In tensor theory, the direct summands of $A \oplus B$ are not necessarily visible after arbitrary changes of basis. Therefore, the tensor analogue cannot rely only on the formal expression $A \oplus B$. It requires a theorem ensuring that direct-sum decompositions are sufficiently canonical.

This is where a Strassen/Krull--Schmidt type direct-sum decomposition theorem may be needed.

Informally:

$$
\text{graph connected components}
\quad \leadsto \quad
\text{tensor indecomposable summands}.
$$

The difficulty is that tensor summands are linear-algebraic objects rather than visibly separated combinatorial components.

## 7. Questions

1. Are we trying to prove

   $$
   \mathrm{TI} \le_p \mathrm{TA},
   $$

   or

   $$
   \mathrm{TI} \le_p \mathrm{cTA},
   $$

   or are we only trying to identify the obstruction to such a reduction?
2. What is the correct tensor category for the analogue?

   Possible candidates include:

   - ordinary 3-tensors;
   - bilinear maps;
   - structure tensors of algebras or rings.
3. Which version of Strassen's indecomposable direct-sum theorem is actually needed?
4. If $\operatorname{Aut}(A \oplus B)$ is given by generators, how do we detect whether the generated group contains an element that switches the two direct summands?
5. More generally, what is the correct tensor-side analogue of the graph operation of distinguishing, colouring, or labelling vertices?