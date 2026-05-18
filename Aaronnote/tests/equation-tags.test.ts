import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import { EditorState } from "prosemirror-state";

import { equationTagsPlugin, getEquationTagHits } from "../src/equation-tags.ts";
import { schema } from "../src/schema.ts";

function taggedDoc(tag: string) {
  return schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("intro")]),
    schema.nodes.math_block.createChecked(null, [schema.text(`x \\tag{${tag}}`)]),
  ]);
}

describe("equationTagsPlugin", () => {
  test("maps existing math tag positions across unrelated edits", () => {
    const state = EditorState.create({ schema, doc: taggedDoc("eq:1"), plugins: [equationTagsPlugin()] });
    const before = getEquationTagHits(state)[0]!;
    const next = state.apply(state.tr.insertText("!", 1));
    const after = getEquationTagHits(next)[0]!;

    expect(after.tag).toBe("eq:1");
    expect(after.from).toBe(before.from + 1);
    expect(after.to).toBe(before.to + 1);
  });

  test("updates changed math block tags", () => {
    const state = EditorState.create({ schema, doc: taggedDoc("eq:1"), plugins: [equationTagsPlugin()] });
    const hit = getEquationTagHits(state)[0]!;
    const next = state.apply(state.tr.insertText("eq:2", hit.from, hit.to));

    expect(getEquationTagHits(next).map((item) => item.tag)).toEqual(["eq:2"]);
  });
});
