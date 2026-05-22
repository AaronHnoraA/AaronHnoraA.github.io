# Aaronnote Performance Optimization

This is the active performance ledger for Aaronnote. Update it when work moves cost out of the edit path or when a new performance risk is introduced.

## Goal

The editor should remain responsive while preserving Markdown as the source of truth.

High-cost work should not run synchronously on every keystroke:

- Workspace scans
- Full notes refresh
- Backlink graph recomputation
- Heavy preview rendering
- Full-document search refresh
- Full-document serialization except at save/export boundaries

## Current Improvements

| Area | Change | Status |
| --- | --- | --- |
| Save refresh | `/api/save` can return a lightweight note summary and defer full notes refresh. | Implemented |
| Save conflict safety | Client sends `baseMtimeMs`; server returns `409 conflict` on external edits. | Implemented |
| Page lifecycle | `pagehide` / visibility changes flush pending save and cursor state. | Implemented |
| Find UI | Find refresh is debounced instead of recomputing immediately per key. | Implemented |
| Math decorations | Existing math decorations are mapped across unrelated edits where possible. | Implemented |
| Math block edits | Block math ranges update TeX content in place for edits inside existing `$$` blocks. | Implemented |
| Mermaid edits | Mermaid diagram blocks update source ranges in place for non-structural code edits. | Implemented |
| Math block rendering | Block math decoration updates patch only the edited math block window. | Implemented |
| Mermaid rendering | Mermaid decoration updates patch only the edited diagram block window. | Implemented |
| Table rendering | Markdown table scans are limited to the changed table-line neighborhood. | Implemented |
| Line styling | Heading, blockquote, and table line styling patch changed line windows for single-line structural edits. | Implemented |
| Org env body lines | Org-env body line decorations patch changed line windows for body newline edits. | Implemented |
| Org env boundary title | Title-only edits on one `#+begin <kind> ...` line patch that boundary chrome locally. | Implemented |
| Code fence styling | Single-line code fence marker edits patch the nearest affected fence window. | Implemented |
| Block extra ranges | `[toc]` and horizontal-rule range scans patch changed line windows for single-line edits. | Implemented |
| Filesystem view | Re-render key avoids repeating identical filesystem renders. | Implemented |
| Note relationships | Server note scan builds one canonical ref index before resolving refs/backlinks. | Implemented |
| Server note/todo scans | `/api/notes` and `/api/todos` share the same note cache; todo extraction is lazy and save refreshes patch dirty notes where safe. | Implemented |
| Table edit | Table cell edits preserve deliberate spaces and append rows locally. | Implemented |
| Link UX | Link/image commands select placeholders instead of forcing manual cleanup. | Implemented |
| Roam navigation | Jump stack records jump actions only; normal file switches clear it. | Implemented |
| Floating TOC | Heading and inline-anchor data are maintained by a CM6 StateField instead of rescanning in the panel update path. | Implemented |
| Preview selection toggles | Math and Mermaid preview/source switches patch only the entered/exited block on cursor movement. | Implemented |

## Priority Backlog

| Priority | Work | Reason |
| --- | --- | --- |
| P0 | Continue block-level derived indexes for inline tags, todos, refs. | Avoid full document scans for snippets/agenda/linking. |
| P0 | Worker or background indexing for cold workspace scans. | Keep first graph and agenda build out of startup/input paths. |
| P1 | Viewport-aware rendering for expensive widgets. | Math/code/diagram-heavy notes should open faster. |
| P1 | Large-file benchmark fixtures. | Prevent subjective performance regressions. |
| P2 | Bundle audit and dynamic imports for heavy optional libraries. | Reduce startup cost. |
| P2 | Persistent small KV store for recent/cursor/plugin state. | Avoid repeated full JSON localStorage writes. |

## Performance Boundaries and Thresholds

These are the concrete numeric limits that control when the system switches strategies. Update these when the underlying code changes.

### Code Highlighting

| Constant | Value | Source | Meaning |
| --- | --- | --- | --- |
| `WORKER_HIGHLIGHT_THRESHOLD` | 12 000 chars | `src/code-highlight-async.ts` | Code blocks shorter than this are highlighted synchronously on the render thread. Longer blocks are sent to the Web Worker; the first render returns no highlights and the view updates when the worker responds. |
| `ASYNC_CACHE_LIMIT` | 192 entries | `src/code-highlight-async.ts` | LRU limit for the async highlight cache. When the cache exceeds this size, the oldest entry is evicted. |

Implication: a note with many small code blocks (all under 12 000 chars) will always highlight synchronously. A note with one huge block will show unstyled code briefly on first load, then re-render once the worker finishes.

### Cursor and Completion Context

| API | Default `maxChars` | Source | Meaning |
| --- | --- | --- | --- |
| `editor.cursorContext()` | 512 | `src/cm6/editor-cm6.ts:426` | Returns at most 512 chars before and 512 chars after the cursor. Passed to Copilot and any external completion caller. Callers can pass a larger value but this increases IPC payload. |
| `buildQuickInsertContext()` | 1 200 | `src/cm6/commands.ts:575` | Context window used to build the `QuickInsertContext.before` / `.after` fields passed to provider callbacks. |

### Quick Insert Registry

| Limit | Value | Source | Meaning |
| --- | --- | --- | --- |
| Max returned items | 18 | `src/cm6/commands.ts:613` | After deduplication by `id`, the registry returns at most 18 items. Built-in items come first; provider items are appended in registration order. |
| Dedup key | `item.id` | `src/cm6/commands.ts:611` | First item with a given `id` wins. Use unique IDs in custom providers to avoid silently shadowing built-in items. |

### Save and Conflict

| Condition | Effect |
| --- | --- |
| `force: false` + mtime mismatch | Server returns `{ ok: false, conflict: true }`. Client must expose force-save to the user. |
| `refresh: "deferred"` + success | Server patches `noteCache` in memory. Next `scanNotes` skips re-reading this note. |
| `clientId` matches + mtime/size match the write | Save-originated watcher event is suppressed. No double dirty refresh. |

### StateField Locality Decision Table

Each CM6 `StateField` in the live-preview pipeline tries strategies in order: map → patch → full rebuild.

| StateField | Maps when | Patches when | Full rebuild triggers |
| --- | --- | --- | --- |
| `mathBlockField` | Changes contain no `$$` delimiter text | Edit is inside an existing display math block body | `$$` added, removed, or changed; block fence edits |
| `mermaidField` | Changes contain no fence/lang markers for mermaid | Edit is inside an existing mermaid block source | Fence added/removed; lang tag changed |
| `markdownTablesField` | Change is entirely outside table region | Single-line edit within table | Separator row edited; table added/removed |
| `lineDecoField` | Change has no structural markers (`#`, `>`, `|`) | Single-line heading / blockquote / table-row change | Multiline structural change; code fence boundary |
| `tableDecoField` | Change has no `|` character in range | Single-line edit within table | Table added/removed; separator edited |
| `blockExtraRangesField` | No `[`, `]`, `-`, `*`, `_` in changed range; no front matter | Single-line edit near `[toc]` or horizontal rule | Front matter involved; multiline change |
| `tocIndexField` (TocIndex) | No fence boundary line in changed range | Single-line heading / inline anchor edit | Fence boundary added/removed/edited |
| `orgEnvBlocksField` | No `#+begin` / `#+end` in changed range | Single-line title edit on existing `#+begin` line | Boundary kind, structure, or multiline edits |

The fallback cost of a full rebuild varies: `lineDecoField` scans line classes, which is cheap. `mathBlockField` rescans `$$` pairs, which is O(doc-length). `orgEnvBlocksField` rescans `#+begin`/`#+end` pairs across the document.

## Edge Cases

### Code Highlighting

- **Worker unavailable**: If the `Worker` constructor throws (SSR, some security policies), `highlightCodeForEditor` falls back to synchronous highlight regardless of block size. The fallback path is the same as the sub-threshold path.
- **Cache invalidation**: The async cache key is `lang\0text`. If the same language+text reappears in a new block, it hits the cache even across document loads within the same renderer lifetime. This is safe because highlight output is pure.
- **Worker error**: If the worker fires `error`, all pending requests are cancelled, the worker is terminated, and subsequent calls fall back to synchronous. The cache retains already-received results.

### Wikilink and Roam Link Detection

- **Hand-rolled regex vs Lezer**: The broken-link scanner in `roam-link-status.ts` uses `\[\[([^\]\n]+)\]\]` and `\broam:\/\/[^\s<>)\]]+` rather than Lezer parse nodes, because the GFM Lezer Markdown parser does not natively produce WikiLink nodes. This means escaped brackets `\[\[` and rare edge-form wikilinks are not handled. Plain CommonMark links with `roam://` hrefs are handled through the Lezer URL node path.
- **`canonicalNoteRef` normalization**: Both incoming refs (from `setKnownRoamRefs`) and scanned wikilinks are normalized to lowercase, stripped of leading slashes and `roam://`, with backslashes converted to forward slashes and `.html` extensions replaced with `.md`. A ref that doesn't normalize to a non-empty string is always treated as "known" (no error mark).
- **Empty known-refs set**: If `setKnownRoamRefs(null)` is dispatched, all broken-link decorations are cleared. If the set is provided but empty, all wikilinks and bare roam:// refs would appear broken. The app shell should dispatch with `null` while notes are loading, then dispatch with the actual list once available.

### Table Detection Edge Cases

- Table line regex: `/^\s*\|.*\|\s*$/` — a line must start **and** end with `|`. GFM tables without leading/trailing pipes (rare) are not detected.
- Separator detection: compact form must match `/^\|[-|:]+\|$/` after whitespace is stripped. A separator containing extra content (e.g., a note) is not recognized and the row is treated as data.
- The `table-delete-row` command refuses to delete row 0 (header) or row 1 (separator). The minimum valid table after deletions is `header + separator`.

### TOC Index Edge Cases

- **Fence state tracking**: `TocIndex.hasFences` and `fenceRanges` are tracked by counting `` ``` `` / `~~~` toggle lines matching `/^\s*(```|~~~)/`. A fence marker inside a blockquote or list item is still counted, which may produce a spurious fence range that suppresses anchor extraction for subsequent non-fenced lines.
- **Heading detection**: ATX headings with a trailing `#*` close sequence have the trailing markers stripped by the regex before `text` is stored. CJK text that ends in `#` would lose the trailing character.
- **Inline anchor vs inline code**: Anchors that appear inside backtick spans (`\`...\``) are suppressed using a simple regex scan for inline code ranges. Nested or escaped backticks are not handled; a complex inline code expression may incorrectly suppress a real anchor.

### Org-Env Boundary Edge Cases

- A `#+begin meta` block is treated differently from other org-env kinds: its content is parsed as note metadata rather than rendered as a block body. Edits to the title of a `meta` begin line trigger a full rebuild because metadata changes can affect the note's CSS href, visibility, and other global properties.
- Nested org-env blocks (a `#+begin` inside another `#+begin`) are not supported. The scanner matches the first `#+end` after a `#+begin` regardless of nesting.
- A `#+begin html` block renders as DOMPurify-sanitized HTML. The sanitizer uses a strict allowlist; custom elements, `<script>`, `<style>`, `<link>`, and `on*` attributes are stripped. `aaronnote-asset://` URLs are allowed in `src` and `href`.

### Layout Attrs Parsing Edge Cases

- **Standalone attrs line**: for tables and fenced diagrams, the attrs line must be the **immediately** next line after the closing `|` row or closing ` ``` ` fence. A blank line between the block and the attrs line causes the attrs to be treated as a normal paragraph.
- **Same-line attrs for images**: trailing `{...}` on the image line is consumed even if the image is inside a list item or blockquote. The attrs parser (`attrs-syntax.ts`) reads from the last `}` on the line backward.
- **Percentage over 100%**: `size: 150%` is allowed and produces `width: 150%` CSS. This intentionally permits diagrams wider than their container when horizontal scrolling is desired.
- **Unit-less numbers**: `w: 300` is treated as `300px`. Any value that is a valid CSS number with no unit gets `px` appended.
- **Conflicting keys**: if both `width` and `w` appear in one attrs block, the last one wins (the parser processes key-value pairs left to right).

### Multiple Windows

- Each window has its own CM6 `EditorView` and renderer process. StateEffects (`setKnownRoamRefs`, `setFindHighlightRanges`) are dispatched per-window and do not cross process boundaries.
- Save requests from any window carry a `clientId`. The server's `state.mjs` singleton receives the save and updates the shared `noteCache`. All windows see the updated cache on their next scan.
- If two windows save the same file simultaneously, the second save sees an mtime mismatch (from the first save) and returns `conflict: true`. Each window must handle the conflict independently.

## Maintenance Rules

For each performance change, record:

- Entry point changed.
- Critical path affected: open, input, scroll, save, startup, or plugin.
- What work moved to debounce, idle, background, cache, or deferred refresh.
- Test or benchmark run.
- Residual risk.

Do not mark an item complete just because work moved elsewhere. If cost still exists but no longer blocks input, mark it as partial and note where it moved.

## 2026-05-21 Notes Relationship Index

- Entry point changed: `resolveNoteRelationships()` in `Aaronnote/server/lib/runtime.mjs` via the `server/lib/index.mjs` service boundary.
- Critical path affected: native notes, graph, tags, todos, and deferred notes refresh after saves.
- Change: build a canonical reference map once per scan, then resolve each ref by map lookup instead of scanning all notes and all aliases for every ref.
- Test run: `npm test -- tests/server-refs.test.ts tests/server-save.test.ts tests/server-standalone.test.ts`.
- Residual risk: relationship resolution still runs after dirty-note scans; future work should avoid recomputing the whole backlink graph when a single note changes.

## 2026-05-21 Render Locality Pass

- Entry points changed: `blockMathRangesField`, mermaid fenced-code fields, and Markdown table fields.
- Critical path affected: input and render updates in math-heavy, diagram-heavy, and table-heavy notes.
- Change: non-structural edits inside existing block math and mermaid blocks now update mapped ranges/source text instead of rescanning the whole document. Markdown table structure edits rescan only the changed line neighborhood instead of the full document.
- Test run: `npm test`; `npm run build -- --mode test`.
- Residual risk: code fence and org-env structural boundary edits still use full-document rebuilds because a boundary can affect distant later lines.

## 2026-05-21 Line Decoration Locality Pass

- Entry points changed: `lineDecoField`, `tableDecoField`, and `orgEnvBodyLineDecorations`.
- Critical path affected: input and render updates in heading/table/blockquote-heavy notes and org-env notes.
- Change: single-line heading, blockquote, and table structure edits patch only the changed line neighborhood. Single-line code fence marker edits patch the nearest affected fence window from both old and new documents. Table widget decorations patch only affected table windows. Org-env body newline edits patch only nearby body line decorations when the org block structure is unchanged.
- Test run: `npm test`; `npm run build -- --mode test`.
- Residual risk: multiline code fence edits and org-env begin/end/kind edits still fall back to full rebuilds because one boundary can affect a large later range.

## 2026-05-21 Block Extra Range Locality Pass

- Entry points changed: `blockExtraRangesField`.
- Critical path affected: input updates around `[toc]` and horizontal-rule lines.
- Change: single-line edits involving `[`, `]`, `-`, `*`, or `_` now rescan only nearby block-extra lines when front matter is not involved.
- Test run: `npm test`; `npm run build -- --mode test`.
- Residual risk: front matter and multiline block-extra edits still fall back to full scan because they can reshape the document header or multiple sparse ranges.

## 2026-05-21 Math And Mermaid Decoration Locality Pass

- Entry points changed: `mathBlockField` and `mermaidField`.
- Critical path affected: input updates inside display math and mermaid diagram blocks.
- Change: edits inside an existing display math block or mermaid source block patch only the affected block decoration window. Other rendered math/diagram widgets are preserved through mapped decorations.
- Test run: `npm test`; `npm run build -- --mode test`.
- Residual risk: math fence edits and mermaid fence/lang edits still fall back to full rebuilds because they can create, remove, or reclassify block boundaries.

## 2026-05-21 Org Env Boundary Title Locality Pass

- Entry points changed: `orgEnvBlocksField`, `blockExtrasDecorations`, and `orgEnvBodyLineDecorations`.
- Critical path affected: typing in the title portion of an existing `#+begin <kind> ...` line.
- Change: a single-line title edit now maps org-env blocks, refreshes the changed block title, and patches only that boundary decoration. The body remains normal CM6 markdown; no nested block editor or block conversion was introduced.
- Test run: `npm test`; `npm run build -- --mode test`.
- Residual risk: adding/removing `#+begin` or `#+end`, editing the env kind, multiline title edits, and `meta` boundary edits still fall back to full rebuilds.

## 2026-05-21 Floating TOC Index Pass

- Entry points changed: `tocIndexExtension` in `Aaronnote/src/cm6/toc-index.ts` and `createFloatingTocPanel()` in `Aaronnote/aaronnote/floating-toc.ts`.
- Critical path affected: input updates that request Floating TOC refresh.
- Change: headings and inline anchors are now kept in a CM6 `StateField`; the panel reads cached signatures instead of rescanning the document. Regular line edits patch only changed lines, including edits inside fenced-code bodies where anchor extraction must stay disabled.
- Test run: `npm test`; `npm run build:aaronnote`.
- Residual risk: edits that add, remove, or alter fenced-code boundary lines still fall back to a full TOC index rebuild because they can change the fence state of later lines.

## 2026-05-21 Server Shared Index Pass

- Entry point changed: `scanNotes()` and `scanTodos()` in `Aaronnote/server/lib/runtime.mjs` via the `server/lib/index.mjs` service boundary.
- Critical path affected: native notes, graph, tags, todos, and deferred save refreshes.
- Change: note scans now preserve raw refs separately from resolved refs, so unresolved wiki links can resolve after a later note appears. Dirty edits patch refs/backlinks in place when the note identity is unchanged, and todo loading reuses the note cache with lazy todo extraction instead of stat/read scanning the vault again. Save-originated watcher events are ignored when mtime/size match the write, avoiding an immediate redundant dirty refresh.
- Test run: `npm test -- tests/server-refs.test.ts tests/server-todos.test.ts tests/server-save.test.ts`; `npx tsc --noEmit`; 5000-note synthetic benchmark.
- Benchmark note: cached notes was about 21 ms, first todos about 38 ms, cached todos about 21 ms, and todos after deferred save stayed on the cached path at about 20 ms.
- Residual risk: a cold notes scan still has to read and parse every note; moving that first scan into a worker/background process remains future work.

## 2026-05-21 Preview Selection Locality Pass

- Entry points changed: `mathBlockField` and `mermaidField`.
- Critical path affected: cursor movement into and out of display math and Mermaid blocks.
- Change: selection-only preview/source toggles now filter and rebuild only the old/new block windows instead of rebuilding all math or Mermaid decorations in the document.
- Test run: `npm test -- tests/cm6/roundtrip.test.ts tests/floating-toc.test.ts tests/server-refs.test.ts tests/server-save.test.ts tests/server-todos.test.ts`; `npx tsc --noEmit`.
- Residual risk: structural fence edits still fall back to the existing full rebuild paths.

## Future Performance Work

This section describes the design intent for each backlog item so that implementations can start from a shared understanding.

### P0: Background Cold Workspace Scan

**Problem**: `scanNotes()` reads and parses every note synchronously on first call. At typical workspace sizes (~5 000 notes, ~38 ms cold), this is acceptable. At 50 000+ notes it blocks the main process.

**Design**:

1. Main process spawns a Node.js `worker_threads` worker that receives `noteRoot` and performs the cold scan.
2. While the worker runs, `getNotes()` returns the last cached result (possibly empty) or a loading sentinel.
3. The worker posts the completed index back to main; main swaps the cache atomically.
4. Subsequent dirty refreshes use the existing patch path; no worker is needed for incremental updates.
5. The `1/100` full-sync correction (Roam DB incremental sync) should also run in the worker.

**Risk**: Swapping the cache while a save is in flight can cause a transient backlink miss. Add a version counter; discard worker results older than the newest in-flight save.

### P0: Block-Level Inline Tag / Todo Index

**Problem**: Todo extraction requires reading note content (lazy, but still per-note on first request). Inline anchor lookup for jump navigation also scans content on demand.

**Design**:

1. Extend the server-side note cache entry to include a `taskIndex: { text, done, lineNum }[]` field.
2. Extract tasks during `scanNotes()` using the same simple line scan that the publish pipeline uses.
3. On save with `refresh: "deferred"`, re-extract tasks for the saved note and patch the cache entry.
4. On the client side, the `tocIndexExtension` StateField already tracks inline anchors incrementally — expose it through a new `editor.getTocIndex()` method for the jump-navigation path.

**Risk**: Todo text may contain Markdown that needs rendering for display; keep raw text in the cache and render lazily only for UI display.

### P1: Viewport-Aware Widget Rendering

**Problem**: A note with 100 math blocks renders all of them on open, even if only 3 are visible.

**Design**:

1. Use the viewport range plugin (added 2026-05-19) to define the visible line range.
2. For blocks outside the viewport, emit a `Decoration.replace` placeholder widget whose `estimatedHeight` is stored from the last measured render.
3. When the viewport changes, the StateField compares visible range against each block range and upgrades placeholders to full widgets as blocks enter the viewport.
4. `IntersectionObserver` on placeholder DOM elements can trigger a CM6 `requestMeasure` cycle for accurate height estimation before a block enters view.
5. The viewport plugin already tracks `fenceRanges` in the `TocIndex`; reuse those ranges to identify code/math/diagram blocks for viewport gating.

**Risk**: Height estimation errors during scroll cause layout jitter. Seed estimates from a per-block-kind heuristic (e.g., 1 line of math ≈ 40px, 1 line of code ≈ 20px) and refine after first render.

### P1: Large-File Benchmark Suite

**Problem**: Performance regressions are caught subjectively; the 5MB synthetic test (`tests/synthetic_qc_note_5mb.md`) only covers server paths.

**Design**:

1. Add a CM6-level Vitest benchmark (using `vitest bench` or a manual `performance.now()` harness) covering:
   - `setMarkdown` time for the 5MB fixture
   - Time to first stable decoration set (measure via a mocked `requestAnimationFrame` or a real DOM in jsdom)
   - Input latency simulation: 100 keystrokes into a mid-document paragraph, measure total transaction time
2. Add a server-side benchmark:
   - Cold `scanNotes` for a 10 000-note fixture
   - Incremental dirty refresh after a single note change
3. Run benchmarks in CI on a dedicated step (not the unit test step) and post a summary comment on PRs that touch `src/cm6/` or `server/lib/`.

### P2: Dynamic Bundle Splitting for Heavy Libraries

**Problem**: All heavy libraries (`mermaid`, `temml`, `turndown`) are in the initial JS bundle, increasing startup time even for notes that don't use them.

**Library weights (approximate)**:

| Library | Bundle size | Trigger |
| --- | --- | --- |
| `mermaid` | ~600 KB | First fenced `mermaid`, `mindmap`, `markmind`, or `marmind` block |
| `temml` | ~200 KB | First inline or display math block |
| `turndown` | ~30 KB | First HTML paste |
| `DOMPurify` | ~50 KB | First `#+begin html` render (or first paste) |

**Design**:

1. Wrap each library in a lazy singleton: `let _mermaid: Promise<typeof import('mermaid')> | null = null; function getMermaid() { return (_mermaid ??= import('mermaid')); }`.
2. In the `mermaidField` StateField `toDOM()`, call `getMermaid().then(render)` and show a "Rendering…" placeholder until the promise resolves.
3. For `temml`, the math widget's `toDOM()` should check if temml is loaded; if not, show the raw LaTeX source in a styled `<code>` block and re-render when it arrives.
4. For `turndown` and `DOMPurify`, the paste handler can synchronously show the raw HTML as a fallback and replace it once the library loads (one render cycle).

**Risk**: A render flash (raw source → rendered output) is visible to the user on first occurrence. Accept this tradeoff; the flash only happens once per session.

### P2: Persistent Small KV for Session State

**Problem**: `session.mjs` writes full JSON for recent notes and cursor positions on every update. Under heavy note-switching, this produces one `fs.writeFile` per note open.

**Design**:

1. Use SQLite (via `better-sqlite3` or `node:sqlite` in Node 22+) with a `session` table: `(key TEXT PRIMARY KEY, value TEXT, updated INTEGER)`.
2. Schema keys: `recent:<windowId>` (JSON array of recent note paths), `cursor:<filePath>` (JSON `{line, ch}`), `plugin:<id>:<key>` (plugin-specific state).
3. Writes are synchronous SQLite `INSERT OR REPLACE` — sub-millisecond and atomic.
4. On startup, read all keys in one `SELECT *` and populate an in-memory map; subsequent reads serve from the map.
5. Remove the JSON file fallback once SQLite is stable.

**Risk**: Adding a native dependency (`better-sqlite3`) increases the Electron build size and requires a pre-compiled binary per platform. Evaluate `node:sqlite` (Node 22.5+) as a zero-dependency alternative.
