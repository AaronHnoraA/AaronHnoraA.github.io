import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { serialize } from "../src/serializer.ts";
import { apply, setup } from "./utils.ts";

describe("org-env keymap", () => {
  test("Enter inserts a newline inside the block instead of splitting it", () => {
    const state = apply(
      setup("#+begin summary\nfoo\n#+end summary"),
      ["<Enter>", "bar", "<Enter>"],
    );
    expect(state.doc.childCount).toBe(1);
    const block = state.doc.child(0);
    expect(block.type.name).toBe("org_env_block");
    expect(block.attrs.kind).toBe("summary");
    expect(block.childCount).toBe(3);
    expect(block.child(0).textContent).toBe("foo");
    expect(block.child(1).textContent).toBe("bar");
  });

  test("Mod-Enter at the end exits the block", () => {
    const state = apply(
      setup("#+begin summary\nfoo\n#+end summary"),
      ["<Mod-Enter>"],
    );
    expect(state.doc.childCount).toBe(2);
    expect(state.doc.child(0).type.name).toBe("org_env_block");
    expect(state.doc.child(0).textContent).toBe("foo");
    expect(state.doc.child(1).type.name).toBe("paragraph");
    expect(serialize(state.doc)).toBe("#+begin summary\nfoo\n#+end summary");
  });

  test("Mod-Enter in the middle splits the block and moves the tail outside", () => {
    let state = setup("#+begin summary\nfoo bar\n#+end summary");
    state = apply(state, ["<Home>", "<ArrowRight>", "<ArrowRight>", "<ArrowRight>", "<Mod-Enter>"]);
    expect(state.doc.childCount).toBe(2);
    expect(state.doc.child(0).type.name).toBe("org_env_block");
    expect(state.doc.child(0).textContent).toBe("foo");
    expect(state.doc.child(1).type.name).toBe("paragraph");
    expect(state.doc.child(1).textContent).toBe(" bar");
  });
});
