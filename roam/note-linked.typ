#import "/_typst/note.typ": *
#show: note-entry
#set heading(numbering: "1.")
#set math.equation(numbering: "(1)")

#let cross-file-sum-equation = [
  $ sum_(i=1)^n i = (n (n + 1)) / 2 $ <eq-cross-sum>
]

#metadata((
  kind: "note",
  id: "note-linked",
  title: "Linked Note",
  date: "2026-05-11",
  tags: ("test",),
  aliases: (),
)) <note>

= Linked Note

This note should show a backlink from #note("note-test")[Note Test] after `M-x my/note-db-sync`.

== Linked note formula <linked-formula-section>

A second labelled equation verifies references inside this note:

#cross-file-sum-equation

The local formula reference is @eq-cross-sum, and this section is @linked-formula-section.
