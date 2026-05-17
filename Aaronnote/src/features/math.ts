import type { Node as PMNode, Schema } from "prosemirror-model";
import { TextSelection, type Command, type EditorState, Plugin } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView, type NodeView, type ViewMutationRecord } from "prosemirror-view";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";

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

function scanInlineMath(text: string, consumed: Uint8Array): InlineSpan[] {
  const out: InlineSpan[] = [];
  for (let i = 0; i < text.length; i++) {
    if (consumed[i] || text[i] !== "$" || escaped(text, i)) continue;
    if (text[i + 1] === "$") continue;
    if (adjacentDollar(text, i)) continue;

    const openFrom = i;
    const openTo = openFrom + 1;
    let closeFrom = -1;
    for (let j = openTo; j < text.length; j++) {
      if (text[j] === "\n") break;
      if (consumed[j]) continue;
      if (text[j] !== "$" || escaped(text, j) || adjacentDollar(text, j)) continue;
      closeFrom = j;
      break;
    }
    if (closeFrom < 0) continue;

    const closeTo = closeFrom + 1;
    let blocked = false;
    for (let j = openFrom; j < closeTo; j++) {
      if (consumed[j]) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const rawTex = text.slice(openTo, closeFrom);
    if (rawTex.trim().length === 0) continue;

    const tex = rawTex.trim();
    markConsumed(consumed, openFrom, closeTo);
    out.push({
      type: "math",
      from: openTo,
      to: closeFrom,
      openFrom,
      openTo,
      closeFrom,
      closeTo,
      attrs: { tex, delimiter: "$", display: false },
      delimRanges: [{ from: openFrom, to: closeTo, softInside: true }],
      widgetDecorations: [
        {
          pos: openFrom,
          when: "outside",
          kind: "math-render",
          attrs: { tex, display: "0" },
          side: -1,
        },
      ],
    });
    i = closeTo - 1;
  }
  return out;
}

type DisplayMathText = {
  content: string;
  bodyFrom: number;
  bodyTo: number;
  closeTo: number;
};

function parseDisplayMathText(text: string): DisplayMathText | null {
  const openEnd = text.indexOf("\n");
  if (openEnd < 0) return null;
  const closeStart = text.lastIndexOf("\n") + 1;
  if (closeStart <= openEnd) return null;

  const openLine = text.slice(0, openEnd);
  const closeLine = text.slice(closeStart);
  if (!/^[ \t]*\$\$[ \t]*$/.test(openLine)) return null;
  if (!/^[ \t]*\$\$[ \t]*$/.test(closeLine)) return null;

  const bodyFrom = openEnd + 1;
  const bodyTo = closeStart === bodyFrom ? bodyFrom : closeStart - 1;
  return {
    content: text.slice(bodyFrom, bodyTo),
    bodyFrom,
    bodyTo,
    closeTo: text.length,
  };
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

  const content = state.src
    .slice(state.bMarks[startLine + 1]!, state.bMarks[closeLine]!)
    .replace(/\n$/, "");
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

function mathBlockCommitPlugin(schema: Schema): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const mathBlockType = schema.nodes.math_block;
      const found: Array<{ from: number; to: number; parsed: DisplayMathText }> = [];
      newState.doc.descendants((node, pos) => {
        if (found.length > 0) return false;
        if (node.type.name !== "paragraph") return true;
        const parsed = parseDisplayMathText(node.textContent);
        if (!parsed) return true;
        found.push({ from: pos, to: pos + node.nodeSize, parsed });
        return false;
      });
      const hit = found[0];
      if (!hit) return null;

      const block = mathBlockType.createChecked(null, textNode(schema, hit.parsed.content));
      const tr = newState.tr.replaceWith(hit.from, hit.to, block);
      const sel = newState.selection;
      if (sel.empty && sel.from >= hit.from + 1 && sel.from <= hit.to - 1) {
        const local = sel.from - (hit.from + 1);
        let target = hit.from + 1;
        if (local >= hit.parsed.bodyFrom && local <= hit.parsed.bodyTo) {
          target = hit.from + 1 + Math.min(local - hit.parsed.bodyFrom, block.content.size);
        } else if (local >= hit.parsed.closeTo) {
          target = hit.from + block.nodeSize;
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
      md.block.ruler.before("paragraph", "math_block", mathBlockRule, {
        alt: ["paragraph", "reference", "blockquote", "list"],
      });
    },
  ],

  parserTokens: {
    math_block: (state, token, schema) => {
      state.push(schema.nodes.math_block.createChecked(null, textNode(schema, token.content)));
    },
  },

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
