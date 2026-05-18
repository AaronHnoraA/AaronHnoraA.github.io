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

  test("does not export unsafe live link hrefs", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "[bad](javascript:alert(1))" });
    try {
      const html = editor.getHTML();
      expect(html).toContain("<a>bad</a>");
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain("data-unsafe-href");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });
});

describe("editor api commands and writing modes", () => {
  test("runs inline formatting commands against the rendered editor", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "hello" });
    try {
      editor.setSelection(1, 6);
      expect(editor.runCommand("bold")).toBe(true);
      expect(editor.getMarkdown()).toBe("**hello**");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("applies writing mode classes without changing markdown", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "one\n\ntwo" });
    try {
      editor.setWritingMode({ focusMode: true, typewriterMode: true });
      expect(mount.querySelector(".typora-web-focus-mode")).toBeTruthy();
      expect(mount.querySelector(".typora-web-typewriter-mode")).toBeTruthy();
      expect(editor.getMarkdown()).toBe("one\n\ntwo");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });
});
