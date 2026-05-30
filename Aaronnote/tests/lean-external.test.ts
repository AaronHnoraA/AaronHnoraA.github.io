import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
// @ts-ignore Node ESM helper is outside the TS app graph.
import { findLeanExternalExecutables, kittyDirectoryCommand, leanExternalNvimCommand } from "../desktop/lean-external.mjs";

describe("lean external (Kitty/Nvim) command", () => {
  test("builds an argv array opening Kitty in a directory", () => {
    const { command, args } = kittyDirectoryCommand({
      kitty: "/opt/homebrew/bin/kitty",
      dir: "/proj/notebooks",
    });
    expect(command).toBe("/opt/homebrew/bin/kitty");
    expect(args).toEqual(["--directory", "/proj/notebooks"]);
  });

  test("builds an argv array opening Nvim at the 1-based cursor", () => {
    const { command, args } = leanExternalNvimCommand({
      kitty: "/opt/homebrew/bin/kitty",
      nvim: "/opt/homebrew/bin/nvim",
      file: "/proj/Mathlib/Logic/Basic.lean",
      line: 41, // 0-based LSP
      character: 7,
    });
    expect(command).toBe("/opt/homebrew/bin/kitty");
    expect(args).toEqual([
      "--directory", "/proj/Mathlib/Logic",
      "/opt/homebrew/bin/nvim",
      "+call cursor(42, 8)", // 1-based for Nvim
      "--",
      "/proj/Mathlib/Logic/Basic.lean",
    ]);
  });

  test("clamps and defaults negative/missing positions to line 1 col 1", () => {
    const { args } = leanExternalNvimCommand({
      kitty: "k",
      nvim: "n",
      file: "/a/b.lean",
      line: -5,
    });
    expect(args).toContain("+call cursor(1, 1)");
    // never builds a shell string — args is a flat array of discrete tokens
    expect(Array.isArray(args)).toBe(true);
    expect(args.every((a: unknown) => typeof a === "string")).toBe(true);
  });

  test("finds explicit overrides before PATH entries", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-bin-"));
    const explicitKitty = join(root, "kitty-explicit");
    const explicitNvim = join(root, "nvim-explicit");
    const pathKitty = join(root, "kitty");
    const pathNvim = join(root, "nvim");
    for (const file of [explicitKitty, explicitNvim, pathKitty, pathNvim]) {
      await writeFile(file, "#!/bin/sh\n", "utf8");
      await chmod(file, 0o755);
    }
    expect(findLeanExternalExecutables({
      env: {
        AARONNOTE_KITTY: explicitKitty,
        AARONNOTE_NVIM: explicitNvim,
        PATH: root,
      },
      preferredDirs: [],
    })).toEqual({ kitty: explicitKitty, nvim: explicitNvim });
  });

  test("falls back to PATH when overrides are absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "aaronnote-lean-path-"));
    const kitty = join(root, "kitty");
    const nvim = join(root, "nvim");
    for (const file of [kitty, nvim]) {
      await writeFile(file, "#!/bin/sh\n", "utf8");
      await chmod(file, 0o755);
    }
    expect(findLeanExternalExecutables({ env: { PATH: root }, preferredDirs: [] })).toEqual({ kitty, nvim });
  });
});
