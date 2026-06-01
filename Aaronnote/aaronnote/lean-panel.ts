/**
 * Lean 4 Infoview panel — left-side drawer.
 *
 * Displays:
 *   - Scrollable Infoview/messages pane (diagnostics click to jump)
 *   - Bottom-pinned Lean file outline (document symbols click to jump)
 *   - Per-note in-memory width and outline height
 */

import { api } from "./api-client.ts";
import type { Editor } from "../src/lib.ts";
import { getLeanGoalState, leanSpliceField, type LeanGoalState } from "../src/cm6/widgets/lean-block.ts";
import {
  leanPositionToOffset,
  leanOffsetToNote,
  leanOffsetToPosition,
  noteOffsetToLean,
  type LeanSplice,
} from "../src/lean-splice.ts";
import { renderLeanMarkdown } from "../src/lean-render.ts";
import { CoalescedTimer } from "../src/coalesced-timer.ts";
import { Epoch } from "../src/async-epoch.ts";
import { createLeanOfficialInfoviewHost } from "./lean-infoview-host.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeanPanel = {
  /** Call when the current note changes. */
  setNote: (notePath: string, notesRoot: string) => void;
  /** Call after every editor state change to refresh goals. */
  refresh: () => void;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  readonly visible: boolean;
  destroy: () => void;
};

type LeanPanelOptions = {
  root: HTMLElement;
  getEditor: () => Editor | null;
  jumpToNoteOffset: (offset: number) => void;
  onVisibilityChange?: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

function requireEl<T extends HTMLElement>(root: HTMLElement, sel: string): T {
  const e = root.querySelector<T>(sel);
  if (!e) throw new Error(`[lean-panel] Missing element: ${sel}`);
  return e;
}

type LeanDiagnosticLike = {
  range?: { start?: { line?: number; character?: number } };
  fullRange?: { start?: { line?: number; character?: number } };
  severity?: number;
  message?: string;
};

type LeanRegionInfoviewEvent = CustomEvent<{
  notePath?: string;
  tag?: string;
  leanPath?: string;
  uri?: string;
  line?: number;
  character?: number;
  goals?: string | null;
  termGoal?: string | null;
  goalsAccomplished?: boolean;
  goalError?: string | null;
}>;

type LeanOutlineItem = {
  kind: string;
  label: string;
  detail: string;
  line: number;
  character: number;
  level: number;
};

type LspPositionLike = { line?: number; character?: number };
type LspRangeLike = { start?: LspPositionLike };
type LspDocumentSymbolLike = {
  name?: string;
  detail?: string;
  kind?: number;
  range?: LspRangeLike;
  selectionRange?: LspRangeLike;
  children?: unknown[];
};
type LspSymbolInformationLike = {
  name?: string;
  kind?: number;
  location?: {
    uri?: string;
    range?: LspRangeLike;
  };
};

type LeanPanelLayout = {
  width: number;
  splitRatio: number;
  outlineHeight: number;
};

const noteLayouts = new Map<string, LeanPanelLayout>();
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
const DEFAULT_SPLIT_RATIO = 0.60;
const DEFAULT_OUTLINE_HEIGHT = 180;
const MIN_OUTLINE_HEIGHT = 96;
const MAX_OUTLINE_HEIGHT = 420;
const LSP_UI_IDLE_MS = 420;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// createLeanPanel
// ---------------------------------------------------------------------------

export function createLeanPanel(options: LeanPanelOptions): LeanPanel {
  const { root, getEditor, jumpToNoteOffset, onVisibilityChange } = options;

  // -------------------------------------------------------------------------
  // DOM structure (injected into root, which is the <aside> element)
  // -------------------------------------------------------------------------
  root.innerHTML = `
<div class="lean-panel-header">
  <span class="lean-panel-title">Lean 4</span>
  <span class="lean-panel-status lean-panel-status--inactive" data-lean-status>Not started</span>
  <button class="lean-panel-btn lean-panel-btn--icon" data-lean-pin title="Pin current infoview position">⌖</button>
  <button class="lean-panel-btn lean-panel-btn--icon" data-lean-pause title="Pause infoview updates">Ⅱ</button>
  <button class="lean-panel-btn lean-panel-btn--icon" data-lean-refresh title="Refresh infoview">⟳</button>
  <button class="lean-panel-btn lean-panel-btn--icon" data-lean-copy title="Copy infoview">⧉</button>
  <button class="lean-panel-btn lean-panel-btn--text" data-lean-cache title="Download Mathlib binary cache">Cache</button>
  <button class="lean-panel-btn lean-panel-btn--icon" data-lean-restart title="Restart Lean server">↺</button>
  <button class="lean-panel-btn lean-panel-btn--text" data-lean-stop title="Stop Lean LSP">Stop</button>
  <button class="lean-panel-btn lean-panel-btn--icon lean-panel-close" data-lean-close title="Close panel">✕</button>
</div>
<div class="lean-panel-body" data-lean-panel-body>
  <section class="lean-panel-pane lean-panel-pane--info" data-lean-info-pane>
    <div class="lean-panel-pane-title">Infoview</div>
    <section class="lean-panel-section lean-panel-official" data-lean-official-section>
      <div class="lean-official-infoview" data-lean-official-infoview></div>
    </section>
    <section class="lean-panel-section lean-panel-current" data-lean-current-section>
      <div class="lean-panel-current-title" data-lean-current-title>Move the cursor into Lean code</div>
      <div class="lean-panel-current-body" data-lean-current-body></div>
    </section>
    <section class="lean-panel-section lean-panel-goals" data-lean-goals-section>
      <div class="lean-panel-section-title" data-lean-goals-title>Tactic state</div>
      <div class="lean-panel-code lean-goals-text" data-lean-goals></div>
    </section>
    <section class="lean-panel-section lean-panel-term-goal" data-lean-term-section>
      <div class="lean-panel-section-title">Expected type</div>
      <div class="lean-panel-code lean-term-goal-text" data-lean-term-goal></div>
    </section>
    <section class="lean-panel-section lean-panel-messages-section" data-lean-messages-pane>
      <div class="lean-panel-section-title">All Messages</div>
      <div class="lean-messages-list" data-lean-messages-list></div>
    </section>
  </section>
  <section class="lean-panel-section lean-panel-outline" data-lean-outline-section>
    <div class="lean-panel-section-title" data-lean-outline-title>Lean file outline</div>
    <div class="lean-outline-box">
      <div class="lean-outline-list" data-lean-outline-list></div>
    </div>
    <div class="lean-outline-resizer" data-lean-outline-resizer role="separator" aria-orientation="horizontal" title="Resize outline"></div>
  </section>
</div>
<div class="lean-panel-width-resizer" data-lean-width-resizer role="separator" aria-orientation="vertical" title="Resize Lean panel"></div>
`;

  const statusEl = requireEl<HTMLElement>(root, "[data-lean-status]");
  const bodyEl = requireEl<HTMLElement>(root, "[data-lean-panel-body]");
  const infoPane = requireEl<HTMLElement>(root, "[data-lean-info-pane]");
  const messagesPane = requireEl<HTMLElement>(root, "[data-lean-messages-pane]");
  const officialSection = requireEl<HTMLElement>(root, "[data-lean-official-section]");
  const officialRoot = requireEl<HTMLElement>(root, "[data-lean-official-infoview]");
  let syncOfficialChange: () => void = () => {};
  const officialInfoview = createLeanOfficialInfoviewHost(officialRoot, {
    showDocument: showOfficialDocument,
    restartFile: restartLeanFile,
    insertText: insertOfficialText,
    applyEdit: applyOfficialEdit,
    onReady: () => syncOfficialChange(),
    onContentChange: () => syncOfficialChange(),
  });
  const currentSection = requireEl<HTMLElement>(root, "[data-lean-current-section]");
  const currentTitle = requireEl<HTMLElement>(root, "[data-lean-current-title]");
  const currentBody = requireEl<HTMLElement>(root, "[data-lean-current-body]");
  const goalsSection = requireEl<HTMLElement>(root, "[data-lean-goals-section]");
  const goalsTitle = requireEl<HTMLElement>(root, "[data-lean-goals-title]");
  const goalsEl = requireEl<HTMLElement>(root, "[data-lean-goals]");
  const termSection = requireEl<HTMLElement>(root, "[data-lean-term-section]");
  const termGoalEl = requireEl<HTMLElement>(root, "[data-lean-term-goal]");
  const outlineSection = requireEl<HTMLElement>(root, "[data-lean-outline-section]");
  const outlineTitle = requireEl<HTMLElement>(root, "[data-lean-outline-title]");
  const outlineList = requireEl<HTMLElement>(root, "[data-lean-outline-list]");
  const outlineResizer = requireEl<HTMLElement>(root, "[data-lean-outline-resizer]");
  const messagesList = requireEl<HTMLElement>(root, "[data-lean-messages-list]");
  const messagesTitle = requireEl<HTMLElement>(root, "[data-lean-messages-pane] .lean-panel-section-title");
  const widthResizer = requireEl<HTMLElement>(root, "[data-lean-width-resizer]");
  const pinBtn = requireEl<HTMLButtonElement>(root, "[data-lean-pin]");
  const pauseBtn = requireEl<HTMLButtonElement>(root, "[data-lean-pause]");
  const refreshBtn = requireEl<HTMLButtonElement>(root, "[data-lean-refresh]");
  const copyBtn = requireEl<HTMLButtonElement>(root, "[data-lean-copy]");
  const cacheBtn = requireEl<HTMLButtonElement>(root, "[data-lean-cache]");
  const restartBtn = requireEl<HTMLButtonElement>(root, "[data-lean-restart]");
  const stopBtn = requireEl<HTMLButtonElement>(root, "[data-lean-stop]");
  const closeBtn = requireEl<HTMLButtonElement>(root, "[data-lean-close]");
  officialSection.hidden = true;
  termSection.hidden = true;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  let currentNotePath = "";
  let currentNotesRoot = "";
  let currentDiagnostics: unknown[] = [];
  let currentDiagnosticsUri = "";
  const diagnosticsByUri = new Map<string, unknown[]>();
  const diagnosticVersionsByUri = new Map<string, number>();
  let activeLeanPosition: { line: number; character: number } | null = null;
  let _visible = false;
  let currentLayout: LeanPanelLayout = { width: DEFAULT_WIDTH, splitRatio: DEFAULT_SPLIT_RATIO, outlineHeight: DEFAULT_OUTLINE_HEIGHT };
  let activeRegionTag = "";
  let activeRegionLeanPath = "";
  let pinned = false;
  let paused = false;
  let allMessagesCollapsed = true;
  let currentGoalState: LeanGoalState = { goals: null, termGoal: null, blockIndex: null };
  let currentGoalsAccomplished = false;
  let currentGoalError: string | null = null;
  let lastDiagnosticsFetchUri = "";
  let lastOutlineSig = "";
  let lastOutlineUri = "";
  const outlineEpoch = new Epoch();
  const outlineLoadTimer = new CoalescedTimer(260);
  // Content-address renders to avoid replaceChildren on every Lean server push.
  let lastGoalsSig = "";
  let lastMessagesSig = "";
  let lastCurrentSig = "";
  const renderMessagesTimer = new CoalescedTimer(LSP_UI_IDLE_MS);

  // -------------------------------------------------------------------------
  // Push subscriptions
  // -------------------------------------------------------------------------
  const unsubDiag = api.lean.onDiagnostics((raw) => {
    const data = raw as { uri?: string; version?: number; diagnostics?: unknown[] };
    currentDiagnosticsUri = String(data.uri ?? "");
    currentDiagnostics = data.diagnostics ?? [];
    if (currentDiagnosticsUri) {
      const version = typeof data.version === "number" ? data.version : null;
      const previousVersion = diagnosticVersionsByUri.get(currentDiagnosticsUri);
      if (version !== null && previousVersion !== undefined && version < previousVersion) return;
      if (version !== null) diagnosticVersionsByUri.set(currentDiagnosticsUri, version);
      diagnosticsByUri.set(currentDiagnosticsUri, currentDiagnostics);
    } else {
      diagnosticsByUri.clear();
      diagnosticVersionsByUri.clear();
    }
    renderMessagesForActive();
  });

  const unsubStatus = api.lean.onStatus((raw) => {
    const data = raw as { message?: string; kind?: string };
    renderStatus(data);
  });

  const onRegionInfoview = (event: Event): void => {
    const detail = (event as LeanRegionInfoviewEvent).detail;
    if (!detail || detail.notePath !== currentNotePath) return;
    const previousLeanPath = activeRegionLeanPath;
    activeRegionTag = String(detail.tag ?? activeRegionTag);
    activeRegionLeanPath = String(detail.leanPath ?? (detail.uri ? fileUriToPath(String(detail.uri)) : activeRegionLeanPath));
    if (typeof detail.line === "number") {
      activeLeanPosition = {
        line: detail.line,
        character: Number(detail.character ?? 0),
      };
    }
    currentGoalError = detail.goalError ? String(detail.goalError) : null;
    renderGoals({
      goals: detail.goals ?? null,
      termGoal: detail.termGoal ?? null,
      blockIndex: null,
    }, detail.goalsAccomplished === true);
    renderCurrent();
    if (activeRegionLeanPath && activeRegionLeanPath !== previousLeanPath) {
      lastOutlineSig = "";
      scheduleOutlineLoad();
    }
    void fetchDiagnosticsForActive();
    renderMessagesForActive();
  };
  window.addEventListener("aaronnote:lean-region-infoview", onRegionInfoview);

  // -------------------------------------------------------------------------
  // Render functions
  // -------------------------------------------------------------------------

  function renderStatus(data: { message?: string; kind?: string }): void {
    const msg = String(data.message ?? "");
    const kind = String(data.kind ?? "Inactive");
    statusEl.textContent = msg;
    statusEl.className = `lean-panel-status lean-panel-status--${kind.toLowerCase()}`;
  }

  function renderGoals(goalState: LeanGoalState, accomplished = false): void {
    if (paused) return;
    if (pinned && lastGoalsSig) return;
    currentGoalState = goalState;
    currentGoalsAccomplished = accomplished;
    if (syncOfficialInfoviewVisibility()) return;
    const sig = `${goalState.goals ?? ""}|${goalState.termGoal ?? ""}|${accomplished}|${currentGoalError ?? ""}`;
    if (sig === lastGoalsSig) return;
    lastGoalsSig = sig;

    const hasGoals = Boolean(goalState.goals);
    const hasTerm = Boolean(goalState.termGoal);

    goalsSection.hidden = false;
    termSection.hidden = !hasTerm;

    if (hasGoals) {
      goalsTitle.textContent = goalCountLabel(goalState.goals ?? "");
      renderInfoBlock(goalsEl, goalState.goals ?? "");
    } else if (currentGoalError) {
      goalsTitle.textContent = "Tactic state";
      goalsEl.replaceChildren(el("div", "lean-panel-empty lean-panel-empty--goal", "No tactic state available"));
    } else if (accomplished) {
      goalsTitle.textContent = "Tactic state";
      goalsEl.replaceChildren(el("div", "lean-goals-done", "No goals"));
    } else {
      goalsTitle.textContent = "Tactic state";
      goalsEl.replaceChildren(el("div", "lean-panel-empty lean-panel-empty--goal", activeLeanPosition ? "No tactic state at cursor" : "Move the cursor into Lean code"));
    }
    renderInfoBlock(termGoalEl, goalState.termGoal ?? "");

    root.classList.toggle("lean-panel--has-goals", hasGoals || accomplished || hasTerm);
  }

  function renderCurrent(): void {
    const title = activeLocationLabel();
    const diags = activeDiagnostics() as LeanDiagnosticLike[];
    const line = activeLeanPosition?.line ?? null;
    const here = line === null ? [] : diags.filter((diag) => diagLeanStart(diag).line === line);
    const sig = `${title}|${currentGoalError ?? ""}|${here.map((d) => `${d.severity}:${d.message ?? ""}`).join("\n")}`;
    if (sig === lastCurrentSig) return;
    lastCurrentSig = sig;

    currentTitle.textContent = title;
    officialInfoview.setLocation(activeLeanPosition ? {
      uri: activeLeanUri(),
      line: activeLeanPosition.line,
      character: activeLeanPosition.character,
    } : null);
    if (syncOfficialInfoviewVisibility()) return;
    currentBody.replaceChildren();
    if (currentGoalError) {
      const row = el("div", "lean-current-error");
      row.append(el("span", "lean-current-error-prefix", "Error updating: "));
      row.append(document.createTextNode(currentGoalError));
      currentBody.append(row);
    }
    for (const diag of here) {
      currentBody.append(renderDiagnosticBody(diag, true));
    }
    currentSection.hidden = !activeLeanPosition && !currentGoalError && here.length === 0;
  }

  function renderMessages(diags: unknown[]): void {
    if (paused) return;
    if (syncOfficialInfoviewVisibility()) return;
    const activeLine = activeLeanPosition?.line ?? null;
    const count = Array.isArray(diags) ? diags.length : 0;
    messagesTitle.textContent = count > 0 ? `All Messages (${count})` : "All Messages";
    if (allMessagesCollapsed) {
      renderCurrent();
      return;
    }
    const sig = Array.isArray(diags) && diags.length > 0
      ? `${activeLine}|${activeLeanUri()}|${(diags as LeanDiagnosticLike[]).map((d) => `${diagLeanStart(d).line}:${diagLeanStart(d).character}:${d.severity}:${d.message ?? ""}`).join("\n")}`
      : "__empty__";
    if (sig === lastMessagesSig) return;
    lastMessagesSig = sig;

    if (!Array.isArray(diags) || diags.length === 0) {
      renderCurrent();
      messagesList.replaceChildren(el("div", "lean-panel-empty", "No messages"));
      return;
    }
    const sorted = [...diags].sort((a, b) => {
      const pa = diagLeanStart(a as LeanDiagnosticLike);
      const pb = diagLeanStart(b as LeanDiagnosticLike);
      return pa.line - pb.line || pa.character - pb.character;
    });
    messagesList.replaceChildren(renderMessageList(sorted, activeLine));
    renderCurrent();
  }

  function renderMessageList(diags: unknown[], activeLine: number | null): HTMLElement {
    const section = el("section", "lean-msg-section");
    if (diags.length === 0) {
      section.append(el("div", "lean-panel-empty lean-panel-empty--small", "No messages"));
      return section;
    }
    section.append(
      ...diags.map((d) => {
        const diag = d as LeanDiagnosticLike;
        const isHere = activeLine !== null && diagLeanStart(diag).line === activeLine;
        const row = renderDiagnosticBody(diag, isHere);
        row.addEventListener("click", () => jumpToDiag(diag));
        return row;
      }),
    );
    return section;
  }

  const SYMBOL_KIND_LABELS = [
    "",
    "file",
    "module",
    "namespace",
    "package",
    "class",
    "method",
    "property",
    "field",
    "constructor",
    "enum",
    "interface",
    "function",
    "variable",
    "constant",
    "string",
    "number",
    "boolean",
    "array",
    "object",
    "key",
    "null",
    "enum",
    "struct",
    "event",
    "operator",
    "type",
  ] as const;

  function symbolKindLabel(kind: unknown): string {
    const idx = typeof kind === "number" ? kind : 0;
    return SYMBOL_KIND_LABELS[idx] || "symbol";
  }

  function symbolStart(symbol: { selectionRange?: LspRangeLike; range?: LspRangeLike }): { line: number; character: number } {
    const pos = symbol.selectionRange?.start ?? symbol.range?.start ?? {};
    return {
      line: Math.max(0, Number(pos.line ?? 0)),
      character: Math.max(0, Number(pos.character ?? 0)),
    };
  }

  function flattenDocumentSymbols(raw: unknown[], level = 0): LeanOutlineItem[] {
    const out: LeanOutlineItem[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const symbol = entry as LspDocumentSymbolLike;
      const name = String(symbol.name ?? "").trim();
      if (!name) continue;
      const start = symbolStart(symbol);
      out.push({
        kind: symbolKindLabel(symbol.kind),
        label: name,
        detail: String(symbol.detail ?? "").trim(),
        line: start.line,
        character: start.character,
        level,
      });
      if (Array.isArray(symbol.children)) {
        out.push(...flattenDocumentSymbols(symbol.children, Math.min(level + 1, 6)));
      }
    }
    return out;
  }

  function flattenSymbolInformation(raw: unknown[]): LeanOutlineItem[] {
    const out: LeanOutlineItem[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const symbol = entry as LspSymbolInformationLike;
      const name = String(symbol.name ?? "").trim();
      if (!name) continue;
      const start = symbol.location?.range?.start ?? {};
      out.push({
        kind: symbolKindLabel(symbol.kind),
        label: name,
        detail: "",
        line: Math.max(0, Number(start.line ?? 0)),
        character: Math.max(0, Number(start.character ?? 0)),
        level: 0,
      });
    }
    return out;
  }

  function outlineItemsFromLsp(raw: unknown): LeanOutlineItem[] {
    const response = raw as { result?: unknown } | null;
    const result = response && typeof response === "object" && "result" in response ? response.result : raw;
    if (!Array.isArray(result)) return [];
    const first = result.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
    if (first && "location" in first) return flattenSymbolInformation(result);
    return flattenDocumentSymbols(result);
  }

  function renderOutlineItems(items: LeanOutlineItem[], leanPath: string): void {
    const activeLine = activeLeanPosition?.line ?? -1;
    const sig = `${leanPath}|${activeLine}|${items.map((item) => `${item.kind}:${item.label}:${item.detail}:${item.line}:${item.character}:${item.level}`).join("\n")}`;
    if (sig === lastOutlineSig) return;
    lastOutlineSig = sig;
    outlineTitle.textContent = items.length > 0 ? `Lean outline (${items.length})` : "Lean outline";
    if (items.length === 0) {
      outlineList.replaceChildren(el("div", "lean-panel-empty lean-panel-empty--small", "No declarations found"));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lean-outline-item";
      button.style.setProperty("--lean-outline-level", String(item.level));
      button.addEventListener("click", () => jumpToOutlineItem(item, leanPath));
      const kind = el("span", "lean-outline-kind", item.kind);
      const label = el("strong", "lean-outline-label", item.label);
      if (item.detail) label.title = item.detail;
      const line = el("span", "lean-outline-line", `L${item.line + 1}`);
      button.append(kind, label, line);
      frag.append(button);
    }
    outlineList.replaceChildren(frag);
  }

  function renderOutlineEmpty(message: string): void {
    const sig = `empty:${message}`;
    if (sig === lastOutlineSig) return;
    lastOutlineSig = sig;
    outlineTitle.textContent = "Lean outline";
    outlineList.replaceChildren(el("div", "lean-panel-empty lean-panel-empty--small", message));
  }

  function jumpToOutlineItem(item: LeanOutlineItem, leanPath: string): void {
    window.dispatchEvent(new CustomEvent("aaronnote:lean-region-jump", {
      detail: {
        notePath: currentNotePath,
        leanPath,
        line: item.line,
        character: item.character,
      },
    }));
  }

  function scheduleOutlineLoad(delay = 260, force = false): void {
    if (!_visible) return;
    outlineLoadTimer.schedule(() => void loadOutline(force), undefined, delay);
  }

  async function loadOutline(force = false): Promise<void> {
    const run = outlineEpoch.begin();
    const leanPath = activeRegionLeanPath || (currentNotePath.toLowerCase().endsWith(".lean") ? currentNotePath : "");
    if (!leanPath) {
      renderOutlineEmpty("Move the cursor into Lean code");
      return;
    }
    const uri = filePathToUri(leanPath);
    if (!uri) {
      renderOutlineEmpty("No Lean document active");
      return;
    }
    if (!force && uri === lastOutlineUri && lastOutlineSig && !lastOutlineSig.startsWith("empty:")) {
      return;
    }
    lastOutlineUri = uri;
    try {
      const raw = await api.lean.lspRequest({
        method: "textDocument/documentSymbol",
        params: { textDocument: { uri } },
        timeoutMs: 12_000,
      });
      if (!run.current) return;
      const result = raw as { ok?: boolean; message?: string; result?: unknown } | null;
      if (result?.ok === false) {
        renderOutlineEmpty(result.message || "Lean outline unavailable");
        return;
      }
      renderOutlineItems(outlineItemsFromLsp(result), leanPath);
    } catch (err) {
      if (!run.current) return;
      renderOutlineEmpty(err instanceof Error ? err.message : "Lean outline unavailable");
    }
  }

  function renderDiagnosticBody(diag: LeanDiagnosticLike, isHere: boolean): HTMLElement {
    const sevClass = diag.severity === 1 ? "error" : diag.severity === 2 ? "warning" : "info";
    const row = el("div", `lean-msg lean-msg--${sevClass}${isHere ? " lean-msg--here" : ""}`);
    const header = el("div", "lean-msg-header");
    const loc = el("span", "lean-msg-loc");
    loc.textContent = diagLocationLabel(diag);
    const copy = el("button", "lean-msg-copy", "⧉");
    copy.type = "button";
    copy.title = "Copy message";
    copy.addEventListener("click", (event) => {
      event.stopPropagation();
      void navigator.clipboard?.writeText(String(diag.message ?? ""))
        .catch((err) => console.warn("[lean] clipboard copy failed", err));
    });
    header.append(loc, copy);
    const text = el("pre", "lean-msg-text");
    text.textContent = String(diag.message ?? "");
    row.append(header, text);
    return row;
  }

  function goalCountLabel(raw: string): string {
    const text = raw.trim();
    if (!text) return "Tactic state";
    const goalMatches = text.match(/(?:^|\n)\s*⊢/g);
    const count = Math.max(1, goalMatches?.length ?? 1);
    return count === 1 ? "Tactic state · 1 goal" : `Tactic state · ${count} goals`;
  }

  function layoutKey(): string {
    return currentNotePath || "__default__";
  }

  function saveLayout(): void {
    noteLayouts.set(layoutKey(), { ...currentLayout });
  }

  function applyLayout(layout = currentLayout): void {
    currentLayout = {
      width: clamp(layout.width, MIN_WIDTH, MAX_WIDTH),
      splitRatio: clamp(layout.splitRatio, 0.18, 0.82),
      outlineHeight: clamp(layout.outlineHeight ?? DEFAULT_OUTLINE_HEIGHT, MIN_OUTLINE_HEIGHT, MAX_OUTLINE_HEIGHT),
    };
    root.style.setProperty("--lean-panel-width", `${currentLayout.width}px`);
    root.style.setProperty("--lean-outline-height", `${currentLayout.outlineHeight}px`);
    document.body.style.setProperty("--lean-panel-width", `${currentLayout.width}px`);
    void infoPane;
    void messagesPane;
  }

  function restoreLayoutForCurrentNote(): void {
    applyLayout(noteLayouts.get(layoutKey()) ?? currentLayout);
  }

  function diagNoteOffset(diag: LeanDiagnosticLike, splice: LeanSplice): number | null {
    const line = diag.range?.start?.line ?? 0;
    const ch = diag.range?.start?.character ?? 0;
    const leanOff = leanPositionToOffset(splice.leanText, line, ch);
    const noteOff = leanOffsetToNote(splice, leanOff);
    if (noteOff !== null) return noteOff;
    const nearest = splice.blocks.find((block) => leanOff <= block.leanTo) ?? splice.blocks.at(-1);
    return nearest?.noteBodyFrom ?? null;
  }

  function diagLeanStart(diag: LeanDiagnosticLike): { line: number; character: number } {
    const start = diag.fullRange?.start ?? diag.range?.start ?? {};
    return { line: start.line ?? 0, character: start.character ?? 0 };
  }

  function leanFileLabel(): string {
    const path = activeRegionLeanPath || fileUriToPath(currentDiagnosticsUri);
    if (!path) return "Lean";
    return path.split("/").filter(Boolean).at(-1) ?? "Lean";
  }

  function activeLocationLabel(): string {
    const pos = activeLeanPosition;
    if (!pos) return "Move the cursor into Lean code";
    return `${leanFileLabel()}:${pos.line + 1}:${pos.character + 1}`;
  }

  function diagLocationLabel(diag: LeanDiagnosticLike): string {
    const leanStart = diagLeanStart(diag);
    const leanLabel = `${leanFileLabel()}:${leanStart.line + 1}:${leanStart.character + 1}`;
    const editor = getEditor();
    if (!editor) return leanLabel;
    const splice = editor.view.state.field(leanSpliceField, false);
    if (!splice) return leanLabel;
    const noteOff = diagNoteOffset(diag, splice);
    if (noteOff === null) return leanLabel;
    const line = editor.view.state.doc.lineAt(Math.min(noteOff, editor.view.state.doc.length));
    return `MD L${line.number} / ${leanLabel}`;
  }

  function jumpToDiag(diag: LeanDiagnosticLike): void {
    const leanStart = diagLeanStart(diag);
    window.dispatchEvent(new CustomEvent("aaronnote:lean-region-jump", {
      detail: {
        notePath: currentNotePath,
        leanPath: activeRegionLeanPath || fileUriToPath(currentDiagnosticsUri),
        line: leanStart.line,
        character: leanStart.character,
      },
    }));
    const editor = getEditor();
    if (!editor) return;
    const splice = editor.view.state.field(leanSpliceField, false);
    if (!splice) return;
    const noteOff = diagNoteOffset(diag, splice);
    if (noteOff === null) return;
    jumpToNoteOffset(noteOff);
  }

  function showOfficialDocument(show: { uri?: unknown; selection?: { start?: { line?: number; character?: number } } }): void {
    const uri = String(show.uri ?? "");
    const leanPath = fileUriToPath(uri);
    const start = show.selection?.start ?? {};
    const line = Number(start.line ?? 0);
    const character = Number(start.character ?? 0);
    window.dispatchEvent(new CustomEvent("aaronnote:lean-region-jump", {
      detail: {
        notePath: currentNotePath,
        leanPath,
        line,
        character,
      },
    }));
    const editor = getEditor();
    const splice = editor?.view.state.field(leanSpliceField, false);
    if (!editor || !splice || (leanPath && splice.leanPath !== leanPath)) return;
    const leanOff = leanPositionToOffset(splice.leanText, line, character);
    const noteOff = leanOffsetToNote(splice, leanOff);
    if (noteOff !== null) jumpToNoteOffset(noteOff);
  }

  function insertOfficialText(text: string, kind: "here" | "above", pos?: { textDocument?: { uri?: string }; position?: { line?: number; character?: number } }): void {
    window.dispatchEvent(new CustomEvent("aaronnote:lean-region-insert", {
      detail: {
        notePath: currentNotePath,
        leanPath: fileUriToPath(String(pos?.textDocument?.uri ?? activeLeanUri())),
        text,
        kind,
        line: typeof pos?.position?.line === "number" ? pos.position.line : undefined,
        character: typeof pos?.position?.character === "number" ? pos.position.character : undefined,
      },
    }));
  }

  function applyOfficialEdit(edit: unknown): void {
    window.dispatchEvent(new CustomEvent("aaronnote:lean-region-apply-edit", {
      detail: {
        notePath: currentNotePath,
        edit,
      },
    }));
  }

  async function restartLeanFile(): Promise<void> {
    await api.lean.request("stop");
    if (!currentNotePath || !currentNotesRoot) {
      renderStatus({ message: "No Lean document active", kind: "Inactive" });
      return;
    }
    if (activeRegionTag) {
      const result = await api.lean.openRegionFile({
        notePath: currentNotePath,
        tag: activeRegionTag,
      });
      const response = result as { ok?: boolean; message?: string; leanPath?: string } | null;
      if (response?.ok === false) throw new Error(response.message || "Lean restart failed");
      activeRegionLeanPath = String(response?.leanPath ?? activeRegionLeanPath);
      renderStatus({ message: "Lean restarted", kind: "Ready" });
      return;
    }
    const editor = getEditor();
    const splice = editor?.view.state.field(leanSpliceField, false);
    if (!splice) {
      renderStatus({ message: "No Lean document active", kind: "Inactive" });
      return;
    }
    const result = await api.lean.openNote({
      notePath: currentNotePath,
      notesRoot: currentNotesRoot,
      leanText: splice.leanText,
      leanPath: splice.leanPath,
    });
    const response = result as { ok?: boolean; message?: string } | null;
    if (response?.ok === false) throw new Error(response.message || "Lean restart failed");
    renderStatus({ message: "Lean restarted", kind: "Ready" });
  }

  function fileUriToPath(uri: string): string {
    if (!uri.startsWith("file://")) return "";
    try {
      return decodeURIComponent(new URL(uri).pathname);
    } catch {
      return "";
    }
  }

  function filePathToUri(path: string): string {
    if (!path) return "";
    return `file://${path.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  }

  function renderInfoBlock(rootEl: HTMLElement, raw: string): void {
    renderLeanMarkdown(rootEl, raw);
  }

  function syncOfficialInfoviewVisibility(): boolean {
    const canShowOfficial = officialInfoview.isReady() && Boolean(activeLeanPosition);
    const officialHasContent = canShowOfficial && officialInfoview.hasContent();
    officialSection.hidden = !canShowOfficial;
    if (officialHasContent) {
      currentSection.hidden = true;
      goalsSection.hidden = true;
      termSection.hidden = true;
      messagesPane.hidden = true;
      return true;
    }
    messagesPane.hidden = false;
    return false;
  }

  syncOfficialChange = () => {
    if (syncOfficialInfoviewVisibility()) {
      lastCurrentSig = "";
      lastGoalsSig = "";
      lastMessagesSig = "";
    }
  };

  function activeLeanUri(): string {
    if (activeRegionLeanPath) return filePathToUri(activeRegionLeanPath);
    const editor = getEditor();
    const splice = editor?.view.state.field(leanSpliceField, false);
    return splice ? filePathToUri(splice.leanPath) : currentDiagnosticsUri;
  }

  function activeDiagnostics(): unknown[] {
    const uri = activeLeanUri();
    if (uri && diagnosticsByUri.has(uri)) return diagnosticsByUri.get(uri) ?? [];
    if (uri && currentDiagnosticsUri && uri !== currentDiagnosticsUri) return [];
    return currentDiagnostics;
  }

  async function fetchDiagnosticsForActive(): Promise<void> {
    const uri = activeLeanUri();
    const leanPath = activeRegionLeanPath || fileUriToPath(uri);
    if (!uri || !leanPath || lastDiagnosticsFetchUri === uri) return;
    lastDiagnosticsFetchUri = uri;
    try {
      const raw = await api.lean.getDiagnostics({ leanPath });
      const result = raw as { ok?: boolean; diagnostics?: unknown[] } | null;
      if (result?.ok === false) return;
      const diagnostics = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
      diagnosticsByUri.set(uri, diagnostics);
      currentDiagnosticsUri = uri;
      currentDiagnostics = diagnostics;
      lastMessagesSig = "";
      lastCurrentSig = "";
      renderMessagesForActive();
    } catch {
      // Diagnostics are opportunistic; live push updates will still refresh the panel.
    }
  }

  function renderMessagesForActive(): void {
    renderMessagesTimer.schedule(() => renderMessages(activeDiagnostics()));
  }

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  function show(): void {
    if (_visible) return;
    _visible = true;
    root.removeAttribute("hidden");
    root.classList.remove("lean-panel--hidden", "lean-panel--gone");
    applyLayout();
    document.body.classList.add("lean-panel-open");
    onVisibilityChange?.();
    void api.lean.status().then((s) => {
      if (s) renderStatus(s as { message?: string; kind?: string });
    }).catch((err) => console.warn("[lean] status query failed", err));
    scheduleOutlineLoad(0);
  }

  function hide(): void {
    if (!_visible) return;
    _visible = false;
    root.classList.add("lean-panel--hidden");
    root.removeAttribute("hidden");  // keep in DOM so transition plays
    document.body.classList.remove("lean-panel-open");
    onVisibilityChange?.();
  }

  function toggle(): void {
    if (_visible) hide(); else show();
  }

  // -------------------------------------------------------------------------
  // Refresh (called by main.ts after every editor update)
  // -------------------------------------------------------------------------

  function refresh(): void {
    if (!_visible) return;
    if (paused || pinned) return;
    const editor = getEditor();
    if (!editor) return;
    if (activeRegionTag && activeRegionLeanPath) {
      renderCurrent();
      void fetchDiagnosticsForActive();
      renderMessagesForActive();
      return;
    }
    const splice = editor.view.state.field(leanSpliceField, false);
    if (splice) {
      const notePos = editor.view.state.selection.main.from;
      const leanOff = noteOffsetToLean(splice, notePos);
      activeLeanPosition = leanOff == null ? null : leanOffsetToPosition(splice.leanText, leanOff);
    } else {
      activeLeanPosition = null;
    }
    const goalState = getLeanGoalState(editor.view.state);
    renderGoals(goalState);
    renderCurrent();
    void fetchDiagnosticsForActive();
    renderMessagesForActive();
  }

  // -------------------------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------------------------

  cacheBtn.addEventListener("click", () => {
    statusEl.textContent = "Downloading cache...";
    cacheBtn.disabled = true;
    void api.lean.cacheGet()
      .then((raw) => {
        const result = raw as { ok?: boolean; message?: string } | null;
        renderStatus({
          message: result?.message ?? (result?.ok === false ? "Mathlib cache failed" : "Mathlib cache ready"),
          kind: result?.ok === false ? "Error" : "Normal",
        });
      })
      .catch((err) => {
        renderStatus({ message: err instanceof Error ? err.message : "Mathlib cache failed", kind: "Error" });
      })
      .finally(() => {
        cacheBtn.disabled = false;
      });
  });

  restartBtn.addEventListener("click", () => {
    statusEl.textContent = "Restarting...";
    restartBtn.disabled = true;
    void (async () => {
      try {
        await restartLeanFile();
      } catch (err) {
        renderStatus({ message: err instanceof Error ? err.message : "Lean restart failed", kind: "Error" });
      } finally {
        restartBtn.disabled = false;
      }
    })();
  });

  stopBtn.addEventListener("click", () => {
    statusEl.textContent = "Stopping...";
    stopBtn.disabled = true;
    void api.lean.request("stop")
      .then(() => {
        activeRegionTag = "";
        activeRegionLeanPath = "";
        activeLeanPosition = null;
        currentGoalError = null;
        allMessagesCollapsed = true;
        messagesPane.classList.add("lean-section--collapsed");
        currentDiagnostics = [];
        currentDiagnosticsUri = "";
        diagnosticsByUri.clear();
        diagnosticVersionsByUri.clear();
        lastGoalsSig = "";
        lastMessagesSig = "";
        lastCurrentSig = "";
        lastOutlineSig = "";
        lastOutlineUri = "";
        lastDiagnosticsFetchUri = "";
        renderMessages([]);
        renderOutlineEmpty("Lean stopped");
        renderStatus({ message: "Lean stopped", kind: "Inactive" });
      })
      .catch((err) => {
        renderStatus({ message: err instanceof Error ? err.message : "Lean stop failed", kind: "Error" });
      })
      .finally(() => {
        stopBtn.disabled = false;
      });
  });

  closeBtn.addEventListener("click", () => hide());

  void bodyEl;

  pinBtn.addEventListener("click", () => {
    pinned = !pinned;
    pinBtn.classList.toggle("is-active", pinned);
    pinBtn.title = pinned ? "Unpin infoview" : "Pin current infoview position";
    if (!pinned) {
      lastGoalsSig = "";
      lastMessagesSig = "";
      refresh();
    }
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.classList.toggle("is-active", paused);
    pauseBtn.textContent = paused ? "▶" : "Ⅱ";
    pauseBtn.title = paused ? "Resume infoview updates" : "Pause infoview updates";
    if (!paused) {
      lastGoalsSig = "";
      lastMessagesSig = "";
      renderGoals(currentGoalState, currentGoalsAccomplished);
      renderMessagesForActive();
    }
  });

  refreshBtn.addEventListener("click", () => {
    paused = false;
    pinned = false;
    pauseBtn.classList.remove("is-active");
    pinBtn.classList.remove("is-active");
    pauseBtn.textContent = "Ⅱ";
    lastGoalsSig = "";
    lastMessagesSig = "";
    lastOutlineSig = "";
    lastOutlineUri = "";
    refresh();
    scheduleOutlineLoad(0, true);
    renderMessagesForActive();
  });

  copyBtn.addEventListener("click", () => {
    const text = [
      activeLeanPosition ? activeLocationLabel() : "",
      currentGoalError ? `Error updating: ${currentGoalError}` : "",
      currentGoalState.goals ?? "",
      currentGoalState.termGoal ? `Expected type:\n${currentGoalState.termGoal}` : "",
      messagesList.textContent ?? "",
    ].filter(Boolean).join("\n\n");
    void navigator.clipboard?.writeText(text)
      .catch((err) => console.warn("[lean] clipboard copy failed", err));
  });

  widthResizer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    widthResizer.setPointerCapture(event.pointerId);
    root.classList.add("lean-panel--resizing");
    const move = (moveEvent: PointerEvent): void => {
      const width = clamp(moveEvent.clientX - root.getBoundingClientRect().left, MIN_WIDTH, MAX_WIDTH);
      currentLayout = { ...currentLayout, width };
      applyLayout();
      saveLayout();
    };
    const up = (upEvent: PointerEvent): void => {
      widthResizer.releasePointerCapture(upEvent.pointerId);
      root.classList.remove("lean-panel--resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveLayout();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  outlineResizer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    outlineResizer.setPointerCapture(event.pointerId);
    outlineSection.classList.add("lean-outline--resizing");
    const startY = event.clientY;
    const startHeight = currentLayout.outlineHeight;
    const move = (moveEvent: PointerEvent): void => {
      currentLayout = {
        ...currentLayout,
        outlineHeight: clamp(startHeight + moveEvent.clientY - startY, MIN_OUTLINE_HEIGHT, MAX_OUTLINE_HEIGHT),
      };
      applyLayout();
      saveLayout();
    };
    const up = (upEvent: PointerEvent): void => {
      outlineResizer.releasePointerCapture(upEvent.pointerId);
      outlineSection.classList.remove("lean-outline--resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveLayout();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  applyLayout(currentLayout);

  // -------------------------------------------------------------------------
  // Collapsible sections (VSCode / lean4web infoview style)
  // -------------------------------------------------------------------------
  function makeCollapsible(titleEl: HTMLElement, section: HTMLElement, onToggle?: (collapsed: boolean) => void): void {
    titleEl.classList.add("lean-collapsible");
    titleEl.setAttribute("role", "button");
    titleEl.setAttribute("tabindex", "0");
    const toggle = (): void => {
      section.classList.toggle("lean-section--collapsed");
      onToggle?.(section.classList.contains("lean-section--collapsed"));
    };
    titleEl.addEventListener("click", toggle);
    titleEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  }

  const termTitle = termSection.querySelector<HTMLElement>(".lean-panel-section-title");
  messagesPane.classList.add("lean-section--collapsed");
  makeCollapsible(goalsTitle, goalsSection);
  if (termTitle) makeCollapsible(termTitle, termSection);
  makeCollapsible(outlineTitle, outlineSection);
  makeCollapsible(messagesTitle, messagesPane, (collapsed) => {
    allMessagesCollapsed = collapsed;
    if (!collapsed) {
      lastMessagesSig = "";
      renderMessages(activeDiagnostics());
    }
  });

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    get visible() { return _visible; },
    show,
    hide,
    toggle,
    refresh,
    setNote(notePath: string, notesRoot: string) {
      if (currentNotePath) saveLayout();
      const changedNote = currentNotePath && currentNotePath !== notePath;
      if (changedNote && activeRegionLeanPath) {
        void api.lean.request("stop").catch((err) => console.warn("[lean] stop request failed", err));
      }
      currentNotePath = notePath;
      currentNotesRoot = notesRoot;
      activeRegionTag = "";
      activeRegionLeanPath = "";
      activeLeanPosition = null;
      currentGoalError = null;
      allMessagesCollapsed = true;
      messagesPane.classList.add("lean-section--collapsed");
      pinned = false;
      paused = false;
      pinBtn.classList.remove("is-active");
      pauseBtn.classList.remove("is-active");
      pauseBtn.textContent = "Ⅱ";
      currentGoalState = { goals: null, termGoal: null, blockIndex: null };
      currentGoalsAccomplished = false;
      currentLayout = noteLayouts.get(layoutKey()) ?? { width: DEFAULT_WIDTH, splitRatio: DEFAULT_SPLIT_RATIO, outlineHeight: DEFAULT_OUTLINE_HEIGHT };
      restoreLayoutForCurrentNote();
      currentDiagnostics = [];
      currentDiagnosticsUri = "";
      diagnosticsByUri.clear();
      diagnosticVersionsByUri.clear();
      lastGoalsSig = "";
      lastMessagesSig = "";
      lastCurrentSig = "";
      lastOutlineSig = "";
      lastOutlineUri = "";
      lastDiagnosticsFetchUri = "";
      outlineEpoch.cancel();
      renderMessages([]);
      renderGoals({ goals: null, termGoal: null, blockIndex: null });
      renderCurrent();
      renderOutlineEmpty("Move the cursor into Lean code");
      syncOfficialInfoviewVisibility();
    },
    destroy() {
      renderMessagesTimer.cancel();
      outlineLoadTimer.cancel();
      unsubDiag();
      unsubStatus();
      window.removeEventListener("aaronnote:lean-region-infoview", onRegionInfoview);
      officialInfoview.destroy();
    },
  };
}
