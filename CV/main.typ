#let ink = rgb("#111827")
#let muted = rgb("#4b5563")
#let rule = rgb("#d1d5db")
#let accent = rgb("#2563eb")

#set page(
  paper: "us-letter",
  margin: (left: 0.66in, right: 0.66in, top: 0.62in, bottom: 0.62in),
)
#set text(font: "IBM Plex Sans", size: 9.25pt, fill: ink, lang: "en")
#set par(justify: false, leading: 0.72em)
#set list(indent: 0.15in, body-indent: 0.13in, spacing: 0.28em)

#let sep = text(fill: rule)[|]

#let contact-link(url, body) = text(fill: muted, size: 8.8pt)[#link(url)[#body]]

#let section(title) = {
  v(1.08em)
  grid(
    columns: (auto, 1fr),
    column-gutter: 0.7em,
    align: (horizon, horizon),
    text(size: 9.2pt, weight: "semibold", fill: accent, upper(title)),
    line(length: 100%, stroke: 0.55pt + rule),
  )
  v(0.62em)
}

#let entry(title, location, subtitle, dates) = {
  grid(
    columns: (1fr, auto),
    column-gutter: 1.2em,
    row-gutter: 0.24em,
    align: (left, right),
    text(size: 9.9pt, weight: "semibold", title),
    text(size: 9.2pt, fill: muted, location),
    text(size: 8.85pt, fill: muted, subtitle),
    text(size: 8.95pt, fill: muted, dates),
  )
  v(0.3em)
}

#let bullets(items) = {
  list(
    tight: true,
    marker: ([•],),
    ..items.map(item => [#item]),
  )
}

#let interest(name, body) = {
  block(below: 0.58em)[
    #text(weight: "semibold")[#name:] #body
  ]
}

#align(center)[
  #text(size: 20pt, weight: "semibold")[Chang He]
  #h(0.25em)
  #text(size: 17pt, fill: muted)[Aaron]

  #v(0.48em)
  #text(size: 8.8pt, fill: muted)[
    #contact-link("mailto:aaron.he@student.unsw.edu.au")[aaron.he\@student.unsw.edu.au]
    #h(0.45em)#sep#h(0.45em)
    #contact-link("https://github.com/AaronHnoraA")[github.com/AaronHnoraA]
    #h(0.45em)#sep#h(0.45em)
    #contact-link("https://aaronhnoraa.github.io/")[aaronhnoraa.github.io]
    #h(0.45em)#sep#h(0.45em)
    Sydney, Australia
  ]
]

#v(0.65em)

#section[Education]

#entry(
  [University of New South Wales (UNSW)],
  [Sydney, Australia],
  [Bachelor of Science in Mathematics, UNSW 3956],
  [Term 3, 2024 -- Present],
)
#bullets((
  [#strong[Expected graduation:] Term 3, 2028 (Honours).],
  [#strong[Planned transfer:] Bachelor of Computer Science, UNSW 3779.],
  [#strong[Academic standing:] WAM #strong[85]#text[;] admitted to the #link("https://www.unsw.edu.au/science/student-life-resources/student-opportunities/talented-students-program")[UNSW Talented Students Program (TSP)] in 2025.],
))

#section[Research Interests]

#interest[Quantum computing][quantum algorithms and quantum error correction, including fault-tolerant computation, stabilizer/CSS codes, and algebraic methods in finite-dimensional quantum systems.]
#interest[Mathematics][algebraic methods for isomorphism problems, multilinear algebra and tensor spaces, group actions, canonical forms, and related representation-theoretic tools.]
#interest[Theoretical computer science][computational complexity and algorithms, especially graph and tensor isomorphism, algebraic reductions, and structural problems at the interface of algebra and computation.]

#section[Research Experience]

#entry(
  [Independent Study, UTS],
  [Sydney, Australia],
  [Quantum Computing, Algebraic Algorithms, and Isomorphism Problems with #link("https://sites.google.com/site/jimmyqiao86/")[Youming Qiao]],
  [Term 2, 2025 -- Present],
)
#bullets((
  [Conducting supervised reading and research preparation in quantum computation, complexity theory, and algebraic methods for isomorphism problems.],
  [Working on graph isomorphism and tensor isomorphism problems, with emphasis on algebraic formulations, reductions, and invariants for equivalence testing.],
  [Preparing a manuscript on connections between graph isomorphism and tensor isomorphism.],
))

#v(0.5em)
#entry(
  [Talented Students Program, UNSW],
  [Sydney, Australia],
  [Academic Reading in Large Language Models with #link("https://www.unsw.edu.au/staff/quoc-le-gia")[Quoc Le Gia]],
  [Term 1, 2025],
)
#bullets((
  [Completed supervised academic reading through the UNSW Talented Students Program, focusing on selected literature in large language models.],
  [Developed practice in reading research papers, extracting technical assumptions, and presenting mathematical and algorithmic ideas clearly.],
))
