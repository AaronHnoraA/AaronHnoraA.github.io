import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore Node ESM helper is outside the TS app graph.
import { handleLeanRequest, lspPositionToOffset, normalizeLspLocations, setNotesRoot } from "../server/lib/lean.mjs";

describe("lean location normalization", () => {
  test("lspPositionToOffset maps line/character to code-unit offsets", () => {
    const text = "import Mathlib\n#check Nat\n  done\n";
    expect(lspPositionToOffset(text, 0, 0)).toBe(0);
    expect(lspPositionToOffset(text, 1, 0)).toBe("import Mathlib\n".length);
    expect(lspPositionToOffset(text, 1, 6)).toBe("import Mathlib\n#check".length);
    // character past end of line clamps to line end
    expect(lspPositionToOffset(text, 0, 999)).toBe("import Mathlib".length);
    // line past EOF clamps to text length
    expect(lspPositionToOffset(text, 99, 0)).toBe(text.length);
  });

  test("normalizes a single Location with summary", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-loc-"));
    const file = join(root, "a.lean");
    await writeFile(file, "theorem foo : True := trivial\n#check foo\n", "utf8");
    const out = await normalizeLspLocations({
      uri: pathToFileURL(file).href,
      range: { start: { line: 0, character: 8 }, end: { line: 0, character: 11 } },
    });
    expect(out).toHaveLength(1);
    expect(out[0].file).toBe(file);
    expect(out[0].range.start).toEqual({ line: 0, character: 8 });
    expect(out[0].summary).toBe("theorem foo : True := trivial");
  });

  test("normalizes Location[] and LocationLink[], deduping by file:line:character", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-loc-"));
    const file = join(root, "b.lean");
    await writeFile(file, "line zero\nline one\nline two\n", "utf8");
    const uri = pathToFileURL(file).href;

    const fromArray = await normalizeLspLocations([
      { uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } } },
      { uri, range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } } },
      // duplicate of first → deduped
      { uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } } },
    ]);
    expect(fromArray.map((l: { summary: string }) => l.summary)).toEqual(["line zero", "line one"]);

    const fromLinks = await normalizeLspLocations([
      {
        targetUri: uri,
        targetRange: { start: { line: 2, character: 0 }, end: { line: 2, character: 8 } },
        targetSelectionRange: { start: { line: 2, character: 5 }, end: { line: 2, character: 8 } },
      },
    ]);
    expect(fromLinks).toHaveLength(1);
    // targetSelectionRange wins over targetRange
    expect(fromLinks[0].range.start).toEqual({ line: 2, character: 5 });
    expect(fromLinks[0].summary).toBe("line two");
  });

  test("returns [] for null result", async () => {
    expect(await normalizeLspLocations(null)).toEqual([]);
  });
});

describe("resolve-location", () => {
  test("reports in-region targets with tag and body-relative line", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-resolve-"));
    await mkdir(join(root, ".lean", "math"), { recursive: true });
    await mkdir(join(root, "math"), { recursive: true });
    await writeFile(join(root, "math", "group.md"), "# group\n", "utf8");
    const leanPath = join(root, ".lean", "math", "group.lean");
    const text = [
      "import Mathlib",
      "",
      "-- @aaronnote first",
      "theorem foo : True := trivial",
      "#check foo",
      "-- @aaronnote second",
      "#check Int",
      "",
    ].join("\n");
    await writeFile(leanPath, text, "utf8");
    setNotesRoot(root);

    // line 3 = "theorem foo …" inside region "first"
    const inFirst = await handleLeanRequest("resolve-location", { file: leanPath, line: 3, character: 8 });
    expect(inFirst.inRegion).toBe(true);
    expect(inFirst.external).toBe(false);
    expect(inFirst.tag).toBe("first");
    expect(inFirst.notePath).toBe(join(root, "math", "group.md"));
    expect(inFirst.selector).toBe("");
    expect(inFirst.bodyLine).toBe(0); // first body line

    // line 6 = "#check Int" inside region "second"
    const inSecond = await handleLeanRequest("resolve-location", { file: leanPath, line: 6, character: 0 });
    expect(inSecond.inRegion).toBe(true);
    expect(inSecond.tag).toBe("second");
    expect(inSecond.bodyLine).toBe(0);

    // line 0 = "import Mathlib" outside any region
    const header = await handleLeanRequest("resolve-location", { file: leanPath, line: 0, character: 0 });
    expect(header.inRegion).toBe(false);
    expect(header.external).toBe(false);
  });

  test("marks files outside the .lean mirror as external", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-resolve-"));
    setNotesRoot(root);
    const outside = join(root, "Mathlib", "Logic.lean");
    await mkdir(join(root, "Mathlib"), { recursive: true });
    await writeFile(outside, "-- @aaronnote x\ntheorem bar : True := trivial\n", "utf8");
    const res = await handleLeanRequest("resolve-location", { file: outside, line: 1, character: 0 });
    expect(res.external).toBe(true);
  });

  test("missing file resolves to not-in-region", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-resolve-"));
    setNotesRoot(root);
    const res = await handleLeanRequest("resolve-location", { file: join(root, ".lean", "nope.lean"), line: 0, character: 0 });
    expect(res.inRegion).toBe(false);
  });
});
