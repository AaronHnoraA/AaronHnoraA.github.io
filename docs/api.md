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
- Sanitizes unsafe links by removing unsafe `href`/`src` attributes.
- Renders math blocks/inline math.
- Renders org-env blocks.
- Marks Roam-core links with `class="aaronnote-roam-link"` and `data-roam-link="true"`.

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
