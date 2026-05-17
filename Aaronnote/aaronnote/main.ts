import "prosemirror-view/style/prosemirror.css";
import "katex/dist/katex.min.css";
import "../src/styles/widgets.css";
import "../src/styles/theme-typora.css";
import "./style.css";

import katex from "katex";
import { createEditor } from "../src/lib.ts";
import { SnippetSession, snippetDetail, snippetLabel, snippetScore } from "./snippets.ts";
import type { Inbound, NoteSummary, SnippetSummary } from "./types.ts";
import { createVimLite, type VimLiteMode } from "./vim-lite.ts";
import { createVimCursor, updateVimCursor } from "./vim-cursor.ts";

const params = new URLSearchParams(window.location.search);
const emacsPort = params.get("emacsPort") || "";
const token = params.get("token") || "";

const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `
  <main class="aaronnote-shell">
    <header class="aaronnote-toolbar">
      <div class="aaronnote-title">
        <strong>Aaronnote</strong>
        <span data-file-label>No file</span>
      </div>
      <div class="aaronnote-actions">
        <button type="button" data-action="notes">Notes</button>
        <button type="button" data-action="source">Source</button>
        <button type="button" data-action="editor" hidden>Editor</button>
      </div>
      <span class="aaronnote-vim-mode" data-vim-mode>INSERT</span>
      <span class="aaronnote-status" data-status>Connecting</span>
    </header>
    <section class="aaronnote-body">
      <section class="aaronnote-editor" id="editor"></section>
      <section class="aaronnote-notes" data-notes-page hidden>
        <div class="aaronnote-notes-inner">
          <header class="aaronnote-notes-head">
            <h1>Notes</h1>
            <button type="button" data-action="editor-inline">Back</button>
          </header>
          <input data-note-filter type="search" placeholder="Filter notes" />
          <div data-note-list class="aaronnote-note-list"></div>
        </div>
      </section>
    </section>
    <aside class="aaronnote-floating-toc is-collapsed" data-floating-toc>
      <button type="button" data-toc-toggle>TOC</button>
      <nav data-toc-list></nav>
    </aside>
  </main>
`;

const host = document.querySelector<HTMLElement>("#editor")!;
const statusEl = document.querySelector<HTMLElement>("[data-status]")!;
const vimModeEl = document.querySelector<HTMLElement>("[data-vim-mode]")!;
const fileLabel = document.querySelector<HTMLElement>("[data-file-label]")!;
const noteList = document.querySelector<HTMLElement>("[data-note-list]")!;
const noteFilter = document.querySelector<HTMLInputElement>("[data-note-filter]")!;
const notesPage = document.querySelector<HTMLElement>("[data-notes-page]")!;
const notesButton = document.querySelector<HTMLButtonElement>("[data-action='notes']")!;
const sourceButton = document.querySelector<HTMLButtonElement>("[data-action='source']")!;
const editorButton = document.querySelector<HTMLButtonElement>("[data-action='editor']")!;
const editorInlineButton = document.querySelector<HTMLButtonElement>("[data-action='editor-inline']")!;
const toc = document.querySelector<HTMLElement>("[data-floating-toc]")!;
const tocList = document.querySelector<HTMLElement>("[data-toc-list]")!;
const tocToggle = document.querySelector<HTMLButtonElement>("[data-toc-toggle]")!;
const snippetPopup = document.createElement("div");
snippetPopup.className = "aaronnote-snippet-popup";
snippetPopup.hidden = true;
document.body.appendChild(snippetPopup);

const mathPreview = document.createElement("div");
mathPreview.className = "aaronnote-math-preview";
mathPreview.hidden = true;
document.body.appendChild(mathPreview);

const selectionTool = document.createElement("button");
selectionTool.type = "button";
selectionTool.className = "aaronnote-selection-tool";
selectionTool.textContent = "Copy";
selectionTool.hidden = true;
document.body.appendChild(selectionTool);

const vimCursor = createVimCursor();

let currentFile = "";
let currentMode: "markdown" | "source" = "markdown";
let saveTimer = 0;
let ws: WebSocket | null = null;
let notes: NoteSummary[] = [];
let snippets: SnippetSummary[] = [];
let receivedOpen = false;
let assistFrame = 0;
let assistTimer = 0;
let vimMode: VimLiteMode = "insert";
let snippetPopupItems: SnippetSummary[] = [];
let snippetPopupIndex = 0;
let snippetDeleteBefore = 0;
let snippetSuppressedPrefix = "";
let snippetRenderKey = "";
let snippetSession: SnippetSession;
let mathPreviewKey = "";
let tocRenderKey = "";
let snippetScanRequested = false;

const demoSnippets: SnippetSummary[] = [
  {
    key: ";",
    name: "Inline math",
    mode: "markdown-mode",
    group: "Aaronnote local",
    body: "$${1:x}$ $0",
  },
  {
    key: "eq",
    name: "Display equation",
    mode: "markdown-mode",
    group: "Aaronnote local",
    body: "$$\n${1:E = mc^2}\n$$\n$0",
  },
  {
    key: "proof",
    name: "Proof block",
    mode: "markdown-mode",
    group: "Aaronnote local",
    body: "#+begin proof\n${1:Proof.}\n#+end proof\n$0",
  },
  {
    key: "thm",
    name: "Theorem block",
    mode: "markdown-mode",
    group: "Aaronnote local",
    body: "#+begin theorem ${1:name}\n${2:Statement.}\n#+end theorem\n$0",
  },
  {
    key: "frac",
    name: "Fraction",
    mode: "tex-mode",
    group: "Aaronnote local",
    body: "\\frac{${1:a}}{${2:b}}$0",
  },
  {
    key: "o+",
    name: "Direct sum",
    mode: "tex-mode",
    group: "Aaronnote local",
    body: "\\oplus",
  },
  {
    key: "ox",
    name: "Tensor product",
    mode: "tex-mode",
    group: "Aaronnote local",
    body: "\\otimes",
  },
];

function scratchStatus(): string {
  return "Scratch";
}

const editor = createEditor(host, {
  initialContent: "",
  onChange: () => {
    scheduleAssistUpdate({ snippets: true });
    if (!currentFile) {
      setStatus(scratchStatus());
      return;
    }
    setStatus("Dirty");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => save(), 900);
  },
});
snippetSession = new SnippetSession(editor);

const vim = createVimLite(editor, host, {
  onUndo: () => editor.undo(),
  onRedo: () => editor.redo(),
  onModeChange(mode) {
    vimMode = mode;
    root.dataset.vimMode = mode;
    vimModeEl.textContent = mode === "visual-line" ? "VISUAL LINE" : mode.toUpperCase();
    if (mode !== "insert") {
      hideSnippetPopup();
      mathPreview.hidden = true;
      setStatus(mode === "visual-line" ? "VISUAL LINE" : mode.toUpperCase());
      scheduleAssistUpdate();
    } else {
      setStatus(currentFile ? "INSERT" : scratchStatus());
      scheduleAssistUpdate();
    }
  },
});

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function send(payload: Record<string, unknown>): void {
  const msg = JSON.stringify({ token, ...payload });
  if (ws?.readyState === WebSocket.OPEN) ws.send(msg);
}

function save(): void {
  if (!currentFile) {
    setStatus(scratchStatus());
    return;
  }
  if (!emacsPort || !token) {
    void saveStandalone();
    return;
  }
  send({
    type: "save",
    file: currentFile,
    content: editor.getMarkdown(),
    mode: editor.isSourceMode() ? "source" : "markdown",
  });
  setStatus("Saving");
}

function syncSourceUi(): void {
  currentMode = editor.isSourceMode() ? "source" : "markdown";
  host.classList.toggle("is-source-mode", currentMode === "source");
  sourceButton.textContent = currentMode === "source" ? "Preview" : "Source";
}

async function saveStandalone(): Promise<void> {
  setStatus("Saving");
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file: currentFile,
        content: editor.getMarkdown(),
        mode: editor.isSourceMode() ? "source" : "markdown",
      }),
    });
    const msg = await res.json() as Extract<Inbound, { type: "saved" }>;
    setStatus(res.ok && msg.ok ? "Saved" : msg.message || "Save failed");
    if (Array.isArray(msg.notes)) {
      notes = msg.notes;
      renderNotes();
      updateFloatingToc();
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Save failed");
  }
}

async function exportPdf(): Promise<void> {
  setStatus("Exporting PDF");
  try {
    const res = await fetch("/api/export-pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file: currentFile || "Aaronnote.md",
        content: editor.getMarkdown(),
      }),
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => null) as { message?: string } | null;
      throw new Error(msg?.message || "PDF export failed");
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const rawName = (currentFile || "Aaronnote.md").split(/[\\/]/).pop() || "Aaronnote.md";
    link.href = href;
    link.download = `${rawName.replace(/\.[^.]+$/, "") || "Aaronnote"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    setStatus(`Exported PDF ${link.download}`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "PDF export failed");
  }
}

function toggleSourceMode(): void {
  editor.toggleSource();
  vim.setMode("insert");
  syncSourceUi();
  setStatus(currentMode === "source" ? "Source mode" : "Ready");
  scheduleAssistUpdate();
}

function showNotesPage(): void {
  host.hidden = true;
  notesPage.hidden = false;
  toc.hidden = true;
  notesButton.hidden = true;
  sourceButton.hidden = true;
  editorButton.hidden = false;
  noteFilter.focus();
}

function showEditorPage(): void {
  notesPage.hidden = true;
  host.hidden = false;
  toc.hidden = false;
  notesButton.hidden = false;
  sourceButton.hidden = false;
  editorButton.hidden = true;
  editor.focus();
  scheduleAssistUpdate();
}

function editorHeadings(): Array<{ level: number; text: string; pos: number }> {
  const headings: Array<{ level: number; text: string; pos: number }> = [];
  editor.view.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return true;
    const level = Number(node.attrs.level || 1);
    headings.push({
      level: Number.isFinite(level) ? level : 1,
      text: node.textContent.trim() || "Untitled",
      pos: pos + 1,
    });
    return false;
  });
  return headings;
}

function updateFloatingToc(): void {
  const headings = editorHeadings();
  const selectionPos = editor.view.state.selection.from;
  const activeIndex = headings.reduce((active, heading, index) => heading.pos <= selectionPos ? index : active, -1);
  const currentNote = notes.find((note) => note.file === currentFile);
  const relatedIds = [...(currentNote?.refs ?? []), ...(currentNote?.backlinks ?? [])];
  const key = `${activeIndex}\n${currentNote?.id ?? ""}\n${relatedIds.join(",")}\n${headings.map((h) => `${h.level}:${h.pos}:${h.text}`).join("\n")}`;
  if (key === tocRenderKey) return;
  tocRenderKey = key;
  tocList.innerHTML = "";
  if (headings.length === 0 && relatedIds.length === 0) {
    tocList.innerHTML = `<div class="aaronnote-toc-empty">No headings</div>`;
    return;
  }
  headings.forEach((heading, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === activeIndex ? "aaronnote-toc-item is-active" : "aaronnote-toc-item";
    button.style.setProperty("--toc-depth", String(Math.max(0, heading.level - 1)));
    button.textContent = heading.text;
    button.addEventListener("click", () => {
      editor.setSelection(heading.pos);
      editor.focus();
    });
    tocList.appendChild(button);
  });
  renderRelatedNotes(currentNote);
}

function openNote(note: NoteSummary): void {
  if (!note.file) return;
  if (emacsPort && token) send({ type: "open-file", file: note.file });
  else void openStandaloneFile(note.file);
  showEditorPage();
}

function renderRelatedNotes(currentNote: NoteSummary | undefined): void {
  if (!currentNote) return;
  const byId = new Map(notes.map((note) => [note.id, note]));
  const sections: Array<[string, string[]]> = [
    ["Links", currentNote.refs ?? []],
    ["Backlinks", currentNote.backlinks ?? []],
  ];
  for (const [label, ids] of sections) {
    const resolved = ids.map((id) => byId.get(id)).filter((note): note is NoteSummary => Boolean(note?.file));
    if (resolved.length === 0) continue;
    const head = document.createElement("div");
    head.className = "aaronnote-toc-section";
    head.textContent = label;
    tocList.appendChild(head);
    for (const note of resolved) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "aaronnote-toc-item aaronnote-toc-related";
      button.style.setProperty("--toc-depth", "0");
      button.textContent = note.title || note.id || note.file || "Untitled";
      button.addEventListener("click", () => openNote(note));
      tocList.appendChild(button);
    }
  }
}

function insertSnippet(snippet: SnippetSummary, deleteBefore = 0): void {
  if (!snippetSession.insert(snippet, deleteBefore)) return;
  setStatus(`Inserted ${snippet.key || snippet.name || "snippet"}`);
  scheduleAssistUpdate({ snippets: true });
}

function jumpSnippetTabstop(): boolean {
  const moved = snippetSession.next();
  if (moved) setStatus("Snippet field");
  return moved;
}

function jumpSnippetTabstopBack(): boolean {
  const moved = snippetSession.previous();
  if (moved) setStatus("Snippet field");
  return moved;
}

function matchingSnippets(prefix: string): SnippetSummary[] {
  const query = prefix.toLowerCase();
  return snippets
    .map((snippet) => ({ snippet, score: snippetScore(snippet, query) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return snippetLabel(a.snippet).localeCompare(snippetLabel(b.snippet));
    })
    .slice(0, 10)
    .map((item) => item.snippet);
}

function hideSnippetPopup(): void {
  snippetPopup.hidden = true;
  snippetPopupItems = [];
  snippetRenderKey = "";
}

function placeFloating(el: HTMLElement, rect: { left: number; top: number; bottom: number } | null, width = 320): void {
  if (!rect) {
    el.hidden = true;
    return;
  }
  const margin = 8;
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
  let top = rect.bottom + 8;
  if (top + 240 > window.innerHeight) top = Math.max(margin, rect.top - 220);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${Math.min(width, window.innerWidth - margin * 2)}px`;
}

function placeFloatingAbove(el: HTMLElement, rect: { left: number; top: number; bottom: number } | null, width = 320): void {
  if (!rect) {
    el.hidden = true;
    return;
  }
  const margin = 8;
  const resolvedWidth = Math.min(width, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - resolvedWidth - margin));
  const previewHeight = Math.min(el.offsetHeight || 180, 240);
  let top = rect.top - previewHeight - 8;
  if (top < margin) top = rect.bottom + 8;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${resolvedWidth}px`;
}

function renderSnippetPopup(prefix: string, rect: { left: number; top: number; bottom: number } | null): void {
  const nextKey = `${prefix}\n${snippetPopupIndex}\n${snippetPopupItems.map((snippet) => `${snippet.mode}:${snippet.key}:${snippet.name}`).join("\n")}`;
  if (!snippetPopup.hidden && snippetRenderKey === nextKey) {
    placeFloating(snippetPopup, rect);
    return;
  }
  snippetRenderKey = nextKey;
  snippetPopup.innerHTML = "";
  snippetPopupItems.forEach((snippet, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === snippetPopupIndex
      ? "aaronnote-snippet-option is-active"
      : "aaronnote-snippet-option";
    const key = document.createElement("span");
    key.className = "aaronnote-snippet-option-key";
    key.textContent = snippetLabel(snippet);
    const detail = document.createElement("span");
    detail.className = "aaronnote-snippet-option-detail";
    detail.textContent = snippetDetail(snippet);
    button.append(key, detail);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      snippetPopupIndex = index;
      chooseSnippetPopupItem();
    });
    snippetPopup.appendChild(button);
  });
  snippetPopup.dataset.prefix = prefix;
  snippetPopup.hidden = false;
  placeFloating(snippetPopup, rect);
}

function snippetContextMode(ctx: ReturnType<typeof editor.cursorContext>): string {
  if (mathAtCursor(ctx)) return "tex-mode";
  return "markdown-mode";
}

function updateSnippetPopup(ctx: ReturnType<typeof editor.cursorContext>): void {
  const active = document.activeElement;
  if (!active || !host.contains(active)) {
    hideSnippetPopup();
    return;
  }
  const match = ctx.before.match(/([A-Za-z0-9_:/;.+\\-]{1,40})$/);
  const prefix = match?.[1] ?? "";
  if (!prefix || prefix === snippetSuppressedPrefix) {
    hideSnippetPopup();
    return;
  }
  const mode = snippetContextMode(ctx);
  const matches = matchingSnippets(prefix).filter((snippet) => snippet.mode === mode);
  if (matches.length === 0) {
    hideSnippetPopup();
    return;
  }
  snippetDeleteBefore = prefix.length;
  snippetPopupIndex = Math.min(snippetPopupIndex, matches.length - 1);
  snippetPopupItems = matches;
  renderSnippetPopup(prefix, ctx.rect);
}

function chooseSnippetPopupItem(): void {
  const snippet = snippetPopupItems[snippetPopupIndex];
  if (!snippet) return;
  const deleteBefore = snippetDeleteBefore;
  hideSnippetPopup();
  snippetSuppressedPrefix = "";
  insertSnippet(snippet, deleteBefore);
}

function handleSnippetPopupKey(event: KeyboardEvent): boolean {
  if (snippetPopup.hidden) return false;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    snippetPopupIndex = (snippetPopupIndex + 1) % snippetPopupItems.length;
    renderSnippetPopup(snippetPopup.dataset.prefix ?? "", editor.cursorContext().rect);
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    snippetPopupIndex = (snippetPopupIndex + snippetPopupItems.length - 1) % snippetPopupItems.length;
    renderSnippetPopup(snippetPopup.dataset.prefix ?? "", editor.cursorContext().rect);
    return true;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    chooseSnippetPopupItem();
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    snippetSuppressedPrefix = snippetPopup.dataset.prefix ?? "";
    hideSnippetPopup();
    return true;
  }
  return false;
}

function isEscaped(src: string, pos: number): boolean {
  let count = 0;
  for (let i = pos - 1; i >= 0 && src[i] === "\\"; i--) count++;
  return count % 2 === 1;
}

function findMathClose(src: string, delimiter: "$" | "$$", from: number): number {
  for (let i = from; i < src.length; i++) {
    if (delimiter === "$" && src[i] === "\n") return -1;
    if (src.slice(i, i + delimiter.length) === delimiter && !isEscaped(src, i)) return i;
  }
  return -1;
}

function mathAtCursor(ctx: ReturnType<typeof editor.cursorContext>): { tex: string; display: boolean } | null {
  const src = ctx.before + ctx.after;
  const cursor = ctx.before.length;
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "$" || isEscaped(src, i)) continue;
    const delimiter: "$" | "$$" = src[i + 1] === "$" ? "$$" : "$";
    const openFrom = i;
    const openTo = i + delimiter.length;
    if (openTo > cursor) break;
    const closeFrom = findMathClose(src, delimiter, openTo);
    if (closeFrom >= 0) {
      const closeTo = closeFrom + delimiter.length;
      if (cursor > openFrom && cursor < closeTo) {
        return {
          tex: src.slice(openTo, closeFrom),
          display: delimiter === "$$",
        };
      }
      i = closeTo - 1;
      continue;
    }
    if (cursor >= openTo && openFrom < cursor) {
      const tex = src.slice(openTo, cursor);
      if (delimiter === "$" && tex.includes("\n")) return null;
      return { tex, display: delimiter === "$$" };
    }
  }
  return null;
}

function updateMathPreview(ctx: ReturnType<typeof editor.cursorContext>): void {
  const math = mathAtCursor(ctx);
  if (!math || math.tex.trim().length === 0) {
    mathPreview.hidden = true;
    mathPreviewKey = "";
    return;
  }
  const nextKey = `${math.display ? "display" : "inline"}\n${math.tex.trim()}`;
  if (mathPreviewKey !== nextKey) {
    mathPreviewKey = nextKey;
    mathPreview.innerHTML = "";
    mathPreview.classList.toggle("is-display", math.display);
    try {
      katex.render(math.tex.trim(), mathPreview, {
        displayMode: math.display,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      mathPreview.textContent = math.tex;
    }
  }
  mathPreview.hidden = false;
  placeFloatingAbove(mathPreview, ctx.rect, math.display ? 420 : 300);
}

function activeEditorSelection(): { text: string; rect: DOMRect } | null {
  if (editor.isSourceMode()) return null;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (!anchor || !focus || !host.contains(anchor) || !host.contains(focus)) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { text, rect };
}

function updateSelectionTool(): void {
  const active = activeEditorSelection();
  if (!active) {
    selectionTool.hidden = true;
    return;
  }
  const margin = 8;
  const width = 76;
  const left = Math.min(
    Math.max(margin, active.rect.left + active.rect.width / 2 - width / 2),
    Math.max(margin, window.innerWidth - width - margin),
  );
  const top = Math.max(margin, active.rect.top - 38);
  selectionTool.style.left = `${left}px`;
  selectionTool.style.top = `${top}px`;
  selectionTool.style.width = `${width}px`;
  selectionTool.hidden = false;
}

async function copyActiveSelection(): Promise<void> {
  const active = activeEditorSelection();
  if (!active) return;
  try {
    await navigator.clipboard.writeText(active.text);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = active.text;
    fallback.style.position = "fixed";
    fallback.style.left = "-9999px";
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
  }
  setStatus("Selection copied");
  selectionTool.hidden = true;
}

function scheduleAssistUpdate(options: { snippets?: boolean } = {}): void {
  snippetScanRequested = snippetScanRequested || options.snippets === true;
  window.clearTimeout(assistTimer);
  assistTimer = window.setTimeout(() => {
    window.cancelAnimationFrame(assistFrame);
    assistFrame = window.requestAnimationFrame(() => {
      const ctx = editor.cursorContext(1600);
      const shouldScanSnippets = snippetScanRequested;
      snippetScanRequested = false;
      updateVimCursor(vimCursor, editor, vimMode, ctx);
      if (vimMode !== "insert") {
        hideSnippetPopup();
        mathPreview.hidden = true;
        selectionTool.hidden = true;
        return;
      }
      if (shouldScanSnippets) updateSnippetPopup(ctx);
      updateMathPreview(ctx);
      updateFloatingToc();
      updateSelectionTool();
    });
  }, 35);
}

function renderSnippets(): void {
  scheduleAssistUpdate({ snippets: true });
}

function renderNotes(): void {
  const query = noteFilter.value.trim().toLowerCase();
  const shown = notes
    .filter((note) => {
      const haystack = `${note.title ?? ""} ${note.id ?? ""} ${note.file ?? ""} ${(note.tags ?? []).join(" ")}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .slice(0, 80);

  noteList.innerHTML = "";
  if (shown.length === 0) {
    noteList.innerHTML = `<div class="aaronnote-empty">No notes</div>`;
    return;
  }
  for (const note of shown) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aaronnote-note";
    button.textContent = note.title || note.id || note.file || "Untitled";
    button.title = note.file || "";
    button.addEventListener("click", () => {
      openNote(note);
    });
    noteList.appendChild(button);
  }
}

async function openStandaloneFile(file: string): Promise<void> {
  setStatus("Opening");
  try {
    const res = await fetch(`/api/file?file=${encodeURIComponent(file)}`);
    const msg = await res.json() as Extract<Inbound, { type: "open" }>;
    if (!res.ok) {
      setStatus((msg as { message?: string }).message || "Open failed");
      return;
    }
    applyOpen(msg);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Open failed");
  }
}

function applyOpen(msg: Extract<Inbound, { type: "open" }>): void {
  receivedOpen = true;
  currentFile = msg.file || "";
  currentMode = msg.mode === "source" ? "source" : "markdown";
  fileLabel.textContent = currentFile || "Scratch";

  if (Array.isArray(msg.notes)) {
    notes = msg.notes;
    renderNotes();
  }
  if (Array.isArray(msg.snippets)) {
    snippets = msg.snippets.length > 0 ? msg.snippets : demoSnippets;
    renderSnippets();
  }

  if (currentMode === "source" && !editor.isSourceMode()) editor.toggleSource();
  if (currentMode === "markdown" && editor.isSourceMode()) editor.toggleSource();
  syncSourceUi();
  editor.setMarkdown(msg.content ?? "");
  editor.focus();
  vim.setMode("insert");
  setStatus(currentMode === "source" ? "Source mode" : "Ready");
  updateFloatingToc();
  scheduleAssistUpdate();
}

async function bootstrapStandalone(): Promise<void> {
  try {
    const res = await fetch("/api/bootstrap");
    const msg = await res.json() as Extract<Inbound, { type: "open" }>;
    if (!res.ok) {
      setStatus((msg as { message?: string }).message || "Bootstrap failed");
      return;
    }
    applyOpen(msg);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Bootstrap failed");
  }
}

function handleInbound(raw: string): void {
  let msg: Inbound;
  try {
    msg = JSON.parse(raw) as Inbound;
  } catch {
    return;
  }
  if (msg.type === "open") applyOpen(msg);
  if (msg.type === "saved") {
    setStatus(msg.ok ? "Saved" : msg.message || "Save failed");
    if (Array.isArray(msg.notes)) {
      notes = msg.notes;
      renderNotes();
      updateFloatingToc();
    }
  }
  if (msg.type === "notes" && Array.isArray(msg.notes)) {
    notes = msg.notes;
    renderNotes();
  }
  if (msg.type === "snippets" && Array.isArray(msg.snippets)) {
    snippets = msg.snippets.length > 0 ? msg.snippets : demoSnippets;
    renderSnippets();
    scheduleAssistUpdate();
  }
}

function applyDemoOpen(): void {
  if (receivedOpen) return;
  currentFile = "";
  currentMode = "markdown";
  fileLabel.textContent = emacsPort && token ? "Scratch" : "Demo (no Emacs)";
  notes = [];
  snippets = demoSnippets;
  renderNotes();
  renderSnippets();
  if (editor.isSourceMode()) editor.toggleSource();
  editor.setMarkdown([
    "# Aaronnote Demo",
    "",
    "Inline math: $x^2 + y^2$.",
    "",
    "$$",
    "E = mc^2",
    "$$",
    "",
  ].join("\n"));
  editor.focus();
  vim.setMode("insert");
  setStatus(emacsPort && token ? "Demo" : "Demo only");
  scheduleAssistUpdate();
}

function connect(): void {
  if (!emacsPort || !token) {
    setStatus("Missing Emacs bridge");
    return;
  }
  ws = new WebSocket(`ws://127.0.0.1:${emacsPort}/`);
  ws.addEventListener("open", () => {
    setStatus("Connected");
    send({ type: "hello" });
  });
  ws.addEventListener("message", (event) => handleInbound(String(event.data)));
  ws.addEventListener("close", () => {
    setStatus("Disconnected");
    window.setTimeout(connect, 1500);
  });
  ws.addEventListener("error", () => {
    try {
      ws?.close();
    } catch {}
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.shiftKey && !event.altKey) {
    const isMac = /Mac/.test(navigator.platform);
    if (isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) {
      const target = event.target as Node | null;
      if (target && host.contains(target)) {
        window.setTimeout(() => {
          syncSourceUi();
          setStatus(currentMode === "source" ? "Source mode" : "Ready");
          scheduleAssistUpdate();
        }, 0);
      }
    }
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    event.stopPropagation();
    toc.classList.toggle("is-collapsed");
    return;
  }
  if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const moved = event.shiftKey ? jumpSnippetTabstopBack() : jumpSnippetTabstop();
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  if (event.key === "]" && event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    if (jumpSnippetTabstop()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  if (handleSnippetPopupKey(event)) {
    event.stopPropagation();
    return;
  }
  if (vim.handleKeyDown(event)) {
    event.stopPropagation();
    return;
  }
  if (event.metaKey && !event.altKey && !event.ctrlKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    event.stopPropagation();
    save();
    return;
  }
  if (event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    event.stopPropagation();
    void exportPdf();
  }
}, true);

notesButton.addEventListener("click", showNotesPage);
sourceButton.addEventListener("click", toggleSourceMode);
editorButton.addEventListener("click", showEditorPage);
editorInlineButton.addEventListener("click", showEditorPage);
tocToggle.addEventListener("click", () => {
  toc.classList.toggle("is-collapsed");
});
selectionTool.addEventListener("mousedown", (event) => event.preventDefault());
selectionTool.addEventListener("click", () => void copyActiveSelection());
noteFilter.addEventListener("input", renderNotes);
document.addEventListener("keyup", (event) => {
  if (event.key !== "Escape") snippetSuppressedPrefix = "";
  scheduleAssistUpdate();
});
document.addEventListener("selectionchange", scheduleAssistUpdate);
document.addEventListener("mouseup", scheduleAssistUpdate);
window.addEventListener("resize", scheduleAssistUpdate);
window.addEventListener("scroll", scheduleAssistUpdate, true);

if (emacsPort && token) {
  connect();
  window.setTimeout(applyDemoOpen, 1200);
} else {
  void bootstrapStandalone();
}
