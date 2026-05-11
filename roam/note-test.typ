#import "/_typst/note.typ": *
#show: note-entry
#let linked-note-path = note-import-path("note-linked")
#import linked-note-path: cross-file-sum-equation
#set heading(numbering: "1.")
#set math.equation(numbering: "(1)")

#metadata((
  kind: "note",
  id: "note-test",
  title: "Note Test",
  date: "2026-05-11",
  tags: ("test", "typst"),
  aliases: ("Typst note smoke test",),
)) <note>

= Note Test

This is a small Typst note used to test the Emacs note index.

It links to #note("note-linked")[Linked Note]. The rendered text is styled by Typst, while Emacs handles navigation from source/preview sync.

== Local Typst reference <local-section>

Typst-native local references can still use labels such as @local-section.

== Formula reference <formula-section>

The following equation is labelled and referenced as @eq-bayes:

$ P(A | B) = (P(B | A) P(A)) / P(B) $ <eq-bayes>

Inline math also works: $S in BB$.

== Cross-file formula reference <cross-file-formula-section>

The next equation is imported from `note-linked.typ` but labelled in this composed Typst document:

#cross-file-sum-equation

The cross-file formula reference is @eq-cross-sum.

== Cross-file reference only <cross-file-reference-only-section>

This section does not display the imported formula again. It only references the existing cross-file label: @eq-cross-sum.

The linked note is #note("note-linked")[here], while the local section is @local-section and the local formula is @eq-bayes.


#definition[
  这里写定义内容。
]

#proof[
这里写证明过程。

    $s s ^4$
    $ s s $

    asda
]

#proof[
    asd

]


== Roam id multi-file composition <roam-id-multi-file>

The cross-file formula above is imported through `note-import-path("note-linked")`, so it follows the note database id registry instead of a handwritten path.

The linked note can also be included by id:

#note-include("note-include-target")
