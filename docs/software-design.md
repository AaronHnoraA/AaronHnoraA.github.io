# Aaronnote Software Design

This document describes the intended product and runtime design for Aaronnote. It complements [architecture.md](architecture.md), which goes deeper into implementation layering.

## Product Shape

Aaronnote is a file-first Roam-style Markdown editor:

- The source of truth is Markdown files under `roam/`.
- The editor keeps Markdown as the persistent format, not a private binary document model.
- Roam identity, backlinks, tags, todos, snippets, and plugins are derived indexes over the same files.
- Lean 4 content is still file-first: Markdown stores `@@lean4 [tag]`
  placeholders, while real Lean source lives in derived `.lean` mirror files
  under the notes root's `.lean/` Lake project.
- The desktop app is the primary native shell: Electron main owns filesystem/index
  calls through IPC and exposes local assets through a custom protocol. The
  publish website remains a separate derived output.

The core design rule is that editing must stay local, reversible, and source-preserving. UI views can be rich, but they must not hide state in a database that cannot be reconstructed from Markdown.

## Runtime Layers

1. Editor kernel: `Aaronnote/src/`
   - CodeMirror 6 owns the active document, selection, history, decorations, and widgets.
   - `src/editor-api.ts` exposes the stable `createEditor()` facade.
   - `src/render-html.ts` renders Markdown for preview, export, and publish.

2. App shell: `Aaronnote/aaronnote/`
   - Handles notes UI, agenda, filesystem browser, graph panel, command palette, snippets, Roam navigation, save state, and plugin integration.
   - Owns browser-level state such as recent notes, cursor positions, jump stack, and transient UI panels.
   - Ranger filesystem management is app-only behavior. Create, rename, move, duplicate, trash, refresh, Recent navigation, and focus handling belong here and must not be implemented in the published website.
   - Lean panel orchestration is app-only behavior. The panel owns Infoview,
     messages, restart/stop controls, and the bottom-pinned outline, while the
     embedded Lean editor remains a CM6 widget in `src/`.

3. Local service library: `Aaronnote/server/`
   - Provides the filesystem/index/save functions used by the desktop main
     process.
   - Builds note summaries, refs, backlinks, todos, snippets, path suggestions, plugin descriptors, and asset helpers.
   - Handles atomic saves and mtime conflict checks.

4. Desktop shell: `Aaronnote/desktop/`
   - Bridges renderer calls to the local service library through Electron IPC.
   - Serves local media, fonts, note-kind assets, and graph helpers through
     `aaronnote-asset://`.
   - Creates Electron windows.
   - Provides menus, window lifecycle, PDF export, and safe external navigation.

5. Publish pipeline: `bin/publish-site`
   - Reads `roam/`.
   - Uses Aaronnote's renderer for HTML.
   - Writes `public/` and static data files.
   - Does not expose local filesystem management. The published web output is read-only browsing/rendering, not the ranger app.

## Editing Model

The editor document is Markdown source text. Rich behavior is derived:

- Inline formatting uses CodeMirror decorations.
- Math, code fences, images, org-env blocks, task lists, and tables use CM6 widgets or source-aware UI.
- Lean blocks use whole-line `@@lean4 [tag]` placeholders. The widget mounts an
  isolated child editor for the matching region in the derived `.lean` mirror
  file; Markdown keeps only the placeholder.
- Commands mutate source through editor transactions so history and selection remain correct.
- Source mode is a view mode, not a separate document.

When adding editing behavior, prefer this order:

1. Source transaction.
2. Syntax tree or source scan.
3. Decoration/widget rendering.
4. Command and tests.

Avoid storing canonical content in widget DOM. DOM is only a rendered projection.

## Roam Link Model

Aaronnote supports regular Markdown links and Roam-core links. Roam-core links are visually distinct and participate in ref/backlink detection.

Canonical forms:

```md
[note](roam://note-id)
[tag](roam://note-id#anchor-tag)
[section](roam://note-id@dom-target)
[tag](note-id#anchor-tag)
[section](note-id@dom-target)
[local tag](./#anchor-tag)
[local section](./@dom-target)
```

Wikilinks are also first-class Roam refs:

```md
[[note title]]
[[note alias]]
```

Rules:

- `#` means an inline anchor/tag target.
- `@` means a DOM/heading/title target.
- `.` and `./` mean the current file.
- `[[...]]` resolves by title or alias, participates in backlinks, renders as a Roam link in the editor, and is marked broken when it does not match any known note ref.
- `roam://...` is the explicit stable form and should be used when an id/key/path target matters.
- Legacy `#tag-...` links are still understood when opening old content.
- New inline-anchor links should use `#anchor-tag`, not `#tag-anchor-tag`.
- DOM targets are normalized to lowercase slug form for stability.

Roam navigation records jump actions only. Normal file switching clears the jump stack, while link jumps push the current cursor/file position. `Cmd+J` opens the jump stack UI.

## Human Interaction Design

Aaronnote optimizes repeated note work rather than landing-page presentation:

- The first screen is the editor or notes workspace.
- Controls are compact and task-oriented.
- Link navigation is direct: Command-click opens in the current window, Command-middle-click opens in a new window, and Roam jumps can be reversed.
- Command palette actions mirror menu actions where possible.
- Save status is explicit: dirty, saving, saved, failed, or conflict.
- Editor cursor state is sticky: leaving the editor for notes/ranger/plugins saves the current source selection and scroll position, returning to the same file restores it, and reopening a file restores the last persisted cursor position.

Transient panels should be scoped to the active workspace. A plugin panel added to the Notes page must be hidden when another notes tab is selected.

Opening Filesystem or Recent ranger should also hide the Lean panel. The ranger
and Lean drawer are both left-side work surfaces; keeping both open creates
layout instability and steals focus from the active task.

## Performance Design

The main performance rule is to keep high-cost work out of the input path:

- Source changes should be CodeMirror transactions, not full document rewrites.
- Decoration work should be viewport-aware or cached when possible.
- Find, snippets, TOC, graph, notes refresh, and index refresh should be debounced or deferred.
- Save returns a lightweight current-note summary when a full notes refresh can be deferred.
- Large files may open in source mode to avoid expensive rendered preview startup.
- Lean editor polish should reuse existing LSP/editor state: diagnostics,
  progress, completion item kinds, outline symbols, and Copilot auxiliary
  registration must not add polling or full-file scans on every input.

See [performance-optimization.md](performance-optimization.md) for the maintenance ledger.

## Reliability Design

Reliability is handled at boundaries:

- Saves include `baseMtimeMs` and report conflicts instead of overwriting external changes silently.
- Saves are atomic on the server side.
- Page hide and visibility change flush pending edits and cursor positions.
- Recent notes and cursor positions are local conveniences; Markdown files remain authoritative.
- Desktop close protects the last window; quitting is explicit through `Cmd+Q`.

When in doubt, preserve Markdown content and report a recoverable conflict rather than guessing.
