# Aaronnote HTML Controls

## Layout Attrs

Append a trailing `{...}` block to control image, table, and diagram layout in the editor and in published output. Images use same-line attrs:

```md
![diagram](./images/arch.svg){w: 90%; align: center}
![portrait](./images/photo.jpg){w: 220px; wrap: right}
![icon](./icon.png){w: 48; h: 48}
```

Tables and supported diagram fences (`mermaid`, `mindmap`, `marmind`, `markmind`) use a standalone attrs line immediately after the block:

````md
| A | B |
| --- | --- |
| 1 | 2 |
{size: 75%; align: right}

```marmind
Root
  Branch
    Detail
```
{size: 180%; align: left; wrap: on}
````

`marmind` / `markmind` accept plain indented trees and Markdown-ish lists. Aaronnote adds the Mermaid `mindmap` header automatically unless the body already starts with a Mermaid diagram keyword such as `mindmap`, `graph`, or `flowchart`; ordered-list markers are kept in mindmap labels.

Rendered Mermaid diagrams support drag panning, ctrl/meta+wheel zoom, double-click reset, node selection highlighting, and safe SVG link clicks through the normal Aaronnote link opener. `marmind` / `markmind` render as static Aaronnote-styled mindmaps.

Supported keys (any order, `;` or `,` separator, values quoted or unquoted):

| Key | Aliases | Accepted values |
| --- | --- | --- |
| `align` | `position`, `pos` | `left` `l`, `center` `c` `middle`, `right` `r` |
| `wrap` | `float` | `true` `1` `yes` `on` `wrap`, `false` `0` `no` `off`, or a side `left` `right` |
| `width` | `w`, `size` | Number (treated as px), CSS unit, or percentage including values over `100%` |
| `height` | `h` | Number (treated as px) or CSS unit |

Rules:
- `wrap: true` with no `align` defaults to right-floating.
- `wrap: center` is treated as non-wrap.
- Bare numbers become `px` (e.g. `w: 200` → `200px`).
- Unknown keys in the block are silently ignored; the block is only consumed if at least one recognized layout key is present.

The attrs block is consumed from the Markdown source in the editor (extending the replaced widget range) and from the token stream in the render pipeline. CSS classes and variables use the `aaronnote-<kind>-*` pattern, where kind is `image`, `table`, or `diagram`; for example `--aaronnote-image-width`, `--aaronnote-table-width`, and `--aaronnote-diagram-width`.

## Note-Level CSS

Use a note-level stylesheet when one note needs layout overrides:

```md
#+begin meta
title: Example
css: /Users/hc/HC/Org/css/example-note.css
#+end meta
```

`css:` must be an absolute local path, `file://` URL, or `http(s)` URL. Aaronnote loads it after the app, editor, published, and kind styles, so normal selectors in that file win by cascade order. Relative paths are ignored.

## HTML Blocks

Put custom markup in an `html` block (use the `html` snippet for quick insertion):

```md
#+begin html
<section class="note-panel">
  <h2>Result</h2>
  <p>Custom HTML content.</p>
</section>
#+end html
```

Aaronnote sanitizes HTML with DOMPurify. Inline event handlers (e.g. `onclick`) and `<script>` tags are stripped. Do styling in the `css:` file; do not rely on script or event-handler behavior inside `html` blocks.

## Useful DOM Shapes

Rendered note surface:

```html
<article id="content" class="cm-editor" data-note-title="Title" data-note-kind="default">
  ...
</article>
```

Meta cover:

```html
<div class="cm-org-env-block org-env-block" data-kind="meta" data-label="Meta">
  <div class="org-env-meta aaronnote-meta-cover">
    <h1 class="aaronnote-meta-title">Title</h1>
    <p class="aaronnote-meta-date">2026-05-22</p>
    <nav class="aaronnote-meta-tags" aria-label="Tags">
      <button class="aaronnote-meta-tag">#tag</button>
    </nav>
  </div>
</div>
```

Image preview (default, centered):

```html
<figure class="cm-image-widget aaronnote-image aaronnote-image-align-center"
        data-aaronnote-layout="image" data-aaronnote-layout-align="center"
        data-aaronnote-image-align="center" data-aaronnote-image-wrap="false">
  <img class="cm-image-render" src="./images/example.png" alt="Caption" />
  <figcaption class="cm-image-caption">Caption</figcaption>
</figure>
```

Image with layout attrs (right-floating, explicit width):

```html
<figure class="cm-image-widget aaronnote-image aaronnote-image-align-right aaronnote-image-wrap"
        style="--aaronnote-image-width: 220px; --aaronnote-image-max-width: none; --aaronnote-image-max-height: none;"
        data-aaronnote-layout="image" data-aaronnote-layout-align="right"
        data-aaronnote-image-align="right" data-aaronnote-image-wrap="true">
  <img class="cm-image-render" src="./images/photo.jpg" alt="Portrait" />
  <figcaption class="cm-image-caption">Portrait</figcaption>
</figure>
```

Task checkbox:

```html
<span class="cm-task-checkbox" role="checkbox" aria-checked="false">
  <span class="checkbox"></span>
</span>
```

Tables:

```html
<div class="cm-table-block cm-table-editable-block aaronnote-table aaronnote-table-align-center"
     data-aaronnote-layout="table" data-aaronnote-layout-align="center">
  <table>
    <thead><tr><th>Column</th></tr></thead>
    <tbody><tr><td>Value</td></tr></tbody>
  </table>
</div>
```

Diagram preview:

```html
<div class="cm-mermaid-block aaronnote-diagram aaronnote-diagram-align-left"
     data-aaronnote-layout="diagram" data-aaronnote-layout-align="left">
  <svg>...</svg>
</div>
```

Org environment:

```html
<org-env-block data-kind="theorem" data-title="Name" data-label="Theorem">
  <span class="org-env-heading">
    <span class="org-env-heading-label">Theorem</span>
    <span class="org-env-heading-title">Name</span>
  </span>
  <div class="org-env-content">
    <p>Body.</p>
  </div>
</org-env-block>
```

## CSS Examples

Raise the global max image width for a note:

```css
.cm-editor {
  --note-image-max: 640px;
}
```

Cap wrap-floating images, tables, or diagrams at a narrower column:

```css
.cm-editor .cm-image-widget.aaronnote-image-wrap {
  --aaronnote-image-width: min(36%, 280px);
}

.cm-editor .cm-table-block.aaronnote-table-wrap {
  --aaronnote-table-width: min(52%, 520px);
}

.cm-editor .cm-mermaid-block.aaronnote-diagram-wrap {
  --aaronnote-diagram-width: min(48%, 460px);
}
```

Right-align all images without attrs (legacy override style):

```css
.cm-editor .cm-image-widget {
  text-align: right;
}
.cm-editor .cm-image-render {
  margin-left: auto;
  margin-right: 0;
}
```

Style a custom HTML panel:

```css
.cm-editor .note-panel {
  border: 1px solid var(--aaron-paper-line);
  background: var(--aaron-paper-soft);
  padding: 12px 14px;
}

.cm-editor .note-panel h2 {
  margin: 0 0 8px;
  font-size: 1rem;
}
```

Style the `aaronnote-html` container that wraps raw `#+begin html` content:

```css
.cm-editor .aaronnote-html {
  border-left: 3px solid var(--aaron-paper-line);
  padding-left: 1rem;
}
```
