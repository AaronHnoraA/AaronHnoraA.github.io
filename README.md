# Org / Aaronnote Workspace

This repository serves two purposes:

1. Development, testing, and packaging of `Aaronnote/`.
2. Publishing, indexing, and maintenance of the Markdown knowledge base under `roam/`.

The focus is on the editor, the publish pipeline, the data model, and the maintenance workflow — not on note content itself.

## Documentation

- [docs/README.md](docs/README.md): Documentation index
- [docs/project.md](docs/project.md): Project structure, ownership boundaries, maintenance conventions
- [docs/codebase.md](docs/codebase.md): Code layout and key modules
- [docs/status.md](docs/status.md): Current development state, test status, known issues

## Repository Layout

- `Aaronnote/`: Typora-style Markdown editor — web, desktop, and server builds.
- `roam/`: Local symlink to the Markdown note repository. It is ignored by this repo and remains the canonical source of truth for note content.
- `public/`: Published static site artifacts. These files are rebuilt locally, then committed so GitHub Pages can deploy them as plain static files.
- `bin/publish-site`: Publish script that generates `public/` from `roam/`.
- `agent/`: Derived indexes, condensed wiki, and maintenance scripts for AI retrieval.
- `CV/`: LaTeX résumé source and build output; largely independent of the editor/publish pipeline.

## Publishing

Publishing is intentionally local-first:

1. `make publish` reads the local `roam/` note tree and renders the static site into `public/`.
2. Sensitive notes and sensitive tags are masked in the published graph, links, lists, and rendered pages.
3. The generated `public/` files are committed to this repository.
4. GitHub Actions only uploads the committed `public/` directory to GitHub Pages. It does not clone `roam/`, install editor dependencies, or run the renderer.

This keeps private note access and rendering logic on the local machine. The GitHub runner only sees the already-published static artifact.

Before pushing a Pages update:

```sh
make publish
git status --short public
git add public
git commit -m "Publish static site"
git push
```

## Common Commands

From the repo root:

```sh
make publish
make maintain
make build
```

From `Aaronnote/`:

```sh
npm install
npm test
npm run start:vite
npm run build
```

## Current State

- `Aaronnote` last full test run on 2026-05-19: `48` test files, `628` tests, all passing.
- The publish pipeline is file-system and derived-data oriented, not a centralized database.
- Known limitations and next steps: [docs/status.md](docs/status.md).
