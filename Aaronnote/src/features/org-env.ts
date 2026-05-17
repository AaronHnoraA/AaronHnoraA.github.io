import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorView, NodeView, ViewMutationRecord } from "prosemirror-view";

import type { FeatureSpec } from "./_types.ts";

const ENV_LABELS: Record<string, string> = {
  proof: "Proof",
  theorem: "Theorem",
  thm: "Theorem",
  lemma: "Lemma",
  proposition: "Proposition",
  prop: "Proposition",
  corollary: "Corollary",
  cor: "Corollary",
  definition: "Definition",
  defn: "Definition",
  summary: "Summary",
  remark: "Remark",
  example: "Example",
  note: "Note",
  info: "Info",
  attention: "Attention",
  property: "Property",
  warning: "Warning",
  meta: "Meta",
};

function envLabel(kind: string): string {
  return ENV_LABELS[kind] ?? kind;
}

function parseOrgEnvText(text: string): { kind: string; title: string; content: string } | null {
  const open = text.match(/^\s*#\+begin(?:_|\s+)([A-Za-z][\w-]*)(?:\s+([^\n]+?))?\s*\n/i);
  if (!open) return null;
  const kind = open[1].toLowerCase();
  const closePattern = new RegExp(`\\n\\s*\\\\?#\\+end(?:_|\\s+)${kind}\\s*$`, "i");
  const close = text.match(closePattern);
  if (!close || close.index == null) return null;
  return {
    kind,
    title: open[2]?.trim() ?? "",
    content: text.slice(open[0].length, close.index).replace(/\n$/, ""),
  };
}

function orgEnvCommitPlugin(): Plugin {
  return new Plugin({
    appendTransaction(_trs, _oldState, newState) {
      const orgEnvType = newState.schema.nodes.org_env_block;
      if (!orgEnvType) return null;
      const found: Array<{ from: number; to: number; kind: string; title: string; content: string }> = [];
      newState.doc.descendants((node, pos) => {
        if (found.length > 0 || node.type.name !== "paragraph") return found.length === 0;
        const parsed = parseOrgEnvText(node.textContent);
        if (!parsed) return true;
        found.push({
          from: pos,
          to: pos + node.nodeSize,
          ...parsed,
        });
        return false;
      });
      const replacement = found[0];
      if (!replacement) return null;
      const textNodes = replacement.content ? [newState.schema.text(replacement.content)] : [];
      const block = orgEnvType.createChecked({
        kind: replacement.kind,
        title: replacement.title,
      }, textNodes);
      return newState.tr.replaceWith(replacement.from, replacement.to, block);
    },
  });
}

class OrgEnvNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private label: HTMLElement;
  private title: HTMLElement;
  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("org-env-block");
    this.label = document.createElement("span");
    this.title = document.createElement("span");
    this.contentDOM = document.createElement("span");

    this.label.className = "org-env-heading-label";
    this.label.contentEditable = "false";
    this.title.className = "org-env-heading-title";
    this.title.contentEditable = "true";
    this.title.spellcheck = false;
    this.contentDOM.className = "org-env-content";

    this.title.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    this.title.addEventListener("click", () => {
      this.title.focus();
    });
    this.title.addEventListener("input", () => this.writeTitle());
    this.title.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.view.focus();
        const pos = this.getPos();
        if (typeof pos === "number") {
          const inside = Math.min(pos + 1, this.view.state.doc.content.size);
          this.view.dispatch(this.view.state.tr.setSelection(TextSelection.near(this.view.state.doc.resolve(inside))).scrollIntoView());
        }
      }
    });

    const heading = document.createElement("span");
    heading.className = "org-env-heading";
    heading.append(this.label, this.title);
    this.dom.append(heading, this.contentDOM);
    this.renderAttrs(node);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderAttrs(node);
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.title.contains(event.target);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.target instanceof Node && this.title.contains(mutation.target);
  }

  private renderAttrs(node: PMNode): void {
    const kind = String(node.attrs.kind || "note");
    const title = String(node.attrs.title || "");
    const label = envLabel(kind);
    this.dom.dataset.kind = kind;
    this.dom.dataset.title = title;
    this.dom.dataset.label = label;
    this.label.textContent = title ? `${label} · ` : label;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.title.dataset.empty = title ? "false" : "true";
    this.title.setAttribute("aria-label", `${label} title`);
  }

  private writeTitle(): void {
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    const title = this.title.textContent?.trim() ?? "";
    if (title === String(this.node.attrs.title || "")) return;
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        title,
      }),
    );
  }
}

function orgEnvNodeViewPlugin(): Plugin {
  return new Plugin({
    props: {
      nodeViews: {
        org_env_block: (node, view, getPos) => new OrgEnvNodeView(
          node,
          view,
          getPos as () => number | undefined,
        ),
      },
    },
  });
}

const orgEnvRule: RuleBlock = (state, startLine, endLine, silent) => {
  if (state.tShift[startLine]! > 3) return false;
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const lineEnd = state.eMarks[startLine]!;
  const line = state.src.slice(start, lineEnd);
  const open = line.match(/^#\+begin(?:_|\s+)([A-Za-z][\w-]*)(?:\s+(.+?))?\s*$/i);
  if (!open) return false;

  const kind = open[1].toLowerCase();
  let closeLine = -1;
  const closePattern = new RegExp(`^#\\+end(?:_|\\s+)${kind}\\s*$`, "i");
  for (let lineNo = startLine + 1; lineNo < endLine; lineNo++) {
    const bm = state.bMarks[lineNo]! + state.tShift[lineNo]!;
    const em = state.eMarks[lineNo]!;
    if (
      state.tShift[lineNo]! <= 3 &&
      closePattern.test(state.src.slice(bm, em).replace(/^\\(?=#\+end)/i, ""))
    ) {
      closeLine = lineNo;
      break;
    }
  }
  if (closeLine < 0) return false;
  if (silent) return true;

  const content = state.src
    .slice(state.bMarks[startLine + 1]!, state.bMarks[closeLine]!)
    .replace(/\n$/, "");
  const token = state.push("org_env_block", "div", 0);
  token.block = true;
  token.content = content;
  token.meta = {
    kind,
    title: open[2]?.trim() ?? "",
  };
  token.map = [startLine, closeLine + 1];
  state.line = closeLine + 1;
  return true;
};

export const orgEnv: FeatureSpec = {
  name: "org-env",

  plugins: () => [orgEnvCommitPlugin(), orgEnvNodeViewPlugin()],

  nodes: {
    org_env_block: {
      group: "block",
      content: "text*",
      code: true,
      marks: "",
      defining: true,
      attrs: {
        kind: { default: "note" },
        title: { default: "" },
      },
      parseDOM: [
        {
          tag: "org-env-block",
          preserveWhitespace: "full",
          getAttrs: (dom) => ({
            kind: (dom as HTMLElement).dataset.kind || "note",
            title: (dom as HTMLElement).dataset.title || "",
          }),
        },
      ],
      toDOM: (node) => [
        "org-env-block",
        {
          "data-kind": node.attrs.kind,
          "data-title": node.attrs.title,
          "data-label": envLabel(String(node.attrs.kind)),
        },
        0,
      ],
    },
  },

  mdItPlugins: [
    (md) => {
      md.block.ruler.before("heading", "org_env_block", orgEnvRule, {
        alt: ["paragraph", "reference", "blockquote", "list"],
      });
    },
  ],

  parserTokens: {
    org_env_block: (state, tok, schema) => {
      const textNodes = tok.content ? [schema.text(tok.content)] : [];
      state.push(schema.nodes.org_env_block.createChecked({
        kind: tok.meta?.kind ?? "note",
        title: tok.meta?.title ?? "",
      }, textNodes));
    },
  },

  blockHandlers: {
    org_env_block: (state, node) => {
      const kind = String(node.attrs.kind || "note");
      const title = String(node.attrs.title || "");
      state.write(`#+begin ${kind}${title ? ` ${title}` : ""}\n`);
      state.tick("inner");
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
      state.write(`\n#+end ${kind}`);
      state.closeBlock(node);
    },
  },

  keymap: (schema) => ({
    Enter: (state, dispatch) => {
      const sel = state.selection;
      if (!sel.empty) return false;
      const $from = sel.$from;
      const orgEnvType = schema.nodes.org_env_block;
      if ($from.parent.type !== orgEnvType) return false;

      const text = $from.parent.textContent;
      const offset = $from.parentOffset;
      if (offset === text.length && text.endsWith("\n")) {
        if (dispatch) {
          const tr = state.tr;
          const blockEnd = $from.after();
          tr.delete(blockEnd - 2, blockEnd - 1);
          const newBlockEnd = blockEnd - 1;
          if (newBlockEnd >= tr.doc.content.size) {
            tr.insert(newBlockEnd, schema.nodes.paragraph.create());
          }
          tr.setSelection(TextSelection.create(tr.doc, newBlockEnd + 1));
          dispatch(tr);
        }
        return true;
      }

      return false;
    },

    ArrowDown: (state, dispatch) => {
      const sel = state.selection;
      if (!sel.empty) return false;
      const $from = sel.$from;
      const orgEnvType = schema.nodes.org_env_block;
      if ($from.parent.type !== orgEnvType) return false;
      const tail = $from.parent.textContent.slice($from.parentOffset);
      if (tail.includes("\n")) return false;
      if (dispatch) {
        const tr = state.tr;
        const blockEnd = $from.after();
        if (blockEnd >= tr.doc.content.size) {
          tr.insert(blockEnd, schema.nodes.paragraph.create());
        }
        tr.setSelection(TextSelection.create(tr.doc, blockEnd + 1));
        dispatch(tr);
      }
      return true;
    },
  }),
};
