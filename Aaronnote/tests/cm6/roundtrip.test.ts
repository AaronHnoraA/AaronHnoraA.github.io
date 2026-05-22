/**
 * Phase 1 — CM6 kernel基础验证。
 *
 * 由于 CM6 doc 即 markdown 源码，round-trip 是结构性保证而非需要额外转换层。
 * 这组测试验证：
 *   1. getMarkdown() 返回 setMarkdown() 传入的内容（无 parse/serialize 失真）
 *   2. insertText / replaceMarkdownRange 的 markdown offset 语义一致
 *   3. undo/redo 工作
 *   4. onChange 回调在内容变化时触发
 *
 * 跑法（依赖安装后）：
 *   cd Aaronnote && npx vp test --run tests/cm6/roundtrip.test.ts
 */

import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import { createEditor } from "../../src/editor-api.ts";
import { markdownHrefAt } from "../../src/cm6/editor-cm6.ts";
import { setKnownRoamRefs } from "../../src/cm6/roam-link-status.ts";
import { createVimLite } from "../../aaronnote/vim-lite.ts";

// All tests in this file require CM6 deps installed.
// Flip `CM6_READY` to `true` after:
//   npm install @codemirror/state @codemirror/view @codemirror/language
//              @codemirror/commands @codemirror/lang-markdown @lezer/markdown
// and add `import { createEditorCM6 } from "../../src/cm6/editor-cm6.ts"` to editor-api.ts.
const CM6_READY = true;

const maybeDescribe = CM6_READY ? describe : describe.skip;

function mountCM6(initialContent = "") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const editor = createEditor(host, { kernel: "cm6", initialContent });
  return { editor, cleanup: () => { editor.destroy(); host.remove(); } };
}

// ---------------------------------------------------------------------------
// getMarkdown / setMarkdown
// ---------------------------------------------------------------------------

maybeDescribe("cm6 kernel: getMarkdown / setMarkdown", () => {
  test("empty initial doc", () => {
    const { editor, cleanup } = mountCM6("");
    expect(editor.getMarkdown()).toBe("");
    cleanup();
  });

  test("preserves plain paragraph", () => {
    const md = "Hello world";
    const { editor, cleanup } = mountCM6(md);
    expect(editor.getMarkdown()).toBe(md);
    cleanup();
  });

  test("preserves heading", () => {
    const md = "# Heading\n\nBody text";
    const { editor, cleanup } = mountCM6(md);
    expect(editor.getMarkdown()).toBe(md);
    cleanup();
  });

  test("preserves bold delimiters verbatim", () => {
    const md = "**bold**";
    const { editor, cleanup } = mountCM6(md);
    expect(editor.getMarkdown()).toBe(md);
    cleanup();
  });

  test("preserves inline math", () => {
    const md = "The value $x = 1$ is given.";
    const { editor, cleanup } = mountCM6(md);
    expect(editor.getMarkdown()).toBe(md);
    cleanup();
  });

  test("does not render prose between stray dollar signs as inline math", () => {
    const md = "$ I like this but it is not math $ and $10 is a price\n\n$plain words are prose$";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    expect(document.querySelector(".cm-math-inline")).toBeNull();
    cleanup();
  });

  test("still renders compact inline TeX after conservative math detection", () => {
    const md = "Try $x^4 + y - 10$, $A \\leq_p B$, and $\\mathrm{GI}$ here.";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    expect(document.querySelectorAll(".cm-math-inline")).toHaveLength(3);
    cleanup();
  });

  test("preserves display math", () => {
    const md = "$$\na^2 + b^2 = c^2\n$$";
    const { editor, cleanup } = mountCM6(md);
    expect(editor.getMarkdown()).toBe(md);
    cleanup();
  });

  test("editing one display math block preserves unrelated math widget DOM", () => {
    const md = "top\n\n$$\na\n$$\n\nmiddle\n\n$$\nb\n$$";
    const { editor, cleanup } = mountCM6(md);

    editor.setMarkdownSelection(md.indexOf("a"));
    const secondBlock = document.querySelector<HTMLElement>(".cm-math-block");
    expect(secondBlock).toBeTruthy();

    editor.insertText("+c");

    expect(document.querySelector(".cm-math-block")).toBe(secondBlock);
    cleanup();
  });

  test("preserves fenced code with lang", () => {
    const md = "```ts\nconst x = 1;\n```";
    const { editor, cleanup } = mountCM6(md);
    expect(editor.getMarkdown()).toBe(md);
    cleanup();
  });

  test("copies fenced code body from the top-right code button", async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          copied = text;
          return Promise.resolve();
        },
      },
    });

    const md = "```ts\nconst x = 1;\n```";
    const { cleanup } = mountCM6(md);
    try {
      const button = document.querySelector<HTMLButtonElement>(".cm-code-copy-button");
      expect(button).toBeTruthy();
      expect(button!.closest(".cm-line")).toBeTruthy();

      button!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(copied.trim()).toBe("const x = 1;");
      expect(copied).not.toContain("```");
      expect(button!.textContent).toBe("Copied");
    } finally {
      cleanup();
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });

  test("setMarkdown replaces entire doc", () => {
    const { editor, cleanup } = mountCM6("old content");
    editor.setMarkdown("# New\n\nnew content");
    expect(editor.getMarkdown()).toBe("# New\n\nnew content");
    cleanup();
  });

  test("setMarkdown to empty string", () => {
    const { editor, cleanup } = mountCM6("something");
    editor.setMarkdown("");
    expect(editor.getMarkdown()).toBe("");
    cleanup();
  });

  test("getHTML renders current markdown through shared export pipeline", () => {
    const { editor, cleanup } = mountCM6("# Title\n\n**bold**\n\n$$\nx+1\n$$");
    const html = editor.getHTML();
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>");
    expect(html).toContain("math-block-rendered");
    cleanup();
  });

  test("org-env body remains normal CM6 markdown with math widgets", () => {
    const md = String.raw`#+begin theorem
Inline $x+1$.

$$
y^2
$$
#+end theorem`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.indexOf("Inline"));
    expect(document.querySelector(".cm-org-env-heading-widget")).toBeTruthy();
    expect(document.querySelector(".cm-org-env-body-line")).toBeTruthy();
    expect(document.querySelector(".cm-math-inline")).toBeTruthy();
    const mathBlock = document.querySelector<HTMLElement>(".cm-math-block");
    expect(mathBlock).toBeTruthy();
    expect(mathBlock!.dataset.orgEnvKind).toBe("theorem");
    expect(mathBlock!.style.getPropertyValue("--org-env-depth")).toBe("0");
    cleanup();
  });

  test("org-env list display math renders as separate CM6 math blocks", () => {
    const md = String.raw`#+begin define
1. Conjugate symmetry 共轭对称性:

   $$
   \langle v,w \rangle
   =
   \overline{\langle w,v \rangle}
   $$

2. Additivity in the first variable 第一变量加法线性:

   $$
   \langle v_1 + v_2, w \rangle
   =
   \langle v_1,w \rangle
   +
   \langle v_2,w \rangle
   $$

3. Homogeneity in the first variable 第一变量齐次线性:

   $$
   \langle \lambda v,w \rangle
   =
   \lambda \langle v,w \rangle
   $$
#+end define`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(0);

    const mathBlocks = Array.from(document.querySelectorAll<HTMLElement>(".cm-math-block"));
    expect(mathBlocks).toHaveLength(3);
    expect(mathBlocks.every((block) => block.dataset.orgEnvKind === "define")).toBe(true);
    expect(mathBlocks.map((block) => block.textContent).join("\n")).not.toContain("$$");
    const firstOpenLine = md.indexOf("   $$");
    const firstCloseLine = md.indexOf("   $$", firstOpenLine + 1);
    expect(Number(mathBlocks[0]!.dataset.cmSourceFrom)).toBe(firstOpenLine);
    expect(Number(mathBlocks[0]!.dataset.cmSourceTo)).toBe(firstCloseLine + "   $$".length);
    expect(document.querySelector("link[data-aaronnote-katex-css]")).toBeTruthy();
    cleanup();
  });

  test("resolves markdown link hrefs at source positions", () => {
    const md = "Go [there](target.md#eq-x), [roam](roam://node-id#eq-x), and https://example.com";
    const { editor, cleanup } = mountCM6(md);

    expect(markdownHrefAt(editor.view.state, md.indexOf("there"))).toBe("target.md#eq-x");
    expect(markdownHrefAt(editor.view.state, md.indexOf("roam]"))).toBe("roam://node-id#eq-x");
    expect(markdownHrefAt(editor.view.state, md.indexOf("https://") + 3)).toBe("https://example.com");

    cleanup();
  });

  test("marks unresolved wikilinks and bare roam links", () => {
    const md = "Known [[Density Operator]], missing [[Ghost Note]], and roam://bad-id.";
    const { editor, cleanup } = mountCM6(md);

    editor.view.dispatch({ effects: setKnownRoamRefs.of(["Density Operator"]) });

    const broken = Array.from(document.querySelectorAll<HTMLElement>(".cm-roam-link-broken"))
      .map((el) => el.textContent);
    expect(broken).toContain("Ghost Note");
    expect(broken).toContain("roam://bad-id");
    expect(broken).not.toContain("Density Operator");
    cleanup();
  });

  test("cmd-click on a markdown link dispatches open-url", () => {
    const md = "Go [there](target.md#eq-x)";
    const { editor, cleanup } = mountCM6(md);
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    const view = editor.view as typeof editor.view & {
      contentDOM: HTMLElement;
      posAtCoords: (coords: { x: number; y: number }) => number | null;
    };
    const originalDescriptor = Object.getOwnPropertyDescriptor(view, "posAtCoords");

    document.addEventListener("aaronnote:open-url", listener);
    Object.defineProperty(view, "posAtCoords", {
      configurable: true,
      value: () => md.indexOf("there"),
    });

    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 1,
      clientY: 1,
      metaKey: true,
    });
    view.contentDOM.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(events[0]?.detail).toEqual({ href: "target.md#eq-x", newWindow: false });

    document.removeEventListener("aaronnote:open-url", listener);
    if (originalDescriptor) Object.defineProperty(view, "posAtCoords", originalDescriptor);
    else delete (view as { posAtCoords?: unknown }).posAtCoords;
    cleanup();
  });

  test("cmd-middle-click on a markdown link dispatches open-url for a new window", () => {
    const md = "Go [there](target.md@heading)";
    const { editor, cleanup } = mountCM6(md);
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    const view = editor.view as typeof editor.view & {
      contentDOM: HTMLElement;
      posAtCoords: (coords: { x: number; y: number }) => number | null;
    };
    const originalDescriptor = Object.getOwnPropertyDescriptor(view, "posAtCoords");

    document.addEventListener("aaronnote:open-url", listener);
    Object.defineProperty(view, "posAtCoords", {
      configurable: true,
      value: () => md.indexOf("there"),
    });

    const event = new MouseEvent("auxclick", {
      bubbles: true,
      cancelable: true,
      button: 1,
      clientX: 1,
      clientY: 1,
      metaKey: true,
    });
    view.contentDOM.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(events[0]?.detail).toEqual({ href: "target.md@heading", newWindow: true });

    document.removeEventListener("aaronnote:open-url", listener);
    if (originalDescriptor) Object.defineProperty(view, "posAtCoords", originalDescriptor);
    else delete (view as { posAtCoords?: unknown }).posAtCoords;
    cleanup();
  });

  test("clicking org-env display math uses the same source opening as outside", () => {
    const md = String.raw`#+begin theorem
Before

$$
y^2
$$
#+end theorem`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(0);
    const math = document.querySelector<HTMLElement>(".cm-math-block");
    expect(math).toBeTruthy();

    math!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    expect(editor.getMarkdownSelection().from).toBe(md.indexOf("y^2"));
    expect(document.querySelector(".cm-math-block")).toBeNull();
    cleanup();
  });

  test("renders markdown table as a directly editable table widget", () => {
    const { cleanup } = mountCM6("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(document.querySelector(".cm-table-block table")).toBeTruthy();
    expect(document.querySelector(".cm-table-toolbar")).toBeTruthy();
    expect(document.querySelectorAll(".cm-table-block td, .cm-table-block th")).toHaveLength(4);
    expect(document.querySelector(".cm-table-block-preview")).toBeNull();
    cleanup();
  });

  test("renders markdown formatting inside table cells before editing", () => {
    const md = "| A | B |\n| --- | ---: |\n| **one** | 2 |\n\nDone";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    const table = document.querySelector<HTMLTableElement>(".cm-table-block table");
    expect(table).toBeTruthy();
    expect(table!.querySelectorAll("th")).toHaveLength(2);
    expect(table!.querySelector("strong")?.textContent).toBe("one");
    expect(table!.querySelector("tbody td:last-child")?.getAttribute("style")).toContain("text-align: right");
    cleanup();
  });

  test("edits table cells directly without a lower preview copy", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.indexOf("1"));
    const cell = document.querySelector<HTMLElement>("tbody td");
    expect(cell).toBeTruthy();
    expect(document.querySelector(".cm-table-block-preview")).toBeNull();
    cell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const input = cell!.querySelector<HTMLInputElement>(".cm-table-cell-input");
    expect(input).toBeTruthy();
    input!.value = "edited";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input!.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(editor.getMarkdown()).toContain("| edited | 2 |");
    cleanup();
  });

  test("opening a table cell keeps editor coordinates fresh", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |\n\nTail";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    const selectionBefore = editor.getMarkdownSelection();
    let measureCount = 0;
    const originalRequestMeasure = editor.view.requestMeasure.bind(editor.view);
    editor.view.requestMeasure = ((...args: Parameters<typeof editor.view.requestMeasure>) => {
      measureCount += 1;
      return originalRequestMeasure(...args);
    }) as typeof editor.view.requestMeasure;

    const cell = document.querySelector<HTMLElement>("tbody td");
    expect(cell).toBeTruthy();
    cell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(editor.getMarkdownSelection()).toEqual(selectionBefore);
    expect(cell!.querySelector<HTMLInputElement>(".cm-table-cell-input")).toBeTruthy();
    expect(measureCount).toBeGreaterThan(0);
    cleanup();
  });

  test("table toolbar inserts rows and columns in markdown", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { editor, cleanup } = mountCM6(md);
    const firstBodyCell = document.querySelector<HTMLElement>("tbody td");
    firstBodyCell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    document.querySelector<HTMLButtonElement>(".cm-table-toolbar button[title='Insert row below']")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(editor.getMarkdown()).toContain("|  |  |");

    document.querySelector<HTMLElement>("tbody td")!.focus();
    document.querySelector<HTMLButtonElement>(".cm-table-toolbar button[title='Insert column right']")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(editor.getMarkdown().split("\n")[0]).toBe("| A |  | B |");
    cleanup();
  });

  test("enter in a table cell commits and moves editing to the next row", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    const { editor, cleanup } = mountCM6(md);
    const firstBodyCell = document.querySelector<HTMLElement>("tbody td");
    firstBodyCell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const input = firstBodyCell!.querySelector<HTMLInputElement>(".cm-table-cell-input");
    expect(input).toBeTruthy();

    input!.value = "edited";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(editor.getMarkdown()).toContain("| edited | 2 |");
    const activeInput = document.activeElement as HTMLInputElement | null;
    expect(activeInput?.classList.contains("cm-table-cell-input")).toBe(true);
    expect(activeInput?.value).toBe("3");
    cleanup();
  });

  test("escape in a table cell cancels editing without committing", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { editor, cleanup } = mountCM6(md);
    const firstBodyCell = document.querySelector<HTMLElement>("tbody td");
    firstBodyCell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const input = firstBodyCell!.querySelector<HTMLInputElement>(".cm-table-cell-input");
    expect(input).toBeTruthy();

    input!.value = "discarded";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(editor.getMarkdown()).toBe(md);
    expect(firstBodyCell!.querySelector(".cm-table-cell-input")).toBeNull();
    expect(firstBodyCell!.textContent).toBe("1");
    cleanup();
  });

  test("tab at the last table cell appends a new row", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { editor, cleanup } = mountCM6(md);
    const lastBodyCell = document.querySelector<HTMLElement>("tbody td:last-child");
    lastBodyCell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const input = lastBodyCell!.querySelector<HTMLInputElement>(".cm-table-cell-input");
    expect(input).toBeTruthy();

    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const activeInput = document.activeElement as HTMLInputElement | null;
    expect(activeInput?.classList.contains("cm-table-cell-input")).toBe(true);
    expect(activeInput?.value).toBe("");
    expect(editor.getMarkdown()).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |\n|  |  |");
    cleanup();
  });

  test("table cell edits preserve deliberate outer spaces", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { editor, cleanup } = mountCM6(md);
    const firstBodyCell = document.querySelector<HTMLElement>("tbody td");
    firstBodyCell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const input = firstBodyCell!.querySelector<HTMLInputElement>(".cm-table-cell-input");
    input!.value = "  spaced  ";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input!.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(editor.getMarkdown()).toContain("|   spaced   | 2 |");
    cleanup();
  });

  test("table toolbar keeps focus on the inserted row cell", async () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { cleanup } = mountCM6(md);
    const firstBodyCell = document.querySelector<HTMLElement>("tbody td");
    firstBodyCell!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    document.querySelector<HTMLButtonElement>(".cm-table-toolbar button[title='Insert row below']")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const activeInput = document.activeElement as HTMLInputElement | null;
    expect(activeInput?.classList.contains("cm-table-cell-input")).toBe(true);
    expect(activeInput?.value).toBe("");
    cleanup();
  });

  test("typing ordinary text above a table preserves the table widget DOM", () => {
    const md = "above\n\n| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { editor, cleanup } = mountCM6(md);
    const tableBlock = document.querySelector<HTMLElement>(".cm-table-block");
    expect(tableBlock).toBeTruthy();

    editor.setMarkdownSelection(0);
    editor.insertText("x");

    expect(document.querySelector(".cm-table-block")).toBe(tableBlock);
    cleanup();
  });

  test("typing ordinary text above mermaid preserves the mermaid widget DOM", () => {
    const md = "above\n\n```mermaid\ngraph TD\nA-->B\n```";
    const { editor, cleanup } = mountCM6(md);
    const mermaidBlock = document.querySelector<HTMLElement>(".cm-mermaid-block");
    expect(mermaidBlock).toBeTruthy();

    editor.setMarkdownSelection(0);
    editor.insertText("x");

    expect(document.querySelector(".cm-mermaid-block")).toBe(mermaidBlock);
    cleanup();
  });

  test("typing a heading marker updates line styling on the changed line", () => {
    const { editor, cleanup } = mountCM6("Title\n\nBody");

    editor.setMarkdownSelection(0);
    editor.insertText("# ");

    expect(document.querySelector(".cm-md-h1")).toBeTruthy();
    cleanup();
  });

  test("typing a code fence marker updates the affected code block line styling", () => {
    const { editor, cleanup } = mountCM6("``\n# Hidden\n```");
    expect(document.querySelector(".cm-md-h1")).toBeTruthy();

    editor.setMarkdownSelection(2);
    editor.insertText("`");

    expect(document.querySelector(".cm-md-h1")).toBeNull();
    expect(document.querySelector(".cm-md-code-block")).toBeTruthy();
    cleanup();
  });

  test("typing inside mermaid source updates the rendered widget source", () => {
    const md = "above\n\n```mermaid\ngraph TD\nA-->B\n```";
    const { editor, cleanup } = mountCM6(md);
    const insertAt = md.indexOf("graph TD") + "graph TD".length;

    editor.setMarkdownSelection(insertAt);
    editor.insertText("X");
    editor.setMarkdownSelection(0);

    const mermaidBlock = document.querySelector<HTMLElement>(".cm-mermaid-block");
    expect(mermaidBlock?.dataset.diagramRenderKey).toContain("graph TDX");
    cleanup();
  });

  test("editing one mermaid block preserves unrelated mermaid widget DOM", () => {
    const md = [
      "```mermaid",
      "graph TD",
      "A-->B",
      "```",
      "",
      "```mermaid",
      "graph TD",
      "C-->D",
      "```",
    ].join("\n");
    const { editor, cleanup } = mountCM6(md);
    const insertAt = md.indexOf("A-->B") + 1;

    editor.setMarkdownSelection(insertAt);
    const secondBlock = document.querySelector<HTMLElement>(".cm-mermaid-block");
    expect(secondBlock).toBeTruthy();

    editor.insertText("X");

    expect(document.querySelector(".cm-mermaid-block")).toBe(secondBlock);
    cleanup();
  });

  test("typing ordinary text above org-env preserves boundary widget DOM", () => {
    const md = "above\n\n#+begin theorem\nBody\n#+end theorem";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    const heading = document.querySelector<HTMLElement>(".cm-org-env-heading-widget");
    expect(heading).toBeTruthy();

    editor.setMarkdownSelection(0);
    editor.insertText("x");

    expect(document.querySelector(".cm-org-env-heading-widget")).toBe(heading);
    cleanup();
  });

  test("editing one org-env title patches only that boundary widget", () => {
    const md = [
      "#+begin theorem One",
      "A",
      "#+end theorem",
      "",
      "#+begin lemma Two",
      "B",
      "#+end lemma",
    ].join("\n");
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);

    const headings = Array.from(document.querySelectorAll<HTMLElement>(".cm-org-env-heading-widget"));
    const secondHeading = headings[1];
    expect(secondHeading).toBeTruthy();

    const from = md.indexOf("One");
    const insert = "Alpha";
    editor.view.dispatch({
      changes: { from, to: from + "One".length, insert },
      selection: { anchor: md.length + insert.length - "One".length },
    });

    const updated = Array.from(document.querySelectorAll<HTMLElement>(".cm-org-env-heading-widget"));
    expect(updated[0]?.querySelector(".org-env-heading-title")?.textContent).toBe("Alpha");
    expect(updated[1]).toBe(secondHeading);
    cleanup();
  });

  test("inserting a newline inside org-env body styles the new body line", () => {
    const md = "#+begin proof\nBody\n#+end proof";
    const { editor, cleanup } = mountCM6(md);

    editor.setMarkdownSelection(md.indexOf("Body") + "Body".length);
    editor.insertText("\nNext");

    expect(document.querySelectorAll(".cm-org-env-body-line")).toHaveLength(2);
    cleanup();
  });

  test("renders horizontal rule lines when cursor leaves the line", () => {
    const { editor, cleanup } = mountCM6("before\n\n---\n\nafter");
    editor.setMarkdownSelection(editor.getMarkdown().length);
    expect(document.querySelector(".cm-horizontal-rule")).toBeTruthy();
    cleanup();
  });

  test("typing a horizontal rule marker updates block extra ranges", () => {
    const { editor, cleanup } = mountCM6("before\n\n--\n\nafter");

    editor.setMarkdownSelection("before\n\n--".length);
    editor.insertText("-");
    editor.setMarkdownSelection(editor.getMarkdown().length);

    expect(document.querySelector(".cm-horizontal-rule")).toBeTruthy();
    cleanup();
  });

  test("renders CM6 toc from document headings and jumps on click", () => {
    const md = "# Title\n\n[toc]\n\n## Child\n\nBody";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    const items = Array.from(document.querySelectorAll<HTMLElement>(".cm-toc .toc-item"));
    expect(items.map((item) => item.textContent)).toEqual(["Title", "Child"]);
    expect(items[1]!.style.getPropertyValue("--toc-depth")).toBe("1");
    items[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(editor.getMarkdownSelection().from).toBe(md.indexOf("Child"));
    cleanup();
  });

  test("clicking an org-env heading reveals only the boundary line", () => {
    const { editor, cleanup } = mountCM6(String.raw`#+begin theorem
Body
#+end theorem`);
    editor.setMarkdownSelection(editor.getMarkdown().length);
    const heading = document.querySelector<HTMLElement>(".cm-org-env-heading-widget");
    expect(heading).toBeTruthy();
    heading!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(editor.getMarkdownSelection().from).toBe("#+begin theorem".length);
    expect(document.querySelector(".cm-org-env-heading-widget")).toBeNull();
    cleanup();
  });

  test("editing an org-env title keeps typing on the open line", () => {
    const md = String.raw`#+begin summary title
Body
#+end summary`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    const heading = document.querySelector<HTMLElement>(".cm-org-env-heading-widget");
    expect(heading).toBeTruthy();
    heading!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(editor.getMarkdownSelection().from).toBe(md.indexOf("title"));

    editor.insertText("ab");
    expect(editor.getMarkdown().split("\n")[0]).toBe("#+begin summary abtitle");
    expect(editor.getMarkdown().split("\n")[1]).toBe("Body");
    cleanup();
  });

  test("org-env body edits through the main CM6 document", () => {
    const md = String.raw`#+begin theorem Spectral
Body line
#+end theorem`;
    const { editor, cleanup } = mountCM6(md);
    const bodyEnd = md.indexOf("\n#+end theorem");
    editor.setMarkdownSelection(bodyEnd);
    editor.insertText("\n\nNext paragraph");

    expect(document.querySelector(".cm-org-env-heading-widget")).toBeTruthy();
    expect(document.querySelectorAll(".cm-org-env-body-line").length).toBeGreaterThan(0);
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent).not.toContain("#+begin");
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent).not.toContain("#+end");
    expect(editor.getMarkdown()).toBe(String.raw`#+begin theorem Spectral
Body line

Next paragraph
#+end theorem`);
    cleanup();
  });

  test("empty org-env body accepts normal insertion between boundary lines", () => {
    const { editor, cleanup } = mountCM6(String.raw`#+begin theorem
#+end theorem`);
    editor.setMarkdownSelection("#+begin theorem\n".length);
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent).not.toContain("#+end");
    editor.insertText("Statement.\n");
    expect(editor.getMarkdown()).toBe(String.raw`#+begin theorem
Statement.
#+end theorem`);
    cleanup();
  });

  test("org-env has no nested content editor", () => {
    const md = String.raw`#+begin proof ada
Proof.
#+end proof`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.indexOf("Proof."));
    expect(document.querySelector(".cm-org-env-content")).toBeNull();
    expect(document.querySelector(".cm-org-env-heading-widget")).toBeTruthy();
    expect(editor.getMarkdown()).toBe(md);
    cleanup();
  });

  test("nested org-env blocks render as nested CM6 chrome", () => {
    const md = String.raw`#+begin proof
outer

#+begin theorem Inner
inside
#+end theorem

#+end proof`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.indexOf("inside"));

    const headings = Array.from(document.querySelectorAll<HTMLElement>(".cm-org-env-heading-widget"));
    expect(headings.map((heading) => heading.dataset.orgEnvKind)).toEqual(["proof", "theorem"]);
    expect(headings[0]!.style.getPropertyValue("--org-env-depth")).toBe("0");
    expect(headings[1]!.style.getPropertyValue("--org-env-depth")).toBe("1");

    const innerBodyLine = Array.from(document.querySelectorAll<HTMLElement>(".cm-org-env-body-line"))
      .find((line) => line.textContent?.includes("inside"));
    expect(innerBodyLine?.dataset.orgEnvDepth).toBe("1");
    cleanup();
  });

  test("dense org-env blocks keep body line chrome on every body line", () => {
    const md = Array.from({ length: 4 }, (_, index) => String.raw`#+begin theorem Block ${index + 1}
Line ${index + 1} one has enough words to exercise wrapped org-env body layout.

Line ${index + 1} two remains normal editable markdown.
#+end theorem`).join("\n\n");
    const { editor, cleanup } = mountCM6(md);
    try {
      editor.setMarkdownSelection(md.length);

      expect(document.querySelectorAll(".cm-org-env-heading-widget")).toHaveLength(4);
      const textBodyLines = Array.from(document.querySelectorAll<HTMLElement>(".cm-org-env-body-line"))
        .filter((line) => line.textContent?.includes("Line "));
      expect(textBodyLines).toHaveLength(8);
      expect(textBodyLines.every((line) => line.dataset.orgEnvDepth === "0")).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("Mod-Enter exits one org-env level at a time", () => {
    const md = String.raw`#+begin proof
outer

#+begin theorem Inner
inside
#+end theorem

#+end proof
outside`;
    const { editor, cleanup } = mountCM6(md);
    const target = (editor.view as unknown as { contentDOM: HTMLElement }).contentDOM;

    function pressModEnter(): void {
      const before = editor.getMarkdownSelection().from;
      target.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }));
      if (editor.getMarkdownSelection().from !== before) return;
      target.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    }

    editor.setMarkdownSelection(md.indexOf("inside"));
    pressModEnter();
    const innerClose = md.indexOf("#+end theorem");
    expect(editor.getMarkdownSelection().from).toBe(innerClose + "#+end theorem\n".length);

    pressModEnter();
    const outerClose = md.indexOf("#+end proof");
    expect(editor.getMarkdownSelection().from).toBe(outerClose + "#+end proof\n".length);
    cleanup();
  });

  test("vim-lite handles org-env through normal editor selection", () => {
    const md = String.raw`#+begin proof
Line one

Line two
#+end proof`;
    const { editor, cleanup } = mountCM6(md);
    const vim = createVimLite(editor, document.body);
    vim.setMode("insert");
    editor.setMarkdownSelection(md.indexOf("Line one"));
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    expect(vim.handleKeyDown(event)).toBe(false);
    expect(document.querySelector(".cm-org-env-body-line")).toBeTruthy();
    cleanup();
  });

  test("meta block edits values without reopening full markdown source", () => {
    const { editor, cleanup } = mountCM6(String.raw`#+begin meta
title: Alpha
tags: one, two
#+end meta`);
    const input = document.querySelector<HTMLInputElement>(".org-env-meta-value[data-key='title']");
    expect(input).toBeTruthy();
    input!.value = "Beta";
    input!.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    expect(editor.getMarkdown()).toContain("title: Beta");
    expect(document.querySelector(".cm-org-env-block[data-kind='meta']")).toBeTruthy();
    cleanup();
  });

  test("clicking a rendered display math block reopens markdown source without bottom preview", () => {
    const md = "before\n\n$$\na+b\n$$\n\nafter";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(0);
    const block = document.querySelector<HTMLElement>(".cm-math-block");
    expect(block).toBeTruthy();
    block!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const selection = editor.getMarkdownSelection();
    expect(selection.from).toBe(md.indexOf("a+b"));
    expect(document.querySelector(".cm-math-block")).toBeNull();
    expect(document.querySelector(".cm-math-block-preview")).toBeNull();
    expect(document.querySelectorAll(".cm-math-source-line")).toHaveLength(3);
    expect(document.querySelectorAll(".syntax-hint").length).toBeGreaterThanOrEqual(2);
    cleanup();
  });

  test("expanded org-env display math is source-only", () => {
    const md = String.raw`#+begin proof
$$
\langle v,w_1+w_2 \rangle
=
\overline{\langle w_1,v \rangle}
+
\overline{\langle w_2,v \rangle}.
$$
#+end proof`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.indexOf("w_1,v"));

    expect(document.querySelector(".cm-math-block")).toBeNull();
    expect(document.querySelector(".cm-math-block-preview")).toBeNull();
    expect(document.querySelectorAll(".cm-math-source-line")).toHaveLength(7);
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain(String.raw`\overline{\langle w_1,v \rangle}`);
    cleanup();
  });

  test("expanded display math suppresses other preview widgets inside org-env", () => {
    const md = String.raw`#+begin proof
$$
\langle \cdot,\cdot \rangle : V \times V \to F.
# Stack
@@todo(done) [sample]{ddl=2026-01-01}
![alt](missing.png)
$x$
$$
#+end proof`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.indexOf("# Stack") + 2);

    expect(document.querySelector(".cm-math-block")).toBeNull();
    expect(document.querySelector(".cm-math-inline")).toBeNull();
    expect(document.querySelector(".cm-md-h1")).toBeNull();
    expect(document.querySelector(".inline-todo-widget")).toBeNull();
    expect(document.querySelector(".cm-image-widget")).toBeNull();
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain("# Stack");
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain("@@todo(done) [sample]{ddl=2026-01-01}");
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain("$x$");
    cleanup();
  });

  test("renders compact inline tags in the left line gutter without inline text", () => {
    const md = "alpha @@tag[qc]\nplain";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);

    const line = document.querySelector<HTMLElement>(".cm-line-has-aaronnote-tags");
    expect(line).toBeTruthy();
    expect(line!.dataset.aaronnoteTags).toBe("#qc");
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .not.toContain("@@tag[qc]");

    editor.setMarkdownSelection(md.indexOf("@@tag") + 2);
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain("@@tag[qc]");
    cleanup();
  });

  test("stacks multiple inline tags in the line gutter", () => {
    const { cleanup } = mountCM6("alpha @@tag[first] @@tag[second]\nplain");
    const line = document.querySelector<HTMLElement>(".cm-line-has-aaronnote-tags");
    expect(line).toBeTruthy();
    expect(line!.dataset.aaronnoteTags).toBe("#first\n#second");
    cleanup();
  });

  test("renders inline todo widgets with a right-side rail", () => {
    const md = "@@todo(doing) [write proof]{ddl=2026-05-20}\nplain";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);

    const todo = document.querySelector<HTMLElement>(".inline-todo-widget");
    expect(todo).toBeTruthy();
    expect(todo!.dataset.status).toBe("doing");
    expect(todo!.textContent).toContain("[write proof]");
    const datePill = todo!.querySelector<HTMLElement>(".inline-todo-date");
    expect(datePill).toBeTruthy();
    expect(datePill!.dataset.key).toBe("ddl");
    expect(datePill!.querySelector(".inline-todo-date-value")!.textContent).toBe("2026-05-20");
    expect(todo!.querySelector(".inline-todo-rail")).toBeTruthy();
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .not.toContain("@@todo");

    editor.setMarkdownSelection(md.indexOf("@@todo") + 2);
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain("@@todo(doing) [write proof]");
    cleanup();
  });

  test("org-env scanner ignores boundary-looking lines inside display math", () => {
    const md = String.raw`#+begin proof
before
$$
#+end proof
$$
after
#+end proof`;
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.indexOf("after"));

    const headings = Array.from(document.querySelectorAll<HTMLElement>(".cm-org-env-heading-widget"));
    expect(headings).toHaveLength(1);
    expect(headings[0]!.dataset.orgEnvKind).toBe("proof");
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain("after");
    cleanup();
  });

  test("ArrowDown and ArrowUp do not force org-env back into source mode", () => {
    const md = "before\n\n#+begin theorem\nBody\n#+end theorem\n\nafter";
    const { editor, cleanup } = mountCM6(md);
    const target = (editor.view as unknown as { contentDOM: HTMLElement }).contentDOM;

    editor.setMarkdownSelection(2);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    expect(document.querySelector(".cm-org-env-heading-widget")).toBeTruthy();

    editor.setMarkdownSelection(md.length);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    expect(document.querySelector(".cm-org-env-heading-widget")).toBeTruthy();
    cleanup();
  });

  test("clicking rendered inline widgets opens their markdown source", () => {
    const md = "before $x+1$ after\n\n- [ ] task\n\n![alt](missing.png)";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);

    const inlineMath = document.querySelector<HTMLElement>(".cm-math-inline");
    expect(inlineMath).toBeTruthy();
    inlineMath!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(editor.getMarkdownSelection().from).toBe(md.indexOf("$x+1$") + 1);
    expect(document.querySelector(".cm-math-inline")).toBeNull();

    editor.setMarkdownSelection(0);
    const image = document.querySelector<HTMLElement>(".cm-image-widget");
    expect(image).toBeTruthy();
    image!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(editor.getMarkdownSelection().from).toBe(md.indexOf("![alt]") + 1);
    cleanup();
  });

  test("image widgets resolve note-relative asset urls through Aaronnote resolver", () => {
    const original = window.AaronnoteResolveAssetUrl;
    window.AaronnoteResolveAssetUrl = (src) => `/api/media?file=${encodeURIComponent(src)}&base=note.md`;
    const { editor, cleanup } = mountCM6("before\n\n![alt](img/example.png)");
    editor.setMarkdownSelection(0);
    const image = document.querySelector<HTMLImageElement>(".cm-image-widget img");
    expect(image).toBeTruthy();
    expect(image!.getAttribute("src")).toBe("/api/media?file=img%2Fexample.png&base=note.md");
    cleanup();
    window.AaronnoteResolveAssetUrl = original;
  });

  test("image widgets render alt text as a caption", () => {
    const md = "![Diagram title](missing.png)\n\ntext";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);
    const caption = document.querySelector<HTMLElement>(".cm-image-caption");
    expect(caption).toBeTruthy();
    expect(caption!.textContent).toBe("Diagram title");
    cleanup();
  });

  test("clicking task checkbox toggles its checked state directly", () => {
    // Use a header line to park the cursor away from both task lines,
    // so both checkboxes render (task-list hides raw marker only on the cursor line).
    const md = "# heading\n\n- [ ] task one\n- [x] task two";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(0); // cursor on heading line

    const checkboxes = document.querySelectorAll<HTMLElement>(".cm-task-checkbox");
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0]!.querySelector(".checkbox")).toBeTruthy();
    expect(checkboxes[1]!.querySelector(".checkbox")?.getAttribute("data-checked")).toBe("1");

    // Click unchecked → checked
    checkboxes[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(editor.getMarkdown()).toContain("- [x] task one");

    // Click checked → unchecked
    checkboxes[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(editor.getMarkdown()).toContain("- [ ] task two");
    cleanup();
  });

  test("renders comment org-env with CM6 comment chip and toggleable popup", () => {
    const md = "#+begin comment reviewer\nHidden **note**\n#+end comment\n\nAfter";
    const { editor, cleanup } = mountCM6(md);
    editor.setMarkdownSelection(md.length);

    const comment = document.querySelector<HTMLElement>('org-env-block[data-kind="comment"]');
    expect(comment).toBeTruthy();
    expect(comment!.classList.contains("cm-org-env-comment-widget")).toBe(true);

    const button = comment!.querySelector<HTMLButtonElement>(".org-env-comment-button");
    const content = comment!.querySelector<HTMLElement>(".org-env-content");
    expect(button?.querySelector(".org-env-comment-label")?.textContent).toBe("reviewer");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(content?.hidden).toBe(true);

    button!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(content?.hidden).toBe(false);
    expect(content?.querySelector("strong")?.textContent).toBe("note");
    expect(comment!.classList.contains("org-env-comment-open")).toBe(true);

    editor.setMarkdownSelection(md.indexOf("Hidden"));
    expect(document.querySelector('org-env-block[data-kind="comment"]')).toBeNull();
    expect((editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.textContent)
      .toContain("Hidden **note**");
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// insertText / replaceMarkdownRange / textBetween
// ---------------------------------------------------------------------------

maybeDescribe("cm6 kernel: text mutations", () => {
  test("insertText appends at cursor", () => {
    const { editor, cleanup } = mountCM6("hello");
    // cursor at end after setMarkdown; insertText appends
    editor.setMarkdownSelection(5, 5);
    editor.insertText(" world");
    expect(editor.getMarkdown()).toBe("hello world");
    cleanup();
  });

  test("insertText with deleteBefore", () => {
    const { editor, cleanup } = mountCM6("hello");
    editor.setMarkdownSelection(5, 5);
    editor.insertText("!", 5); // delete 5 chars before cursor, insert "!"
    expect(editor.getMarkdown()).toBe("!");
    cleanup();
  });

  test("replaceMarkdownRange replaces mid-doc", () => {
    const { editor, cleanup } = mountCM6("foo bar baz");
    editor.replaceMarkdownRange(4, 7, "qux");
    expect(editor.getMarkdown()).toBe("foo qux baz");
    cleanup();
  });

  test("textBetween reads source slice", () => {
    const { editor, cleanup } = mountCM6("abcdef");
    expect(editor.textBetween(2, 5)).toBe("cde");
    cleanup();
  });

  test("paste inserts markdown-looking plain text as source", () => {
    const { editor, cleanup } = mountCM6("");
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
      clipboardData: Pick<DataTransfer, "files" | "getData">;
    };
    Object.defineProperty(event, "clipboardData", {
      value: {
        files: [],
        getData: (type: string) => type === "text/plain" ? "## Title" : "",
      },
    });
    (editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe("## Title");
    cleanup();
  });

  test("paste converts clipboard html to markdown when plain text is not source", () => {
    const { editor, cleanup } = mountCM6("");
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
      clipboardData: Pick<DataTransfer, "files" | "getData">;
    };
    Object.defineProperty(event, "clipboardData", {
      value: {
        files: [],
        getData: (type: string) => {
          if (type === "text/plain") return "Title\nPlain body";
          if (type === "text/html") return "<h2>Title</h2><p>Plain body</p>";
          return "";
        },
      },
    });
    (editor.view as unknown as { contentDOM: HTMLElement }).contentDOM.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe("## Title\n\nPlain body");
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// getMarkdownSelection / setMarkdownSelection
// ---------------------------------------------------------------------------

maybeDescribe("cm6 kernel: selection", () => {
  test("setMarkdownSelection moves cursor", () => {
    const { editor, cleanup } = mountCM6("hello world");
    editor.setMarkdownSelection(6, 11);
    const sel = editor.getMarkdownSelection();
    expect(sel.from).toBe(6);
    expect(sel.to).toBe(11);
    cleanup();
  });

  test("collapsed selection", () => {
    const { editor, cleanup } = mountCM6("hello");
    editor.setMarkdownSelection(3);
    const sel = editor.getMarkdownSelection();
    expect(sel.from).toBe(3);
    expect(sel.to).toBe(3);
    cleanup();
  });

  test("vim-lite moves CM6 cursor with ArrowUp/ArrowDown and j/k", () => {
    const { editor, cleanup } = mountCM6("aa\nbbbb\ncc");
    const target = (editor.view as unknown as { contentDOM: HTMLElement }).contentDOM;
    const vim = createVimLite(editor, document.body);
    function press(key: string): void {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, "target", { value: target });
      vim.handleKeyDown(event);
    }

    editor.setMarkdownSelection(1);
    press("ArrowDown");
    expect(editor.getMarkdownSelection().from).toBe(4);
    press("ArrowDown");
    expect(editor.getMarkdownSelection().from).toBe(9);
    press("ArrowUp");
    expect(editor.getMarkdownSelection().from).toBe(4);
    vim.setMode("normal");
    press("j");
    expect(editor.getMarkdownSelection().from).toBe(9);
    press("k");
    expect(editor.getMarkdownSelection().from).toBe(4);
    cleanup();
  });

  test("vim-lite restores core normal and visual commands on CM6", () => {
    const { editor, cleanup } = mountCM6("abc\ndef\nghi");
    const target = (editor.view as unknown as { contentDOM: HTMLElement }).contentDOM;
    const vim = createVimLite(editor, document.body);
    function press(key: string): void {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, "target", { value: target });
      vim.handleKeyDown(event);
    }

    editor.setMarkdownSelection(1);
    vim.setMode("normal");
    press("h");
    expect(editor.getMarkdownSelection().from).toBe(0);
    press("l");
    expect(editor.getMarkdownSelection().from).toBe(1);
    press("x");
    expect(editor.getMarkdown()).toBe("ac\ndef\nghi");
    press("p");
    expect(editor.getMarkdown()).toBe("acb\ndef\nghi");

    editor.setMarkdown("one\ntwo\nthree");
    editor.setMarkdownSelection(5);
    vim.setMode("normal");
    press("d");
    press("d");
    expect(editor.getMarkdown()).toBe("one\nthree");

    editor.setMarkdown("abcd");
    editor.setMarkdownSelection(0);
    vim.setMode("normal");
    press("v");
    press("l");
    press("l");
    press("y");
    editor.setMarkdownSelection(editor.getMarkdown().length);
    vim.setMode("normal");
    press("p");
    expect(editor.getMarkdown()).toBe("abcdab");
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// undo / redo
// ---------------------------------------------------------------------------

maybeDescribe("cm6 kernel: undo/redo", () => {
  test("undo reverses insertText", () => {
    const { editor, cleanup } = mountCM6("hello");
    editor.setMarkdownSelection(5, 5);
    editor.insertText(" world");
    expect(editor.getMarkdown()).toBe("hello world");
    editor.undo();
    expect(editor.getMarkdown()).toBe("hello");
    cleanup();
  });

  test("redo re-applies after undo", () => {
    const { editor, cleanup } = mountCM6("hello");
    editor.setMarkdownSelection(5, 5);
    editor.insertText(" world");
    editor.undo();
    editor.redo();
    expect(editor.getMarkdown()).toBe("hello world");
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// onChange callback
// ---------------------------------------------------------------------------

maybeDescribe("cm6 kernel: onChange", () => {
  test("fires with new markdown on insertText", () => {
    const received: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, {
      kernel: "cm6",
      initialContent: "a",
      onChange: (md) => received.push(md),
    });
    editor.setMarkdownSelection(1, 1);
    editor.insertText("b");
    expect(received.length).toBeGreaterThan(0);
    expect(received[received.length - 1]).toBe("ab");
    editor.destroy();
  });
});

// ---------------------------------------------------------------------------
// isSourceMode / toggleSource / destroy
// ---------------------------------------------------------------------------

maybeDescribe("cm6 kernel: surface", () => {
  test("toggleSource disables and restores CM6 live preview decorations", () => {
    const { editor, cleanup } = mountCM6("**bold**\n\n---\n\nend");
    expect(editor.isSourceMode()).toBe(false);
    editor.setMarkdownSelection(editor.getMarkdown().length);
    expect(document.querySelector(".cm-horizontal-rule")).toBeTruthy();
    expect(document.querySelector(".syntax-hidden")).toBeTruthy();

    editor.toggleSource();
    expect(editor.isSourceMode()).toBe(true);
    expect(document.querySelector(".cm-horizontal-rule")).toBeNull();
    expect(document.querySelector(".syntax-hidden")).toBeNull();

    editor.toggleSource();
    expect(editor.isSourceMode()).toBe(false);
    expect(document.querySelector(".cm-horizontal-rule")).toBeTruthy();
    cleanup();
  });

  test("destroy removes DOM", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, { kernel: "cm6", initialContent: "x" });
    editor.destroy();
    expect(host.children.length).toBe(0);
  });
});
