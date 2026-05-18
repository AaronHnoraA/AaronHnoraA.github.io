import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { clearCodeHighlightCache, codeHighlightCacheSize, highlightCode } from "../src/code-highlight.ts";

describe("code highlighting", () => {
  test("marks common token classes and caches by language/source", () => {
    clearCodeHighlightCache();
    const ranges = highlightCode("ts", "const answer = 42;\n// done");
    expect(ranges.some((range) => range.className === "code-token-keyword")).toBe(true);
    expect(ranges.some((range) => range.className === "code-token-number")).toBe(true);
    expect(ranges.some((range) => range.className === "code-token-comment")).toBe(true);
    expect(codeHighlightCacheSize()).toBe(1);
    expect(highlightCode("typescript", "const answer = 42;\n// done")).toEqual(ranges);
    expect(codeHighlightCacheSize()).toBe(1);
  });
});
