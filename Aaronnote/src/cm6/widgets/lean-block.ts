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
  hoverTooltip,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { MeasuredWidget } from "./measured-widget.ts";
import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import type { Range } from "@codemirror/state";
import {
  leanOffsetToNote,
  leanOffsetToPosition,
  leanPositionToOffset,
  noteOffsetToLean,
  type LeanSplice,
} from "../../lean-splice.ts";
import { renderLeanMarkdown } from "../../lean-render.ts";
import { api } from "../../../aaronnote/api-client.ts";
import type { LspDiagnostic, LspFileProgressItem } from "../../types/lean-ipc.ts";
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

function lineWindowMightAffectLean4OrgEnv(doc: EditorState["doc"], from: number, to: number): boolean {
  const startLine = Math.max(1, doc.lineAt(Math.max(0, Math.min(from, doc.length))).number - 1);
  const endLine = Math.min(doc.lines, doc.lineAt(Math.max(0, Math.min(to, doc.length))).number + 1);
  for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
    const text = doc.line(lineNo).text;
    if (text.includes("#+") || /lean4/i.test(text)) return true;
  }
  return false;
}

function changesMightAffectLean4OrgEnvSyntax(startState: EditorState, state: EditorState, changes: ViewUpdate["changes"]): boolean {
  let found = false;
  changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    if (found) return;
    const removed = startState.doc.sliceString(fromA, toA);
    const added = inserted.toString();
    found = removed.includes("#+")
      || added.includes("#+")
      || /lean4/i.test(removed)
      || /lean4/i.test(added)
      || lineWindowMightAffectLean4OrgEnv(startState.doc, fromA, toA)
      || lineWindowMightAffectLean4OrgEnv(state.doc, fromB, toB);
  });
  return found;
}

// Cached scan — only re-scans when doc changes affect lean4 syntax.
// For typical edits (typing outside lean4 blocks), positions are remapped without re-scanning.
const lean4OrgEnvBlocksField = StateField.define<OrgEnvBlock[]>({
  create: (state) => scanLean4OrgEnvBlocks(state),
  update(value, tr) {
    if (!tr.docChanged) return value;

    let needRescan = changesMightAffectLean4OrgEnvSyntax(tr.startState, tr.state, tr.changes);
    tr.changes.iterChanges((fromA, toA) => {
      if (needRescan) return;
      if (value.some((b) => (
        (fromA <= b.openTo && toA >= b.openFrom)
        || (fromA <= b.closeTo && toA >= b.closeFrom)
      ))) needRescan = true;
    });
    if (needRescan) return scanLean4OrgEnvBlocks(tr.state);

    if (value.length === 0) return value;
    return value.map((b) => {
      const bodyFrom = tr.changes.mapPos(b.bodyFrom);
      const bodyTo = tr.changes.mapPos(b.bodyTo);
      return {
        ...b,
        from: tr.changes.mapPos(b.from),
        to: tr.changes.mapPos(b.to),
        openFrom: tr.changes.mapPos(b.openFrom),
        openTo: tr.changes.mapPos(b.openTo),
        bodyFrom,
        bodyTo,
        closeFrom: tr.changes.mapPos(b.closeFrom),
        closeTo: tr.changes.mapPos(b.closeTo),
        body: tr.changes.touchesRange(b.bodyFrom, b.bodyTo)
          ? tr.state.doc.sliceString(bodyFrom, bodyTo)
          : b.body,
        titleAnchor: tr.changes.mapPos(b.titleAnchor),
      };
    });
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
const SetLeanNoteInfoEffect = StateEffect.define<{ notePath: string; notesRoot: string }>();

export const leanNoteInfoField = StateField.define<{ notePath: string; notesRoot: string }>({
  create: () => ({ notePath: "", notesRoot: "" }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanNoteInfoEffect)) return effect.value;
    }
    return value;
  },
});

export function setLeanNotePath(view: EditorView, notePath: string, notesRoot: string): void {
  viewNotePaths.set(view, notePath);
  viewNotesRoots.set(view, notesRoot);
  view.dispatch({ effects: SetLeanNoteInfoEffect.of({ notePath, notesRoot }) });
}

function getNoteInfo(view: EditorView): { notePath: string; notesRoot: string } | null {
  const fieldInfo = view.state.field(leanNoteInfoField, false);
  const notePath = fieldInfo?.notePath || viewNotePaths.get(view);
  const notesRoot = fieldInfo?.notesRoot || viewNotesRoots.get(view);
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

const SetDiagnosticsEffect = StateEffect.define<{ splice: LeanSplice; rawDiags: LspDiagnostic[] }>();
const SetProgressEffect = StateEffect.define<{ splice: LeanSplice; rawProgress: LspFileProgressItem[] }>();
const SetSemanticTokensEffect = StateEffect.define<{ splice: LeanSplice; legend: unknown; data: number[] }>();
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

function mapDiagnostics(splice: LeanSplice, rawDiags: LspDiagnostic[]): LeanDiagnostic[] {
  const out: LeanDiagnostic[] = [];
  for (const diag of rawDiags) {
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

function groupDiagsByBlock(splice: LeanSplice, rawDiags: LspDiagnostic[]): LeanCellOutput[] {
  const byBlock = new Map<number, Array<{ severity: string; message: string }>>();
  for (const block of splice.blocks) {
    byBlock.set(block.index, []);
  }
  for (const diag of rawDiags) {
    const leanOff = leanPositionToOffset(splice.leanText, diag.range?.start?.line ?? 0, diag.range?.start?.character ?? 0);
    const block = splice.blocks.find((b) => leanOff >= b.leanFrom && leanOff <= b.leanTo);
    if (!block) continue;
    byBlock.get(block.index)?.push({ severity: rawDiagSeverity(diag.severity), message: String(diag.message ?? "") });
  }
  return Array.from(byBlock.entries()).map(([index, messages]) => ({ blockIndex: index, messages }));
}

function mapProgress(splice: LeanSplice, rawProgress: LspFileProgressItem[]): LeanProgressRange[] {
  const out: LeanProgressRange[] = [];
  for (const prog of rawProgress) {
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

class LeanCellOutputWidget extends MeasuredWidget {
  output: LeanCellOutput;

  constructor(output: LeanCellOutput) {
    super();
    this.output = output;
  }

  protected measureKey(): string { return "leanout:" + this.output.blockIndex; }

  protected measureGroupKey(): string {
    const lines = this.output.messages.reduce((sum, msg) => sum + Math.max(1, msg.message.split(/\n/).length), 0);
    return `leanout:lines:${Math.min(8, Math.ceil(lines / 5))}`;
  }

  protected estimatedHeightFallback(): number {
    if (this.output.messages.length === 0) return 8;
    const lines = this.output.messages.reduce((sum, msg) => sum + Math.max(1, msg.message.split(/\n/).length), 0);
    return Math.max(42, 18 + lines * 20);
  }

  eq(other: LeanCellOutputWidget): boolean {
    if (this.output.blockIndex !== other.output.blockIndex) return false;
    if (this.output.messages.length !== other.output.messages.length) return false;
    return this.output.messages.every((m, i) => m.severity === other.output.messages[i]?.severity && m.message === other.output.messages[i]?.message);
  }

  toDOM(view: EditorView): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-lean-cell-output";
    if (this.output.messages.length === 0) {
      div.classList.add("cm-lean-cell-output--empty");
      return this.registerMeasured(div, view);
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
    return this.registerMeasured(div, view);
  }

  ignoreEvent(): boolean { return true; }
}

// ---------------------------------------------------------------------------
// Main ViewPlugin
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 400;
const GOAL_DEBOUNCE_MS = 420;
const LSP_VISUAL_IDLE_MS = 420;

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
  private goalSeq = 0;
  private lspVersion = 0;
  private syncedNotePath = "";
  private openLeanPath = "";
  private visualTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingDiagnostics: { uri: string; raw: LspDiagnostic[] } | null = null;
  private pendingProgress: { uri: string; raw: LspFileProgressItem[] } | null = null;
  private pendingSemanticTokens: { uri: string; legend: unknown; data: number[] } | null = null;
  private lastDiagnosticsSig = "";
  private lastProgressSig = "";
  private lastSemanticTokensSig = "";

  constructor(view: EditorView) {
    this.view = view;
    this.decorations = this.buildDecorations();
    this.setupPushListeners();
    this.syncToLean();
  }

  setupPushListeners(): void {
    this.unsubDiag = api.lean.onDiagnostics((data) => {
      const splice = this.view.state.field(leanSpliceField, false);
      if (!splice) return;
      const expectedUris = new Set([fileUri(splice.leanPath), this.openLeanPath ? fileUri(this.openLeanPath) : ""]);
      if (!data.uri || !expectedUris.has(data.uri)) return;
      if (typeof data.version === "number") {
        if (this.lspVersion > 0 && data.version < this.lspVersion) return;
        this.lspVersion = data.version;
      }
      const rawDiags = data.diagnostics ?? [];
      const sig = this.diagnosticsSignature(rawDiags);
      if (sig === this.lastDiagnosticsSig) return;
      this.pendingDiagnostics = { uri: data.uri, raw: rawDiags };
      this.scheduleVisualFlush();
    });

    this.unsubProgress = api.lean.onProgress((data) => {
      const splice = this.view.state.field(leanSpliceField, false);
      if (!splice) return;
      const expectedUris = new Set([fileUri(splice.leanPath), this.openLeanPath ? fileUri(this.openLeanPath) : ""]);
      if (!data.uri || !expectedUris.has(data.uri)) return;
      if (typeof data.version === "number") {
        if (this.lspVersion > 0 && data.version < this.lspVersion) return;
        this.lspVersion = data.version;
      }
      const rawProgress = data.processing ?? [];
      const sig = this.progressSignature(rawProgress);
      if (sig === this.lastProgressSig) return;
      this.pendingProgress = { uri: data.uri, raw: rawProgress };
      this.scheduleVisualFlush();
    });

    this.unsubSemanticTokens = api.lean.onSemanticTokens((data) => {
      const splice = this.view.state.field(leanSpliceField, false);
      if (!splice) return;
      const expectedUris = new Set([fileUri(splice.leanPath), this.openLeanPath ? fileUri(this.openLeanPath) : ""]);
      if (!data.uri || !expectedUris.has(data.uri)) return;
      const tokenData = data.data ?? [];
      const sig = this.semanticTokensSignature(tokenData);
      if (sig === this.lastSemanticTokensSig) return;
      this.pendingSemanticTokens = { uri: data.uri, legend: data.legend, data: tokenData };
      this.scheduleVisualFlush();
    });

    this.unsubStatus = api.lean.onStatus((_data) => {
      // Status updates are handled by the panel; nothing to do in the editor.
    });
  }

  diagnosticsSignature(rawDiags: LspDiagnostic[]): string {
    return rawDiags.map((diag) => {
      const start = diag.range?.start ?? {};
      const end = diag.range?.end ?? {};
      return `${start.line ?? 0}:${start.character ?? 0}:${end.line ?? 0}:${end.character ?? 0}:${diag.severity ?? 0}:${diag.message ?? ""}`;
    }).join("\n");
  }

  progressSignature(rawProgress: LspFileProgressItem[]): string {
    return rawProgress.map((progress) => {
      const start = progress.range?.start ?? {};
      const end = progress.range?.end ?? {};
      return `${start.line ?? 0}:${start.character ?? 0}:${end.line ?? 0}:${end.character ?? 0}:${progress.kind ?? 0}`;
    }).join("\n");
  }

  semanticTokensSignature(data: number[]): string {
    return `${data.length}:${String(data[0] ?? "")}:${String(data.at(-1) ?? "")}`;
  }

  scheduleVisualFlush(): void {
    if (this.visualTimer) clearTimeout(this.visualTimer);
    this.visualTimer = setTimeout(() => {
      this.visualTimer = null;
      this.flushVisualState();
    }, LSP_VISUAL_IDLE_MS);
  }

  flushVisualState(): void {
    const splice = this.view.state.field(leanSpliceField, false);
    if (!splice) return;
    const expectedUris = new Set([fileUri(splice.leanPath), this.openLeanPath ? fileUri(this.openLeanPath) : ""]);
    const effects: StateEffect<unknown>[] = [];
    if (this.pendingDiagnostics && expectedUris.has(this.pendingDiagnostics.uri)) {
      this.lastDiagnosticsSig = this.diagnosticsSignature(this.pendingDiagnostics.raw);
      effects.push(SetDiagnosticsEffect.of({ splice, rawDiags: this.pendingDiagnostics.raw }));
    }
    if (this.pendingProgress && expectedUris.has(this.pendingProgress.uri)) {
      this.lastProgressSig = this.progressSignature(this.pendingProgress.raw);
      effects.push(SetProgressEffect.of({ splice, rawProgress: this.pendingProgress.raw }));
    }
    if (this.pendingSemanticTokens && expectedUris.has(this.pendingSemanticTokens.uri)) {
      this.lastSemanticTokensSig = this.semanticTokensSignature(this.pendingSemanticTokens.data);
      effects.push(SetSemanticTokensEffect.of({
        splice,
        legend: this.pendingSemanticTokens.legend,
        data: this.pendingSemanticTokens.data,
      }));
    }
    this.pendingDiagnostics = null;
    this.pendingProgress = null;
    this.pendingSemanticTokens = null;
    if (effects.length > 0) this.view.dispatch({ effects });
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
        const isLeanFile = getNoteInfo(update.view)?.notePath.toLowerCase().endsWith(".lean") ?? false;
        if (isLeanFile || isCursorInLean4Block(update.view.state)) {
          this.goalTimer = setTimeout(() => {
            this.goalTimer = null;
            void this.queryGoals();
          }, GOAL_DEBOUNCE_MS);
        } else {
          // Clear goals immediately when cursor leaves a lean4 block
          this.goalSeq++;
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
    // Lean integration is owned by @@lean4 region widgets for markdown and by
    // the full-file Lean child editor for .lean files.
    this.syncSeq++;
    if (currentSplice !== null) this.view.dispatch({ effects: SetSpliceEffect.of(null) });
    if (this.isOpen) this.closeLean();
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
      const response = result as { ok?: boolean; leanPath?: string; message?: string; lspVersion?: number } | null;
      if (response?.ok === false) throw new Error(response.message || "Lean sync failed");
      if (typeof response?.lspVersion === "number") this.lspVersion = response.lspVersion;
      this.isOpen = true;
      this.openLeanPath = response?.leanPath || splice.leanPath;
    } catch (err) {
      if (seq !== this.syncSeq) return;
      this.isOpen = false;
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
    this.lspVersion = 0;
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
    const seq = ++this.goalSeq;

    const [goalsRes, termRes] = await Promise.all([
      api.lean.getGoals({ leanPath: splice.leanPath, line: leanPos.line, character: leanPos.character }),
      api.lean.getTermGoal({ leanPath: splice.leanPath, line: leanPos.line, character: leanPos.character }),
    ]);
    if (seq !== this.goalSeq) return;
    const goals = (goalsRes as { result?: { rendered?: string } } | null)?.result?.rendered ?? null;
    const termGoal = (termRes as { result?: { rendered?: string } } | null)?.result?.rendered ?? null;
    this.view.dispatch({
      effects: SetGoalEffect.of({ goals, termGoal, blockIndex: blockIndex >= 0 ? blockIndex : null }),
    });
  }

  destroy(): void {
    if (this.changeTimer) clearTimeout(this.changeTimer);
    if (this.goalTimer) clearTimeout(this.goalTimer);
    if (this.visualTimer) clearTimeout(this.visualTimer);
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

  return {
    pos,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-lean-hover-tooltip";
      renderLeanMarkdown(dom, raw);
      return { dom };
    },
  };
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const leanExtension: Extension = [
  lean4OrgEnvBlocksField,
  leanNoteInfoField,
  leanSpliceField,
  leanDiagnosticsField,
  leanProgressField,
  leanSemanticTokensField,
  leanGoalField,
  leanCellOutputField,
  leanBlockViewPlugin,
  leanHoverTooltip,
];
