import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore The server is a Node ESM module outside the TS app graph.
import { activeKindFromContent, kindFromContent, scanSnippets } from "../server/aaronnote-server.mjs";

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

  test("loads kind-specific snippets from kinds/name/snippet", async () => {
    const snippets = await scanSnippets({ force: true });
    const slide = snippets.find((snippet) => snippet.kind === "slides" && snippet.key === "slide");
    expect(slide?.mode).toBe("markdown-mode");
    expect(slide?.body).toContain("# ${1:Slide title}");
  });
});
