/**
 * Lean 4 Infoview panel — left-side drawer.
 *
 * Displays:
 *   - Lean server status
 *   - Tactic goals at cursor ($/lean/plainGoal)
 *   - Expected type at cursor ($/lean/plainTermGoal)
 *   - All diagnostics for the current note (click to jump)
 */

import { api } from "./api-client.ts";
import type { Editor } from "../src/lib.ts";
import { getLeanGoalState, leanSpliceField, type LeanGoalState } from "../src/cm6/widgets/lean-block.ts";
import { leanPositionToOffset, leanOffsetToNote } from "../src/lean-splice.ts";

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
  <button class="lean-panel-btn lean-panel-btn--icon" data-lean-restart title="Restart Lean server">↺</button>
  <button class="lean-panel-btn lean-panel-btn--icon lean-panel-close" data-lean-close title="Close panel">✕</button>
</div>
<div class="lean-panel-body">
  <section class="lean-panel-section lean-panel-goals" data-lean-goals-section>
    <div class="lean-panel-section-title">Goals</div>
    <pre class="lean-panel-code lean-goals-text" data-lean-goals></pre>
  </section>
  <section class="lean-panel-section lean-panel-term-goal" data-lean-term-section>
    <div class="lean-panel-section-title">Expected type</div>
    <pre class="lean-panel-code lean-term-goal-text" data-lean-term-goal></pre>
  </section>
  <section class="lean-panel-section lean-panel-messages" data-lean-messages-section>
    <div class="lean-panel-section-title">Messages</div>
    <div class="lean-messages-list" data-lean-messages-list></div>
  </section>
</div>
`;

  const statusEl = requireEl<HTMLElement>(root, "[data-lean-status]");
  const goalsSection = requireEl<HTMLElement>(root, "[data-lean-goals-section]");
  const goalsEl = requireEl<HTMLElement>(root, "[data-lean-goals]");
  const termSection = requireEl<HTMLElement>(root, "[data-lean-term-section]");
  const termGoalEl = requireEl<HTMLElement>(root, "[data-lean-term-goal]");
  const messagesSection = requireEl<HTMLElement>(root, "[data-lean-messages-section]");
  const messagesList = requireEl<HTMLElement>(root, "[data-lean-messages-list]");
  const restartBtn = requireEl<HTMLButtonElement>(root, "[data-lean-restart]");
  const closeBtn = requireEl<HTMLButtonElement>(root, "[data-lean-close]");

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  let currentNotePath = "";
  let currentNotesRoot = "";
  let currentDiagnostics: unknown[] = [];
  let _visible = false;

  // -------------------------------------------------------------------------
  // Push subscriptions
  // -------------------------------------------------------------------------
  const unsubDiag = api.lean.onDiagnostics((raw) => {
    const data = raw as { diagnostics?: unknown[] };
    currentDiagnostics = data.diagnostics ?? [];
    renderMessages(currentDiagnostics);
  });

  const unsubStatus = api.lean.onStatus((raw) => {
    const data = raw as { message?: string; kind?: string };
    renderStatus(data);
  });

  // -------------------------------------------------------------------------
  // Render functions
  // -------------------------------------------------------------------------

  function renderStatus(data: { message?: string; kind?: string }): void {
    const msg = String(data.message ?? "");
    const kind = String(data.kind ?? "Inactive");
    statusEl.textContent = msg;
    statusEl.className = `lean-panel-status lean-panel-status--${kind.toLowerCase()}`;
  }

  function renderGoals(goalState: LeanGoalState): void {
    const hasGoals = Boolean(goalState.goals);
    const hasTerm = Boolean(goalState.termGoal);

    goalsSection.hidden = !hasGoals;
    termSection.hidden = !hasTerm;

    goalsEl.textContent = goalState.goals ?? "";
    termGoalEl.textContent = goalState.termGoal ?? "";

    root.classList.toggle("lean-panel--has-goals", hasGoals || hasTerm);
  }

  function renderMessages(diags: unknown[]): void {
    if (!Array.isArray(diags) || diags.length === 0) {
      messagesSection.hidden = true;
      messagesList.replaceChildren();
      return;
    }
    messagesSection.hidden = false;
    messagesList.replaceChildren(
      ...diags.map((d) => {
        const diag = d as { range?: { start?: { line?: number } }; severity?: number; message?: string };
        const sevClass = diag.severity === 1 ? "error" : diag.severity === 2 ? "warning" : "info";
        const row = el("div", `lean-msg lean-msg--${sevClass}`);
        const loc = el("span", "lean-msg-loc");
        loc.textContent = `L${(diag.range?.start?.line ?? 0) + 1}`;
        const text = el("span", "lean-msg-text");
        text.textContent = String(diag.message ?? "");
        row.append(loc, text);
        row.addEventListener("click", () => jumpToDiag(diag));
        return row;
      }),
    );
  }

  function jumpToDiag(diag: { range?: { start?: { line?: number; character?: number } }; severity?: number }): void {
    const editor = getEditor();
    if (!editor) return;
    const splice = editor.view.state.field(leanSpliceField, false);
    if (!splice) return;
    const line = diag.range?.start?.line ?? 0;
    const ch = diag.range?.start?.character ?? 0;
    const leanOff = leanPositionToOffset(splice.leanText, line, ch);
    const noteOff = leanOffsetToNote(splice, leanOff);
    if (noteOff === null) return;
    jumpToNoteOffset(noteOff);
  }

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  function show(): void {
    if (_visible) return;
    _visible = true;
    root.removeAttribute("hidden");
    root.classList.add("lean-panel--visible");
    void api.lean.status().then((s) => {
      if (s) renderStatus(s as { message?: string; kind?: string });
    }).catch(() => {});
  }

  function hide(): void {
    if (!_visible) return;
    _visible = false;
    root.setAttribute("hidden", "");
    root.classList.remove("lean-panel--visible");
  }

  function toggle(): void {
    if (_visible) hide(); else show();
  }

  // -------------------------------------------------------------------------
  // Refresh (called by main.ts after every editor update)
  // -------------------------------------------------------------------------

  function refresh(): void {
    if (!_visible) return;
    const editor = getEditor();
    if (!editor) return;
    const goalState = getLeanGoalState(editor.view.state);
    renderGoals(goalState);
  }

  // -------------------------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------------------------

  restartBtn.addEventListener("click", () => {
    void api.lean.saveNote({ notePath: currentNotePath });
    statusEl.textContent = "Restarting...";
    void (async () => {
      await (api.lean as unknown as { request: (a: string) => Promise<unknown> }).request("stop");
      if (currentNotePath && currentNotesRoot) {
        const editor = getEditor();
        const splice = editor?.view.state.field(leanSpliceField, false);
        if (splice) {
          await api.lean.openNote({ notePath: currentNotePath, notesRoot: currentNotesRoot, leanText: splice.leanText, leanPath: splice.leanPath });
        }
      }
    })();
  });

  closeBtn.addEventListener("click", () => hide());

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
      currentNotePath = notePath;
      currentNotesRoot = notesRoot;
      currentDiagnostics = [];
      renderMessages([]);
      renderGoals({ goals: null, termGoal: null, blockIndex: null });
    },
    destroy() {
      unsubDiag();
      unsubStatus();
    },
  };
}
