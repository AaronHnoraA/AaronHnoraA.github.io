/**
 * Lean 4 block CM6 extension.
 *
 * Scans #+begin lean4 … #+end lean4 blocks, builds a splice table, and:
 *   - Debounces doc changes → api.lean.changeNote (in-editor sync)
 *   - Shows diagnostics as error/warning underline marks
 *   - Shows file-progress ranges as a translucent "elaborating" overlay
 *   - Renders per-block cell output widget below each #+end lean4 line
 *   - Provides hover tooltips via textDocument/hover
 *   - Tracks cursor position and sends goal queries; result available via
 *     getLeanGoalState(state) for the panel to read.
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  hoverTooltip,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import type { Range } from "@codemirror/state";
import {
  buildFullFileLeanSplice,
  leanOffsetToNote,
  leanOffsetToPosition,
  leanPositionToOffset,
  noteOffsetToLean,
  type LeanSplice,
} from "../../lean-splice.ts";
import { api } from "../../../aaronnote/api-client.ts";
import type { OrgEnvBlock } from "./block-extras.ts";

// ---------------------------------------------------------------------------
// Helpers for org-env block scanning (re-implement minimal version to avoid
// importing CM6-dependent block-extras internals)
// ---------------------------------------------------------------------------

function scanLean4OrgEnvBlocks(state: EditorState): OrgEnvBlock[] {
  const OPEN_RE = /^[ \t]*#\+begin[ \t]+lean4(?:[ \t]+([^\n]*))?[ \t]*$/i;
  const CLOSE_RE = /^[ \t]*#\+end[ \t]+lean4[ \t]*$/i;
  const doc = state.doc;
  const results: OrgEnvBlock[] = [];
  const text = doc.toString();
  const lines = text.split("\n");
  const lineStart: number[] = [];
  let off = 0;
  for (const l of lines) { lineStart.push(off); off += l.length + 1; }

  let i = 0;
  while (i < lines.length) {
    const openMatch = OPEN_RE.exec(lines[i]);
    if (!openMatch) { i++; continue; }
    const kind = "lean4";
    const title = (openMatch[1] ?? "").trim();
    const openFrom = lineStart[i];
    const openTo = openFrom + lines[i].length;
    const bodyFrom = openTo + 1;
    const titleAnchor = title ? openFrom + lines[i].indexOf(title) : openTo;

    let depth = 1, j = i + 1;
    while (j < lines.length) {
      if (OPEN_RE.test(lines[j])) depth++;
      else if (CLOSE_RE.test(lines[j])) { depth--; if (depth === 0) break; }
      j++;
    }
    if (depth !== 0) { i++; continue; }

    const bodyTo = lineStart[j];
    const closeFrom = lineStart[j];
    const closeTo = lineStart[j] + lines[j].length;

    results.push({
      from: openFrom,
      to: closeTo,
      openFrom,
      openTo,
      bodyFrom,
      bodyTo,
      closeFrom,
      closeTo,
      kind,
      title,
      body: text.slice(bodyFrom, bodyTo),
      titleAnchor,
      depth: 0,
    });
    i = j + 1;
  }
  return results;
}

// Cached scan — only re-scans when doc changes affect lean4 syntax.
// For typical edits (typing outside lean4 blocks), positions are remapped without re-scanning.
const lean4OrgEnvBlocksField = StateField.define<OrgEnvBlock[]>({
  create: (state) => scanLean4OrgEnvBlocks(state),
  update(value, tr) {
    if (!tr.docChanged) return value;

    let needRescan = false;
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      if (needRescan) return;
      const removed = tr.startState.doc.sliceString(fromA, toA);
      const ins = inserted.toString();
      if (
        removed.includes("lean4") || ins.includes("lean4") ||
        removed.includes("#+") || ins.includes("#+") ||
        removed.includes("\n") || ins.includes("\n") ||
        value.some((b) => fromA < b.to && toA > b.from)
      ) needRescan = true;
    });
    if (needRescan) return scanLean4OrgEnvBlocks(tr.state);

    if (value.length === 0) return value;
    return value.map((b) => ({
      ...b,
      from: tr.changes.mapPos(b.from),
      to: tr.changes.mapPos(b.to),
      openFrom: tr.changes.mapPos(b.openFrom),
      openTo: tr.changes.mapPos(b.openTo),
      bodyFrom: tr.changes.mapPos(b.bodyFrom),
      bodyTo: tr.changes.mapPos(b.bodyTo),
      closeFrom: tr.changes.mapPos(b.closeFrom),
      closeTo: tr.changes.mapPos(b.closeTo),
      titleAnchor: tr.changes.mapPos(b.titleAnchor),
    }));
  },
});

/** Returns body offset ranges for all lean4 org-env blocks — used by live-preview to suppress markdown decoration. */
export function getLean4OrgEnvBodyRanges(state: EditorState): { from: number; to: number }[] {
  const blocks = state.field(lean4OrgEnvBlocksField, false) ?? scanLean4OrgEnvBlocks(state);
  return blocks.map((b) => ({ from: b.bodyFrom, to: b.bodyTo }));
}

/** Returns true when the primary cursor is inside a lean4 org-env block body. */
function isCursorInLean4Block(state: EditorState): boolean {
  const pos = state.selection.main.from;
  const blocks = state.field(lean4OrgEnvBlocksField, false) ?? scanLean4OrgEnvBlocks(state);
  return blocks.some((b) => pos >= b.bodyFrom && pos <= b.bodyTo);
}

// ---------------------------------------------------------------------------
// Lean note path (injected via EditorView facet or editor options)
// ---------------------------------------------------------------------------

export const leanNotePathFacet = EditorView.editorAttributes.of({});

// We store the note path in a module-level map keyed by view instance.
const viewNotePaths = new WeakMap<EditorView, string>();
const viewNotesRoots = new WeakMap<EditorView, string>();

export function setLeanNotePath(view: EditorView, notePath: string, notesRoot: string): void {
  viewNotePaths.set(view, notePath);
  viewNotesRoots.set(view, notesRoot);
  view.dispatch({});
}

function getNoteInfo(view: EditorView): { notePath: string; notesRoot: string } | null {
  const notePath = viewNotePaths.get(view);
  const notesRoot = viewNotesRoots.get(view);
  if (!notePath || !notesRoot) return null;
  return { notePath, notesRoot };
}

export function getLeanNoteInfo(view: EditorView): { notePath: string; notesRoot: string } | null {
  return getNoteInfo(view);
}

function fileUri(path: string): string {
  return `file://${path.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

// ---------------------------------------------------------------------------
// StateEffects / StateFields
// ---------------------------------------------------------------------------

interface LeanDiagnostic {
  from: number;
  to: number;
  severity: "error" | "warning" | "info";
  message: string;
}

interface LeanProgressRange {
  from: number;
  to: number;
}

interface LeanCellOutput {
  blockIndex: number;
  messages: Array<{ severity: string; message: string }>;
}

export interface LeanGoalState {
  goals: string | null;
  termGoal: string | null;
  blockIndex: number | null;
}

const SetDiagnosticsEffect = StateEffect.define<{ splice: LeanSplice; rawDiags: unknown[] }>();
const SetProgressEffect = StateEffect.define<{ splice: LeanSplice; rawProgress: unknown[] }>();
const SetSemanticTokensEffect = StateEffect.define<{ splice: LeanSplice; legend: unknown; data: unknown[] }>();
const SetGoalEffect = StateEffect.define<LeanGoalState>();
const SetSpliceEffect = StateEffect.define<LeanSplice | null>();

// Splice field — updated from ViewPlugin doc changes
export const leanSpliceField = StateField.define<LeanSplice | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetSpliceEffect)) return e.value;
    }
    return value;
  },
});

// Diagnostics field
const leanDiagnosticsField = StateField.define<LeanDiagnostic[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetDiagnosticsEffect)) return mapDiagnostics(e.value.splice, e.value.rawDiags);
    }
    if (tr.docChanged && value.length > 0) {
      return value.map((d) => ({
        ...d,
        from: tr.changes.mapPos(d.from, -1),
        to: tr.changes.mapPos(d.to, 1),
      }));
    }
    return value;
  },
});

// Progress field
const leanProgressField = StateField.define<LeanProgressRange[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetProgressEffect)) return mapProgress(e.value.splice, e.value.rawProgress);
    }
    if (tr.docChanged && value.length > 0) {
      return value.map((r) => ({
        from: tr.changes.mapPos(r.from, -1),
        to: tr.changes.mapPos(r.to, 1),
      }));
    }
    return value;
  },
});

const leanSemanticTokensField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetSemanticTokensEffect)) return buildSemanticTokenDecorations(e.value.splice, e.value.legend, e.value.data);
      if (e.is(SetSpliceEffect) && e.value === null) return Decoration.none;
    }
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Goal field — read by the lean panel
export const leanGoalField = StateField.define<LeanGoalState>({
  create: () => ({ goals: null, termGoal: null, blockIndex: null }),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetGoalEffect)) return e.value;
    }
    return value;
  },
});

export function getLeanGoalState(state: EditorState): LeanGoalState {
  return state.field(leanGoalField, false) ?? { goals: null, termGoal: null, blockIndex: null };
}

// Cell outputs (per-block) — kept in a separate field
const leanCellOutputField = StateField.define<LeanCellOutput[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetDiagnosticsEffect)) return groupDiagsByBlock(e.value.splice, e.value.rawDiags);
    }
    return value;
  },
});

// ---------------------------------------------------------------------------
// Diagnostic mapping helpers
// ---------------------------------------------------------------------------

function rawDiagSeverity(sev: number | undefined): "error" | "warning" | "info" {
  if (sev === 1) return "error";
  if (sev === 2) return "warning";
  return "info";
}

function mapDiagnostics(splice: LeanSplice, rawDiags: unknown[]): LeanDiagnostic[] {
  const out: LeanDiagnostic[] = [];
  for (const d of rawDiags) {
    const diag = d as { range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } }; severity?: number; message?: string };
    const startLine = diag.range?.start?.line ?? 0;
    const startChar = diag.range?.start?.character ?? 0;
    const endLine = diag.range?.end?.line ?? startLine;
    const endChar = diag.range?.end?.character ?? startChar;

    const leanFrom = leanPositionToOffset(splice.leanText, startLine, startChar);
    const leanTo = leanPositionToOffset(splice.leanText, endLine, endChar);

    const noteFrom = leanOffsetToNote(splice, leanFrom);
    const noteTo = leanOffsetToNote(splice, leanTo);
    if (noteFrom == null) continue;

    out.push({
      from: noteFrom,
      to: noteTo ?? noteFrom + 1,
      severity: rawDiagSeverity(diag.severity),
      message: String(diag.message ?? ""),
    });
  }
  return out;
}

function groupDiagsByBlock(splice: LeanSplice, rawDiags: unknown[]): LeanCellOutput[] {
  const byBlock = new Map<number, Array<{ severity: string; message: string }>>();
  for (const block of splice.blocks) {
    byBlock.set(block.index, []);
  }
  for (const d of rawDiags) {
    const diag = d as { range?: { start?: { line?: number; character?: number } }; severity?: number; message?: string };
    const leanOff = leanPositionToOffset(splice.leanText, diag.range?.start?.line ?? 0, diag.range?.start?.character ?? 0);
    const block = splice.blocks.find((b) => leanOff >= b.leanFrom && leanOff <= b.leanTo);
    if (!block) continue;
    byBlock.get(block.index)?.push({ severity: rawDiagSeverity(diag.severity), message: String(diag.message ?? "") });
  }
  return Array.from(byBlock.entries()).map(([index, messages]) => ({ blockIndex: index, messages }));
}

function mapProgress(splice: LeanSplice, rawProgress: unknown[]): LeanProgressRange[] {
  const out: LeanProgressRange[] = [];
  for (const p of rawProgress) {
    const prog = p as { range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } }; kind?: number };
    if (prog.kind !== 1) continue; // only "processing" ranges
    const leanFrom = leanPositionToOffset(splice.leanText, prog.range?.start?.line ?? 0, prog.range?.start?.character ?? 0);
    const leanTo = leanPositionToOffset(splice.leanText, prog.range?.end?.line ?? 0, prog.range?.end?.character ?? 0);
    const noteFrom = leanOffsetToNote(splice, leanFrom);
    const noteTo = leanOffsetToNote(splice, leanTo);
    if (noteFrom == null) continue;
    out.push({ from: noteFrom, to: noteTo ?? noteFrom });
  }
  return out;
}

function semanticTokenClass(tokenType: string): string {
  const safe = String(tokenType || "unknown").replace(/[^A-Za-z0-9_-]/g, "-").toLowerCase();
  return `cm-lean-token cm-lean-token-${safe}`;
}

function buildSemanticTokenDecorations(splice: LeanSplice, legend: unknown, data: unknown[]): DecorationSet {
  const tokenTypes = Array.isArray((legend as { tokenTypes?: unknown[] } | null)?.tokenTypes)
    ? (legend as { tokenTypes: unknown[] }).tokenTypes.map(String)
    : [];
  const raw = data.map((value) => Number(value));
  const out: Range<Decoration>[] = [];
  let line = 0;
  let character = 0;

  for (let i = 0; i + 4 < raw.length; i += 5) {
    const deltaLine = raw[i] ?? 0;
    const deltaStart = raw[i + 1] ?? 0;
    const length = raw[i + 2] ?? 0;
    const tokenTypeIndex = raw[i + 3] ?? -1;
    if (!Number.isFinite(deltaLine) || !Number.isFinite(deltaStart) || !Number.isFinite(length) || length <= 0) continue;

    line += deltaLine;
    character = deltaLine === 0 ? character + deltaStart : deltaStart;

    const leanFrom = leanPositionToOffset(splice.leanText, line, character);
    const leanTo = leanPositionToOffset(splice.leanText, line, character + length);
    const noteFrom = leanOffsetToNote(splice, leanFrom);
    const noteTo = leanOffsetToNote(splice, leanTo);
    if (noteFrom == null || noteTo == null || noteFrom >= noteTo) continue;
    out.push(Decoration.mark({ class: semanticTokenClass(tokenTypes[tokenTypeIndex] ?? "unknown") }).range(noteFrom, noteTo));
  }
  out.sort((a, b) => a.from - b.from || (a.value.startSide - b.value.startSide));
  return Decoration.set(out, true);
}

// ---------------------------------------------------------------------------
// Cell output widget
// ---------------------------------------------------------------------------

class LeanCellOutputWidget extends WidgetType {
  output: LeanCellOutput;

  constructor(output: LeanCellOutput) {
    super();
    this.output = output;
  }

  eq(other: LeanCellOutputWidget): boolean {
    if (this.output.blockIndex !== other.output.blockIndex) return false;
    if (this.output.messages.length !== other.output.messages.length) return false;
    return this.output.messages.every((m, i) => m.severity === other.output.messages[i]?.severity && m.message === other.output.messages[i]?.message);
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-lean-cell-output";
    if (this.output.messages.length === 0) {
      div.classList.add("cm-lean-cell-output--empty");
      return div;
    }
    for (const msg of this.output.messages) {
      const row = document.createElement("div");
      row.className = `cm-lean-cell-msg cm-lean-cell-msg--${msg.severity}`;
      const pre = document.createElement("pre");
      pre.className = "cm-lean-cell-text";
      pre.textContent = msg.message;
      row.append(pre);
      div.append(row);
    }
    return div;
  }

  ignoreEvent(): boolean { return true; }
}

// ---------------------------------------------------------------------------
// Main ViewPlugin
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 400;
const GOAL_DEBOUNCE_MS = 200;

class LeanBlockPlugin {
  decorations: DecorationSet;
  private readonly view: EditorView;
  private changeTimer: ReturnType<typeof setTimeout> | null = null;
  private goalTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSplice: LeanSplice | null = null;
  private unsubDiag: (() => void) | null = null;
  private unsubProgress: (() => void) | null = null;
  private unsubSemanticTokens: (() => void) | null = null;
  private unsubStatus: (() => void) | null = null;
  private isOpen = false;
  private syncSeq = 0;
  private syncedNotePath = "";
  private openNotePath = "";
  private openLeanPath = "";

  constructor(view: EditorView) {
    this.view = view;
    this.decorations = this.buildDecorations();
    this.setupPushListeners();
    this.syncToLean();
  }

  setupPushListeners(): void {
    this.unsubDiag = api.lean.onDiagnostics((raw) => {
      const data = raw as { uri?: string; diagnostics?: unknown[] };
      const splice = this.view.state.field(leanSpliceField, false);
      if (!splice) return;
      const expectedUris = new Set([fileUri(splice.leanPath), this.openLeanPath ? fileUri(this.openLeanPath) : ""]);
      if (!data.uri || !expectedUris.has(data.uri)) return;
      this.view.dispatch({
        effects: [
          SetDiagnosticsEffect.of({ splice, rawDiags: data.diagnostics ?? [] }),
        ],
      });
    });

    this.unsubProgress = api.lean.onProgress((raw) => {
      const data = raw as { uri?: string; processing?: unknown[] };
      const splice = this.view.state.field(leanSpliceField, false);
      if (!splice) return;
      const expectedUris = new Set([fileUri(splice.leanPath), this.openLeanPath ? fileUri(this.openLeanPath) : ""]);
      if (!data.uri || !expectedUris.has(data.uri)) return;
      this.view.dispatch({
        effects: [
          SetProgressEffect.of({ splice, rawProgress: data.processing ?? [] }),
        ],
      });
    });

    this.unsubSemanticTokens = api.lean.onSemanticTokens((raw) => {
      const data = raw as { uri?: string; legend?: unknown; data?: unknown[] };
      const splice = this.view.state.field(leanSpliceField, false);
      if (!splice) return;
      const expectedUris = new Set([fileUri(splice.leanPath), this.openLeanPath ? fileUri(this.openLeanPath) : ""]);
      if (!data.uri || !expectedUris.has(data.uri)) return;
      this.view.dispatch({
        effects: [
          SetSemanticTokensEffect.of({ splice, legend: data.legend, data: data.data ?? [] }),
        ],
      });
    });

    this.unsubStatus = api.lean.onStatus((_data) => {
      // Status updates are handled by the panel; nothing to do in the editor.
    });
  }

  buildDecorations(): DecorationSet {
    const state = this.view.state;
    const diagnostics = state.field(leanDiagnosticsField, false) ?? [];
    const progress = state.field(leanProgressField, false) ?? [];
    const cellOutputs = state.field(leanCellOutputField, false) ?? [];
    const blocks = state.field(lean4OrgEnvBlocksField, false) ?? [];
    const decos: Range<Decoration>[] = [];

    // Diagnostic underlines
    for (const d of diagnostics) {
      if (d.from >= d.to) continue;
      decos.push(
        Decoration.mark({ class: `cm-lean-diag cm-lean-diag--${d.severity}` }).range(d.from, d.to),
      );
    }

    // Progress "elaborating" overlay
    for (const r of progress) {
      if (r.from >= r.to) continue;
      decos.push(Decoration.mark({ class: "cm-lean-processing" }).range(r.from, r.to));
    }

    // Cell output widgets (one after each #+end lean4 line) — only for markdown notes
    const noteInfo = getNoteInfo(this.view);
    const isLeanFile = noteInfo?.notePath.toLowerCase().endsWith(".lean") ?? false;
    if (!isLeanFile) {
      for (const block of blocks) {
        const output = cellOutputs.find((o) => o.blockIndex === blocks.indexOf(block));
        if (!output) continue;
        decos.push(
          Decoration.widget({
            widget: new LeanCellOutputWidget(output),
            block: true,
            side: 1,
          }).range(block.closeTo),
        );
      }
    }

    decos.sort((a, b) => a.from - b.from || (a.value.startSide - b.value.startSide));
    return Decoration.set(decos, true);
  }

  update(update: ViewUpdate): void {
    const notePath = getNoteInfo(update.view)?.notePath ?? "";
    const notePathChanged = notePath !== this.syncedNotePath;

    // Only rebuild decorations when lean-visible state actually changes.
    // selectionSet and viewportChanged do NOT affect lean decorations.
    const hasLeanVisualEffect = update.transactions.some((t) =>
      t.effects.some((e) =>
        e.is(SetDiagnosticsEffect) || e.is(SetProgressEffect) ||
        e.is(SetSemanticTokensEffect) || e.is(SetSpliceEffect)
      )
    );
    if (update.docChanged || notePathChanged || hasLeanVisualEffect) {
      this.decorations = this.buildDecorations();
    }

    if (update.docChanged || notePathChanged) {
      if (this.changeTimer) clearTimeout(this.changeTimer);
      this.changeTimer = setTimeout(() => {
        this.changeTimer = null;
        this.syncToLean();
      }, update.docChanged ? DEBOUNCE_MS : 0);
    }

    if (update.selectionSet || update.docChanged) {
      if (this.goalTimer) clearTimeout(this.goalTimer);
      // Skip goal queries entirely when lean is not active (no splice = no lean content).
      const splice = update.view.state.field(leanSpliceField, false);
      if (splice) {
        if (isCursorInLean4Block(update.view.state)) {
          this.goalTimer = setTimeout(() => {
            this.goalTimer = null;
            void this.queryGoals();
          }, GOAL_DEBOUNCE_MS);
        } else {
          // Clear goals immediately when cursor leaves a lean4 block
          this.view.dispatch({ effects: SetGoalEffect.of({ goals: null, termGoal: null, blockIndex: null }) });
        }
      }
    }
  }

  syncToLean(): void {
    if (!api.lean.available()) return;
    const noteInfo = getNoteInfo(this.view);
    const currentSplice = this.view.state.field(leanSpliceField, false);
    if (!noteInfo) {
      this.syncedNotePath = "";
      this.syncSeq++;
      if (currentSplice !== null) this.view.dispatch({ effects: SetSpliceEffect.of(null) });
      if (this.isOpen) this.closeLean();
      return;
    }
    this.syncedNotePath = noteInfo.notePath;
    const isLeanFile = noteInfo.notePath.toLowerCase().endsWith(".lean");
    if (!isLeanFile) {
      // .md files: lean integration handled via @@lean4 region widgets, not this plugin.
      this.syncSeq++;
      if (currentSplice !== null) this.view.dispatch({ effects: SetSpliceEffect.of(null) });
      if (this.isOpen) this.closeLean();
      return;
    }
    const mdText = this.view.state.doc.toString();
    const splice = buildFullFileLeanSplice(noteInfo.notePath, mdText);
    if (!splice) {
      this.syncSeq++;
      if (currentSplice !== null) this.view.dispatch({ effects: SetSpliceEffect.of(null) });
      if (this.isOpen) this.closeLean();
      return;
    }
    this.view.dispatch({ effects: SetSpliceEffect.of(splice) });

    if (this.isOpen && this.openNotePath && this.openNotePath !== noteInfo.notePath) {
      this.closeLean();
    }
    this.lastSplice = splice;

    void this.sendLeanSync(noteInfo, splice);
  }

  async sendLeanSync(noteInfo: { notePath: string; notesRoot: string }, splice: LeanSplice): Promise<void> {
    const seq = ++this.syncSeq;
    const opening = !this.isOpen;
    try {
      const leanPath = opening ? splice.leanPath : (this.openLeanPath || splice.leanPath);
      const result = opening
        ? await api.lean.openNote({
          notePath: noteInfo.notePath,
          notesRoot: noteInfo.notesRoot,
          leanPath: splice.leanPath,
          leanText: splice.leanText,
        })
        : await api.lean.changeNote({
          notePath: noteInfo.notePath,
          leanPath,
          leanText: splice.leanText,
        });
      if (seq !== this.syncSeq) return;
      const response = result as { ok?: boolean; leanPath?: string; message?: string } | null;
      if (response?.ok === false) throw new Error(response.message || "Lean sync failed");
      this.isOpen = true;
      this.openNotePath = noteInfo.notePath;
      this.openLeanPath = response?.leanPath || splice.leanPath;
    } catch (err) {
      if (seq !== this.syncSeq) return;
      this.isOpen = false;
      this.openNotePath = "";
      this.openLeanPath = "";
      console.warn("[lean] sync failed", err);
    }
  }

  closeLean(): void {
    this.syncSeq++;
    const leanPath = this.openLeanPath || this.lastSplice?.leanPath || "";
    if (leanPath && this.isOpen) {
      void api.lean.closeNote({ leanPath });
    }
    this.isOpen = false;
    this.openNotePath = "";
    this.openLeanPath = "";
  }

  async queryGoals(): Promise<void> {
    if (!api.lean.available()) return;
    const splice = this.view.state.field(leanSpliceField, false);
    if (!splice) return;
    const pos = this.view.state.selection.main.from;
    const leanOff = noteOffsetToLean(splice, pos);
    if (leanOff == null) {
      this.view.dispatch({ effects: SetGoalEffect.of({ goals: null, termGoal: null, blockIndex: null }) });
      return;
    }
    const leanPos = leanOffsetToPosition(splice.leanText, leanOff);
    const blockIndex = splice.blocks.findIndex((b) => pos >= b.noteBodyFrom && pos <= b.noteBodyTo);

    const [goalsRes, termRes] = await Promise.all([
      api.lean.getGoals({ leanPath: splice.leanPath, line: leanPos.line, character: leanPos.character }),
      api.lean.getTermGoal({ leanPath: splice.leanPath, line: leanPos.line, character: leanPos.character }),
    ]);
    const goals = (goalsRes as { result?: { rendered?: string } } | null)?.result?.rendered ?? null;
    const termGoal = (termRes as { result?: { rendered?: string } } | null)?.result?.rendered ?? null;
    this.view.dispatch({
      effects: SetGoalEffect.of({ goals, termGoal, blockIndex: blockIndex >= 0 ? blockIndex : null }),
    });
  }

  destroy(): void {
    if (this.changeTimer) clearTimeout(this.changeTimer);
    if (this.goalTimer) clearTimeout(this.goalTimer);
    this.unsubDiag?.();
    this.unsubProgress?.();
    this.unsubSemanticTokens?.();
    this.unsubStatus?.();
    this.closeLean();
  }
}

const leanBlockViewPlugin = ViewPlugin.fromClass(LeanBlockPlugin, {
  decorations: (v) => v.decorations,
});

// ---------------------------------------------------------------------------
// Hover tooltip
// ---------------------------------------------------------------------------

const leanHoverTooltip = hoverTooltip(async (view, pos) => {
  const splice = view.state.field(leanSpliceField, false);
  if (!splice || !api.lean.available()) return null;

  const leanOff = noteOffsetToLean(splice, pos);
  if (leanOff == null) return null;

  const leanPos = leanOffsetToPosition(splice.leanText, leanOff);
  const result = await api.lean.getHover({
    leanPath: splice.leanPath,
    line: leanPos.line,
    character: leanPos.character,
  });
  const hover = result as { result?: { contents?: { value?: string } | string; range?: unknown } } | null;
  if (!hover?.result) return null;

  const contents = hover.result.contents;
  const raw = typeof contents === "string" ? contents : (contents as { value?: string })?.value ?? "";
  if (!raw.trim()) return null;

  // Lean hover responses wrap content in ```lean ... ``` — strip the fences for display.
  const FENCE_RE = /^```[\w]*\n([\s\S]*?)```\s*$/;
  const fenceMatch = FENCE_RE.exec(raw.trim());
  const codeText = fenceMatch ? fenceMatch[1].trimEnd() : raw.trim();

  return {
    pos,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-lean-hover-tooltip";
      const pre = document.createElement("pre");
      pre.className = "cm-lean-hover-text";
      pre.textContent = codeText;
      dom.append(pre);
      return { dom };
    },
  };
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const leanExtension: Extension = [
  lean4OrgEnvBlocksField,
  leanSpliceField,
  leanDiagnosticsField,
  leanProgressField,
  leanSemanticTokensField,
  leanGoalField,
  leanCellOutputField,
  leanBlockViewPlugin,
  leanHoverTooltip,
];
