import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import type { Node as PMNode } from "prosemirror-model";

import { createEditor, normalizePastedSourceText, type Editor } from "../src/editor-api.ts";

function findFirstNode(editor: Editor, typeName: string): { node: PMNode; pos: number } {
  let found: { node: PMNode; pos: number } | null = null;
  editor.view.state.doc.descendants((node, pos) => {
    if (found || node.type.name !== typeName) return true;
    found = { node, pos };
    return false;
  });
  expect(found).toBeTruthy();
  return found!;
}

function selectFirstCell(editor: Editor, bodyOnly = false): { node: PMNode; pos: number } {
  let found: { node: PMNode; pos: number } | null = null;
  editor.view.state.doc.descendants((node, pos) => {
    if (found || node.type.name !== "table_cell") return true;
    if (bodyOnly && node.attrs.header === true) return true;
    found = { node, pos };
    return false;
  });
  expect(found).toBeTruthy();
  editor.setSelection(found!.pos + 1);
  return found!;
}

function tableShape(editor: Editor): { rows: number; cols: number[] } {
  const table = findFirstNode(editor, "table").node;
  const cols: number[] = [];
  for (let row = 0; row < table.childCount; row++) {
    cols.push(table.child(row).childCount);
  }
  return { rows: table.childCount, cols };
}

function pasteClipboard(editor: Editor, text: string, html = ""): void {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
    clipboardData: Pick<DataTransfer, "files" | "getData">;
  };
  Object.defineProperty(event, "clipboardData", {
    value: {
      files: [],
      getData: (type: string) => {
        if (type === "text/plain") return text;
        if (type === "text/html") return html;
        return "";
      },
    },
  });
  editor.view.dom.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
}

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

describe("editor api rendered paste", () => {
  test("parses pasted markdown heading instead of escaping block-start hash", () => {
    const source = "## 1. Graph-Side Definitions";
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      pasteClipboard(editor, source);
      expect(editor.getMarkdown()).toBe(source);
      const heading = editor.view.state.doc.child(0);
      expect(heading.type.name).toBe("heading");
      expect(heading.attrs.level).toBe(2);
      expect(heading.textContent).toBe("1. Graph-Side Definitions");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("prefers markdown-looking plain text over escaped clipboard html", () => {
    const source = String.raw`## 1. Graph-Side Definitions

For graphs $G$ and $H$, the graph isomorphism problem asks whether there exists a bijection between their vertex sets preserving adjacency. I write

$$
\mathrm{GI}
=
\{(G,H) : G \cong H\}.
$$

The automorphism group of a graph $G$ is

$$
\operatorname{Aut}(G)
=
\{\varphi \in S_n : \varphi(G) = G\}.
$$`;
    const html = `<div>${source.replaceAll("\n", "<br>")}</div>`;
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      pasteClipboard(editor, source, html);
      expect(editor.getMarkdown()).toBe(source);
      expect(editor.view.state.doc.child(0).type.name).toBe("heading");
      const mathBlocks: PMNode[] = [];
      editor.view.state.doc.descendants((node) => {
        if (node.type.name === "math_block") mathBlocks.push(node);
        return true;
      });
      expect(mathBlocks).toHaveLength(2);
      expect(mathBlocks[0]!.textContent).toContain(String.raw`\mathrm{GI}`);
      expect(mathBlocks[1]!.textContent).toContain(String.raw`\operatorname{Aut}`);
      editor.setSelection(1 + "1. Graph-Side Definitions".length);
      editor.insertText("!");
      expect(editor.getMarkdown()).toBe(source.replace("1. Graph-Side Definitions", "1. Graph-Side Definitions!"));
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("uses clipboard html when plain text is not markdown source", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      pasteClipboard(editor, "Title\nPlain body", "<h2>Title</h2><p>Plain body</p>");
      expect(editor.getMarkdown()).toBe("## Title\n\nPlain body");
      expect(editor.view.state.doc.child(0).type.name).toBe("heading");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });
});

describe("editor api source preservation", () => {
  test("preview/source toggles do not rewrite TeX or markdown escapes", () => {
    const source = String.raw`My current task mentions $\mathrm{GI}$, $\#\mathrm{GA}$, and $a_b$.

$$
\#\mathrm{GI}(G,H)
=
|\operatorname{Iso}(G,H)|
$$`;
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: source });
    try {
      expect(editor.getMarkdown()).toBe(source);
      editor.toggleSource();
      expect(editor.getMarkdown()).toBe(source);
      editor.toggleSource();
      expect(editor.getMarkdown()).toBe(source);
      editor.toggleSource();
      expect(editor.getMarkdown()).toBe(source);
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("source-to-preview keeps display math body raw", () => {
    const source = String.raw`$$
\#\begin{array}{ccccc}
d\mathrm{GA} & \le_p & \mathrm{GI} & \le_p & \mathrm{GA} \\
\downarrow & & \downarrow & & \downarrow \\
d\mathrm{TA} & \overset{?}{\le_p} & \mathrm{TI} & \le_p & \mathrm{cTA}
\end{array}
$$`;
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      editor.toggleSource();
      editor.insertText(source);
      expect(editor.getMarkdown()).toBe(source);
      editor.toggleSource();
      expect(editor.getMarkdown()).toBe(source);
      const mathBlock = findFirstNode(editor, "math_block").node;
      expect(mathBlock.textContent).toBe(source.split("\n").slice(1, -1).join("\n"));
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("typing a display math block in preview does not cache escaped TeX", () => {
    const open = String.raw`$$
\#\begin{array}{c}
d\mathrm{GA} & \le_p & \mathrm{GI} \\`;
    const close = String.raw`
\end{array}
$$
`;
    const source = open + close;
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      editor.insertText(open);
      editor.insertText(close);
      expect(editor.getMarkdown()).toBe(source.trimEnd());
      editor.toggleSource();
      expect(editor.getMarkdown()).toBe(source.trimEnd());
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("preview display math commit follows line fences before following text", () => {
    const source = String.raw`intro
$$
\#\begin{array}{c}
x
\end{array}
$$
outro`;
    const expected = String.raw`intro

$$
\#\begin{array}{c}
x
\end{array}
$$

outro`;
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      editor.insertText(source);
      expect(editor.getMarkdown()).toBe(expected);
      expect(editor.view.state.doc.childCount).toBe(3);
      expect(editor.view.state.doc.child(0).type.name).toBe("paragraph");
      expect(editor.view.state.doc.child(1).type.name).toBe("math_block");
      expect(editor.view.state.doc.child(1).textContent).toBe(source.split("\n").slice(2, -2).join("\n"));
      expect(editor.view.state.doc.child(2).type.name).toBe("paragraph");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("rendered edits do not rewrite math source", () => {
    const source = String.raw`intro

$$
\begin{array}{c}
d\mathrm{GA} \le_p \mathrm{GI}
\end{array}
$$

inline $\#\operatorname{Aut}(G)$`;
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: source });
    try {
      editor.setSelection(1 + "intro".length);
      editor.insertText(" updated");
      expect(editor.getMarkdown()).toBe(source.replace("intro", "intro updated"));
    } finally {
      editor.destroy();
      mount.remove();
    }
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

  test("reports current block context for block menus", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "# Title\n\nbody" });
    try {
      editor.setSelection(3);
      const heading = editor.getBlockContext();
      expect(heading.type).toBe("heading");
      expect(heading.text).toBe("Title");
      expect(heading.commands).toContain("insert-table");

      editor.setSelection(editor.view.state.doc.content.size);
      const paragraph = editor.getBlockContext();
      expect(paragraph.type).toBe("paragraph");
      expect(paragraph.text).toBe("body");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("resolves and runs built-in quick insert items", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      const table = editor.getQuickInsertItems("table").find((item) => item.command === "insert-table");
      expect(table).toBeTruthy();
      expect(editor.runQuickInsert(table!)).toBe(true);
      expect(editor.getMarkdown()).toContain("| Column 1 | Column 2 |");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("supports app-provided quick insert items", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "" });
    try {
      const unregister = editor.registerQuickInsertProvider(({ query }) =>
        query === "lemma"
          ? [{
              id: "lemma",
              label: "Lemma block",
              markdown: "#+begin lemma\n\n#+end lemma",
            }]
          : [],
      );
      const item = editor.getQuickInsertItems("lemma").find((candidate) => candidate.id === "lemma");
      expect(item).toBeTruthy();
      expect(editor.runQuickInsert(item!)).toBe(true);
      expect(editor.getMarkdown()).toContain("#+begin lemma");
      unregister();
      expect(editor.getQuickInsertItems("lemma").some((candidate) => candidate.id === "lemma")).toBe(false);
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("narrows quick insert items to table commands inside a table cell", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, {
      initialContent: "| A | B |\n| --- | --- |\n| 1 | 2 |",
    });
    try {
      selectFirstCell(editor, true);
      const context = editor.getBlockContext();
      expect(context.type).toBe("table_cell");
      expect(context.commands).toEqual([
        "table-insert-row",
        "table-insert-column",
        "table-delete-row",
        "table-delete-column",
      ]);

      const commands = editor.getQuickInsertItems("").map((item) => item.command);
      expect(commands).toEqual([
        "table-insert-row",
        "table-insert-column",
        "table-delete-row",
        "table-delete-column",
      ]);
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("runs table row and column commands from the public api", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, {
      initialContent: "| A | B |\n| --- | --- |\n| 1 | 2 |",
    });
    try {
      selectFirstCell(editor, true);
      expect(tableShape(editor)).toEqual({ rows: 2, cols: [2, 2] });

      expect(editor.runCommand("table-insert-row")).toBe(true);
      expect(tableShape(editor)).toEqual({ rows: 3, cols: [2, 2, 2] });

      expect(editor.runCommand("table-insert-column")).toBe(true);
      expect(tableShape(editor)).toEqual({ rows: 3, cols: [3, 3, 3] });

      expect(editor.runCommand("table-delete-column")).toBe(true);
      expect(tableShape(editor)).toEqual({ rows: 3, cols: [2, 2, 2] });

      expect(editor.runCommand("table-delete-row")).toBe(true);
      expect(tableShape(editor)).toEqual({ rows: 2, cols: [2, 2] });
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("offers copy code only from code block context", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount, { initialContent: "```ts\nconst x = 1;\n```" });
    try {
      const code = findFirstNode(editor, "code_block");
      editor.setSelection(code.pos + 1);
      const commands = editor.getQuickInsertItems("").map((item) => item.command);
      expect(commands).toContain("copy-code");
      expect(commands).toContain("code-block");
      expect(commands).not.toContain("insert-table");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });
});
