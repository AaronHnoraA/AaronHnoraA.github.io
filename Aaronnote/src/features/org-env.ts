import type { Fragment, Node as PMNode, NodeType, ResolvedPos, Schema } from "prosemirror-model";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";
import { Plugin, PluginKey, TextSelection, type EditorState } from "prosemirror-state";
import {
  Decoration,
  DecorationSet,
  type EditorView,
  type NodeView,
  type ViewMutationRecord,
} from "prosemirror-view";

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
  comment: "Comment",
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

function paragraphFromText(schema: Schema, text: string): PMNode | null {
  if (!text) return null;
  return schema.nodes.paragraph.createChecked(null, schema.text(text));
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
      const paragraph = paragraphFromText(newState.schema, replacement.content);
      const block = orgEnvType.createChecked({
        kind: replacement.kind,
        title: replacement.title,
      }, paragraph ? [paragraph] : []);
      return newState.tr.replaceWith(replacement.from, replacement.to, block);
    },
  });
}

function orgEnvDepth($pos: ResolvedPos, orgEnvType: NodeType): number {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type === orgEnvType) return depth;
  }
  return -1;
}

function fragmentChildren(fragment: Fragment): PMNode[] {
  const children: PMNode[] = [];
  fragment.forEach((child) => children.push(child));
  return children;
}

type OrgEnvUiMeta = { type: "toggleComment"; pos: number };

const orgEnvUiKey = new PluginKey<DecorationSet>("org-env-ui");

class OrgEnvNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private label: HTMLElement;
  private title: HTMLInputElement;
  private metaDOM: HTMLElement;
  private commentButton: HTMLButtonElement;
  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private suppressNextCommentMouseDown = false;
  private suppressNextCommentClick = false;
  private commentSuppressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations: readonly Decoration[],
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("org-env-block");
    this.label = document.createElement("span");
    this.title = document.createElement("input");
    this.contentDOM = document.createElement("div");
    this.metaDOM = document.createElement("div");
    this.commentButton = document.createElement("button");

    this.label.className = "org-env-heading-label";
    this.label.contentEditable = "false";
    this.title.className = "org-env-heading-title";
    this.title.type = "text";
    this.title.spellcheck = false;
    this.contentDOM.className = "org-env-content";
    this.metaDOM.className = "org-env-meta";
    this.metaDOM.contentEditable = "false";
    this.commentButton.type = "button";
    this.commentButton.className = "org-env-comment-button";
    this.commentButton.contentEditable = "false";

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
    this.contentDOM.addEventListener("mousedown", (event) => this.selectContentFromMouse(event));
    const heading = document.createElement("span");
    heading.className = "org-env-heading";
    heading.append(this.label, this.title);
    this.dom.append(this.commentButton, heading, this.contentDOM, this.metaDOM);
    this.dom.addEventListener("pointerdown", (event) => this.handleCommentPointerDown(event), true);
    this.dom.addEventListener("mousedown", (event) => this.handleCommentMouseDown(event), true);
    this.dom.addEventListener("click", (event) => this.handleCommentClick(event), true);
    this.renderAttrs(node, decorations);
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderAttrs(node, decorations);
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node
      && (
        this.title.contains(event.target)
        || this.metaDOM.contains(event.target)
        || this.commentButton.contains(event.target)
      );
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.target instanceof Node
      && (
        this.title.contains(mutation.target)
        || this.metaDOM.contains(mutation.target)
        || this.commentButton.contains(mutation.target)
      );
  }

  destroy(): void {
    if (this.commentSuppressTimer) clearTimeout(this.commentSuppressTimer);
  }

  private suppressFollowingCommentEvents(mouseDown: boolean): void {
    this.suppressNextCommentMouseDown = mouseDown;
    this.suppressNextCommentClick = true;
    if (this.commentSuppressTimer) clearTimeout(this.commentSuppressTimer);
    this.commentSuppressTimer = setTimeout(() => {
      this.suppressNextCommentMouseDown = false;
      this.suppressNextCommentClick = false;
      this.commentSuppressTimer = null;
    }, 750);
  }

  private isCommentButtonEvent(event: Event): boolean {
    if (event.target instanceof Node && this.commentButton.contains(event.target)) return true;
    if (!(event instanceof MouseEvent)) return false;
    const rect = this.commentButton.getBoundingClientRect();
    return event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  }

  private handleCommentPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !this.isCommentButtonEvent(event)) return;
    event.stopPropagation();
    this.toggleComment();
    this.suppressFollowingCommentEvents(true);
  }

  private handleCommentMouseDown(event: MouseEvent): void {
    if (event.button !== 0 || !this.isCommentButtonEvent(event)) return;
    event.stopPropagation();
    if (this.suppressNextCommentMouseDown) {
      this.suppressNextCommentMouseDown = false;
      return;
    }
    this.toggleComment();
    this.suppressFollowingCommentEvents(false);
  }

  private handleCommentClick(event: MouseEvent): void {
    if (!this.isCommentButtonEvent(event)) return;
    event.stopPropagation();
    if (this.suppressNextCommentClick) {
      this.suppressNextCommentClick = false;
      return;
    }
    this.toggleComment();
  }

  private toggleComment(): void {
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    this.view.dispatch(
      this.view.state.tr.setMeta(orgEnvUiKey, {
        type: "toggleComment",
        pos,
      } satisfies OrgEnvUiMeta),
    );
  }

  private renderAttrs(node: PMNode, decorations: readonly Decoration[]): void {
    const kind = String(node.attrs.kind || "note");
    const title = String(node.attrs.title || "");
    const label = envLabel(kind);
    const isComment = kind === "comment";
    const active = decorations.some((decoration) => decoration.spec.orgEnvActive === true);
    const commentOpen = decorations.some((decoration) => decoration.spec.orgEnvCommentOpen === true);
    this.dom.dataset.kind = kind;
    this.dom.dataset.title = title;
    this.dom.dataset.label = label;
    this.dom.dataset.commentOpen = isComment && commentOpen ? "true" : "false";
    this.dom.classList.toggle("org-env-active", active);
    this.dom.classList.toggle("org-env-comment-open", isComment && commentOpen);
    this.label.textContent = label;
    if (this.title.value !== title) this.title.value = title;
    this.title.dataset.empty = title ? "false" : "true";
    this.commentButton.hidden = !isComment;
    this.commentButton.textContent = title || "Comment";
    this.commentButton.setAttribute("aria-expanded", commentOpen ? "true" : "false");
    this.title.hidden = kind === "meta" || isComment;
    this.label.hidden = kind === "meta" || isComment;
    this.contentDOM.hidden = kind === "meta" || (isComment && !commentOpen);
    this.metaDOM.hidden = kind !== "meta";
    this.title.setAttribute("aria-label", `${label} title`);
    if (kind === "meta") this.renderMeta();
  }

  private writeTitle(): void {
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    const title = this.title.value.trim();
    if (title === String(this.node.attrs.title || "")) return;
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        title,
      }),
    );
  }

  private selectContentFromMouse(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target;
    if (
      target instanceof Element
      && target.closest("a, button, input, textarea, select")
    ) {
      return;
    }
    // Let ProseMirror/browser handle normal text clicks and drag
    // selections inside the block. We only synthesize a selection when
    // the user clicks the empty content chrome itself.
    if (target !== this.contentDOM) return;
    const pos = this.getPos();
    if (typeof pos !== "number") return;

    const { state } = this.view;
    const start = pos + 1;
    if (this.node.childCount === 0) {
      event.preventDefault();
      const tr = state.tr.insert(start, state.schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, start + 1));
      this.view.dispatch(tr.scrollIntoView());
      this.view.focus();
      return;
    }

    const end = pos + this.node.nodeSize - 1;
    const hit = this.view.posAtCoords({ left: event.clientX, top: event.clientY });
    const hitPos = typeof hit?.pos === "number" ? hit.pos : end;
    const clamped = Math.max(start, Math.min(hitPos, end));
    event.preventDefault();
    this.view.dispatch(
      state.tr
        .setSelection(TextSelection.near(state.doc.resolve(clamped), hitPos >= end ? -1 : 1))
        .scrollIntoView(),
    );
    this.view.focus();
  }

  private metaEntries(): Array<{ key: string; value: string }> {
    return this.node.textContent
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => ({ key: match[1], value: match[2] ?? "" }));
  }

  private renderMeta(): void {
    const active = document.activeElement;
    if (active && this.metaDOM.contains(active)) return;
    this.metaDOM.innerHTML = "";
    const entries = this.metaEntries();
    if (entries.length === 0) {
      const empty = document.createElement("span");
      empty.className = "org-env-meta-empty";
      empty.textContent = "No metadata";
      this.metaDOM.append(empty);
      return;
    }
    entries.forEach((entry) => {
      const pill = document.createElement("span");
      pill.className = "org-env-meta-pill";
      const key = document.createElement("span");
      key.className = "org-env-meta-key";
      key.textContent = entry.key;
      const value = document.createElement("span");
      value.className = "org-env-meta-value";
      value.textContent = entry.value;
      value.contentEditable = "true";
      value.spellcheck = false;
      value.dataset.key = entry.key;
      value.addEventListener("input", () => this.writeMeta());
      value.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.writeMeta();
          this.view.focus();
        }
      });
      pill.append(key, value);
      this.metaDOM.append(pill);
    });
  }

  private writeMeta(): void {
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    const lines = Array.from(this.metaDOM.querySelectorAll<HTMLElement>(".org-env-meta-value"))
      .map((value) => `${value.dataset.key}: ${value.textContent?.trim() ?? ""}`);
    const next = lines.join("\n");
    if (next === this.node.textContent) return;
    const start = pos + 1;
    const end = start + this.node.content.size;
    const paragraph = next ? this.view.state.schema.nodes.paragraph.createChecked(
      null,
      this.view.state.schema.text(next),
    ) : null;
    this.view.dispatch(this.view.state.tr.replaceWith(
      start,
      end,
      paragraph ? [paragraph] : [],
    ));
  }
}

function orgEnvNodeViewPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: orgEnvUiKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, openComments, _oldState, newState) {
        const mapped = openComments.map(tr.mapping, tr.doc);
        const meta = tr.getMeta(orgEnvUiKey) as OrgEnvUiMeta | undefined;
        if (meta?.type !== "toggleComment") return mapped;

        const pos = tr.mapping.map(meta.pos, 1);
        const node = newState.doc.nodeAt(pos);
        if (
          !node
          || node.type !== newState.schema.nodes.org_env_block
          || String(node.attrs.kind || "") !== "comment"
        ) {
          return mapped;
        }

        const existing = mapped.find(
          pos,
          pos + node.nodeSize,
          (spec) => spec.orgEnvCommentOpen === true,
        );
        if (existing.length > 0) return mapped.remove(existing);
        return mapped.add(newState.doc, [
          Decoration.node(pos, pos + node.nodeSize, {}, { orgEnvCommentOpen: true }),
        ]);
      },
    },
    props: {
      decorations: orgEnvDecorations,
      nodeViews: {
        org_env_block: (node, view, getPos, decorations) => new OrgEnvNodeView(
          node,
          view,
          getPos as () => number | undefined,
          decorations,
        ),
      },
    },
  });
}

function orgEnvDecorations(state: EditorState): DecorationSet {
  const openComments = orgEnvUiKey.getState(state) ?? DecorationSet.empty;
  const active = activeOrgEnvDecoration(state);
  const decorations = [
    ...openComments.find(),
    ...active.find(),
  ];
  return decorations.length > 0
    ? DecorationSet.create(state.doc, decorations)
    : DecorationSet.empty;
}

function activeOrgEnvDecoration(state: EditorState): DecorationSet {
  const range = orgEnvRangeAt(state.selection.$from) ?? orgEnvRangeAt(state.selection.$to);
  if (!range) return DecorationSet.empty;
  return DecorationSet.create(state.doc, [
    Decoration.node(range.pos, range.pos + range.node.nodeSize, {}, { orgEnvActive: true }),
  ]);
}

function orgEnvRangeAt($pos: ResolvedPos): { pos: number; node: PMNode } | null {
  const orgEnvType = $pos.doc.type.schema.nodes.org_env_block;
  if (!orgEnvType) return null;
  const depth = orgEnvDepth($pos, orgEnvType);
  if (depth < 0) return null;
  return { pos: $pos.before(depth), node: $pos.node(depth) };
}

function orgEnvRangeNearSelection(state: EditorState): { pos: number; node: PMNode } | null {
  const orgEnvType = state.schema.nodes.org_env_block;
  if (!orgEnvType) return null;
  const sel = state.selection;
  const inside = orgEnvRangeAt(sel.$from) ?? orgEnvRangeAt(sel.$to);
  if (inside) return inside;

  const before = sel.$from.nodeBefore;
  if (before?.type === orgEnvType) return { pos: sel.from - before.nodeSize, node: before };

  const after = sel.$from.nodeAfter;
  if (after?.type === orgEnvType) return { pos: sel.from, node: after };

  return null;
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

  const content = state.getLines(startLine + 1, closeLine, state.blkIndent, false);
  const token = state.push("org_env_block", "div", 0);
  token.block = true;
  token.content = content;
  token.children = state.md.parse(content, state.env);
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
      content: "block*",
      defining: true,
      attrs: {
        kind: { default: "note" },
        title: { default: "" },
      },
      parseDOM: [
        {
          tag: "org-env-block",
          preserveWhitespace: "full",
          contentElement: ".org-env-content",
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
        ["div", { class: "org-env-content" }, 0],
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
      state.openNode(schema.nodes.org_env_block, {
        kind: tok.meta?.kind ?? "note",
        title: tok.meta?.title ?? "",
      });
      state.addBlockTokens(tok.children ?? []);
      state.closeNode();
    },
  },

  blockHandlers: {
    org_env_block: (state, node) => {
      const kind = String(node.attrs.kind || "note");
      const title = String(node.attrs.title || "");
      state.write(`#+begin ${kind}${title ? ` ${title}` : ""}\n`);
      if (node.childCount > 0) {
        state.renderBlockChildren(node);
        state.flushClose(true);
      }
      state.write(`#+end ${kind}`);
      state.closeBlock(node);
    },
  },

  keymap: (schema) => ({
    Enter: (state, dispatch) => {
      const sel = state.selection;
      const $from = sel.$from;
      const $to = sel.$to;
      const orgEnvType = schema.nodes.org_env_block;
      if (orgEnvDepth($from, orgEnvType) < 0) return false;
      if ($to.parent !== $from.parent) return false;
      if ($from.parent.type !== orgEnvType) return false;

      if (dispatch) {
        dispatch(state.tr.insertText("\n", sel.from, sel.to).scrollIntoView());
      }
      return true;
    },

    "Mod-Enter": (state, dispatch) => {
      const sel = state.selection;
      if (!sel.empty) return false;
      const $from = sel.$from;
      const orgEnvType = schema.nodes.org_env_block;
      const depth = orgEnvDepth($from, orgEnvType);
      if (depth < 0) {
        const nearby = orgEnvRangeNearSelection(state);
        if (!nearby) return false;
        if (dispatch) {
          const insertAt = nearby.pos + nearby.node.nodeSize;
          const tr = state.tr.insert(insertAt, schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
          dispatch(tr.scrollIntoView());
        }
        return true;
      }

      if (dispatch) {
        const node = $from.node(depth);
        const blockStart = $from.before(depth);
        const blockEnd = $from.after(depth);
        const offset = sel.from - (blockStart + 1);
        const tr = state.tr;
        const headText = node.textBetween(0, offset, "\n", "\n");
        const tailText = node.textBetween(offset, node.content.size, "\n", "\n");

        if (!headText) {
          tr.insert(blockStart, schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, blockStart + 1));
          dispatch(tr.scrollIntoView());
          return true;
        }

        if (!tailText) {
          tr.insert(blockEnd, schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, blockEnd + 1));
          dispatch(tr.scrollIntoView());
          return true;
        }

        const before = node.content.cut(0, offset);
        const after = node.content.cut(offset);
        const beforeBlock = orgEnvType.createChecked(node.attrs, before);
        const afterBlocks = fragmentChildren(after);
        tr.replaceWith(blockStart, blockEnd, [
          beforeBlock,
          ...(afterBlocks.length > 0 ? afterBlocks : [schema.nodes.paragraph.create()]),
        ]);
        const paraStart = blockStart + beforeBlock.nodeSize;
        tr.setSelection(TextSelection.create(tr.doc, paraStart + 1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    },

    ArrowDown: (state, dispatch) => {
      const sel = state.selection;
      if (!sel.empty) return false;
      const $from = sel.$from;
      const orgEnvType = schema.nodes.org_env_block;
      const depth = orgEnvDepth($from, orgEnvType);
      if (depth < 0) return false;
      const node = $from.node(depth);
      const offset = sel.from - ($from.before(depth) + 1);
      const tail = node.textBetween(offset, node.content.size, "\n", "\n");
      if (tail) return false;
      if (dispatch) {
        const tr = state.tr;
        const blockEnd = $from.after(depth);
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
