import "prosemirror-view/style/prosemirror.css";
import "../src/styles/widgets.css";
import "../src/styles/theme-typora.css";
import "./style.css";

import { createEditor, type EditorCommand, type QuickInsertItem } from "../src/lib.ts";
import { renderMathLazy } from "../src/math-render.ts";
import { safeHref } from "../src/url-safety.ts";
import { createAgendaManager } from "./agenda.ts";
import { createUnusedAssetsManager } from "./asset-cleanup.ts";
import { createFilesystemBrowser } from "./filesystem.ts";
import { createFloatingTocPanel } from "./floating-toc.ts";
import { createGraphPanel } from "./graph-panel.ts";
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
      trashNote?: (file: string) => Promise<{ ok?: boolean; file?: string; message?: string }>;
      exportPdf?: (options?: { file?: string; name?: string }) => Promise<{ ok?: boolean; canceled?: boolean; file?: string; message?: string }>;
    };
  }
}

window.__GRAPH_NO_AUTO_INIT__ = true;

const params = new URLSearchParams(window.location.search);

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
        <button type="button" data-action="agenda">Agenda</button>
        <button type="button" data-action="focus-mode">Focus</button>
        <button type="button" data-action="typewriter-mode">Typewriter</button>
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
            <button type="button" data-notes-tab="agenda">Agenda</button>
            <button type="button" data-notes-tab="filesystem" class="is-active">Filesystem</button>
            <button type="button" data-notes-tab="graph">Roam graph</button>
            <button type="button" data-notes-tab="management">Roam management</button>
          </div>
          <div data-notes-panel="recent" hidden>
            <div data-recent-list class="aaronnote-note-list"></div>
          </div>
          <div data-notes-panel="agenda" hidden>
            <div class="aaronnote-agenda-toolbar">
              <input data-agenda-filter type="search" placeholder="Filter active todos" />
              <select data-agenda-sort aria-label="Sort todos">
                <option value="status">Status</option>
                <option value="file">File</option>
                <option value="time">Time</option>
              </select>
              <label><input data-agenda-done type="checkbox" /> Done</label>
              <button type="button" data-action="agenda-refresh">Refresh</button>
              <span data-agenda-count></span>
            </div>
            <div data-agenda-list class="aaronnote-agenda-list"></div>
          </div>
          <div data-notes-panel="filesystem">
            <div class="aaronnote-files-toolbar">
              <input data-note-filter type="search" placeholder="Filter notes by path, title, tag, or id" />
              <div class="aaronnote-files-actions">
                <button type="button" data-action="notes-collapse-all">Parent</button>
                <button type="button" data-action="notes-expand-all">Current</button>
                <span data-note-count></span>
              </div>
            </div>
            <div data-note-list class="aaronnote-note-list aaronnote-files-list"></div>
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
              <button type="button" data-action="scan-unused-assets">Scan unused assets</button>
              <button type="button" data-action="trash-unused-assets" disabled>Move selected to Trash</button>
            </div>
            <div class="aaronnote-management-status">
              <strong data-management-count>0</strong>
              <span>nodes indexed from the current root</span>
            </div>
            <section class="aaronnote-unused-assets" data-unused-assets-section hidden>
              <header>
                <strong data-unused-assets-count>0 unused assets</strong>
                <label><input data-unused-assets-select-all type="checkbox" /> Select all</label>
              </header>
              <div data-unused-assets-list class="aaronnote-unused-assets-list"></div>
            </section>
          </div>
        </div>
      </section>
    </section>
    <aside class="aaronnote-floating-toc is-collapsed" data-floating-toc>
      <button type="button" data-toc-toggle aria-expanded="false">TOC</button>
      <nav data-toc-list aria-label="Table of contents"></nav>
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
const noteCount = document.querySelector<HTMLElement>("[data-note-count]")!;
const notesPage = document.querySelector<HTMLElement>("[data-notes-page]")!;
const graphPage = document.querySelector<HTMLElement>("[data-graph-page]")!;
const syncButton = document.querySelector<HTMLButtonElement>("[data-action='sync']")!;
const notesCollapseAllButton = document.querySelector<HTMLButtonElement>("[data-action='notes-collapse-all']")!;
const notesExpandAllButton = document.querySelector<HTMLButtonElement>("[data-action='notes-expand-all']")!;
const scanUnusedAssetsButton = document.querySelector<HTMLButtonElement>("[data-action='scan-unused-assets']")!;
const trashUnusedAssetsButton = document.querySelector<HTMLButtonElement>("[data-action='trash-unused-assets']")!;
const unusedAssetsSection = document.querySelector<HTMLElement>("[data-unused-assets-section]")!;
const unusedAssetsCount = document.querySelector<HTMLElement>("[data-unused-assets-count]")!;
const unusedAssetsSelectAll = document.querySelector<HTMLInputElement>("[data-unused-assets-select-all]")!;
const unusedAssetsList = document.querySelector<HTMLElement>("[data-unused-assets-list]")!;
const notesTabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-notes-tab]"));
const notesPanels = Array.from(document.querySelectorAll<HTMLElement>("[data-notes-panel]"));
const managementCount = document.querySelector<HTMLElement>("[data-management-count]")!;
const graphFilter = document.querySelector<HTMLInputElement>("[data-graph-filter]")!;
const graphCanvas = document.querySelector<HTMLElement>("[data-graph-canvas]")!;
const graphFocus = document.querySelector<HTMLElement>("[data-graph-focus]")!;
const graphStats = document.querySelector<HTMLElement>("[data-graph-stats]")!;
const notesButton = document.querySelector<HTMLButtonElement>("[data-action='notes']")!;
const agendaButton = document.querySelector<HTMLButtonElement>("[data-action='agenda']")!;
const sourceButton = document.querySelector<HTMLButtonElement>("[data-action='source']")!;
const editorButton = document.querySelector<HTMLButtonElement>("[data-action='editor']")!;
const editorInlineButton = document.querySelector<HTMLButtonElement>("[data-action='editor-inline']")!;
const focusModeButton = document.querySelector<HTMLButtonElement>("[data-action='focus-mode']")!;
const typewriterModeButton = document.querySelector<HTMLButtonElement>("[data-action='typewriter-mode']")!;
const agendaFilter = document.querySelector<HTMLInputElement>("[data-agenda-filter]")!;
const agendaSort = document.querySelector<HTMLSelectElement>("[data-agenda-sort]")!;
const agendaDone = document.querySelector<HTMLInputElement>("[data-agenda-done]")!;
const agendaRefresh = document.querySelector<HTMLButtonElement>("[data-action='agenda-refresh']")!;
const agendaCount = document.querySelector<HTMLElement>("[data-agenda-count]")!;
const agendaList = document.querySelector<HTMLElement>("[data-agenda-list]")!;
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

const selectionTool = document.createElement("div");
selectionTool.className = "aaronnote-selection-tool";
selectionTool.innerHTML = `
  <button type="button" data-selection-command="bold" title="Bold">B</button>
  <button type="button" data-selection-command="italic" title="Italic">I</button>
  <button type="button" data-selection-command="code" title="Code">Code</button>
  <button type="button" data-selection-command="link" title="Link">Link</button>
  <span aria-hidden="true"></span>
  <button type="button" data-selection-command="copy" title="Copy">Copy</button>
`;
selectionTool.hidden = true;
document.body.appendChild(selectionTool);

const findTool = document.createElement("div");
findTool.className = "aaronnote-find-tool";
findTool.innerHTML = `
  <input data-find-query type="search" placeholder="Find" />
  <input data-find-replace type="text" placeholder="Replace" />
  <label><input data-find-regex type="checkbox" /> Regex</label>
  <span data-find-count></span>
  <button type="button" data-find-action="prev">Prev</button>
  <button type="button" data-find-action="next">Next</button>
  <button type="button" data-find-action="replace">Replace</button>
  <button type="button" data-find-action="all">All</button>
  <button type="button" data-find-action="close">Close</button>
`;
findTool.hidden = true;
document.body.appendChild(findTool);
const findQuery = findTool.querySelector<HTMLInputElement>("[data-find-query]")!;
const findReplace = findTool.querySelector<HTMLInputElement>("[data-find-replace]")!;
const findRegex = findTool.querySelector<HTMLInputElement>("[data-find-regex]")!;
const findCount = findTool.querySelector<HTMLElement>("[data-find-count]")!;

const quickInsertPopup = document.createElement("div");
quickInsertPopup.className = "aaronnote-quick-popup";
quickInsertPopup.hidden = true;
document.body.appendChild(quickInsertPopup);

const blockMenuTrigger = document.createElement("button");
blockMenuTrigger.type = "button";
blockMenuTrigger.className = "aaronnote-block-menu-trigger";
blockMenuTrigger.title = "Block menu";
blockMenuTrigger.textContent = "+";
blockMenuTrigger.hidden = true;
blockMenuTrigger.setAttribute("aria-hidden", "true");
document.body.appendChild(blockMenuTrigger);

const modal = document.createElement("div");
modal.className = "aaronnote-modal";
modal.hidden = true;
document.body.appendChild(modal);

const vimCursor = createVimCursor();

let currentFile = "";
let currentMode: "markdown" | "source" = "markdown";
let currentStandalone = false;
let saveTimer = 0;
let notes: NoteSummary[] = [];
let snippets: SnippetSummary[] = [];
let pendingTodoFocus: { file: string; source: string; index?: number } | null = null;
let assistFrame = 0;
let assistTimer = 0;
let vimMode: VimLiteMode = "insert";
let snippetPopupItems: SnippetSummary[] = [];
let snippetPopupIndex = 0;
let snippetDeleteBefore = 0;
let snippetSuppressedPrefix = "";
let snippetRenderKey = "";
let snippetSuggestionsEnabled = true;
let snippetMouseSuppressed = false;
let quickInsertItems: QuickInsertItem[] = [];
let quickInsertIndex = 0;
let quickInsertDeleteBefore = 0;
let quickInsertRenderKey = "";
let quickInsertSuppressedPrefix = "";
let quickInsertMode: "slash" | "block" = "slash";
let blockMenuPinned = false;
let snippetSession: SnippetSession;
let mathPreviewKey = "";
let mathPreviewUpdateRequested = false;
let snippetScanRequested = false;
let findMatches: Array<{ from: number; to: number; match: RegExpExecArray }> = [];
let findIndex = -1;
let saveRequestSeq = 0;
const saveClientId = (() => {
  try {
    return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();
let saveAbortController: AbortController | null = null;
let pathSuggestions: string[] = [];
let pendingEquationTag = params.get("eqTag") || "";
let activeNoteKind = "";
let noteKindCleanup: (() => void) | null = null;
let noteKindLoadSeq = 0;

const recentStorageKey = "aaronnote.recent";
const writingModeStorageKey = "aaronnote.writingMode";
const snippetSuggestionsStorageKey = "aaronnote.snippetSuggestions.enabled";
type RecentNote = { file: string; openedAt: number };
type OpenNoteOptions = { newWindow?: boolean; equationTag?: string };
let recentNotes = loadRecentNotes();
let writingMode = loadWritingMode();
snippetSuggestionsEnabled = loadSnippetSuggestionsEnabled();

const cursorStorageKey = "aaronnote.cursorPositions";
type CursorPosition = {
  file: string;
  mode: "markdown" | "source";
  from: number;
  to: number;
  scrollY: number;
  updatedAt: number;
};
let cursorPositions = loadCursorPositions();
let cursorSaveTimer = 0;
let lastCursorSaveKey = "";

type UploadedAsset = {
  ok?: boolean;
  file?: string;
  name?: string;
  type?: string;
  isImage?: boolean;
  markdownPath?: string;
  message?: string;
};

type NoteKindContext = {
  kind: string;
  file: string;
  note?: NoteSummary;
  content: string;
  editor: unknown;
  host: HTMLElement;
  root: HTMLElement;
};

type NoteKindModule = {
  default?: (context: NoteKindContext) => void | (() => void);
  setup?: (context: NoteKindContext) => void | (() => void);
  teardown?: (context: NoteKindContext) => void;
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
    snippetMouseSuppressed = false;
    scheduleAssistUpdate({ snippets: true, mathPreview: true });
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
applyWritingMode();

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

const filesystemBrowser = createFilesystemBrowser({
  noteList,
  recentList,
  noteFilter,
  noteCount,
  managementCount,
  getNotes: () => notes,
  getRecentNotes: () => recentNotes,
  getCurrentFile: () => currentFile,
  openNote,
  deleteNote: (note) => void deleteNoteFromBrowser(note),
  createNode: () => void createNode(),
  createFolder: (dir) => createFolderFromBrowser(dir),
});

const agendaManager = createAgendaManager({
  filter: agendaFilter,
  sort: agendaSort,
  done: agendaDone,
  count: agendaCount,
  list: agendaList,
  getNotes: () => notes,
  getCurrentFile: () => currentFile,
  setStatus,
  setPendingTodoFocus: (focus) => {
    pendingTodoFocus = focus;
  },
  showEditorPage,
  jumpToTodoSource,
  openNote,
});

const unusedAssetsManager = createUnusedAssetsManager({
  section: unusedAssetsSection,
  count: unusedAssetsCount,
  list: unusedAssetsList,
  selectAll: unusedAssetsSelectAll,
  scanButton: scanUnusedAssetsButton,
  trashButton: trashUnusedAssetsButton,
  setStatus,
  openFormModal,
});

const floatingTocPanel = createFloatingTocPanel({
  toc,
  toggleButton: tocToggle,
  list: tocList,
  editor,
  getNotes: () => notes,
  getCurrentFile: () => currentFile,
  resolveNoteRef,
  openNote,
});

const graphPanel = createGraphPanel({
  page: graphPage,
  filter: graphFilter,
  stats: graphStats,
  canvas: graphCanvas,
  focusPanel: graphFocus,
  getNotes: () => notes,
  openNote,
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

host.addEventListener("focusout", () => {
  window.setTimeout(() => {
    if (document.activeElement && host.contains(document.activeElement)) return;
    mathPreview.hidden = true;
    mathPreviewKey = "";
  }, 0);
});

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function findPattern(): RegExp | null {
  const query = findQuery.value;
  if (!query) return null;
  try {
    return new RegExp(findRegex.checked ? query : escapeRegExp(query), "gu");
  } catch (err) {
    findCount.textContent = err instanceof Error ? err.message : "Bad regex";
    return null;
  }
}

function refreshFindMatches(): void {
  findMatches = [];
  findIndex = -1;
  const pattern = findPattern();
  if (!pattern) {
    findCount.textContent = "";
    return;
  }
  const markdown = editor.getMarkdown();
  for (const match of markdown.matchAll(pattern)) {
    const from = match.index ?? 0;
    const text = match[0] ?? "";
    if (!text) {
      pattern.lastIndex += 1;
      continue;
    }
    findMatches.push({ from, to: from + text.length, match });
  }
  findCount.textContent = findMatches.length ? `0 / ${findMatches.length}` : "No matches";
}

function selectFindMatch(index: number): void {
  if (findMatches.length === 0) {
    refreshFindMatches();
    if (findMatches.length === 0) return;
  }
  findIndex = (index + findMatches.length) % findMatches.length;
  const match = findMatches[findIndex]!;
  editor.setMarkdownSelection(match.from, match.to);
  findCount.textContent = `${findIndex + 1} / ${findMatches.length}`;
}

function findNext(delta = 1): void {
  if (findMatches.length === 0) refreshFindMatches();
  selectFindMatch(findIndex + delta);
}

function openFindTool(): void {
  if (!notesPage.hidden) {
    showNotesTool("filesystem");
    noteFilter.focus();
    noteFilter.select();
    return;
  }
  findTool.hidden = false;
  findQuery.focus();
  findQuery.select();
  refreshFindMatches();
}

function closeFindTool(): void {
  findTool.hidden = true;
  editor.focus();
}

function replacementText(match: RegExpExecArray): string {
  if (!findRegex.checked) return findReplace.value;
  return findReplace.value.replace(/\$(\$|&|\d{1,2})/g, (_token, key: string) => {
    if (key === "$") return "$";
    if (key === "&") return match[0] ?? "";
    const index = Number(key);
    return Number.isFinite(index) ? match[index] ?? "" : "";
  });
}

function replaceCurrentFindMatch(): void {
  if (findMatches.length === 0) refreshFindMatches();
  if (findMatches.length === 0) return;
  const match = findMatches[Math.max(0, findIndex)] ?? findMatches[0]!;
  editor.replaceMarkdownRange(match.from, match.to, replacementText(match.match), "end");
  refreshFindMatches();
  selectFindMatch(Math.min(findIndex, findMatches.length - 1));
}

function replaceAllFindMatches(): void {
  const pattern = findPattern();
  if (!pattern) return;
  const markdown = editor.getMarkdown();
  const next = markdown.replace(pattern, findReplace.value);
  if (next === markdown) return;
  editor.setMarkdown(next);
  refreshFindMatches();
  scheduleAssistUpdate({ snippets: true });
  if (currentFile) {
    setStatus("Dirty");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => save(), 900);
  } else {
    setStatus(scratchStatus());
  }
}

function decodeNoteRef(ref: string): string {
  let decoded = ref;
  try {
    decoded = decodeURIComponent(ref);
  } catch {
    decoded = ref;
  }
  return decoded.replace(/\\([\\`*_[\](){}#+.!<>-])/g, "$1");
}

function cleanHref(href: string): string {
  const raw = String(href || "").trim();
  if (raw.startsWith("<") && raw.endsWith(">")) return raw.slice(1, -1).trim();
  return raw;
}

function hrefProtocol(href: string): string | null {
  return cleanHref(href).match(/^([A-Za-z][\w+.-]*):/)?.[1]?.toLowerCase() ?? null;
}

function hrefPath(href: string): string {
  const raw = cleanHref(href);
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

function hrefHash(href: string): string {
  const raw = cleanHref(href);
  const index = raw.indexOf("#");
  if (index < 0) return "";
  return decodeNoteRef((raw.slice(index + 1).split(/[?&]/, 1)[0] ?? "").trim());
}

function equationTagFromHref(href: string): string | null {
  const hash = hrefHash(href);
  if (!hash) return null;
  if (/^eq-/i.test(hash)) return decodeNoteRef(hash.slice(3)).trim() || null;
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function noteRefFromRoamHref(href: string): string | null {
  const match = cleanHref(href).match(/^roam:\/\/(.+)$/i);
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
  return /\.(?:md|markdown|typ)$/i.test(hrefPath(href));
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

function standaloneNoteFromMarkdownHref(href: string): NoteSummary | undefined {
  if (!markdownNoteHref(href)) return undefined;
  const file = internalNoteCandidates(href).find((candidate) => candidate.startsWith("/"));
  if (!file) return undefined;
  return {
    file,
    path: file,
    title: fileNameFromPath(file),
    standalone: true,
  };
}

function noteWindowUrl(note: NoteSummary, equationTag = ""): string {
  const url = new URL(window.location.href);
  url.searchParams.set("file", note.file || "");
  if (equationTag) url.searchParams.set("eqTag", equationTag);
  else url.searchParams.delete("eqTag");
  return url.toString();
}

function openExternalUrl(href: string, options: OpenNoteOptions = {}): void {
  if (!safeHref(href)) {
    setStatus("Blocked unsafe link");
    return;
  }
  const equationTag = options.equationTag || equationTagFromHref(href) || "";
  if (equationTag && String(href || "").trim().startsWith("#")) {
    if (!jumpToEquationTag(equationTag)) setStatus(`Equation tag not found: ${equationTag}`);
    return;
  }
  const roamRef = noteRefFromRoamHref(href);
  if (roamRef != null) {
    const note = resolveNoteRef(roamRef);
    if (note) openNote(note, { ...options, equationTag });
    else setStatus(`Roam note not found: ${roamRef}`);
    return;
  }
  if (markdownNoteHref(href)) {
    const note = resolveInternalNoteHref(href) || standaloneNoteFromMarkdownHref(href);
    if (note) openNote(note, { ...options, equationTag });
    else setStatus(`Note not found: ${hrefPath(href)}`);
    return;
  }
  if (options.newWindow) {
    window.open(href, "_blank", "noopener,noreferrer");
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
  void saveStandalone();
}

function syncSourceUi(): void {
  currentMode = editor.isSourceMode() ? "source" : "markdown";
  host.classList.toggle("is-source-mode", currentMode === "source");
  root.dataset.viewMode = currentMode;
  sourceButton.textContent = currentMode === "source" ? "Preview" : "Source";
  sourceButton.setAttribute("aria-pressed", currentMode === "source" ? "true" : "false");
}

async function saveStandalone(): Promise<boolean> {
  const seq = ++saveRequestSeq;
  const file = currentFile;
  if (!file) {
    setStatus(scratchStatus());
    return false;
  }
  const content = editor.getMarkdown();
  const mode = editor.isSourceMode() ? "source" : "markdown";
  saveAbortController?.abort();
  const controller = new AbortController();
  saveAbortController = controller;
  setStatus("Saving");
  let saved = false;
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file, content, mode, clientId: saveClientId, seq }),
      signal: controller.signal,
    });
    const msg = await res.json() as Extract<Inbound, { type: "saved" }>;
    saved = res.ok && msg.ok === true;
    if (seq !== saveRequestSeq || file !== currentFile) return false;
    setStatus(saved ? "Saved" : msg.message || "Save failed");
    if (Array.isArray(msg.notes)) {
      notes = msg.notes;
      renderNotes();
      if (!notesPage.hidden && notesPanels.some((panel) => panel.dataset.notesPanel === "agenda" && !panel.hidden)) void loadAgendaTodos(true);
      if (!graphPage.hidden) renderGraph();
      updateFloatingToc();
    }
    void applyNoteKindAssets(msg.kind ?? currentNote()?.kind ?? noteKindFromMarkdown(content));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    if (seq !== saveRequestSeq || file !== currentFile) return false;
    setStatus(err instanceof Error ? err.message : "Save failed");
  } finally {
    if (saveAbortController === controller) saveAbortController = null;
  }
  return saved;
}

function pdfExportName(): string {
  const rawName = (currentFile || "Aaronnote.md").split(/[\\/]/).pop() || "Aaronnote.md";
  return `${rawName.replace(/\.[^.]+$/, "") || "Aaronnote"}.pdf`;
}

async function exportPdf(): Promise<void> {
  setStatus("Exporting PDF");
  const desktopExport = window.AaronnoteDesktop?.exportPdf;
  if (desktopExport) {
    try {
      if (!currentFile) {
        setStatus("Save the note before exporting PDF");
        return;
      }
      if (!await saveStandalone()) throw new Error("Save failed");
      const msg = await desktopExport({
        file: currentFile || "Aaronnote.md",
        name: pdfExportName(),
      });
      if (msg?.canceled) {
        setStatus("Export canceled");
        return;
      }
      if (!msg?.ok) throw new Error(msg?.message || "PDF export failed");
      setStatus(msg.message || `Exported ${msg.file || pdfExportName()}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "PDF export failed");
    }
    return;
  }

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
    link.href = href;
    link.download = pdfExportName();
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
    if (!notesPage.hidden && notesPanels.some((panel) => panel.dataset.notesPanel === "agenda" && !panel.hidden)) void loadAgendaTodos(true);
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
  if (currentStandalone) {
    setStatus("Standalone Markdown files are not managed as roam notes");
    return;
  }
  const confirmed = await openFormModal("Delete note", [
    { id: "confirm", label: `Type TRASH to move ${currentFile} to the system Trash`, value: "" },
  ], "Move to Trash");
  if (confirmed?.confirm !== "TRASH") return;
  setStatus("Moving note to Trash");
  try {
    const fileToDelete = currentFile;
    if (window.AaronnoteDesktop?.trashNote) {
      const desktopResult = await window.AaronnoteDesktop.trashNote(fileToDelete);
      if (!desktopResult?.ok) throw new Error(desktopResult?.message || "Move to Trash failed");
      const res = await fetch("/api/roamdb/sync");
      const msg = await res.json() as { notes?: NoteSummary[]; message?: string };
      if (!res.ok || !Array.isArray(msg.notes)) throw new Error(msg.message || "Refresh failed");
      notes = msg.notes;
    } else {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: fileToDelete }),
      });
      const msg = await res.json() as { ok?: boolean; notes?: NoteSummary[]; message?: string };
      if (!res.ok || !msg.ok) throw new Error(msg.message || "Move to Trash failed");
      notes = Array.isArray(msg.notes) ? msg.notes : [];
    }
    cursorPositions.delete(fileToDelete);
    saveCursorPositionsLocal();
    currentFile = "";
    fileLabel.textContent = "Scratch";
    editor.setMarkdown("");
    renderNotes();
    if (!graphPage.hidden) renderGraph();
    updateFloatingToc();
    setStatus("Moved note to Trash");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Move to Trash failed");
  }
}

async function deleteNoteFromBrowser(note: NoteSummary): Promise<void> {
  if (!note.file) {
    setStatus("No selected note");
    return;
  }
  const label = note.path || note.file;
  const confirmed = await openFormModal("Delete note", [
    { id: "confirm", label: `Type TRASH to move ${label} to the system Trash`, value: "" },
  ], "Move to Trash");
  if (confirmed?.confirm !== "TRASH") return;
  setStatus("Moving note to Trash");
  try {
    const fileToDelete = note.file;
    if (window.AaronnoteDesktop?.trashNote) {
      const desktopResult = await window.AaronnoteDesktop.trashNote(fileToDelete);
      if (!desktopResult?.ok) throw new Error(desktopResult?.message || "Move to Trash failed");
      const res = await fetch("/api/roamdb/sync");
      const msg = await res.json() as { notes?: NoteSummary[]; message?: string };
      if (!res.ok || !Array.isArray(msg.notes)) throw new Error(msg.message || "Refresh failed");
      notes = msg.notes;
    } else {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: fileToDelete }),
      });
      const msg = await res.json() as { ok?: boolean; notes?: NoteSummary[]; message?: string };
      if (!res.ok || !msg.ok) throw new Error(msg.message || "Move to Trash failed");
      notes = Array.isArray(msg.notes) ? msg.notes : [];
    }
    cursorPositions.delete(fileToDelete);
    saveCursorPositionsLocal();
    if (fileToDelete === currentFile) {
      currentFile = "";
      fileLabel.textContent = "Scratch";
      editor.setMarkdown("");
    }
    renderNotes();
    if (!graphPage.hidden) renderGraph();
    updateFloatingToc();
    setStatus("Moved note to Trash");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Move to Trash failed");
  }
}

async function createFolderFromBrowser(baseDir: string): Promise<string | null> {
  const initial = baseDir ? `${normalizeNotePath(baseDir)}/` : "";
  const result = await openFormModal("New folder", [
    { id: "path", label: "Folder path", type: "path", value: initial, suggestions: notePathSuggestions() },
  ], "Create");
  if (!result) return null;
  const folder = normalizeNotePath(result.path || "");
  if (!folder) return null;
  setStatus("Creating folder");
  try {
    const res = await fetch("/api/folder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: folder }),
    });
    const msg = await res.json() as { ok?: boolean; path?: string; notes?: NoteSummary[]; message?: string };
    if (!res.ok || !msg.ok) throw new Error(msg.message || "Create folder failed");
    if (Array.isArray(msg.notes)) notes = msg.notes;
    renderNotes();
    setStatus(`Folder created: ${msg.path || folder}`);
    return msg.path || folder;
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Create folder failed");
    return null;
  }
}

async function updateNoteMeta(endpoint: string, body: Record<string, unknown>, success: string): Promise<void> {
  if (!currentFile) {
    setStatus("No current note");
    return;
  }
  if (currentStandalone) {
    setStatus("Roam metadata is unavailable for standalone Markdown files");
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

type MathTagTarget = {
  tex: string;
  replace: (nextTex: string, tag: string) => void;
};

function findDisplayMathRangeInMarkdown(markdown: string, pos: number): { bodyFrom: number; bodyTo: number; tex: string } | null {
  const fence = /^[ \t]*\$\$[ \t]*$/gm;
  let open: RegExpExecArray | null;
  while ((open = fence.exec(markdown))) {
    const openStart = open.index;
    const openEnd = openStart + open[0].length;
    const bodyFrom = markdown[openEnd] === "\n" ? openEnd + 1 : openEnd;
    fence.lastIndex = bodyFrom;
    const close = fence.exec(markdown);
    if (!close) return null;
    const closeStart = close.index;
    const closeEnd = closeStart + close[0].length;
    const bodyTo = markdown[closeStart - 1] === "\n" ? closeStart - 1 : closeStart;
    if (pos >= openStart && pos <= closeEnd) {
      return { bodyFrom, bodyTo, tex: markdown.slice(bodyFrom, bodyTo) };
    }
    fence.lastIndex = closeEnd;
  }
  return null;
}

function activeDisplayMathTarget(): MathTagTarget | null {
  if (editor.isSourceMode()) {
    const selection = editor.getSelection();
    const markdown = editor.getMarkdown();
    const range = findDisplayMathRangeInMarkdown(markdown, selection.from);
    if (!range) return null;
    return {
      tex: range.tex,
      replace(nextTex, tag) {
        editor.replaceRange(range.bodyFrom, range.bodyTo, nextTex, "end");
        selectLatexTag(range.bodyFrom, nextTex, tag);
      },
    };
  }

  const selection = editor.view.state.selection;
  const $from = selection.$from;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== "math_block") continue;
    const blockStart = $from.before(depth);
    const contentFrom = blockStart + 1;
    const contentTo = contentFrom + node.content.size;
    return {
      tex: node.textContent,
      replace(nextTex, tag) {
        editor.replaceRange(contentFrom, contentTo, nextTex, "end");
        selectLatexTag(contentFrom, nextTex, tag);
      },
    };
  }
  return null;
}

function selectLatexTag(base: number, tex: string, tag: string): void {
  const range = findLatexTagRange(tex, tag);
  if (!range) return;
  editor.setSelection(base + range.from, base + range.to);
  editor.revealCursor();
}

function currentNote(): NoteSummary | undefined {
  const note = notes.find((item) => item.file === currentFile);
  if (note) return note;
  if (!currentFile) return undefined;
  return {
    file: currentFile,
    path: currentFile,
    title: fileNameFromPath(currentFile),
    kind: noteKindFromMarkdown(editor.getMarkdown()),
    standalone: currentStandalone,
  };
}

function parseMetaScalar(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\\_/g, "_");
}

function firstMetaValue(raw: string, keys: string[]): string {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const line of raw.split(/\r?\n/)) {
    const pair = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/);
    if (!pair || !wanted.has(pair[1].toLowerCase())) continue;
    return parseMetaScalar(pair[2]);
  }
  return "";
}

function noteKindFromMarkdown(markdown: string): string {
  const text = String(markdown || "");
  const org = text.match(/^\s*#\+begin\s+meta\s*\r?\n([\s\S]*?)\r?\n\s*#\+end\s+meta\s*$/im);
  const yaml = text.match(/^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  return normalizeNoteKind(firstMetaValue(org?.[1] ?? yaml?.[1] ?? "", ["kind", "kinds"]));
}

function normalizeNoteKind(value: unknown): string {
  const kind = String(Array.isArray(value) ? value[0] : value || "").trim().replace(/\\_/g, "_").toLowerCase();
  if (!kind || kind === "default" || kind === "note") return "default";
  return /^[a-z0-9_-]+$/.test(kind) ? kind : "default";
}

function activeKindName(value: unknown): string {
  const kind = normalizeNoteKind(value);
  return kind === "default" ? "" : kind;
}

function noteKindContext(kind: string): NoteKindContext {
  return {
    kind,
    file: currentFile,
    note: currentNote(),
    content: editor.getMarkdown(),
    editor,
    host,
    root,
  };
}

function setKindDataset(kind: string): void {
  const value = kind || "default";
  root.dataset.noteKind = value;
  host.dataset.noteKind = value;
  document.body.dataset.noteKind = value;
}

function prepareNoteKindRender(kindValue: unknown): void {
  const kind = activeKindName(kindValue);
  if (activeNoteKind && activeNoteKind !== kind) clearNoteKindAssets();
  setKindDataset(kind);
}

function clearNoteKindAssets(): void {
  const context = activeNoteKind ? noteKindContext(activeNoteKind) : null;
  try {
    noteKindCleanup?.();
  } catch (err) {
    console.warn("Aaronnote kind cleanup failed", err);
  }
  if (context) {
    window.dispatchEvent(new CustomEvent("aaronnote:kind-leave", { detail: context }));
  }
  noteKindCleanup = null;
  activeNoteKind = "";
  document.querySelectorAll<HTMLLinkElement>("link[data-aaronnote-kind-asset]").forEach((link) => link.remove());
}

function dispatchNoteKindReady(kind: string): void {
  window.dispatchEvent(new CustomEvent("aaronnote:kind-ready", { detail: noteKindContext(kind) }));
}

async function applyNoteKindAssets(kindValue: unknown): Promise<void> {
  const kind = activeKindName(kindValue);
  const seq = ++noteKindLoadSeq;
  setKindDataset(kind);
  if (!kind) {
    clearNoteKindAssets();
    return;
  }
  if (activeNoteKind === kind) {
    dispatchNoteKindReady(kind);
    return;
  }

  clearNoteKindAssets();
  activeNoteKind = kind;

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = `/kinds/${encodeURIComponent(kind)}/index.css`;
  css.dataset.aaronnoteKindAsset = "style";
  css.dataset.kind = kind;
  document.head.appendChild(css);

  try {
    const mod = await import(/* @vite-ignore */ `/kinds/${encodeURIComponent(kind)}/index.js`) as NoteKindModule;
    if (seq !== noteKindLoadSeq || activeNoteKind !== kind) {
      const staleContext = noteKindContext(kind);
      if (typeof mod.teardown === "function") mod.teardown(staleContext);
      return;
    }
    const context = noteKindContext(kind);
    const setup = typeof mod.default === "function" ? mod.default : typeof mod.setup === "function" ? mod.setup : null;
    const cleanup = setup?.(context);
    noteKindCleanup = typeof cleanup === "function"
      ? cleanup
      : typeof mod.teardown === "function"
        ? () => mod.teardown?.(context)
        : null;
    dispatchNoteKindReady(kind);
  } catch (err) {
    if (seq === noteKindLoadSeq && activeNoteKind === kind) {
      console.warn(`Aaronnote kind assets unavailable for ${kind}`, err);
    }
  }
}

function findLatexTagRange(tex: string, tag: string): { from: number; to: number } | null {
  if (!tag) return null;
  const exact = `\\tag{${tag}}`;
  const exactIndex = tex.indexOf(exact);
  if (exactIndex >= 0) {
    const from = exactIndex + "\\tag{".length;
    return { from, to: from + tag.length };
  }
  const pattern = new RegExp(`\\\\tag\\s*\\{\\s*${escapeRegExp(tag)}\\s*\\}`, "g");
  const match = pattern.exec(tex);
  if (!match) return null;
  const matched = match[0] ?? "";
  const tagIndex = matched.indexOf(tag);
  if (tagIndex < 0) return null;
  const from = match.index + tagIndex;
  return { from, to: from + tag.length };
}

function jumpToEquationTag(rawTag: string): boolean {
  const tag = normalizeEquationTag(rawTag);
  if (!tag) return false;

  if (editor.isSourceMode()) {
    const range = findLatexTagRange(editor.getMarkdown(), tag);
    if (!range) return false;
    editor.setSelection(range.from, range.to);
    editor.revealCursor();
    setStatus(`Equation tag ${tag}`);
    scheduleAssistUpdate();
    return true;
  }

  let hit: { from: number; to: number } | null = null;
  editor.view.state.doc.descendants((node, pos) => {
    if (hit) return false;
    if (node.type.name !== "math_block") return true;
    const range = findLatexTagRange(node.textContent, tag);
    if (!range) return true;
    hit = {
      from: pos + 1 + range.from,
      to: pos + 1 + range.to,
    };
    return false;
  });
  if (!hit) return false;
  editor.setSelection(hit.from, hit.to);
  editor.revealCursor();
  setStatus(`Equation tag ${tag}`);
  scheduleAssistUpdate();
  return true;
}

function jumpToTodoSource(source: string, preferredIndex?: number): boolean {
  const target = String(source || "");
  if (!target) return false;
  if (editor.isSourceMode()) {
    const markdown = editor.getMarkdown();
    const index = typeof preferredIndex === "number" && markdown.slice(preferredIndex, preferredIndex + target.length) === target
      ? preferredIndex
      : markdown.indexOf(target);
    if (index < 0) return false;
    const contentOffset = Math.max(0, target.indexOf("[") + 1);
    editor.setSelection(index + contentOffset, index + contentOffset + Math.min(1, Math.max(0, target.length - contentOffset - 1)));
    editor.revealCursor();
    return true;
  }

  let hit: { from: number; to: number } | null = null;
  editor.view.state.doc.descendants((node, pos) => {
    if (hit || !node.isTextblock) return !hit;
    const text = node.textContent;
    const index = text.indexOf(target);
    if (index < 0) return true;
    const contentOffset = Math.max(0, target.indexOf("[") + 1);
    const from = pos + 1 + index + contentOffset;
    hit = {
      from,
      to: Math.min(pos + 1 + text.length, from + Math.min(1, Math.max(0, target.length - contentOffset - 1))),
    };
    return false;
  });
  if (!hit) return false;
  editor.setSelection(hit.from, hit.to);
  editor.revealCursor();
  scheduleAssistUpdate();
  return true;
}

function equationTagSuggestionsFromContent(content = editor.getMarkdown()): string[] {
  return [...new Set([...content.matchAll(/\\tag\s*\{([^{}\n]+)\}/g)].map((match) => match[1]!.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function existingLatexTag(tex: string): string {
  return tex.match(/\\tag\s*\{([^{}\n]+)\}/)?.[1]?.trim() || "";
}

function normalizeEquationTag(value: string): string {
  return String(value || "")
    .replace(/[\r\n{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function upsertLatexTag(tex: string, tag: string): string {
  const clean = tex
    .replace(/\s*\\tag\s*\{[^{}\n]*\}/g, "")
    .replace(/\s+$/g, "");
  const separator = clean.includes("\n") ? "\n" : " ";
  return `${clean}${separator}\\tag{${tag}}`;
}

function equationHash(tag: string): string {
  return `eq-${encodeURIComponent(tag)}`;
}

function encodeMarkdownHrefPathPart(part: string): string {
  return encodeURIComponent(part).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeMarkdownHrefPath(path: string): string {
  return decodeNoteRef(path)
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => encodeMarkdownHrefPathPart(part))
    .join("/");
}

function equationReferenceMarkdown(tag: string): string {
  const note = currentNote();
  const targetPath = note?.path || note?.link || currentFile || note?.source || fileNameFromPath(currentFile || "note.md");
  return `[${tag}](${encodeMarkdownHrefPath(targetPath)}#${equationHash(tag)})`;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.style.position = "fixed";
    fallback.style.left = "-9999px";
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
  }
}

function nextEquationTagSuggestion(): string {
  const used = new Set(equationTagSuggestionsFromContent());
  for (let i = 1; i < 1000; i++) {
    const tag = `eq:${i}`;
    if (!used.has(tag)) return tag;
  }
  return `eq:${Date.now()}`;
}

async function tagActiveEquation(): Promise<boolean> {
  const target = activeDisplayMathTarget();
  if (!target) return false;
  const current = existingLatexTag(target.tex);
  const result = await openFormModal("Equation tag", [
    {
      id: "tag",
      label: "LaTeX tag",
      value: current || nextEquationTagSuggestion(),
      suggestions: equationTagSuggestionsFromContent(),
    },
  ], "Tag & Copy Ref");
  if (!result) return true;
  const tag = normalizeEquationTag(result.tag);
  if (!tag) return true;
  const nextTex = upsertLatexTag(target.tex, tag);
  target.replace(nextTex, tag);
  const ref = equationReferenceMarkdown(tag);
  await copyText(ref);
  setStatus(`Equation tag ${tag}; ref copied`);
  scheduleAssistUpdate();
  return true;
}

async function openTagManager(): Promise<void> {
  if (!currentFile) {
    setStatus("Open a note before managing tags");
    return;
  }
  if (currentStandalone) {
    setStatus("Roam tag manager is unavailable for standalone Markdown files");
    return;
  }
  const note = currentNote();
  const result = await openFormModal("Tag manager", [
    {
      id: "tags",
      label: "Note tags",
      type: "tags",
      value: (note?.tags ?? []).join(", "),
      suggestions: tagSuggestions(),
    },
  ], "Update Tags");
  if (!result) return;
  await updateNoteMeta("/api/meta/add", {
    title: note?.title || fileLabel.textContent || "Untitled",
    tags: parseTagPrompt(result.tags),
    kind: note?.kind || "default",
  }, "Tags updated");
}

async function handleTagCommand(): Promise<void> {
  if (await tagActiveEquation()) return;
  await openTagManager();
}

function toggleSourceMode(): void {
  saveCursorPositionNow({ force: true });
  editor.toggleSource();
  vim.setMode("insert");
  syncSourceUi();
  setStatus(currentMode === "source" ? "Source mode" : "Ready");
  scheduleAssistUpdate();
  scheduleCursorPositionSave(80);
}

function cleanupTransientUi(): void {
  hideSnippetPopup();
  mathPreview.hidden = true;
  selectionTool.hidden = true;
  window.clearTimeout(assistTimer);
  window.cancelAnimationFrame(assistFrame);
}

function disposeGraph(): void {
  graphPanel.dispose();
}

function showNotesPage(tab = "filesystem"): void {
  if (currentStandalone) {
    setStatus("Standalone Markdown file");
    return;
  }
  saveCursorPositionNow({ force: true });
  cleanupTransientUi();
  disposeGraph();
  host.hidden = true;
  notesPage.hidden = false;
  toc.hidden = true;
  notesButton.hidden = true;
  agendaButton.hidden = true;
  sourceButton.hidden = true;
  editorButton.hidden = false;
  showNotesTool(tab);
  if (tab === "filesystem") window.requestAnimationFrame(() => filesystemBrowser.focus());
}

function openFilesystemPage(): void {
  showNotesPage("filesystem");
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
  } else if (tab === "agenda") {
    void loadAgendaTodos();
    agendaFilter.focus();
  } else if (tab === "recent") {
    renderRecentNotes();
  } else if (tab === "filesystem") {
    window.requestAnimationFrame(() => filesystemBrowser.focus());
  }
}

function showEditorPage(): void {
  disposeGraph();
  notesPage.hidden = true;
  host.hidden = false;
  toc.hidden = false;
  notesButton.hidden = currentStandalone;
  agendaButton.hidden = currentStandalone;
  sourceButton.hidden = false;
  editorButton.hidden = true;
  editor.focus();
  scheduleAssistUpdate();
}

function updateFloatingToc(): void {
  floatingTocPanel.update();
}

function openNote(note: NoteSummary, options: OpenNoteOptions = {}): void {
  if (!note.file) return;
  const equationTag = normalizeEquationTag(options.equationTag || "");
  saveCursorPositionNow({ force: true });
  touchRecentNote(note.file);
  if (options.newWindow) {
    window.open(noteWindowUrl(note, equationTag), "_blank", "noopener,noreferrer");
    setStatus("Opening note window");
    return;
  }
  if (equationTag && note.file === currentFile) {
    showEditorPage();
    if (!jumpToEquationTag(equationTag)) setStatus(`Equation tag not found: ${equationTag}`);
    return;
  }
  pendingEquationTag = equationTag;
  void openStandaloneFile(note.file);
  showEditorPage();
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

function currentSnippetKind(): string {
  return activeKindName(root.dataset.noteKind || document.body.dataset.noteKind || currentNote()?.kind || "");
}

function snippetAppliesToCurrentKind(snippet: SnippetSummary): boolean {
  const kind = activeKindName(snippet.kind || "");
  return !kind || kind === currentSnippetKind();
}

function matchingSnippets(prefix: string): SnippetSummary[] {
  const query = prefix.toLowerCase();
  return snippets
    .filter(snippetAppliesToCurrentKind)
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

function hideQuickInsertPopup(): void {
  quickInsertPopup.hidden = true;
  quickInsertItems = [];
  quickInsertRenderKey = "";
  quickInsertMode = "slash";
  blockMenuPinned = false;
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

function quickInsertPrefix(before: string): { query: string; deleteBefore: number } | null {
  const line = before.slice(before.lastIndexOf("\n") + 1);
  const match = line.match(/^[ \t]*\/([A-Za-z0-9_-]{0,32})$/);
  if (!match) return null;
  const query = match[1] ?? "";
  if (query === quickInsertSuppressedPrefix) return null;
  return { query, deleteBefore: query.length + 1 };
}

function editorHasNativeSelection(): boolean {
  if (editor.isSourceMode()) return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  return !!anchor && !!focus && host.contains(anchor) && host.contains(focus);
}

function renderQuickInsertPopup(query: string, rect: { left: number; top: number; bottom: number } | null): void {
  const nextKey = `${quickInsertMode}\n${query}\n${quickInsertIndex}\n${quickInsertItems.map((item) => `${item.id}:${item.label}`).join("\n")}`;
  if (!quickInsertPopup.hidden && quickInsertRenderKey === nextKey) {
    placeFloating(quickInsertPopup, rect, 360);
    quickInsertPopup.querySelector(".aaronnote-quick-option.is-active")?.scrollIntoView({ block: "nearest" });
    return;
  }
  quickInsertRenderKey = nextKey;
  quickInsertPopup.innerHTML = "";
  quickInsertItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = `aaronnote-quick-option-${index}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", index === quickInsertIndex ? "true" : "false");
    button.className = index === quickInsertIndex
      ? "aaronnote-quick-option is-active"
      : "aaronnote-quick-option";
    const icon = document.createElement("span");
    icon.className = "aaronnote-quick-option-icon";
    icon.textContent = item.label.slice(0, 1).toUpperCase();
    const label = document.createElement("span");
    label.className = "aaronnote-quick-option-label";
    label.textContent = item.label;
    const detail = document.createElement("span");
    detail.className = "aaronnote-quick-option-detail";
    detail.textContent = item.detail ?? item.command ?? "";
    button.append(icon, label, detail);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      quickInsertIndex = index;
      chooseQuickInsertItem();
    });
    quickInsertPopup.appendChild(button);
  });
  quickInsertPopup.dataset.query = query;
  quickInsertPopup.setAttribute("role", "listbox");
  quickInsertPopup.setAttribute("aria-activedescendant", `aaronnote-quick-option-${quickInsertIndex}`);
  quickInsertPopup.hidden = false;
  placeFloating(quickInsertPopup, rect, 360);
  quickInsertPopup.querySelector(".aaronnote-quick-option.is-active")?.scrollIntoView({ block: "nearest" });
}

function updateQuickInsertPopup(ctx: ReturnType<typeof editor.cursorContext>): boolean {
  if (quickInsertMode === "block" && blockMenuPinned) return true;
  const active = document.activeElement;
  if (!active || !host.contains(active)) {
    hideQuickInsertPopup();
    return false;
  }
  const prefix = quickInsertPrefix(ctx.before);
  if (!prefix) {
    hideQuickInsertPopup();
    return false;
  }
  const items = editor.getQuickInsertItems(prefix.query);
  if (items.length === 0) {
    hideQuickInsertPopup();
    return false;
  }
  quickInsertMode = "slash";
  quickInsertDeleteBefore = prefix.deleteBefore;
  quickInsertIndex = Math.min(quickInsertIndex, items.length - 1);
  quickInsertItems = items;
  renderQuickInsertPopup(prefix.query, ctx.rect);
  return true;
}

function chooseQuickInsertItem(): void {
  const item = quickInsertItems[quickInsertIndex];
  if (!item) return;
  const deleteBefore = quickInsertDeleteBefore;
  hideQuickInsertPopup();
  quickInsertSuppressedPrefix = "";
  if (deleteBefore > 0) editor.insertText("", deleteBefore);
  if (editor.runQuickInsert(item)) {
    setStatus(item.label);
    scheduleAssistUpdate({ snippets: true });
    scheduleCursorPositionSave();
  }
}

function handleQuickInsertKey(event: KeyboardEvent): boolean {
  if (quickInsertPopup.hidden) return false;
  if (event.isComposing) return false;
  const active = document.activeElement;
  const target = event.target as Node | null;
  if ((!active || !host.contains(active)) && (!target || !host.contains(target))) {
    hideQuickInsertPopup();
    return false;
  }
  if (quickInsertItems.length === 0) {
    hideQuickInsertPopup();
    return false;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    quickInsertIndex = (quickInsertIndex + 1) % quickInsertItems.length;
    renderQuickInsertPopup(quickInsertPopup.dataset.query ?? "", editor.cursorContext().rect);
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    quickInsertIndex = (quickInsertIndex + quickInsertItems.length - 1) % quickInsertItems.length;
    renderQuickInsertPopup(quickInsertPopup.dataset.query ?? "", editor.cursorContext().rect);
    return true;
  }
  if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
    event.preventDefault();
    chooseQuickInsertItem();
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    quickInsertSuppressedPrefix = quickInsertPopup.dataset.query ?? "";
    hideQuickInsertPopup();
    return true;
  }
  return false;
}

function hideBlockMenuTrigger(): void {
  blockMenuTrigger.hidden = true;
  blockMenuTrigger.removeAttribute("data-block-type");
}

function blockMenuAnchorRect(): { left: number; top: number; bottom: number } | null {
  const rect = blockMenuTrigger.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { left: rect.left, top: rect.top, bottom: rect.bottom };
}

function openBlockMenu(): void {
  const ctx = editor.getBlockContext();
  if (ctx.sourceMode || !ctx.rect) return;
  const items = editor.getQuickInsertItems("");
  if (items.length === 0) return;
  quickInsertMode = "block";
  blockMenuPinned = true;
  quickInsertDeleteBefore = 0;
  quickInsertIndex = 0;
  quickInsertItems = items;
  hideSnippetPopup();
  selectionTool.hidden = true;
  renderQuickInsertPopup(ctx.type, blockMenuAnchorRect() ?? ctx.rect);
}

function updateBlockMenuTrigger(): void {
  hideBlockMenuTrigger();
}

function placeFloatingAbove(el: HTMLElement, rect: { left: number; top: number; bottom: number } | null, width = 320): void {
  if (!rect) {
    el.hidden = true;
    return;
  }
  const margin = 8;
  const resolvedWidth = Math.min(width, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - resolvedWidth - margin));
  const previewHeight = Math.min(el.offsetHeight || 180, window.innerHeight - margin * 2);
  let top = rect.top - previewHeight - 8;
  if (top < margin) top = rect.bottom + 8;
  if (top + previewHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - previewHeight - margin);
  }
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
    button.id = `aaronnote-snippet-option-${index}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", index === snippetPopupIndex ? "true" : "false");
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
  snippetPopup.setAttribute("role", "listbox");
  snippetPopup.setAttribute("aria-activedescendant", `aaronnote-snippet-option-${snippetPopupIndex}`);
  snippetPopup.hidden = false;
  placeFloating(snippetPopup, rect);
  snippetPopup.querySelector(".aaronnote-snippet-option.is-active")?.scrollIntoView({ block: "nearest" });
}

function snippetContextMode(ctx: ReturnType<typeof editor.cursorContext>): string {
  if (mathAtCursor(ctx)) return "tex-mode";
  return "markdown-mode";
}

function updateSnippetPopup(ctx: ReturnType<typeof editor.cursorContext>): void {
  if (!snippetSuggestionsEnabled || snippetMouseSuppressed) {
    hideSnippetPopup();
    return;
  }
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

function updateMathPreview(ctx: ReturnType<typeof editor.cursorContext>, allowNewPreview: boolean): void {
  const math = mathAtCursor(ctx);
  if (!math || math.tex.trim().length === 0) {
    mathPreview.hidden = true;
    mathPreviewKey = "";
    return;
  }
  const nextKey = `${math.display ? "display" : "inline"}\n${math.tex.trim()}`;
  if (mathPreviewKey === nextKey && !mathPreview.hidden) {
    placeFloatingAbove(mathPreview, math.rect ?? ctx.rect, math.display ? 640 : 320);
    return;
  }
  if (!allowNewPreview) {
    mathPreview.hidden = true;
    mathPreviewKey = "";
    return;
  }
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
  placeFloatingAbove(mathPreview, math.rect ?? ctx.rect, math.display ? 640 : 320);
  window.requestAnimationFrame(() => {
    if (mathPreviewKey === nextKey && !mathPreview.hidden) {
      placeFloatingAbove(mathPreview, math.rect ?? ctx.rect, math.display ? 640 : 320);
    }
  });
}

function activeEditorSelection(): { text: string; rect: DOMRect } | null {
  if (editor.isSourceMode()) return null;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (!anchor || !focus || !host.contains(anchor) || !host.contains(focus)) return null;
  const logical = editor.getSelection();
  const from = Math.min(logical.from, logical.to);
  const to = Math.max(logical.from, logical.to);
  const text = from < to ? editor.textBetween(from, to) : selection.toString();
  if (!text.trim()) return null;
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
  const width = Math.min(360, Math.max(280, selectionTool.offsetWidth || 316));
  const left = Math.min(
    Math.max(margin, active.rect.left + active.rect.width / 2 - width / 2),
    Math.max(margin, window.innerWidth - width - margin),
  );
  const top = Math.max(margin, active.rect.top - 42);
  selectionTool.style.left = `${left}px`;
  selectionTool.style.top = `${top}px`;
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

function runSelectionCommand(command: string): void {
  if (command === "copy") {
    void copyActiveSelection();
    return;
  }
  if (!["bold", "italic", "code", "link"].includes(command)) return;
  runEditorCommand(command as EditorCommand);
  selectionTool.hidden = true;
}

function scheduleAssistUpdate(options: { snippets?: boolean; mathPreview?: boolean } = {}): void {
  snippetScanRequested = snippetScanRequested || options.snippets === true;
  mathPreviewUpdateRequested = mathPreviewUpdateRequested || options.mathPreview === true;
  window.clearTimeout(assistTimer);
  assistTimer = window.setTimeout(() => {
    window.cancelAnimationFrame(assistFrame);
    assistFrame = window.requestAnimationFrame(() => {
      const ctx = editor.cursorContext(1600);
      const shouldScanSnippets = snippetScanRequested;
      const shouldUpdateMathPreview = mathPreviewUpdateRequested;
      snippetScanRequested = false;
      mathPreviewUpdateRequested = false;
      updateVimCursor(vimCursor, editor, vimMode, ctx);
      if (vimMode !== "insert") {
        hideSnippetPopup();
        hideQuickInsertPopup();
        hideBlockMenuTrigger();
        mathPreview.hidden = true;
        selectionTool.hidden = true;
        return;
      }
      const quickOpen = updateQuickInsertPopup(ctx);
      if (quickOpen) {
        hideSnippetPopup();
        hideBlockMenuTrigger();
      }
      else if (shouldScanSnippets) updateSnippetPopup(ctx);
      updateMathPreview(ctx, shouldUpdateMathPreview);
      updateFloatingToc();
      updateSelectionTool();
      if (activeEditorSelection()) hideBlockMenuTrigger();
      else updateBlockMenuTrigger();
    });
  }, 35);
}

function updateVimCursorNow(): void {
  updateVimCursor(vimCursor, editor, vimMode, editor.cursorContext(1600));
}

function renderSnippets(): void {
  scheduleAssistUpdate({ snippets: true });
}

async function reloadSnippets(): Promise<void> {
  setStatus("Reloading snippets");
  try {
    const res = await fetch("/api/snippets?reload=1");
    const msg = await res.json() as { snippets?: SnippetSummary[]; message?: string };
    if (!res.ok || !Array.isArray(msg.snippets)) throw new Error(msg.message || "Snippet reload failed");
    snippets = msg.snippets.length > 0 ? msg.snippets : demoSnippets;
    hideSnippetPopup();
    renderSnippets();
    setStatus(`Reloaded ${snippets.length} snippets`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Snippet reload failed");
  }
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

function loadWritingMode(): { focusMode: boolean; typewriterMode: boolean } {
  try {
    const raw = window.localStorage.getItem(writingModeStorageKey);
    const parsed = raw ? JSON.parse(raw) as { focusMode?: unknown; typewriterMode?: unknown } : {};
    return {
      focusMode: parsed.focusMode === true,
      typewriterMode: parsed.typewriterMode === true,
    };
  } catch {
    return { focusMode: false, typewriterMode: false };
  }
}

function saveWritingMode(): void {
  try {
    window.localStorage.setItem(writingModeStorageKey, JSON.stringify(writingMode));
  } catch {
    // Writing mode is a local preference; ignore storage failures.
  }
}

function loadSnippetSuggestionsEnabled(): boolean {
  try {
    return window.localStorage.getItem(snippetSuggestionsStorageKey) !== "false";
  } catch {
    return true;
  }
}

function saveSnippetSuggestionsEnabled(): void {
  try {
    window.localStorage.setItem(snippetSuggestionsStorageKey, snippetSuggestionsEnabled ? "true" : "false");
  } catch {
    // Snippet suggestions are a local preference; ignore storage failures.
  }
}

function setSnippetSuggestionsEnabled(enabled: boolean): void {
  snippetSuggestionsEnabled = enabled;
  snippetSuppressedPrefix = "";
  saveSnippetSuggestionsEnabled();
  if (!enabled) {
    hideSnippetPopup();
    setStatus("Snippet suggestions disabled");
    return;
  }
  setStatus("Snippet suggestions enabled");
  scheduleAssistUpdate({ snippets: true });
}

function clearSnippetSuggestionState(): void {
  snippetSuppressedPrefix = "";
  snippetMouseSuppressed = false;
  hideSnippetPopup();
  setStatus("Snippet suggestions reset");
  if (snippetSuggestionsEnabled) scheduleAssistUpdate({ snippets: true });
}

function applyWritingMode(): void {
  editor.setWritingMode(writingMode);
  host.classList.toggle("is-focus-mode", writingMode.focusMode);
  host.classList.toggle("is-typewriter-mode", writingMode.typewriterMode);
  root.dataset.focusMode = writingMode.focusMode ? "true" : "false";
  root.dataset.typewriterMode = writingMode.typewriterMode ? "true" : "false";
  focusModeButton.setAttribute("aria-pressed", writingMode.focusMode ? "true" : "false");
  typewriterModeButton.setAttribute("aria-pressed", writingMode.typewriterMode ? "true" : "false");
  focusModeButton.classList.toggle("is-active", writingMode.focusMode);
  typewriterModeButton.classList.toggle("is-active", writingMode.typewriterMode);
  saveWritingMode();
}

function toggleWritingMode(key: keyof typeof writingMode): void {
  writingMode = { ...writingMode, [key]: !writingMode[key] };
  applyWritingMode();
  setStatus(key === "focusMode"
    ? writingMode.focusMode ? "Focus mode" : "Focus off"
    : writingMode.typewriterMode ? "Typewriter mode" : "Typewriter off");
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

function normalizeCursorPositions(entries: unknown): Map<string, CursorPosition> {
  const byFile = new Map<string, CursorPosition>();
  if (!Array.isArray(entries)) return byFile;
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<CursorPosition>;
    if (typeof entry.file !== "string" || !entry.file) continue;
    const mode = entry.mode === "source" ? "source" : "markdown";
    const from = typeof entry.from === "number" && Number.isFinite(entry.from) ? Math.max(0, entry.from) : 0;
    const to = typeof entry.to === "number" && Number.isFinite(entry.to) ? Math.max(0, entry.to) : from;
    const scrollY = typeof entry.scrollY === "number" && Number.isFinite(entry.scrollY) ? Math.max(0, entry.scrollY) : 0;
    const updatedAt = typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0;
    const current = byFile.get(entry.file);
    if (!current || updatedAt > current.updatedAt) {
      byFile.set(entry.file, { file: entry.file, mode, from, to, scrollY, updatedAt });
    }
  }
  return new Map([...byFile.entries()].sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 240));
}

function loadCursorPositions(): Map<string, CursorPosition> {
  try {
    const raw = window.localStorage.getItem(cursorStorageKey);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return normalizeCursorPositions(parsed);
  } catch {
    return new Map();
  }
}

function saveCursorPositionsLocal(): void {
  try {
    window.localStorage.setItem(cursorStorageKey, JSON.stringify([...cursorPositions.values()].slice(0, 240)));
  } catch {
    // Cursor restore is a local convenience; ignore storage failures.
  }
}

function mergeCursorPositions(entries: unknown): void {
  const incoming = normalizeCursorPositions(entries);
  if (incoming.size === 0) return;
  cursorPositions = normalizeCursorPositions([...incoming.values(), ...cursorPositions.values()]);
  saveCursorPositionsLocal();
}

async function loadServerCursorPositions(): Promise<void> {
  try {
    const res = await fetch("/api/positions");
    const msg = await res.json() as { positions?: CursorPosition[] };
    if (res.ok) mergeCursorPositions(msg.positions ?? []);
  } catch {
    // localStorage remains as fallback.
  }
}

function currentCursorPosition(): CursorPosition | null {
  if (!currentFile) return null;
  const selection = editor.getSelection();
  return {
    file: currentFile,
    mode: editor.isSourceMode() ? "source" : "markdown",
    from: Math.max(0, selection.from),
    to: Math.max(0, selection.to),
    scrollY: Math.max(0, host.scrollTop || window.scrollY),
    updatedAt: Date.now(),
  };
}

function sendBeaconJson(url: string, value: unknown): boolean {
  if (!navigator.sendBeacon) return false;
  try {
    const blob = new Blob([JSON.stringify(value)], { type: "application/json" });
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}

function persistCursorPosition(position: CursorPosition, keepalive = false): void {
  if (keepalive && sendBeaconJson("/api/position", position)) return;
  void fetch("/api/position", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(position),
    keepalive,
  }).catch(() => {});
}

function saveCursorPositionNow(options: { keepalive?: boolean; force?: boolean } = {}): void {
  window.clearTimeout(cursorSaveTimer);
  const position = currentCursorPosition();
  if (!position) return;
  const key = `${position.file}:${position.mode}:${position.from}:${position.to}:${Math.round(position.scrollY)}`;
  if (!options.force && key === lastCursorSaveKey) return;
  lastCursorSaveKey = key;
  cursorPositions.set(position.file, position);
  cursorPositions = normalizeCursorPositions([...cursorPositions.values()]);
  saveCursorPositionsLocal();
  persistCursorPosition(position, options.keepalive === true);
}

function scheduleCursorPositionSave(delay = 500): void {
  if (!currentFile) return;
  window.clearTimeout(cursorSaveTimer);
  cursorSaveTimer = window.setTimeout(() => saveCursorPositionNow(), delay);
}

function restoreCursorPosition(file: string): boolean {
  const position = cursorPositions.get(file);
  if (!position) return false;
  const max = editor.isSourceMode()
    ? editor.getMarkdown().length
    : editor.view.state.doc.content.size;
  const from = Math.max(0, Math.min(position.from, max));
  const to = Math.max(0, Math.min(position.to, max));
  window.requestAnimationFrame(() => {
    editor.setSelection(from, to);
    host.scrollTop = position.scrollY;
    window.scrollTo({ top: position.scrollY, behavior: "instant" as ScrollBehavior });
    scheduleAssistUpdate();
  });
  return true;
}

function flushSaveKeepalive(): void {
  if (!currentFile) return;
  saveAbortController?.abort();
  saveAbortController = null;
  const seq = ++saveRequestSeq;
  const payload = {
    file: currentFile,
    content: editor.getMarkdown(),
    mode: editor.isSourceMode() ? "source" : "markdown",
    clientId: saveClientId,
    seq,
  };
  if (sendBeaconJson("/api/save", payload)) return;
  void fetch("/api/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

function flushState(options: { keepalive?: boolean } = {}): void {
  saveCursorPositionNow({ keepalive: options.keepalive === true, force: true });
  window.clearTimeout(saveTimer);
  flushSaveKeepalive();
}

function renderRecentNotes(): void {
  filesystemBrowser.renderRecent();
}

function roamNotes(): NoteSummary[] {
  return notes.filter((note) => note.roam);
}

function collapseFilesystemGroups(): void {
  filesystemBrowser.collapseAll();
}

function expandFilesystemGroups(): void {
  filesystemBrowser.expandAll();
}

function renderNotes(): void {
  filesystemBrowser.render();
}

async function loadAgendaTodos(force = false): Promise<void> {
  await agendaManager.load(force);
}

function scheduleRenderAgenda(): void {
  agendaManager.scheduleRender();
}

function renderAgenda(): void {
  agendaManager.render();
}

function renderGraph(): void {
  graphPanel.render();
}

function scheduleRenderGraph(delay = 120): void {
  graphPanel.scheduleRender(delay);
}

function scheduleRenderNotes(): void {
  filesystemBrowser.scheduleRender();
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
  saveCursorPositionNow({ force: true });
  currentFile = msg.file || "";
  currentStandalone = msg.standalone === true;
  root.dataset.standalone = currentStandalone ? "true" : "false";
  const storedPosition = currentFile ? cursorPositions.get(currentFile) : undefined;
  currentMode = storedPosition?.mode ?? (msg.mode === "source" ? "source" : "markdown");
  fileLabel.textContent = currentFile || "Scratch";
  notesButton.hidden = currentStandalone;
  agendaButton.hidden = currentStandalone;
  if (currentStandalone && !notesPage.hidden) showEditorPage();
  touchRecentNote(currentFile);

  if (Array.isArray(msg.notes)) {
    notes = msg.notes;
    renderNotes();
    if (!notesPage.hidden && notesPanels.some((panel) => panel.dataset.notesPanel === "agenda" && !panel.hidden)) void loadAgendaTodos(true);
    if (!graphPage.hidden) renderGraph();
  }
  if (Array.isArray(msg.snippets)) {
    snippets = msg.snippets.length > 0 ? msg.snippets : demoSnippets;
    renderSnippets();
  }

  if (currentMode === "source" && !editor.isSourceMode()) editor.toggleSource();
  if (currentMode === "markdown" && editor.isSourceMode()) editor.toggleSource();
  syncSourceUi();
  const kindValue = msg.kind ?? currentNote()?.kind ?? noteKindFromMarkdown(msg.content ?? "");
  prepareNoteKindRender(kindValue);
  editor.setMarkdown(msg.content ?? "");
  void applyNoteKindAssets(kindValue);
  const equationTag = normalizeEquationTag(pendingEquationTag);
  pendingEquationTag = "";
  const todoFocus = pendingTodoFocus && pendingTodoFocus.file === currentFile ? pendingTodoFocus : null;
  if (todoFocus) pendingTodoFocus = null;
  const jumped = equationTag ? jumpToEquationTag(equationTag) : false;
  const todoJumped = !jumped && todoFocus ? jumpToTodoSource(todoFocus.source, todoFocus.index) : false;
  const restored = !jumped && !todoJumped && currentFile ? restoreCursorPosition(currentFile) : false;
  if (!jumped && !todoJumped && !restored) editor.focus();
  vim.setMode("insert");
  if (equationTag) {
    setStatus(jumped ? `Equation tag ${equationTag}` : `Equation tag not found: ${equationTag}`);
  } else if (todoFocus) {
    setStatus(todoJumped ? "Todo focused" : "Todo source not found");
  } else {
    setStatus(currentMode === "source" ? "Source mode" : "Ready");
  }
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

function editorOwnsEventTarget(event: Event): boolean {
  const target = event.target as Node | null;
  return !!target && host.contains(target);
}

function runEditorCommand(command: EditorCommand, value = ""): void {
  if (!editor.runCommand(command, value)) return;
  scheduleAssistUpdate();
  scheduleCursorPositionSave();
  setStatus(command.replace(/-/g, " "));
}

document.addEventListener("keydown", (event) => {
  const primaryMod = /Mac/.test(navigator.platform)
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (!notesPage.hidden && notesPanels.some((panel) => panel.dataset.notesPanel === "filesystem" && !panel.hidden)) {
      showEditorPage();
    } else {
      openFilesystemPage();
    }
    return;
  }
  if (
    editorOwnsEventTarget(event)
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && (event.key.length === 1 || ["Backspace", "Delete", "Enter", "Tab"].includes(event.key))
  ) {
    snippetMouseSuppressed = false;
  }
  if (primaryMod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    event.stopPropagation();
    openFindTool();
    return;
  }
  if (event.key === "/" && !event.shiftKey && !event.altKey) {
    const isMac = /Mac/.test(navigator.platform);
    if (isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleSourceMode();
      return;
    }
  }
  if (
    vimMode !== "insert"
    && event.key === "/"
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey
    && editorOwnsEventTarget(event)
  ) {
    event.preventDefault();
    event.stopPropagation();
    openFindTool();
    return;
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    event.stopPropagation();
    toc.classList.toggle("is-collapsed");
    return;
  }
  if (handleQuickInsertKey(event)) {
    event.stopPropagation();
    return;
  }
  if (handleSnippetPopupKey(event)) {
    event.stopPropagation();
    return;
  }
  if (editorOwnsEventTarget(event)) {
    const key = event.key.toLowerCase();
    const primaryMod = /Mac/.test(navigator.platform)
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
    if (primaryMod && !event.altKey && !event.shiftKey) {
      const command = key === "b"
        ? "bold"
        : key === "i"
          ? "italic"
          : key === "k"
            ? "link"
            : null;
      if (command) {
        event.preventDefault();
        event.stopPropagation();
        runEditorCommand(command);
        return;
      }
    }
  }
  if (event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    event.stopPropagation();
    void handleTagCommand();
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
  if (event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey && event.key.toLowerCase() === "s") {
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
  if (command === "tag-manager") void handleTagCommand();
  if (command === "sync-roamdb") void syncRoamDb();
  if (command === "reload-snippets") void reloadSnippets();
  if (command === "enable-snippet-suggestions") setSnippetSuggestionsEnabled(true);
  if (command === "disable-snippet-suggestions") setSnippetSuggestionsEnabled(false);
  if (command === "reset-snippet-suggestions") clearSnippetSuggestionState();
  if (command === "open-filesystem") openFilesystemPage();
  if (command === "open-block-menu") openBlockMenu();
  if (command === "toggle-source") toggleSourceMode();
  if (command === "save-now") save();
  if (command === "flush-state") flushState({ keepalive: true });
});

notesButton.addEventListener("click", () => showNotesPage());
agendaButton.addEventListener("click", () => showNotesPage("agenda"));
focusModeButton.addEventListener("click", () => toggleWritingMode("focusMode"));
typewriterModeButton.addEventListener("click", () => toggleWritingMode("typewriterMode"));
syncButton.addEventListener("click", () => void syncRoamDb());
notesCollapseAllButton.addEventListener("click", collapseFilesystemGroups);
notesExpandAllButton.addEventListener("click", expandFilesystemGroups);
scanUnusedAssetsButton.addEventListener("click", () => void unusedAssetsManager.scan());
trashUnusedAssetsButton.addEventListener("click", () => void unusedAssetsManager.trashSelected());
unusedAssetsSelectAll.addEventListener("change", unusedAssetsManager.toggleSelectAll);
sourceButton.addEventListener("click", toggleSourceMode);
editorButton.addEventListener("click", showEditorPage);
editorInlineButton.addEventListener("click", showEditorPage);
notesTabButtons.forEach((button) => {
  button.addEventListener("click", () => showNotesTool(button.dataset.notesTab || "filesystem"));
});
tocToggle.addEventListener("click", () => {
  floatingTocPanel.toggle();
});
blockMenuTrigger.addEventListener("mousedown", (event) => {
  event.preventDefault();
  event.stopPropagation();
});
blockMenuTrigger.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  openBlockMenu();
});
selectionTool.addEventListener("mousedown", (event) => event.preventDefault());
selectionTool.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-selection-command]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  runSelectionCommand(button.dataset.selectionCommand || "");
});
findTool.addEventListener("mousedown", (event) => event.stopPropagation());
findTool.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeFindTool();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    findNext(event.shiftKey ? -1 : 1);
  }
});
findQuery.addEventListener("input", () => {
  refreshFindMatches();
  if (findMatches.length) selectFindMatch(0);
});
findRegex.addEventListener("change", () => {
  refreshFindMatches();
  if (findMatches.length) selectFindMatch(0);
});
findTool.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-find-action]");
  if (!button) return;
  event.preventDefault();
  const action = button.dataset.findAction || "";
  if (action === "prev") findNext(-1);
  if (action === "next") findNext(1);
  if (action === "replace") replaceCurrentFindMatch();
  if (action === "all") replaceAllFindMatches();
  if (action === "close") closeFindTool();
});
noteFilter.addEventListener("input", scheduleRenderNotes);
agendaFilter.addEventListener("input", scheduleRenderAgenda);
agendaSort.addEventListener("change", scheduleRenderAgenda);
agendaDone.addEventListener("change", scheduleRenderAgenda);
agendaRefresh.addEventListener("click", () => void loadAgendaTodos(true));
graphFilter.addEventListener("input", () => scheduleRenderGraph());
document.addEventListener("keyup", (event) => {
  if (event.key !== "Escape") snippetSuppressedPrefix = "";
  if (event.key !== "Escape") quickInsertSuppressedPrefix = "";
  scheduleCursorPositionSave();
  scheduleAssistUpdate();
});
document.addEventListener("mousedown", (event) => {
  const target = event.target as Node | null;
  if (!snippetPopup.hidden && target && !snippetPopup.contains(target)) {
    if (host.contains(target)) snippetMouseSuppressed = true;
    hideSnippetPopup();
  }
  if (quickInsertMode !== "block" || quickInsertPopup.hidden) return;
  if (!target) return;
  if (quickInsertPopup.contains(target) || blockMenuTrigger.contains(target)) return;
  hideQuickInsertPopup();
});
document.addEventListener("selectionchange", () => {
  updateVimCursorNow();
  scheduleCursorPositionSave();
  scheduleAssistUpdate();
});
document.addEventListener("mouseup", () => {
  scheduleCursorPositionSave();
  scheduleAssistUpdate();
});
window.addEventListener("resize", () => {
  updateVimCursorNow();
  scheduleAssistUpdate();
});
window.addEventListener("resize", () => {
  if (!graphPage.hidden) scheduleRenderGraph(180);
});
window.addEventListener("scroll", () => {
  updateVimCursorNow();
  scheduleCursorPositionSave(700);
  scheduleAssistUpdate();
}, true);
window.addEventListener("beforeunload", () => {
  flushState({ keepalive: true });
});

void Promise.allSettled([loadServerRecentNotes(), loadServerCursorPositions()]).finally(() => {
  void bootstrapStandalone();
});
