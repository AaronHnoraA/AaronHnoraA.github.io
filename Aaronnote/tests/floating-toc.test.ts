import { EditorState, Text } from "@codemirror/state";
import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { inlineTagAnchorsFromText, markdownHeadingsFromText } from "../aaronnote/floating-toc.ts";
import { tocIndexExtension, tocIndexFromState } from "../src/cm6/toc-index.ts";

describe("floating toc heading scan", () => {
  test("scans headings from CM6 Text without materializing markdown", () => {
    const doc = Text.of([
      "# Alpha",
      "body",
      "  ## Beta ###",
      "####Nope",
      "### Gamma",
    ]);

    expect(markdownHeadingsFromText(doc)).toEqual([
      { level: 1, text: "Alpha", pos: 2 },
      { level: 2, text: "Beta", pos: 18 },
      { level: 3, text: "Gamma", pos: 40 },
    ]);
  });

  test("scans inline tag anchors without treating code as anchors", () => {
    const doc = Text.of([
      "# Alpha",
      "body @@tag[alpha]",
      "multi @@tag[first] and @@tag[second]",
      "`@@tag[code]`",
      "```",
      "@@tag[fenced]",
      "```",
      "tail @@tag[tail]",
    ]);

    expect(inlineTagAnchorsFromText(doc).map((anchor) => anchor.tag)).toEqual(["alpha", "first", "second", "tail"]);
  });

  test("updates toc index around changed lines", () => {
    let state = EditorState.create({
      doc: "# Alpha\nbody @@tag[alpha]\n## Beta",
      extensions: [tocIndexExtension],
    });

    state = state.update({
      changes: { from: 0, to: "# Alpha".length, insert: "# Renamed" },
    }).state;
    state = state.update({
      changes: { from: state.doc.length, insert: "\nbody @@tag[tail]" },
    }).state;

    const index = tocIndexFromState(state);
    expect(index.headings.map((heading) => heading.text)).toEqual(["Renamed", "Beta"]);
    expect(index.anchors.map((anchor) => anchor.tag)).toEqual(["alpha", "tail"]);
  });

  test("toc index falls back correctly when fence structure appears", () => {
    let state = EditorState.create({
      doc: "# Alpha\n@@tag[alpha]\n",
      extensions: [tocIndexExtension],
    });

    state = state.update({
      changes: { from: state.doc.length, insert: "```\n@@tag[code]\n```\n@@tag[tail]" },
    }).state;

    const index = tocIndexFromState(state);
    expect(index.anchors.map((anchor) => anchor.tag)).toEqual(["alpha", "tail"]);
  });

  test("toc index keeps fenced tag text out during body edits", () => {
    let state = EditorState.create({
      doc: "# Alpha\n@@tag[alpha]\n```\n@@tag[code]\n```\n@@tag[tail]",
      extensions: [tocIndexExtension],
    });

    const codeLine = state.doc.line(4);
    state = state.update({
      changes: { from: codeLine.to, insert: " edited" },
    }).state;

    const index = tocIndexFromState(state);
    expect(index.anchors.map((anchor) => anchor.tag)).toEqual(["alpha", "tail"]);
  });
});
