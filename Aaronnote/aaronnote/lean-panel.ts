/**
 * Lean 4 Infoview panel — left-side drawer.
 *
 * Displays:
 *   - Top pane: Lean LSP diagnostics/messages (click to jump)
 *   - Bottom pane: Lean infoview goals and expected type
 *   - Per-note in-memory width and vertical split size
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
  line?: number;
  character?: number;
  goals?: string | null;
  termGoal?: string | null;
  goalsAccomplished?: boolean;
}>;

type LeanPanelLayout = {
  width: number;
  splitRatio: number;
};

const noteLayouts = new Map<string, LeanPanelLayout>();
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
const DEFAULT_SPLIT_RATIO = 0.60;
const LSP_UI_IDLE_MS = 420;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// createLeanPanel
// ---------------------------------------------------------------------------

export function createLeanPanel(options: LeanPanelOptions): LeanPanel {
  const { root, getEditor, jumpToNoteOffset } = options;

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
</div>
<div class="lean-panel-width-resizer" data-lean-width-resizer role="separator" aria-orientation="vertical" title="Resize Lean panel"></div>
`;

  const statusEl = requireEl<HTMLElement>(root, "[data-lean-status]");
  const bodyEl = requireEl<HTMLElement>(root, "[data-lean-panel-body]");
  const infoPane = requireEl<HTMLElement>(root, "[data-lean-info-pane]");
  const messagesPane = requireEl<HTMLElement>(root, "[data-lean-messages-pane]");
  const goalsSection = requireEl<HTMLElement>(root, "[data-lean-goals-section]");
  const goalsTitle = requireEl<HTMLElement>(root, "[data-lean-goals-title]");
  const goalsEl = requireEl<HTMLElement>(root, "[data-lean-goals]");
  const termSection = requireEl<HTMLElement>(root, "[data-lean-term-section]");
  const termGoalEl = requireEl<HTMLElement>(root, "[data-lean-term-goal]");
  const messagesList = requireEl<HTMLElement>(root, "[data-lean-messages-list]");
  const widthResizer = requireEl<HTMLElement>(root, "[data-lean-width-resizer]");
  const pinBtn = requireEl<HTMLButtonElement>(root, "[data-lean-pin]");
  const pauseBtn = requireEl<HTMLButtonElement>(root, "[data-lean-pause]");
  const refreshBtn = requireEl<HTMLButtonElement>(root, "[data-lean-refresh]");
  const copyBtn = requireEl<HTMLButtonElement>(root, "[data-lean-copy]");
  const cacheBtn = requireEl<HTMLButtonElement>(root, "[data-lean-cache]");
  const restartBtn = requireEl<HTMLButtonElement>(root, "[data-lean-restart]");
  const stopBtn = requireEl<HTMLButtonElement>(root, "[data-lean-stop]");
  const closeBtn = requireEl<HTMLButtonElement>(root, "[data-lean-close]");

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
  let currentLayout: LeanPanelLayout = { width: DEFAULT_WIDTH, splitRatio: DEFAULT_SPLIT_RATIO };
  let activeRegionTag = "";
  let activeRegionLeanPath = "";
  let pinned = false;
  let paused = false;
  let currentGoalState: LeanGoalState = { goals: null, termGoal: null, blockIndex: null };
  let currentGoalsAccomplished = false;
  // Content-address renders to avoid replaceChildren on every Lean server push.
  let lastGoalsSig = "";
  let lastMessagesSig = "";
  let renderMessagesTimer: ReturnType<typeof setTimeout> | null = null;

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
    activeRegionTag = String(detail.tag ?? activeRegionTag);
    activeRegionLeanPath = String(detail.leanPath ?? activeRegionLeanPath);
    if (typeof detail.line === "number") {
      activeLeanPosition = {
        line: detail.line,
        character: Number(detail.character ?? 0),
      };
    }
    renderGoals({
      goals: detail.goals ?? null,
      termGoal: detail.termGoal ?? null,
      blockIndex: null,
    }, detail.goalsAccomplished === true);
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
    const sig = `${goalState.goals ?? ""}|${goalState.termGoal ?? ""}|${accomplished}`;
    if (sig === lastGoalsSig) return;
    lastGoalsSig = sig;

    const hasGoals = Boolean(goalState.goals);
    const hasTerm = Boolean(goalState.termGoal);

    goalsSection.hidden = false;
    termSection.hidden = !hasTerm;

    if (hasGoals) {
      goalsTitle.textContent = goalCountLabel(goalState.goals ?? "");
      renderInfoBlock(goalsEl, goalState.goals ?? "");
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

  function renderMessages(diags: unknown[]): void {
    if (paused) return;
    const activeLine = activeLeanPosition?.line ?? null;
    const sig = Array.isArray(diags) && diags.length > 0
      ? `${activeLine}|${(diags as LeanDiagnosticLike[]).map((d) => `${diagLeanStart(d).line}:${diagLeanStart(d).character}:${d.severity}:${d.message ?? ""}`).join("\n")}`
      : "__empty__";
    if (sig === lastMessagesSig) return;
    lastMessagesSig = sig;

    if (!Array.isArray(diags) || diags.length === 0) {
      messagesList.replaceChildren(el("div", "lean-panel-empty", "No messages"));
      return;
    }
    const sorted = [...diags].sort((a, b) => {
      const pa = diagLeanStart(a as LeanDiagnosticLike);
      const pb = diagLeanStart(b as LeanDiagnosticLike);
      return pa.line - pb.line || pa.character - pb.character;
    });
    messagesList.replaceChildren(renderMessageSection("All messages", sorted, activeLine));
  }

  function renderMessageSection(title: string, diags: unknown[], activeLine: number | null): HTMLElement {
    const section = el("section", "lean-msg-section");
    section.append(el("div", "lean-msg-section-title", `${title} (${diags.length})`));
    if (diags.length === 0) {
      section.append(el("div", "lean-panel-empty lean-panel-empty--small", "No messages"));
      return section;
    }
    section.append(
      ...diags.map((d) => {
        const diag = d as LeanDiagnosticLike;
        const sevClass = diag.severity === 1 ? "error" : diag.severity === 2 ? "warning" : "info";
        const isHere = activeLine !== null && diagLeanStart(diag).line === activeLine;
        const row = el("div", `lean-msg lean-msg--${sevClass}${isHere ? " lean-msg--here" : ""}`);
        const loc = el("span", "lean-msg-loc");
        loc.textContent = diagLocationLabel(diag);
        const text = el("span", "lean-msg-text");
        text.textContent = String(diag.message ?? "");
        row.append(loc, text);
        row.addEventListener("click", () => jumpToDiag(diag));
        return row;
      }),
    );
    return section;
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
    };
    root.style.setProperty("--lean-panel-width", `${currentLayout.width}px`);
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

  function diagLocationLabel(diag: LeanDiagnosticLike): string {
    const leanStart = diagLeanStart(diag);
    const editor = getEditor();
    if (!editor) return `Lean L${leanStart.line + 1}`;
    const splice = editor.view.state.field(leanSpliceField, false);
    if (!splice) return `Lean L${leanStart.line + 1}`;
    const noteOff = diagNoteOffset(diag, splice);
    if (noteOff === null) return `Lean L${leanStart.line + 1}`;
    const line = editor.view.state.doc.lineAt(Math.min(noteOff, editor.view.state.doc.length));
    return `MD L${line.number} / Lean L${leanStart.line + 1}`;
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

  function activeLeanUri(): string {
    if (activeRegionLeanPath) return filePathToUri(activeRegionLeanPath);
    const editor = getEditor();
    const splice = editor?.view.state.field(leanSpliceField, false);
    return splice ? filePathToUri(splice.leanPath) : currentDiagnosticsUri;
  }

  function activeDiagnostics(): unknown[] {
    const uri = activeLeanUri();
    if (uri && diagnosticsByUri.has(uri)) return diagnosticsByUri.get(uri) ?? [];
    return currentDiagnostics;
  }

  function renderMessagesForActive(): void {
    if (renderMessagesTimer) clearTimeout(renderMessagesTimer);
    renderMessagesTimer = setTimeout(() => {
      renderMessagesTimer = null;
      renderMessages(activeDiagnostics());
    }, LSP_UI_IDLE_MS);
  }

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  function show(): void {
    if (_visible) return;
    _visible = true;
    root.removeAttribute("hidden");
    root.classList.remove("lean-panel--hidden", "lean-panel--gone");
    document.body.classList.add("lean-panel-open");
    void api.lean.status().then((s) => {
      if (s) renderStatus(s as { message?: string; kind?: string });
    }).catch(() => {});
  }

  function hide(): void {
    if (!_visible) return;
    _visible = false;
    root.classList.add("lean-panel--hidden");
    root.removeAttribute("hidden");  // keep in DOM so transition plays
    document.body.classList.remove("lean-panel-open");
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
        currentDiagnostics = [];
        currentDiagnosticsUri = "";
        diagnosticsByUri.clear();
        diagnosticVersionsByUri.clear();
        lastGoalsSig = "";
        lastMessagesSig = "";
        renderMessages([]);
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
    refresh();
    renderMessagesForActive();
  });

  copyBtn.addEventListener("click", () => {
    const text = [
      currentGoalState.goals ?? "",
      currentGoalState.termGoal ? `Expected type:\n${currentGoalState.termGoal}` : "",
      messagesList.textContent ?? "",
    ].filter(Boolean).join("\n\n");
    void navigator.clipboard?.writeText(text).catch(() => {});
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

  applyLayout(currentLayout);

  // -------------------------------------------------------------------------
  // Collapsible sections (VSCode / lean4web infoview style)
  // -------------------------------------------------------------------------
  function makeCollapsible(titleEl: HTMLElement, section: HTMLElement): void {
    titleEl.classList.add("lean-collapsible");
    titleEl.setAttribute("role", "button");
    titleEl.setAttribute("tabindex", "0");
    const toggle = (): void => {
      section.classList.toggle("lean-section--collapsed");
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
  const messagesTitle = messagesPane.querySelector<HTMLElement>(".lean-panel-section-title");
  makeCollapsible(goalsTitle, goalsSection);
  if (termTitle) makeCollapsible(termTitle, termSection);
  if (messagesTitle) makeCollapsible(messagesTitle, messagesPane);

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
        void api.lean.request("stop").catch(() => {});
      }
      currentNotePath = notePath;
      currentNotesRoot = notesRoot;
      activeRegionTag = "";
      activeRegionLeanPath = "";
      activeLeanPosition = null;
      pinned = false;
      paused = false;
      pinBtn.classList.remove("is-active");
      pauseBtn.classList.remove("is-active");
      pauseBtn.textContent = "Ⅱ";
      currentGoalState = { goals: null, termGoal: null, blockIndex: null };
      currentGoalsAccomplished = false;
      currentLayout = noteLayouts.get(layoutKey()) ?? { width: DEFAULT_WIDTH, splitRatio: DEFAULT_SPLIT_RATIO };
      restoreLayoutForCurrentNote();
      currentDiagnostics = [];
      currentDiagnosticsUri = "";
      diagnosticsByUri.clear();
      diagnosticVersionsByUri.clear();
      lastGoalsSig = "";
      lastMessagesSig = "";
      renderMessages([]);
      renderGoals({ goals: null, termGoal: null, blockIndex: null });
    },
    destroy() {
      if (renderMessagesTimer) clearTimeout(renderMessagesTimer);
      unsubDiag();
      unsubStatus();
      window.removeEventListener("aaronnote:lean-region-infoview", onRegionInfoview);
    },
  };
}
