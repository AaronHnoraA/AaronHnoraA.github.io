#+begin meta
id: Kobler
title: Progress in Theoretical Computer Science
source: roam/project/UNSW/ISO(202603)/Kobler.md
#+end meta

# Progress in Theoretical Computer Science

# Basic Concepts

#+begin summary Reading Note
This is a note for [Köbler, 2020, "ISO(2026-03)"](zotero://select/items/1_54IJ8DAF).

My current task is to skim Köbler's book and identify possible correspondences between the known graph-side reductions and the analogous tensor-side reductions:

$$
\begin{array}{ccccc} d\mathrm{GA} & 
\le_p & \mathrm{GI} & \le_p & \mathrm{GA} \\ \downarrow & & \downarrow & & \downarrow \\ d\mathrm{TA} & \overset{?}{\le_p} & \mathrm{TI} & \le_p & \mathrm{cTA} \end{array}
$$

where

$$
d\mathrm{GA} \le_p \mathrm{GI} \le_p \mathrm{GA}
$$

and

$$
d\mathrm{TA} \le_p \mathrm{TI} \le_p \mathrm{cTA}.
$$

In the graph-side chain, the reduction

$$
d\mathrm{GA} \le_p \mathrm{GI}
$$

can be understood through coloring or encoding operations on graphs. The full graph-side chain has already been established.

The tensor-side reduction

$$
\mathrm{TI} \le_p \mathrm{cTA}
$$

is already known in our current setting. The unclear part is the remaining tensor analogue, especially whether the graph-side idea behind

$$
d\mathrm{GA} \le\_p \mathrm{GI} 
$$

has a valid tensor-side counterpart.  

 **Open point.**   

 The currently unclear part is whether the proposed tensor-side analogue  

$$

d\mathrm{TA} \overset{?}{\le\_p} \mathrm{TI}  

$$

 can be proved by adapting the graph-side reduction  

$$
  d\mathrm{GA} \le\_p \mathrm{GI}.
$$
#+end summary

## 

Complexity Theory

# Reductions

## Basic Reductions

## Reductions in our Paper

# Today

Title: From Graph Isomorphism/Automorphism to Tensor Isomorphism/Automorphism

Goal.
My current task is to understand the graph-side relationship between GI, GA,
#GI, and #GA from Köbler--Schöning--Torán, and then identify which parts of
this workflow may have tensor analogues.

1. Graph-side definitions.

For graphs G and H, graph isomorphism asks whether there exists a bijection
between their vertex sets preserving adjacency. I write

GI = {(G,H) : G ≅ H}.

The automorphism group of G is

Aut(G) = {φ ∈ S\_n : φ(G) = G}.

The graph automorphism problem asks whether Aut(G) contains a non-identity
element. The counting versions are

\#GI(G,H) = |Iso(G,H)|,

\#GA(G) = |Aut(G)|.

2. Reduction GA to GI.

For a vertex i of G, let G\[i\] denote G with vertex i labelled. Then G has a
nontrivial automorphism iff there exist i ≠ j such that

G\[i\] ≅ G\[j\].

Indeed, an automorphism moving i to j gives an isomorphism G\[i\] → G\[j\].
Conversely, any isomorphism G\[i\] → G\[j\] induces a nontrivial automorphism
of G.

Thus GA can be decided by polynomially many GI queries.

3. Disjoint union trick.

For connected graphs G and H,

G ≅ H

iff

G ∪ H has an automorphism switching the two connected components.

This is the key mechanism behind the graph intuition: isomorphism between
two objects becomes symmetry of their disjoint union.

4. Counting relation.

For connected G and H,

\#GA(G ∪ H) =#GA(G)#GA(H) + #GI(G,H)^2.

If G and H are not isomorphic, there are no component-switching
automorphisms. If they are isomorphic, the additional automorphisms are
exactly those switching the two components.

5. Tensor analogue.

For tensors A,B ∈ U ⊗ V ⊗ W, tensor isomorphism asks whether there exists

(P,Q,R) ∈ GL(U) × GL(V) × GL(W)

such that

B = (P,Q,R) · A.

The automorphism group is

Aut(A) = {(P,Q,R) : (P,Q,R) · A = A}.

The natural graph-to-tensor analogy is

G ∪ H    ↦    A ⊕ B.

We would like to know whether

A ≅ B

iff

A ⊕ B has an automorphism switching the two direct summands.

6. Main obstruction.

In graph theory, connected components of G ∪ H are canonical and visible.
In tensor theory, direct summands of A ⊕ B may not be visible after a change
of basis. Therefore the tensor analogue needs a direct-sum decomposition
theorem, likely of Strassen/Krull--Schmidt type.

7. Questions.

(1) Are we targeting TI ≤p TA, TI ≤p cTA, or only identifying the obstruction?
(2) What is the correct tensor category: ordinary 3-tensors, bilinear maps, or
structure tensors of algebras/rings?
(3) Which version of Strassen's indecomposable direct-sum theorem is needed?
(4) If Aut(A ⊕ B) is given by generators, how do we detect whether the generated
group contains a summand-switching element?