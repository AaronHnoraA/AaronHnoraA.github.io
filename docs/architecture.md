# Architecture Guide

## Tech Stack

### Editor core

- `TypeScript`
- `CodeMirror 6` — the sole runtime editor core since 2026-05-19
  - `@codemirror/state` / `view` / `language` / `commands`
  - `@codemirror/lang-markdown` + `@lezer/markdown` (GFM-capable `markdownLanguage`)
- `markdown-it` — Markdown-to-HTML for the publish renderer and table-cell inline preview
- `turndown` + `turndown-plugin-gfm` — HTML→Markdown on clipboard paste
- `temml` — Math formula rendering (KaTeX-compatible, server-side capable)
- `mermaid` — Diagram/mindmap preview inside fenced-code widgets
- `DOMPurify` — SVG sanitization for Mermaid output and raw `#+begin html` blocks

### Application and build

- `Vite` / `vite-plus` — bundler and dev server
- `Vitest`-style test runner via `vite-plus-test`
- `happy-dom` — headless DOM in tests
- `Electron` + `electron-builder` — desktop packaging
- `Node.js` — server lib, build scripts, publish rendering

### Data and publish

- `Python` — `bin/publish-site`
- File system as primary storage (`roam/**/*.md`)
- `public/js/data.js` as the static site read model

---

## Repository Composition

The repository is several composed layers, not a monolithic app:

| Layer | Location | Role |
| --- | --- | --- |
| Editor kernel | `Aaronnote/src/` | CM6 editor + HTML renderer |
| App shell | `Aaronnote/aaronnote/` | Notes UI, navigation, agenda, plugins |
| Service library | `Aaronnote/server/lib/` | Filesystem, index, save, git ops |
| Desktop shell | `Aaronnote/desktop/` | Electron main, IPC, custom protocol |
| Publish pipeline | `bin/publish-site` | Offline Markdown → static site |
| Static site | `public/` | Generated output only |
| AI maintenance | `agent/` | Retrieval indexes, not product runtime |

Key cross-layer rules:
- `Aaronnote/src/render-html.ts` is the single Markdown→HTML renderer used by both the editor and the publish pipeline.
- `roam/**/*.md` is the canonical data store; `public/`, `agent/index/`, `agent/wiki/` are derived.
- `desktop/` imports `server/lib/*` directly — no HTTP server runs in production.

---

## CM6 Editor — Detailed Architecture

### Extension assembly order

`buildExtensions()` in `src/cm6/editor-cm6.ts` constructs extensions in this order:

```
1.  EditorState.allowMultipleSelections
2.  EditorView.clickAddsSelectionRange   (Alt/Meta+click)
3.  history()
4.  closeBrackets()
5.  EditorView.inputHandler              (wrapSelectedMarkdownInput)
6.  rectangularSelection()
7.  keymap: [Enter, Mod-Enter, Tab, Shift-Tab, Mod-d, Mod-Shift-z, defaultKeymap, historyKeymap]
8.  markdown({ base: markdownLanguage }) — Lezer GFM parser
9.  highlightActiveLine()
10. tocIndexExtension                    — StateField: heading/anchor index
11. previewCompartment.of(previewExtensions())
12. findHighlightExtension               — highlights find matches
13. roamLinkStatusExtension              — marks broken Roam links
14. EditorView.lineWrapping
15. EditorView.updateListener            — calls onChange
16. EditorView.domEventHandlers          — mousedown, auxclick, contextmenu, focus, blur, paste
```

`previewExtensions()` inside `previewCompartment` (removed when in source mode):

```
blockMathRangesExtension   — StateField: display-math block ranges
livePreviewExtension       — ViewPlugin + 3 StateFields (tables, line decos, table decos)
blockExtrasExtension       — StateField: [toc], HR, org-env blocks
mathExtension              — StateField: math widget decorations
fencedCodeExtension        — StateField: fenced-code/diagram widget decorations
taskListExtension          — StateField: task checkbox widgets
imageExtension             — ViewPlugin: image widgets (layout-aware)
inlineCommandsExtension    — StateField: @@cmd inline command widgets
```

Toggling source mode reconfigures `previewCompartment` with `[]` (empty) — the Lezer tree and history remain intact.

### Source-range data protocol

Every CM6 widget that replaces Markdown source sets dataset attributes on its root DOM element:

```
data-cm-source-from  — absolute CM6 document offset (start of replaced range)
data-cm-source-to    — absolute CM6 document offset (end of replaced range)
data-cm-open-source  — "true" if a plain click should open source editing
data-cm-math-block   — "true" if this is a block-math widget (click anchor calculated differently)
```

`onSourceWidgetMouseDown` in `editor-cm6.ts` captures all `mousedown` events on the content DOM, finds the closest element with these attributes, and dispatches a selection transaction to enter source editing. This is the universal "click widget to edit" mechanism — no per-widget click handler is needed.

### StateField vs ViewPlugin

| Pattern | When to use | Examples |
| --- | --- | --- |
| `StateField` | Derived data that depends only on doc changes, not selection or viewport. Can provide decorations via `provide`. | `markdownTablesField`, `blockMathRangesField`, `tocIndexExtension`, `lineDecoField`, `tableDecoField`, `blockExtrasExtension`, `mathExtension`, `fencedCodeExtension`, `taskListExtension` |
| `ViewPlugin` | Decorations that depend on selection position or visible viewport range. | `livePreviewPlugin` (inline marks, wikilinks), `imageExtension` |

`Decoration.line()` can only come from a `StateField` (not a `ViewPlugin`), because line decorations must be sorted together with other line decorations. This is why `lineDecoField` is a `StateField` even though its result depends on the syntax tree.

### Locality patching (performance)

Each StateField uses one of three update strategies for doc changes:

1. **Map** — positions shift but no rescan needed. Used when no structurally-significant characters changed.
2. **Patch** — rescan a narrow line window near the change and replace only affected decorations. Used for single-line edits.
3. **Full rebuild** — rescan the entire document. Used when boundaries may have shifted far.

Decision predicates per field:

| Field | Map condition | Patch condition | Full rebuild |
| --- | --- | --- | --- |
| `markdownTablesField` | No `|` in changed text, no change overlaps a table | — | Otherwise |
| `tableDecoField` | Same as tables field | Rescan affected line window | Otherwise |
| `lineDecoField` | No `\n #>|`~ ` in changed text | Single-line edit (no `\n`) | Otherwise |
| `mathBlockField` | Pure selection change | Edit inside existing `$$` block | Fence/lang edit |
| `mermaidField` | Pure selection change | Edit inside existing fence body | Fence/lang/structural edit |
| `blockExtrasField` | No `[`, `]`, `-`, `*`, `_` in changed text, no front-matter | Single-line near block-extra lines | Front matter or multiline |
| `orgEnvBlocksField` | Mapping only when org structure unchanged | Title-only edit on `#+begin` line | `#+begin`/`#+end`/kind edit |
| `lineDecoField` | No `\n #>|`~ ` | Single-line (no `\n`) | Otherwise |

### Live preview internals (`src/cm6/live-preview.ts`)

The `LivePreviewPlugin` (ViewPlugin) collects tokens across the visible range on every update that changes the doc, viewport, or selection. Tokens describe what needs decorating — not the decorations themselves — so the render pass can skip decorations for ranges where the cursor is "inside".

Token types:

| Kind | When collected | Decoration produced |
| --- | --- | --- |
| `span` | Bold/italic/code/strike parent nodes | CSS class mark when cursor outside |
| `delimiter` | `EmphasisMark`, `CodeMark`, `StrikethroughMark` | `syntax-hidden` outside, `syntax-hint` inside |
| `link-delimiter` | `LinkMark`, `URL` | Hidden with `cm-link-text` on span when outside; hint when inside |
| `block-mark` | `HeaderMark`, `QuoteMark` | `syntax-hint` on same line; `syntax-hidden` on other lines |
| `autolink` | `Autolink` | Hide `<` `>` brackets when cursor outside |
| `wikilink` | `[[...]]` regex scan | Hide `[[` `]]`, add `cm-roam-link-text` to inner content |
| `static` | `ListMark`, `CommentBlock`, `Escape` | Fixed class regardless of cursor position |

`buildDecorations()` iterates the collected tokens and applies cursor-based logic to choose `syntax-hidden` vs `syntax-hint` vs nothing.

CJK text gets a `cm-cjk-text` class so CSS can apply CJK-specific font and kerning. CJK range detection is cached per visible-range key to avoid rescanning unchanged text.

### Table widget internals

The editable table widget (`TableWidget` in `live-preview.ts`) manages both display and editing:

- **Parse**: `parseMarkdownTable(source)` splits the source into `{ rows, aligns }`.
- **Render**: `renderEditableTable()` creates a `<table>` with cells that start in preview mode (rendered as inline HTML via `inlineMarkdownHTML()`).
- **Edit mode**: Clicking a cell calls `enterEditing()` which replaces the cell's innerHTML with an `<input>`. On blur or Enter/Tab, the input's value is merged back via `tableRowsFromDOM()` and a source transaction is dispatched.
- **Commit cycle**: `commit()` diffs the new DOM-derived source against the original; only dispatches a transaction when it changed. `scheduleCommit()` defers by one tick when the focus is moving inside the table.
- **Toolbar**: Row/column insert/delete and L/C/R align are toolbar buttons that mutate `MarkdownTableData` and dispatch transactions.
- **Focus tracking**: After any source-replacing transaction, `focusTableCellAfterRender()` waits one animation frame and re-focuses the target cell in the newly-rendered widget.
- **Layout**: If a trailing `{...}` attrs line follows the table, the widget extends its replaced range to include it and applies `applyLayoutAttrs(wrap, "table", layout)`.

### Image widget internals

`ImageWidget` in `src/cm6/widgets/image.ts`:

- Uses a `ViewPlugin` because cursor position affects which images show as widgets (cursor inside → show source).
- Reads trailing layout attrs from the end of the image `]( ... )` to the end of the line via `readImageTrailingAttrs()`. If attrs are found, the replaced range extends to include them.
- `applyImageLayout(wrap, layout)` sets `aaronnote-image-*` CSS classes and `--aaronnote-image-*` custom properties on the `<figure>`.
- `eq()` checks `src`, `alt`, `from`, `to`, and all four layout fields — changes to attrs force widget replacement.
- Click events on the figure propagate to `onSourceWidgetMouseDown` via `data-cm-source-from/to`.

### Keyboard input

Notable key bindings registered in `buildExtensions()`:

| Key | Handler | Effect |
| --- | --- | --- |
| `Enter` | `exitEmptyMarkdownBlock` | Clear empty list item or blockquote prefix |
| `Mod-Enter` | `exitCurrentOrgEnv` | Jump to position after the current `#+end kind` |
| `Tab` | `indentMarkdownList` then `indentWithTab` | Indent list item, or insert tab if not in list |
| `Shift-Tab` | `indentMarkdownList(-1)` | Dedent list item |
| `Mod-d` | `selectNextMarkdownOccurrence` | Add next occurrence to multi-selection (like VS Code Cmd+D) |
| Any paired char while selection exists | `wrapSelectedMarkdownInput` | Wrap selected text with `()` `[]` `{}` `**` `__` etc. |

`selectNextMarkdownOccurrence`: selects the current word if nothing is selected, then finds and adds the next occurrence. Wraps around the document. Works with multi-selection (`EditorState.allowMultipleSelections`).

### Link navigation

`markdownHrefAt(state, pos)` resolves the href at a position by:

1. Checking for a `[[wikilink]]` via regex on the line (returns `roam://encoded_title`).
2. Walking the Lezer tree upward from `pos` looking for `Link`, `Autolink`, or `Image` nodes.
3. Extracting the `URL` child of the found node.

`openMarkdownLinkFromEvent` fires on `mousedown` (button 0) and `auxclick` (button 1) when `primaryLinkModifier` is held (Cmd on Mac, Ctrl on Windows/Linux). It dispatches `aaronnote:open-url` as a bubbling `CustomEvent`, which the app shell catches to handle navigation.

Middle-click (`button === 1`) with the modifier opens in a new window (`newWindow: true`).

---

## Server Library — Module Map

All service logic lives in `Aaronnote/server/lib/`. The desktop main process imports these directly via `ipcMain.handle` handlers. No HTTP server runs in production.

| Module | Key exports |
| --- | --- |
| `state.mjs` | `configure({ root, workspaceRoot, pluginRoot })`, `markNotesDirty()` — shared mutable state singleton |
| `save.mjs` | `saveNote(body)` — atomic write with mtime conflict detection |
| `index.mjs` | `bootstrapNote`, `readNote`, `notesIndexPayload`, `scanNotes`, `graphPayload`, `tagIndexPayload`, `pathSuggestionsForFile`, `syncRoamDb`, `queueRoamDbSync`, `getTodos`, `scanSnippets`, `scanTemplates`, `extractTodos`, `refsFromContent`, `tagsFromContent`, `scanInlineCommands`, `parseCommandArgs`, etc. |
| `assets.mjs` | `storeAsset` (base64 upload), `storeAssetFromPath` (native copy), `scanUnusedAssets`, `trashUnusedAssets` |
| `fs-ops.mjs` | `createNode`, `createFolder`, `renameManagedPath`, `moveManagedPath`, `duplicateManagedFile`, `trashManagedPath`, `deleteNote` |
| `session.mjs` | `readRecentNotes`, `touchRecentNote`, `readCursorPositions`, `touchCursorPosition` |
| `meta.mjs` | `updateCurrentNoteMeta` — add/remove metadata keys, tag operations |
| `media.mjs` | `resolveMediaFile(file, base)`, `fileContentType(path)` — used by `aaronnote-asset://media` protocol handler |
| `plugins.mjs` | `scanPluginDescriptors()`, `readPluginOverrides()`, `writePluginOverrides()` |
| `copilot.mjs` | `handleCopilotRequest(action, body)` — LSP client lifecycle and inline completions |
| `roamlookup.mjs` | `handleRoamLookupRequest(action, body)` — Codex session lifecycle |
| `roam-git.mjs` | `headSha()`, `changedRoamFilesSince(commit)`, `commitRoam(message)`, `fileHistory(file, limit)`, `restoreFileFromCommit(file, sha)` |
| `runtime.mjs` | Implementation backing all exports above. ~4,200 lines. Do not import this directly from new code — use the domain-specific module instead. |

The `state.mjs` singleton holds:
- `noteRoot` — resolved absolute path to `roam/`
- `workspaceRoot` — workspace root (parent of `roam/`, `kinds/`, `plugin/`)
- `pluginRoot` — `plugin/` directory
- `noteCache` — in-memory note metadata cache, keyed by absolute file path
- Dirty tracking flags for save-triggered index invalidation

`saveNote` contract:
- Takes `{ file, content, mode, clientId, seq, baseMtimeMs, refresh, force }`.
- Compares `baseMtimeMs` against current file mtime. Returns `{ ok: false, conflict: true }` if mismatched and `force` is false.
- Writes atomically (temp file + rename).
- Updates `noteCache` for the saved note when `refresh: "deferred"` so the next `scanNotes` doesn't re-read the file.

---

## Desktop Shell — IPC and Protocol Bridge

### Topology

```
Renderer process                Preload (CJS)              Main process
─────────────────               ─────────────              ─────────────────────
aaronnote/api-client.ts
  window.aaronnoteApi.notes.save(body)
  ──────────────────────────────────►  ipcRenderer.invoke("aaronnote:api:notes:save", body)
                                       ───────────────────────────────────────────────────►
                                                                           ipcMain.handle("aaronnote:api:notes:save", ...)
                                                                             → save.saveNote(body)
                                                                             → returns result
                                       ◄───────────────────────────────────────────────────
  ◄──────────────────────────────────
```

`contextBridge.exposeInMainWorld("aaronnoteApi", {...})` in `desktop/preload.cjs` creates the typed bridge. The renderer cannot directly access Node.js APIs.

### IPC channel naming

All API channels follow `aaronnote:api:<domain>:<action>`:

```
aaronnote:api:notes:bootstrap
aaronnote:api:notes:open
aaronnote:api:notes:list
aaronnote:api:notes:save
aaronnote:api:notes:create-node
aaronnote:api:notes:delete
aaronnote:api:notes:create-folder
aaronnote:api:notes:path-suggestions
aaronnote:api:notes:roam-sync
aaronnote:api:notes:roam-sync-full
aaronnote:api:notes:templates
aaronnote:api:notes:snippets
aaronnote:api:notes:todos
aaronnote:api:notes:meta-add
aaronnote:api:roam-tools:rename-tag
aaronnote:api:roam-tools:delete-tag
aaronnote:api:roam-tools:tag-overlap
aaronnote:api:roam-tools:rewrite-path-refs
aaronnote:api:roam-tools:file-history
aaronnote:api:roam-tools:restore-file-version
aaronnote:api:roam-tools:repo-status
aaronnote:api:roam-tools:repo-history
aaronnote:api:roam-tools:changes
aaronnote:api:roam-tools:diff
aaronnote:api:roam-tools:commit-diff
aaronnote:api:roam-tools:pull
aaronnote:api:roam-tools:push
aaronnote:api:roam-tools:commit
aaronnote:api:assets:upload
aaronnote:api:assets:store-from-path
aaronnote:api:assets:scan-orphans
aaronnote:api:assets:trash-orphans
aaronnote:api:session:recent
aaronnote:api:session:touch-recent
aaronnote:api:session:positions
aaronnote:api:session:save-position
aaronnote:api:plugins:list
aaronnote:api:plugins:overrides
aaronnote:api:plugins:set-overrides
aaronnote:api:fs:rename
aaronnote:api:fs:move
aaronnote:api:fs:duplicate
aaronnote:api:fs:trash
aaronnote:api:meta:add
aaronnote:api:meta:remove
aaronnote:api:meta:tag
aaronnote:api:copilot:*
aaronnote:api:roamlookup:*
aaronnote:api:shell:show-in-folder
aaronnote:api:shell:open-path
```

Non-API channels (one-way or special):

```
aaronnote:renderer-ready    — renderer → main: boot handshake
aaronnote:open-file         — main → renderer: open a file (from menu, argv, second-instance)
aaronnote:choose-note-path  — renderer → main: native file/directory picker
aaronnote:trash-note        — renderer → main: move to trash
aaronnote:export-pdf        — renderer → main: print to PDF
```

### `aaronnote-asset://` custom protocol

Registered in `app.whenReady` as a privileged scheme (secure, supportFetchAPI, bypassCSP, stream). Routes by host:

| Host | URL form | Resolved to |
| --- | --- | --- |
| `media` | `aaronnote-asset://media/?file=...&base=...` | `media.resolveMediaFile(file, base)` → `net.fetch(pathToFileURL(resolved))` |
| `font` | `aaronnote-asset://font/<filename>` | Liu Gong Quan font candidates list |
| `kinds` | `aaronnote-asset://kinds/<kind>/index.css` etc. | `resolve(workspaceRoot, "kinds", rest)` with inside-boundary check |
| `roam-tools` | `aaronnote-asset://roam-tools/knowledge.js` etc. | `resolve(publishJsDir, name)` |

The `kinds` handler validates the resolved path stays inside `workspaceRoot/kinds/` to prevent path traversal.

### Renderer loading

- **Dev**: `win.loadURL(process.env.AARONNOTE_DEV_VITE_URL)` — points to the Vite dev server.
- **Packaged**: `win.loadFile(path.join(staticDir, "index.html"))` — the Vite build uses `base: "./"` so all asset paths are relative and work under `file://`.

File opening from argv, macOS `open-file`, or second-instance sends `aaronnote:open-file` to the renderer rather than reloading the window. The renderer's `openStandaloneFile()` handles this without a navigation.

### Native asset insertion (Phase 4a)

When the user drags or selects a local file, Electron provides `File.path` (an absolute native path). The renderer sends this via `api.assets.storeFromPath({ path, targetDir })`. The main process calls `fs.copyFile()` directly — skipping the base64-encode → JSON-serialize → decode path entirely.

Clipboard pastes (no native path) fall back to the original ArrayBuffer → base64 upload path.

### Global shortcut (Phase 4b)

`globalShortcut.register("CommandOrControl+Shift+N", quickCapture)` in `app.whenReady` focuses the main window and dispatches `new-markdown-note`. This is an OS-level hook — it works even when the app is not focused.

---

## Command Syntax and Attribute Parsing

### `attrs-syntax.ts` — shared primitive

All `{key: value; ...}` block parsing flows through `src/attrs-syntax.ts`:

- `parseAttrArgs(raw)` — strips `{}`, splits on `;`/`,`, matches `key[:=]value`, lowercases keys, strips quotes from values.
- `readTrailingAttrs(text, from, options)` — locates a `{` at or after `from` (optionally skipping whitespace), finds the matching `}` on the same line via `findSingleLineClose`, parses the content, and optionally requires at least one key from a known-keys list.
- `findSingleLineClose(text, open, closeChar)` — scans forward honoring backslash escapes, returning -1 on newline.

### `command-syntax.ts` — inline and block commands

Built on `attrs-syntax.ts`. Parses:

```
@@name(switch) [context]{key: value; key: value}
```

`scanInlineCommands(text, name?)` — scans a line for all inline commands matching optional name filter. Returns `InlineCommand[]` with `name`, `switchValue`, `context`, and parsed `args`.

Block commands:

```
#+begin kind optional-title
body
#+end kind
```

`scanBlockCommands(text)` — returns `BlockCommand[]`. Kind is lowercased; title is the remainder of the `#+begin` line after the kind.

Convention: space required before `[`; `{` arguments may have optional whitespace before them; separator is `;` or `,`; values may be quoted or unquoted.

### `layout-attrs.ts` — reusable layout normalization

Wraps `attrs-syntax.ts` with layout-specific semantics:

- Recognized keys: `align`, `position`, `pos`, `wrap`, `float`, `width`, `w`, `size`, `height`, `h`.
- `layoutFromAttrs(attrs)` normalizes to `{ align: "left"|"center"|"right", wrap: boolean, width: string, height: string }`.
  - `wrap` side (`float: left`) implies `align`.
  - `wrap: center` is treated as non-wrap.
  - Bare numbers become `px`.
- `layoutClasses(kind, layout)` → e.g. `"aaronnote-image aaronnote-image-align-right aaronnote-image-wrap"`.
- `layoutStyle(kind, layout)` → e.g. `"--aaronnote-image-width: 220px; --aaronnote-image-max-width: none;"`.
- `applyLayoutAttrs(el, kind, layout)` — sets both classes and custom properties on the DOM element. Also sets `data-aaronnote-layout`, `data-aaronnote-layout-align`, `data-aaronnote-layout-wrap`.

`readLayoutTrailingAttrs(text, from)` — convenience wrapper that reads trailing attrs with `allowWhitespace: true` and `knownKeys: LAYOUT_ATTR_KEYS`.

`readLayoutAttrsLine(text)` — reads a standalone attrs line (entire line is `{...}`, no leading non-whitespace before it and nothing after the `}`).

---

## Live Preview: Decoration Strategy

### Inline marks

Cursor-driven hide/show, implemented in the `LivePreviewPlugin` ViewPlugin:

- Delimiter is hidden (`syntax-hidden`: `font-size: 0; width: 0`) when cursor is outside the parent span.
- Delimiter shows as hint (`syntax-hint`: gray, small) when cursor is inside the parent span or on the same line (for block marks).
- The parent span itself gets a CSS class (`cm-strong`, `cm-em`, `cm-inline-code`, `cm-strike`) when the cursor is outside — so the visual style applies even with the delimiters hidden.

### Line classes

Implemented in `lineDecoField` (StateField). Adds CSS classes to `.cm-line` divs:

| Class | Applied to |
| --- | --- |
| `cm-md-h1` … `cm-md-h6` | ATX and Setext heading lines |
| `cm-md-blockquote` | Blockquote lines |
| `cm-md-code-block` | Fenced-code and indented-code block lines |
| `cm-md-table` | Table row lines |
| `cm-md-table-separator` | Table separator lines (`---:`) |

### Wikilinks

Detected by regex (`WIKILINK_RE`) on visible ranges rather than via the Lezer tree (Lezer's Markdown parser does not handle wikilinks). The `[[` and `]]` delimiters are hidden/hinted by cursor position; the inner content gets `cm-link-text cm-roam-link-text`.

### Roam link status

`roamLinkStatusExtension` in `src/cm6/roam-link-status.ts` marks links that resolve to Roam notes vs. links that are broken. Broken Roam links get a visual indicator. This field reads the Roam index from the app shell via a `StateEffect`.

---

## Widget Details

### Math widget (`src/cm6/widgets/math.ts`)

Display math (`$$...$$`): replaced by a `MathWidget` that renders via `temml`. The `mathBlockField` StateField tracks `{ from, to, source, rendered }` tuples. Edits inside an existing `$$` block update only that block's tuple (locality patch); edits to the fence markers trigger a full rebuild.

Inline math (`$...$`): replaced by a smaller inline `InlineMathWidget`.

### Fenced-code widget (`src/cm6/widgets/fenced-code.ts`)

Handles syntax highlighting and diagram rendering:
- Code blocks: syntax-highlighted via `@codemirror/language` and the async worker for long blocks (>12K chars).
- Diagram fences (`mermaid`, `mindmap`, `marmind`, `markmind`): rendered via Mermaid.js.
- Mindmap normalization: `marmind` / `markmind` accept plain indented trees or Markdown-ish lists; `normalizeMermaidSource()` converts them to Mermaid `mindmap` source unless the fence already starts with a Mermaid diagram keyword, and preserves ordered-list markers as labels.
- Interaction: rendered Mermaid diagrams call `enableDiagramInteraction()` after SVG sanitization. The wrapper supports drag panning, ctrl/meta-wheel zoom, double-click reset, node highlighting, and safe SVG link dispatch through `aaronnote:open-url`. `marmind` / `markmind` skip the interaction layer and render as static Aaronnote-themed mindmaps.
- Layout attrs: standalone `{...}` line after the closing fence extends the replaced range and applies `applyLayoutAttrs(wrap, "diagram", layout)`.

### Org-env widget (`src/cm6/widgets/block-extras.ts`)

`#+begin kind [title] ... #+end kind` blocks become `<org-env-block>` custom elements in the editor. The `blockExtrasExtension` StateField scans for these blocks. Title-only edits on `#+begin` lines patch only that boundary decoration.

Special org-env kinds in the editor:
- `meta` — renders as the meta cover (title, date, tags nav). Hidden when kind is not `default`.
- `html` — renders the body as sanitized HTML.
- All others — render as labeled collapsible blocks.

### Task list widget (`src/cm6/widgets/task-list.ts`)

Replaces `- [ ]` / `- [x]` with interactive checkboxes. Clicking a checkbox dispatches a transaction that toggles `[ ]` ↔ `[x]` in the source.

### Inline commands widget (`src/cm6/widgets/inline-commands.ts`)

Handles `@@todo`, `@@done`, etc. inline command spans — adds visual badges and state indicators.

---

## Publish Pipeline

`bin/publish-site` is an offline Python script that orchestrates:

1. Scan `roam/**/*.md` — read metadata, title, tags, dates, aliases.
2. Build `Note` objects — id, key, path, rel_path, refs, backlinks, private flag.
3. Privacy sealing — filter private notes and refs pointing to private notes.
4. Incremental skip check — compare content hash and deps against `.publish-state.json`.
5. Render HTML — call `Aaronnote/scripts/render-html.mjs` (which imports `src/render-html.ts`).
6. Write HTML to `public/roam/**/*.html`.
7. Generate `public/js/data.js` with `SITE_DATA`.
8. Copy static assets.
9. Write updated `.publish-state.json`.

Two caching layers:
- Note-level `.deps/<id>.json` — stores content hash and rendered HTML hash.
- Whole-publish `.publish-state.json` — stores last run hash and note list.

The publish pipeline does not implement its own Markdown parser; it calls the same `renderMarkdownHTML()` / `renderPublishedNoteHTML()` used by the editor.

---

## Extension Order

The extension order in `src/cm6/editor-cm6.ts` matters for two reasons:

1. **Keymap priority**: CM6 tries keymaps in the order they appear. The app keymap (Enter/Tab/Cmd-d) must come before `defaultKeymap` so it can intercept those keys.
2. **Decoration priority**: `StateField.provide(EditorView.decorations)` fields are applied in registration order. `livePreviewExtension` (containing `lineDecoField` and `tableDecoField`) must be inside `previewCompartment`, which comes after `tocIndexExtension` so TOC headings are available.

Without `exitEmptyMarkdownBlock` bound before `defaultKeymap`, pressing Enter in an empty list item would create a new list item instead of exiting the list.

---

## Maintenance Decision Guide

### Adding a new CM6 widget

1. Decide: StateField or ViewPlugin? (See table above.)
2. Implement `WidgetType.toDOM()` setting `data-cm-source-from`, `data-cm-source-to`, `data-cm-open-source`.
3. Implement `WidgetType.eq()` — compare all inputs that affect the rendered DOM.
4. Add `ignoreEvent(): true` unless the widget needs direct CM6 event routing.
5. For locality, implement a `canMap` / `canPatch` / rebuild decision in the StateField `update()`.
6. Add the extension to `previewExtensions()` in `editor-cm6.ts`.
7. Write tests in `tests/cm6/` against the public editor API, not CM6 internals.

### Adding a new IPC action

1. Add the `invoke(...)` call to `desktop/preload.cjs` under the appropriate domain object.
2. Add the corresponding `ipcMain.handle("aaronnote:api:<domain>:<action>", ...)` in `desktop/main.mjs`.
3. Implement the server-side function in the appropriate `server/lib/<domain>.mjs` module.
4. Export it from `server/lib/index.mjs` if it needs to be accessible from tests.
5. Add the typed method to `Aaronnote/aaronnote/api-client.ts`.
6. Add a test in `tests/api-client.test.ts` covering the native-bridge path.

### Changing the editor state model

Clarify which state is being changed:

- **CM6 EditorState** — document text, selection, history, compartments, decorations. Changed only via transactions.
- **Lezer syntax tree** — derived from the document text on every transaction. Read-only.
- **StateField values** — derived from the EditorState on every transaction. Update must be pure.
- **ViewPlugin state** — derived from the EditorView on every update. May depend on DOM/viewport.
- **App shell state** — recent notes, cursor positions, panel visibility. Stored in `aaronnote/main.ts`.
- **Server note cache** — in-memory in `server/lib/state.mjs`. Invalidated by saves and file-system events.
