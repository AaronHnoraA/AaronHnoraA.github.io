import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore The plugin is bundled from the workspace root, outside the app TS include.
import { setup } from "../../plugin/copilot/index.ts";

class FakeEditor {
  markdown: string;
  selection: { from: number; to: number };
  cursorBefore = "";
  cursorAfter = "";
  insertions: string[] = [];

  constructor(markdown: string) {
    this.markdown = markdown;
    this.selection = { from: markdown.length, to: markdown.length };
  }

  getMarkdown(): string {
    return this.markdown;
  }

  getMarkdownSelection(): { from: number; to: number } {
    return this.selection;
  }

  insertText(text: string): { from: number; to: number } {
    const from = this.selection.from;
    const to = this.selection.to;
    this.insertions.push(text);
    this.markdown = `${this.markdown.slice(0, from)}${text}${this.markdown.slice(to)}`;
    this.selection = { from: from + text.length, to: from + text.length };
    return { from, to: from + text.length };
  }

  cursorContext(): { before: string; after: string; rect: { left: number; top: number; bottom: number } } {
    return { before: this.cursorBefore, after: this.cursorAfter, rect: { left: 0, top: 0, bottom: 20 } };
  }

  revealCursor(): void {}
}

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    statusText: "OK",
    json: async () => value,
  } as Response;
}

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("copilot plugin insertion", () => {
  test("accepting a suggestion inserts at the cursor instead of replacing the LSP range", async () => {
    const host = document.createElement("div");
    const target = document.createElement("button");
    host.appendChild(target);
    document.body.appendChild(host);

    const editor = new FakeEditor("prefix");
    const oldFetch = globalThis.fetch;
    const handlers: {
      key?: (event: KeyboardEvent) => boolean;
      action?: (action: string) => void;
    } = {};

    globalThis.fetch = (async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/api/copilot/inline")) {
        return jsonResponse({
          items: [{
            insertText: "prefixSuffix",
            range: { from: 0, to: editor.markdown.length },
            item: { insertText: "prefixSuffix" },
          }],
        });
      }
      return jsonResponse({ ok: true });
    }) as typeof fetch;

    const cleanup = setup({
      editor,
      host,
      currentFile: () => "/tmp/copilot.md",
      vimMode: () => "insert",
      setStatus: () => {},
      onChange: () => () => {},
      onKeyDown: (handler: (event: KeyboardEvent) => boolean) => {
        handlers.key = handler;
        return () => {
          delete handlers.key;
        };
      },
      onAction: (handler: (action: string) => void) => {
        handlers.action = handler;
        return () => {
          delete handlers.action;
        };
      },
      onSettingsChange: () => () => {},
      getSettings: () => ({ idleDelayMs: 999_999, largeBufferThresholdKb: 512 }),
      onDocumentEvent: () => () => {},
      jumpSnippetNext: () => false,
      jumpSnippetPrevious: () => false,
      forwardDelimiter: () => false,
      backwardDelimiter: () => false,
    });

    try {
      target.focus();
      handlers.action?.("trigger");
      await waitForMicrotasks();
      await waitForMicrotasks();
      expect(document.querySelector(".aaronnote-copilot-ghost")?.textContent).toBe("Suffix");

      target.addEventListener("keydown", (event) => {
        handlers.key?.(event);
      });
      target.dispatchEvent(new KeyboardEvent("keydown", {
        key: "]",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }));

      expect(editor.insertions).toEqual(["Suffix"]);
      expect(editor.markdown).toBe("prefixSuffix");
    } finally {
      cleanup();
      globalThis.fetch = oldFetch;
      host.remove();
    }
  });

  test("document eligibility uses the active cursor tail instead of markdown line tail", async () => {
    const host = document.createElement("div");
    const target = document.createElement("button");
    host.appendChild(target);
    document.body.appendChild(host);

    const editor = new FakeEditor("prefix suffix");
    editor.selection = { from: "prefix".length, to: "prefix".length };
    editor.cursorAfter = "";
    const oldFetch = globalThis.fetch;
    const handlers: {
      action?: (action: string) => void;
    } = {};
    let inlineRequests = 0;

    globalThis.fetch = (async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/api/copilot/inline")) {
        inlineRequests += 1;
        return jsonResponse({
          items: [{
            insertText: "Suffix",
            range: { from: editor.selection.to, to: editor.selection.to },
            item: { insertText: "Suffix" },
          }],
        });
      }
      return jsonResponse({ ok: true });
    }) as typeof fetch;

    const cleanup = setup({
      editor,
      host,
      currentFile: () => "/tmp/document.md",
      vimMode: () => "insert",
      setStatus: () => {},
      onChange: () => () => {},
      onKeyDown: () => () => {},
      onAction: (handler: (action: string) => void) => {
        handlers.action = handler;
        return () => {
          delete handlers.action;
        };
      },
      onSettingsChange: () => () => {},
      getSettings: () => ({ idleDelayMs: 999_999, largeBufferThresholdKb: 512 }),
      onDocumentEvent: () => () => {},
      jumpSnippetNext: () => false,
      jumpSnippetPrevious: () => false,
      forwardDelimiter: () => false,
      backwardDelimiter: () => false,
    });

    try {
      target.focus();
      handlers.action?.("trigger");
      await waitForMicrotasks();
      await waitForMicrotasks();
      expect(inlineRequests).toBe(1);
      expect(document.querySelector(".aaronnote-copilot-ghost")?.textContent).toBe("Suffix");
    } finally {
      cleanup();
      globalThis.fetch = oldFetch;
      host.remove();
    }
  });

  test("large documents send only a cursor-local completion window", async () => {
    const host = document.createElement("div");
    const target = document.createElement("button");
    host.appendChild(target);
    document.body.appendChild(host);

    const markdown = `${"a".repeat(2000)}\nneedle`;
    const editor = new FakeEditor(markdown);
    const oldFetch = globalThis.fetch;
    const handlers: {
      action?: (action: string) => void;
    } = {};
    let inlineBody: { content: string; offset: number; window?: { from: number; to: number } } | null = null;

    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/api/copilot/inline")) {
        inlineBody = JSON.parse(String(init?.body || "{}"));
        return jsonResponse({
          items: [{
            insertText: "needleSuffix",
            range: { from: inlineBody!.offset - "needle".length, to: inlineBody!.offset },
            item: { insertText: "needleSuffix" },
          }],
        });
      }
      return jsonResponse({ ok: true });
    }) as typeof fetch;

    const cleanup = setup({
      editor,
      host,
      currentFile: () => "/tmp/large.md",
      vimMode: () => "insert",
      setStatus: () => {},
      onChange: () => () => {},
      onKeyDown: () => () => {},
      onAction: (handler: (action: string) => void) => {
        handlers.action = handler;
        return () => {
          delete handlers.action;
        };
      },
      onSettingsChange: () => () => {},
      getSettings: () => ({ idleDelayMs: 999_999, largeBufferThresholdKb: 1 }),
      onDocumentEvent: () => () => {},
      jumpSnippetNext: () => false,
      jumpSnippetPrevious: () => false,
      forwardDelimiter: () => false,
      backwardDelimiter: () => false,
    });

    try {
      target.focus();
      handlers.action?.("trigger");
      await waitForMicrotasks();
      await waitForMicrotasks();

      expect(inlineBody).not.toBeNull();
      expect(inlineBody!.content.length).toBeLessThanOrEqual(1024);
      expect(inlineBody!.content).toContain("needle");
      expect(inlineBody!.offset).toBe(inlineBody!.content.indexOf("needle") + "needle".length);
      expect(inlineBody!.window?.from).toBeGreaterThan(0);
      expect(document.querySelector(".aaronnote-copilot-ghost")?.textContent).toBe("Suffix");
    } finally {
      cleanup();
      globalThis.fetch = oldFetch;
      host.remove();
    }
  });

});
