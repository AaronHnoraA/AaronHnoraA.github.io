import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { renderMarkdownHTML, renderPublishedNoteHTML } from "../src/render-html.ts";

describe("shared markdown HTML renderer", () => {
  test("renders math and org env blocks with editor DOM", () => {
    const html = renderMarkdownHTML(String.raw`#+begin theorem Spectral
Inline $x+1$.

$$
y^2
$$
#+end theorem`);

    expect(html).toContain("<org-env-block");
    expect(html).toContain('data-kind="theorem"');
    expect(html).toContain("aaronnote-math-inline");
    expect(html).toContain("<math");
    expect(html).toContain("<math-block");
    expect(html).toContain("math-block-rendered");
    expect(html).not.toContain("math-block-source");
    expect(html).not.toContain("<h1");
  });

  test("marks roam core links for special rendering", () => {
    const html = renderMarkdownHTML("[section](roam://node-id@main-heading) and [tag](node-id#anchor)");

    expect(html).toContain('class="aaronnote-roam-link"');
    expect(html).toContain('data-roam-link="true"');
  });

  test("renders meta blocks with the preview cover", () => {
    const html = renderMarkdownHTML([
      "#+begin meta",
      "title: Meta Cover",
      "date: 2026-05-21",
      "tags: preview, internal_tag, #publish",
      "#+end meta",
    ].join("\n"));

    expect(html).toContain('<div class="cm-org-env-block org-env-block" data-kind="meta" data-label="Meta">');
    expect(html).toContain('<div class="org-env-meta aaronnote-meta-cover">');
    expect(html).toContain('<h1 class="aaronnote-meta-title">Meta Cover</h1>');
    expect(html).toContain('<p class="aaronnote-meta-date">2026-05-21</p>');
    expect(html).toContain('<button class="aaronnote-meta-tag">#preview</button>');
    expect(html).toContain('<button class="aaronnote-meta-tag">#publish</button>');
    expect(html).not.toContain("#internal_tag");
  });

  test("renders published notes with the Aaronnote preview shell", () => {
    const html = renderPublishedNoteHTML("Body", {
      title: "Preview Shell",
      group: "QC",
      date: "2026-05-21",
      root: "../",
      kind: "default",
      noteThemeVersion: "test",
    });

    expect(html).toContain('<main class="aaronnote-shell published-note-page" data-note-kind="default">');
    expect(html).toContain('<section class="aaronnote-body">');
    expect(html).toContain('<section class="aaronnote-editor" id="editor">');
    expect(html).toContain('<span class="aaronnote-vim-mode">READ</span>');
    expect(html).toContain("<p>Body</p>");
  });

  test("published notes keep the preview-rendered body", () => {
    const markdown = [
      "#+begin meta",
      "title: Meta Title",
      "date: 2026-05-21",
      "#+end meta",
      "",
      "# Meta Title",
      "",
      "## Body Heading",
    ].join("\n");
    const previewHtml = renderMarkdownHTML(markdown);
    const html = renderPublishedNoteHTML(markdown, {
      title: "Meta Title",
      date: "2026-05-21",
      root: "./",
      kind: "default",
    });

    expect(html).toContain(previewHtml);
    expect(html).toContain('<h1 class="aaronnote-meta-title">Meta Title</h1>');
    expect(html).toContain('data-kind="meta"');
    expect(html).toContain("<h1>Meta Title</h1>");
    expect(html).toContain("<h2>Body Heading</h2>");
    expect(html).not.toContain("published-note-cover");
  });
});
