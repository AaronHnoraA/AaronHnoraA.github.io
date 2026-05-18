import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore The server is a Node ESM module outside the TS app graph.
import { refsFromContent } from "../server/aaronnote-server.mjs";

describe("server note refs", () => {
  test("extracts markdown note refs whose paths contain balanced parentheses", () => {
    expect(
      refsFromContent("[eq:1](roam/project/UNSW/ISO(202603)/meeting.md#eq-eq%3A1)"),
    ).toContain("roam/project/UNSW/ISO(202603)/meeting.md");
  });

  test("extracts encoded markdown note refs and decodes path syntax", () => {
    expect(
      refsFromContent("[eq:1](roam/project/UNSW/ISO%28202603%29/meeting.md#eq-eq%3A1)"),
    ).toContain("roam/project/UNSW/ISO(202603)/meeting.md");
  });

  test("extracts Typst refs from markdown links", () => {
    expect(
      refsFromContent("[def](project/UNSW/ISO%28202603%29/definition.typ#eq-main)"),
    ).toContain("project/UNSW/ISO(202603)/definition.typ");
  });
});
