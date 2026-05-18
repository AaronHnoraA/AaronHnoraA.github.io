import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { renderMarkdownHTML } from "../src/render-html.ts";

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
});
