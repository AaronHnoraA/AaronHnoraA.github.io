#+begin meta
id: Kobler
title: Progress in Theoretical Computer Science
source: roam/project/UNSW/ISO(202603)/Kobler.md
#+end meta

# Progress in Theoretical Computer Science

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

Here the graph-side chain @@todo [to check it] {ddl:2026-05-19} 

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

# $d\mathrm{GA} \le_p \mathrm{GI}$

Take two distinct vertices $i \ne j$ of a graph $G$.

Let

$$
G[i]
$$

denote the graph obtained from $G$ by giving vertex $i$ a special label.

Then:

$$
G \text{ has an automorphism sending } i \text{ to } j
$$

if and only if

$$
G[i] \cong G[j].
$$

## Why?

Suppose there exists an automorphism

$$
\varphi \in \operatorname{Aut}(G)
$$

such that

$$
\varphi(i) = j.
$$

Since $\varphi$ preserves all adjacency relations of $G$, it naturally induces an isomorphism

$$
G[i] \to G[j].
$$

The special label on $i$ is sent to the special label on $j$, so the labeled graphs are isomorphic.

Conversely, suppose

$$
G[i] \cong G[j].
$$

Because graph isomorphisms between labeled graphs must preserve labels, the unique specially labeled vertex of $G[i]$, namely $i$, must be mapped to the unique specially labeled vertex of $G[j]$, namely $j$.

After forgetting the special labels, this isomorphism is an automorphism of the original graph $G$.

Therefore, it is an automorphism of $G$ sending $i$ to $j$.

Since $i \ne j$, this automorphism is nontrivial.

Hence the algorithmic criterion is:

$$
G \in \mathrm{GA}
\iff
\exists i \ne j,\quad G[i] \cong G[j].
$$