import { describe, expect, test } from "@voidzero-dev/vite-plus-test";
import { TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { createState } from "../src/editor.ts";
import { parse } from "../src/parser.ts";
import { serialize } from "../src/serializer.ts";

describe("inline todo and org comment notes", () => {
  test("inline todo source normalizes to an inline mark in prose", () => {
    const doc = parse("body @@todo [update statement] tail");
    const base = createState(doc);
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, 1)));
    const paragraph = state.doc.child(0);
    expect(paragraph.textContent).toBe("body @@todo [update statement] tail");
    let marked = false;
    paragraph.forEach((child) => {
      if (child.marks.some((mark) => mark.type.name === "inline_todo")) marked = true;
    });
    expect(marked).toBe(true);
  });

  test("inline todo renders as folded widget when cursor is outside source", () => {
    const doc = parse("body @@todo [update statement] tail");
    const base = createState(doc);
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, 1)));
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const widget = view.dom.querySelector<HTMLElement>(".inline-todo-widget");
      expect(widget).not.toBeNull();
      expect(widget!.dataset.status).toBe("todo");
      expect(widget!.querySelector(".inline-todo-text")?.textContent).toBe("update statement");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("cursor inside inline todo source hides the folded widget", () => {
    const source = "body @@todo [update statement] tail";
    const doc = parse(source);
    const base = createState(doc);
    const inside = source.indexOf("update");
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, 1 + inside)));
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      expect(view.dom.querySelector(".inline-todo-widget")).toBeNull();
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("clicking inline todo chip cycles status in source", () => {
    const state = createState(parse("body @@todo [update statement] tail"));
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const widget = view.dom.querySelector<HTMLElement>(".inline-todo-widget");
      expect(widget).not.toBeNull();
      widget!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(serialize(view.state.doc).trim()).toBe("body @@todo(doing) [update statement] tail");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("org comment block is collapsed until its button is clicked", () => {
    const doc = parse("intro\n\n#+begin comment Proof gap\ncheck this\n#+end comment");
    const base = createState(doc);
    const state = base.apply(base.tr.setSelection(TextSelection.create(doc, 1)));
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    try {
      const block = view.dom.querySelector<HTMLElement>('org-env-block[data-kind="comment"]');
      const button = block?.querySelector<HTMLButtonElement>(".org-env-comment-button");
      const content = block?.querySelector<HTMLElement>(".org-env-content");
      expect(block).not.toBeNull();
      expect(button).not.toBeNull();
      expect(content?.hidden).toBe(true);
      button!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(block!.classList.contains("org-env-comment-open")).toBe(true);
      expect(content?.hidden).toBe(false);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
      expect(block!.classList.contains("org-env-comment-open")).toBe(true);
      expect(content?.hidden).toBe(false);
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(block!.classList.contains("org-env-comment-open")).toBe(false);
      expect(content?.hidden).toBe(true);
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(block!.classList.contains("org-env-comment-open")).toBe(true);
      expect(content?.hidden).toBe(false);
    } finally {
      view.destroy();
      mount.remove();
    }
  });
});
