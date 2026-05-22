# Status

## Current State

As of 2026-05-19, the repository has a working development pipeline:

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

## CM6 Core

- Current state: **CM6 is the sole runtime core**
- `EditorOptions.kernel` kept for backward call compatibility but the type only accepts `cm6`
- Full test run: 628 passing / 0 failing / 0 skipped
- Recent milestones: CM6 `getHTML()` hooked into the shared HTML export pipeline; CM6 parser switched to GFM-capable `markdownLanguage`; CM6 paste path reuses the kernel-agnostic clipboard helper; CM6 org-env widget body rendered via Markdown HTML renderer (inline math in blocks now parses); Chinese font unified to heading-font priority; CM6 block context and table row/column commands aligned with public API; CM6 table rows have baseline visual styles; CM6 `[toc]` renders real heading list with jump support; snippet org-env / math tabstop path avoids old view API; paste/source/snippet public API tests continue migrating to default CM6; CM6 Source/Preview button can dynamically disable/restore live preview; CM6 block and inline widget click returns to source editing; horizontal rule renders; Vim-lite core normal/visual commands hooked into CM6 selection.
- Remaining work: continue filling in CM6 detail regressions and visual polish
- Open blockers: 0
- Detailed plan: [pm-to-cm-plan.md](pm-to-cm-plan.md)
- Progress log: [pm-to-cm-progress.md](pm-to-cm-progress.md)
- Blockers and open questions: [pm-to-cm-issues.md](pm-to-cm-issues.md)

## Test Status

Most recent local test run:

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
- Final scope for math, HTML, and diagram capabilities
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

1. **HTML block / inline HTML not enabled**
   Reason: Sanitizer policy needs to be decided first.

2. **Math capability scope not fully settled**
   The README still marks math as planned, but the repo already has parser, serializer, render, and editor tests for inline and display math; the capability boundary has not been unified in external documentation.

3. **Diagram fences not formally landed**
   The Mermaid dependency is in the repo, but documentation still treats it as a planned capability.

## Maintenance Risks

1. **`Aaronnote/README.md` capability matrix may drift from code**
   Math / Mermaid dependencies and tests already exist, but the README status descriptions are still stale in places.

2. **Publish pipeline is a single-script implementation**
   `bin/publish-site` is already sizeable; adding more fields or export modes will increase maintenance cost.

3. **Data model changes have multiple touch points**
   `roam` metadata, the publish script, `SITE_DATA`, the frontend consumer logic, and AI indexes are all coupled.

## Next Steps

1. **Align `Aaronnote` public capability documentation with code reality**
   Reconcile "planned / partial" items in the README with the actual implementation state.

2. **Write a stable data contract for the publish layer**
   At minimum, lock down `SITE_DATA` field meanings and compatibility boundaries.

3. **Split `bin/publish-site` into pure-function modules**
   Candidates: metadata parsing, link graph, privacy sealing, render/export.

4. **Define the product boundary for math and diagram support**
   Code, dependencies, and the README currently have minor misalignments.

5. **Continue converging large-file performance per the ledger**
   Prioritize the input critical path, decoration block cache, background Roam indexing, and viewport rendering. Update [performance-optimization.md](performance-optimization.md) after each change.
