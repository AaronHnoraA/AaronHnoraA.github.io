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
    snippet/
      markdown-mode/
        slide
        slide-gconfig
        slide-lconfig
  assignment/
    index.css
    index.js
```

For a note with `kind: slides`, Aaronnote lazily loads:

- `/kinds/slides/index.css`
- `/kinds/slides/index.js`

Published note pages include the same files when they exist.

## Kind Snippets

Kind-specific snippets live next to the kind assets:

```text
kinds/<kind>/snippet/<mode>/<snippet-file>
```

They use the same snippet file format as `Aaronnote/snippets`:

```text
# -*- mode: snippet -*-
# name: Slide heading
# key: slide
# group: slides
# --
# ${1:Slide title}

$0
```

The server scans these snippets together with the global snippet directory and marks them with `kind: <kind>`. The editor only offers a kind snippet when the current note has the matching `kind`; normal global snippets remain available everywhere.

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

## Shared Helper

For most kind modules, use the shared helper so setup is re-run after the editor or published page DOM is actually ready:

```js
import { defineKind } from "../_shared/kind.js";

export default defineKind("assignment", ({ surface }) => {
  surface?.classList.add("assignment-kind");
  return () => surface?.classList.remove("assignment-kind");
});
```

`defineKind(kind, mount)` handles:

- initial setup
- `aaronnote:kind-ready` when another note with the same kind opens
- delayed rebuilds after the page/editor DOM settles
- cleanup when leaving the kind

The `mount` callback receives:

- `surface`: the rendered `.ProseMirror` / published `#content` element
- `context`: Aaronnote's raw kind context
- `onCleanup(fn)`: register extra cleanup callbacks
- `rebuild()`: schedule a rebuild if your kind changes the DOM asynchronously
- `observe(target?, options?)`: observe DOM changes and rebuild automatically

## Pitfalls

In Markdown preview, Aaronnote hides the top-level `#+begin meta` block for notes whose `kind` is not `default`. The metadata is still read from the source and remains editable in Source mode; kind CSS/JS should treat the rendered surface as note content only.

Do not assume the rendered note DOM is stable at the exact moment `setup()` first runs. Aaronnote may still be replacing the ProseMirror DOM, and published pages may still be finishing module execution. A kind that scans headings only once can silently see zero or one slide, then leave the page looking like normal Markdown.

For DOM-driven kinds:

- use `defineKind`, or manually listen for `aaronnote:kind-ready`
- rebuild after at least one animation frame
- use `observe()` if the editor can replace child blocks
- restore anything you hide or insert in cleanup

Do not make the metadata parser accept malformed one-line meta as a workaround. The source should stay as normal multi-line metadata:

```md
#+begin meta
title: Example
kind: slides
#+end meta
```

If rendering or editing turns that into `title: Example kind: slides`, fix the rendering/editor path instead of teaching kind loading to parse the broken form.

## Slides

Slides notes can be normal roam notes or standalone Markdown files opened from outside `roam/`. A standalone Desktop demo works as long as its metadata contains `kind: slides`; it does not need an `id` field.

The `slides` kind keeps the `h1`-driven split behavior:

- each top-level `# Heading` starts a new slide
- `---` can still force a split without a new heading
- metadata and slides config blocks are hidden from the rendered deck

Slides also understands hidden Org config blocks:

```md
#+begin slideGConfig
toc: true
title-position: top
title-align: left
css:
  body[data-note-kind="slides"] .ProseMirror h1 { color: #b42318; }
#+end slideGConfig
```

`slideGConfig` applies to the whole deck. `slideLConfig` or `Lconfig` applies to the slide where the block appears and overrides global values. Supported keys:

- `toc`: `true` or `false`
- `title-position`: `top`, `center`, `middle`, `bottom`, `left`, or `right`
- `title-align`: `left`, `center`, or `right`
- `css`: raw CSS inserted into the slide runtime style; local CSS is only active while that slide is active

The `slides` kind currently ships three snippets:

- `slide`: insert a new `#` slide heading
- `sgc`: insert a `slideGConfig` block
- `slc`: insert a `slideLConfig` block

The starter `assignment` kind is present as a placeholder and does nothing yet.
