import "prosemirror-view/style/prosemirror.css";
import "../src/styles/widgets.css";
import "../src/styles/theme-typora.css";
import "./style.css";

import { createEditor } from "../src/lib.ts";
import { renderMathLazy } from "../src/math-render.ts";
import { SnippetSession, snippetDetail, snippetLabel, snippetScore } from "./snippets.ts";
import type { Inbound, NoteSummary, SnippetSummary } from "./types.ts";
import { createVimLite, type VimLiteMode } from "./vim-lite.ts";
import { createVimCursor, updateVimCursor } from "./vim-cursor.ts";

declare global {
  interface Window {
    SITE_DATA?: { meta?: Record<string, unknown>; notes?: NoteSummary[] };
    KNOWLEDGE_DATA?: {
      notes: Array<NoteSummary & { key: string }>;
      tags: Array<{ name: string; count: number; notes: string[] }>;
      groups: Array<{ key: string; label: string; items: NoteSummary[] }>;
    };
    initKnowledgeGraph?: (options?: Record<string, unknown>) => { destroy?: () => void; setVisibleKeys?: (keys: string[]) => void } | null;
    buildKnowledgeData?: () => void;
    __GRAPH_NO_AUTO_INIT__?: boolean;
    AaronnoteResolveAssetUrl?: (src: string) => string;
    AaronnoteDesktop?: {
      chooseNotePath?: (options?: { suggestedPath?: string; title?: string }) => Promise<string>;
    };
  }
}

window.__GRAPH_NO_AUTO_INIT__ = true;

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
          <div class="aaronnote-notes-tabs" role="tablist" aria-label="Roam tools">
            <button type="button" data-notes-tab="recent">Recent</button>
            <button type="button" data-notes-tab="filesystem" class="is-active">Filesystem</button>
            <button type="button" data-notes-tab="graph">Roam graph</button>
            <button type="button" data-notes-tab="management">Roam management</button>
          </div>
          <div data-notes-panel="recent" hidden>
            <div data-recent-list class="aaronnote-note-list"></div>
          </div>
          <div data-notes-panel="filesystem">
            <input data-note-filter type="search" placeholder="Filter notes by path, title, tag, or id" />
            <div data-note-list class="aaronnote-note-list"></div>
          </div>
          <div data-notes-panel="graph" data-graph-page hidden>
            <div class="aaronnote-graph-toolbar">
              <input data-graph-filter type="search" placeholder="Filter graph" />
              <span data-graph-stats></span>
            </div>
            <div class="aaronnote-graph-grid">
              <div class="aaronnote-graph-canvas" data-graph-canvas></div>
              <aside class="aaronnote-graph-focus" data-graph-focus></aside>
            </div>
          </div>
          <div data-notes-panel="management" hidden>
            <div class="aaronnote-management-grid">
              <button type="button" data-action="sync">Sync roamdb</button>
            </div>
            <div class="aaronnote-management-status">
              <strong data-management-count>0</strong>
              <span>nodes indexed from the current root</span>
            </div>
          </div>
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
const recentList = document.querySelector<HTMLElement>("[data-recent-list]")!;
const noteFilter = document.querySelector<HTMLInputElement>("[data-note-filter]")!;
const notesPage = document.querySelector<HTMLElement>("[data-notes-page]")!;
const graphPage = document.querySelector<HTMLElement>("[data-graph-page]")!;
const syncButton = document.querySelector<HTMLButtonElement>("[data-action='sync']")!;
const notesTabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-notes-tab]"));
const notesPanels = Array.from(document.querySelectorAll<HTMLElement>("[data-notes-panel]"));
const managementCount = document.querySelector<HTMLElement>("[data-management-count]")!;
const graphFilter = document.querySelector<HTMLInputElement>("[data-graph-filter]")!;
const graphCanvas = document.querySelector<HTMLElement>("[data-graph-canvas]")!;
const graphFocus = document.querySelector<HTMLElement>("[data-graph-focus]")!;
const graphStats = document.querySelector<HTMLElement>("[data-graph-stats]")!;
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

const modal = document.createElement("div");
modal.className = "aaronnote-modal";
modal.hidden = true;
document.body.appendChild(modal);

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
let selectedGraphNote = "";
let graphApi: { destroy?: () => void; setVisibleKeys?: (keys: string[]) => void } | null = null;
let graphScriptsReady: Promise<void> | null = null;
let graphRenderTimer = 0;
let notesRenderFrame = 0;
let saveRequestSeq = 0;
let graphDataKey = "";
let pathSuggestions: string[] = [];

const recentStorageKey = "aaronnote.recent";
type RecentNote = { file: string; openedAt: number };
type OpenNoteOptions = { newWindow?: boolean };
let recentNotes = loadRecentNotes();

type UploadedAsset = {
  ok?: boolean;
  file?: string;
  name?: string;
  type?: string;
  isImage?: boolean;
  markdownPath?: string;
  message?: string;
};

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

host.addEventListener("aaronnote:insert-files", (event) => {
  const evt = event as CustomEvent<{ files?: File[]; pos?: number; mode?: "image-src" | "markdown" }>;
  const files = Array.isArray(evt.detail?.files) ? evt.detail.files : [];
  if (files.length === 0) return;
  event.preventDefault();
  void insertFiles(files, { pos: evt.detail?.pos, mode: evt.detail?.mode });
});

document.addEventListener("paste", (event) => {
  const active = document.activeElement;
  if (!active || !host.contains(active)) return;
  const files = filesFromClipboard(event);
  if (files.length === 0) return;
  event.preventDefault();
  void insertFiles(files);
});

host.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.files?.length) event.preventDefault();
});

host.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length === 0) return;
  event.preventDefault();
  void insertFiles(files);
});

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function send(payload: Record<string, unknown>): void {
  const msg = JSON.stringify({ token, ...payload });
  if (ws?.readyState === WebSocket.OPEN) ws.send(msg);
}

function decodeNoteRef(ref: string): string {
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
}

function hrefProtocol(href: string): string | null {
  return href.trim().match(/^([A-Za-z][\w+.-]*):/)?.[1]?.toLowerCase() ?? null;
}

function hrefPath(href: string): string {
  const raw = String(href || "").trim();
  if (/^file:\/\//i.test(raw)) {
    try {
      return decodeNoteRef(new URL(raw).pathname);
    } catch {
      return decodeNoteRef(raw.replace(/^file:\/\//i, ""));
    }
  }
  if (/^file:/i.test(raw)) return decodeNoteRef(raw.replace(/^file:/i, "").split(/[?#]/, 1)[0] ?? "");
  return decodeNoteRef(raw.split(/[?#]/, 1)[0] ?? "");
}

function noteRefFromRoamHref(href: string): string | null {
  const match = String(href || "").trim().match(/^roam:\/\/(.+)$/i);
  if (!match) return null;
  const raw = match[1]!
    .split(/[?#]/, 1)[0]!
    .replace(/^\/+/, "")
    .replace(/[.,;:]+$/, "");
  const ref = decodeNoteRef(raw).trim();
  return ref || null;
}

function canonicalNoteRef(ref: string): string {
  const roamRef = noteRefFromRoamHref(ref);
  return normalizeNotePath(decodeNoteRef(roamRef ?? ref).trim().replace(/^\.\/+/, ""));
}

function normalizeNotePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const absolute = normalized.startsWith("/");
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0 && parts[parts.length - 1] !== "..") {
        parts.pop();
      } else if (!absolute) {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }
  return `${absolute ? "/" : ""}${parts.join("/")}`;
}

function dirnamePath(path: string): string {
  const normalized = normalizeNotePath(path);
  const index = normalized.lastIndexOf("/");
  if (index < 0) return "";
  if (index === 0) return "/";
  return normalized.slice(0, index);
}

function joinNotePath(baseDir: string, path: string): string {
  if (!baseDir || path.startsWith("/")) return normalizeNotePath(path);
  return normalizeNotePath(`${baseDir}/${path}`);
}

function markdownNoteHref(href: string): boolean {
  const protocol = hrefProtocol(href);
  if (protocol && protocol !== "file") return false;
  return /\.(?:md|markdown)$/i.test(hrefPath(href));
}

function internalNoteCandidates(href: string): string[] {
  const path = hrefPath(href);
  const candidates = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeNotePath(value);
    if (normalized) candidates.add(normalized);
  };
  add(path);
  add(path.replace(/^\.\/+/, ""));
  if (!path.startsWith("/") && currentFile) add(joinNotePath(dirnamePath(currentFile), path));
  const currentNote = notes.find((note) => note.file === currentFile);
  if (!path.startsWith("/") && currentNote?.path) add(joinNotePath(dirnamePath(currentNote.path), path));
  return [...candidates];
}

function resolveNoteRef(ref: string): NoteSummary | undefined {
  const target = canonicalNoteRef(ref);
  if (!target) return undefined;
  return notes.find((note) => {
    const candidates = [
      note.id,
      note.key,
      note.path,
      note.link,
      note.source,
      note.file,
      note.file?.split(/[\\/]/).pop(),
    ].filter((value): value is string => Boolean(value));
    return candidates.some((candidate) => canonicalNoteRef(candidate) === target);
  });
}

function resolveInternalNoteHref(href: string): NoteSummary | undefined {
  if (!markdownNoteHref(href)) return undefined;
  for (const candidate of internalNoteCandidates(href)) {
    const note = resolveNoteRef(candidate);
    if (note) return note;
  }
  return undefined;
}

function noteWindowUrl(note: NoteSummary): string {
  const url = new URL(window.location.href);
  url.searchParams.set("file", note.file || "");
  return url.toString();
}

function openExternalUrl(href: string, options: OpenNoteOptions = {}): void {
  const roamRef = noteRefFromRoamHref(href);
  if (roamRef != null) {
    const note = resolveNoteRef(roamRef);
    if (note) openNote(note, options);
    else setStatus(`Roam note not found: ${roamRef}`);
    return;
  }
  if (markdownNoteHref(href)) {
    const note = resolveInternalNoteHref(href);
    if (note) openNote(note, options);
    else setStatus(`Note not found: ${hrefPath(href)}`);
    return;
  }
  if (options.newWindow) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  if (emacsPort && token && ws?.readyState === WebSocket.OPEN) {
    send({ type: "open-url", url: href });
    setStatus("Opening link");
    return;
  }
  window.location.href = href;
}

function resolveAssetUrl(src: string): string {
  const raw = String(src || "");
  if (!raw) return raw;
  if (/^[A-Za-z][\w+.-]*:/i.test(raw) || raw.startsWith("#")) return raw;
  if (raw.startsWith("/api/media")) return raw;
  if (raw.startsWith("/") && !raw.startsWith("/Users/")) return raw;
  const file = raw.startsWith("file://")
    ? new URL(raw).pathname
    : raw.startsWith("file:")
      ? raw.slice(5)
      : raw;
  const url = new URL("/api/media", window.location.origin);
  url.searchParams.set("file", file);
  if (currentFile) url.searchParams.set("base", currentFile);
  return url.toString();
}

window.AaronnoteResolveAssetUrl = resolveAssetUrl;

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "attachment";
}

function fileToBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return window.btoa(binary);
  });
}

async function uploadAsset(file: File): Promise<UploadedAsset> {
  if (!currentFile) throw new Error("Save or open a note before attaching files");
  const res = await fetch("/api/asset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      file: currentFile,
      name: file.name || "clipboard-image.png",
      type: file.type || "",
      data: await fileToBase64(file),
    }),
  });
  const msg = await res.json() as UploadedAsset;
  if (!res.ok || !msg.ok || !msg.markdownPath) throw new Error(msg.message || "Asset upload failed");
  return msg;
}

function markdownForAsset(asset: UploadedAsset): string {
  const path = asset.markdownPath || asset.file || "";
  const name = asset.name || fileNameFromPath(path);
  return asset.isImage ? `![${name}](${path})` : `[${name}](${path})`;
}

async function insertFiles(files: File[], options: { pos?: number; mode?: "image-src" | "markdown" } = {}): Promise<void> {
  if (files.length === 0) return;
  setStatus(`Attaching ${files.length} file${files.length === 1 ? "" : "s"}`);
  try {
    const uploaded = await Promise.all(files.map(uploadAsset));
    if (typeof options.pos === "number" && options.mode === "image-src") {
      editor.replaceRange(options.pos, options.pos, uploaded[0]?.markdownPath || "", "end");
    } else {
      const markdown = uploaded.map(markdownForAsset).join("\n");
      const ctx = editor.cursorContext(200);
      const prefix = ctx.before && !ctx.before.endsWith("\n") ? "\n\n" : "";
      const suffix = ctx.after && !ctx.after.startsWith("\n") ? "\n\n" : "\n";
      editor.insertText(`${prefix}${markdown}${suffix}`);
    }
    void loadPathSuggestions();
    setStatus(`Attached ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Attach failed");
  }
}

function filesFromClipboard(event: ClipboardEvent): File[] {
  const files = Array.from(event.clipboardData?.files ?? []);
  if (files.length > 0) return files;
  return Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
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
  const seq = ++saveRequestSeq;
  const file = currentFile;
  const content = editor.getMarkdown();
  const mode = editor.isSourceMode() ? "source" : "markdown";
  setStatus("Saving");
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file, content, mode }),
    });
    const msg = await res.json() as Extract<Inbound, { type: "saved" }>;
    if (seq !== saveRequestSeq || file !== currentFile) return;
    setStatus(res.ok && msg.ok ? "Saved" : msg.message || "Save failed");
    if (Array.isArray(msg.notes)) {
      notes = msg.notes;
      renderNotes();
      if (!graphPage.hidden) renderGraph();
      updateFloatingToc();
    }
  } catch (err) {
    if (seq !== saveRequestSeq || file !== currentFile) return;
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

async function syncRoamDb(): Promise<void> {
  setStatus("Syncing");
  try {
    const res = await fetch("/api/roamdb/sync");
    const msg = await res.json() as { notes?: NoteSummary[]; message?: string; db?: string };
    if (!res.ok || !Array.isArray(msg.notes)) throw new Error(msg.message || "Sync failed");
    notes = msg.notes;
    renderNotes();
    if (!graphPage.hidden) renderGraph();
    updateFloatingToc();
    setStatus(`Synced ${roamNotes().length} roam nodes`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Sync failed");
  }
}

function clientSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return slug || "untitled";
}

function parseTagPrompt(value: string | null): string[] {
  return String(value || "")
    .split(/[, ]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

type ModalField = {
  id: string;
  label: string;
  value?: string;
  type?: "text" | "select" | "path" | "tags";
  options?: Array<{ label: string; value: string }>;
  suggestions?: string[];
};

function tagSuggestions(): string[] {
  const tags = new Set<string>();
  for (const note of notes) {
    for (const tag of note.tags ?? []) {
      const clean = String(tag).trim();
      if (clean) tags.add(clean);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function appendTagValue(input: HTMLInputElement, tag: string): void {
  const existing = parseTagPrompt(input.value);
  if (!existing.includes(tag)) existing.push(tag);
  input.value = existing.join(", ");
  input.focus();
}

function openFormModal(title: string, fields: ModalField[], submitLabel = "OK"): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    modal.innerHTML = "";
    const panel = document.createElement("form");
    panel.className = "aaronnote-modal-panel";
    const heading = document.createElement("h2");
    heading.textContent = title;
    panel.appendChild(heading);
    const controls = new Map<string, HTMLInputElement | HTMLSelectElement>();
    for (const field of fields) {
      const label = document.createElement("label");
      label.textContent = field.label;
      const input = field.type === "select" ? document.createElement("select") : document.createElement("input");
      if (input instanceof HTMLInputElement) input.type = "text";
      input.name = field.id;
      if (input instanceof HTMLSelectElement) {
        for (const optionSpec of field.options ?? []) {
          const option = document.createElement("option");
          option.value = optionSpec.value;
          option.textContent = optionSpec.label;
          input.appendChild(option);
        }
      }
      input.value = field.value ?? "";
      if (input instanceof HTMLInputElement && field.suggestions?.length) {
        const listId = `aaronnote-modal-list-${field.id}`;
        const list = document.createElement("datalist");
        list.id = listId;
        for (const value of field.suggestions) {
          const option = document.createElement("option");
          option.value = value;
          list.appendChild(option);
        }
        input.setAttribute("list", listId);
        panel.appendChild(list);
      }
      if (field.type === "path" && input instanceof HTMLInputElement) {
        const row = document.createElement("div");
        row.className = "aaronnote-modal-path-row";
        const browse = document.createElement("button");
        browse.type = "button";
        browse.textContent = "Choose";
        browse.addEventListener("click", async () => {
          const picked = await window.AaronnoteDesktop?.chooseNotePath?.({
            suggestedPath: input.value || "untitled.md",
            title: "Choose note path",
          });
          if (picked) input.value = picked;
          input.focus();
        });
        row.append(input, browse);
        label.appendChild(row);
      } else if (field.type === "tags" && input instanceof HTMLInputElement) {
        label.appendChild(input);
        if (field.suggestions?.length) {
          const picker = document.createElement("div");
          picker.className = "aaronnote-modal-tag-picker";
          for (const tag of field.suggestions.slice(0, 36)) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = tag;
            button.addEventListener("click", () => appendTagValue(input, tag));
            picker.appendChild(button);
          }
          label.appendChild(picker);
        }
      } else {
        label.appendChild(input);
      }
      panel.appendChild(label);
      controls.set(field.id, input);
    }
    const actions = document.createElement("div");
    actions.className = "aaronnote-modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = submitLabel;
    actions.append(cancel, submit);
    panel.appendChild(actions);
    const close = (value: Record<string, string> | null) => {
      modal.hidden = true;
      modal.innerHTML = "";
      resolve(value);
    };
    cancel.addEventListener("click", () => close(null));
    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close(null);
    }, { once: true });
    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      const out: Record<string, string> = {};
      controls.forEach((control, id) => {
        out[id] = control.value.trim();
      });
      close(out);
    });
    modal.appendChild(panel);
    modal.hidden = false;
    controls.values().next().value?.focus();
  });
}

function notePathSuggestions(): string[] {
  const dirs = new Set<string>([""]);
  for (const note of notes) {
    const path = normalizeNotePath(note.path || note.file || "");
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    if (parts.length) dirs.add(`${parts.join("/")}/`);
  }
  return [...dirs].sort();
}

async function loadPathSuggestions(): Promise<void> {
  if (!currentFile) {
    pathSuggestions = [];
    return;
  }
  try {
    const url = `/api/path-suggestions?file=${encodeURIComponent(currentFile)}`;
    const res = await fetch(url);
    const msg = await res.json() as { paths?: string[] };
    if (res.ok && Array.isArray(msg.paths)) pathSuggestions = msg.paths;
  } catch {
    pathSuggestions = [];
  }
}

async function promptNewNode(): Promise<{ nodeType: "roam" | "regular"; title: string; path: string; tags: string[] } | null> {
  const first = await openFormModal("New note", [
    { id: "nodeType", label: "Type", type: "select", value: "roam", options: [
      { label: "Roam", value: "roam" },
      { label: "Regular", value: "regular" },
    ] },
    { id: "title", label: "Title", value: "Untitled" },
    { id: "path", label: "Save path", type: "path", value: "untitled.md", suggestions: notePathSuggestions() },
    { id: "tags", label: "Tags", type: "tags", value: "", suggestions: tagSuggestions() },
  ], "Create");
  if (!first) return null;
  const title = first.title || "Untitled";
  const nodeType = first.nodeType === "regular" ? "regular" : "roam";
  return {
    nodeType,
    title,
    path: first.path || `${clientSlug(title)}.md`,
    tags: nodeType === "roam" ? parseTagPrompt(first.tags) : [],
  };
}

async function createNode(): Promise<void> {
  const draft = await promptNewNode();
  if (!draft) return;
  setStatus("Creating node");
  try {
    const res = await fetch("/api/node", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const msg = await res.json() as Extract<Inbound, { type: "open" }> & { message?: string };
    if (!res.ok) throw new Error(msg.message || "Create node failed");
    applyOpen(msg);
    showEditorPage();
    setStatus(draft.nodeType === "roam" ? "Roam node created" : "Markdown file created");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Create node failed");
  }
}

async function deleteCurrentNote(): Promise<void> {
  if (!currentFile) {
    setStatus("No current note");
    return;
  }
  const confirmed = await openFormModal("Delete note", [
    { id: "confirm", label: `Type DELETE to remove ${currentFile}`, value: "" },
  ], "Delete");
  if (confirmed?.confirm !== "DELETE") return;
  setStatus("Deleting note");
  try {
    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: currentFile }),
    });
    const msg = await res.json() as { ok?: boolean; notes?: NoteSummary[]; message?: string };
    if (!res.ok || !msg.ok) throw new Error(msg.message || "Delete failed");
    notes = Array.isArray(msg.notes) ? msg.notes : [];
    currentFile = "";
    fileLabel.textContent = "Scratch";
    editor.setMarkdown("");
    renderNotes();
    if (!graphPage.hidden) renderGraph();
    updateFloatingToc();
    setStatus("Note deleted");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Delete failed");
  }
}

async function updateNoteMeta(endpoint: string, body: Record<string, unknown>, success: string): Promise<void> {
  if (!currentFile) {
    setStatus("No current note");
    return;
  }
  setStatus("Updating note");
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file: currentFile,
        content: editor.getMarkdown(),
        ...body,
      }),
    });
    const msg = await res.json() as Extract<Inbound, { type: "open" }> & { message?: string };
    if (!res.ok) throw new Error(msg.message || "Update failed");
    applyOpen(msg);
    setStatus(success);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Update failed");
  }
}

async function quickAddMeta(): Promise<void> {
  const result = await openFormModal("Quick add meta", [
    { id: "title", label: "Title", value: fileLabel.textContent || "Untitled" },
    { id: "tags", label: "Tags", type: "tags", value: "", suggestions: tagSuggestions() },
  ], "Register");
  if (!result) return;
  await updateNoteMeta("/api/meta/add", { title: result.title, tags: parseTagPrompt(result.tags) }, "Meta registered");
}

async function unregisterMeta(): Promise<void> {
  const confirmed = await openFormModal("Unregister meta", [
    { id: "confirm", label: "Type REMOVE to delete roam meta from current note", value: "" },
  ], "Remove");
  if (confirmed?.confirm !== "REMOVE") return;
  await updateNoteMeta("/api/meta/remove", {}, "Meta unregistered");
}

async function addTag(): Promise<void> {
  const result = await openFormModal("Add tag", [
    { id: "tags", label: "Tags", type: "tags", value: "", suggestions: tagSuggestions() },
  ], "Add");
  if (!result) return;
  const tags = parseTagPrompt(result.tags);
  if (tags.length === 0) return;
  await updateNoteMeta("/api/tags/add", { tags }, "Tag added");
}

function toggleSourceMode(): void {
  editor.toggleSource();
  vim.setMode("insert");
  syncSourceUi();
  setStatus(currentMode === "source" ? "Source mode" : "Ready");
  scheduleAssistUpdate();
}

function cleanupTransientUi(): void {
  hideSnippetPopup();
  mathPreview.hidden = true;
  selectionTool.hidden = true;
  window.clearTimeout(assistTimer);
  window.cancelAnimationFrame(assistFrame);
}

function disposeGraph(): void {
  window.clearTimeout(graphRenderTimer);
  graphApi?.destroy?.();
  graphApi = null;
  graphDataKey = "";
  graphCanvas.innerHTML = "";
  graphFocus.innerHTML = "";
}

function showNotesPage(): void {
  cleanupTransientUi();
  disposeGraph();
  host.hidden = true;
  notesPage.hidden = false;
  toc.hidden = true;
  notesButton.hidden = true;
  sourceButton.hidden = true;
  editorButton.hidden = false;
  showNotesTool("filesystem");
  noteFilter.focus();
}

function showNotesTool(tab: string): void {
  if (tab !== "graph") disposeGraph();
  notesTabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.notesTab === tab);
  });
  notesPanels.forEach((panel) => {
    panel.hidden = panel.dataset.notesPanel !== tab;
  });
  if (tab === "graph") {
    renderGraph();
    graphFilter.focus();
  } else if (tab === "recent") {
    renderRecentNotes();
  } else if (tab === "filesystem") {
    noteFilter.focus();
  }
}

function showEditorPage(): void {
  disposeGraph();
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

function openNote(note: NoteSummary, options: OpenNoteOptions = {}): void {
  if (!note.file) return;
  touchRecentNote(note.file);
  if (options.newWindow) {
    window.open(noteWindowUrl(note), "_blank", "noopener,noreferrer");
    setStatus("Opening note window");
    return;
  }
  if (emacsPort && token) send({ type: "open-file", file: note.file });
  void openStandaloneFile(note.file);
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
    const resolved = ids
      .map((id) => byId.get(id) || resolveNoteRef(id))
      .filter((note): note is NoteSummary => Boolean(note?.file));
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
      button.addEventListener("click", (event) => openNote(note, { newWindow: event.altKey || event.metaKey }));
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

function pathCompletionPrefix(before: string): string {
  const match = before.match(/(?:^|[\s([{"'=])((?:\.{1,2}\/)[^\s\])}"'`<>]*)$/);
  return match?.[1] ?? "";
}

function matchingPathCompletions(prefix: string): SnippetSummary[] {
  if (!prefix) return [];
  const query = prefix.toLowerCase();
  return pathSuggestions
    .filter((path) => path.toLowerCase().startsWith(query))
    .slice(0, 12)
    .map((path) => ({
      key: path,
      name: path.endsWith("/") ? "Directory" : "Path",
      mode: "markdown-mode",
      group: "path",
      body: path,
    }));
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
    snippetPopup.querySelector(".aaronnote-snippet-option.is-active")?.scrollIntoView({ block: "nearest" });
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
    const number = document.createElement("span");
    number.className = "aaronnote-snippet-option-number";
    number.textContent = index < 9 ? String(index + 1) : index === 9 ? "0" : "";
    const key = document.createElement("span");
    key.className = "aaronnote-snippet-option-key";
    key.textContent = snippetLabel(snippet);
    const detail = document.createElement("span");
    detail.className = "aaronnote-snippet-option-detail";
    detail.textContent = snippetDetail(snippet);
    button.append(number, key, detail);
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
  snippetPopup.querySelector(".aaronnote-snippet-option.is-active")?.scrollIntoView({ block: "nearest" });
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
  const pathPrefix = pathCompletionPrefix(ctx.before);
  if (pathPrefix) {
    const matches = matchingPathCompletions(pathPrefix);
    if (matches.length === 0) {
      hideSnippetPopup();
      return;
    }
    snippetDeleteBefore = pathPrefix.length;
    snippetPopupIndex = Math.min(snippetPopupIndex, matches.length - 1);
    snippetPopupItems = matches;
    renderSnippetPopup(pathPrefix, ctx.rect);
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
  if (event.isComposing) return false;
  const active = document.activeElement;
  const target = event.target as Node | null;
  if ((!active || !host.contains(active)) && (!target || !host.contains(target))) {
    hideSnippetPopup();
    return false;
  }
  if (snippetPopupItems.length === 0) {
    hideSnippetPopup();
    return false;
  }
  if (event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && /^\d$/.test(event.key)) {
    const index = event.key === "0" ? 9 : Number(event.key) - 1;
    if (index >= 0 && index < snippetPopupItems.length) {
      event.preventDefault();
      snippetPopupIndex = index;
      chooseSnippetPopupItem();
      return true;
    }
  }
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
  if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
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
    if (
      delimiter === "$$"
        ? isDisplayClose(src, i)
        : src.slice(i, i + delimiter.length) === delimiter && !isEscaped(src, i)
    ) return i;
  }
  return -1;
}

function lineStart(src: string, pos: number): number {
  return src.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
}

function lineEnd(src: string, pos: number): number {
  const end = src.indexOf("\n", pos);
  return end < 0 ? src.length : end;
}

function onlySpace(src: string, from: number, to: number): boolean {
  return /^[ \t]*$/.test(src.slice(from, to));
}

function isDoubleDollarAt(src: string, pos: number): boolean {
  return (
    src.slice(pos, pos + 2) === "$$" &&
    !isEscaped(src, pos)
  );
}

function isDisplayOpen(src: string, openFrom: number): boolean {
  return (
    isDoubleDollarAt(src, openFrom) &&
    onlySpace(src, lineStart(src, openFrom), openFrom) &&
    onlySpace(src, openFrom + 2, lineEnd(src, openFrom + 2))
  );
}

function isDisplayClose(src: string, closeFrom: number): boolean {
  return (
    isDoubleDollarAt(src, closeFrom) &&
    onlySpace(src, lineStart(src, closeFrom), closeFrom) &&
    onlySpace(src, closeFrom + 2, lineEnd(src, closeFrom + 2))
  );
}

function mathAtCursor(ctx: ReturnType<typeof editor.cursorContext>): { tex: string; display: boolean; rect: { left: number; top: number; bottom: number } | null } | null {
  if (!editor.isSourceMode()) {
    const sel = editor.view.state.selection;
    if (sel.empty && sel.$from.parent.type.name === "math_block") {
      const blockStart = sel.$from.before();
      const rect = mathBlockAnchorRect(blockStart) ?? ctx.rect;
      return {
        tex: sel.$from.parent.textContent,
        display: true,
        rect,
      };
    }
  }

  const src = ctx.before + ctx.after;
  const cursor = ctx.before.length;
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "$" || isEscaped(src, i)) continue;
    const delimiter: "$" | "$$" = src[i + 1] === "$" ? "$$" : "$";
    const openFrom = i;
    const openTo = i + delimiter.length;
    if (delimiter === "$$" && !isDisplayOpen(src, openFrom)) continue;
    if (openTo > cursor) break;
    const closeFrom = findMathClose(src, delimiter, openTo);
    if (closeFrom >= 0) {
      const closeTo = closeFrom + delimiter.length;
      const rawTex = src.slice(openTo, closeFrom);
      if (cursor > openFrom && cursor < closeTo) {
        return {
          tex: rawTex,
          display: delimiter === "$$",
          rect: ctx.rectAtOffset(openFrom),
        };
      }
      i = closeTo - 1;
      continue;
    }
    if (cursor >= openTo && openFrom < cursor) {
      const tex = src.slice(openTo, cursor);
      if (delimiter === "$" && tex.includes("\n")) return null;
      if (delimiter === "$$") {
        return { tex, display: true, rect: ctx.rectAtOffset(openFrom) };
      }
      return { tex, display: delimiter === "$$", rect: ctx.rectAtOffset(openFrom) };
    }
  }
  return null;
}

function mathBlockAnchorRect(blockStart: number): { left: number; top: number; bottom: number } | null {
  const dom = editor.view.nodeDOM(blockStart);
  if (dom instanceof HTMLElement) {
    const anchor = dom.querySelector<HTMLElement>(".math-block-fence") ?? dom;
    const rect = anchor.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return { left: rect.left, top: rect.top, bottom: rect.bottom };
    }
  }
  try {
    const rect = editor.view.coordsAtPos(blockStart + 1, -1);
    return { left: rect.left, top: rect.top, bottom: rect.bottom };
  } catch {
    return null;
  }
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
    renderMathLazy(math.tex.trim(), mathPreview, {
      displayMode: math.display,
      throwOnError: false,
      strict: "ignore",
    }, () => {
      mathPreview.textContent = math.tex;
    });
  }
  mathPreview.hidden = false;
  placeFloatingAbove(mathPreview, math.rect ?? ctx.rect, math.display ? 420 : 300);
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

function updateVimCursorNow(): void {
  updateVimCursor(vimCursor, editor, vimMode, editor.cursorContext(1600));
}

function renderSnippets(): void {
  scheduleAssistUpdate({ snippets: true });
}

function normalizeRecentNotes(entries: unknown): RecentNote[] {
  if (!Array.isArray(entries)) return [];
  const byFile = new Map<string, RecentNote>();
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<RecentNote>;
    if (typeof entry.file !== "string" || !entry.file) continue;
    if (typeof entry.openedAt !== "number" || !Number.isFinite(entry.openedAt)) continue;
    const current = byFile.get(entry.file);
    if (!current || entry.openedAt > current.openedAt) {
      byFile.set(entry.file, { file: entry.file, openedAt: entry.openedAt });
    }
  }
  return [...byFile.values()].sort((a, b) => b.openedAt - a.openedAt).slice(0, 24);
}

function loadRecentNotes(): RecentNote[] {
  try {
    const raw = window.localStorage.getItem(recentStorageKey);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return normalizeRecentNotes(parsed);
  } catch {
    return [];
  }
}

function saveRecentNotes(): void {
  try {
    window.localStorage.setItem(recentStorageKey, JSON.stringify(recentNotes.slice(0, 24)));
  } catch {
    // Recent notes are a local convenience; ignore storage failures.
  }
}

function mergeRecentNotes(entries: unknown): void {
  const incoming = normalizeRecentNotes(entries);
  if (incoming.length === 0) return;
  recentNotes = normalizeRecentNotes([...incoming, ...recentNotes]);
  saveRecentNotes();
  renderRecentNotes();
}

async function loadServerRecentNotes(): Promise<void> {
  try {
    const res = await fetch("/api/recent");
    const msg = await res.json() as { recent?: RecentNote[] };
    if (res.ok) mergeRecentNotes(msg.recent ?? []);
  } catch {
    // Standalone persistence is best effort; localStorage remains as fallback.
  }
}

async function persistRecentNote(file: string, openedAt: number): Promise<void> {
  try {
    await fetch("/api/recent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file, openedAt }),
    });
  } catch {
    // Ignore persistence failures; the UI already updated locally.
  }
}

function touchRecentNote(file: string): void {
  if (!file) return;
  const openedAt = Date.now();
  recentNotes = [
    { file, openedAt },
    ...recentNotes.filter((item) => item.file !== file),
  ].slice(0, 24);
  saveRecentNotes();
  renderRecentNotes();
  void persistRecentNote(file, openedAt);
}

function formatRecentTime(openedAt: number): string {
  if (!Number.isFinite(openedAt)) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(openedAt));
}

function renderNoteButton(note: NoteSummary, detail: string, extra?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "aaronnote-note";
  button.innerHTML = `<strong>${escapeHtml(note.title || note.id || note.file || "Untitled")}</strong><span>${escapeHtml(detail)}</span>${extra ? `<span class="aaronnote-note-extra">${escapeHtml(extra)}</span>` : ""}`;
  button.title = note.file || "";
  button.addEventListener("click", (event) => {
    openNote(note, { newWindow: event.altKey || event.metaKey });
  });
  return button;
}

function renderRecentNotes(): void {
  const byFile = new Map(notes.map((note) => [note.file, note]));
  const entries = recentNotes
    .map((entry) => ({ entry, note: byFile.get(entry.file) }))
    .filter((item): item is { entry: RecentNote; note: NoteSummary } => Boolean(item.note?.file));

  recentList.innerHTML = "";
  if (entries.length === 0) {
    recentList.innerHTML = `<div class="aaronnote-empty">No recent notes</div>`;
    return;
  }
  for (const { entry, note } of entries) {
    recentList.appendChild(renderNoteButton(note, note.path || note.id || "", formatRecentTime(entry.openedAt)));
  }
}

function roamNotes(): NoteSummary[] {
  return notes.filter((note) => note.roam);
}

function renderNotes(): void {
  managementCount.textContent = `${roamNotes().length} / ${notes.length}`;
  renderRecentNotes();
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
  const groups = new Map<string, NoteSummary[]>();
  for (const note of shown) {
    const group = note.groupKey || (note.path || "").split(/[\\/]/).slice(0, -1).join("/") || "Root";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(note);
  }
  for (const [group, items] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const heading = document.createElement("div");
    heading.className = "aaronnote-note-group";
    heading.textContent = group.replace(/^\.\/?/, "") || "Root";
    noteList.appendChild(heading);
    for (const note of items.sort((a, b) => String(a.title).localeCompare(String(b.title)))) {
      noteList.appendChild(renderNoteButton(note, note.path || note.id || ""));
    }
  }
}

function noteKey(note: NoteSummary): string {
  return note.key || note.id || note.path || note.file || "";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function publishGraphVisibleNotes(): NoteSummary[] {
  const query = graphFilter.value.trim().toLowerCase();
  return roamNotes().filter((note) => {
    const haystack = [
      note.title,
      note.id,
      note.path,
      note.groupLabel,
      note.summary,
      ...(note.tags ?? []),
      ...(note.aliases ?? []),
    ].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
}

function loadScriptOnce(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

async function ensurePublishGraphScripts(): Promise<void> {
  if (graphScriptsReady) return graphScriptsReady;
  graphScriptsReady = (async () => {
    await loadScriptOnce("https://d3js.org/d3.v7.min.js");
    await loadScriptOnce("/roam-tools/knowledge.js");
    await loadScriptOnce("/roam-tools/graph.js");
  })();
  return graphScriptsReady;
}

function updatePublishGraphData(): void {
  const graphNotes = roamNotes();
  window.SITE_DATA = {
    meta: {
      generatedAt: new Date().toISOString(),
      noteCount: graphNotes.length,
      tagCount: new Set(graphNotes.flatMap((note) => note.tags ?? [])).size,
    },
    notes: graphNotes.map((note) => ({
      ...note,
      key: noteKey(note),
      link: note.link || note.path || "#",
      refs: note.refs ?? [],
      backlinks: note.backlinks ?? [],
      tags: note.tags ?? [],
      aliases: note.aliases ?? [],
    })),
  };
}

function currentGraphDataKey(): string {
  return roamNotes()
    .map((note) => [
      noteKey(note),
      note.title ?? "",
      note.path ?? "",
      (note.refs ?? []).join(","),
      (note.backlinks ?? []).join(","),
      (note.tags ?? []).join(","),
      (note.aliases ?? []).join(","),
    ].join("\t"))
    .join("\n");
}

function renderGraph(): void {
  window.clearTimeout(graphRenderTimer);
  const dataKey = currentGraphDataKey();
  updatePublishGraphData();
  const shown = publishGraphVisibleNotes();
  const visibleKeys = shown.map(noteKey);
  graphStats.textContent = `${shown.length} nodes`;
  if (graphApi?.setVisibleKeys && graphDataKey === dataKey) {
    graphApi.setVisibleKeys(visibleKeys);
    return;
  }
  void ensurePublishGraphScripts()
    .then(() => {
      if (graphPage.hidden) return;
      if (!window.initKnowledgeGraph) throw new Error("Publish graph is unavailable");
      window.buildKnowledgeData?.();
      graphApi?.destroy?.();
      graphDataKey = dataKey;
      graphApi = window.initKnowledgeGraph({
        knowledge: window.KNOWLEDGE_DATA,
        container: graphCanvas,
        focusPanel: graphFocus,
        toolbar: true,
        emptyMessage: "Select a node.",
        listenForGlobalFilters: false,
        dispatchTagEvents: false,
        onNoteOpen(note: NoteSummary) {
          const target = notes.find((item) => noteKey(item) === noteKey(note) || item.id === note.id);
          if (target) openNote(target);
        },
        initialVisibleKeys: visibleKeys,
      });
    })
    .catch((err) => {
      graphCanvas.innerHTML = `<div class="aaronnote-empty">${escapeHtml(err instanceof Error ? err.message : "Graph failed")}</div>`;
    });
}

function scheduleRenderGraph(delay = 120): void {
  window.clearTimeout(graphRenderTimer);
  graphRenderTimer = window.setTimeout(renderGraph, delay);
}

function scheduleRenderNotes(): void {
  window.cancelAnimationFrame(notesRenderFrame);
  notesRenderFrame = window.requestAnimationFrame(renderNotes);
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
  touchRecentNote(currentFile);

  if (Array.isArray(msg.notes)) {
    notes = msg.notes;
    renderNotes();
    if (!graphPage.hidden) renderGraph();
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
  void loadPathSuggestions();
}

async function bootstrapStandalone(): Promise<void> {
  try {
    const requestedFile = params.get("file");
    const url = requestedFile
      ? `/api/bootstrap?file=${encodeURIComponent(requestedFile)}`
      : "/api/bootstrap";
    const res = await fetch(url);
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
      if (!graphPage.hidden) renderGraph();
      updateFloatingToc();
    }
  }
  if (msg.type === "notes" && Array.isArray(msg.notes)) {
    notes = msg.notes;
    renderNotes();
    if (!graphPage.hidden) renderGraph();
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
  if (handleSnippetPopupKey(event)) {
    event.stopPropagation();
    return;
  }
  if (event.key === "]" && event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    if (jumpSnippetTabstop()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  if (event.key === "[" && event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    if (jumpSnippetTabstopBack()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  if (vim.handleKeyDown(event)) {
    updateVimCursorNow();
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
    return;
  }
}, true);

document.addEventListener("aaronnote:open-url", (event) => {
  const custom = event as CustomEvent<{ href?: string; newWindow?: boolean }>;
  const href = custom.detail?.href;
  if (!href) return;
  event.preventDefault();
  openExternalUrl(href, { newWindow: custom.detail?.newWindow === true });
});

window.addEventListener("aaronnote:command", (event) => {
  const command = (event as CustomEvent<{ command?: string }>).detail?.command;
  if (command === "new-node") void createNode();
  if (command === "delete-node") void deleteCurrentNote();
  if (command === "add-meta") void quickAddMeta();
  if (command === "remove-meta") void unregisterMeta();
  if (command === "add-tag") void addTag();
  if (command === "sync-roamdb") void syncRoamDb();
});

notesButton.addEventListener("click", showNotesPage);
syncButton.addEventListener("click", () => void syncRoamDb());
sourceButton.addEventListener("click", toggleSourceMode);
editorButton.addEventListener("click", showEditorPage);
editorInlineButton.addEventListener("click", showEditorPage);
notesTabButtons.forEach((button) => {
  button.addEventListener("click", () => showNotesTool(button.dataset.notesTab || "filesystem"));
});
tocToggle.addEventListener("click", () => {
  toc.classList.toggle("is-collapsed");
});
selectionTool.addEventListener("mousedown", (event) => event.preventDefault());
selectionTool.addEventListener("click", () => void copyActiveSelection());
noteFilter.addEventListener("input", scheduleRenderNotes);
graphFilter.addEventListener("input", () => scheduleRenderGraph());
document.addEventListener("keyup", (event) => {
  if (event.key !== "Escape") snippetSuppressedPrefix = "";
  scheduleAssistUpdate();
});
document.addEventListener("selectionchange", () => {
  updateVimCursorNow();
  scheduleAssistUpdate();
});
document.addEventListener("mouseup", scheduleAssistUpdate);
window.addEventListener("resize", () => {
  updateVimCursorNow();
  scheduleAssistUpdate();
});
window.addEventListener("resize", () => {
  if (!graphPage.hidden) scheduleRenderGraph(180);
});
window.addEventListener("scroll", () => {
  updateVimCursorNow();
  scheduleAssistUpdate();
}, true);

void loadServerRecentNotes();

if (emacsPort && token) {
  connect();
  window.setTimeout(applyDemoOpen, 1200);
} else {
  void bootstrapStandalone();
}
