import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { leanCompletionApplyTextForTest } from "../src/cm6/widgets/lean-placeholder.ts";

describe("lean completion snippets", () => {
  test("keeps LSP snippet tabstops for CodeMirror snippet sessions", () => {
    expect(leanCompletionApplyTextForTest({
      label: "theorem",
      insertTextFormat: 2,
      insertText: "theorem ${1:name} : ${2:Prop} := by\n  $0",
    })).toBe("theorem ${1:name} : ${2:Prop} := by\n  ${0}");
  });

  test("normalizes LSP choice placeholders to a CodeMirror default field", () => {
    expect(leanCompletionApplyTextForTest({
      label: "kind",
      insertTextFormat: 2,
      insertText: "${1|theorem,lemma,example|} ${2:name} := $0",
    })).toBe("${1:theorem} ${2:name} := ${0}");
  });

  test("leaves plain completion text unchanged", () => {
    expect(leanCompletionApplyTextForTest({
      label: "simp",
      insertText: "simp",
    })).toBe("simp");
  });
});
