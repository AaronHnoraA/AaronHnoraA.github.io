# Codebase Guide

## Overview

The codebase has two main threads:

1. The `Aaronnote` editor
2. The `roam → publish → public` pipeline and data derivation chain

These threads are coupled but have distinct responsibilities. `Aaronnote` handles Markdown rendering and editing; the publish pipeline turns Markdown data into a site and indexes.

For a finer breakdown of tech stack, core composition, and state machines, see [architecture.md](architecture.md).

## Aaronnote

### Top-level layout

- `Aaronnote/src/`: editor core library
- `Aaronnote/specs/`: behavior specs and event scripts
- `Aaronnote/tests/`: Vitest tests
- `Aaronnote/website/`: web harness / demo
- `Aaronnote/aaronnote/`: application shell and extra UI
- `Aaronnote/server/lib/`: local service implementation and domain exports used by Electron IPC
- `Aaronnote/desktop/`: Electron entry point
- `plugin/`: local Aaronnote plugins; Vite loads entries via `plugin/*/plugin.json` and `index.ts`

### Core modules

- `src/lib.ts`: public API entry point
- `src/editor-api.ts`: `createEditor()` facade and public controller types
- `src/cm6/editor-cm6.ts`: CM6 `EditorView` assembly and public API implementation
- `src/cm6/live-preview.ts`: Markdown inline/line live-preview decorations
- `src/cm6/commands.ts`: editing commands, block context, quick insert
- `src/cm6/widgets/*.ts`: math/code/image/task/org-env/TOC and related CM6 widgets
- `src/render-html.ts`: Markdown → HTML export/publish renderer

### Feature organization

`src/cm6/widgets/*.ts` and `src/cm6/*.ts` are split by syntax/behavior, each responsible for:

- Lezer Markdown tree scanning
- CM6 decorations / widgets
- Commands and source-range mapping
- Parser token handling
- Serializer rules
- Inline scanning
- Input rules or plugins

Tests and specs are in:

- `specs/features/*.specs.ts`
- `tests/features/*.test.ts`

This is the most important development convention. When adding a new syntax, extend along this path rather than injecting scattered logic into the core.

### Editor architecture key point

`Aaronnote` uses Method B:

- Markdown source delimiters are kept in the document text.
- Inline marks are not fixed at input time; they are derived uniformly in `normalize.ts`.
- The view hides or hints at delimiters through decorations.

Benefits: more stable round-trip. Trade-offs:

- New inline syntax must be compatible with `parseInline` / `normalize`.
- Plugins that directly manipulate inline marks will normally be overwritten by normalize.

### Local plugins

The plugin runtime is started by `Aaronnote/aaronnote/main.ts` after scanning plugins through the native API bridge. Plugins should contain UI and behavior in `plugin/<id>/index.ts` and declare autoload, actions, and settings in `plugin.json`.

Current plugins:

- `plugin/copilot`: GitHub Copilot inline completion
- `plugin/roamlookup`: Roam lookup tab in the Notes page; calls the server-side Codex lookup session to query the `roam/` knowledge base

Plugins doing ordinary text input should use `editor.insertText()`; use `replaceMarkdownRange()` only when genuinely rewriting by Markdown source offset.

## Publish Pipeline

Entry point: `bin/publish-site`.

### Responsibilities

- Scan `roam/**/*.md`
- Parse metadata
- Build note list
- Parse references and backlinks
- Call `Aaronnote/scripts/render-html.mjs` to render body HTML
- Write HTML to `public/roam/**/*.html`
- Generate `public/js/data.js`
- Copy public static assets
- Filter private content and private assets

### Current data model

The `Note` struct in the publish script is the core of the current read model:

- `path`
- `rel_path`
- `id`
- `title`
- `date`
- `tags`
- `aliases`
- `summary`
- `search_text`
- `refs`
- `backlinks`
- `private`

The site frontend consumes derived `SITE_DATA`, not raw Markdown.

## Site Frontend Data

`public/js/data.js` is currently a single-file constant:

- `meta.generatedAt`
- `meta.noteCount`
- `meta.tagCount`
- `notes[]`

Each note includes at minimum:

- Identity: `key` / `id`
- Display: `title` / `link` / `date`
- Grouping: `groupKey` / `groupLabel` / `section`
- Search: `summary` / `searchText`
- Graph: `refs` / `backlinks`
- Visibility: `hidden` / `private`

The frontend is a static site + precomputed data model; it has no server-side queries.

## AI Maintenance Layer

### Key files

- `agent/project-overview.md`: compact project summary
- `agent/growth-log.md`: change narrative
- `agent/index/*`: derived indexes
- `agent/wiki/*`: condensed wiki
- `agent/skill/maintain.py`: index generator
- `agent/develop.md`: maintenance development gate

### Design intent

This layer is maintenance infrastructure, not a product feature:

- Helps AI quickly locate relevant documents
- Reduces context overhead when reading a large repository
- Enforces "verify against original Markdown" as the canonical fact-checking workflow

## Build and Test Entry Points

Repo root:

- `make publish`
- `make maintain`
- `make build`

`Aaronnote/`:

- `npm test`
- `npm run start:vite`
- `npm run build`
- `npm run build:aaronnote`
- `npm run build:desktop`

## Reading the Code

When changing Aaronnote:

1. Read `Aaronnote/CLAUDE.md` first
2. Then the relevant syntax implementation under `src/cm6/`
3. Then the corresponding `specs/` and `tests/`

When changing the publish or data layer:

1. Read `bin/publish-site` first
2. Then the output structure in `public/js/data.js`
3. Then the consumer logic in `js/knowledge.js` / `public/js/app.js`
