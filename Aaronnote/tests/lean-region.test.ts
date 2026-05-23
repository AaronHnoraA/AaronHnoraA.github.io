import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore Node ESM helper is outside the TS app graph.
import { ensureLeanRegion, readLeanRegion, scanLeanRegions, updateLeanRegion } from "../server/lib/lean-region.mjs";

describe("lean tagged regions", () => {
  test("scans sequential Aaronnote tag regions", () => {
    const text = [
      "import Mathlib",
      "",
      "-- @aaronnote first",
      "#check Nat",
      "-- @aaronnote second",
      "#check Int",
      "",
    ].join("\n");

    const regions = scanLeanRegions(text);
    expect(regions.map((region: { tag: string; body: string }) => [region.tag, region.body])).toEqual([
      ["first", "#check Nat\n"],
      ["second", "#check Int\n"],
    ]);
  });

  test("creates and updates a region in the note mirror file", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-"));
    try {
      const notePath = join(root, "math", "group.md");
      const created = await ensureLeanRegion({ notePath, notesRoot: root, tag: "group-cancel" });
      expect(created.leanPath).toBe(join(root, ".lean", "math", "group.lean"));
      expect(created.created).toBe(true);

      await updateLeanRegion({
        notePath,
        notesRoot: root,
        tag: "group-cancel",
        body: "example : 1 = 1 := rfl\n",
      });
      const read = await readLeanRegion({ notePath, notesRoot: root, tag: "group-cancel" });
      expect(read.body).toBe("example : 1 = 1 := rfl\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("creates a new region between surrounding tags", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-order-"));
    try {
      const notePath = join(root, "math", "order.md");
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "first" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "first", body: "#check Nat\n" });
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "third" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "third", body: "#check Int\n" });

      const created = await ensureLeanRegion({
        notePath,
        notesRoot: root,
        tag: "second",
        beforeTag: "first",
        afterTag: "third",
      });

      expect(created.created).toBe(true);
      expect(scanLeanRegions(created.text).map((region: { tag: string }) => region.tag))
        .toEqual(["first", "second", "third"]);
      const first = scanLeanRegions(created.text).find((region: { tag: string }) => region.tag === "first");
      expect(first?.body).toBe("#check Nat\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
