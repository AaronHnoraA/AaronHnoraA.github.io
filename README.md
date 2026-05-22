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
- `roam/`: Markdown source files; the canonical source of truth, not derived output.
- `public/`: Published site artifacts; rebuilable, not a source of truth.
- `bin/publish-site`: Publish script that generates `public/` from `roam/`.
- `agent/`: Derived indexes, condensed wiki, and maintenance scripts for AI retrieval.
- `CV/`: LaTeX résumé source and build output; largely independent of the editor/publish pipeline.

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
