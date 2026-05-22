# Aaronnote

A Typora-style Markdown editor built on CodeMirror 6.

## State Model

Markdown source is the runtime document. The live editor authority is the CM6
`EditorState`: document text, selection, compartments, extensions, history, and
decorations. Rendered preview behavior is implemented with Lezer Markdown syntax
trees plus CM6 decorations/widgets; it must not depend on a parallel document
model.

Source mode and preview mode are both CM6 surfaces. `editor.toggleSource()`
switches the live-preview compartments on and off instead of swapping to a
separate editor implementation.

## Core Files

| File | Responsibility |
|---|---|
| `src/lib.ts` | Public library API. |
| `src/editor-api.ts` | Stable `createEditor()` facade and controller types. |
| `src/cm6/editor-cm6.ts` | CM6 `EditorView` construction and public editor methods. |
| `src/cm6/live-preview.ts` | Inline Markdown preview decorations and line classes. |
| `src/cm6/commands.ts` | Editing commands, block context, and quick insert registry. |
| `src/cm6/widgets/*.ts` | Math, code fence, image, task, TOC, org-env, and related widgets. |
| `src/render-html.ts` | Shared Markdown-to-HTML export/publish renderer. |
| `src/styles/*.css` | CM6 editor chrome and swappable Markdown themes. |

## Invariants

1. Markdown source offsets are the stable cross-system coordinate space.
2. Public API methods should mutate the CM6 document with transactions whenever
   possible, preserving selection and history.
3. Preview widgets are views over source text. They must map clicks/commands back
   to source ranges rather than storing independent state.
4. Shared behavior belongs in `src/`; app shell code under `aaronnote/` should use
   the public editor facade instead of reaching into widget internals.
5. Styles should target `.cm-editor` and CM6/widget classes. Do not add legacy
   editor compatibility selectors.

## Testing

Use focused tests first:

```sh
npm test -- tests/editor-api.test.ts tests/cm6/roundtrip.test.ts tests/cm6/commands.test.ts
```

For broader changes, run the full suite from `Aaronnote/`:

```sh
npm test
```
