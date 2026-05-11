# Aaron's Typst Roam

This directory is Aaron's personal knowledge base and published website source.

The canonical note format is Typst. Old Org files and org-roam are no longer part of the maintained workflow; note identity, tags, links, and publishing metadata live in `.typ` files.

## Layout

- `roam/`: long-lived Typst notes, grouped by directory.
- `_typst/`: shared Typst helpers, generated note wrappers, and publish-only PDF styling.
- `CV/`: Typst CV source and generated PDF.
- `public/`: generated website output.
- `agent/`: AI-facing indexes, wiki summaries, and maintenance prompts. The existing index layer is kept until the Typst index refresh is handled separately.

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

Run `M-x my/note-db-sync` from Emacs after changing note identity, aliases, tags, or links. It rebuilds the local note database and refreshes `_typst/notes/<id>.typ` wrappers used by `note-include`, `note-transclude`, and cross-file imports.

Daily writing imports the normal helper:

```typst
#import "/_typst/note.typ": *
#show: note-entry
```

Publishing does not require notes to import a second style. `bin/publish-site` compiles a temporary source that redirects the first `"/_typst/note.typ"` import to `"/_typst/publish.typ"`, so public PDF-only visual changes belong in `_typst/publish.typ`.

## Publishing

Run:

```sh
make publish
```

`bin/publish-site` scans Typst note metadata, compiles public notes directly to `public/roam/**/*.pdf`, writes `public/js/data.js` for the archive and graph UI, copies static assets, and compiles `CV/main.typ` to `CV/Aaron_He_CV.pdf`.

The note archive links directly to PDFs; the browser handles PDF viewing. There is no generated per-note HTML wrapper, and note-page CSS is not part of the PDF presentation. Missing public visual effects should be implemented with Typst in `_typst/publish.typ`.

Private areas are sealed during publishing. `bin/publish-site` treats every note under `roam/daily/` and `roam/project/` as private by default; change `PRIVATE_PATH_PREFIXES` there to add or remove folder-level shields. A single note can also opt in with `private: true`, `hidden: true`, `publish: false`, `visibility: "private"`, or a tag such as `"private"` / `"no-export"`. Private notes are hidden from the public note list and search, but their titles and note links remain in graph data so relationships stay connected. The source body, summary, tags, and private note assets are not distributed; `bin/publish-site` writes a same-path PDF generated from `_typst/private.typ` that says the file has been sealed by the administrator.

Note PDF compilation is incremental. Dependency snapshots live in `public/.deps/`; unchanged notes are skipped, while edited notes or changed Typst/image dependencies are recompiled.

After a successful publish, ignored state file `public/.publish-state.json` records the current git `HEAD`. If the relevant publishing inputs are clean and the same `HEAD` is published again, `make publish` skips the whole publish pass. `make all` refreshes that state after its site commit so the next run can skip immediately. Use `make force` to bypass the manifest and recompile outputs.

Published `#note("id")[Title]` references are rewritten into clickable PDF links. By default links use site-root paths such as `/roam/math/example.pdf`; set `PUBLISH_BASE_URL=https://example.com` if the PDF should contain absolute web URLs.

`make all` publishes, syncs to the NAS target, commits changed output, and pushes.
