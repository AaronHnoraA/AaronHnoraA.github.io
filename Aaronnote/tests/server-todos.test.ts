import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore The server is a Node ESM module outside the TS app graph.
import { extractTodos, normalizeTodoStatus, scanInlineCommands } from "../server/aaronnote-server.mjs";

const note = {
  file: "/notes/a.md",
  path: "a.md",
  key: "a",
  id: "a",
  title: "A",
};

describe("server todo scan", () => {
  test("normalizes explicit todo statuses", () => {
    expect(normalizeTodoStatus("doing")).toBe("doing");
    expect(normalizeTodoStatus("done")).toBe("done");
    expect(normalizeTodoStatus("")).toBe("todo");
  });

  test("extracts explicit statuses and keeps bare todo whitespace-sensitive", () => {
    const todos = extractTodos(
      [
        "@@todo [plain]",
        "@@todo(done) [closed]",
        "@@todo(doing) [active]{ddl: 2026-05-20}",
        "@@todo(doing)[not parsed]",
        "@@todo[not parsed]",
      ].join("\n"),
      note,
      1,
    );

    expect(todos.map((todo: { status: string; text: string; ddl?: string }) => [todo.status, todo.text, todo.ddl || ""])).toEqual([
      ["todo", "plain", ""],
      ["done", "closed", ""],
      ["doing", "active", "2026-05-20"],
    ]);
  });

  test("exposes reusable inline command scanning", () => {
    expect(scanInlineCommands("@@cmd(switch) [context]{arg: value}", "cmd")).toMatchObject([
      {
        name: "cmd",
        switchValue: "switch",
        context: "context",
        args: { arg: "value" },
      },
    ]);
  });
});
