/**
 * Phase 3 — Math widgets for the CM6 kernel.
 *
 * CM6 constraint: block decorations (block:true) may NOT come from ViewPlugin —
 * they must be provided by a StateField via EditorView.decorations facet.
 *
 * Split strategy:
 *   mathBlockField   — StateField, processes full doc for $$…$$
 *   MathInlinePlugin — ViewPlugin (viewport-only), processes $…$ inline
 *
 * Both are bundled into `mathExtension = [mathBlockField, mathInlineExtension]`.
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { StateField, type ChangeSet, type EditorState } from "@codemirror/state";
import type { Range } from "@codemirror/state";
import { INLINE_MATH_RE, isLikelyInlineMath } from "../../inline-math.ts";
import { renderMathHTML } from "../../math-render.ts";
import { getBlockMathRanges, rangeOverlapsAny } from "../math-ranges.ts";
import { orgEnvContextForRange, type OrgEnvContext } from "./block-extras.ts";

function setSourceRange(el: HTMLElement, from: number, to: number, openSource = false): void {
  el.dataset.cmSourceFrom = String(from);
  el.dataset.cmSourceTo = String(to);
  if (openSource) el.dataset.cmOpenSource = "true";
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

function selectionTouchesRange(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((sel) => {
    if (sel.empty) return sel.from >= from && sel.from <= to;
    return sel.from < to && sel.to > from;
  });
}

function addActiveBlockSourceLineDecos(
  decos: Range<Decoration>[],
  state: EditorState,
  from: number,
  to: number,
): void {
  const doc = state.doc;
  const firstLine = doc.lineAt(from).number;
  const lastLine = doc.lineAt(to).number;
  for (let lineNum = firstLine; lineNum <= lastLine; lineNum++) {
    const line = doc.line(lineNum);
    decos.push(
      Decoration.line({ attributes: { class: "cm-math-source-line" } }).range(line.from),
    );
  }
}

// ---------------------------------------------------------------------------
// Widget classes
// ---------------------------------------------------------------------------

class InlineMathWidget extends WidgetType {
  tex: string;
  from: number;
  to: number;

  constructor(tex: string, from: number, to: number) {
    super();
    this.tex = tex;
    this.from = from;
    this.to = to;
  }

  eq(other: InlineMathWidget): boolean {
    return this.tex === other.tex && this.from === other.from && this.to === other.to;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-math-inline";
    setSourceRange(span, this.from, this.to, true);
    const { html, error } = renderMathHTML(this.tex, { displayMode: false });
    if (error) { span.classList.add("cm-math-error"); span.textContent = `$${this.tex}$`; }
    else span.innerHTML = html;
    return span;
  }

  ignoreEvent(): boolean { return false; }
}

class BlockMathWidget extends WidgetType {
  tex: string;
  from: number;
  to: number;
  orgEnv: OrgEnvContext | null;

  constructor(tex: string, from: number, to: number, orgEnv: OrgEnvContext | null) {
    super();
    this.tex = tex;
    this.from = from;
    this.to = to;
    this.orgEnv = orgEnv;
  }

  eq(other: BlockMathWidget): boolean {
    return this.tex === other.tex
      && this.from === other.from
      && this.to === other.to
      && this.orgEnv?.kind === other.orgEnv?.kind
      && this.orgEnv?.depth === other.orgEnv?.depth;
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-math-block";
    setSourceRange(div, this.from, this.to);
    div.dataset.cmMathBlock = "true";
    if (this.orgEnv) {
      div.dataset.orgEnvKind = this.orgEnv.kind;
      div.dataset.orgEnvDepth = String(this.orgEnv.depth);
      div.style.setProperty("--org-env-depth", String(this.orgEnv.depth));
    }
    const { html, error } = renderMathHTML(this.tex, { displayMode: true });
    if (error) { div.classList.add("cm-math-error"); div.textContent = `$$\n${this.tex}\n$$`; }
    else div.innerHTML = html;
    return div;
  }

  ignoreEvent(): boolean { return false; }
}

// ---------------------------------------------------------------------------
// Block math — StateField (full-doc scan, allows block:true decorations)
// ---------------------------------------------------------------------------

function buildBlockMathDecoRanges(
  state: EditorState,
  from = 0,
  to = state.doc.length,
): Range<Decoration>[] {
  const decos: Range<Decoration>[] = [];

  for (const range of getBlockMathRanges(state)) {
    if (range.to < from || range.from > to) continue;
    const tex = range.tex;
    const cursorInside = selectionTouchesRange(state, range.from, range.to);
    if (!cursorInside) {
      decos.push(
        Decoration.replace({
          widget: new BlockMathWidget(tex, range.from, range.to, orgEnvContextForRange(state, range.from, range.to)),
          block: true,
        }).range(range.from, range.to),
      );
      continue;
    }
    addActiveBlockSourceLineDecos(decos, state, range.from, range.to);
    // Cursor is inside $$…$$: show source with $$ syntax-hints only.
    const raw = state.doc.sliceString(range.from, range.to);
    const open = raw.indexOf("$$");
    const close = raw.lastIndexOf("$$");
    if (open >= 0) {
      decos.push(Decoration.mark({ class: "syntax-hint" }).range(range.from + open, range.from + open + 2));
    }
    if (close >= 0 && close + 2 <= raw.length) {
      decos.push(Decoration.mark({ class: "syntax-hint" }).range(range.from + close, range.from + close + 2));
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return decos;
}

function buildBlockMathDecos(state: EditorState): DecorationSet {
  return Decoration.set(buildBlockMathDecoRanges(state), true);
}

function activeBlockMathKey(state: EditorState): string {
  for (const range of getBlockMathRanges(state)) {
    if (selectionTouchesRange(state, range.from, range.to)) return `${range.from}:${range.to}`;
  }
  return "";
}

function rangeFromKey(key: string): { from: number; to: number } | null {
  const [from, to] = key.split(":").map((part) => Number(part));
  return Number.isFinite(from) && Number.isFinite(to) && from <= to ? { from, to } : null;
}

function blockMathWindow(state: EditorState, from: number, to: number): { from: number; to: number } {
  const start = state.doc.lineAt(Math.max(0, Math.min(from, state.doc.length))).from;
  const end = state.doc.lineAt(Math.max(0, Math.min(to, state.doc.length))).to;
  return { from: start, to: end };
}

function mergeWindows(windows: Array<{ from: number; to: number }>): Array<{ from: number; to: number }> {
  const sorted = windows
    .filter((range) => range.from <= range.to)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: Array<{ from: number; to: number }> = [];
  for (const range of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && range.from <= prev.to) {
      prev.to = Math.max(prev.to, range.to);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function patchBlockMathDecosForSelectionChange(
  state: EditorState,
  current: DecorationSet,
  oldKey: string,
  newKey: string,
): DecorationSet {
  const windows = mergeWindows([oldKey, newKey]
    .map(rangeFromKey)
    .filter((range): range is { from: number; to: number } => Boolean(range))
    .map((range) => blockMathWindow(state, range.from, range.to)));
  if (windows.length === 0) return current;

  let next = current;
  const add: Range<Decoration>[] = [];
  for (const range of windows) {
    next = next.update({ filterFrom: range.from, filterTo: range.to, filter: () => false });
    add.push(...buildBlockMathDecoRanges(state, range.from, range.to));
  }
  return next.update({ add, sort: true });
}

const mathBlockField = StateField.define<DecorationSet>({
  create: (state) => buildBlockMathDecos(state),
  update(value, tr) {
    if (tr.docChanged) {
      const ranges = getBlockMathRanges(tr.startState);
      if (canMapBlockMathDecorations(tr.startState, ranges, tr.changes)) return value.map(tr.changes);
      if (canPatchBlockMathDecorations(tr.startState, ranges, tr.changes)) {
        return patchBlockMathDecosNearChanges(tr.state, value.map(tr.changes), ranges, tr.changes);
      }
      return buildBlockMathDecos(tr.state);
    }
    if (tr.selection != null) {
      const oldKey = activeBlockMathKey(tr.startState);
      const newKey = activeBlockMathKey(tr.state);
      if (oldKey !== newKey) return patchBlockMathDecosForSelectionChange(tr.state, value, oldKey, newKey);
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function canMapBlockMathDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
  changes: ChangeSet,
): boolean {
  let canMap = true;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!canMap) return;
    const removed = state.doc.sliceString(fromA, toA);
    const added = inserted.toString();
    if (removed.includes("$$") || added.includes("$$")) {
      canMap = false;
      return;
    }
    if (ranges.some((range) => fromA <= range.to && toA >= range.from)) {
      canMap = false;
    }
  });
  return canMap;
}

function canPatchBlockMathDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
  changes: ChangeSet,
): boolean {
  let canPatch = true;
  let touchedBlock = false;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!canPatch) return;
    const removed = state.doc.sliceString(fromA, toA);
    const added = inserted.toString();
    if (removed.includes("$$") || added.includes("$$")) {
      canPatch = false;
      return;
    }
    if (ranges.some((range) => fromA <= range.to && toA >= range.from)) touchedBlock = true;
  });
  return canPatch && touchedBlock;
}

function patchBlockMathDecosNearChanges(
  state: EditorState,
  mapped: DecorationSet,
  oldRanges: readonly { from: number; to: number }[],
  changes: ChangeSet,
): DecorationSet {
  let from = Number.POSITIVE_INFINITY;
  let to = 0;
  changes.iterChanges((fromA, toA) => {
    for (const range of oldRanges) {
      if (fromA > range.to || toA < range.from) continue;
      from = Math.min(from, changes.mapPos(range.from, -1));
      to = Math.max(to, changes.mapPos(range.to, 1));
    }
  });
  if (!Number.isFinite(from)) return mapped;
  for (const range of getBlockMathRanges(state)) {
    if (range.from > to || range.to < from) continue;
    from = Math.min(from, range.from);
    to = Math.max(to, range.to);
  }
  return mapped
    .update({ filterFrom: from, filterTo: to, filter: () => false })
    .update({ add: buildBlockMathDecoRanges(state, from, to), sort: true });
}

// ---------------------------------------------------------------------------
// Inline math — ViewPlugin (viewport-optimized, no block decorations)
// ---------------------------------------------------------------------------

function buildInlineMathDecos(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const sel = view.state.selection.main;
  const doc = view.state.doc;
  const blockRanges = getBlockMathRanges(view.state);

  for (const { from: vFrom, to: vTo } of view.visibleRanges) {
    const text = doc.sliceString(vFrom, vTo);

    INLINE_MATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE_MATH_RE.exec(text)) !== null) {
      const from = vFrom + m.index;
      const to = vFrom + m.index + m[0].length;
      const tex = m[1]!;

      if (rangeOverlapsAny(from, to, blockRanges)) continue;
      if (!isLikelyInlineMath(tex)) continue;

      const cursorInside = sel.from < to && sel.to > from;
      if (!cursorInside) {
        decos.push(Decoration.replace({ widget: new InlineMathWidget(tex, from, to) }).range(from, to));
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decos, true);
}

class MathInlinePlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) { this.decorations = buildInlineMathDecos(view); }

  update(update: ViewUpdate): void {
    if (update.view.compositionStarted && update.selectionSet && !update.docChanged && !update.viewportChanged) return;
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildInlineMathDecos(update.view);
    }
  }
}

const mathInlineExtension = ViewPlugin.fromClass(MathInlinePlugin, {
  decorations: (v) => v.decorations,
});

// ---------------------------------------------------------------------------
// Public export — both parts together
// ---------------------------------------------------------------------------

export const mathExtension = [mathBlockField, mathInlineExtension];
