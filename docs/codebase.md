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
- `Aaronnote/src/cm6/`: CM6 extensions, widgets, commands
- `Aaronnote/src/cm6/widgets/`: per-feature widget files (math, fenced-code, image, task, block-extras, inline-commands, Lean placeholders)
- `Aaronnote/src/styles/`: editor and theme CSS
- `Aaronnote/specs/`: behavior specs and event scripts
- `Aaronnote/tests/`: Vitest tests
- `Aaronnote/tests/cm6/`: CM6-specific tests (roundtrip, commands)
- `Aaronnote/website/`: web harness / demo
- `Aaronnote/aaronnote/`: application shell and extra UI
- `Aaronnote/server/lib/`: service library — filesystem, index, save, Roam git, plugins, copilot, roamlookup
- `Aaronnote/desktop/`: Electron entry points (`main.mjs`, `preload.cjs`)
- `Aaronnote/snippets/`: Emacs-style snippet files for Aaronnote's snippet system
- `plugin/`: local Aaronnote plugins; Vite loads entries via `plugin/*/plugin.json` and `index.ts`

### Core modules

- `src/lib.ts`: public API entry point
- `src/editor-api.ts`: `createEditor()` facade and public controller types
- `src/cm6/editor-cm6.ts`: CM6 `EditorView` assembly, keymap, and public API implementation
- `src/cm6/live-preview.ts`: inline/line live-preview decorations, editable table widget
- `src/cm6/commands.ts`: editing commands (bold/italic/heading/list/etc.), block context, quick insert
- `src/cm6/widgets/math.ts`: display and inline math widgets (temml)
- `src/cm6/widgets/fenced-code.ts`: syntax-highlighted code and Mermaid/mindmap diagram widgets
- `src/cm6/widgets/image.ts`: image preview widget with layout attrs
- `src/cm6/widgets/task-list.ts`: interactive task checkbox widget
- `src/cm6/widgets/block-extras.ts`: org-env blocks, `[toc]`, horizontal rules
- `src/cm6/widgets/inline-commands.ts`: `@@cmd` inline command badge widgets
- `src/cm6/widgets/lean-placeholder.ts`: whole-line `@@lean4 [tag]` embedded Lean editor, Lean LSP region mapping, Lean-local Vim/jump handling, and Copilot auxiliary editor registration
- `src/lean-splice.ts`: maps between Markdown placeholder offsets, derived `.lean` file offsets, and Lean LSP line/character positions
- `src/cm6/math-ranges.ts`: display-math range index (StateField) used to suppress other decorations inside `$$`
- `src/cm6/toc-index.ts`: heading/anchor index StateField for the floating TOC panel
- `src/cm6/find-highlight.ts`: find/replace match highlight extension
- `src/cm6/roam-link-status.ts`: marks broken Roam links based on the resolved note index
- `src/attrs-syntax.ts`: shared `{key: value}` trailing-attribute block parser
- `src/layout-attrs.ts`: layout-attribute normalization (align, wrap, width, height) and CSS helpers
- `src/image-attrs.ts`: image-specific layout attr reader/applicator
- `src/render-html.ts`: Markdown → HTML export/publish renderer (markdown-it based)
- `src/export-html.ts`: DOM-to-clean-HTML export (DOMPurify-based, used for clipboard and PDF)
- `src/command-syntax.ts`: `@@cmd` and `#+begin kind` block command parser
- `src/clipboard.ts`: HTML→Markdown paste conversion (turndown)
- `src/math-render.ts`: math rendering via temml
- `src/code-highlight.ts`: syntax highlighting for the publish/export renderer
- `src/code-highlight-async.ts`: async code highlighting bridge
- `src/code-highlight-worker.ts`: Web Worker entry for long-block syntax highlighting
- `src/url-safety.ts`: link href safety check (allows roam://, file://, relative, etc.)
- `src/paste-html.ts`: HTML-to-Markdown paste path helpers
- `src/diagram-render.ts`: Mermaid render helper
- `src/inline-math.ts`: inline math scanner for the renderer
- `src/date-syntax.ts`: date value parsing utilities
- `src/equation-tags.ts`: equation tag management

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

### Service library (`Aaronnote/server/lib/`)

Domain-specific modules imported directly by the Electron main process. No HTTP server.

| Module | Purpose |
| --- | --- |
| `state.mjs` | Shared mutable state: `noteRoot`, `workspaceRoot`, `pluginRoot`, `noteCache`. `configure()` initializes from the main process. |
| `save.mjs` | `saveNote(body)` — atomic write with mtime conflict detection. |
| `index.mjs` | Notes scan, graph, tags, todos, snippets, templates, refs, Roam DB sync, git ops, tag rename/delete tools. |
| `assets.mjs` | Paste asset storage (base64 upload), native-path copy, orphan scan/trash. |
| `fs-ops.mjs` | `createNode`, `createFolder`, rename, move, duplicate, trash/delete. |
| `session.mjs` | Recent notes and cursor position read/write. |
| `meta.mjs` | Note metadata add/remove/tag operations. |
| `media.mjs` | Resolve media file paths and content types for `aaronnote-asset://media`. |
| `plugins.mjs` | Scan plugin descriptors, read/write overrides. |
| `copilot.mjs` | GitHub Copilot LSP client lifecycle and inline completion. |
| `lean.mjs` | Lean request dispatcher: LSP lifecycle, goals/hover/completion, Infoview RPC, diagnostics, and cache commands. |
| `lean-mirror.mjs` | Derives mirror `.lean` paths from Markdown notes and manages mirror-file conventions. |
| `lean-region.mjs` | Pure tagged-region helpers for `-- @aaronnote <tag>` parsing, update, delete, and offset mapping. |
| `lsp-base.mjs` | Shared JSON-RPC/LSP process plumbing used by Lean and other LSP-style services. |
| `roamlookup.mjs` | Codex lookup session lifecycle (start, query, close, idle-close). |
| `roam-git.mjs` | Git operations on the roam repo: `headSha`, `changedRoamFilesSince`, `commitRoam`, `fileHistory`, `restoreFileFromCommit`. |
| `runtime.mjs` | Backing implementation (~4,200 lines). Import domain modules above instead. |

### App shell modules (`Aaronnote/aaronnote/`)

| Module | Purpose |
| --- | --- |
| `main.ts` | Desktop app shell: notes workspace, command palette, ranger tabs, jump stack, panel orchestration, save/cursor state, and plugin boot. |
| `filesystem.ts` | Filesystem and Recent ranger rendering, keyboard navigation, preview/actions, create/rename/move/trash flows. |
| `lean-panel.ts` | Left Lean drawer: Infoview/messages, bottom-pinned outline, restart/stop/cache controls, diagnostics/outline jumps. |
| `lean-infoview-host.ts` | Host adapter for the official Lean Infoview React component inside the app panel. |
| `api-client.ts` | Typed renderer-side IPC facade over `window.aaronnoteApi`. |

### Desktop shell (`Aaronnote/desktop/`)

| File | Purpose |
| --- | --- |
| `main.mjs` | Electron main entry: window creation, IPC handlers, `aaronnote-asset://` protocol, menus, lifecycle. |
| `preload.cjs` | `contextBridge.exposeInMainWorld("aaronnoteApi", {...})` — typed IPC bridge visible to the renderer. Also exposes `AaronnoteDesktop` for file pickers, PDF export, and open-file events. |

### Local plugins

The plugin runtime is started by `Aaronnote/aaronnote/main.ts` after scanning plugins through the native API bridge. Plugins should contain UI and behavior in `plugin/<id>/index.ts` and declare autoload, actions, and settings in `plugin.json`.

Current plugins:

- `plugin/copilot`: GitHub Copilot inline completion
- `plugin/roamlookup`: Roam lookup tab in the Notes page; calls the server-side Codex lookup session to query the `roam/` knowledge base

Plugins doing ordinary text input should use `editor.insertText()`; use `replaceMarkdownRange()` only when genuinely rewriting by Markdown source offset.

The Copilot plugin also supports auxiliary editors through
`aaronnote:copilot-register-editor` / `aaronnote:copilot-dispose-editor`.
Embedded Lean editors use that path so they share the same Copilot client and
request throttling as the main Markdown editor.

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
