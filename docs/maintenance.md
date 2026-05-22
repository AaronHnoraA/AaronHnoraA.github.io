# Aaronnote Maintenance Guide

This guide is for keeping Aaronnote reliable while changing editor behavior, Roam links, performance, or native APIs.

## Setup

```sh
cd Aaronnote
npm install
npm test
npm run build:aaronnote
```

Use `npm run start:vite` for the renderer dev server and `npm run build:desktop` for the Electron bundle.

## Before Changing Code

Identify the layer first:

- Editor source behavior: `Aaronnote/src/cm6/`
- App UX and navigation: `Aaronnote/aaronnote/`
- Save/index/API behavior: `Aaronnote/server/lib/` and the Electron IPC bridge in `Aaronnote/desktop/`
- Desktop menu/window lifecycle: `Aaronnote/desktop/`
- Publish output: `bin/publish-site`
- Plugin behavior: `plugin/<id>/`

Do not mix unrelated layers unless the feature contract crosses them. A Roam link feature often does cross layers: editor rendering, app navigation, server ref detection, and docs all need to agree.

## Test Strategy

Use focused tests while iterating, then broader checks before finishing.

Focused examples:

```sh
cd Aaronnote
npm test -- tests/server-refs.test.ts
npm test -- tests/server-save.test.ts
npm test -- tests/cm6/roundtrip.test.ts
npm test -- tests/cm6/commands.test.ts
```

Broader checks:

```sh
cd Aaronnote
npm test
npm run build:aaronnote
```

If a change touches Electron-only behavior, at minimum run:

```sh
cd Aaronnote
node --check desktop/main.mjs
node --check desktop/preload.cjs
node --check server/lib/runtime.mjs
```

## Adding a CM6 Feature

Before writing any code, choose the right CM6 primitive:

| Need | Use |
| --- | --- |
| Derived data that only depends on doc content | `StateField` |
| Decorations that depend on cursor position or viewport | `ViewPlugin` |
| Decorations that depend only on doc content | `StateField` + `provide: (f) => EditorView.decorations.from(f)` |
| Replacing a source range with a rendered widget | `Decoration.replace({ widget: new MyWidget(...) }).range(from, to)` |
| Styling a source range without replacing it | `Decoration.mark({ class: "..." }).range(from, to)` |
| Styling a whole line | `Decoration.line({ attributes: { class: "..." } }).range(lineFrom)` — must come from a StateField |

Widget checklist:
1. Set `data-cm-source-from` and `data-cm-source-to` on the widget's root element.
2. Set `data-cm-open-source="true"` if a plain click should enter source editing (vs. special widget click).
3. Implement `eq()` to compare all inputs that affect the rendered DOM — missing comparisons cause ghost widgets.
4. Add `ignoreEvent(): true` to prevent CM6 from treating widget DOM events as editor events (unless intentional).
5. Add the extension to `previewExtensions()` in `editor-cm6.ts`.
6. Test in `tests/cm6/roundtrip.test.ts` or a new test file using the public editor API.

Locality patching checklist (if the feature will be in a hot path):
1. Implement `canMap(changes)` — return true when positions shift but no rescan is needed.
2. Implement `canPatch(changes)` — return true for single-line edits where only a window needs rescanning.
3. In the StateField `update()`, try map → patch → full-rebuild in that order.
4. Test by checking that the field value does not change for transactions that `canMap` handles.

## Save And Conflict Safety

The save path must preserve external edits:

- Client sends `baseMtimeMs`.
- Server compares against current file mtime.
- If mtime differs and `force` is not set, return `{ ok: false, conflict: true }`.
- Client exposes force save as an explicit action.
- Normal saves can request `refresh: "deferred"` to avoid rebuilding the whole notes list in the input path.
- A save that succeeds with `refresh: "deferred"` patches the `noteCache` entry in memory, so the next `scanNotes` does not need to re-read the file.

When editing this code, verify both the success and conflict paths in `tests/server-save.test.ts`.

## Adding a Native IPC Action

1. Add the method to the appropriate domain object in `desktop/preload.cjs`:
   ```js
   myDomain: {
     myAction: (body = {}) => invoke("aaronnote:api:my-domain:my-action", body),
   }
   ```
2. Add the typed method to the matching object in `Aaronnote/aaronnote/api-client.ts`.
3. Register the handler in `desktop/main.mjs`:
   ```js
   ipcMain.handle("aaronnote:api:my-domain:my-action", async (_e, body) => {
     return myLib.myAction(body);
   });
   ```
4. Implement `myAction` in the appropriate `server/lib/<domain>.mjs` module and re-export from `server/lib/index.mjs` if needed for tests.
5. Add a test in `tests/api-client.test.ts` that mocks `window.aaronnoteApi` and verifies the native-bridge path (no `fetch` should be called).

## Roam Link Maintenance

Whenever a Roam link convention changes, update all of these together:

- App parser/navigation in `Aaronnote/aaronnote/main.ts`
- Server ref extraction in `Aaronnote/server/lib/index.mjs` and its current
  implementation exports
- Live-preview styling in `Aaronnote/src/cm6/live-preview.ts`
- HTML rendering in `Aaronnote/src/render-html.ts`
- Tests in `Aaronnote/tests/server-refs.test.ts` and CM6 tests if click behavior changes
- [api.md](api.md) and [software-design.md](software-design.md)

Current canonical conventions:

- `id#tag` for inline anchor targets.
- `id@dom` for title/heading/DOM targets.
- `./#tag` and `./@dom` for current-file targets.
- `roam://id#tag` and `roam://id@dom` for explicit Roam-id links.

Legacy `#tag-...` links should remain readable.

## Performance Maintenance

Performance changes should move work out of the active input path. Prefer:

- Debounce for find, snippets, graph, notes refresh, and index refresh.
- Idle or deferred rendering for heavyweight previews.
- Lightweight save responses followed by deferred notes refresh.
- Decoration mapping/reuse for transactions that do not affect a feature.
- Local source-window payloads for external services instead of full document payloads.

Record new performance work in [performance-optimization.md](performance-optimization.md), including risk and verification.

## Layout Attrs Maintenance

Layout attrs (`{align:...; w:...; wrap:...}`) apply to images (same-line), Markdown tables (standalone line after table), and diagram fences (standalone line after closing fence). All three use the shared `layout-attrs.ts` pipeline.

### Two rendering paths that must stay in sync

| Feature | Editor (CM6) | Renderer (markdown-it) |
| --- | --- | --- |
| Images | `src/cm6/widgets/image.ts` — `readImageTrailingAttrs()`, extends replaced range | `src/render-html.ts` — `applyImageAttrs()` on `image` token |
| Tables | `src/cm6/live-preview.ts` — `nextLayoutAttrsLine()`, `TableWidget(layout)` | `src/render-html.ts` — attrs-line extraction before markdown-it table parse |
| Diagrams | `src/cm6/widgets/fenced-code.ts` — `readLayoutAttrsLine()` after closing fence | `src/render-html.ts` — attrs-line extraction before fence render |

CSS custom properties per kind (`image`, `table`, `diagram`):
- `--aaronnote-<kind>-width` / `--aaronnote-<kind>-max-width`
- `--aaronnote-<kind>-height` / `--aaronnote-<kind>-max-height`
- CSS classes: `aaronnote-<kind>`, `aaronnote-<kind>-align-<side>`, `aaronnote-<kind>-wrap`

### Adding a new layout key

1. Add it to `LAYOUT_ATTR_KEYS` in `src/layout-attrs.ts`.
2. Normalize it in `layoutFromAttrs()`.
3. Emit the class/style in `layoutClasses()` / `layoutStyle()` / `applyLayoutAttrs()`.
4. Add CSS rules in `src/styles/widgets.css` following the `aaronnote-<kind>-*` pattern.
5. Test in `tests/render-html.test.ts` (renderer path) and `tests/cm6/roundtrip.test.ts` (editor path).

### Adding a new block type that supports layout attrs

1. Use `readLayoutAttrsLine(nextLine.text)` to detect the standalone attrs line after the block.
2. Store the layout in the StateField tuple and pass to `applyLayoutAttrs(el, "mykind", layout)` in `toDOM()`.
3. Extend the Decoration replaced range to include the attrs line (so it is consumed by the widget).
4. In the renderer, strip the attrs line before calling markdown-it and apply the attrs to the rendered element.
5. Add `aaronnote-mykind-*` CSS rules following the established pattern.

## Reliability Checklist

Before completing a change, check:

- Does it preserve Markdown source round-trip? (`getMarkdown()` after `setMarkdown()` should be stable)
- Does it keep save conflicts recoverable? (`conflict: true` response → user-visible option to force save)
- Does it avoid full workspace scans on keystrokes? (scan only on save, open, or explicit refresh)
- Does it clean up timers, child processes, event listeners, and panels?
- Does it work with multiple windows? (each window has its own renderer process; server-side state is shared via `state.mjs` singleton but window-specific state must not leak)
- Does it avoid breaking standalone Markdown files? (files outside `roam/` must still open and save)
- Does it update tests and docs when a public convention changes?
- For new IPC actions: does the preload shape match the main handler shape exactly? (type mismatches fail silently under `contextBridge`)
- For new CM6 extensions: does `eq()` correctly identify unchanged widgets to prevent unnecessary re-renders?
- For new layout attrs: do both the CM6 editor widget and the markdown-it renderer path apply them?

## Release/Build Notes

The package build and desktop build have different scopes:

- `npm run build:aaronnote` validates TypeScript and web app bundling.
- `npm run build:desktop` also validates Electron and packages a macOS directory build.
- Root `make build` delegates to the project-level build flow.

Do not treat files under `public/`, `agent/index/`, or `agent/wiki/` as authoritative source. They are derived outputs and should only be changed by the relevant generation step.

## Operational Notes

**Recent notes and cursor positions** are convenience state stored in `session.mjs`. If they fail to persist, the Markdown files are still authoritative.

**Roam lookup sessions** are server-side child processes (`roamlookup.mjs` spawns `codex exec`). They must be idle-closed (1 min timeout) and explicitly terminated when the user closes the panel. The client must not show a plugin panel under the wrong notes tab; use `data-notes-panel` so the app-level tab switcher can hide it.

**Copilot** runs a persistent LSP client (`copilot.mjs`). It talks to `github.copilot-language-server` via stdio. Completions are requested with a local source window — not the full document — to keep IPC payloads small.

**Multiple windows**: each window gets its own renderer process but shares the main process's `state.mjs` singleton. Save operations from any window invalidate the shared cache via `markNotesDirty()`. The `clientId` field on save requests identifies which window initiated the save, used for seq-number conflict detection.

**`aaronnote-asset://` protocol**: if the handler throws (e.g. file not found), it must log and return a 404 response — not rethrow. An uncaught exception in a protocol handler can crash the main process.

**Dev workflow**: `npm run start:vite` runs the renderer-only Vite dev server. For desktop dev, set `AARONNOTE_DEV_VITE_URL=http://localhost:5173` and run `npm run build:desktop` to get an app that points to the local Vite server. The `aaronnote-asset://` protocol still works in dev because it is registered in the main process regardless of the renderer URL.

**TypeScript check without build**: `npx tsc --noEmit` from `Aaronnote/`. This is faster than a full build and catches type errors in all `.ts` source files including `server/lib/*.mjs` (if tsconfig covers them).
