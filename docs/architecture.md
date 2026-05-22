# Architecture Guide

## Tech Stack

### Editor core

> The current editor core is CodeMirror 6. For migration history, see [pm-to-cm-plan.md](pm-to-cm-plan.md).

- `TypeScript`
- `CodeMirror 6` (current default core)
  - `@codemirror/state` / `view` / `language` / `commands`
  - `@codemirror/lang-markdown` + `@lezer/markdown`
- `markdown-it`: Markdown parsing
- `turndown` + `turndown-plugin-gfm`: HTML → Markdown conversion helper
- `temml`: Math formula rendering
- `mermaid`: Diagram preview
- `DOMPurify`: Mermaid SVG sanitization

### Application and build

- `Vite` / `vite-plus`
- `Vitest`-style test runner (via `vite-plus-test`)
- `happy-dom`: headless DOM test environment
- `Electron` + `electron-builder`: desktop packaging
- `Node.js`: local service implementation, publish rendering, build scripts

### Data and publish

- `Python`: `bin/publish-site`
- File system as primary storage
- `public/js/data.js` as the static read model

## Composition

The repository is not a monolithic app; it is several composed layers:

1. `Aaronnote/src/`: editor core
2. `Aaronnote/aaronnote/`, `server/`, `desktop/`: application shells
3. `bin/publish-site`: offline publisher
4. `public/js/*.js`: static site consumer layer
5. `agent/*`: AI retrieval and maintenance layer

Key composition relationships:

- `Aaronnote` is both an interactive editor and the rendering core for the publish pipeline.
- `roam/**/*.md` is the source of truth.
- The publish script does not implement its own Markdown renderer; it calls `Aaronnote/scripts/render-html.mjs`.
- The site frontend does not read raw Markdown; it reads pre-generated `SITE_DATA`.
- `agent/` does not participate in the product runtime; it is a maintenance aid only.

## Aaronnote Plugin Layer

Local plugins live under `plugin/<id>/`. The desktop native API scans `plugin.json`
through `server/lib/plugins.mjs`; `Aaronnote/aaronnote/main.ts` loads entry
points via Vite `import.meta.glob("../../plugin/*/*.ts")`. Autoload plugins
start with the editor; non-autoload plugins can be activated through the plugin
manager.

`plugin/roamlookup` is an interactive knowledge-base query plugin. It attaches a
`Roam lookup` tab to the Notes page. The frontend handles the session UI, idle
timer, and close button; actual Codex calls go through the Electron native bridge
to the local roamlookup service. The service inherits the current process
environment when launching `codex exec`, reuses the same Codex login token, and
enforces `--sandbox read-only`. Sessions close after one minute of inactivity or
on an explicit close request; in-flight child processes are terminated.

## Aaronnote Core Composition

### Module assembly order

1. `editor-api.ts` exposes a stable facade
2. `src/cm6/editor-cm6.ts` creates the `EditorView`, compartments, keymap, and event handlers
3. `@codemirror/lang-markdown` / Lezer provides the Markdown syntax tree
4. `src/cm6/live-preview.ts` generates inline/line decorations from source and selection
5. `src/cm6/widgets/*.ts` renders math, code fence, image, task, TOC, org-env, and other block/inline widgets
6. `src/cm6/commands.ts` implements public editing commands, block context, and quick insert

The public exports are in `src/lib.ts`; the consumer-facing controller is in `editor-api.ts`.

### Feature assembly

Each editing/preview capability is split into a CM6 extension or widget file rather than living in one large file. A feature typically contributes:

- Lezer tree scan or Markdown source-range scan
- `Decoration` / `WidgetType`
- Command or click-to-source mapping
- Tests against the public API

## State Model

### Authoritative state

The runtime authority is the CM6 `EditorState`:

- Markdown source document
- Selection
- Compartments/extensions
- History
- Decorations/widgets

The Markdown string is not the runtime authority. It only appears at these boundaries:

1. Initial load
2. Export / save
3. Source mode toggle
4. Publish rendering

### Live preview

The CM6 document holds Markdown source text. Visual forms for emphasis, strikethrough, links, inline math, code blocks, tables, etc. are derived as decorations or widgets from the syntax tree / source scan. Source is the only persistent representation; the preview layer is a view over source.

## Transactions and State Machine Runtime

### Text insertion API convention

For "insert text at the current cursor" operations — plugins, snippets, completions, quick insert — prefer `editor.insertText(text, deleteBefore?)`. This goes through a CM6 transaction and preserves selection, history, and live-preview/widget state.

Do not implement ordinary input/completion as `replaceMarkdownRange()`. `replaceMarkdownRange()` takes a Markdown-source offset and rebuilds the entire Markdown in render mode; it is appropriate only when you have an explicit source coordinate and genuinely need to rewrite Markdown. Completion services that return a "replace current prefix" range should trim the already-present prefix and pass the remainder to `editor.insertText()`.

### Single-edit transaction

A typical keystroke flows like this:

1. User types a character or presses a key
2. CM6 generates a transaction
3. Keymap / command / extension handles it
4. Lezer syntax tree and viewport decorations update
5. Widget/source-range mappings refresh
6. `EditorView` re-renders

The key point: inline semantics are not "locked in at keydown time" — they are "normalized after the transaction."

### Normalize state machine

`normalize.ts` maintains a small derived state machine:

- `state.init`: compute the initial plan from the document
- `state.apply`: recompute the plan on doc changes; reuse the old plan on pure selection changes
- `appendTransaction`: apply mark alignment from the plan

The plan stores:

- Inline parse results for each text block
- Delimiter ranges
- Extra decorations
- Widget decorations

So normalize is both:

1. An inline-semantics normalizer
2. A producer of decoration data

### Inline parser state machine

`inline-parse.ts` is not a full parser generator — it is a lightweight orchestrator:

- All inline features run in priority order
- They share a single `consumed bitmap`
- A feature that claims characters first blocks later features from recognizing the same range

This mechanism resolves "multiple inline syntaxes competing for the same text."

Think of it as a finite-state scanner combinator:

- Input: text + parent block context
- Intermediate state: `consumed`
- Output: `InlineSpan[]`

### Command syntax

`Aaronnote/src/command-syntax.ts` holds the unified custom command syntax parser:

- Inline command: `@@cmd(switch) [context]{arg: value}`
- Block command: `#+begin kind title ... #+end kind`

Convention: only one canonical form is maintained. Inline commands must have a space before `[`; `{}` arguments use `key: value`. TODOs use:

```md
@@todo(doing) [write parser docs]{ddl: 2026-05-20}
```

`@@todo [plain task]` without a switch defaults to `todo`. Agenda reads the same inline command semantics; `ddl` comes from `{ddl: ...}`. The server exports the same scanner entrypoint for indexing and API use. `org-env` begin/end blocks reuse the block command parser. New plugins that need custom inline/block syntax should reuse these parsers rather than writing ad-hoc regexes.



## Extension Order

The extension order in `src/cm6/editor-cm6.ts` matters:

1. Markdown language support
2. History / default keymap
3. App command keymap
4. Live-preview line/inline decorations
5. Math/code/image/task/org-env/TOC widgets
6. Source/preview compartment

This ordering expresses two constraints:

- Commands and keymaps must express the source transaction clearly first.
- The visual layer must be derived from the final source + selection.

Without this order, Typora-style block-exit logic for Enter / Backspace would be stolen by base CM6 behavior.

## CM6 Widgets and the Visual Layer

The visual layer is not plain Markdown text rendering:

- Inline syntax hints go through decorations
- Math blocks go through CM6 widgets
- Org-env blocks go through CM6 widgets
- Code fence diagram preview carries custom preview logic

The display is a three-layer composition:

1. Markdown source text
2. Lezer syntax tree / decorations
3. CM6 widget UI

When debugging, identify which layer the issue is in before changing anything.

## Publish Pipeline State Machine

`bin/publish-site` is an offline export state machine:

1. Scan `roam/**/*.md`
2. Read metadata
3. Build `Note` objects
4. Parse refs / backlinks
5. Mark private / hidden
6. Decide whether rendering can be skipped
7. Call the Aaronnote renderer to produce HTML
8. Generate `SITE_DATA`
9. Copy static assets
10. Write `.publish-state.json`

Two caching / incremental layers:

- Note-level: `.deps/*.json`
- Whole-publish level: `.publish-state.json`

Publish is not a full rebuild every time; it has an incremental skip strategy.

## Maintenance Decision Guide

### Changing Aaronnote behavior

Identify the layer first:

1. Markdown source / HTML renderer
2. Lezer tree scan / source-range scan
3. Decorations / widgets
4. Keymap / command / transaction flow

### Changing the publish pipeline

Identify what the change affects:

1. Source metadata parsing
2. Note graph
3. Privacy sealing
4. Static data contract
5. Incremental build

### Changing a "state machine"

The state machines here are not a single reducer; they are several composed segments:

- CM6 transaction lifecycle
- Lezer/decorations derived state
- Widget active/rendered UI state
- Publish script incremental export state

Clarify which segment you are changing — do not say "editor state" without being specific.
