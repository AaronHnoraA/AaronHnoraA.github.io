/**
 * Phase 4 — Fenced code block widget for the CM6 kernel.
 *
 * CM6 constraint: block decorations must come from StateField, not ViewPlugin.
 *
 * Split strategy:
 *   FencedCodePlugin (ViewPlugin) — fence fold, lang badge, syntax highlight.
 *                                    Skips mermaid blocks entirely.
 *   mermaidField     (StateField) — mermaid replace/preview (block:true).
 *
 * Both exported together as `fencedCodeExtension = [mermaidField, fencedCodeViewPlugin]`.
 *
 * Lezer FencedCode child nodes:
 *   CodeInfo  — the language tag on the opening fence line
 *   CodeText  — the code body between the two fence lines
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { StateField, type ChangeSet, type EditorState, type Text } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { highlightCodeForEditor, onCodeHighlightReady } from "../../code-highlight-async.ts";
import { supportedDiagramLang } from "../../diagram-langs.ts";
import { getBlockMathRanges, rangeInsideAny, rangeOverlapsAny } from "../math-ranges.ts";

function setSourceRange(el: HTMLElement, from: number, to: number): void {
  el.dataset.cmSourceFrom = String(from);
  el.dataset.cmSourceTo = String(to);
}

// ---------------------------------------------------------------------------
// Lang badge widget
// ---------------------------------------------------------------------------

class LangBadgeWidget extends WidgetType {
  lang: string;

  constructor(lang: string) { super(); this.lang = lang; }

  eq(other: LangBadgeWidget): boolean { return this.lang === other.lang; }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-code-lang-badge";
    span.textContent = this.lang;
    return span;
  }

  ignoreEvent(): boolean { return false; }
}

class CodeCopyButtonWidget extends WidgetType {
  source: string;

  constructor(source: string) {
    super();
    this.source = source;
  }

  eq(other: CodeCopyButtonWidget): boolean {
    return this.source === other.source;
  }

  toDOM(): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-code-copy-button";
    button.textContent = "Copy";
    button.title = "Copy code";
    button.setAttribute("aria-label", "Copy code");
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void copyText(this.source).then((ok) => {
        if (!button.isConnected) return;
        button.textContent = ok ? "Copied" : "Copy";
        if (ok) window.setTimeout(() => {
          if (button.isConnected) button.textContent = "Copy";
        }, 1100);
      });
    });
    return button;
  }

  ignoreEvent(): boolean { return true; }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mermaid widgets
// ---------------------------------------------------------------------------

class MermaidWidget extends WidgetType {
  source: string;
  from: number;
  to: number;

  constructor(source: string, from: number, to: number) {
    super();
    this.source = source;
    this.from = from;
    this.to = to;
  }

  eq(other: MermaidWidget): boolean {
    return this.source === other.source && this.from === other.from && this.to === other.to;
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-mermaid-block";
    setSourceRange(div, this.from, this.to);
    renderMermaidWidget(this.source, div);
    return div;
  }

  ignoreEvent(): boolean { return false; }
}

class MermaidPreviewWidget extends WidgetType {
  source: string;

  constructor(source: string) { super(); this.source = source; }

  eq(other: MermaidPreviewWidget): boolean { return this.source === other.source; }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-mermaid-block-preview";
    renderMermaidWidget(this.source, div);
    return div;
  }

  ignoreEvent(): boolean { return true; }
}

function renderMermaidWidget(source: string, div: HTMLElement): void {
  const key = `mermaid\n${source.trim()}`;
  div.dataset.diagramRenderKey = key;
  div.textContent = "Loading diagram renderer...";
  void import("../../diagram-render.ts")
    .then(({ renderMermaidLazy }) => {
      if (div.dataset.diagramRenderKey !== key) return;
      renderMermaidLazy(source, div, (err) => {
        div.classList.add("cm-diagram-error");
        div.textContent = err;
      });
    })
    .catch((err: unknown) => {
      if (div.dataset.diagramRenderKey !== key) return;
      div.classList.add("cm-diagram-error");
      div.textContent = err instanceof Error ? err.message : String(err);
    });
}

// ---------------------------------------------------------------------------
// Mermaid — StateField (full-doc Lezer scan, allows block:true)
// ---------------------------------------------------------------------------

interface MermaidBlock {
  from: number;
  to: number;
  sourceFrom: number;
  sourceTo: number;
  source: string;
}

function collectMermaidBlocks(state: EditorState): readonly MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const doc = state.doc;
  const blockMathRanges = getBlockMathRanges(state);

  syntaxTree(state).iterate({
    enter(node) {
      if (rangeInsideAny(node.from, node.to, blockMathRanges)) return false;
      if (node.name !== "FencedCode") return;
      if (rangeOverlapsAny(node.from, node.to, blockMathRanges)) return false;

      const infoNode = node.node.getChild("CodeInfo");
      const textNode = node.node.getChild("CodeText");
      const lang = infoNode ? doc.sliceString(infoNode.from, infoNode.to).trim() : "";

      if (!supportedDiagramLang(lang)) return; // handled by ViewPlugin

      blocks.push({
        from: node.from,
        to: node.to,
        sourceFrom: textNode ? textNode.from : node.to,
        sourceTo: textNode ? textNode.to : node.to,
        source: textNode ? doc.sliceString(textNode.from, textNode.to) : "",
      });
      return false; // skip children
    },
  });
  return blocks;
}

const mermaidBlocksField = StateField.define<readonly MermaidBlock[]>({
  create: collectMermaidBlocks,
  update(blocks, tr) {
    if (tr.docChanged) {
      return canMapMermaidBlocks(tr.startState.doc, blocks, tr.changes)
        ? blocks.map((block) => mapMermaidBlock(block, tr.changes, tr.state.doc))
        : collectMermaidBlocks(tr.state);
    }
    return blocks;
  },
});

function mapMermaidBlock(block: MermaidBlock, changes: ChangeSet, doc: Text): MermaidBlock {
  const sourceFrom = changes.mapPos(block.sourceFrom, -1);
  const sourceTo = changes.mapPos(block.sourceTo, 1);
  return {
    ...block,
    from: changes.mapPos(block.from, -1),
    to: changes.mapPos(block.to, 1),
    sourceFrom,
    sourceTo,
    source: doc.sliceString(sourceFrom, sourceTo),
  };
}

function canMapMermaidBlocks(
  doc: Text,
  blocks: readonly MermaidBlock[],
  changes: ChangeSet,
): boolean {
  let canMap = true;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!canMap) return;
    const removed = doc.sliceString(fromA, toA);
    const added = inserted.toString();
    if (/[`~\n]/.test(removed) || /[`~\n]/.test(added)) {
      canMap = false;
      return;
    }
    const touched = blocks.find((block) => fromA <= block.to && toA >= block.from);
    if (touched && (fromA < touched.sourceFrom || toA > touched.sourceTo)) {
      canMap = false;
    }
  });
  return canMap;
}

function changesTouchMermaidSource(blocks: readonly MermaidBlock[], changes: ChangeSet): boolean {
  let touches = false;
  changes.iterChanges((fromA, toA) => {
    if (touches) return;
    touches = blocks.some((block) => fromA <= block.sourceTo && toA >= block.sourceFrom);
  });
  return touches;
}

function buildMermaidDecoRanges(
  state: EditorState,
  from = 0,
  to = state.doc.length,
): Range<Decoration>[] {
  const decos: Range<Decoration>[] = [];
  const sel = state.selection.main;
  const blocks = state.field(mermaidBlocksField, false) ?? collectMermaidBlocks(state);

  for (const block of blocks) {
    if (block.to < from || block.from > to) continue;
    const cursorInBlock = sel.from < block.to && sel.to > block.from;
    if (!cursorInBlock) {
      decos.push(
        Decoration.replace({
          widget: new MermaidWidget(block.source, block.from, block.to),
          block: true,
        }).range(block.from, block.to),
      );
    } else {
      decos.push(
        Decoration.widget({
          widget: new MermaidPreviewWidget(block.source),
          block: true,
          side: 1,
        }).range(block.to),
      );
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return decos;
}

function buildMermaidDecos(state: EditorState): DecorationSet {
  return Decoration.set(buildMermaidDecoRanges(state), true);
}

function activeMermaidBlockKey(state: EditorState): string {
  const sel = state.selection.main;
  const blocks = state.field(mermaidBlocksField, false) ?? collectMermaidBlocks(state);
  for (const block of blocks) {
    if (sel.from < block.to && sel.to > block.from) return `${block.from}:${block.to}`;
  }
  return "";
}

function mermaidRangeFromKey(key: string): { from: number; to: number } | null {
  const [from, to] = key.split(":").map((part) => Number(part));
  return Number.isFinite(from) && Number.isFinite(to) && from <= to ? { from, to } : null;
}

function mergeMermaidWindows(windows: Array<{ from: number; to: number }>): Array<{ from: number; to: number }> {
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

function patchMermaidDecosForSelectionChange(
  state: EditorState,
  current: DecorationSet,
  oldKey: string,
  newKey: string,
): DecorationSet {
  const windows = mergeMermaidWindows([oldKey, newKey]
    .map(mermaidRangeFromKey)
    .filter((range): range is { from: number; to: number } => Boolean(range)));
  if (windows.length === 0) return current;

  let next = current;
  const add: Range<Decoration>[] = [];
  for (const range of windows) {
    next = next.update({ filterFrom: range.from, filterTo: range.to, filter: () => false });
    add.push(...buildMermaidDecoRanges(state, range.from, range.to));
  }
  return next.update({ add, sort: true });
}

const mermaidField = StateField.define<DecorationSet>({
  create: (state) => buildMermaidDecos(state),
  update(value, tr) {
    if (tr.docChanged) {
      const blocks = tr.startState.field(mermaidBlocksField, false) ?? collectMermaidBlocks(tr.startState);
      if (canMapMermaidBlocks(tr.startState.doc, blocks, tr.changes)) {
        return changesTouchMermaidSource(blocks, tr.changes)
          ? patchMermaidDecosNearChanges(tr.state, value.map(tr.changes), blocks, tr.changes)
          : value.map(tr.changes);
      }
      return buildMermaidDecos(tr.state);
    }
    if (tr.selection != null) {
      const oldKey = activeMermaidBlockKey(tr.startState);
      const newKey = activeMermaidBlockKey(tr.state);
      if (oldKey !== newKey) return patchMermaidDecosForSelectionChange(tr.state, value, oldKey, newKey);
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function patchMermaidDecosNearChanges(
  state: EditorState,
  mapped: DecorationSet,
  oldBlocks: readonly MermaidBlock[],
  changes: ChangeSet,
): DecorationSet {
  let from = Number.POSITIVE_INFINITY;
  let to = 0;
  changes.iterChanges((fromA, toA) => {
    for (const block of oldBlocks) {
      if (fromA > block.sourceTo || toA < block.sourceFrom) continue;
      from = Math.min(from, changes.mapPos(block.from, -1));
      to = Math.max(to, changes.mapPos(block.to, 1));
    }
  });
  if (!Number.isFinite(from)) return mapped;
  const blocks = state.field(mermaidBlocksField, false) ?? collectMermaidBlocks(state);
  for (const block of blocks) {
    if (block.from > to || block.to < from) continue;
    from = Math.min(from, block.from);
    to = Math.max(to, block.to);
  }
  return mapped
    .update({ filterFrom: from, filterTo: to, filter: () => false })
    .update({ add: buildMermaidDecoRanges(state, from, to), sort: true });
}

// ---------------------------------------------------------------------------
// Fenced code — ViewPlugin (viewport-only, inline marks + lang badge only)
// ---------------------------------------------------------------------------

function buildFencedCodeDecos(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const sel = view.state.selection.main;
  const doc = view.state.doc;
  const cursorLine = doc.lineAt(sel.from).number;
  const blockMathRanges = getBlockMathRanges(view.state);

  for (const { from: vFrom, to: vTo } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: vFrom,
      to: vTo,
      enter(node) {
        if (rangeInsideAny(node.from, node.to, blockMathRanges)) return false;
        if (node.name !== "FencedCode") return;
        if (rangeOverlapsAny(node.from, node.to, blockMathRanges)) return false;

        const infoNode = node.node.getChild("CodeInfo");
        const textNode = node.node.getChild("CodeText");

        const lang = infoNode
          ? doc.sliceString(infoNode.from, infoNode.to).trim()
          : "";

        // Mermaid is handled by the StateField above — skip here
        if (supportedDiagramLang(lang)) return false;

        const codeBody = textNode
          ? doc.sliceString(textNode.from, textNode.to)
          : "";

        const openFenceLine = doc.lineAt(node.from);
        const openFenceLineNum = openFenceLine.number;
        const closeFenceLine = node.to > openFenceLine.to
          ? doc.lineAt(node.to - 1)
          : openFenceLine;
        const closeFenceLineNum = closeFenceLine.number;

        // Opening fence fold
        const onOpenFence = cursorLine === openFenceLineNum;
        const fenceMarkEnd = infoNode ? infoNode.from : openFenceLine.to;
        pushMark(decos, openFenceLine.from, fenceMarkEnd, onOpenFence ? "syntax-hint" : "syntax-hidden");

        // Lang badge
        if (lang) {
          decos.push(
            Decoration.widget({ widget: new LangBadgeWidget(lang), side: 1 }).range(fenceMarkEnd),
          );
        }
        if (textNode) {
          decos.push(
            Decoration.widget({ widget: new CodeCopyButtonWidget(codeBody), side: 2 }).range(fenceMarkEnd),
          );
        }

        // Hide lang text when not on opening fence
        if (infoNode) {
          pushMark(decos, infoNode.from, infoNode.to, onOpenFence ? "syntax-hint" : "syntax-hidden");
        }

        // Closing fence fold
        if (closeFenceLine.number !== openFenceLine.number) {
          const onCloseFence = cursorLine === closeFenceLineNum;
          pushMark(decos, closeFenceLine.from, closeFenceLine.to, onCloseFence ? "syntax-hint" : "syntax-hidden");
        }

        // Syntax highlighting
        if (textNode && lang && codeBody) {
          const ranges = highlightCodeForEditor(lang, codeBody);
          for (const r of ranges) {
            const from = textNode.from + r.from;
            const to = textNode.from + r.to;
            if (from < to) {
              decos.push(Decoration.mark({ class: r.className }).range(from, to));
            }
          }
        }

        return false;
      },
    });
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decos, true);
}

function pushMark(
  decos: Range<Decoration>[],
  from: number,
  to: number,
  cls: string,
): void {
  if (from >= to) return;
  decos.push(Decoration.mark({ class: cls }).range(from, to));
}

class FencedCodePlugin {
  decorations: DecorationSet;
  private readonly view: EditorView;
  private readonly unsubscribeHighlightReady: () => void;

  constructor(view: EditorView) {
    this.view = view;
    this.decorations = buildFencedCodeDecos(view);
    this.unsubscribeHighlightReady = onCodeHighlightReady(() => {
      if (!this.view.dom.isConnected) return;
      this.decorations = buildFencedCodeDecos(this.view);
      this.view.dispatch({});
    });
  }

  update(update: ViewUpdate): void {
    if (update.view.compositionStarted && update.selectionSet && !update.docChanged && !update.viewportChanged) return;
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildFencedCodeDecos(update.view);
    }
  }

  destroy(): void {
    this.unsubscribeHighlightReady();
  }
}

const fencedCodeViewPlugin = ViewPlugin.fromClass(FencedCodePlugin, {
  decorations: (v) => v.decorations,
});

// ---------------------------------------------------------------------------
// Public export — both parts together
// ---------------------------------------------------------------------------

export const fencedCodeExtension = [mermaidBlocksField, mermaidField, fencedCodeViewPlugin];
