# Aaronnote API Reference

This is the practical API guide for local development. It covers the editor facade, server endpoints, renderer hooks, plugin commands, and Roam link conventions.

## Editor Facade

Package entry: `Aaronnote/src/lib.ts`.

```ts
import { createEditor } from "typora-web";
import "typora-web/widgets.css";
import "typora-web/theme-typora.css";

const editor = createEditor(host, {
  initialContent: "# Title",
  onChange: (markdown) => {},
  onFocus: () => {},
  onBlur: () => {},
});
```

Stable methods:

| Method | Purpose |
| --- | --- |
| `getMarkdown()` | Return current Markdown source. |
| `getMarkdownAsync()` | Async form for callers that may later move serialization off-thread. |
| `setMarkdown(md)` | Replace the whole document. |
| `getHTML()` | Render current Markdown to HTML. |
| `insertText(text, deleteBefore?)` | Insert text through a CM6 transaction. Preferred for snippets/completions. |
| `replaceMarkdownRange(from, to, text, select?)` | Rewrite an explicit Markdown source range. Use only when offsets are known. |
| `getMarkdownSelection()` | Return current source selection. |
| `setMarkdownSelection(from, to?)` | Set source selection. |
| `runCommand(command, value?)` | Run built-in editor commands such as `bold`, `italic`, `link`, `image`. |
| `getBlockContext()` | Return current block context for quick insert/block menu. |
| `registerQuickInsertProvider(provider)` | Register slash/block insert items. |
| `toggleSource()` | Toggle rendered/source mode. |
| `isSourceMode()` | Return source-mode state. |
| `focus()` / `destroy()` | Lifecycle helpers. |
| `view` | Underlying CM6 `EditorView`; use as an escape hatch only. |

Command/completion code should prefer `insertText()` because it preserves CM6 history and avoids full document replacement.

### EditorCommand Reference

All values of `EditorCommand` accepted by `runCommand(command, value?)`:

| Command | What it does | Notes |
| --- | --- | --- |
| `bold` | Wraps selection with `**`/`**`, or inserts `****` with cursor between markers | — |
| `italic` | Wraps selection with `*`/`*` | — |
| `code` | Wraps selection with `` ` ``/`` ` `` | — |
| `link` | Inserts `[selection](url)` skeleton, selecting the URL placeholder | Prompts with `[text](url)` |
| `blockquote` | Prepends `> ` to the current line; toggles off if already a blockquote | — |
| `bullet-list` | Prepends `- ` to the current line; strips existing list markers first | — |
| `ordered-list` | Prepends `1. ` to the current line | — |
| `task-list` | Prepends `- [ ] ` to the current line | — |
| `code-block` | Inserts a ` ```\n\n``` ` fence, cursor lands on the language tag line | Inserts below current line if non-empty |
| `paragraph-menu` | No-op in CM6 (retained for API compatibility) | — |
| `insert-table` | Inserts a 2×2 GFM table skeleton below the current line | — |
| `insert-math-block` | Inserts a `$$\n\n$$` display math block | — |
| `insert-toc` | Inserts a `[toc]` token on its own line | — |
| `insert-org-env` | Inserts `#+begin <value>\n\n#+end <value>` block; `value` defaults to `note` | Pass `value` to choose the env kind |
| `image-edit` | Inserts `![alt](src)` skeleton, selecting the `alt` placeholder | — |
| `table-insert-row` | Inserts an empty row below the cursor row in a GFM table | Must be inside a table |
| `table-insert-column` | Inserts an empty column to the right of the cursor column | Must be inside a table |
| `table-delete-row` | Deletes the cursor row; refuses to delete header (row 0) or separator (row 1) | Must be inside a table |
| `table-delete-column` | Deletes the cursor column; refuses if only one column remains | Must be inside a table |
| `heading-1` … `heading-6` | Sets the current line to `# ` … `###### ` prefix | Strips existing list/heading prefix first |
| `copy-code` | Copies the body text of the fenced code block at the cursor to the clipboard | Must be inside a `FencedCode` node |

Commands that don't apply at the current cursor position return `false`.

### EditorBlockContext

Returned by `getBlockContext()` and passed as `block` to `QuickInsertContext`:

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Block type at cursor: `paragraph`, `heading`, `code_block`, `table_cell`, `blockquote`, `list_item` |
| `from` / `to` | `number` | Markdown source range of the entire block node |
| `contentFrom` / `contentTo` | `number` | Source range of the content (excludes delimiters: heading markers, list marker, blockquote `>`) |
| `text` | `string` | Block content text (blockquotes have `>` prefixes stripped) |
| `empty` | `boolean` | `true` if `text.trim()` is empty |
| `depth` | `number` | Always `1` in CM6 (reserved for future nesting support) |
| `parentType` | `string \| null` | Always `null` in CM6 (reserved) |
| `sourceMode` | `boolean` | Always `false` in the main editor; `true` if caller is in raw-source mode |
| `commands` | `EditorCommand[]` | Commands valid for this block type (from `blockCommands(type)`) |
| `rect` | `{ left, top, bottom } \| null` | Viewport coordinates of the cursor, for positioning a block menu |

`blockCommands(type)` returns:
- `table_cell` → `[table-insert-row, table-insert-column, table-delete-row, table-delete-column]`
- `code_block` → `[copy-code, code-block]`
- all others → the full insertion command set

### QuickInsert API

```ts
// Register a provider. Returns an unregister function.
const unregister = editor.registerQuickInsertProvider((ctx) => {
  if (!ctx.query) return [];
  return [{ id: "my-item", label: "My item", markdown: "my inserted text" }];
});

// Get filtered items for the current cursor (used by slash-command UI).
const items = editor.getQuickInsertItems("/");

// Apply an item (insert its markdown or run its command).
editor.runQuickInsert(items[0]);
```

`QuickInsertItem` fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Dedup key. Built-in items use the command name (e.g., `heading-1`). |
| `label` | `string` | Display name shown in the UI. |
| `detail` | `string?` | Short hint shown alongside label (e.g., `##`, `- item`). |
| `keywords` | `string[]?` | Extra search terms that match the item when the user types a query. |
| `command` | `EditorCommand?` | Built-in command to run. Mutually exclusive with `markdown`. |
| `value` | `string?` | Extra argument passed to `command` (e.g., `value: "theorem"` for `insert-org-env`). |
| `markdown` | `string?` | Literal Markdown to insert at cursor. Takes precedence over `command`. |
| `select` | `"start" \| "end" \| "all"?` | After inserting `markdown`, where to place the cursor. |

`QuickInsertContext` fields (passed to providers):

| Field | Type | Description |
| --- | --- | --- |
| `query` | `string` | Current filter text typed by the user. |
| `block` | `EditorBlockContext` | Block at cursor. |
| `before` | `string` | Up to 1 200 chars of source text before cursor. |
| `after` | `string` | Up to 1 200 chars of source text after cursor. |
| `sourceMode` | `boolean` | Whether the editor is in raw-source mode. |

### cursorContext

```ts
const ctx = editor.cursorContext(maxChars = 512);
// ctx.before  — up to maxChars chars before cursor
// ctx.after   — up to maxChars chars after cursor
// ctx.rect    — { left, top, bottom } viewport position or null
// ctx.rectAtOffset(n) — viewport rect for an absolute source offset
```

Used by the Copilot plugin to build a local source window. Passing a larger `maxChars` gives the model more context but increases IPC payload size.

## Renderer API

Entry: `Aaronnote/src/render-html.ts`.

Primary function:

```ts
renderMarkdownHTML(markdown, {
  assetResolver: (src) => src,
});
```

The renderer:

- Uses `markdown-it`.
- Sanitizes unsafe links by removing unsafe `href`/`src` attributes. `aaronnote-asset://` URLs are explicitly allowed (used by the desktop native bridge for images and fonts).
- Renders math blocks/inline math.
- Renders org-env blocks.
- Marks Roam-core links with `class="aaronnote-roam-link"` and `data-roam-link="true"`.
- Applies layout trailing attrs for images, Markdown tables, and diagram fences (see [Layout Attrs](#layout-attrs)).
- Renders `#+begin html` blocks as sanitized HTML content.

Additional renderer exports:

```ts
// Extract and resolve the css: metadata field from a note's Markdown source.
// Returns a fully-qualified file:// or http(s):// URL, or "" if not present.
noteCssHrefFromMarkdown(markdown: string): string

// Resolve a single css: metadata value to a URL.
// Accepts absolute local paths, file:// URLs, and http(s):// URLs.
cssHrefFromMetaPath(value: string): string
```

## Layout Attrs

Images, Markdown tables, and supported diagram fences can carry a trailing `{...}` attribute block to control layout. This works in both the live editor and the HTML renderer.

````md
![plot](./images/plot.png){w: 300px; align: right; wrap: true}

| A | B |
| --- | --- |
| 1 | 2 |
{size: 75%; align: center}

```marmind
Root
  Branch
    Detail
```
{size: 180%; align: left; wrap: on}
````

Images use same-line attrs. Tables and fenced diagrams use a standalone attrs line immediately after the table or closing fence.

`marmind` / `markmind` are forgiving mindmap fences: if the body already starts with a Mermaid diagram keyword such as `mindmap`, `graph`, or `flowchart`, Aaronnote keeps it as-is; otherwise it converts simple indented text or Markdown-ish lists into Mermaid `mindmap` source before rendering and keeps ordered-list markers in labels.

Rendered Mermaid diagrams are interactive in the editor: drag to pan, use ctrl/meta+wheel to zoom, double-click to reset, click nodes to highlight them, and click safe SVG links to route through Aaronnote's normal link opener. `marmind` / `markmind` stay static and use Aaronnote's dedicated mindmap theme.

Supported attribute keys (case-insensitive, `;` or `,` as separator):

| Key | Aliases | Values | Effect |
| --- | --- | --- | --- |
| `align` / `position` / `pos` | — | `left` `l`, `center` `c` `middle`, `right` `r` | Block alignment. |
| `wrap` / `float` | — | `true` `1` `yes` `on` `wrap`, or a side `left` `right` | Float the block with text wrap. Side implies `align`. |
| `width` / `w` / `size` | — | Number (px), CSS unit, percentage | Explicit block width. Percentages over `100%` are allowed. |
| `height` / `h` | — | Number (px), CSS unit | Explicit block height. |

Rules:
- Bare numbers (no unit) are treated as `px`.
- `wrap: true` with no `align` defaults to `right`.
- `wrap: center` is treated as non-wrap (centering floats makes no sense).
- Values in quotes or unquoted are both accepted.

The parser is in `Aaronnote/src/layout-attrs.ts` (built on `src/attrs-syntax.ts`). `image-attrs.ts` is a thin image-specific wrapper. CSS classes and custom properties follow the `aaronnote-<kind>-*` pattern, where kind is `image`, `table`, or `diagram`; see `src/styles/widgets.css` and [aaronnote-html-controls.md](aaronnote-html-controls.md) for override examples.

## Desktop Native API

The AaronNote app does not expose a local HTTP server. Renderer calls go through
`Aaronnote/aaronnote/api-client.ts`, the preload bridge in
`Aaronnote/desktop/preload.cjs`, and IPC handlers in `Aaronnote/desktop/main.mjs`.
The service exports are grouped under `Aaronnote/server/lib/`; local media,
fonts, note-kind assets, and graph helpers use `aaronnote-asset://`.

| Bridge domain | Purpose |
| --- | --- |
| `notes` | Bootstrap, open, list, save, create/trash nodes and folders, templates, snippets, todos, Roam sync. |
| `fs` | Ranger rename, move, duplicate, and trash operations. |
| `meta` | Add/remove metadata and update note tags. |
| `assets` | Store pasted assets, native path imports, orphan scans, and orphan trash. |
| `session` | Recent notes and cursor positions. |
| `plugins` | Scan manifests and read/write plugin overrides. |
| `copilot` | Copilot status, inline completion, acceptance, auth, quota, and log actions. |
| `lean` | Lean project status, region CRUD, LSP requests/notifications, goals, hover, completion, diagnostics, Infoview RPC, and cache commands. |
| `roamlookup` | Read-only Codex lookup session lifecycle and queries. |
| `shell` | Reveal or open local paths through Electron. |

### Save Contract

Save request payload:

```json
{
  "file": "/absolute/path.md",
  "content": "# Title\n",
  "mode": "markdown",
  "clientId": "window-id",
  "seq": 12,
  "baseMtimeMs": 1770000000000,
  "refresh": "deferred",
  "force": false
}
```

Success with deferred refresh:

```json
{
  "type": "saved",
  "ok": true,
  "file": "/absolute/path.md",
  "mtimeMs": 1770000000100,
  "size": 1234,
  "note": { "file": "/absolute/path.md", "title": "Title" },
  "notesRefresh": "deferred"
}
```

Conflict:

```json
{
  "type": "saved",
  "ok": false,
  "conflict": true,
  "mtimeMs": 1770000000200,
  "size": 1300
}
```

Clients should not overwrite a conflict unless the user chooses force save.

## Shell → Editor Communication (StateEffects)

The app shell communicates with the live CM6 view via StateEffects dispatched on `editor.view`. These are not part of the stable `Editor` interface — they require access to the `view` escape hatch.

### setKnownRoamRefs

Declared in `Aaronnote/src/cm6/roam-link-status.ts`.

```ts
import { setKnownRoamRefs } from "../src/cm6/roam-link-status.ts";

// Provide the list of known note refs. Broken wikilinks and roam:// hrefs are decorated.
editor.view.dispatch({ effects: [setKnownRoamRefs.of(noteIds)] });

// Clear broken-link decorations (e.g., while loading).
editor.view.dispatch({ effects: [setKnownRoamRefs.of(null)] });
```

- `noteIds` is `readonly string[]`. Each element is normalized via `canonicalNoteRef()`: lowercased, leading slashes stripped, `roam://` prefix removed, `.html` suffix replaced with `.md`.
- A `null` value clears all broken-link decorations. An empty array would mark every wikilink as broken.
- Broken links receive `class="cm-roam-link-broken"`. Style this in `src/styles/theme-typora.css`.
- Detection uses a regex scan (not Lezer nodes): `[[wikilink]]` syntax via `\[\[([^\]\n]+)\]\]` and bare `roam://` hrefs via `\broam:\/\/[^\s<>)\]]+`.

### setFindHighlightRanges

Declared in `Aaronnote/src/cm6/find-highlight.ts`.

```ts
import { setFindHighlightRanges } from "../src/cm6/find-highlight.ts";

// Highlight find matches. current=true marks the active match.
editor.view.dispatch({
  effects: [setFindHighlightRanges.of([
    { from: 100, to: 110 },
    { from: 250, to: 260, current: true },
  ])],
});

// Clear all highlights.
editor.view.dispatch({ effects: [setFindHighlightRanges.of([])] });
```

- Ranges are sorted by `from` then `to` before building the decoration set. Overlapping ranges are not merged.
- `current: true` adds class `cm-aaron-find-match cm-aaron-find-current`. Other ranges get `cm-aaron-find-match`.
- When the document changes, existing highlight ranges are mapped through the change set. A new `setFindHighlightRanges` dispatch replaces them all.

## TOC Index

The floating TOC panel reads the `TocIndex` StateField maintained by `tocIndexExtension`.

```ts
import { getTocIndex } from "../src/cm6/toc-index.ts";

const index = getTocIndex(editor.view.state);
// index.headings: MarkdownHeading[]  — { level, text, pos }
// index.anchors: InlineTagAnchor[]   — { tag, pos, to, lineFrom }
// index.headingSignature: string     — changes when heading list changes
// index.anchorSignature: string      — changes when anchor list changes
// index.hasFences: boolean           — true if any fenced-code block exists
// index.fenceRanges: { from, to }[]  — source ranges of all fence bodies
```

The panel should compare `headingSignature` and `anchorSignature` against the last rendered value before re-rendering. This avoids re-renders on edits that don't affect headings or anchors.

`fenceRanges` is used internally to suppress anchor extraction inside code blocks. It is also useful for viewport-gating: any decoration system that wants to skip inside fenced-code bodies can check `fenceRanges` before emitting decorations.

## Frontend Events And Commands

The app shell listens for:

```ts
document.dispatchEvent(new CustomEvent("aaronnote:open-url", {
  detail: { href: "roam://note-id@heading", newWindow: true },
}));

window.dispatchEvent(new CustomEvent("aaronnote:command", {
  detail: { command: "jump-stack" },
}));
```

Common commands:

| Command | Effect |
| --- | --- |
| `save-now` | Save current file. |
| `flush-state` | Flush save/cursor/recent state. |
| `toggle-source` | Toggle source mode. |
| `open-filesystem` | Open filesystem tab. |
| `open-plugin-manager` | Open plugin manager. |
| `toggle-lean-panel` | Show or hide the Lean panel. |
| `insert-lean-block` | Create a new `@@lean4 [tag]` placeholder and matching mirror-file region. |
| `clean-lean-block` | Clean the current Lean block/region. |
| `restart-lean-server` | Restart the active Lean LSP server. |
| `jump-stack` | Open or close the Roam jump stack UI. Bound to `Cmd+J` / `Ctrl+J`. |
| `jump-back` | Pop the Roam jump stack. |
| `open-block-menu` | Open block insert menu. |
| `new-markdown-note` | Create a regular Markdown note. |
| `new-roam-node` | Create a Roam note. |
| `insert-roam-idlink` | Insert a Roam note link. |
| `tag-context` | Tag/copy equation, inline anchor, or DOM target. |
| `sync-roamdb` | Sync the Roam database/index. |

## Roam Link Conventions

Preferred forms:

```md
[note](roam://note-id)
[tag](roam://note-id#anchor-tag)
[dom](roam://note-id@main-heading)
[tag](note-id#anchor-tag)
[dom](note-id@main-heading)
[local tag](./#anchor-tag)
[local dom](./@main-heading)
```

Detection rules:

- `roam://` links resolve by Roam id/key/path/source/file.
- Plain `id#tag` and `id@dom` are treated as Roam-core links if the id resolves to a note.
- `#tag` is an inline anchor target.
- `@dom` is a title/heading/TOC-derived target.
- `.` and `./` mean the current file.
- Markdown file links with `#` or `@` still count as note refs.

These forms are included in service-side ref/backlink extraction.

## Plugin Contract

Local plugins live under `plugin/<id>/` and provide `plugin.json`. The desktop
native bridge scans descriptors through `server/lib/plugins.mjs`; the frontend
imports matching `index.ts` files through Vite.

Plugin code should:

- Use exposed editor methods instead of manipulating CodeMirror internals when possible.
- Use `editor.insertText()` for completions and snippets.
- Keep heavy work behind a service/native bridge boundary or debounce/idle boundary.
- Register UI into app-owned panels only when the panel can be hidden by `data-notes-panel`.

Native-backed plugins should add explicit preload/IPC actions and service
functions rather than inventing endpoint-shaped strings.

## Snippet System

Aaronnote uses Emacs-style snippet files. Snippets are stored in `Aaronnote/snippets/markdown-mode/` and in `kinds/<kind>/snippet/<mode>/` for kind-specific snippets.

### File format

Each snippet is a plain text file named after the expansion key:

```
# name: Heading 1
# key: h1
# binding: none
# --
# $1
```

- Lines before `# --` are the header.
- `# name:` — display name.
- `# key:` — the expansion trigger (typed before pressing Tab or the snippet shortcut).
- The body (after `# --`) is the template.

### Tabstop syntax

| Pattern | Meaning |
| --- | --- |
| `$1`, `$2`, … | Tabstop; cursor moves here in order on Tab. |
| `${1:default}` | Tabstop with default text; default is selected and can be overwritten. |
| `$0` | Final cursor position after all tabstops are visited. |

Tabstops are processed left to right by index; `$0` is always last regardless of position in the template.

### Built-in snippets (`snippets/markdown-mode/`)

The `html` snippet inserts a `#+begin html ... #+end html` block. Other markdown-mode snippets cover headings, lists, tables, math blocks, and org-env kinds. The full list is in `Aaronnote/docs/emacs-snippet-migration.md`.

### Kind-specific snippets

Snippets under `kinds/<kind>/snippet/markdown-mode/` are loaded when the note's `kind:` metadata matches. They are merged with the global snippets; a kind-specific snippet with the same key as a global snippet shadows the global one.

### Inserting from code

Snippets are fetched through the native bridge (`notes.getSnippets()`) and applied via `editor.insertText()` after tabstop processing. Do not use `editor.setMarkdown()` for snippet insertion; it discards history and selection.
