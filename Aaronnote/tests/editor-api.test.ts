import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { createEditor, normalizePastedSourceText } from "../src/editor-api.ts";

describe("editor api paste normalization", () => {
  test("preserves TeX source instead of command-specific repair", () => {
    const source = String.raw`$$
\begin{array}{ccccc}
d\mathrm{GA} & \le_p & \mathrm{GI} \\
\downarrow
\end{array}
$$`;
    expect(normalizePastedSourceText(source)).toBe(source);
  });

  test("normalizes line endings and literal control escapes only", () => {
    const pasted = "$$\r\n\u0008eta + \u000crac{1}{2}\r\n$$";
    expect(normalizePastedSourceText(pasted)).toBe(String.raw`$$
\beta + \frac{1}{2}
$$`);
  });
});

describe("editor api HTML export", () => {
  test("exports rendered HTML in markdown and source modes", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "# Title\n\n**bold**" });
    try {
      expect(editor.getHTML()).toContain("<h1>Title</h1>");
      expect(editor.getHTML()).toContain("<strong>");
      editor.toggleSource();
      expect(editor.getHTML()).toContain("<h1>Title</h1>");
      expect(editor.getHTML()).toContain("<strong>");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });
});
