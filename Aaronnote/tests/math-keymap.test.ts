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

function emptyDisplayState() {
  return apply(setupAt("$$\n$$", "$$\n".length), ["<Enter>"]);
}

describe("math keymap", () => {
  test("Enter inside display math inserts a source newline without splitting the paragraph", () => {
    const state = apply(setupAt("$$\nasd\n$$", "$$\nasd".length), ["<Enter>"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\nasd\n\n$$");
  });

  test("Enter inside empty display math keeps the blank source line", () => {
    const state = apply(setupAt("$$\n$$", "$$\n".length), ["<Enter>"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\n\n$$");
  });

  test("Enter inside same-line double-dollar source does not create display math", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["<Enter>"]);
    expect(state.doc.childCount).toBeGreaterThan(1);
  });

  test("Enter inside compact $$$$ does not create display math", () => {
    const state = apply(setupAt("$$$$", "$$".length), ["<Enter>"]);
    expect(state.doc.textContent).not.toBe("$$\n\n$$");
  });

  test("typing inside line-fenced display math preserves the closing fence", () => {
    const state = apply(setupAt("$$\n$$", "$$\n".length), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\na\n$$");
  });

  test("typing on the blank source line in empty display math does not collapse fences", () => {
    const base = emptyDisplayState();
    const state = apply(base, ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\n\na\n$$");
  });

  test("typing before the closing fence in empty display math keeps a separate close line", () => {
    const base = emptyDisplayState();
    const doc = base.doc;
    const beforeClose = base.apply(base.tr.setSelection(TextSelection.create(doc, 1 + "$$\n\n".length)));
    const state = apply(beforeClose, ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\n\na\n$$");
  });

  test("parsed empty display math with a blank body stays one editable paragraph", () => {
    const state = apply(setupAt("$$\n\n$$", "$$\n".length), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\na\n$$");
  });

  test("typing inside same-line double-dollar source does not create display math", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$ a$$");
  });

  test("typing inside compact $$$$ does not create display math", () => {
    const state = apply(setupAt("$$$$", "$$".length), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$a$$");
  });

  test("continued typing inside same-line double-dollar source remains plain text", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["a", "s", "d"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$ asd$$");
  });

  test("typing after an existing display-math newline does not move the closing fence", () => {
    const state = apply(setupAt("$$\nasd\n$$", "$$\nasd".length), ["x"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\nasdx\n$$");
  });

  test("active empty display math keeps source DOM without a render widget", () => {
    const state = apply(setupAt("$$\n$$", "$$\n".length), ["<Enter>"]);
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      expect(view.dom.querySelector(".aaronnote-math-block")).toBeNull();
      expect(state.doc.child(0).textContent).toBe("$$\n\n$$");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("active non-empty display math keeps source DOM without a render widget", () => {
    const state = setupAt("$$\na+b\n$$", "$$\na".length);
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      expect(view.dom.querySelector(".aaronnote-math-block")).toBeNull();
      expect(state.doc.child(0).textContent).toBe("$$\na+b\n$$");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("clicking rendered display math places the cursor inside the source", () => {
    const doc = parse("$$\na+b\n$$");
    const state = createState(doc);
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const widget = view.dom.querySelector<HTMLElement>(".aaronnote-math-block");
      expect(widget).not.toBeNull();
      widget!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      widget!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(view.state.selection.from).toBe(1 + "$$\n".length);
      expect(view.dom.querySelector(".aaronnote-math-block")).toBeNull();
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("editing inline math does not remove the following soft line break", () => {
    const state = apply(setupAt("$asdasdasdas$\nasdasd", "$asdasdasdas".length), ["x"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$asdasdasdasx$\nasdasd");
  });
});
