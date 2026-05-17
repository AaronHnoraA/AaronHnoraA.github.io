import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import type { Editor } from "../src/lib.ts";
import { createEditor } from "../src/lib.ts";
import { SnippetSession } from "../aaronnote/snippets.ts";
import { feedEvent } from "../specs/events.ts";

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

  test("plain child snippet without tabstops does not advance the parent snippet", () => {
    const editor = new TextEditor();
    const session = new SnippetSession(editor.asEditor());
    session.insert({ key: ";", name: "Inline math", mode: "markdown-mode", body: "$${1:x}$ $0" });

    editor.replaceRange(editor.selection.from, editor.selection.to, "aaaa", "end");
    expect(session.insert({ key: "aaaa", name: "Alpha", mode: "tex-mode", body: "\\alpha" }, 4)).toBe(true);

    expect(editor.text).toBe("$\\alpha$ ");
    expect(editor.selection).toEqual({ from: "$\\alpha".length, to: "$\\alpha".length });
    expect(session.next()).toBe(true);
    expect(editor.selection).toEqual({ from: "$\\alpha$ ".length, to: "$\\alpha$ ".length });
  });

  test("org-env snippets map title, content, and final cursor stops after render", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount);
    try {
      const session = new SnippetSession(editor);
      expect(session.insert({
        key: "thm",
        name: "Theorem block",
        mode: "markdown-mode",
        body: "#+begin theorem ${1:name}\n${2:Statement.}\n#+end theorem\n$0",
      })).toBe(true);

      const block = editor.view.state.doc.child(0);
      expect(block.type.name).toBe("org_env_block");
      expect(block.attrs.kind).toBe("theorem");

      const title = mount.querySelector<HTMLInputElement>(".org-env-heading-title");
      expect(title).not.toBeNull();
      expect(document.activeElement).toBe(title);
      title!.value = "Spectral";
      title!.dispatchEvent(new Event("input", { bubbles: true }));

      expect(session.next()).toBe(true);
      let selection = editor.getSelection();
      expect(editor.textBetween(selection.from, selection.to)).toBe("Statement.");

      editor.replaceRange(selection.from, selection.to, "Every normal operator is diagonalizable.", "end");
      expect(session.next()).toBe(true);
      selection = editor.getSelection();
      expect(editor.view.state.selection.$from.parent.type.name).toBe("paragraph");
      expect(selection.from).toBe(selection.to);
      expect(editor.getMarkdown()).toBe(
        "#+begin theorem Spectral\nEvery normal operator is diagonalizable.\n#+end theorem",
      );
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("display-math snippet keeps the editable field inside the math body", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor(mount);
    try {
      const session = new SnippetSession(editor);
      expect(session.insert({
        key: ":",
        name: "Display math",
        mode: "markdown-mode",
        body: "$$\n$1\n$$\n$0",
      })).toBe(true);

      let selection = editor.getSelection();
      expect(selection.from).toBe(selection.to);
      editor.replaceRange(selection.from, selection.to, "a", "end");
      expect(editor.getMarkdown()).toBe("$$\na\n$$");

      feedEvent(editor.view, "<Enter>");
      expect(editor.getMarkdown()).toBe("$$\na\n\n$$");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("tex snippet confirmed inside display math keeps selection inside the formula", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
      const editor = createEditor(mount);
    try {
      editor.setMarkdown("$$\nfrac\n$$");
      editor.setSelection(1 + "frac".length);
      const session = new SnippetSession(editor);
      expect(session.insert({
        key: "frac",
        name: "Fraction",
        mode: "tex-mode",
        body: "\\frac{${1:a}}{${2:b}}$0",
      }, 4)).toBe(true);

      expect(editor.getMarkdown()).toBe("$$\n\\frac{a}{b}\n$$");
      const selection = editor.getSelection();
      expect(editor.textBetween(selection.from, selection.to)).toBe("a");
      expect(editor.view.state.selection.$from.parent.type.name).toBe("math_block");
      expect(editor.view.state.selection.$from.parent.textContent).toBe("\\frac{a}{b}");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });

  test("plain tex snippet confirmed inside inline math keeps cursor before the closing dollar", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
      const editor = createEditor(mount);
    try {
      editor.setMarkdown("$aaaa$");
      editor.setSelection(1 + "$aaaa".length);
      const session = new SnippetSession(editor);
      expect(session.insert({
        key: "aaaa",
        name: "Alpha",
        mode: "tex-mode",
        body: "\\alpha",
      }, 4)).toBe(true);

      expect(editor.getMarkdown()).toBe("$\\alpha$");
      const selection = editor.getSelection();
      expect(selection.from).toBe(selection.to);
      expect(editor.textBetween(selection.from - "\\alpha".length, selection.from)).toBe("\\alpha");
      expect(editor.textBetween(selection.from, selection.from + 1)).toBe("$");
    } finally {
      editor.destroy();
      mount.remove();
    }
  });
});
