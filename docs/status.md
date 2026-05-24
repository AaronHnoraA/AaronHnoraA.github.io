# Status

## Current State

As of 2026-05-24, the repository has a working development pipeline:

- `Aaronnote` can be developed, tested, and built.
- The publish script can convert the Markdown source into a static site.
- The AI maintenance layer can generate indexes and condensed wikis.

Recent project evolution milestones:

- 2026-05-02: AI maintenance layer switched to "index refresh always allowed; tooling changes require the development gate."
- 2026-05-18: Source of truth moved back to `roam/**/*.md`; the distribution layer switched to reading Markdown meta and relative links.
- 2026-05-19: Added large-file performance ledger; P0 input/open-path bottlenecks (full serialize, Copilot full-document context, full-document inline normalize scan, large-doc decoration/code/image scan, full-file todo re-read) scoped to on-demand / local boundaries.
- 2026-05-19: P1/P2 performance convergence: autosave serialization deferred to idle; heavy blocks use CSS containment; recent/positions local state write deferred.
- 2026-05-19: Web Worker introduced for 12k+ fenced-code highlighting; long code block highlighting no longer occupies the renderer main thread.
- 2026-05-19: Continued push toward block/window model: TOC heading index, task-marker propagation, ref-def draft decorations, org-env commit no longer do full-tree scans on large-document input paths by default. Mermaid forced `vendor-diagrams` bundle removed.
- 2026-05-19: Viewport range plugin added; decorations, fenced code, ref-def, and image probe in large documents prioritize the visible area.
- 2026-05-19: Snippet target-block lookup changed to insertion-point / viewport window; equation tag builds an incremental CM6 index; jump and suggestion no longer temporarily read the full Markdown.
- 2026-05-19: PM → CM6 migration completed; CM6 is now the only runtime core.
- 2026-05-21: HTTP → Electron IPC migration completed (Phases 0–3). Desktop runtime no longer starts a local HTTP server; all save/open/fs/meta/session/plugin/copilot/roamlookup calls go through Electron IPC. `aaronnote-asset://` custom protocol replaces HTTP server for media, fonts, note-kind assets, and roam-tools. Server tests migrated from HTTP to direct lib imports.
- 2026-05-21: Batch locality passes for render paths (math, Mermaid, tables, headings, org-env, TOC index, shared server scan) completed; see [performance-optimization.md](performance-optimization.md).
- 2026-05-22: Layout trailing attrs: `![alt](src){align: right; w: 300px; wrap: true}` controls image layout, and standalone attrs lines after Markdown tables / supported diagram fences control table and diagram layout. Shared attr-parsing module (`attrs-syntax.ts`) extracted; `layout-attrs.ts` generalizes the layout model for image/table/diagram reuse.
- 2026-05-22: Mermaid diagram previews gained drag pan, wheel zoom, node-highlight, and link handling. `marmind` / `markmind` fences accept plain indented trees or Markdown-ish lists, keep ordered-list markers while normalizing into Mermaid `mindmap` source, and render with a static Aaronnote mindmap theme.
- 2026-05-22: Desktop windows enable Electron visual pinch zoom for trackpads while the existing application zoom level remains controlled by the native zoom shortcuts and menu commands.
- 2026-05-22: `#+begin html ... #+end html` org-env block now renders as a DOMPurify-sanitized `<div class="aaronnote-html">` in both editor and publish pipeline.
- 2026-05-22: Per-note CSS: `css:` field in `#+begin meta` loads a note-specific stylesheet after all app/kind styles. `noteCssHrefFromMarkdown()` exported from `render-html.ts` for use by the publish pipeline and the editor shell.
- 2026-05-22: HTML snippet added (`snippets/markdown-mode/html`) for quick `#+begin html` block insertion.
- 2026-05-24: Lean integration stabilized around whole-line `@@lean4 [tag]`
  placeholders and mirror files under `roam/.lean/`. The duplicate root
  `roam/.lake/` cache was removed from the active layout; the Lake cache now
  belongs under `roam/.lean/.lake/`.
- 2026-05-24: Embedded Lean editors gained LSP completion kind icons,
  diagnostics/progress gutter markers, capped hover/docs, Copilot auxiliary
  editor support, Lean-local visible jump labels, and `Ctrl+Enter` ranger
  toggling. Recent ranger keyboard navigation and Filesystem/Recent `Tab`
  switching are documented.
- 2026-05-24: Lean panel layout changed so Infoview/messages scroll above a
  bottom-pinned Lean outline. Outline height remains user-resizable, but changing
  Infoview goal content no longer moves the outline.

## CM6 Core

- Current state: **CM6 is the sole runtime core** (migration completed 2026-05-19)
- `EditorOptions.kernel` kept for backward call compatibility but the type only accepts `cm6`
- Full test run: 628 passing / 0 failing / 0 skipped (as of 2026-05-19; layout attrs tests added 2026-05-22)
- Recent milestones: CM6 `getHTML()` hooked into the shared HTML export pipeline; CM6 parser switched to GFM-capable `markdownLanguage`; CM6 paste path reuses the kernel-agnostic clipboard helper; CM6 org-env widget body rendered via Markdown HTML renderer (inline math in blocks now parses); Chinese font unified to heading-font priority; CM6 block context and table row/column commands aligned with public API; CM6 table rows have baseline visual styles; CM6 `[toc]` renders real heading list with jump support; snippet org-env / math tabstop path avoids old view API; paste/source/snippet public API tests continue migrating to default CM6; CM6 Source/Preview button can dynamically disable/restore live preview; CM6 block and inline widget click returns to source editing; horizontal rule renders; Vim-lite core normal/visual commands hooked into CM6 selection.
- Remaining work: continue filling in CM6 detail regressions and visual polish
- Open blockers: 0

## Test Status

Most recent local test run:

- 2026-05-24: `cd Aaronnote && npm run build:aaronnote`
  - TypeScript and Aaronnote Vite production build passing
- 2026-05-24: `cd Aaronnote && npm test -- copilot-plugin`
  - `tests/copilot-plugin.test.ts` passing, including `Cmd+}` / `Cmd+Shift+]`
    accept-to-character behavior
- 2026-05-19: `cd Aaronnote && npm test`
  - `48` test files passing
  - `628` tests passing
  - No failures
- 2026-05-19: `cd Aaronnote && npm run build -- --mode test`
  - TypeScript and Vite test-mode build passing
- 2026-05-19: `cd Aaronnote && npm test -- tests/cm6/commands.test.ts tests/editor-api.test.ts tests/cm6/roundtrip.test.ts`
  - `3` test files passing
  - `72` tests passing

## Progress Assessment

### Stable

- Markdown → cm-editor → Markdown main loop
- Common inline syntax and several Typora-style extensions
- Feature / spec / test organization conventions
- Site publish and incremental skip logic
- Private content sealing

### Completed but worth watching

- `public/js/data.js` as a static read model is functional, but any field change ripples through site search, the relationship graph, and list rendering.
- The `agent/` maintenance layer is functional, but it depends on correct source-data conventions and maintenance discipline.

### Still evolving

- Broader CommonMark / Typora edge-case compatibility
- Final scope for inline HTML and non-Mermaid diagram families
- Lean UI polish around the official Infoview, outline, and child-editor
  ergonomics
- Further decoupling between editor styles and the application shell
- Large-file performance; see [performance-optimization.md](performance-optimization.md) for the ledger

## Known Bugs

These are real bugs / compatibility gaps, not just unimplemented features.

1. **Reference-link definition lost on reload**
   Symptom: `[id]: url` can be committed as a block during live entry, but on reload the definition node is consumed by `markdown-it`.
   Impact: Reference-style link round-trip and editing experience are incomplete.

2. **Link scanner edge cases**
   Symptom: `[text](url)` implementation does not handle nested `]`, escaped `\]`, or hrefs with spaces correctly.
   Impact: Complex link text and some valid Markdown may not round-trip reliably.

3. **Triple emphasis `***...***` / `___...___` rule incomplete**
   Symptom: Only a subset of cases is covered; full rule-of-three is not implemented.
   Impact: Complex nested emphasis results may differ from Typora / CommonMark.

4. **Indented code blocks serialized as fenced code**
   Symptom: Four-space indented code blocks parse correctly but their original form is not preserved.
   Impact: Shape-level round-trip is incomplete.

5. **Backslash escape lacks input-time UX**
   Symptom: Results round-trip correctly, but there is no full interactive support during input.
   Impact: Editing experience is not fully natural.

## Known Limitations

These are explicitly unfinished areas, not bugs.

1. **Inline HTML not enabled**
   Reason: block HTML exists through sanitized `#+begin html ... #+end html`,
   but inline HTML remains disabled until its sanitizer and editing policy are
   explicit.

2. **Lean requires local toolchain state**
   Interactive Lean editing depends on the local Lake project under
   `roam/.lean/`. Publish/PDF export can render static Lean code cells without
   LSP, but goals, hover, completion, and Infoview require the local Lean server.

3. **Diagram families beyond Mermaid/marmind remain partial**
   Mermaid and mindmap-style fences are implemented. Broader diagram aliases
   should be documented as they become real editor and renderer behavior.

## Maintenance Risks

1. **Capability docs may drift from code**
   Lean, diagram, HTML, and Copilot behavior crosses editor widgets, app shell,
   server IPC, desktop preload, and plugins. Public docs need updates whenever
   a convention or keybinding changes.

2. **Publish pipeline is a single-script implementation**
   `bin/publish-site` is already sizeable; adding more fields or export modes will increase maintenance cost.

3. **Data model changes have multiple touch points**
   `roam` metadata, the publish script, `SITE_DATA`, the frontend consumer logic, and AI indexes are all coupled.

## Next Steps

1. **Keep capability documentation aligned with code reality**
   Reconcile README/status/docs whenever editor features, app-only behavior, or
   publish/export behavior diverge.

2. **Write a stable data contract for the publish layer**
   At minimum, lock down `SITE_DATA` field meanings and compatibility boundaries.

3. **Split `bin/publish-site` into pure-function modules**
   Candidates: metadata parsing, link graph, privacy sealing, render/export.

4. **Define the product boundary for math and diagram support**
   Code, dependencies, and the README currently have minor misalignments.

5. **Continue converging large-file performance per the ledger**
   Prioritize the input critical path, decoration block cache, background Roam indexing, and viewport rendering. Update [performance-optimization.md](performance-optimization.md) after each change.
