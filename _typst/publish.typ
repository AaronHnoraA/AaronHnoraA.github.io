// publish.typ --- Typst style for public note PDFs

#import "/_typst/note.typ": *

#let note-paper = rgb("f5eddc")
#let note-ink = rgb("23180f")
#let note-accent = rgb("684a2c")
#let note-accent-soft = rgb("efe0c6")
#let note-rule = rgb("9d7a51")
#let note-link-fill = rgb("1d3f66")

#let note-theme(body) = {
  set page(
    paper: "a4",
    fill: rgb("ddd0b6"),
    margin: (x: 5.8em, y: 4.9em),
    header: context align(right)[
      #text(fill: rgb("6b553b"), size: 0.78em)[#counter(page).display()]
    ],
    footer: context align(center)[
      #text(fill: rgb("7a6041"), size: 0.72em)[Aaron He / Typst Note]
    ],
  )
  set text(
    font: note-body-font,
    size: 11.4pt,
    fill: note-ink,
    lang: "en",
  )
  set par(leading: 0.76em, justify: true)
  set table(
    stroke: 0.65pt + note-rule,
    inset: (x: 0.62em, y: 0.48em),
  )
  show heading: set text(font: note-heading-font, weight: "bold")
  show heading.where(level: 1): it => block[
    #v(0.62em)
    #block(
      width: 100%,
      fill: note-accent-soft,
      stroke: (left: 2pt + note-accent, rest: 0.55pt + rgb("d5bd98")),
      radius: 2pt,
      inset: (x: 0.82em, y: 0.55em),
    )[
      #text(fill: note-accent, size: 1.24em, weight: "bold")[#it]
    ]
    #v(0.18em)
  ]
  show heading.where(level: 2): it => block[
    #v(0.45em)
    #block(
      width: 100%,
      stroke: (bottom: 0.65pt + rgb("b49367")),
      inset: (bottom: 0.2em),
    )[
      #text(fill: rgb("4b3827"), weight: "semibold")[#it]
    ]
  ]
  show raw: set text(font: note-code-font, size: 0.9em)
  show math.equation: set text(font: note-math-font)
  show table.cell: set text(size: 0.94em)
  body
}

#let note-entry(toc: true, body) = {
  show: note-theme
  context {
    if not note-include-active.get() and toc {
      block(
        width: 100%,
        fill: rgb("efe3cc"),
        stroke: 0.55pt + rgb("b49367"),
        radius: 2pt,
        inset: 0.8em,
      )[
        #outline(title: [Contents], depth: 2)
      ]
    }
  }
  body
}
