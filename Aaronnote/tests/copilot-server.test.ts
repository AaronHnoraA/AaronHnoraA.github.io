import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore The server is a Node ESM module outside the TS app graph.
import { offsetToPosition, positionToOffset, scanPlugins } from "../server/aaronnote-server.mjs";

describe("copilot server helpers", () => {
  test("maps markdown offsets to LSP positions and back", () => {
    const text = "alpha\nbeta\nc";
    expect(offsetToPosition(text, 0)).toEqual({ line: 0, character: 0 });
    expect(offsetToPosition(text, 8)).toEqual({ line: 1, character: 2 });
    expect(positionToOffset(text, { line: 1, character: 2 })).toBe(8);
    expect(positionToOffset(text, { line: 9, character: 2 })).toBe(text.length);
  });

  test("scans autoload plugin manifests", async () => {
    const plugins = await scanPlugins({ force: true });
    const copilot = plugins.find((plugin: { id?: string }) => plugin.id === "copilot");
    expect(copilot).toMatchObject({
      id: "copilot",
      entry: "index.ts",
      autoload: true,
    });
    expect(copilot.actions.map((action: { id: string }) => action.id)).toContain("sign-in");
    expect(copilot.settings.map((setting: { id: string }) => setting.id)).toContain("idleDelayMs");

    const roamLookup = plugins.find((plugin: { id?: string }) => plugin.id === "roamlookup");
    expect(roamLookup).toMatchObject({
      id: "roamlookup",
      entry: "index.ts",
      autoload: true,
    });
    expect(roamLookup.actions.map((action: { id: string }) => action.id)).toContain("open");
  });
});
