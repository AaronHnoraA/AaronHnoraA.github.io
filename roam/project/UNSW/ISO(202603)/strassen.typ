#import "/_typst/note.typ": *
#set heading(numbering: "1.")
#set math.equation(numbering: "(1)")

#metadata((
  kind: "note",
  id: "20260508T000000-strassen",
  title: "Strassen",
  date: "2026-05-08",
  tags: ("math", "tensor_complexity", "Strassen", "bilinear_maps", "summary", "project",),
  aliases: (),
)) <note>

= 总览

这份笔记围绕 Strassen 1987 中的 tensor complexity / asymptotic rank / laser method 思想展开。

核心问题：

#question[
How can we compare bilinear computational problems using tensors, restriction, degeneration, and asymptotic rank?
]

中文主线：

- 把矩阵乘法看成 bilinear map。
- 把 bilinear map 写成 tensor。
- 用 tensor rank 表示“需要多少次乘法”。
- 用 restriction 表示“一个问题能模拟另一个问题”。
- 用 border rank / degeneration 表示“极限意义下近似模拟”。
- 用 asymptotic rank 研究规模变大时的增长率。
- 用 laser method 从 tensor powers 中抽取大量独立的 matrix multiplication tensors。
- 最终得到矩阵乘法指数 $ omega $ 的上界。

#summary[
Strassen 的思想不是只研究一个固定 tensor 的 rank，而是研究 tensor 在 direct sum、tensor product、restriction、degeneration、asymptotic limit 下形成的复杂度结构。
]

= 核心概念

== Matrix multiplication exponent

#definition[
The matrix multiplication exponent $ omega $ is the infimum of all real numbers $ tau $ such that $n times  n$ matrix multiplication can be computed using
$ O(n^( tau + epsilon )) $
arithmetic operations for every $ epsilon >0$.
]

更直观地说：

$  omega 
=
 inf { tau  : "matrix multiplication has complexity " O(n^( tau +o(1)))}. $

#note[
中文：$ omega $ 描述的是矩阵乘法复杂度的渐近增长率，不是某个固定 $n$ 的精确乘法次数。
]

== Bilinear map

#definition[
A bilinear map over a field $K$ is a map
$ f:U times  V ->  W $
such that $f$ is linear in each variable separately.
]

Examples:

- scalar multiplication,
- polynomial multiplication,
- matrix multiplication,
- tensor contraction.

== Tensor representation of a bilinear map

Given finite-dimensional vector spaces $U,V,W$, a bilinear map

$ f:U times  V ->  W $

corresponds canonically to a tensor

$ t_f in  U^* times.circle  V^* times.circle  W. $

#note[
中文直觉：bilinear map 有两个输入槽和一个输出槽；tensor $U^* times.circle  V^* times.circle  W$ 正好表达“两个输入探针 + 一个输出方向”。
]

If bases are chosen, we can write

$ f(u,v)
=
 sum _(i,j,k) t_(i j k) x_i^*(u)y_j^*(v)w_k. $

So the coefficients $t_(i j k)$ form a 3-dimensional array.

== Matrix multiplication tensor

The multiplication of an $m times  n$ matrix and an $n times  p$ matrix is a bilinear map

$ op("Mat")_(m,n) times  op("Mat")_(n,p) ->  op("Mat")_(m,p). $

Its associated tensor is usually denoted

$  lr(angle.l m,n,p angle.r) . $

In particular, square $n times  n$ matrix multiplication is

$  lr(angle.l n,n,n angle.r) . $

= 证明路线

根据你的 page 4 笔记，整篇证明可以按以下路线理解。

== Step 1: Matrix multiplication to bilinear rank

#summary[
文章开场先解释矩阵乘法指数 $ omega $ 的意义，然后把矩阵乘法复杂度翻译成 bilinear rank / tensor rank 语言。
]

三个核心工具：

1. bilinear rank / tensor rank；
2. degeneration / border rank；
3. laser method。

== Step 2: Bookkeeping

把计算问题编码成 tensor。

#note[
也就是把“输入、输出、乘法次数”从算法语言改写成张量分解语言。
]

矩阵乘法复杂度问题变成：

#question[
Can we decompose the matrix multiplication tensor into few simple rank-one tensors?
]

== Step 3: Restriction preorder

建立复杂度比较关系：

$ f <=  g. $

含义：

#quote[
$f$ can be obtained from $g$ by linear transformations on the input and output tensor legs.
]

计算意义：

#quote[
If $f <=  g$, then $g$ can simulate $f$.
]

因此 rank 具有单调性：

$ f <=  g
 ==> 
R(f) <=  R(g). $

== Step 4: Exact comparison to approximate comparison

从 exact restriction 推广到 approximate restriction / degeneration。

#note[
中文：不仅允许“精确做出来”，也允许“作为极限做出来”。
]

这引出 border rank。

== Step 5: Geometry to polynomial degeneration

几何极限可以改写成带参数的 polynomial family。

大致思想：

$ t_ epsilon   ->  t
 quad 
"as"
 quad 
 epsilon  ->  0. $

如果 $t_ epsilon $ 对每个非零 $ epsilon $ 都能由某个 tensor 限制得到，那么 $t$ 是其 degeneration。

== Step 6: Interpolation and extra diagonal tensor

参数化 degeneration 可以通过 interpolation 转换成 exact restriction，但需要额外付出一个 diagonal tensor 因子。

中文理解：

#quote[
极限对象不能直接精确得到，但可以把参数多项式在若干点取值，然后通过插值重建目标系数。
]

== Step 7: Support, partition, and mass extraction

选择一个特殊 tensor，做 support partition，制造一个子结构，然后用前面的 exact/approximate 比较工具，从 tensor powers 中抽取很多 independent matrix multiplication tensors。

最终路线：

$ "exact order"
 -> 
"approximate order"
 -> 
"formalization over " K( epsilon )
 -> 
"weight certificate on support"
 -> 
"mass extraction"
 -> 
 omega "-theorem". $

= Bilinear Maps and Tensors

== From bilinear maps to tensors

Let

$ f:U times  V ->  W. $

Choosing bases of $U,V,W$, we can write

$ f(u,v)
=
 sum _(i,j,k) t_(i j k)x_i^*(u)y_j^*(v)w_k. $

Therefore

$ t_f
=
 sum _(i,j,k)t_(i j k)x_i^* times.circle  y_j^* times.circle  w_k
 in  U^* times.circle  V^* times.circle  W. $

#important[
A bilinear map and its associated tensor are essentially the same object once the spaces are fixed.
]

== Rank-one bilinear maps

A rank-one bilinear map has the form

$ (u,v) arrow.r.bar   alpha (u) beta (v)w $

where

$  alpha  in  U^*, wide   beta  in  V^*, wide  w in  W. $

Its tensor is

$  alpha  times.circle   beta  times.circle  w. $

== Tensor rank

#definition[
The tensor rank $R(t)$ of
$ t in  U^* times.circle  V^* times.circle  W $
is the smallest $r$ such that
$ t= sum _( rho =1)^r  alpha _ rho  times.circle   beta _ rho  times.circle  w_ rho . $
]

For a bilinear map $f$, we write

$ R(f)=R(t_f). $

#note[
Computational meaning:
$R(f)$ is the minimum number of scalar multiplications needed to compute the bilinear map $f$, ignoring additions and scalar multiplications.
]

== Standard diagonal tensor

Define the standard rank-$r$ tensor

$  lr(angle.l r angle.r) 
=
 sum _( rho =1)^r e_ rho ^* times.circle  e_ rho ^* times.circle  e_ rho . $

This represents $r$ independent scalar multiplications.

#note[
中文：$ lr(angle.l r angle.r) $ 是最标准的“$r$ 次乘法模板”。
]

= Restriction

== Definition

#definition[
Let
$ f in  U^* times.circle  V^* times.circle  W $
and
$ g in  {U'}^* times.circle  {V'}^* times.circle  W'. $

We say
$ f <=  g $
if there exist linear maps
$ A:U ->  U', wide  B:V ->  V', wide  C:W' ->  W $
such that
$ f=(A^* times.circle  B^* times.circle  C)(g). $
]

Equivalent computational interpretation:

#quote[
Use $g$ as an oracle. Before feeding inputs into $g$, apply linear preprocessing. After getting $g$'s output, apply linear postprocessing. If this produces $f$, then $f <=  g$.
]

中文直觉：

#quote[
从一个更大的 bilinear problem 里面，通过线性投影和线性处理，裁剪出一个更小的 bilinear problem。
]

== Restriction as simulation

If

$ f <=  g, $

then an algorithm for $g$ gives an algorithm for $f$.

Thus $g$ is at least as powerful as $f$.

#important[
The direction is easy to confuse:
$ f <=  g $
means $f$ is reducible to $g$, or $g$ can simulate $f$.
]

= Rank and Restriction

== Monotonicity of rank

#proposition[
If
$ f <=  g, $
then
$ R(f) <=  R(g). $
]

#proof[
Assume

$ R(g)=r. $

Then $g$ has a rank decomposition

$ g= sum _( rho =1)^r x_ rho  times.circle  y_ rho  times.circle  z_ rho . $

Since $f <=  g$, there exist linear maps $A,B,C$ such that

$ f=(A times.circle  B times.circle  C)(g). $

Applying the linear maps to the decomposition gives

$ f
=
 sum _( rho =1)^r
A(x_ rho ) times.circle  B(y_ rho ) times.circle  C(z_ rho ). $

Each summand is still rank-one or zero. Therefore $f$ is a sum of at most $r$ rank-one tensors.

Hence

$ R(f) <=  r=R(g). $

Therefore

$ R(f) <=  R(g). $
]

#note[
中文：restriction 不会增加 rank，因为线性映射会把 rank-one tensor 送到 rank-one tensor 或 $0$。
]

== Rank via restriction to diagonal tensor

#proposition[
For a tensor $t$,
$ R(t) <=  r $
if and only if
$ t <=   lr(angle.l r angle.r) . $
]

#proof[
First suppose

$ R(t) <=  r. $

Then

$ t= sum _( rho =1)^r x_ rho  times.circle  y_ rho  times.circle  z_ rho . $

Define linear maps from the three legs of $ lr(angle.l r angle.r) $ by sending the $ rho $-th standard basis vector to $x_ rho ,y_ rho ,z_ rho $, respectively. Applying these maps to

$  lr(angle.l r angle.r) 
=
 sum _( rho =1)^r e_ rho  times.circle  e_ rho  times.circle  e_ rho  $

gives exactly $t$. Hence

$ t <=   lr(angle.l r angle.r) . $

Conversely, if

$ t <=   lr(angle.l r angle.r) , $

then by monotonicity,

$ R(t) <=  R( lr(angle.l r angle.r) )=r. $

Therefore

$ R(t) <=  r
 <==> 
t <=   lr(angle.l r angle.r) . $
]

#important[
This is why restriction is the correct language for rank.
Rank is just restriction to the diagonal multiplication tensor.
]

= Direct Sum and Tensor Product

== Direct sum

#definition[
Given bilinear maps
$ f:U times  V ->  W $
and
$ g:U' times  V' ->  W', $
their direct sum is
$ f plus.circle  g:(U plus.circle  U') times  (V plus.circle  V') ->  W plus.circle  W' $
defined by
$ (f plus.circle  g)((u,u'),(v,v'))=(f(u,v),g(u',v')). $
]

中文直觉：

#quote[
Direct sum means solving two independent bilinear problems side by side.
]

Tensor notation:

$ t_(f plus.circle  g)=t_f plus.circle  t_g. $

== Tensor product

#definition[
Given bilinear maps $f$ and $g$, their tensor product $f times.circle  g$ is the bilinear problem obtained by multiplying/composing the two problems into a larger one.
]

On tensors:

$ t_(f times.circle  g)=t_f times.circle  t_g. $

中文直觉：

#quote[
Tensor product means combining two computational problems multiplicatively.
]

== Difference between $ plus.circle $ and $ times.circle $

#summary[
$ plus.circle $: put problems side by side.

$ times.circle $: multiply problems into a larger joint problem.
]

Examples:

$  lr(angle.l a angle.r)  plus.circle   lr(angle.l b angle.r) 
=
 lr(angle.l a+b angle.r) . $

$  lr(angle.l a angle.r)  times.circle   lr(angle.l b angle.r) 
=
 lr(angle.l a b angle.r) . $

== Why direct sum matters

Matrix multiplication complexity studies asymptotic behavior.

Tensor powers often decompose into many independent pieces:

$ t^( times.circle  N) $

may contain direct sums of matrix multiplication tensors.

Laser method aims to extract many independent matrix multiplication tensors from such powers.

= Semiring Viewpoint

== Ring

#definition[
A ring is a set $R$ with two operations, usually called addition and multiplication, such that:
- addition forms an abelian group;
- multiplication is associative;
- multiplication distributes over addition.
]

Distributivity means:

$ a(b+c)=a b+a c, $

$ (a+b)c=a c+b c. $

== Semiring

#definition[
A semiring is like a ring, but additive inverses are not required.
]

中文：

#quote[
Semiring 可以做加法和乘法，但不一定能做减法。
]

== Tensor isomorphism classes as a semiring

In this setting, consider tensor isomorphism classes.

Addition is direct sum:

$ [t]+[s]=[t plus.circle  s]. $

Multiplication is tensor product:

$ [t][s]=[t times.circle  s]. $

#note[
This behaves like a commutative semiring.
]

== Why semiring language is useful

It lets us discuss:

- powers $t^( times.circle  n)$,
- sums $t plus.circle  s$,
- preorder $t <=  s$,
- asymptotic rank,
- degeneration,
- extraction of many copies.

#summary[
The semiring viewpoint turns tensor complexity into an algebraic order problem.
]

= Asymptotic and Border Rank

== Asymptotic rank

#definition[
The asymptotic rank of a tensor $t$ is
$ tilde(R)(t)
=
 lim _(n ->  infinity ) R(t^( times.circle  n))^(1/n), $
when the limit exists.
]

Usually, the limit exists by submultiplicativity and Fekete's lemma.

#note[
中文：asymptotic rank 衡量 tensor powers 长大后 rank 的指数级增长率。
]

== Why asymptotic rank matters

For matrix multiplication tensor,

$  lr(angle.l n,n,n angle.r) , $

rank controls exact algorithms, but asymptotic rank controls $ omega $.

Roughly:

$ R( lr(angle.l n,n,n angle.r) )
 approx  n^ omega . $

== Border rank

#definition[
The border rank $underline(R)(t)$ is the smallest $r$ such that $t$ is a limit of tensors of rank at most $r$.
]

Formally, $t$ has border rank at most $r$ if there exists a family $t_ epsilon $ such that:

$ R(t_ epsilon ) <=  r $

for all $ epsilon  !=  0$, and

$  lim _( epsilon  ->  0)t_ epsilon =t. $

#note[
中文：border rank 允许“极限近似算出来”，不要求每一步都精确等于目标 tensor。
]

== Degeneration

#definition[
A tensor $t$ is a degeneration of $s$, written informally as
$ t lt.tri.eq  s, $
if $t$ can be obtained from $s$ by a limiting family of restrictions.
]

Restriction:

$ t <=  s $

means exact simulation.

Degeneration:

$ t lt.tri.eq  s $

means approximate or limiting simulation.

#important[
$ t <=  s $
is exact.

$ t lt.tri.eq  s $
is approximate / limiting.
]

== From degeneration to exact restriction with overhead

A key Strassen-style move:

#quote[
Approximate restriction can often be converted into exact restriction after paying an additional diagonal tensor factor.
]

Informally, polynomial interpolation turns parameterized approximations into exact computations.

= Laser Method Intuition

== Problem

Tensor powers $t^( times.circle  N)$ are huge and complicated.

They may contain many pieces, but not obviously in a clean direct sum form.

== Goal

Extract from $t^( times.circle  N)$ a large direct sum of matrix multiplication tensors:

$  plus.circle.big _i  lr(angle.l a_i,b_i,c_i angle.r) . $

Then compare ranks:

$  sum _i R( lr(angle.l a_i,b_i,c_i angle.r) )
 <= 
R(t^( times.circle  N)). $

== Laser idea

#summary[
The laser method selects a structured part of the support of $t^( times.circle  N)$, zeros out unwanted components, and keeps many independent matrix multiplication tensors.
]

中文：

#quote[
像用激光一样，从一个很大的 tensor power 里面切出大量互不干扰的矩阵乘法子问题。
]

== Support and weights

A tensor has support

$ op("supp")(t)
=
{(i,j,k):t_(i j k) !=  0}. $

Laser method often assigns weights to support elements and chooses subsets satisfying certain compatibility constraints.

This creates direct-sum-like behavior.

== Mass extraction

The objective is to extract many copies with large total “mass”.

This gives inequalities that imply upper bounds on $ omega $.

#note[
Page 4 的 proof route 写成：
exact order
$ -> $
approximate order
$ -> $
formalization over $K( epsilon )$
$ -> $
weight certificate on support
$ -> $
mass extraction
$ -> $
$ omega $-theorem.
]

= Krull-Schmidt and Decomposition

== Indecomposable tensors

#definition[
A tensor $t$ is indecomposable if it cannot be written as a nontrivial direct sum
$ t=s plus.circle  u. $
]

中文：

#quote[
不能再分成两个独立计算问题的 tensor，称为 indecomposable。
]

== Krull-Schmidt theorem

#theorem[
Under suitable conditions, if an object decomposes as a finite direct sum of indecomposable objects in two ways,
$ A_1 plus.circle  dots.c  plus.circle  A_n
 tilde.equiv 
B_1 plus.circle  dots.c  plus.circle  B_m, $
then
$ n=m, $
and after a permutation, corresponding summands are isomorphic.
]

中文：

#quote[
如果一个对象可以分解成若干不可分解对象，那么这种分解本质上唯一，只差排列和同构。
]

== Basis as finest one-dimensional decomposition

A basis gives a finest decomposition of a vector space into one-dimensional pieces:

$ V=K e_1 plus.circle  dots.c  plus.circle  K e_n. $

Block decomposition is a coarser decomposition:

$ V=V_1 plus.circle  dots.c  plus.circle  V_r. $

#note[
中文：basis 是最细的一维分解；block decomposition 是更粗粒度的分解。
]

= Linear Algebra Rewritten by Direct Sum and Tensor Product

== Traditional order

Common linear algebra is often taught as:

$ "vectors"
 -> 
"matrices"
 -> 
"linear maps"
 -> 
"eigenvectors"
 -> 
"bilinear maps". $

== Tensor-complexity order

Using direct sum and tensor product, one can reorganize it as:

$ "spaces"
 -> 
"decompositions"
 -> 
"maps as tensors"
 -> 
 plus.circle 
 -> 
 times.circle . $

#summary[
The point is to treat decomposition and composition of spaces as primary, instead of treating matrices as the starting point.
]

== Vector spaces

A vector space can be understood through decompositions.

For a basis $e_1, dots ,e_n$,

$ V=K e_1 plus.circle  dots.c  plus.circle  K e_n. $

Dimension satisfies:

$  dim (V plus.circle  W)= dim  V+ dim  W. $

== Linear maps as block matrices

Suppose

$ V=V_1 plus.circle  dots.c  plus.circle  V_m, $

$ W=W_1 plus.circle  dots.c  plus.circle  W_n. $

A linear map

$ T:V ->  W $

can be viewed as a block matrix with components

$ T_(i j):V_j ->  W_i. $

#note[
中文：matrix 的本质是 linear map 在 direct-sum decomposition 下的 block description。
]

== Dual space

#definition[
The dual space of $V$ is
$ V^*=op("Hom")(V,K). $
Its elements are linear functionals
$  phi :V ->  K. $
]

中文直觉：

#quote[
Dual vectors are linear measurements / linear probes.
]

If

$ V=K e_1 plus.circle  dots.c  plus.circle  K e_n, $

then the dual basis

$ e_1^*, dots ,e_n^* $

is defined by

$ e_i^*(e_j)= delta _(i j). $

== Linear maps as tensors

There is a canonical isomorphism

$ op("Hom")(V,W) tilde.equiv  V^* times.circle  W. $

Thus a linear map

$ T:V ->  W $

can be regarded as a tensor

$ T in  V^* times.circle  W. $

With bases,

$ T= sum _(i,j) a_(i j)e_i^* times.circle  w_j. $

#note[
中文：$e_i^*$ 是 input detector，$w_j$ 是 output direction，系数 $a_(i j)$ 就是矩阵条目。
]

== Bilinear maps as tensors

Similarly,

$ op("Bilin")(U,V;W)
 tilde.equiv 
U^* times.circle  V^* times.circle  W. $

So a bilinear map

$ f:U times  V ->  W $

is a tensor with two input probes and one output direction.

= Proof Templates

== Template: prove restriction monotonicity of rank

#proof[
Assume $f <=  g$. Then there exist linear maps on the three tensor legs such that

$ f=(A times.circle  B times.circle  C)(g). $

Let

$ g= sum _( rho =1)^(R(g))x_ rho  times.circle  y_ rho  times.circle  z_ rho  $

be a minimal rank decomposition of $g$. Applying the linear maps gives

$ f=
 sum _( rho =1)^(R(g))
A(x_ rho ) times.circle  B(y_ rho ) times.circle  C(z_ rho ). $

Each summand is rank-one or zero. Hence $f$ has a rank decomposition using at most $R(g)$ rank-one tensors. Therefore

$ R(f) <=  R(g). $
]

== Template: prove $R(t) <=  r <==>  t <=   lr(angle.l r angle.r) $

#proof[
If $R(t) <=  r$, then

$ t= sum _( rho =1)^r x_ rho  times.circle  y_ rho  times.circle  z_ rho . $

The diagonal tensor is

$  lr(angle.l r angle.r) = sum _( rho =1)^r e_ rho  times.circle  e_ rho  times.circle  e_ rho . $

Define linear maps sending $e_ rho $ to $x_ rho $, $y_ rho $, and $z_ rho $ on the three legs. Then $ lr(angle.l r angle.r) $ restricts to $t$, so

$ t <=   lr(angle.l r angle.r) . $

Conversely, if $t <=   lr(angle.l r angle.r) $, then by monotonicity,

$ R(t) <=  R( lr(angle.l r angle.r) )=r. $

Therefore

$ R(t) <=  r
 <==> 
t <=   lr(angle.l r angle.r) . $
]

== Template: explain direct sum

#tip[
The direct sum $f plus.circle  g$ means solving two independent bilinear problems side by side. Its input spaces, output spaces, and tensor are all direct sums of the corresponding pieces. Computationally, no cross terms are used between the $f$-part and the $g$-part.
]

== Template: explain tensor product

#tip[
The tensor product $f times.circle  g$ means combining two bilinear problems multiplicatively into a larger bilinear problem. It is not merely placing problems side by side; it creates a product structure where the dimensions and rank behavior multiply.
]

== Template: explain restriction

#tip[
A restriction $f <=  g$ means $f$ can be obtained from $g$ by linear preprocessing of inputs and linear postprocessing of outputs. Hence an algorithm for $g$ gives an algorithm for $f$. This makes restriction a computational preorder.
]

== Template: explain border rank

#tip[
Border rank allows approximate computation in a limiting sense. A tensor $t$ has border rank at most $r$ if it is the limit of tensors of rank at most $r$. Thus border rank can be smaller than ordinary rank because it permits degeneration.
]

== Template: explain laser method

#tip[
The laser method studies large tensor powers $t^( times.circle  N)$. These powers contain many structured components. By selecting a suitable support subset and zeroing out incompatible parts, one extracts a large direct sum of independent matrix multiplication tensors. This extraction yields inequalities that imply upper bounds on the matrix multiplication exponent $ omega $.
]

= Common Mistakes

== Mistake 1: Confusing restriction direction

Wrong:

$ f <=  g
 quad 
"means"
 quad 
f " can compute " g. $

Correct:

$ f <=  g
 quad 
"means"
 quad 
g " can simulate " f. $

== Mistake 2: Confusing direct sum and tensor product

Direct sum:

$ f plus.circle  g $

means independent side-by-side computation.

Tensor product:

$ f times.circle  g $

means multiplicative combination into a larger problem.

== Mistake 3: Thinking border rank is exact rank

Rank asks:

$ t= sum _( rho =1)^r "rank-one tensors". $

Border rank asks:

$ t= lim _( epsilon  ->  0)t_ epsilon  $

where each $t_ epsilon $ has rank at most $r$.

== Mistake 4: Treating tensor coordinates as intrinsic

Coordinates depend on basis choice.

The intrinsic object is the tensor orbit under changes of bases:

$ op("GL")(U) times  op("GL")(V) times  op("GL")(W). $

== Mistake 5: Forgetting asymptotic behavior

Strassen-style tensor complexity is not only about one tensor.

It studies tensor powers:

$ t^( times.circle  n) $

and limiting quantities such as

$ tilde(R)(t)
=
 lim _(n ->  infinity )R(t^( times.circle  n))^(1/n). $

= Minimal Memory Version

#summary[
Strassen 1987 can be understood as follows:

1. Matrix multiplication is a bilinear map, hence a tensor.
2. Tensor rank measures bilinear multiplication complexity.
3. Restriction $f <=  g$ means $g$ can simulate $f$.
4. Rank is monotone under restriction:
$    f <=  g ==>  R(f) <=  R(g). $
5. $R(t) <=  r$ iff $t <=   lr(angle.l r angle.r) $.
6. Direct sum means independent side-by-side problems.
7. Tensor product means multiplicative composition of problems.
8. Tensor isomorphism classes with $ plus.circle $ and $ times.circle $ form a semiring-like structure.
9. Border rank allows limiting approximations.
10. Asymptotic rank studies $R(t^( times.circle  n))^(1/n)$.
11. Laser method extracts many independent matrix multiplication tensors from tensor powers.
12. This machinery gives upper bounds on the matrix multiplication exponent $ omega $.
]
