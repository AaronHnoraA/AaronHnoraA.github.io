import { afterEach, describe, expect, test } from "@voidzero-dev/vite-plus-test";
import {
  activeLeanController,
  getLeanController,
  registerLeanController,
  setActiveLeanController,
  unregisterLeanController,
  type LeanEditAction,
  type LeanEditorController,
  type LeanLspAction,
} from "../src/cm6/widgets/lean-placeholder.ts";

function fakeController(id: string): LeanEditorController & { lsp: LeanLspAction[]; edits: LeanEditAction[]; jumps: Array<[number, number]> } {
  const lsp: LeanLspAction[] = [];
  const edits: LeanEditAction[] = [];
  const jumps: Array<[number, number]> = [];
  return {
    id,
    notePath: `${id}.md`,
    leanPath: `.lean/${id}.lean`,
    tag: id,
    selector: "",
    async runLspAction(action) { lsp.push(action); },
    runEditAction(action) { edits.push(action); },
    jumpTo(line, character) { jumps.push([line, character]); },
    lsp,
    edits,
    jumps,
  };
}

describe("lean controller registry", () => {
  afterEach(() => {
    unregisterLeanController("a");
    unregisterLeanController("b");
  });

  test("register / get / unregister", () => {
    const a = fakeController("a");
    registerLeanController(a);
    expect(getLeanController("a")).toBe(a);
    expect(getLeanController("missing")).toBe(null);
    unregisterLeanController("a");
    expect(getLeanController("a")).toBe(null);
  });

  test("active controller tracks the focused editor", () => {
    const a = fakeController("a");
    const b = fakeController("b");
    registerLeanController(a);
    registerLeanController(b);
    expect(activeLeanController()).toBe(null);
    setActiveLeanController("a");
    expect(activeLeanController()).toBe(a);
    setActiveLeanController("b");
    expect(activeLeanController()).toBe(b);
  });

  test("setActiveLeanController ignores unknown ids", () => {
    const a = fakeController("a");
    registerLeanController(a);
    setActiveLeanController("a");
    setActiveLeanController("ghost");
    expect(activeLeanController()).toBe(a);
  });

  test("unregistering the active controller clears active", () => {
    const a = fakeController("a");
    registerLeanController(a);
    setActiveLeanController("a");
    expect(activeLeanController()).toBe(a);
    unregisterLeanController("a");
    expect(activeLeanController()).toBe(null);
  });

  test("controller dispatch routes lsp/edit/jump through the handle", async () => {
    const a = fakeController("a");
    registerLeanController(a);
    setActiveLeanController("a");
    const ctrl = activeLeanController();
    expect(ctrl).toBe(a);
    await ctrl?.runLspAction("definition");
    await ctrl?.runLspAction("references");
    ctrl?.runEditAction("toggleLineComment");
    ctrl?.jumpTo(12, 3);
    expect(a.lsp).toEqual(["definition", "references"]);
    expect(a.edits).toEqual(["toggleLineComment"]);
    expect(a.jumps).toEqual([[12, 3]]);
  });
});
