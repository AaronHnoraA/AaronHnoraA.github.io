#let note-paths = (
  "20260126T000000-hilbert-space": "/roam/math/hilbert_space.typ",
  "20260127T000000-hermitian-matrix": "/roam/math/hermitian_matrix.typ",
  "20260127T000000-inner-product-space": "/roam/math/inner_product_space.typ",
  "20260128T000000-density-operator": "/roam/QC/density_operator.typ",
  "20260128T000000-observable-expectation": "/roam/QC/observable_expectation.typ",
  "20260128T000000-quantum-state": "/roam/QC/quantum_state.typ",
  "20260130T000000-variance": "/roam/QC/variance.typ",
  "20260508T000000-20260508": "/roam/daily/uni/qc/ReadingGroup/20260508.typ",
  "20260508T000000-basic-algebra": "/roam/daily/reading/basic algebra.typ",
  "20260508T000000-strassen": "/roam/project/UNSW/ISO(202603)/strassen.typ",
  "note-include-target": "/roam/note-include-target.typ",
  "note-linked": "/roam/note-linked.typ",
  "note-test": "/roam/note-test.typ",
)

#let note-include-active = state("my-note-include-active", false)
#let note-path(id) = if id in note-paths { note-paths.at(id) } else { panic("Unknown note id: " + id) }
#let note-import-path(id) = note-path(id)
#let note-include(id) = {
  note-include-active.update(true)
  include(note-path(id))
  note-include-active.update(false)
}
#let note-transclude(id) = note-include(id)


#let note-theme(body) = {
  set page(
    fill: rgb("e7e5df"),
    margin: (x: 6.5em, y: 5.5em),
  )
  set text(
    font: ("New Computer Modern", "FZLiuGongQuanKaiShuJF", "Libertinus Serif", "New Computer Modern"),
    size: 12pt,
    fill: rgb("29251f"),
    lang: "en",
  )
  set par(leading: 0.72em, justify: true)
  set table(
    stroke: 0.65pt + rgb("d7ccb8"),
    inset: (x: 0.62em, y: 0.48em),
  )
  show heading: set text(font: ("New Computer Modern", "FZLiuGongQuanKaiShuJF", "New Computer Modern"), weight: "bold")
  show heading.where(level: 1): it => block[
    #set text(fill: rgb("5c5244"), size: 1.22em, weight: "bold")
    #it
    #v(0.22em)
    #line(length: 100%, stroke: 0.9pt + rgb("d8cfbf"))
  ]
  show heading.where(level: 2): it => block[
    #set text(fill: rgb("6a5f4f"), weight: "semibold")
    #it
  ]
  show raw: set text(font: "Fira Code", size: 0.92em)
  show math.equation: set text(font: ("GFS Neohellenic Math"))
  show table.cell: set text(size: 0.95em)
  body
}

#let note-entry(body) = {
  show: note-theme
  context {
    if not note-include-active.get() {
      outline(title: [目录], depth: 2)
    }
  }
  body
}

#let note-card(title, accent, tint, marker, body) = {
  block(
    width: 100%,
    fill: rgb("f4f3ef"),
    stroke: 0.7pt + rgb("d0cdc4"),
    radius: 7pt,
    inset: 0pt,
    breakable: true,
  )[
    #block(
      width: 100%,
      fill: rgb(tint),
      inset: (x: 0.78em, y: 0.42em),
    )[
      #text(
        fill: rgb(accent),
        weight: "bold",
        size: 0.92em,
      )[#title]
    ]
    #block(
      width: 100%,
      inset: (x: 0.92em, y: 0.76em),
    )[
      #{
        show math.equation: set text(font: ("GFS Neohellenic Math"))
        body
      }
      #v(0.42em)
      #align(right)[
        #text(
          fill: rgb(accent),
          size: 0.78em,
        )[#marker]
      ]
    ]
  ]
}

#let definition(body) = note-card("📘 定义", "8a6418", "f8ecd0", "◇", body)
#let theorem(body) = note-card("📐 定理", "2f6f42", "e5f3df", "♥", body)
#let lemma(body) = note-card("🪜 引理", "335f91", "e4edf8", "⋄", body)
#let corollary(body) = note-card("🔎 推论", "5a4f91", "ece8f8", "⇒", body)
#let cor(body) = corollary(body)
#let proposition(body) = note-card("📌 命题", "7a4b2d", "f3e6dc", "♠", body)
#let prop(body) = proposition(body)
#let property(body) = proposition(body)
#let proof(body) = note-card("✍️ 证明", "267386", "e1f2f4", "∎", body)
#let example(body) = note-card("🧪 例子", "80623a", "f1e5d4", "◦", body)
#let remark(body) = note-card("💬 备注", "5f6c7b", "e9ece8", "✦", body)
#let summary(body) = note-card("🧾 摘要", "476f78", "e3f1ee", "☰", body)
#let question(body) = note-card("❓ 问题", "8a6418", "f8ecd0", "?", body)
#let problem(body) = question(body)
#let solution(body) = note-card("✅ 解法", "2f6f42", "e5f3df", "✓", body)
#let important(body) = note-card("⚡ 重点", "9b3b37", "f4dfdc", "!", body)
#let warning(body) = note-card("⚠️ 警告", "9b3b37", "f4dfdc", "▲", body)
#let tip(body) = note-card("💡 提示", "26735f", "e1f1ea", "✧", body)
#let info(body) = note-card("ℹ️ 信息", "335f91", "e4edf8", "i", body)

#let note(..args) = {
  let pos = args.pos()
  if pos.len() == 2 {
    text(fill: rgb("1d4ed8"), underline(pos.at(1)))
  } else if pos.len() == 1 {
    note-card("📝 笔记", "26735f", "e1f1ea", "✎", pos.at(0))
  }
}
