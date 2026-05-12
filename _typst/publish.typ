// publish.typ --- Typst style for public note PDFs

#import "/_typst/note.typ": *

#let publish-paper = rgb("ddd0b6")
#let publish-ink = rgb("23180f")
#let publish-accent = rgb("684a2c")
#let publish-accent-soft = rgb("efe0c6")
#let publish-rule = rgb("9d7a51")
#let note-link-fill = rgb("1d3f66")

#let publish-theme = note-theme.with(
  page-fill: publish-paper,
  page-margin: (x: 5.8em, y: 4.9em),
  page-header: context align(right)[
    #text(fill: rgb("6b553b"), size: 0.78em)[#counter(page).display()]
  ],
  page-footer: context align(center)[
    #text(fill: rgb("7a6041"), size: 0.72em)[Aaron He / Typst Note]
  ],
  text-size: 11.4pt,
  text-fill: publish-ink,
  par-leading: 0.76em,
  table-stroke: 0.65pt + publish-rule,
  table-cell-size: 0.94em,
  raw-size: 0.9em,
  heading1-v-before: 0.62em,
  heading1-fill: publish-accent-soft,
  heading1-stroke: (left: 2pt + publish-accent, rest: 0.55pt + rgb("d5bd98")),
  heading1-radius: 2pt,
  heading1-inset: (x: 0.82em, y: 0.55em),
  heading1-text-fill: publish-accent,
  heading1-text-size: 1.24em,
  heading2-style: "rule",
  heading2-v-before: 0.45em,
  heading2-rule-stroke: 0.65pt + rgb("b49367"),
  heading2-rule-text-fill: rgb("4b3827"),
)

#let note-entry(toc: true, body) = {
  set page(paper: "a4")
  note-entry-with(
    body,
    toc: toc,
    theme: publish-theme,
    toc-title: [Contents],
    toc-wrapper: it => block(
        width: 100%,
        fill: rgb("efe3cc"),
        stroke: 0.55pt + rgb("b49367"),
        radius: 2pt,
        inset: 0.8em,
      )[#it],
  )
}
