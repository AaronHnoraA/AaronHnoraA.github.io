# Aaron's Typst Note System

This directory is Aaron's personal knowledge base and published website source.

The canonical note format is Typst. Old Org files and org-roam are no longer part of the maintained workflow; note identity, tags, links, and publishing metadata live in `.typ` files.

## Layout

- `roam/`: long-lived Typst notes, grouped by directory.
- `_typst/`: shared Typst helper and generated wrapper files from `M-x my/note-db-sync`.
- `CV/`: Typst CV source and generated PDF.
- `public/`: generated website output.
- `agent/`: AI-facing indexes, wiki summaries, and maintenance prompts derived from Typst notes.

## Note Metadata

Each published note declares Typst metadata:

```typst
#metadata((
  kind: "note",
  id: "20260511T120000-example",
  title: "Example",
  date: "2026-05-11",
  tags: ("math", "draft"),
  aliases: (),
)) <note>
```

Cross-note links use the note helper:

```typst
#note("20260511T120000-example")[Example]
```

## Publishing

Run:

```sh
make publish
```

`bin/publish-site` scans Typst note metadata, compiles notes to HTML with Typst, writes `public/js/data.js` for the note graph/archive UI, copies static assets, and compiles `CV/main.typ` to `CV/Aaron_He_CV.pdf`.

`make all` publishes, syncs to the NAS target, commits changed output, and pushes.
