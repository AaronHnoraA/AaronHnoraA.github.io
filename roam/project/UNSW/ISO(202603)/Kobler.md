#+begin meta
id: project/UNSW/ISO(202603)/Kobler.md
title: Progress in Theoretical Computer Science
source: roam/project/UNSW/ISO(202603)/Kobler.typ
tags: project, iso, graph-isomorphism, tensor-isomorphism
refs: project/UNSW/ISO(202603)/meeting.md, 20260508T000000-strassen
#+end meta

# Progress in Theoretical Computer Science

#+begin summary

This is a note for [Köbler, 2020, "ISO(2026-03)"](zotero://select/items/1_54IJ8DAF).

My current task is to skim Köbler's book and identify possible correspondences between the known graph-side reductions and the analogous tensor-side reductions:  

$$dathrm{GA} e_p athrm{GI} e_p athrm{GA}$$

$$ownarrow quad ? quad ownarrow quad ownarrow$$

$$
dathrm{TA} tackrel{?}{e_p} athrm{TI} e_p athrm{cTA}
$$

where

$$
dathrm{GA} e_p athrm{GI} e_p athrm{GA}
$$

and

$$
dathrm{TA} tackrel{?}{e_p} athrm{TI} e_p athrm{cTA}.
$$

In the graph-side chain, the reduction

$$
dathrm{GA} e_p athrm{GI}
$$

can be understood through coloring or encoding operations on graphs. The full graph-side chain has already been established.

The tensor-side reduction

$$
athrm{TI} e_p athrm{cTA}
$$

is already known in our current setting. The unclear part is the remaining tensor analogue, especially whether the graph-side idea behind

$$
dathrm{GA} e_p athrm{GI}
$$

has a valid tensor-side counterpart.

**Open point.**

The currently unclear part is whether the graph-side reduction idea behind
$$dathrm{GA} e_p athrm{GI}$$
has a valid tensor-side analogue
$$dathrm{TA} tackrel{?}{e_p} athrm{TI}.$$
#+end summary

## 

Basic Concepts

### Complexity Theory

## Reductions

### Basic Reductions

### Reductions in Our Paper

## Today

### Title

**From Graph Isomorphism/Automorphism to Tensor Isomorphism/Automorphism**

### Goal

My current task is to understand the graph-side relationship between $\mathrm{GI}$, $\mathrm{GA}$, $\mathrm{GI}$, and $\mathrm{GA}$ from Köbler--Schöning--Torán, and then identify which parts of this workflow may have tensor analogues.

## Graph-Side Definitions

For graphs $G$ and $H$, graph isomorphism asks whether there exists a bijection between their vertex sets preserving adjacency. I write

$$ \mathrm{GI} = {(G,H) : G \cong H}. $$

The automorphism group of $G$ is

$$ \mathrm{Aut}(G) = {\varphi \in S_n : \varphi(G) = G}. $$

The graph automorphism problem asks whether $\mathrm{Aut}(G)$ contains a non-identity element. The counting versions are

$$ \mathrm{GI}(G,H) = |\mathrm{Iso}(G,H)| $$

and

$$ \mathrm{GA}(G) = |\mathrm{Aut}(G)|. $$

## Reduction from GA to GI

For a vertex $i$ of $G$, let $G[i]$ denote $G$ with vertex $i$ labelled. Then $G$ has a nontrivial automorphism if and only if there exist $i \ne j$ such that

$$ G[i] \cong G[j]. $$

Indeed, an automorphism moving $i$ to $j$ gives an isomorphism $G[i] \to G[j]$. Conversely, any isomorphism $G[i] \to G[j]$ induces a nontrivial automorphism of $G$.

Thus $\mathrm{GA}$ can be decided by polynomially many $\mathrm{GI}$ queries.

## Disjoint Union Trick

For connected graphs $G$ and $H$,

$$ G \cong H $$

if and only if

$$ G \sqcup H $$

has an automorphism switching the two connected components.

This is the key mechanism behind the graph intuition: isomorphism between two objects becomes symmetry of their disjoint union.

## Counting Relation

For connected $G$ and $H$,

$\mathrm{GA}(G \sqcup H)$
===

$$\mathrm{GA}(G) \mathrm{GA}(H) + \mathrm{GI}(G,H)^2. $$

If $G$ and $H$ are not isomorphic, there are no component-switching automorphisms. If they are isomorphic, the additional automorphisms are exactly those switching the two components.

## Tensor Analogue

For tensors $A,B \in U \otimes V \otimes W$, tensor isomorphism asks whether there exists

$$ (P,Q,R) \in \mathrm{GL}(U) \times \mathrm{GL}(V) \times \mathrm{GL}(W) $$

such that

$$ B = (P,Q,R) \cdot A. $$

The automorphism group is

$\mathrm{Aut}(A)$
===

$${(P,Q,R) : (P,Q,R) \cdot A = A}. $$

The natural graph-to-tensor analogy is

$$ G \sqcup H \quad \longmapsto \quad A \oplus B. $$

We would like to know whether

$$ A \cong B $$

if and only if

$$ A \oplus B $$

has an automorphism switching the two direct summands.

## Main Obstruction

In graph theory, the connected components of $G \sqcup H$ are canonical and visible.

In tensor theory, the direct summands of $A \oplus B$ may not be visible after a change of basis. Therefore the tensor analogue needs a direct-sum decomposition theorem, likely of Strassen/Krull--Schmidt type.

## Questions

1. Are we targeting $\mathrm{TI} \le_p \mathrm{TA}$, $\mathrm{TI} \le_p \mathrm{cTA}$, or only identifying the obstruction?
2. What is the correct tensor category: ordinary 3-tensors, bilinear maps, or structure tensors of algebras/rings?
3. Which version of Strassen's indecomposable direct-sum theorem is needed?
4. If $\mathrm{Aut}(A \oplus B)$ is given by generators, how do we detect whether the generated group contains a summand-switching element?