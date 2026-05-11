#import "/_typst/note.typ": *
#show: note-entry

#metadata((
  kind: "note",
  id: "note-include-target",
  title: "Include Target",
  date: "2026-05-11",
  tags: ("test", "include"),
  aliases: (),
)) <note>

= Include Target

This note is included by `note-test.typ` through `#note-include("note-include-target")`.

#summary[
This is a small id-addressed include target without exported labels, so it is safe to compose into another note.
]
