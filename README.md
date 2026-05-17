# Aaron's Markdown Roam

This directory is Aaron's personal knowledge base and published website source.

The canonical note format is Markdown. Note identity, tags, links, and publishing metadata live in `#+begin meta` blocks in `roam/**/*.md`.

## Layout

- `roam/`: long-lived Markdown notes, grouped by directory.
- `CV/`: CV source and generated PDF. This is separate from the note publishing pipeline.
- `public/`: generated website output.
- `agent/`: AI-facing indexes, wiki summaries, and maintenance prompts generated from `roam/**/*.md`.

## Note Metadata

Each published note declares an org-env meta block:

```md
#+begin meta
id: 20260511T120000-example
title: Example
date: 2026-05-11
tags: math, draft
#+end meta
```

Cross-note links use normal relative Markdown links:

```md
[Example](../math/example.md)
```

Block notes use the org-env syntax supported by Aaronnote:

```md
#+begin theorem Optional title
Statement.
#+end theorem
```

Run `make maintain` after note content changes when the AI-facing Markdown indexes under `agent/` should be refreshed.

## Publishing

Run:

```sh
make publish
```

`bin/publish-site` scans Markdown note metadata, renders notes to `public/roam/**/*.html`, writes `public/js/data.js` for the archive and graph UI, and copies static assets.

Private areas are sealed during publishing. `bin/publish-site` treats every note under `roam/daily/` and `roam/project/` as private by default; change `PRIVATE_PATH_PREFIXES` there to add or remove folder-level shields. A single note can also opt in with `private: true`, `hidden: true`, `publish: false`, `visibility: "private"`, or a tag such as `"private"` / `"no-export"`. Private notes are hidden from the public note list and search, but their titles and note links remain in graph data so relationships stay connected. The source body, summary, tags, and private note assets are not distributed.

Note HTML rendering is incremental. Dependency snapshots live in `public/.deps/`; unchanged notes are skipped.

After a successful publish, ignored state file `public/.publish-state.json` records the current git `HEAD`. If the relevant publishing inputs are clean and the same `HEAD` is published again, `make publish` skips the whole publish pass. `make all` refreshes that state after its site commit so the next run can skip immediately. Use `make force` to bypass the manifest and render outputs.

`make all` publishes, syncs to the NAS target, commits changed output, and pushes.
