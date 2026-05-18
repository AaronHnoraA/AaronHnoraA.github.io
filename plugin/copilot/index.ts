type Rect = { left: number; top: number; bottom: number };
type EditorLike = {
  getMarkdown(): string;
  getMarkdownSelection(): { from: number; to: number };
  insertText(text: string, deleteBefore?: number): { from: number; to: number };
  cursorContext(maxChars?: number): { before?: string; after?: string; rect: Rect | null };
  revealCursor(): void;
};
type VimMode = "insert" | "normal" | "visual" | "visual-line";
type Context = {
  editor: EditorLike;
  host: HTMLElement;
  currentFile: () => string;
  vimMode: () => VimMode;
  setStatus: (message: string) => void;
  onChange: (handler: () => void) => () => void;
  onKeyDown: (handler: (event: KeyboardEvent) => boolean) => () => void;
  onAction: (handler: (action: string) => void) => () => void;
  onSettingsChange: (handler: (settings: PluginSettings) => void) => () => void;
  getSettings: () => PluginSettings;
  onDocumentEvent: <K extends keyof DocumentEventMap>(
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => () => void;
  jumpSnippetNext: () => boolean;
  jumpSnippetPrevious: () => boolean;
  forwardDelimiter: () => boolean;
  backwardDelimiter: () => boolean;
};
type CompletionRange = { from: number; to: number };
type CompletionItem = {
  insertText: string;
  range?: {
    start?: { line: number; character: number };
    end?: { line: number; character: number };
  };
  command?: { command?: string; arguments?: unknown[] };
};
type InlineChoice = {
  insertText: string;
  range: CompletionRange;
  item: CompletionItem;
};
type InlineResponse = {
  items?: InlineChoice[];
  status?: { message?: string; kind?: string };
  message?: string;
};
type VisibleCompletion = InlineChoice & {
  acceptedLength: number;
  acceptedBaseLength: number;
};
type PluginSettings = Record<string, string | number | boolean>;
let logRecording = false;
type RuntimeSettings = {
  idleDelayMs: number;
  largeBufferThreshold: number;
};

const defaultIdleDelayMs = 850;
const defaultLargeBufferThresholdKb = 512;
const forwardKeys = new Set(["]", "】", "］", "」", "〕"]);
const backwardKeys = new Set(["[", "【", "［", "「", "〔"]);
const wordKeys = new Set(["\\", "、", "＼"]);
const toCharKeys = new Set(["}", "｝", "〗", "』"]);

function numericSetting(value: string | number | boolean | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeSettings(settings: PluginSettings): RuntimeSettings {
  return {
    idleDelayMs: numericSetting(settings.idleDelayMs, defaultIdleDelayMs),
    largeBufferThreshold: numericSetting(settings.largeBufferThresholdKb, defaultLargeBufferThresholdKb) * 1024,
  };
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const msg = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(msg.message || res.statusText || "Copilot request failed"));
    return msg as T;
  });
}

function getJson<T>(url: string): Promise<T> {
  return fetch(url).then(async (res) => {
    const msg = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(msg.message || res.statusText || "Copilot request failed"));
    return msg as T;
  });
}

function statusSummary(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const obj = value as { status?: { message?: string; kind?: string }; result?: unknown; user?: string; message?: string };
  if (obj.message) return `Copilot: ${obj.message}`;
  if (obj.status?.message) return `Copilot: ${obj.status.message}`;
  if (obj.status?.kind) return `Copilot: ${obj.status.kind}`;
  if (obj.user) return `Copilot: ${obj.user}`;
  if (obj.result != null) return `Copilot: ${JSON.stringify(obj.result).slice(0, 160)}`;
  return fallback;
}

async function copyLog(value: unknown): Promise<void> {
  const text = JSON.stringify(value, null, 2);
  console.log("Aaronnote Copilot log", value);
  await navigator.clipboard?.writeText(text);
}

function targetInHost(host: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof Node && host.contains(target);
}

function cmdOnly(event: KeyboardEvent): boolean {
  return event.metaKey && !event.ctrlKey && !event.altKey;
}

function printableKey(event: KeyboardEvent): string {
  if (event.metaKey || event.ctrlKey || event.altKey) return "";
  if (event.key.length !== 1) return "";
  return event.key;
}

function nextWordLength(text: string): number {
  if (!text) return 0;
  if (text[0] === "\n") {
    const match = text.match(/^\n[ \t]*/);
    return match?.[0].length ?? 1;
  }
  let i = 0;
  while (i < text.length && /[ \t]/.test(text[i] ?? "")) i++;
  if (i > 0) return i;
  while (i < text.length && /[A-Za-z0-9_$-]/.test(text[i] ?? "")) i++;
  return i > 0 ? i : 1;
}

function visibleText(visible: VisibleCompletion): string {
  return visible.insertText.slice(visible.acceptedLength);
}

function hasRealTextAfterCursorOnLine(after: string | undefined): boolean {
  if (!after) return false;
  const lineEnd = after.indexOf("\n");
  const activeLineTail = after.slice(0, lineEnd < 0 ? after.length : lineEnd);
  return activeLineTail.trim().length > 0;
}

function clampedOffset(markdown: string, offset: number): number {
  return Math.max(0, Math.min(offset, markdown.length));
}

function currentLinePrefix(markdown: string, offset: number): string {
  const cursor = clampedOffset(markdown, offset);
  const lineStart = markdown.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  return markdown.slice(lineStart, cursor);
}

function trimmedCompletionInsertText(
  choice: InlineChoice,
  markdown: string,
  offset: number,
): { insertText: string; acceptedBaseLength: number } {
  const insertText = choice.insertText;
  const cursor = clampedOffset(markdown, offset);
  const rangeFrom = clampedOffset(markdown, choice.range.from);
  const rangeTo = clampedOffset(markdown, choice.range.to);
  if (rangeFrom <= cursor && cursor <= rangeTo) {
    const alreadyPresent = markdown.slice(rangeFrom, cursor);
    if (alreadyPresent && insertText.startsWith(alreadyPresent)) {
      return {
        insertText: insertText.slice(alreadyPresent.length),
        acceptedBaseLength: alreadyPresent.length,
      };
    }
  }

  const linePrefix = currentLinePrefix(markdown, cursor);
  if (linePrefix && insertText.startsWith(linePrefix)) {
    return {
      insertText: insertText.slice(linePrefix.length),
      acceptedBaseLength: linePrefix.length,
    };
  }

  const unindentedLinePrefix = linePrefix.replace(/^[ \t]+/, "");
  if (unindentedLinePrefix && insertText.startsWith(unindentedLinePrefix)) {
    return {
      insertText: insertText.slice(unindentedLinePrefix.length),
      acceptedBaseLength: unindentedLinePrefix.length,
    };
  }

  return { insertText, acceptedBaseLength: 0 };
}

export function setup(context: Context): () => void {
  const ghost = document.createElement("div");
  ghost.className = "aaronnote-copilot-ghost";
  ghost.hidden = true;
  document.body.appendChild(ghost);

  const style = document.createElement("style");
  style.textContent = `
.aaronnote-copilot-ghost {
  position: fixed;
  z-index: 80;
  pointer-events: none;
  color: color-mix(in srgb, currentColor 38%, transparent);
  white-space: pre;
  font: 15px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
`;
  document.head.appendChild(style);

  let timer = 0;
  let seq = 0;
  let accepting = false;
  let pendingToChar = false;
  let visible: VisibleCompletion | null = null;
  let settings = normalizeSettings(context.getSettings());
  const cleanups: Array<() => void> = [];

  function clearCompletion(): void {
    visible = null;
    pendingToChar = false;
    ghost.hidden = true;
  }

  function renderCompletion(): void {
    if (!visible) {
      ghost.hidden = true;
      return;
    }
    const text = visibleText(visible);
    if (!text) {
      clearCompletion();
      return;
    }
    const rect = context.editor.cursorContext(1600).rect;
    if (!rect) {
      ghost.hidden = true;
      return;
    }
    ghost.textContent = text.split("\n", 1)[0] || " ";
    ghost.style.left = `${Math.max(0, rect.left)}px`;
    ghost.style.top = `${Math.max(0, rect.top)}px`;
    ghost.hidden = false;
  }

  function requestKey(): string {
    const selection = context.editor.getMarkdownSelection();
    return `${context.currentFile()}\0${selection.from}\0${selection.to}\0${context.editor.getMarkdown().length}`;
  }

  function eligible(): boolean {
    if (context.vimMode() !== "insert") return false;
    if (!targetInHost(context.host, document.activeElement)) return false;
    const markdown = context.editor.getMarkdown();
    if (settings.largeBufferThreshold > 0 && markdown.length > settings.largeBufferThreshold) return false;
    const selection = context.editor.getMarkdownSelection();
    if (selection.from !== selection.to) return false;
    return !hasRealTextAfterCursorOnLine(context.editor.cursorContext(512).after);
  }

  function schedule(): void {
    window.clearTimeout(timer);
    if (!eligible()) {
      clearCompletion();
      return;
    }
    timer = window.setTimeout(() => void requestCompletion(), settings.idleDelayMs);
  }

  async function requestCompletion(): Promise<void> {
    if (!eligible()) return;
    const markdown = context.editor.getMarkdown();
    const selection = context.editor.getMarkdownSelection();
    const key = requestKey();
    const currentSeq = ++seq;
    try {
      const response = await postJson<InlineResponse>("/api/copilot/inline", {
        file: context.currentFile(),
        content: markdown,
        offset: selection.to,
      });
      if (currentSeq !== seq || key !== requestKey()) return;
      const choice = response.items?.[0];
      if (!choice?.insertText) {
        clearCompletion();
        if (response.status?.kind === "Error" && response.status.message) {
          context.setStatus(`Copilot: ${response.status.message}`);
        }
        return;
      }
      if (hasRealTextAfterCursorOnLine(context.editor.cursorContext(512).after)) {
        clearCompletion();
        return;
      }
      const trimmed = trimmedCompletionInsertText(choice, markdown, selection.to);
      if (!trimmed.insertText) {
        clearCompletion();
        return;
      }
      visible = { ...choice, ...trimmed, acceptedLength: 0 };
      renderCompletion();
      void postJson("/api/copilot/shown", { item: choice.item }).catch(() => {});
    } catch (err) {
      clearCompletion();
      context.setStatus(err instanceof Error ? `Copilot: ${err.message}` : "Copilot failed");
    }
  }

  function acceptLength(length: number): boolean {
    if (!visible) return false;
    const remaining = visibleText(visible);
    const count = Math.max(0, Math.min(length, remaining.length));
    if (count <= 0) return false;
    const text = remaining.slice(0, count);
    const selection = context.editor.getMarkdownSelection();
    if (selection.from !== selection.to) {
      clearCompletion();
      return false;
    }
    accepting = true;
    context.editor.insertText(text);
    window.setTimeout(() => {
      accepting = false;
    }, 0);
    visible.acceptedLength += text.length;
    context.editor.revealCursor();
    if (visible.acceptedLength >= visible.insertText.length) {
      const item = visible.item;
      clearCompletion();
      void postJson("/api/copilot/accept", { item }).catch(() => {});
    } else {
      renderCompletion();
      void postJson("/api/copilot/accept", {
        item: visible.item,
        acceptedLength: visible.acceptedBaseLength + visible.acceptedLength,
      }).catch(() => {});
    }
    return true;
  }

  function acceptAll(): boolean {
    if (!visible) return false;
    return acceptLength(visibleText(visible).length);
  }

  function acceptWord(): boolean {
    if (!visible) return false;
    return acceptLength(nextWordLength(visibleText(visible)));
  }

  function acceptToChar(ch: string): boolean {
    if (!visible) return false;
    const remaining = visibleText(visible);
    const index = remaining.indexOf(ch);
    if (index < 0) {
      context.setStatus(`Copilot: ${ch} not in completion`);
      pendingToChar = false;
      return true;
    }
    pendingToChar = false;
    return acceptLength(index + ch.length);
  }

  function handleKey(event: KeyboardEvent): boolean {
    if (!targetInHost(context.host, event.target)) return false;
    if (pendingToChar) {
      if (event.key === "Escape") {
        pendingToChar = false;
        context.setStatus("Copilot to-char canceled");
        event.preventDefault();
        return true;
      }
      const ch = printableKey(event);
      if (!ch) return false;
      event.preventDefault();
      return acceptToChar(ch);
    }
    if (context.vimMode() !== "insert" || !cmdOnly(event)) return false;
    if (!event.shiftKey && forwardKeys.has(event.key)) {
      event.preventDefault();
      if (context.jumpSnippetNext()) return true;
      if (acceptAll()) return true;
      return context.forwardDelimiter();
    }
    if (!event.shiftKey && backwardKeys.has(event.key)) {
      event.preventDefault();
      if (context.jumpSnippetPrevious()) return true;
      return context.backwardDelimiter();
    }
    if (!event.shiftKey && wordKeys.has(event.key)) {
      event.preventDefault();
      if (context.jumpSnippetNext()) return true;
      if (acceptWord()) return true;
      return context.forwardDelimiter();
    }
    if (event.shiftKey && toCharKeys.has(event.key)) {
      event.preventDefault();
      if (context.jumpSnippetNext()) return true;
      if (!visible) return context.forwardDelimiter();
      pendingToChar = true;
      context.setStatus("Copilot to char");
      return true;
    }
    return false;
  }

  function runAction(action: string): void {
    void (async () => {
      try {
        if (action === "sign-in") {
          const res = await postJson<unknown>("/api/copilot/sign-in", {});
          const code = res && typeof res === "object" && "userCode" in res ? String((res as { userCode?: unknown }).userCode || "") : "";
          if (code) {
            await navigator.clipboard?.writeText(code);
            context.setStatus(`Copilot login code: ${code} copied`);
          } else {
            context.setStatus(statusSummary(res, "Copilot login started"));
          }
          return;
        }
        if (action === "sign-out") {
          const res = await postJson<unknown>("/api/copilot/sign-out", {});
          clearCompletion();
          context.setStatus(statusSummary(res, "Copilot logged out"));
          return;
        }
        if (action === "status") {
          const res = await getJson<unknown>("/api/copilot/status");
          context.setStatus(statusSummary(res, "Copilot status checked"));
          return;
        }
        if (action === "quota") {
          const res = await postJson<unknown>("/api/copilot/quota", {});
          context.setStatus(statusSummary(res, "Copilot quota checked"));
          return;
        }
        if (action === "trigger") {
          clearCompletion();
          await requestCompletion();
          if (!visible) context.setStatus("Copilot: no suggestion");
          return;
        }
        if (action === "log") {
          if (!logRecording) {
            const res = await postJson<unknown>("/api/copilot/log", { record: true });
            logRecording = true;
            context.setStatus(statusSummary(res, "Copilot log recording started"));
            return;
          }
          const res = await postJson<unknown>("/api/copilot/log", { record: false });
          logRecording = false;
          await copyLog(res);
          context.setStatus("Copilot logs copied");
        }
      } catch (err) {
        context.setStatus(err instanceof Error ? `Copilot: ${err.message}` : "Copilot action failed");
      }
    })();
  }

  cleanups.push(context.onKeyDown(handleKey));
  cleanups.push(context.onAction(runAction));
  cleanups.push(context.onSettingsChange((next) => {
    settings = normalizeSettings(next);
    clearCompletion();
    schedule();
  }));
  cleanups.push(context.onChange(() => {
    if (accepting) return;
    clearCompletion();
    schedule();
  }));
  cleanups.push(context.onDocumentEvent("selectionchange", () => {
    if (accepting) return;
    clearCompletion();
    schedule();
  }));
  cleanups.push(context.onDocumentEvent("mouseup", schedule));
  cleanups.push(context.onDocumentEvent("keyup", schedule));
  cleanups.push(context.onDocumentEvent("scroll", () => renderCompletion(), { capture: true }));
  window.addEventListener("resize", renderCompletion);
  cleanups.push(() => window.removeEventListener("resize", renderCompletion));
  schedule();

  return () => {
    window.clearTimeout(timer);
    cleanups.splice(0).forEach((cleanup) => cleanup());
    ghost.remove();
    style.remove();
  };
}
