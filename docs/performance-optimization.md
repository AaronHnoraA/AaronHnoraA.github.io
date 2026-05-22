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
