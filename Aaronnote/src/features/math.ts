import type { Node as PMNode, Schema } from "prosemirror-model";
import { TextSelection, type Command, type EditorState, Plugin, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView, type NodeView, type ViewMutationRecord } from "prosemirror-view";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";

import { markConsumed, markExtRanges, type InlineSpan } from "../inline-parse.ts";
import { renderMathLazy } from "../math-render.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";

function countBackslashesBefore(src: string, pos: number): number {
  let count = 0;
  for (let i = pos - 1; i >= 0 && src.charCodeAt(i) === 0x5c; i--) count++;
  return count;
}

function escaped(src: string, pos: number): boolean {
  return countBackslashesBefore(src, pos) % 2 === 1;
}

function adjacentDollar(text: string, pos: number): boolean {
  return text[pos - 1] === "$" || text[pos + 1] === "$";
}

type InlineMathMatch = {
  rawTex: string;
  tex: string;
  openFrom: number;
  openTo: number;
  closeFrom: number;
  closeTo: number;
};

function readInlineMathAt(text: string, pos: number): InlineMathMatch | null {
  if (text[pos] !== "$" || escaped(text, pos)) return null;
  if (text[pos + 1] === "$") return null;
  if (adjacentDollar(text, pos)) return null;
  const openFrom = pos;
  const openTo = openFrom + 1;
  let closeFrom = -1;

  for (let j = openTo; j < text.length; j++) {
    if (text[j] === "\n") break;
    if (text[j] !== "$" || escaped(text, j) || adjacentDollar(text, j)) continue;
    closeFrom = j;
    break;
  }

  if (closeFrom < 0) return null;
  const closeTo = closeFrom + 1;
  const rawTex = text.slice(openTo, closeFrom);
  const tex = rawTex.trim();
  if (tex.length === 0) return null;
  return {
    rawTex,
    tex,
    openFrom,
    openTo,
    closeFrom,
    closeTo,
  };
}

function scanInlineMath(text: string, consumed: Uint8Array): InlineSpan[] {
  const out: InlineSpan[] = [];
  for (let i = 0; i < text.length; i++) {
    if (consumed[i]) continue;
    const match = readInlineMathAt(text, i);
    if (!match) continue;
    let blocked = false;
    for (let j = match.openFrom; j < match.closeTo; j++) {
      if (consumed[j]) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    markConsumed(consumed, match.openFrom, match.closeTo);
    out.push({
      type: "math",
      from: match.openTo,
      to: match.closeFrom,
      openFrom: match.openFrom,
      openTo: match.openTo,
      closeFrom: match.closeFrom,
      closeTo: match.closeTo,
      attrs: { tex: match.tex, delimiter: "$", display: false },
      delimRanges: [{ from: match.openFrom, to: match.closeTo, softInside: true }],
      widgetDecorations: [
        {
          pos: match.openFrom,
          when: "outside",
          kind: "math-render",
          attrs: { tex: match.tex, display: "0" },
          side: -1,
        },
      ],
    });
    i = match.closeTo - 1;
  }
  return out;
}

function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const match = readInlineMathAt(state.src, state.pos);
  if (!match || match.closeTo > state.posMax) return false;
  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = match.rawTex;
    token.markup = "$";
    token.meta = { tex: match.tex, display: false };
  }
  state.pos = match.closeTo;
  return true;
}

const DISPLAY_MATH_FENCE_RE = /^[ \t]*\$\$[ \t]*$/;

type DisplayMathDraft = {
  content: string;
  before: string;
  after: string;
  openFrom: number;
  bodyFrom: number;
  bodyTo: number;
  closeTo: number;
  afterFrom: number;
};

function findDisplayMathDraft(text: string): DisplayMathDraft | null {
  for (let lineFrom = 0; lineFrom < text.length;) {
    const lineBreak = text.indexOf("\n", lineFrom);
    const lineTo = lineBreak < 0 ? text.length : lineBreak;
    if (lineBreak >= 0 && DISPLAY_MATH_FENCE_RE.test(text.slice(lineFrom, lineTo))) {
      const bodyFrom = lineTo + 1;
      for (let closeFrom = bodyFrom; closeFrom <= text.length;) {
        const closeBreak = text.indexOf("\n", closeFrom);
        const closeTo = closeBreak < 0 ? text.length : closeBreak;
        if (DISPLAY_MATH_FENCE_RE.test(text.slice(closeFrom, closeTo))) {
          const bodyTo = closeFrom === bodyFrom ? bodyFrom : closeFrom - 1;
          const afterFrom = closeBreak < 0 ? closeTo : closeTo + 1;
          const beforeTo = lineFrom > 0 && text[lineFrom - 1] === "\n"
            ? lineFrom - 1
            : lineFrom;
          return {
            content: text.slice(bodyFrom, bodyTo),
            before: text.slice(0, beforeTo),
            after: text.slice(afterFrom),
            openFrom: lineFrom,
            bodyFrom,
            bodyTo,
            closeTo,
            afterFrom,
          };
        }
        if (closeBreak < 0) break;
        closeFrom = closeBreak + 1;
      }
    }
    if (lineBreak < 0) break;
    lineFrom = lineBreak + 1;
  }
  return null;
}

const mathBlockRule: RuleBlock = (state, startLine, endLine, silent) => {
  if (state.tShift[startLine]! > 3) return false;
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const end = state.eMarks[startLine]!;
  if (!/^\$\$\s*$/.test(state.src.slice(start, end))) return false;

  let closeLine = -1;
  for (let line = startLine + 1; line < endLine; line++) {
    if (state.tShift[line]! > 3) continue;
    const lineStart = state.bMarks[line]! + state.tShift[line]!;
    const lineEnd = state.eMarks[line]!;
    if (/^\$\$\s*$/.test(state.src.slice(lineStart, lineEnd))) {
      closeLine = line;
      break;
    }
  }
  if (closeLine < 0) return false;
  if (silent) return true;

  const content = state.getLines(startLine + 1, closeLine, state.blkIndent, false);
  const token = state.push("math_block", "math-block", 0);
  token.block = true;
  token.content = content;
  token.map = [startLine, closeLine + 1];
  state.line = closeLine + 1;
  return true;
};

function textNode(schema: Schema, text: string): PMNode[] | null {
  return text ? [schema.text(text)] : null;
}

function paragraphFromText(schema: Schema, text: string): PMNode | null {
  return text ? schema.nodes.paragraph.createChecked(null, textNode(schema, text)) : null;
}

function displayMathReplacement(schema: Schema, node: PMNode): PMNode[] | null {
  if (node.type.name !== "paragraph") return null;
  const parsed = findDisplayMathDraft(node.textContent);
  if (!parsed) return null;
  const before = paragraphFromText(schema, parsed.before);
  const block = schema.nodes.math_block.createChecked(null, textNode(schema, parsed.content));
  const after = paragraphFromText(schema, parsed.after);
  return [before, block, after].filter((child): child is PMNode => child != null);
}

function foldDisplayMathParagraphs(node: PMNode): PMNode {
  if (node.childCount === 0) return node;
  const children: PMNode[] = [];
  let changed = false;
  node.forEach((child) => {
    const replacement = displayMathReplacement(node.type.schema, child);
    if (replacement) {
      children.push(...replacement);
      changed = true;
      return;
    }
    const folded = foldDisplayMathParagraphs(child);
    if (folded !== child) changed = true;
    children.push(folded);
  });
  if (!changed) return node;
  return node.type.createAndFill(node.attrs, children, node.marks) ?? node;
}

class MathBlockView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private readonly previewDOM: HTMLElement;
  private renderKey = "";

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations: readonly Decoration[],
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("math-block");
    this.dom.setAttribute("data-aaronnote-math-block", "");
    const open = this.fence("open");
    const close = this.fence("close");
    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "math-block-source";
    this.contentDOM.spellcheck = false;

    this.previewDOM = document.createElement("div");
    this.previewDOM.className = "aaronnote-math-block math-block-render";
    this.previewDOM.setAttribute("contenteditable", "false");
    this.previewDOM.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.selectInside("open");
    });
    this.previewDOM.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    this.dom.append(open, this.contentDOM, close, this.previewDOM);
    this.applyDecorations(decorations);
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type.name !== "math_block") return false;
    this.node = node;
    this.applyDecorations(decorations);
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.previewDOM.contains(event.target);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === "selection") return false;
    return mutation.target instanceof Node && this.previewDOM.contains(mutation.target);
  }

  private fence(side: "open" | "close"): HTMLElement {
    const el = document.createElement("div");
    el.className = "math-block-fence";
    el.textContent = "$$";
    el.setAttribute("contenteditable", "false");
    el.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.selectInside(side);
    });
    return el;
  }

  private selectInside(side: "open" | "close"): void {
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    const target = side === "open" ? pos + 1 : pos + this.node.nodeSize - 1;
    this.view.dispatch(
      this.view.state.tr
        .setSelection(TextSelection.create(this.view.state.doc, target))
        .scrollIntoView(),
    );
    this.view.focus();
  }

  private applyDecorations(decorations: readonly Decoration[]): void {
    const hasCursor = decorations.some((decoration) => decoration.spec.mathBlockActive === true);
    const active = hasCursor || this.node.textContent.trim().length === 0;
    this.dom.classList.toggle("math-block-active", active);
    this.dom.classList.toggle("math-block-rendered", !active);
    if (active) return;
    this.renderPreview();
  }

  private renderPreview(): void {
    const tex = this.node.textContent.trim();
    const key = `display\n${tex}`;
    if (this.renderKey === key) return;
    this.renderKey = key;
    this.previewDOM.classList.remove("aaronnote-math-error");
    this.previewDOM.textContent = tex;
    renderMathLazy(tex, this.previewDOM, {
      displayMode: true,
      throwOnError: false,
      strict: false,
      trust: false,
      output: "html",
    }, () => {
      this.previewDOM.classList.add("aaronnote-math-error");
      this.previewDOM.textContent = `$$ ${tex} $$`;
    });
  }
}

function activeMathBlockDecoration(state: EditorState): DecorationSet {
  const range = mathBlockRangeAt(state.selection.$from) ?? mathBlockRangeAt(state.selection.$to);
  if (!range) return DecorationSet.empty;
  return DecorationSet.create(state.doc, [
    Decoration.node(range.pos, range.pos + range.node.nodeSize, {}, { mathBlockActive: true }),
  ]);
}

function mathBlockRangeAt($pos: EditorState["selection"]["$from"]): { pos: number; node: PMNode } | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "math_block") return { pos: $pos.before(depth), node };
  }
  return null;
}

function mathBlockViewPlugin(): Plugin {
  return new Plugin({
    props: {
      decorations: activeMathBlockDecoration,
      nodeViews: {
        math_block: (node, view, getPos, decorations) =>
          new MathBlockView(node, view, getPos as () => number | undefined, decorations),
      },
    },
  });
}

function changedParagraphs(
  transactions: readonly Transaction[],
  state: EditorState,
): Array<{ node: PMNode; pos: number }> {
  const hits: Array<{ node: PMNode; pos: number }> = [];
  const seen = new Set<number>();
  const docSize = state.doc.content.size;

  const addParagraph = (node: PMNode, pos: number): void => {
    if (seen.has(pos)) return;
    seen.add(pos);
    hits.push({ node, pos });
  };

  const scanRange = (from: number, to: number): void => {
    const start = Math.max(0, Math.min(from, docSize));
    const end = Math.max(start, Math.min(to, docSize));
    state.doc.nodesBetween(
      Math.max(0, start - 1),
      Math.min(docSize, end + 1),
      (node, pos) => {
        if (node.type.name !== "paragraph") return true;
        addParagraph(node, pos);
        return false;
      },
    );
  };

  for (const tr of transactions) {
    if (!tr.docChanged) continue;
    for (const map of tr.mapping.maps) {
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        scanRange(newStart, newEnd);
      });
    }
  }

  if (hits.length === 0 && state.selection.empty) {
    const $from = state.selection.$from;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name !== "paragraph") continue;
      addParagraph(node, $from.before(depth));
      break;
    }
  }

  return hits;
}

function mathBlockCommitPlugin(schema: Schema): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const mathBlockType = schema.nodes.math_block;
      const found: Array<{ from: number; to: number; parsed: DisplayMathDraft }> = [];
      for (const { node, pos } of changedParagraphs(transactions, newState)) {
        const parsed = findDisplayMathDraft(node.textContent);
        if (!parsed) continue;
        found.push({ from: pos, to: pos + node.nodeSize, parsed });
        break;
      }
      const hit = found[0];
      if (!hit) return null;

      const before = paragraphFromText(schema, hit.parsed.before);
      const block = mathBlockType.createChecked(null, textNode(schema, hit.parsed.content));
      const after = paragraphFromText(schema, hit.parsed.after);
      const replacement = [before, block, after].filter((node): node is PMNode => node != null);
      const beforeSize = before?.nodeSize ?? 0;
      const mathPos = hit.from + beforeSize;
      const afterPos = mathPos + block.nodeSize;
      const tr = newState.tr.replaceWith(hit.from, hit.to, replacement);
      const sel = newState.selection;
      if (sel.empty && sel.from >= hit.from + 1 && sel.from <= hit.to - 1) {
        const local = sel.from - (hit.from + 1);
        let target = mathPos + 1;
        if (local >= hit.parsed.bodyFrom && local <= hit.parsed.bodyTo) {
          target = mathPos + 1 + Math.min(local - hit.parsed.bodyFrom, block.content.size);
        } else if (after && local >= hit.parsed.afterFrom) {
          target = afterPos + 1 + Math.min(local - hit.parsed.afterFrom, after.content.size);
        } else if (before && local < hit.parsed.openFrom) {
          target = hit.from + 1 + Math.min(local, before.content.size);
        } else if (local >= hit.parsed.closeTo) {
          target = after ? afterPos + 1 : mathPos + block.nodeSize;
        }
        target = Math.max(0, Math.min(target, tr.doc.content.size));
        tr.setSelection(TextSelection.near(tr.doc.resolve(target), local >= hit.parsed.closeTo ? 1 : -1));
      }
      return tr.docChanged ? tr : null;
    },
  });
}

function paragraphIsMathFence(state: Parameters<Command>[0]): boolean {
  const sel = state.selection;
  if (!sel.empty) return false;
  const $from = sel.$from;
  return $from.parent.type.name === "paragraph" && $from.parent.textContent === "$$";
}

function deleteEmptyMathBlock(schema: Schema): Command {
  return (state, dispatch) => {
    const sel = state.selection;
    if (!sel.empty) return false;
    const $from = sel.$from;
    if ($from.parent.type !== schema.nodes.math_block) return false;
    if ($from.parent.content.size > 0) return false;
    if (dispatch) {
      const pos = $from.before();
      const tr = state.tr.delete(pos, pos + $from.parent.nodeSize);
      if (tr.doc.content.size === 0) {
        const paragraph = schema.nodes.paragraph.createAndFill();
        if (paragraph) tr.insert(0, paragraph);
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function exitMathBlockOneLevel(schema: Schema): Command {
  return (state, dispatch) => {
    const sel = state.selection;
    if (!sel.empty) return false;
    const $from = sel.$from;
    if ($from.parent.type !== schema.nodes.math_block) return false;
    if (dispatch) {
      const insertAt = $from.after();
      const tr = state.tr.insert(insertAt, schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export const math: FeatureSpec = {
  name: "math",

  nodes: {
    math_block: {
      group: "block",
      content: "text*",
      marks: "",
      code: true,
      defining: true,
      parseDOM: [
        {
          tag: "math-block[data-aaronnote-math-block]",
          preserveWhitespace: "full",
          contentElement: ".math-block-source",
        },
      ],
      toDOM: () => [
        "math-block",
        { "data-aaronnote-math-block": "" },
        ["div", { class: "math-block-fence", contenteditable: "false" }, "$$"],
        ["div", { class: "math-block-source" }, 0],
        ["div", { class: "math-block-fence", contenteditable: "false" }, "$$"],
      ],
    },
  },

  marks: {
    math: {
      attrs: {
        tex: { default: "" },
        delimiter: { default: "$" },
        display: { default: false },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "span[data-aaronnote-math-mark]",
          getAttrs: (el: HTMLElement) => ({
            tex: el.getAttribute("data-tex") ?? "",
            delimiter: el.getAttribute("data-delimiter") ?? "$",
            display: el.getAttribute("data-display") === "1",
          }),
        },
      ],
      toDOM: (mark) => [
        "span",
        {
          "data-aaronnote-math-mark": "",
          "data-tex": mark.attrs.tex,
          "data-delimiter": mark.attrs.delimiter,
          "data-display": mark.attrs.display ? "1" : "0",
        },
        0,
      ],
    },
  },

  mdItPlugins: [
    (md) => {
      md.block.ruler.before("lheading", "math_block", mathBlockRule, {
        alt: ["paragraph", "reference", "blockquote", "list"],
      });
      md.inline.ruler.before("escape", "math_inline", mathInlineRule);
    },
  ],

  parserTokens: {
    math_block: (state, token, schema) => {
      state.push(schema.nodes.math_block.createChecked(null, textNode(schema, token.content)));
    },
    math_inline: (state, token, schema) => {
      const delimiter = token.markup === "$$" ? "$$" : "$";
      const tex = String(token.meta?.tex ?? token.content.trim());
      const display = token.meta?.display === true;
      state.addText(delimiter);
      state.openMark(schema.marks.math.create({ tex, delimiter, display }));
      state.addText(token.content);
      state.closeMarkType(schema.marks.math);
      state.addText(delimiter);
    },
  },

  parserPostProcess: (doc) => foldDisplayMathParagraphs(doc),

  markDelims: {
    math: { open: "", close: "" },
  },

  blockHandlers: {
    math_block: (state, node) => {
      state.write("$$\n");
      state.tick("inner");
      if (node.textContent.length > 0 && state.delim && state.atBlankLine()) {
        state.out += state.delim;
      }
      for (const ch of node.textContent) {
        state.tick("inner");
        if (ch === "\n") {
          state.out += "\n";
          if (state.delim) state.out += state.delim;
        } else {
          state.out += ch;
        }
        state.advance(1);
      }
      state.tick("inner");
      state.out += "\n";
      if (state.delim) state.out += state.delim;
      state.out += "$$";
      state.closeBlock(node);
    },
  },

  inline: {
    priority: 0.75,
    scan: scanInlineMath,
    markNames: ["math"],
    extRanges: ((parent) => markExtRanges(parent, "math", 1)) satisfies InlineFeatureSpec["extRanges"],
  },

  plugins: (schema) => [mathBlockViewPlugin(), mathBlockCommitPlugin(schema)],

  keymap: (schema) => ({
    Enter: (state, dispatch) => {
      if (!paragraphIsMathFence(state)) return false;
      if (dispatch) {
        const pos = state.selection.$from.before();
        const mathBlock = schema.nodes.math_block.createAndFill();
        if (!mathBlock) return false;
        const tr = state.tr.replaceWith(pos, pos + state.selection.$from.parent.nodeSize, mathBlock);
        tr.setSelection(TextSelection.create(tr.doc, pos + 1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    },
    Backspace: deleteEmptyMathBlock(schema),
    "Mod-Enter": exitMathBlockOneLevel(schema),
  }),
};
