import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import { EditorState } from "prosemirror-state";

import { normalizeInlinePlugin } from "../src/normalize.ts";
import { schema } from "../src/schema.ts";

function mkDoc(paragraphs: string[]) {
  return schema.node(
    "doc",
    null,
    paragraphs.map((text) =>
      schema.node("paragraph", null, text ? [schema.text(text)] : []),
    ),
  );
}

function hasMarkedText(state: EditorState, paragraphIndex: number, text: string, markName: string): boolean {
  const paragraph = state.doc.child(paragraphIndex);
  let found = false;
  paragraph.descendants((node) => {
    if (!node.isText || node.text !== text) return true;
    found = node.marks.some((mark) => mark.type.name === markName);
    return !found;
  });
  return found;
}

describe("normalizeInlinePlugin", () => {
  test("keeps unchanged adjacent block plans when incrementally parsing edits", () => {
    const doc = mkDoc(["*a*", "zz"]);
    const state = EditorState.create({ schema, doc, plugins: [normalizeInlinePlugin()] });
    const secondParagraphStart = state.doc.child(0).nodeSize + 1;
    const next = state.apply(state.tr.insertText("!", secondParagraphStart, secondParagraphStart));

    expect(hasMarkedText(next, 0, "a", "em")).toBe(true);
  });
});
