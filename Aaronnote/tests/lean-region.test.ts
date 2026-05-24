import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore Node ESM helper is outside the TS app graph.
import { deleteLeanRegion, ensureLeanRegion, readLeanRegion, scanLeanRegions, updateLeanRegion } from "../server/lib/lean-region.mjs";
// @ts-ignore Node ESM helper is outside the TS app graph.
import { handleLeanRequest, setNotesRoot } from "../server/lib/lean.mjs";

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

  test("updating a middle region without a trailing newline preserves the next region", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-middle-update-"));
    try {
      const notePath = join(root, "math", "middle-update.md");
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "first" });
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "second" });
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "third" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "first", body: "#check Nat" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "second", body: "#check Int" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "third", body: "#check String" });

      const updated = await updateLeanRegion({ notePath, notesRoot: root, tag: "second", body: "-- s" });
      const regions = scanLeanRegions(updated.text);

      expect(regions.map((region: { tag: string }) => region.tag)).toEqual(["first", "second", "third"]);
      expect(regions.find((region: { tag: string }) => region.tag === "second")?.body).toBe("-- s\n");
      expect(regions.find((region: { tag: string }) => region.tag === "third")?.body).toBe("#check String");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("deletes a region marker and its body", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-delete-"));
    try {
      const notePath = join(root, "math", "delete.md");
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "first" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "first", body: "#check Nat\n" });
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "second" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "second", body: "#check Int\n" });

      const deleted = await deleteLeanRegion({ notePath, notesRoot: root, tag: "first" });

      expect(deleted.deleted).toBe(true);
      expect(scanLeanRegions(deleted.text).map((region: { tag: string; body: string }) => [region.tag, region.body])).toEqual([
        ["second", "#check Int\n"],
      ]);
      expect(deleted.text).not.toContain("#check Nat");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("deleting a middle region preserves surrounding Lean text boundaries", async () => {
    const text = [
      "import Mathlib",
      "-- @aaronnote first",
      "#check Nat",
      "-- @aaronnote second",
      "#check Int",
      "-- @aaronnote third",
      "#check String",
      "",
    ].join("\n");
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-delete-middle-"));
    try {
      const notePath = join(root, "math", "delete-middle.md");
      await mkdir(join(root, ".lean", "math"), { recursive: true });
      await writeFile(join(root, ".lean", "math", "delete-middle.lean"), text, "utf8");

      const deleted = await deleteLeanRegion({ notePath, notesRoot: root, tag: "second" });

      expect(deleted.text).toContain("import Mathlib\n-- @aaronnote first");
      expect(deleted.text).toContain("#check Nat\n-- @aaronnote third");
      expect(deleted.text).not.toContain("#check Int");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("deleting the last region removes the trailing marker line cleanly", async () => {
    const text = [
      "import Mathlib",
      "-- @aaronnote first",
      "#check Nat",
      "-- @aaronnote second",
      "#check Int",
    ].join("\n");
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-delete-last-"));
    try {
      const notePath = join(root, "math", "delete-last.md");
      await mkdir(join(root, ".lean", "math"), { recursive: true });
      await writeFile(join(root, ".lean", "math", "delete-last.lean"), text, "utf8");

      const deleted = await deleteLeanRegion({ notePath, notesRoot: root, tag: "second" });

      expect(deleted.text).toBe("import Mathlib\n-- @aaronnote first\n#check Nat");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("deleting the only region leaves non-region prelude intact", async () => {
    const text = "import Mathlib\n-- @aaronnote only\n#check Nat\n";
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-delete-only-"));
    try {
      const notePath = join(root, "math", "delete-only.md");
      await mkdir(join(root, ".lean", "math"), { recursive: true });
      await writeFile(join(root, ".lean", "math", "delete-only.lean"), text, "utf8");

      const deleted = await deleteLeanRegion({ notePath, notesRoot: root, tag: "only" });

      expect(deleted.text).toBe("import Mathlib");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("server ensure-region honors caller insertion neighbors for a new markdown tag", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-region-server-order-"));
    try {
      setNotesRoot(root);
      const notePath = join(root, "math", "server-order.md");
      await mkdir(join(root, "math"), { recursive: true });
      await writeFile(notePath, "@@lean4 [first]\n@@lean4 [third]\n", "utf8");
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "first" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "first", body: "#check Nat\n" });
      await ensureLeanRegion({ notePath, notesRoot: root, tag: "third" });
      await updateLeanRegion({ notePath, notesRoot: root, tag: "third", body: "#check Int\n" });

      const result = await handleLeanRequest("ensure-region", {
        notePath,
        tag: "second",
        beforeTag: "first",
        afterTag: "third",
      }) as { ok?: boolean; leanPath: string };

      expect(result.ok).toBe(true);
      const text = await readFile(result.leanPath, "utf8");
      expect(scanLeanRegions(text).map((region: { tag: string }) => region.tag)).toEqual(["first", "second", "third"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
