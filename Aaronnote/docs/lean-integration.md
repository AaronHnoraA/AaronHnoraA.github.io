# Lean 4 Integration

Aaronnote embeds Lean 4 through markdown placeholders that point into the
note's mirrored Lean file. Markdown stays compact and readable, while Lean code
lives in real `.lean` files inside the notes root's `.lean/` Lake project.

## Realtime Status

- [x] Product direction locked: use `@@lean4 [tag]`, not `#+begin lean4`.
- [x] Storage direction locked: one Markdown note maps to one mirror `.lean` file.
- [x] Region direction locked: a Lean region starts at `-- @aaronnote <tag>` and ends at the next Aaronnote tag or EOF.
- [x] Region parser and mirror-file helpers implemented.
- [x] Server IPC added for ensure/read/update tagged Lean regions.
- [x] CM6 placeholder widget renders embedded Lean editors as isolated block widgets.
- [x] Insert command and `Cmd/Ctrl+Shift+L` shortcut added.
- [x] Old org-env Lean LSP sync path disabled for Markdown notes.
- [x] LSP diagnostics/goals/hover/completion/semantic tokens remapped from full Lean file positions into embedded regions.
- [x] Lean input abbreviations imported from `lean4-mode` and scoped to the embedded Lean editor.
- [x] Embedded editor syntax highlighting uses Lean Tree-sitter/WASM via `@arborium/lean`, with Lean LSP semantic tokens layered on top when available.
- [x] Embedded editor has Lean-local Tab/Shift-Tab indentation and a child-editor Vim layer; outer Markdown Vim/ranger bindings do not receive those keys.
- [x] Lean LSP diagnostics render both inline underlines and a dedicated child-editor gutter marker.
- [x] `roam/Makefile` provides Lean project operations: `make update`, `make cache`, `make build`, `make clean`, and `make info`.
- [x] Notes page includes a Lean tab for project/toolchain/package info and manual project commands.
- [x] Left Lean panel split into resizable LSP messages and Infoview panes with per-note runtime layout memory.
- [x] Embedded editor keyboard events are isolated from outer Markdown/Vim handling.
- [x] Lean panel restart/stop controls work with active `@@lean4 [tag]` regions.
- [x] Parser/region unit tests added.
- [x] Verified after isolation fix with `npx tsc --noEmit` and targeted Lean/CM6 tests.

Update this section whenever an implementation stage lands.

## User Model

Markdown contains only a Lean placeholder:

```markdown
The following Lean fragment proves the local claim.

@@lean4 [group-cancel]
```

For a Markdown note:

```text
roam/math/group.md
```

Aaronnote derives the Lean file:

```text
roam/.lean/math/group.lean
```

The Lean file contains ordinary Lean source plus Aaronnote tag markers:

```lean
import Mathlib

variable (G : Type*) [Group G]

-- @aaronnote group-cancel
example (a b : G) : a * b * b⁻¹ = a := by
  simp

-- @aaronnote second-fragment
#check Nat
```

The `group-cancel` region is everything after `-- @aaronnote group-cancel`
until the next `-- @aaronnote ...` marker or EOF. Content before the first tag is
file prelude and is not rendered as an embedded block.

## Editing Experience

- In markdown preview mode, a whole-line `@@lean4 [tag]` is replaced by an embedded Lean editor.
- The embedded editor edits the matching region in the derived `.lean` file, not
  the Markdown document.
- The Markdown document keeps only the placeholder text.
- The embedded editor is mounted as a block widget with Shadow DOM isolation, so
  the outer Markdown CM6 styles and event handling do not drive the inner editor.
- Cursor movement inside the embedded editor drives Lean hover, diagnostics, goals,
  expected type, semantic tokens, and the left Infoview panel.
- The left Lean panel is split vertically: LSP diagnostics/messages are on top,
  Infoview goals and expected type are below. The panel width and the middle
  split are draggable and remembered per note for the current app session.
- Keyboard input while the embedded Lean editor is focused is consumed by the
  child editor and is not forwarded to the outer Markdown editor or Vim layer.
- Lean LSP is opened only for real derived `.lean` files. Markdown text is never
  sent to Lean. Notes without Lean placeholders do not start Lean, and switching
  away stops the active Lean process for the previous region.
- The embedded editor uses Lean-only behavior: completion comes from Lean LSP
  `textDocument/completion`, syntax color comes from Lean Tree-sitter plus Lean
  semantic tokens, and Lean symbol input uses the `lean4-mode` abbreviation
  table. Markdown and TeX modes do not provide snippets or completion inside
  this editor.
- The embedded editor owns basic editing behavior: Tab inserts/indents inside
  Lean, Shift-Tab unindents, Enter keeps indentation, and Escape enters a
  Lean-local Vim normal mode with basic movement, delete/yank/paste, visual
  selection, undo/redo, and line opening commands.
- When completion is open, ArrowUp/ArrowDown/PageUp/PageDown/Enter/Tab and
  `Cmd/Ctrl+1..9` select or accept Lean LSP candidates inside the popup. These
  keys are not forwarded to the outer Markdown editor.
- If the tag is missing, the widget shows a missing-region state and can create
  the marker in the derived Lean file.

## Insert Flow

The command palette exposes `Insert Lean block`.

Shortcut:

```text
Cmd/Ctrl+Shift+L
```

Default behavior:

1. Derive the current note's mirror Lean file.
2. Create the file if it does not exist.
3. Generate a unique tag, for example `lean-20260523-143012`.
4. Append `-- @aaronnote <tag>` to the Lean file.
5. Insert `@@lean4 [<tag>]` into Markdown at the cursor.
6. Focus the embedded Lean editor for that tag.

## LSP Lifecycle

- Aaronnote starts `lake serve` in `roam/.lean/`.
- Project maintenance is explicit. The notes root has a `Makefile` with `update`,
  `cache`, `build`, `clean`, and `info` targets. The Notes → Lean page runs those
  targets on demand and shows Lean/Lake version, toolchain, Lake project path,
  and manifest packages.
- Aaronnote does not run `lake build` or automatically repair Mathlib/ProofWidgets
  caches during editor startup. When Lean reports stale widgets or missing
  artifacts, use Notes → Lean → Cache, which runs `make cache` (`lake exe cache get`).
- Each note opens its derived real `.lean` file as the LSP document.
- Region edits update the full Lean file text and send `textDocument/didChange`
  for the real file URI.
- Diagnostics and progress notifications are stored by full Lean file URI, then
  projected into embedded editors by region offsets.
- Goal and hover requests convert region-local cursor positions to full-file Lean
  positions before calling Lean LSP.
- Completion requests use the same full-file position mapping and preserve LSP
  `insertText`, `filterText`, details, and documentation in the popup.
- Tree-sitter/WASM highlights the child editor immediately. Semantic token
  notifications are filtered to the active region and layered into the child
  editor when Lean LSP publishes them. There is no handwritten Lean parser in
  the placeholder path.

## Implementation Plan

1. Add pure tagged-region helpers:
   - derive mirror Lean path from Markdown path;
   - scan `-- @aaronnote <tag>` markers;
   - read, create, update, and locate sequential regions;
   - convert region-local offsets to full-file offsets and back.
2. Add server IPC actions:
   - `ensure-region`;
   - `read-region`;
   - `update-region`;
   - `open-region-file`;
   - `get-region-meta`.
3. Add renderer API wrappers for those IPC actions.
4. Replace the Lean CM6 markdown behavior:
   - scan whole-line `@@lean4 [tag]` placeholders;
   - render an isolated block widget containing the embedded Lean editor;
   - sync child editor changes to the real Lean region;
   - keep parent Markdown unchanged.
5. Rewire Lean panel and LSP mapping:
   - active Lean context becomes `(notePath, leanPath, tag, region offsets)`;
   - hover/goals use full-file Lean positions;
   - diagnostics and semantic tokens are filtered and displayed per active region;
   - completion uses Lean LSP only.
6. Add command palette and shortcut support for inserting a new Lean placeholder.
7. Disable the old `#+begin lean4` LSP path once the placeholder flow is usable.
8. Keep migrating interaction details from `~/.config/emacs/elpa/lean4-mode/`:
   - InfoView debounce and section layout from `lean4-info.el`;
   - Lean input abbreviations from `lean4-input.el`;
   - project root/toolchain rules from `lean4-mode.el` and `lean4-lake.el`.

## Tests

- Unit tests for `@@lean4 [tag]` scanning.
- Unit tests for tagged Lean region parsing and update.
- Server tests for creating and updating mirror Lean regions.
- CM6 tests for rendering placeholders as embedded Lean editors.
- Shortcut/command tests for inserting a new placeholder.
- LSP mapping tests for converting diagnostics and goals between full-file and
  region-local positions.
- Regression tests that `@@todo` and `@@tag` behavior is unchanged.

## Deprecated Behavior

The old `#+begin lean4 ... #+end lean4` model is deprecated. New Lean content
must use `@@lean4 [tag]`. Existing org-env Lean support should not remain a
second long-term LSP path.
