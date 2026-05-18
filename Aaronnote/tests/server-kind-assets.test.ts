import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore The server is a Node ESM module outside the TS app graph.
import { activeKindFromContent, kindFromContent } from "../server/aaronnote-server.mjs";

describe("server note kind assets", () => {
  test("reads active kind from org meta", () => {
    expect(kindFromContent("#+begin meta\nkind: slides\n#+end meta\n\n# Talk")).toBe("slides");
    expect(activeKindFromContent("#+begin meta\nkind: slides\n#+end meta")).toBe("slides");
  });

  test("reads active kind from YAML front matter", () => {
    expect(kindFromContent("---\nkind: assignment\n---\n\n# Work")).toBe("assignment");
  });

  test("normalizes default and unsafe kinds", () => {
    expect(kindFromContent("")).toBe("default");
    expect(activeKindFromContent("#+begin meta\nkind: default\n#+end meta")).toBe("");
    expect(kindFromContent("#+begin meta\nkind: note\n#+end meta")).toBe("default");
    expect(kindFromContent("#+begin meta\nkind: ../slides\n#+end meta")).toBe("default");
  });
});
