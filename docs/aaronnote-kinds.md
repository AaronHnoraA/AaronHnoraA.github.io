# Aaronnote Kinds

Aaronnote notes can opt into page-specific behavior with the `kind` field in Markdown metadata.

```md
#+begin meta
title: Slides Kind Demo
date: 2026-05-18
kind: slides
tags: demo
#+end meta
```

If `kind` is missing or set to `default`, Aaronnote loads no extra assets. Legacy `kind: note` is also treated as `default`.

## Asset Layout

Custom kind assets live under the workspace root:

```text
kinds/
  slides/
    index.css
    index.js
  assignment/
    index.css
    index.js
```

For a note with `kind: slides`, Aaronnote lazily loads:

- `/kinds/slides/index.css`
- `/kinds/slides/index.js`

Published note pages include the same files when they exist.

## JavaScript Contract

`index.js` can export a default function or a named `setup` function.

```js
export default function setup(context) {
  // context.kind, context.file, context.note, context.content
  // context.editor, context.host, context.root in the editor app
  // context.article on published pages
  return () => {
    // optional cleanup when leaving this kind
  };
}
```

Aaronnote dispatches `aaronnote:kind-ready` after a kind is active. Reusable kind modules should listen for it if they need to rebuild when another note with the same kind opens.

## Slides Demo

The current demo is:

```text
roam/demo/slides-kind-demo.md
```

It intentionally has no `id` field. The editor can still open it, and the `slides` kind creates a minimal deck by splitting the rendered note at each top-level heading.

The starter `assignment` kind is present as a placeholder and does nothing yet.
