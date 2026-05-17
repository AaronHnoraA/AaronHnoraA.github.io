import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import { TextSelection } from "prosemirror-state";

import { createState } from "../src/editor.ts";
import { parse } from "../src/parser.ts";
import { apply } from "./utils.ts";

function setupAt(md: string, offset: number) {
  const doc = parse(md);
  const state = createState(doc);
  return state.apply(state.tr.setSelection(TextSelection.create(doc, 1 + offset)));
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

  test("Enter inside same-line empty display math normalizes the body to one source line", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["<Enter>"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\n$$");
  });

  test("typing inside line-fenced display math preserves the closing fence", () => {
    const state = apply(setupAt("$$\n$$", "$$\n".length), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\na\n$$");
  });

  test("typing inside same-line empty display math keeps the closing fence", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["a"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$ a\n$$");
  });

  test("continued typing after same-line empty display math stays on the formula line", () => {
    const state = apply(setupAt("$$ $$", "$$ ".length), ["a", "s", "d"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$ asd\n$$");
  });

  test("typing after an existing display-math newline does not move the closing fence", () => {
    const state = apply(setupAt("$$\nasd\n$$", "$$\nasd".length), ["x"]);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("$$\nasdx\n$$");
  });
});
