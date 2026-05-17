import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import type { Editor } from "../src/lib.ts";
import { SnippetSession } from "../aaronnote/snippets.ts";

class TextEditor {
  text = "";
  selection = { from: 0, to: 0 };

  asEditor(): Editor {
    return this as unknown as Editor;
  }

  getMarkdown(): string {
    return this.text;
  }

  setMarkdown(md: string): void {
    this.text = md;
    this.selection = { from: md.length, to: md.length };
  }

  insertText(text: string, deleteBefore = 0): { from: number; to: number } {
    const from = Math.max(0, this.selection.from - deleteBefore);
    return this.replaceRange(from, this.selection.to, text, "end");
  }

  setSelection(from: number, to = from): void {
    this.selection = { from, to };
  }

  getSelection(): { from: number; to: number } {
    return this.selection;
  }

  textBetween(from: number, to: number): string {
    return this.text.slice(from, to);
  }

  replaceRange(from: number, to: number, text: string, select: "start" | "end" | "all" = "end"): { from: number; to: number } {
    this.text = `${this.text.slice(0, from)}${text}${this.text.slice(to)}`;
    const end = from + text.length;
    if (select === "start") this.setSelection(from);
    else if (select === "all") this.setSelection(from, end);
    else this.setSelection(end);
    return { from, to: end };
  }
}

describe("aaronnote snippets", () => {
  test("syncs mirrors without moving the active insertion point", () => {
    const editor = new TextEditor();
    const session = new SnippetSession(editor.asEditor());
    session.insert({ key: "pair", name: "Pair", mode: "markdown-mode", body: "${1:x} + ${1}$0" });

    editor.replaceRange(editor.selection.from, editor.selection.to, "abc", "end");
    expect(editor.selection).toEqual({ from: 3, to: 3 });

    expect(session.next()).toBe(true);
    expect(editor.text).toBe("abc + abc");
    expect(editor.selection).toEqual({ from: 9, to: 9 });
  });

  test("nested snippets finish child fields before returning to parent fields", () => {
    const editor = new TextEditor();
    const session = new SnippetSession(editor.asEditor());
    const frac = { key: "frac", name: "Fraction", mode: "tex-mode", body: "\\frac{${1:a}}{${2:b}}$0" };

    session.insert(frac);
    editor.replaceRange(editor.selection.from, editor.selection.to, "frac", "end");
    session.insert(frac, 4);

    expect(editor.text).toBe("\\frac{\\frac{a}{b}}{b}");
    expect(editor.textBetween(editor.selection.from, editor.selection.to)).toBe("a");

    editor.replaceRange(editor.selection.from, editor.selection.to, "x", "end");
    expect(session.next()).toBe(true);
    expect(editor.textBetween(editor.selection.from, editor.selection.to)).toBe("b");

    editor.replaceRange(editor.selection.from, editor.selection.to, "y", "end");
    expect(session.next()).toBe(true);
    expect(editor.textBetween(editor.selection.from, editor.selection.to)).toBe("");
    expect(editor.text).toBe("\\frac{\\frac{x}{y}}{b}");

    expect(session.next()).toBe(true);
    expect(editor.textBetween(editor.selection.from, editor.selection.to)).toBe("b");
  });
});
