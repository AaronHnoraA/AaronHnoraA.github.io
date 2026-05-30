import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import { parseLeanPlaceholderLine, scanMarkdownLeanPlaceholders } from "../shared/lean-placeholder.mjs";

describe("Lean placeholder syntax", () => {
  test("parses linked Lean selectors containing parentheses", () => {
    const line = "@@lean4(../../../../project/UNSW/ISO(202603)/GraphTensor.lean) [lean-mps0spux]";

    expect(parseLeanPlaceholderLine(line)).toMatchObject({
      selector: "../../../../project/UNSW/ISO(202603)/GraphTensor.lean",
      tag: "lean-mps0spux",
    });
    expect(scanMarkdownLeanPlaceholders(line)).toMatchObject([{
      selector: "../../../../project/UNSW/ISO(202603)/GraphTensor.lean",
      tag: "lean-mps0spux",
    }]);
  });
});
