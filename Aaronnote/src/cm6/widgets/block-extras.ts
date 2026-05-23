/**
 * Phase 6 — Regex-scanned block widgets for the CM6 kernel.
 *
 * CM6 constraint: block:true decorations must come from StateField, not ViewPlugin.
 * This entire module uses StateField (full-doc scan).
 *
 * Three widget types:
 *
 *   [toc]  (case-insensitive, own line)
 *   #+begin <type> … #+end <type>  (org-mode style blocks)
 *   --- … ---  (YAML front matter at document start)
 *   --- / *** / ___  (horizontal rule)
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { StateField, type ChangeSet, type EditorState, type Extension, type Text } from "@codemirror/state";
import type { Range as CMRange } from "@codemirror/state";
import {
  getBlockMathRanges,
  positionInsideAnyRange,
  rangeInsideAny,
  rangeOverlapsAny,
} from "../math-ranges.ts";
import {
  metaEntryMap,
  metaTags,
  parseMetaEntries,
  renderMarkdownHTML,
  showMetaTag,
} from "../../render-html.ts";
import { supportedDiagramLang } from "../../diagram-langs.ts";

// ---------------------------------------------------------------------------
// Regexes / parsers
// ---------------------------------------------------------------------------

// [toc] alone on a line
const TOC_LINE_RE = /^[ \t]*\[toc\][ \t]*$/im;

const HR_LINE_RE = /^[ \t]{0,3}((?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;

export interface OrgEnvBlock {
  from: number;
  to: number;
  openFrom: number;
  openTo: number;
  bodyFrom: number;
  bodyTo: number;
  closeFrom: number;
  closeTo: number;
  kind: string;
  title: string;
  body: string;
  titleAnchor: number;
  depth: number;
}

export interface OrgEnvContext {
  kind: string;
  depth: number;
}

interface OrgEnvOpenLineInfo {
  kind: string;
  title: string;
  titleAnchor: number;
}

interface OrgEnvTitlePatch {
  blocks: readonly OrgEnvBlock[];
  newBlock: OrgEnvBlock;
}

// Depth-aware scanner: handles nested #+begin <kind> … #+end <kind>.
function scanOrgEnvBlocks(
  text: string,
  depthLevel = 0,
  baseOffset = 0,
  blockMathRanges: ReadonlyArray<{ from: number; to: number }> = [],
): OrgEnvBlock[] {
  const results: OrgEnvBlock[] = [];
  let i = 0;
  while (i < text.length) {
    // Advance to the start of the next line
    const lineEnd = text.indexOf("\n", i);
    const lineEndPos = lineEnd === -1 ? text.length : lineEnd;
    if (positionInsideAnyRange(baseOffset + i, blockMathRanges)) { i = lineEndPos + 1; continue; }
    const line = text.slice(i, lineEndPos);
    const openMatch = /^[ \t]*#\+begin\s+(\S+)(?:[ \t]+([^\n]*))?[ \t]*$/i.exec(line);
    if (!openMatch) { i = lineEndPos + 1; continue; }

    const kind = openMatch[1].toLowerCase();
    const title = (openMatch[2] ?? "").trim();
    const blockFrom = i;
    const bodyStart = lineEndPos + 1;

    // Find matching #+end kind at this depth level
    const escapedKind = kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const openRe = new RegExp(`^[ \\t]*#\\+begin\\s+${escapedKind}(?:\\s|$)`, "i");
    const closeRe = new RegExp(`^[ \\t]*#\\+end\\s+${escapedKind}[ \\t]*$`, "i");

    let depth = 1, pos = bodyStart, closeFrom = -1, closeTo = -1;
    while (pos < text.length) {
      const nl = text.indexOf("\n", pos);
      const nextEnd = nl === -1 ? text.length : nl;
      if (positionInsideAnyRange(baseOffset + pos, blockMathRanges)) { pos = nextEnd + 1; continue; }
      const cur = text.slice(pos, nextEnd);
      if (closeRe.test(cur)) { depth--; if (depth === 0) { closeFrom = pos; closeTo = nextEnd; break; } }
      else if (openRe.test(cur)) depth++;
      pos = nextEnd + 1;
    }

    if (closeFrom < 0) { i = lineEndPos + 1; continue; }

    const titleIndex = openMatch[2] ? line.indexOf(openMatch[2]) : -1;
    const body = text.slice(bodyStart, closeFrom);
    results.push({
      from: blockFrom,
      to: closeTo,
      openFrom: blockFrom,
      openTo: lineEndPos,
      bodyFrom: bodyStart,
      bodyTo: closeFrom,
      closeFrom,
      closeTo,
      kind,
      title,
      body,
      titleAnchor: titleIndex >= 0 ? blockFrom + titleIndex : lineEndPos,
      depth: depthLevel,
    });
    if (kind !== "meta") {
      for (const nested of scanOrgEnvBlocks(body, depthLevel + 1, baseOffset + bodyStart, blockMathRanges)) {
        results.push({
          ...nested,
          from: bodyStart + nested.from,
          to: bodyStart + nested.to,
          openFrom: bodyStart + nested.openFrom,
          openTo: bodyStart + nested.openTo,
          bodyFrom: bodyStart + nested.bodyFrom,
          bodyTo: bodyStart + nested.bodyTo,
          closeFrom: bodyStart + nested.closeFrom,
          closeTo: bodyStart + nested.closeTo,
          titleAnchor: bodyStart + nested.titleAnchor,
        });
      }
    }
    i = closeTo + 1;
  }
  return results.sort((a, b) => a.from - b.from || a.to - b.to);
}

function setSourceRange(el: HTMLElement, from: number, to: number): void {
  el.dataset.cmSourceFrom = String(from);
  el.dataset.cmSourceTo = String(to);
}

export function orgEnvExitTarget(state: EditorState): number | null {
  const pos = state.selection.main.from;
  const containing = orgEnvBlocksFromState(state)
    .filter((block) => block.openFrom < pos && pos <= block.closeTo)
    .sort((a, b) => (a.to - a.from) - (b.to - b.from))[0];
  if (!containing) return null;
  return state.doc.sliceString(containing.closeTo, containing.closeTo + 1) === "\n"
    ? containing.closeTo + 1
    : containing.closeTo;
}

export function orgEnvContextForRange(state: EditorState, from: number, to: number): OrgEnvContext | null {
  const containing = orgEnvBlocksFromState(state)
    .filter((block) => (
      block.kind !== "meta"
      && block.bodyFrom <= from
      && to <= block.bodyTo
    ))
    .sort((a, b) => (a.to - a.from) - (b.to - b.from))[0];
  return containing ? { kind: containing.kind, depth: containing.depth } : null;
}

function buildOrgEnvSource(kind: string, title: string, body: string): string {
  const bodyWithCloseNewline = body.endsWith("\n") ? body : `${body}\n`;
  return `${buildOrgEnvOpenLine(kind, title)}\n${bodyWithCloseNewline}#+end ${kind}`;
}

function buildOrgEnvOpenLine(kind: string, title: string): string {
  return title.trim().length > 0 ? `#+begin ${kind} ${title.trim()}` : `#+begin ${kind}`;
}

function parseOrgEnvOpenLine(line: string): OrgEnvOpenLineInfo | null {
  const match = /^([ \t]*#\+begin\s+)(\S+)(?:([ \t]+)([^\n]*?))?[ \t]*$/i.exec(line);
  if (!match) return null;
  const rawTitle = match[4] ?? "";
  const title = rawTitle.trim();
  const titleAnchor = title.length > 0
    ? match[1].length + match[2].length + (match[3] ?? "").length + Math.max(0, rawTitle.search(/\S/))
    : line.length;
  return {
    kind: match[2].toLowerCase(),
    title,
    titleAnchor,
  };
}

function stopEditorPropagation(event: Event): void {
  event.stopPropagation();
}

function renderDiagramPreview(source: string, lang: string, div: HTMLElement): void {
  const key = `mermaid\n${lang}\n${source.trim()}`;
  div.dataset.diagramRenderKey = key;
  div.textContent = "Loading diagram renderer...";
  void import("../../diagram-render.ts")
    .then(({ renderMermaidLazy }) => {
      if (div.dataset.diagramRenderKey !== key) return;
      renderMermaidLazy(source, div, (err) => {
        div.classList.add("cm-diagram-error");
        div.textContent = err;
      }, { lang });
    })
    .catch((err: unknown) => {
      if (div.dataset.diagramRenderKey !== key) return;
      div.classList.add("cm-diagram-error");
      div.textContent = err instanceof Error ? err.message : String(err);
    });
}

function enhanceRenderedMarkdown(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("pre > code[class*='language-']").forEach((code) => {
    const langClass = Array.from(code.classList).find((cls) => cls.startsWith("language-")) ?? "";
    const lang = langClass.slice("language-".length);
    if (!supportedDiagramLang(lang)) return;
    const pre = code.parentElement;
    if (!(pre instanceof HTMLPreElement)) return;
    const div = document.createElement("div");
    div.className = "cm-mermaid-block-preview";
    renderDiagramPreview(code.textContent ?? "", lang, div);
    pre.replaceWith(div);
  });
}

function stopInteractiveWidgetEvents(root: HTMLElement): void {
  for (const type of ["mousedown", "mouseup", "click", "dblclick", "keydown", "keyup", "beforeinput", "input"]) {
    root.addEventListener(type, stopEditorPropagation);
  }
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

type TocHeading = {
  level: number;
  text: string;
  pos: number;
};

interface BlockExtraRanges {
  toc: Array<{ from: number; to: number }>;
  hrs: Array<{ from: number; to: number }>;
  frontMatter: { from: number; to: number; body: string } | null;
}

class TocWidget extends WidgetType {
  headings: TocHeading[];

  constructor(headings: TocHeading[]) {
    super();
    this.headings = headings;
  }

  eq(other: TocWidget): boolean {
    return tocSignature(this.headings) === tocSignature(other.headings);
  }

  toDOM(view: EditorView): HTMLElement {
    const div = document.createElement("div");
    div.className = "toc cm-toc";
    div.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    if (this.headings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "toc-empty";
      empty.textContent = "(no headings yet)";
      div.append(empty);
      return div;
    }

    const ul = document.createElement("ul");
    ul.className = "toc-list";
    for (const heading of this.headings) {
      const li = document.createElement("li");
      li.className = `toc-item toc-h${heading.level}`;
      li.style.setProperty("--toc-depth", String(Math.max(0, heading.level - 1)));
      li.dataset.level = String(heading.level);
      li.textContent = heading.text || "(empty heading)";
      li.title = heading.text || "(empty heading)";
      li.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        view.dispatch({ selection: { anchor: heading.pos }, scrollIntoView: true });
        view.focus();
        const dom = view.domAtPos(heading.pos).node;
        const el = dom instanceof Element ? dom : dom.parentElement;
        el?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      ul.append(li);
    }
    div.append(ul);
    return div;
  }

  ignoreEvent(): boolean { return true; }
}

function tocSignature(headings: TocHeading[]): string {
  return headings.map((h) => `${h.pos}\t${h.level}\t${h.text}`).join("\n");
}

function headingTextAndPos(state: EditorState, from: number, to: number): { text: string; pos: number } {
  const doc = state.doc;
  const first = doc.lineAt(from);
  const raw = first.text;
  const atx = raw.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
  if (atx) {
    const prefix = raw.indexOf(atx[2] ?? "");
    return {
      text: atx[2] ?? "",
      pos: first.from + Math.max(0, prefix),
    };
  }
  const text = doc.sliceString(from, Math.min(to, first.to)).trim();
  const leading = raw.search(/\S/);
  return {
    text,
    pos: first.from + Math.max(0, leading),
  };
}

function collectHeadings(state: EditorState): TocHeading[] {
  const headings: TocHeading[] = [];
  const blockMathRanges = getBlockMathRanges(state);
  syntaxTree(state).iterate({
    enter(node) {
      if (rangeInsideAny(node.from, node.to, blockMathRanges)) return false;
      const atx = node.name.match(/^ATXHeading([1-6])$/);
      const setext = node.name.match(/^SetextHeading([12])$/);
      if (!atx && !setext) return;
      const level = Number(atx?.[1] ?? setext?.[1] ?? 1);
      const { text, pos } = headingTextAndPos(state, node.from, node.to);
      headings.push({ level, text, pos });
      return false;
    },
  });
  return headings;
}

const ATX_HEADING_RE = /^#{1,6}\s/;
const SETEXT_UNDERLINE_RE = /^[=-]{2,}\s*$/;

function docHasHeading(doc: Text): boolean {
  for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
    const text = doc.line(lineNum).text;
    if (ATX_HEADING_RE.test(text)) return true;
    if (text.trim() && lineNum < doc.lines && SETEXT_UNDERLINE_RE.test(doc.line(lineNum + 1).text)) return true;
  }
  return false;
}

const headingsField = StateField.define<readonly TocHeading[]>({
  create: collectHeadings,
  update(headings, tr) {
    if (tr.docChanged) {
      if (!canMapHeadings(tr.startState.doc, tr.changes)) {
        if (headings.length === 0 && !docHasHeading(tr.state.doc)) return headings;
        return collectHeadings(tr.state);
      }
      return headings.map((heading) => ({ ...heading, pos: tr.changes.mapPos(heading.pos) }));
    }
    return headings;
  },
});

function canMapHeadings(doc: Text, changes: ChangeSet): boolean {
  let canMap = true;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!canMap) return;
    const fromLine = doc.lineAt(Math.min(fromA, doc.length));
    const toLine = doc.lineAt(Math.min(Math.max(fromA, toA), doc.length));
    const oldText = doc.sliceString(fromLine.from, toLine.to);
    const newText = inserted.toString();
    if (/[\n#=-]/.test(oldText) || /[\n#=-]/.test(newText)) {
      canMap = false;
    }
  });
  return canMap;
}

function scanBlockExtraLineRanges(
  doc: Text,
  startLine = 1,
  endLine = doc.lines,
): Pick<BlockExtraRanges, "toc" | "hrs"> {
  const toc: Array<{ from: number; to: number }> = [];
  const hrs: Array<{ from: number; to: number }> = [];
  for (let lineNum = Math.max(1, startLine); lineNum <= Math.min(doc.lines, endLine); lineNum++) {
    const line = doc.line(lineNum);
    if (TOC_LINE_RE.test(line.text)) toc.push({ from: line.from, to: line.to });
    if (HR_LINE_RE.test(line.text)) hrs.push({ from: line.from, to: line.to });
  }
  return { toc, hrs };
}

function scanBlockExtraRanges(doc: Text): BlockExtraRanges {
  const { toc, hrs } = scanBlockExtraLineRanges(doc);
  return { toc, hrs, frontMatter: scanFrontMatter(doc) };
}

const blockExtraRangesField = StateField.define<BlockExtraRanges>({
  create: (state) => scanBlockExtraRanges(state.doc),
  update(ranges, tr) {
    if (tr.docChanged) {
      return canMapBlockExtraRanges(tr.startState.doc, tr.changes, ranges)
        ? mapBlockExtraRanges(ranges, tr.changes)
        : canPatchBlockExtraRangesNearChanges(tr.startState.doc, tr.changes, ranges)
          ? patchBlockExtraRangesNearChanges(tr.state.doc, ranges, tr.changes)
          : scanBlockExtraRanges(tr.state.doc);
    }
    return ranges;
  },
});

function canMapBlockExtraRanges(doc: Text, changes: ChangeSet, ranges: BlockExtraRanges): boolean {
  let canMap = true;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!canMap) return;
    const fromLine = doc.lineAt(Math.min(fromA, doc.length));
    const toLine = doc.lineAt(Math.min(Math.max(fromA, toA), doc.length));
    const oldText = doc.sliceString(fromLine.from, toLine.to);
    const newText = inserted.toString();
    if (/[\n\[\]\-*_]/.test(oldText) || /[\n\[\]\-*_]/.test(newText)) {
      canMap = false;
      return;
    }
    if (ranges.frontMatter && fromA <= ranges.frontMatter.to && toA >= ranges.frontMatter.from) {
      canMap = false;
    }
  });
  return canMap;
}

function canPatchBlockExtraRangesNearChanges(doc: Text, changes: ChangeSet, ranges: BlockExtraRanges): boolean {
  let canPatch = true;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!canPatch) return;
    const removed = doc.sliceString(fromA, toA);
    const added = inserted.toString();
    if (removed.includes("\n") || added.includes("\n")) {
      canPatch = false;
      return;
    }
    const changedLine = doc.lineAt(Math.min(fromA, doc.length));
    if (changedLine.number <= 2) {
      canPatch = false;
      return;
    }
    if (ranges.frontMatter && fromA <= ranges.frontMatter.to && toA >= ranges.frontMatter.from) {
      canPatch = false;
    }
  });
  return canPatch;
}

function mapBlockExtraRanges(ranges: BlockExtraRanges, changes: ChangeSet): BlockExtraRanges {
  return {
    toc: ranges.toc.map((range) => ({ from: changes.mapPos(range.from), to: changes.mapPos(range.to) })),
    hrs: ranges.hrs.map((range) => ({ from: changes.mapPos(range.from), to: changes.mapPos(range.to) })),
    frontMatter: ranges.frontMatter
      ? {
        ...ranges.frontMatter,
        from: changes.mapPos(ranges.frontMatter.from),
        to: changes.mapPos(ranges.frontMatter.to),
      }
      : null,
  };
}

function patchBlockExtraRangesNearChanges(
  doc: Text,
  ranges: BlockExtraRanges,
  changes: ChangeSet,
): BlockExtraRanges {
  let fromB = Number.POSITIVE_INFINITY;
  let toB = 0;
  changes.iterChanges((_fromA, _toA, nextFrom, nextTo) => {
    fromB = Math.min(fromB, nextFrom);
    toB = Math.max(toB, nextTo);
  });
  if (!Number.isFinite(fromB)) return mapBlockExtraRanges(ranges, changes);
  const startLine = Math.max(1, doc.lineAt(Math.min(fromB, doc.length)).number - 1);
  const endLine = Math.min(doc.lines, doc.lineAt(Math.min(toB, doc.length)).number + 1);
  const affectedFrom = doc.line(startLine).from;
  const affectedTo = doc.line(endLine).to;
  const mapped = mapBlockExtraRanges(ranges, changes);
  const scanned = scanBlockExtraLineRanges(doc, startLine, endLine);
  return {
    toc: [
      ...mapped.toc.filter((range) => range.to < affectedFrom || range.from > affectedTo),
      ...scanned.toc,
    ].sort((a, b) => a.from - b.from || a.to - b.to),
    hrs: [
      ...mapped.hrs.filter((range) => range.to < affectedFrom || range.from > affectedTo),
      ...scanned.hrs,
    ].sort((a, b) => a.from - b.from || a.to - b.to),
    frontMatter: mapped.frontMatter,
  };
}

class OrgEnvOpenWidget extends WidgetType {
  kind: string;
  title: string;
  anchor: number;
  depth: number;

  constructor(kind: string, title: string, anchor: number, depth: number) {
    super();
    this.kind = kind;
    this.title = title;
    this.anchor = anchor;
    this.depth = depth;
  }

  eq(other: OrgEnvOpenWidget): boolean {
    return this.kind === other.kind
      && this.title === other.title
      && this.anchor === other.anchor
      && this.depth === other.depth;
  }

  toDOM(view: EditorView): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-org-env-heading-widget org-env-heading";
    div.dataset.orgEnvKind = this.kind;
    div.style.setProperty("--org-env-depth", String(this.depth));
    div.dataset.label = envLabel(this.kind);
    const label = document.createElement("span");
    label.className = "cm-org-env-label org-env-heading-label";
    label.textContent = envLabel(this.kind);
    const title = document.createElement("span");
    title.className = "org-env-heading-title";
    title.dataset.empty = this.title ? "false" : "true";
    title.textContent = this.title;
    div.append(label, title);
    div.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ selection: { anchor: this.anchor }, scrollIntoView: true });
      view.focus();
    });
    return div;
  }

  ignoreEvent(): boolean { return false; }
}

class OrgEnvEndWidget extends WidgetType {
  kind: string;
  depth: number;

  constructor(kind: string, depth: number) {
    super();
    this.kind = kind;
    this.depth = depth;
  }

  eq(other: OrgEnvEndWidget): boolean {
    return this.kind === other.kind && this.depth === other.depth;
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-org-env-end-widget";
    div.dataset.orgEnvKind = this.kind;
    div.style.setProperty("--org-env-depth", String(this.depth));
    return div;
  }

  ignoreEvent(): boolean { return false; }
}

function envLabel(kind: string): string {
  const labels: Record<string, string> = {
    html: "HTML",
    meta: "Meta",
    theorem: "Theorem",
    thm: "Theorem",
    definition: "Definition",
    defn: "Definition",
    lemma: "Lemma",
    corollary: "Corollary",
    cor: "Corollary",
    proposition: "Proposition",
    prop: "Proposition",
    property: "Property",
    proof: "Proof",
    example: "Example",
    attention: "Attention",
    warning: "Warning",
    note: "Note",
    info: "Info",
    comment: "Comment",
    summary: "Summary",
    lean4: "Lean 4",
  };
  return labels[kind] ?? kind;
}

class MetaWidget extends WidgetType {
  body: string;
  from: number;
  to: number;

  constructor(body: string, from: number, to: number) {
    super();
    this.body = body;
    this.from = from;
    this.to = to;
  }

  eq(other: MetaWidget): boolean {
    return this.body === other.body && this.from === other.from && this.to === other.to;
  }

  toDOM(view: EditorView): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-org-env-block org-env-block";
    setSourceRange(div, this.from, this.to);
    div.setAttribute("data-kind", "meta");
    div.dataset.label = envLabel("meta");
    renderMetaWidget(div, view, this.body, this.from, this.to);
    return div;
  }

  ignoreEvent(): boolean { return true; }
}

class CommentWidget extends WidgetType {
  title: string;
  body: string;
  from: number;
  to: number;
  depth: number;

  constructor(title: string, body: string, from: number, to: number, depth: number) {
    super();
    this.title = title;
    this.body = body;
    this.from = from;
    this.to = to;
    this.depth = depth;
  }

  eq(other: CommentWidget): boolean {
    return this.title === other.title
      && this.body === other.body
      && this.from === other.from
      && this.to === other.to
      && this.depth === other.depth;
  }

  toDOM(): HTMLElement {
    const block = document.createElement("org-env-block");
    block.className = "cm-org-env-comment-widget org-env-block";
    setSourceRange(block, this.from, this.to);
    block.dataset.cmOpenSource = "true";
    block.setAttribute("data-kind", "comment");
    block.setAttribute("data-title", this.title);
    block.setAttribute("data-label", envLabel("comment"));
    block.setAttribute("data-comment-open", "false");
    block.style.setProperty("--org-env-depth", String(this.depth));

    const button = document.createElement("button");
    button.type = "button";
    button.className = "org-env-comment-button";
    button.setAttribute("aria-expanded", "false");
    const label = document.createElement("span");
    label.className = "org-env-comment-label";
    label.textContent = this.title.trim() || "comment";
    const state = document.createElement("span");
    state.className = "org-env-comment-state";
    state.textContent = "show";
    button.append(label, state);
    button.addEventListener("mousedown", stopEditorPropagation);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = content.hidden === true;
      content.hidden = !open;
      block.classList.toggle("org-env-comment-open", open);
      block.setAttribute("data-comment-open", open ? "true" : "false");
      button.setAttribute("aria-expanded", open ? "true" : "false");
      state.textContent = open ? "hide" : "show";
    });

    const content = document.createElement("div");
    content.className = "org-env-content";
    content.hidden = true;
    content.innerHTML = renderMarkdownHTML(this.body.trim());
    enhanceRenderedMarkdown(content);
    stopInteractiveWidgetEvents(content);

    block.append(button, content);
    return block;
  }

  ignoreEvent(): boolean { return false; }
}

class HtmlWidget extends WidgetType {
  body: string;
  from: number;
  to: number;

  constructor(body: string, from: number, to: number) {
    super();
    this.body = body;
    this.from = from;
    this.to = to;
  }

  eq(other: HtmlWidget): boolean {
    return this.body === other.body && this.from === other.from && this.to === other.to;
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-html-env-widget";
    setSourceRange(div, this.from, this.to);
    div.innerHTML = renderMarkdownHTML(buildOrgEnvSource("html", "", this.body));
    stopInteractiveWidgetEvents(div);
    return div;
  }

  ignoreEvent(): boolean { return true; }
}

function renderMetaWidget(
  root: HTMLElement,
  view: EditorView,
  body: string,
  from: number,
  to: number,
): void {
  const meta = document.createElement("div");
  meta.className = "org-env-meta aaronnote-meta-cover";
  const entries = parseMetaEntries(body);

  if (entries.length === 0) {
    const empty = document.createElement("span");
    empty.className = "org-env-meta-empty";
    empty.textContent = "No metadata";
    meta.append(empty);
    root.append(meta);
    return;
  }

  const writeMeta = (): void => {
    const lines = Array.from(meta.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".org-env-meta-value"))
      .map((input) => `${input.dataset.key}: ${input.value.trim()}`);
    view.dispatch({
      changes: { from, to, insert: buildOrgEnvSource("meta", "", lines.join("\n")) },
    });
  };

  function makeInput(entry: { key: string; value: string }, className: string, label: string): HTMLInputElement;
  function makeInput(
    entry: { key: string; value: string },
    className: string,
    label: string,
    multiline: true,
  ): HTMLTextAreaElement;
  function makeInput(
    entry: { key: string; value: string },
    className: string,
    label: string,
    multiline = false,
  ): HTMLInputElement | HTMLTextAreaElement {
    const value = multiline ? document.createElement("textarea") : document.createElement("input");
    value.className = `org-env-meta-value ${className}`;
    value.setAttribute("aria-label", label);
    value.spellcheck = false;
    value.value = entry.value;
    value.dataset.key = entry.key;
    if (value instanceof HTMLInputElement) {
      value.type = "text";
    } else {
      value.rows = 1;
      value.wrap = "soft";
    }
    const resize = (): void => {
      if (!(value instanceof HTMLTextAreaElement)) return;
      value.style.height = "auto";
      value.style.height = `${value.scrollHeight}px`;
    };
    value.addEventListener("mousedown", stopEditorPropagation);
    value.addEventListener("click", stopEditorPropagation);
    value.addEventListener("beforeinput", stopEditorPropagation);
    value.addEventListener("input", (event) => {
      event.stopPropagation();
      resize();
    });
    value.addEventListener("keyup", stopEditorPropagation);
    value.addEventListener("paste", stopEditorPropagation);
    value.addEventListener("cut", stopEditorPropagation);
    value.addEventListener("blur", writeMeta);
    const handleKeydown = (event: Event): void => {
      const keyEvent = event as KeyboardEvent;
      event.stopPropagation();
      if (keyEvent.key === "Enter") {
        event.preventDefault();
        writeMeta();
        view.focus();
      }
    };
    value.addEventListener("keydown", handleKeydown);
    queueMicrotask(resize);
    return value;
  }

  const byKey = metaEntryMap(entries);
  const titleEntry = entries.find((entry) => entry.key.toLowerCase() === "title");
  const dateEntry = entries.find((entry) => entry.key.toLowerCase() === "date");
  const tagsEntry = entries.find((entry) => entry.key.toLowerCase() === "tags");
  const sourceEntry = entries.find((entry) => entry.key.toLowerCase() === "source");

  if (titleEntry) {
    meta.append(makeInput(titleEntry, "aaronnote-meta-title", "Title", true));
  } else {
    const title = document.createElement("h1");
    title.className = "aaronnote-meta-title";
    title.textContent = "Untitled";
    meta.append(title);
  }

  if (dateEntry) {
    meta.append(makeInput(dateEntry, "aaronnote-meta-date", "Date"));
  }

  const tagValues = metaTags(byKey.get("tags") || "");
  const visibleTagValues = tagValues.filter(showMetaTag);
  if (tagsEntry || tagValues.length > 0) {
    const tags = document.createElement("nav");
    tags.className = "aaronnote-meta-tags";
    tags.setAttribute("aria-label", "Tags");
    for (const tagValue of visibleTagValues) {
      const tag = document.createElement("button");
      tag.type = "button";
      tag.className = "aaronnote-meta-tag";
      tag.textContent = `#${tagValue}`;
      tag.addEventListener("mousedown", stopEditorPropagation);
      tag.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        document.dispatchEvent(new CustomEvent("knowledge:apply-tag", { detail: { tag: tagValue } }));
      });
      tags.append(tag);
    }
    if (tagsEntry) {
      const tagInput = makeInput(tagsEntry, "aaronnote-meta-hidden", "Tags");
      tagInput.type = "hidden";
      meta.append(tagInput);
    }
    if (visibleTagValues.length > 0) {
      meta.append(tags);
    }
  }

  if (sourceEntry) {
    const source = makeInput(sourceEntry, "aaronnote-meta-hidden", "Source");
    source.type = "hidden";
    meta.append(source);
  }

  const shownKeys = new Set(["title", "date", "tags", "source"]);
  for (const entry of entries) {
    if (shownKeys.has(entry.key.toLowerCase())) continue;
    const hidden = makeInput(entry, "aaronnote-meta-hidden", entry.key);
    hidden.type = "hidden";
    meta.append(hidden);
  }

  root.append(meta);
}

class FrontMatterWidget extends WidgetType {
  body: string;
  from: number;
  to: number;

  constructor(body: string, from: number, to: number) {
    super();
    this.body = body;
    this.from = from;
    this.to = to;
  }

  eq(other: FrontMatterWidget): boolean {
    return this.body === other.body && this.from === other.from && this.to === other.to;
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "cm-front-matter-block";
    setSourceRange(div, this.from, this.to);
    const label = document.createElement("span");
    label.className = "cm-front-matter-label";
    label.textContent = "YAML";
    const content = document.createElement("pre");
    content.className = "cm-front-matter-content";
    content.textContent = this.body.trim();
    div.append(label, content);
    return div;
  }

  ignoreEvent(): boolean { return false; }
}

class HorizontalRuleWidget extends WidgetType {
  from: number;
  to: number;

  constructor(from: number, to: number) {
    super();
    this.from = from;
    this.to = to;
  }

  eq(other: HorizontalRuleWidget): boolean {
    return this.from === other.from && this.to === other.to;
  }

  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-horizontal-rule";
    setSourceRange(hr, this.from, this.to);
    return hr;
  }

  ignoreEvent(): boolean { return false; }
}

function selectionTouchesRange(state: EditorState, from: number, to: number): boolean {
  const sel = state.selection.main;
  if (sel.empty) return sel.from >= from && sel.from <= to;
  return sel.from < to && sel.to > from;
}

function addOrgEnvBoundaryDecos(
  decos: CMRange<Decoration>[],
  state: EditorState,
  block: OrgEnvBlock,
): void {
  const openActive = selectionTouchesRange(state, block.openFrom, block.openTo);
  const closeActive = selectionTouchesRange(state, block.closeFrom, block.closeTo)
    && state.selection.main.from > block.closeFrom;

  if (!openActive) {
    decos.push(
      Decoration.replace({
        widget: new OrgEnvOpenWidget(block.kind, block.title, block.titleAnchor, block.depth),
        block: true,
      }).range(block.openFrom, block.openTo),
    );
  } else {
    decos.push(Decoration.mark({ class: "syntax-hint" }).range(block.openFrom, block.openTo));
  }

  if (!closeActive) {
    decos.push(
      Decoration.replace({
        widget: new OrgEnvEndWidget(block.kind, block.depth),
        block: true,
      }).range(block.closeFrom, block.closeTo),
    );
  } else {
    decos.push(Decoration.mark({ class: "syntax-hint" }).range(block.closeFrom, block.closeTo));
  }
}

interface OrgEnvRailMeasure {
  kind: string;
  depth: number;
  top: number;
  height: number;
  left: number;
}

const orgEnvBlocksField = StateField.define<readonly OrgEnvBlock[]>({
  create: (state) => scanOrgEnvBlocks(state.doc.toString(), 0, 0, getBlockMathRanges(state)),
  update(blocks, tr) {
    if (!tr.docChanged) return blocks;
    if (!canMapOrgEnvBlocks(tr.startState.doc, blocks, tr.changes)) {
      return patchOrgEnvBlocksForTitleChange(tr.startState.doc, tr.state.doc, blocks, tr.changes)?.blocks
        ?? scanOrgEnvBlocks(tr.state.doc.toString(), 0, 0, getBlockMathRanges(tr.state));
    }
    return blocks.map((block) => mapOrgEnvBlock(block, tr.changes, tr.state.doc));
  },
});

function orgEnvBlocksFromState(state: EditorState): readonly OrgEnvBlock[] {
  return state.field(orgEnvBlocksField, false) ?? scanOrgEnvBlocks(state.doc.toString(), 0, 0, getBlockMathRanges(state));
}

function canMapOrgEnvBlocks(doc: Text, blocks: readonly OrgEnvBlock[], changes: ChangeSet): boolean {
  let canMap = true;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!canMap) return;
    const removed = doc.sliceString(fromA, toA);
    const added = inserted.toString();
    if (/^\s*#\+(?:begin|end)\b/im.test(removed) || /^\s*#\+(?:begin|end)\b/im.test(added)) {
      canMap = false;
      return;
    }
    if (blocks.some((block) => (
      (fromA <= block.openTo && toA >= block.openFrom)
      || (fromA <= block.closeTo && toA >= block.closeFrom)
    ))) {
      canMap = false;
      return;
    }
    if (blocks.some((block) => block.kind === "meta" && fromA <= block.to && toA >= block.from)) {
      canMap = false;
    }
  });
  return canMap;
}

function mapOrgEnvBlock(block: OrgEnvBlock, changes: ChangeSet, doc: Text): OrgEnvBlock {
  const bodyFrom = changes.mapPos(block.bodyFrom);
  const bodyTo = changes.mapPos(block.bodyTo);
  return {
    ...block,
    from: changes.mapPos(block.from),
    to: changes.mapPos(block.to),
    openFrom: changes.mapPos(block.openFrom),
    openTo: changes.mapPos(block.openTo),
    bodyFrom,
    bodyTo,
    closeFrom: changes.mapPos(block.closeFrom),
    closeTo: changes.mapPos(block.closeTo),
    body: doc.sliceString(bodyFrom, bodyTo),
    titleAnchor: changes.mapPos(block.titleAnchor),
  };
}

function patchOrgEnvBlocksForTitleChange(
  oldDoc: Text,
  newDoc: Text,
  blocks: readonly OrgEnvBlock[],
  changes: ChangeSet,
): OrgEnvTitlePatch | null {
  let changeCount = 0;
  let fromA = 0;
  let toA = 0;
  let insertedText = "";
  changes.iterChanges((changeFromA, changeToA, _nextFrom, _nextTo, inserted) => {
    changeCount++;
    fromA = changeFromA;
    toA = changeToA;
    insertedText = inserted.toString();
  });
  if (changeCount !== 1) return null;

  const removed = oldDoc.sliceString(fromA, toA);
  if (removed.includes("\n") || insertedText.includes("\n")) return null;
  if (/^\s*#\+(?:begin|end)\b/im.test(removed) || /^\s*#\+(?:begin|end)\b/im.test(insertedText)) {
    return null;
  }

  const touchedBlocks = blocks.filter((block) => (
    block.kind !== "meta"
    && fromA <= block.openTo
    && toA >= block.openFrom
  ));
  if (touchedBlocks.length !== 1) return null;

  const oldBlock = touchedBlocks[0]!;
  const oldLine = oldDoc.lineAt(oldBlock.openFrom);
  if (oldLine.from !== oldBlock.openFrom || oldLine.to !== oldBlock.openTo) return null;
  const oldInfo = parseOrgEnvOpenLine(oldLine.text);
  if (!oldInfo || oldInfo.kind !== oldBlock.kind) return null;

  const changeLine = oldDoc.lineAt(Math.min(fromA, oldDoc.length));
  const changeEndLine = oldDoc.lineAt(Math.min(Math.max(fromA, toA), oldDoc.length));
  if (changeLine.number !== oldLine.number || changeEndLine.number !== oldLine.number) return null;

  if (oldBlock.title.length > 0) {
    if (fromA < oldBlock.titleAnchor || toA > oldBlock.openTo) return null;
  } else if (fromA !== oldBlock.openTo || !/^[ \t]/.test(insertedText)) {
    return null;
  }

  const mappedBlocks = blocks.map((block) => mapOrgEnvBlock(block, changes, newDoc));
  const touchedIndex = blocks.indexOf(oldBlock);
  const mappedBlock = mappedBlocks[touchedIndex]!;
  const newLine = newDoc.lineAt(mappedBlock.openFrom);
  if (newLine.from !== mappedBlock.openFrom) return null;
  const newInfo = parseOrgEnvOpenLine(newLine.text);
  if (!newInfo || newInfo.kind !== oldBlock.kind) return null;

  const newBlock: OrgEnvBlock = {
    ...mappedBlock,
    openFrom: newLine.from,
    openTo: newLine.to,
    bodyFrom: Math.min(newLine.to + 1, newDoc.length),
    kind: newInfo.kind,
    title: newInfo.title,
    titleAnchor: newLine.from + newInfo.titleAnchor,
  };
  const nextBlocks = mappedBlocks.map((block, index) => index === touchedIndex ? newBlock : block);
  return { blocks: nextBlocks, newBlock };
}

class OrgEnvRailPlugin {
  layer: HTMLElement;

  constructor(view: EditorView) {
    this.layer = document.createElement("div");
    this.layer.className = "cm-org-env-rail-layer";
    view.dom.append(this.layer);
    this.schedule(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.geometryChanged) {
      this.schedule(update.view);
    }
  }

  destroy(): void {
    this.layer.remove();
  }

  private schedule(view: EditorView): void {
    view.requestMeasure({
      read: () => measureOrgEnvRails(view),
      write: (rails) => this.writeRails(rails),
    });
  }

  private writeRails(rails: OrgEnvRailMeasure[]): void {
    const next = document.createDocumentFragment();
    for (const rail of rails) {
      if (rail.height <= 0) continue;
      const div = document.createElement("div");
      div.className = "cm-org-env-rail";
      div.dataset.orgEnvKind = rail.kind;
      div.dataset.orgEnvDepth = String(rail.depth);
      div.style.left = `${rail.left}px`;
      div.style.top = `${rail.top}px`;
      div.style.height = `${rail.height}px`;
      next.append(div);
    }
    this.layer.replaceChildren(next);
  }
}

function buildOrgEnvBodyLineDecoRanges(
  state: EditorState,
  startLine = 1,
  endLine = state.doc.lines,
): CMRange<Decoration>[] {
  const decos: CMRange<Decoration>[] = [];
  const lineBlocks = new Map<number, OrgEnvBlock>();
  const doc = state.doc;
  const firstLine = Math.max(1, startLine);
  const lastLine = Math.min(doc.lines, endLine);
  if (firstLine > lastLine) return decos;
  const windowFrom = doc.line(firstLine).from;
  const windowTo = doc.line(lastLine).to;

  for (const block of orgEnvBlocksFromState(state)) {
    if (block.kind === "meta") continue;
    if (block.bodyTo < windowFrom || block.bodyFrom > windowTo) continue;
    const fromLine = doc.lineAt(Math.max(block.bodyFrom, windowFrom));
    const toLine = doc.lineAt(Math.min(block.bodyTo, windowTo));
    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = doc.line(lineNum);
      if (line.from >= block.closeFrom) break;
      if (line.to < block.bodyFrom) continue;
      const current = lineBlocks.get(line.from);
      if (!current || block.depth >= current.depth) {
        lineBlocks.set(line.from, block);
      }
    }
  }

  for (const [lineFrom, block] of lineBlocks) {
    decos.push(
      Decoration.line({
        attributes: {
          class: "cm-org-env-line cm-org-env-body-line",
          "data-org-env-kind": block.kind,
          "data-org-env-depth": String(block.depth),
          style: `--org-env-depth: ${block.depth};`,
        },
      }).range(lineFrom),
    );
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return decos;
}

function buildOrgEnvBodyLineDecos(state: EditorState): DecorationSet {
  return Decoration.set(buildOrgEnvBodyLineDecoRanges(state), true);
}

const orgEnvBodyLineDecorations = StateField.define<DecorationSet>({
  create: (state) => buildOrgEnvBodyLineDecos(state),
  update(value, tr) {
    if (tr.docChanged) {
      const blocks = tr.startState.field(orgEnvBlocksField, false) ?? orgEnvBlocksFromState(tr.startState);
      if (
        canMapOrgEnvBlocks(tr.startState.doc, blocks, tr.changes)
        || patchOrgEnvBlocksForTitleChange(tr.startState.doc, tr.state.doc, blocks, tr.changes)
      ) {
        const mapped = value.map(tr.changes);
        return changesContainNewline(tr.startState.doc, tr.changes)
          ? patchOrgEnvBodyLineDecosNearChanges(tr.state, mapped, tr.changes)
          : mapped;
      }
      return buildOrgEnvBodyLineDecos(tr.state);
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function patchOrgEnvBodyLineDecosNearChanges(
  state: EditorState,
  mapped: DecorationSet,
  changes: ChangeSet,
): DecorationSet {
  let fromB = Number.POSITIVE_INFINITY;
  let toB = 0;
  changes.iterChanges((_fromA, _toA, nextFrom, nextTo) => {
    fromB = Math.min(fromB, nextFrom);
    toB = Math.max(toB, nextTo);
  });
  if (!Number.isFinite(fromB)) return mapped;
  const centerFrom = state.doc.lineAt(Math.min(fromB, state.doc.length)).number;
  const centerTo = state.doc.lineAt(Math.min(toB, state.doc.length)).number;
  const startLine = Math.max(1, centerFrom - 1);
  const endLine = Math.min(state.doc.lines, centerTo + 1);
  const affectedFrom = state.doc.line(startLine).from;
  const affectedTo = state.doc.line(endLine).to;
  return mapped
    .update({ filterFrom: affectedFrom, filterTo: affectedTo, filter: () => false })
    .update({ add: buildOrgEnvBodyLineDecoRanges(state, startLine, endLine), sort: true });
}

function measureOrgEnvRails(view: EditorView): OrgEnvRailMeasure[] {
  const viewportBlocks = view.viewportLineBlocks;
  if (viewportBlocks.length === 0) return [];

  const viewRect = view.dom.getBoundingClientRect();
  const contentRect = view.contentDOM.getBoundingClientRect();
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const depthStep = rootFontSize * 1.1;
  const baseLeft = contentRect.left - viewRect.left;
  const docTop = view.documentTop - viewRect.top;
  const visibleFrom = Math.min(...view.visibleRanges.map((range) => range.from));
  const visibleTo = Math.max(...view.visibleRanges.map((range) => range.to));
  const visibleTop = docTop + viewportBlocks[0]!.top;
  const visibleBottom = docTop + viewportBlocks[viewportBlocks.length - 1]!.bottom;

  return orgEnvBlocksFromState(view.state)
    .filter((block) => (
      block.kind !== "meta"
      && block.kind !== "comment"
      && block.kind !== "html"
      && block.openFrom <= visibleTo
      && block.closeTo >= visibleFrom
    ))
    .map((block) => {
      const openVisible = block.openFrom >= visibleFrom && block.openFrom <= visibleTo;
      const closeVisible = block.closeTo >= visibleFrom && block.closeTo <= visibleTo;
      const top = openVisible ? docTop + view.lineBlockAt(block.openFrom).top : visibleTop;
      const bottom = closeVisible
        ? docTop + view.lineBlockAt(block.closeFrom).bottom
        : visibleBottom;
      return {
        kind: block.kind,
        depth: block.depth,
        top,
        height: Math.max(0, bottom - top),
        left: baseLeft + block.depth * depthStep,
      };
    });
}

// ---------------------------------------------------------------------------
// Decoration builder (full-doc scan — these constructs are sparse)
// ---------------------------------------------------------------------------

function addOrgEnvBlockExtraDecos(
  decos: CMRange<Decoration>[],
  occupied: Array<[number, number]> | null,
  state: EditorState,
  block: OrgEnvBlock,
): void {
  if (block.kind === "meta") {
    decos.push(
      Decoration.replace({
        widget: new MetaWidget(block.body, block.from, block.to),
        block: true,
      }).range(block.from, block.to),
    );
    occupied?.push([block.from, block.to]);
    return;
  }
  if (block.kind === "html") {
    decos.push(
      Decoration.replace({
        widget: new HtmlWidget(block.body, block.from, block.to),
        block: true,
      }).range(block.from, block.to),
    );
    occupied?.push([block.from, block.to]);
    return;
  }
  if (block.kind === "comment" && !selectionTouchesRange(state, block.from, block.to)) {
    decos.push(
      Decoration.replace({
        widget: new CommentWidget(block.title, block.body, block.from, block.to, block.depth),
        block: true,
      }).range(block.from, block.to),
    );
    occupied?.push([block.from, block.to]);
    return;
  }
  addOrgEnvBoundaryDecos(decos, state, block);
}

function buildBlockExtraDecos(state: EditorState): DecorationSet {
  const decos: CMRange<Decoration>[] = [];
  const occupied: Array<[number, number]> = [];
  const sel = state.selection.main;
  const blockMathRanges = getBlockMathRanges(state);
  const headings = state.field(headingsField, false) ?? collectHeadings(state);
  const ranges = state.field(blockExtraRangesField, false) ?? scanBlockExtraRanges(state.doc);

  // ── [toc] ──────────────────────────────────────────────────────────────
  for (const range of ranges.toc) {
    if (rangeOverlapsAny(range.from, range.to, blockMathRanges)) continue;
    if (!(sel.from <= range.to && sel.to >= range.from)) {
      decos.push(
        Decoration.replace({ widget: new TocWidget([...headings]), block: true }).range(range.from, range.to),
      );
      occupied.push([range.from, range.to]);
    }
  }

  // ── org-env #+begin … #+end ────────────────────────────────────────────
  // Org-env is intentionally not a nested editor. The body remains normal CM6
  // markdown so snippets, math widgets, cursor movement, and editing behavior
  // are identical to the surrounding document; only the boundary lines render
  // as UI chrome.
  const orgEnvBlocks = orgEnvBlocksFromState(state);
  for (const block of orgEnvBlocks) {
    addOrgEnvBlockExtraDecos(decos, occupied, state, block);
  }

  // ── YAML front matter (only at offset 0) ───────────────────────────────
  const frontMatter = ranges.frontMatter;
  if (frontMatter) {
    const { from, to, body } = frontMatter;
    if (!rangeOverlapsAny(from, to, blockMathRanges) && !(sel.from < to && sel.to > from)) {
      decos.push(
        Decoration.replace({ widget: new FrontMatterWidget(body, from, to), block: true }).range(from, to),
      );
      occupied.push([from, to]);
    }
  }

  // ── Horizontal rule ────────────────────────────────────────────────────
  for (const range of ranges.hrs) {
    if (rangeOverlapsAny(range.from, range.to, blockMathRanges)) continue;
    if (occupied.some(([from, to]) => range.from < to && range.to > from)) continue;
    if (sel.from >= range.from && sel.from <= range.to) {
      decos.push(Decoration.mark({ class: "syntax-hint" }).range(range.from, range.to));
      continue;
    }
    decos.push(
      Decoration.replace({ widget: new HorizontalRuleWidget(range.from, range.to), block: true }).range(range.from, range.to),
    );
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decos, true);
}

function changesContainNewline(doc: Text, changes: ChangeSet): boolean {
  let found = false;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (found) return;
    found = doc.sliceString(fromA, toA).includes("\n") || inserted.toString().includes("\n");
  });
  return found;
}

function changesTouchRange(changes: ChangeSet, from: number, to: number): boolean {
  let touched = false;
  changes.iterChanges((fromA, toA) => {
    if (touched) return;
    touched = fromA <= to && toA >= from;
  });
  return touched;
}

function activeBlockExtraKey(state: EditorState): string {
  const sel = state.selection.main;
  const parts: string[] = [];
  const ranges = state.field(blockExtraRangesField, false) ?? scanBlockExtraRanges(state.doc);
  const blocks = orgEnvBlocksFromState(state);

  for (const range of ranges.toc) {
    if (sel.from <= range.to && sel.to >= range.from) parts.push(`toc:${range.from}:${range.to}`);
  }
  if (ranges.frontMatter && sel.from < ranges.frontMatter.to && sel.to > ranges.frontMatter.from) {
    parts.push(`front:${ranges.frontMatter.from}:${ranges.frontMatter.to}`);
  }
  for (const range of ranges.hrs) {
    if (sel.from >= range.from && sel.from <= range.to) parts.push(`hr:${range.from}:${range.to}`);
  }
  for (const block of blocks) {
    if (block.kind === "comment" && selectionTouchesRange(state, block.from, block.to)) {
      parts.push(`comment:${block.from}:${block.to}`);
      continue;
    }
    if (selectionTouchesRange(state, block.openFrom, block.openTo)) {
      parts.push(`org-open:${block.openFrom}:${block.openTo}`);
    }
    if (selectionTouchesRange(state, block.closeFrom, block.closeTo)) {
      parts.push(`org-close:${block.closeFrom}:${block.closeTo}`);
    }
  }
  return parts.join("|");
}

function canMapBlockExtraDecos(state: EditorState, changes: ChangeSet): boolean {
  const ranges = state.field(blockExtraRangesField, false) ?? scanBlockExtraRanges(state.doc);
  const blocks = state.field(orgEnvBlocksField, false) ?? orgEnvBlocksFromState(state);

  if (!canMapHeadings(state.doc, changes)) return false;
  if (!canMapBlockExtraRanges(state.doc, changes, ranges)) return false;
  if (!canMapOrgEnvBlocks(state.doc, blocks, changes)) return false;

  if (ranges.toc.some((range) => changesTouchRange(changes, range.from, range.to))) return false;
  if (ranges.hrs.some((range) => changesTouchRange(changes, range.from, range.to))) return false;
  if (ranges.frontMatter && changesTouchRange(changes, ranges.frontMatter.from, ranges.frontMatter.to)) return false;
  if (blocks.some((block) => (
    (block.kind === "meta" || block.kind === "comment" || block.kind === "html") && changesTouchRange(changes, block.from, block.to)
  ))) {
    return false;
  }

  return true;
}

function patchBlockExtraDecosForOrgEnvTitleChange(
  state: EditorState,
  mapped: DecorationSet,
  block: OrgEnvBlock,
): DecorationSet {
  const decos: CMRange<Decoration>[] = [];
  addOrgEnvBlockExtraDecos(decos, null, state, block);
  decos.sort((a, b) => a.from - b.from || a.to - b.to);

  const commentWidgetActive = block.kind === "comment" && !selectionTouchesRange(state, block.from, block.to);
  let next = commentWidgetActive
    ? mapped.update({ filterFrom: block.from, filterTo: block.to, filter: () => false })
    : mapped
        .update({ filterFrom: block.openFrom, filterTo: block.openTo, filter: () => false })
        .update({ filterFrom: block.closeFrom, filterTo: block.closeTo, filter: () => false });
  next = next.update({ add: decos, sort: true });
  return next;
}

function scanFrontMatter(doc: Text): { from: number; to: number; body: string } | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null;
  const bodyLines: string[] = [];
  for (let lineNum = 2; lineNum <= doc.lines; lineNum++) {
    const line = doc.line(lineNum);
    if (line.text.trim() === "---") {
      return { from: 0, to: line.to, body: bodyLines.join("\n") };
    }
    bodyLines.push(line.text);
  }
  return null;
}

// ---------------------------------------------------------------------------
// StateField export
// ---------------------------------------------------------------------------

const blockExtrasDecorations = StateField.define<DecorationSet>({
  create: (state) => buildBlockExtraDecos(state),
  update(value, tr) {
    if (tr.docChanged) {
      if (canMapBlockExtraDecos(tr.startState, tr.changes)) {
        return value.map(tr.changes);
      }
      const blocks = tr.startState.field(orgEnvBlocksField, false) ?? orgEnvBlocksFromState(tr.startState);
      const titlePatch = patchOrgEnvBlocksForTitleChange(tr.startState.doc, tr.state.doc, blocks, tr.changes);
      return titlePatch
        ? patchBlockExtraDecosForOrgEnvTitleChange(tr.state, value.map(tr.changes), titlePatch.newBlock)
        : buildBlockExtraDecos(tr.state);
    }
    if (tr.selection != null && activeBlockExtraKey(tr.startState) !== activeBlockExtraKey(tr.state)) {
      return buildBlockExtraDecos(tr.state);
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const orgEnvRailExtension = ViewPlugin.fromClass(OrgEnvRailPlugin);

export const blockExtrasExtension: Extension = [
  headingsField,
  blockExtraRangesField,
  orgEnvBlocksField,
  blockExtrasDecorations,
  orgEnvBodyLineDecorations,
  orgEnvRailExtension,
];
