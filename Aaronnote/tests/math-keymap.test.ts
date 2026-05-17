import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import { TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { createState } from "../src/editor.ts";
import { parse } from "../src/parser.ts";
import { apply } from "./utils.ts";

function setupAt(md: string, offset: number) {
  const doc = parse(md);
  const state = createState(doc);
  return state.apply(state.tr.setSelection(TextSelection.create(doc, 1 + offset)));
}

function setupMathAt(md: string, bodyOffset: number) {
  const doc = parse(md);
  expect(doc.child(0).type.name).toBe("math_block");
  const state = createState(doc);
  return state.apply(state.tr.setSelection(TextSelection.create(doc, 1 + bodyOffset)));
}

function setupInsideFirstMathBlock(md: string) {
  const doc = parse(md);
  let pos: number | null = null;
  doc.descendants((node, nodePos) => {
    if (pos == null && node.type.name === "math_block") {
      pos = nodePos;
      return false;
    }
    return true;
  });
  expect(pos).not.toBeNull();
  const state = createState(doc);
  return state.apply(state.tr.setSelection(TextSelection.create(doc, pos! + 1)));
}

describe("math keymap", () => {
  test("line-fenced display math parses as one math_block", () => {
    const doc = parse("$$\nasd\n$$");
    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe("math_block");
    expect(doc.child(0).textContent).toBe("asd");
  });

  test("Enter inside display math inserts a body newline without moving fences", () => {
    const state = apply(setupMathAt("$$\nasd\n$$", "asd".length), ["<Enter>"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("math_block");
    expect(state.doc.child(0).textContent).toBe("asd\n");
  });

  test("Enter inside empty display math keeps an editable blank body line", () => {
    const state = apply(setupMathAt("$$\n$$", 0), ["<Enter>"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("math_block");
    expect(state.doc.child(0).textContent).toBe("\n");
  });

  test("typing inside empty display math edits only the math body", () => {
    const state = apply(setupMathAt("$$\n$$", 0), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("math_block");
    expect(state.doc.child(0).textContent).toBe("a");
  });

  test("typing after an existing display-math body line does not move fences", () => {
    const state = apply(setupMathAt("$$\nasd\n$$", "asd".length), ["x"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("math_block");
    expect(state.doc.child(0).textContent).toBe("asdx");
  });

  test("typing $$ then Enter creates a display math block", () => {
    const state = apply(setupAt("$$", "$$".length), ["<Enter>"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("math_block");
    expect(state.selection.from).toBe(1);
  });

  test("Enter inside same-line double-dollar source does not create display math", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["<Enter>"]);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.childCount).toBeGreaterThan(1);
  });

  test("typing inside same-line double-dollar source stays plain text", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["a", "s", "d"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$ asd$$");
  });

  test("compact $$$$ stays plain text", () => {
    const state = apply(setupAt("$$$$", "$$".length), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$a$$");
  });

  test("display math DOM shows fixed fence chrome while editing", () => {
    const state = setupMathAt("$$\na+b\n$$", 1);
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const block = view.dom.querySelector("math-block");
      expect(block).not.toBeNull();
      expect(block!.classList.contains("math-block-active")).toBe(true);
      expect(block!.classList.contains("math-block-rendered")).toBe(false);
      expect(block!.querySelectorAll(".math-block-fence")).toHaveLength(2);
      expect(block!.querySelector(".math-block-render")).not.toBeNull();
      expect(state.doc.child(0).textContent).toBe("a+b");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("display math DOM renders latex after the cursor leaves the block", () => {
    const doc = parse("text\n\n$$\na+b\n$$");
    const base = createState(doc);
    const state = base.apply(base.tr.setSelection(TextSelection.create(doc, 1)));
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const block = view.dom.querySelector("math-block");
      expect(block).not.toBeNull();
      expect(block!.classList.contains("math-block-rendered")).toBe(true);
      expect(block!.classList.contains("math-block-active")).toBe(false);
      expect(block!.querySelector(".math-block-render")).not.toBeNull();
      expect(block!.querySelector(".aaronnote-math-block")).not.toBeNull();
      expect(doc.child(1).type.name).toBe("math_block");
      expect(doc.child(1).textContent).toBe("a+b");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("clicking rendered display math places the cursor inside the block body", () => {
    const doc = parse("text\n\n$$\na+b\n$$");
    const base = createState(doc);
    const state = base.apply(base.tr.setSelection(TextSelection.create(doc, 1)));
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const render = view.dom.querySelector<HTMLElement>(".math-block-render");
      expect(render).not.toBeNull();
      render!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      expect(view.state.selection.$from.parent.type.name).toBe("math_block");
      expect(view.state.selection.from).toBe(7);
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("clicking a math fence places the cursor inside the block body", () => {
    const doc = parse("$$\na+b\n$$");
    const state = createState(doc);
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const fence = view.dom.querySelector<HTMLElement>(".math-block-fence");
      expect(fence).not.toBeNull();
      fence!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      expect(view.state.selection.from).toBe(1);
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("Mod-Enter inside nested display math creates an empty paragraph in the parent block first", () => {
    const state = apply(
      setupInsideFirstMathBlock("#+begin summary\ncan be proved\n\n$$\na+b\n$$\n#+end summary"),
      ["<Mod-Enter>"],
    );
    expect(state.doc.childCount).toBe(1);
    const block = state.doc.child(0);
    expect(block.type.name).toBe("org_env_block");
    expect(block.childCount).toBe(3);
    expect(block.child(0).type.name).toBe("paragraph");
    expect(block.child(1).type.name).toBe("math_block");
    expect(block.child(2).type.name).toBe("paragraph");
    expect(block.child(2).textContent).toBe("");
    expect(state.selection.$from.parent.type.name).toBe("paragraph");
  });

  test("second Mod-Enter from the inserted parent paragraph exits the outer block", () => {
    const state = apply(
      setupInsideFirstMathBlock("#+begin summary\ncan be proved\n\n$$\na+b\n$$\n#+end summary"),
      ["<Mod-Enter>", "<Mod-Enter>"],
    );
    expect(state.doc.childCount).toBe(2);
    expect(state.doc.child(0).type.name).toBe("org_env_block");
    expect(state.doc.child(1).type.name).toBe("paragraph");
    expect(state.selection.$from.parent.type.name).toBe("paragraph");
    expect(state.selection.from).toBe(state.doc.child(0).nodeSize + 1);
  });

  test("editing inline math does not remove the following soft line break", () => {
    const state = apply(setupAt("$asdasdasdas$\nasdasd", "$asdasdasdas".length), ["x"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$asdasdasdasx$\nasdasd");
  });
});
