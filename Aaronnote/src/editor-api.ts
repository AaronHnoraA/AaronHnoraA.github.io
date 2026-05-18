// Public façade. Consumers see only `createEditor()` and the small
// `Editor` controller it returns; ProseMirror is an implementation
// detail.
//
// Two surfaces are intentionally exposed:
//   - the high-level controller (getMarkdown / setMarkdown /
//     toggleSource / focus / destroy) is the supported API.
//   - `editor.view` is an escape hatch onto the underlying PM
//     EditorView for advanced cases (custom plugins, deep PM hooks).
//     Documented as "no warranty" — touching it is opt-in.
//
// Source-mode toggle (rendered ↔ raw markdown textarea) is built in.
// `⌘/` (Mac) or `Ctrl+/` (other) is wired automatically; consumers
// can also call `editor.toggleSource()` directly.

import { EditorState, Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { redo, undo } from "prosemirror-history";
import { DOMSerializer, type Node as PMNode } from "prosemirror-model";

import { defaultPlugins } from "./editor.ts";
import { cleanEditorHTML } from "./export-html.ts";
import { htmlToMarkdown } from "./paste-html.ts";
import { parse } from "./parser.ts";
import { schema } from "./schema.ts";
import { serialize } from "./serializer.ts";

export function normalizePastedSourceText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0008/g, String.raw`\b`)
    .replace(/\u000c/g, String.raw`\f`)
    .replace(/\u000b/g, String.raw`\v`);
}

export interface EditorOptions {
  /** Initial markdown the editor opens with. Defaults to empty. */
  initialContent?: string;
  /** Fired on every document transaction; arg is the current markdown. Raw, no debounce. */
  onChange?: (md: string) => void;
  /** Fired when the editor surface (rendered or source) gains focus. */
  onFocus?: () => void;
  /** Fired when the editor surface loses focus. */
  onBlur?: () => void;
}

export type EditorCommand =
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "blockquote"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "code-block"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6"
  | "copy-code";

export type WritingModeOptions = {
  focusMode?: boolean;
  typewriterMode?: boolean;
};

const writingModeKey = new PluginKey<Required<WritingModeOptions>>("typoraWebWritingMode");

function writingModePlugin(): Plugin<Required<WritingModeOptions>> {
  return new Plugin<Required<WritingModeOptions>>({
    key: writingModeKey,
    state: {
      init: () => ({ focusMode: false, typewriterMode: false }),
      apply: (tr, value) => tr.getMeta(writingModeKey) ?? value,
    },
    props: {
      decorations(state) {
        const mode = writingModeKey.getState(state);
        if (!mode?.focusMode || !state.selection.empty) return DecorationSet.empty;
        const $from = state.selection.$from;
        for (let depth = 1; depth <= $from.depth; depth++) {
          const node = $from.node(depth);
          if (!node.isBlock) continue;
          const from = $from.before(depth);
          return DecorationSet.create(state.doc, [
            Decoration.node(from, from + node.nodeSize, { class: "typora-web-focus-block" }),
          ]);
        }
        return DecorationSet.empty;
      },
    },
  });
}

export interface Editor {
  /** Current markdown — renders source from the live PM doc, or returns the textarea contents in source mode. */
  getMarkdown(): string;
  /** Render the current document to HTML for clipboard/export integrations. */
  getHTML(): string;
  /** Replace the document. Works in either rendered or source mode. */
  setMarkdown(md: string): void;
  /** Insert plain source text at the current selection, optionally replacing chars before point. */
  insertText(text: string, deleteBefore?: number): { from: number; to: number };
  /** Select a range in the active surface. Offsets are source offsets in source mode, PM offsets otherwise. */
  setSelection(from: number, to?: number): void;
  /** Current active-surface selection. */
  getSelection(): { from: number; to: number };
  /** Reveal the active cursor in the viewport and briefly flash it. */
  revealCursor(): void;
  /** Plain active-surface text between offsets. */
  textBetween(from: number, to: number): string;
  /** Replace active-surface text between offsets. */
  replaceRange(from: number, to: number, text: string, select?: "start" | "end" | "all"): { from: number; to: number };
  /** Undo the active surface if possible. */
  undo(): boolean;
  /** Redo the active surface if possible. */
  redo(): boolean;
  /** Run a built-in MarkText-style editing command against the active surface. */
  runCommand(command: EditorCommand, value?: string): boolean;
  /** Toggle writing affordances without changing markdown. */
  setWritingMode(options: WritingModeOptions): void;
  /** Text and viewport rect around the active cursor, for completions/previews. */
  cursorContext(maxChars?: number): {
    before: string;
    after: string;
    rect: { left: number; top: number; bottom: number } | null;
    rectAtOffset: (offset: number) => { left: number; top: number; bottom: number } | null;
  };
  /** Flip between rendered and raw-source views. ⌘/ does the same. */
  toggleSource(): void;
  /** Whether the editor is currently in raw-source mode. */
  isSourceMode(): boolean;
  /** Focus whichever surface is active. */
  focus(): void;
  /** Tear down the editor and remove its DOM. */
  destroy(): void;
  /** Escape hatch: the live ProseMirror view. Advanced; no API stability promised on this access. */
  readonly view: EditorView;
}

export function createEditor(
  host: HTMLElement,
  options: EditorOptions = {},
): Editor {
  const wrap = document.createElement("div");
  wrap.className = "typora-web-wrap";
  const editorHost = document.createElement("div");
  editorHost.className = "typora-web-editor-host";
  const sourceTextarea = document.createElement("textarea");
  sourceTextarea.className = "typora-web-source";
  sourceTextarea.hidden = true;
  wrap.append(editorHost, sourceTextarea);
  host.append(wrap);
  const caretFlash = document.createElement("div");
  caretFlash.className = "typora-web-caret-flash";
  caretFlash.hidden = true;
  document.body.appendChild(caretFlash);

  let view: EditorView;
  let inSource = false;
  let sourceValueOnEnter = "";
  let caretFlashTimer = 0;
  let cachedDoc: PMNode | null = null;
  let cachedMarkdown: string | null = null;
  let markdownPrewarmHandle = 0;
  let markdownPrewarmIdle = false;
  let writingMode: Required<WritingModeOptions> = {
    focusMode: false,
    typewriterMode: false,
  };

  function markdownFromDoc(doc: PMNode): string {
    if (cachedDoc === doc && cachedMarkdown != null) return cachedMarkdown;
    const md = serialize(doc);
    cachedDoc = doc;
    cachedMarkdown = md;
    return md;
  }

  function cancelMarkdownPrewarm(): void {
    if (!markdownPrewarmHandle) return;
    if (markdownPrewarmIdle && window.cancelIdleCallback) {
      window.cancelIdleCallback(markdownPrewarmHandle);
    } else {
      window.clearTimeout(markdownPrewarmHandle);
    }
    markdownPrewarmHandle = 0;
    markdownPrewarmIdle = false;
  }

  function scheduleMarkdownPrewarm(doc: PMNode): void {
    cancelMarkdownPrewarm();
    const run = (): void => {
      markdownPrewarmHandle = 0;
      markdownPrewarmIdle = false;
      if (cachedDoc !== doc || cachedMarkdown == null) markdownFromDoc(doc);
    };
    if (window.requestIdleCallback) {
      markdownPrewarmIdle = true;
      markdownPrewarmHandle = window.requestIdleCallback(run, { timeout: 700 });
    } else {
      markdownPrewarmHandle = window.setTimeout(run, 160);
    }
  }

  function emitChange(md: string | (() => string)): void {
    if (!options.onChange) return;
    if (options.onChange.length === 0) {
      (options.onChange as () => void)();
      return;
    }
    options.onChange(typeof md === "function" ? md() : md);
  }

  function markdownFromClipboard(data: DataTransfer): string {
    const html = data.getData("text/html");
    if (html && /<[A-Za-z][\s\S]*>/.test(html)) {
      const md = htmlToMarkdown(html);
      if (md) return normalizePastedSourceText(md);
    }
    return normalizePastedSourceText(data.getData("text/plain"));
  }

  function buildView(initialMd: string): EditorView {
    const doc = initialMd ? parse(initialMd) : schema.nodes.doc.createAndFill()!;
    const base = EditorState.create({
      schema,
      doc,
      plugins: [...defaultPlugins({ cursorWidget: false }), writingModePlugin()],
    });
    // Fire one no-op transaction so normalize's appendTransaction runs
    // and method-B marks (em, strong, autolink, etc.) apply on first
    // render. EditorState.create alone runs `state.init` but not
    // `appendTransaction`, leaving parsed-from-seed docs with raw text.
    const state = base.apply(base.tr.setSelection(TextSelection.atStart(doc)));
    const v: EditorView = new EditorView(editorHost, {
      state,
      dispatchTransaction(tr) {
        const next = v.state.apply(tr);
        v.updateState(next);
        if (tr.docChanged) {
          scheduleMarkdownPrewarm(next.doc);
          emitChange(() => markdownFromDoc(next.doc));
        }
        if (writingMode.typewriterMode && (tr.docChanged || tr.selectionSet)) {
          window.requestAnimationFrame(() => revealRenderedCursor(true));
        }
      },
      handleDOMEvents: {
        focus: () => { options.onFocus?.(); return false; },
        blur: () => { options.onBlur?.(); return false; },
        keydown: (view, event) => {
          if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) return false;
          event.preventDefault();
          const indent = event.shiftKey ? "" : "  ";
          if (!indent) return true;
          const { from, to } = view.state.selection;
          view.dispatch(view.state.tr.insertText(indent, from, to).scrollIntoView());
          return true;
        },
        paste: (view, event) => {
          const data = event.clipboardData;
          if (!data || data.files.length > 0) return false;
          const text = markdownFromClipboard(data);
          if (!text) return false;
          event.preventDefault();
          const { from, to } = view.state.selection;
          view.dispatch(view.state.tr.insertText(text, from, to).scrollIntoView());
          return true;
        },
      },
    });
    return v;
  }

  function rebuild(md: string): void {
    view.destroy();
    editorHost.innerHTML = "";
    cachedDoc = null;
    cachedMarkdown = null;
    cancelMarkdownPrewarm();
    view = buildView(md);
    scheduleMarkdownPrewarm(view.state.doc);
    if (writingMode.focusMode || writingMode.typewriterMode) {
      view.dispatch(view.state.tr.setMeta(writingModeKey, writingMode));
    }
  }

  // Resize the source textarea to its content height. Called on every
  // input + on entering source mode so the page never shows a nested
  // scrollbar inside the textarea.
  function autoSizeSource(): void {
    sourceTextarea.style.height = "auto";
    sourceTextarea.style.height = `${sourceTextarea.scrollHeight}px`;
  }

  // Find the Y pixel position (in viewport coords) of `offset` inside
  // the textarea. Uses a hidden mirror div with matching font / width /
  // padding / wrap so soft-wrapped lines map correctly.
  function caretRectInTextarea(offset: number): { left: number; top: number; bottom: number } | null {
    const ta = sourceTextarea;
    if (!ta.isConnected) return null;
    const cs = window.getComputedStyle(ta);
    const mirror = document.createElement("div");
    const props = [
      "fontFamily", "fontSize", "fontWeight", "fontStyle",
      "letterSpacing", "lineHeight", "tabSize",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "boxSizing", "whiteSpace", "wordBreak", "wordWrap", "width",
    ] as const;
    for (const p of props) {
      (mirror.style as unknown as Record<string, string>)[p] = cs[p];
    }
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.top = "0";
    mirror.style.left = "0";
    mirror.style.height = "auto";
    const value = ta.value;
    mirror.textContent = value.slice(0, offset);
    const marker = document.createElement("span");
    marker.textContent = "​"; // zero-width space
    mirror.appendChild(marker);
    mirror.appendChild(document.createTextNode(value.slice(offset) || " "));
    document.body.appendChild(mirror);
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const taRect = ta.getBoundingClientRect();
    document.body.removeChild(mirror);
    const top = taRect.top + (markerRect.top - mirrorRect.top);
    const left = taRect.left + (markerRect.left - mirrorRect.left);
    const lineHeightRaw = Number.parseFloat(cs.lineHeight);
    const lineHeight = Number.isFinite(lineHeightRaw) ? lineHeightRaw : markerRect.height || 18;
    return { left, top, bottom: top + lineHeight };
  }

  function scrollTextareaCursorIntoView(): void {
    const offset = sourceTextarea.selectionStart;
    if (offset == null) return;
    const rect = caretRectInTextarea(offset);
    if (rect == null) return;
    revealRect(rect, sourceTextarea, true);
  }

  function nearestScrollParent(el: HTMLElement): HTMLElement | null {
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = window.getComputedStyle(parent);
      const scrollsY = /(auto|scroll|overlay)/.test(style.overflowY);
      const scrollsX = /(auto|scroll|overlay)/.test(style.overflowX);
      if ((scrollsY && parent.scrollHeight > parent.clientHeight) || (scrollsX && parent.scrollWidth > parent.clientWidth)) {
        return parent;
      }
    }
    return null;
  }

  function revealRect(
    rect: { left: number; top: number; bottom: number },
    anchor: HTMLElement,
    center = false,
  ): void {
    const margin = center ? 0 : 72;
    const container = nearestScrollParent(anchor);
    if (container) {
      const bounds = container.getBoundingClientRect();
      const targetTop = center
        ? container.scrollTop + rect.top - bounds.top - container.clientHeight * 0.34
        : rect.top < bounds.top + margin
          ? container.scrollTop - (bounds.top + margin - rect.top)
          : rect.bottom > bounds.bottom - margin
            ? container.scrollTop + (rect.bottom - (bounds.bottom - margin))
            : container.scrollTop;
      container.scrollTop = Math.max(0, targetTop);

      if (rect.left < bounds.left + margin) {
        container.scrollLeft = Math.max(0, container.scrollLeft - (bounds.left + margin - rect.left));
      } else if (rect.left > bounds.right - margin) {
        container.scrollLeft += rect.left - (bounds.right - margin);
      }
      return;
    }

    const targetY = center
      ? window.scrollY + rect.top - window.innerHeight * 0.34
      : rect.top < margin
        ? window.scrollY + rect.top - margin
        : rect.bottom > window.innerHeight - margin
          ? window.scrollY + rect.bottom - window.innerHeight + margin
          : window.scrollY;
    window.scrollTo({ top: Math.max(0, targetY), behavior: "instant" as ScrollBehavior });
  }

  function renderedCursorRect(): { left: number; top: number; bottom: number } | null {
    try {
      const rect = view.coordsAtPos(view.state.selection.from);
      return { left: rect.left, top: rect.top, bottom: rect.bottom };
    } catch {
      return null;
    }
  }

  function revealRenderedCursor(center = false): void {
    const rect = renderedCursorRect();
    if (!rect) return;
    revealRect(rect, view.dom, center);
  }

  function flashCursor(): void {
    const rect = inSource
      ? caretRectInTextarea(sourceTextarea.selectionStart ?? sourceTextarea.value.length)
      : renderedCursorRect();
    if (!rect) return;
    window.clearTimeout(caretFlashTimer);
    const height = Math.max(16, rect.bottom - rect.top);
    caretFlash.style.left = `${Math.round(rect.left)}px`;
    caretFlash.style.top = `${Math.round(rect.top)}px`;
    caretFlash.style.height = `${Math.ceil(height)}px`;
    caretFlash.hidden = false;
    caretFlash.classList.remove("is-active");
    void caretFlash.offsetWidth;
    caretFlash.classList.add("is-active");
    caretFlashTimer = window.setTimeout(() => {
      caretFlash.hidden = true;
      caretFlash.classList.remove("is-active");
    }, 900);
  }

  function revealAndFlashActiveCursor(): void {
    window.requestAnimationFrame(() => {
      if (inSource) scrollTextareaCursorIntoView();
      else revealRenderedCursor(true);
      window.requestAnimationFrame(flashCursor);
    });
  }

  // Best-effort cursor mapping between rendered and source. Both
  // directions cut/parse a prefix and use its length / content.size as
  // the position. Mid-syntax cursors (e.g. between `*` and `bold` in
  // an unclosed `*bold`) may land a few chars off, but plain prose and
  // line boundaries are spot-on.
  function renderedCursorToMdOffset(): number {
    const sel = view.state.selection;
    try {
      return serialize(view.state.doc.cut(0, sel.from)).length;
    } catch {
      return markdownFromDoc(view.state.doc).length;
    }
  }
  function mdOffsetToRenderedPos(md: string, offset: number): number {
    try {
      return parse(md.slice(0, Math.max(0, offset))).content.size;
    } catch {
      return 0;
    }
  }

  function markdownToHTML(md: string): string {
    const doc = parse(md);
    const container = document.createElement("div");
    container.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content, { document }));
    return container.innerHTML;
  }

  function enterSource(): void {
    const md = markdownFromDoc(view.state.doc);
    const mdCursor = renderedCursorToMdOffset();
    sourceValueOnEnter = md;
    sourceTextarea.value = md;
    editorHost.hidden = true;
    sourceTextarea.hidden = false;
    autoSizeSource();
    sourceTextarea.focus();
    const clamped = Math.min(mdCursor, md.length);
    sourceTextarea.setSelectionRange(clamped, clamped);
    inSource = true;
    revealAndFlashActiveCursor();
  }

  function exitSource(): void {
    const md = sourceTextarea.value;
    const mdCursor = sourceTextarea.selectionStart ?? md.length;
    const targetRaw = mdOffsetToRenderedPos(md, mdCursor);
    rebuild(md);
    const target = Math.min(targetRaw, view.state.doc.content.size);
    try {
      const sel = TextSelection.near(view.state.doc.resolve(target));
      // scrollIntoView() flag asks PM to nudge the cursor into the
      // visible band post-dispatch — without it the page stays
      // wherever the textarea left it.
      view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
    } catch {}
    sourceTextarea.hidden = true;
    editorHost.hidden = false;
    view.focus();
    inSource = false;
    revealAndFlashActiveCursor();
    if (md !== sourceValueOnEnter) emitChange(() => markdownFromDoc(view.state.doc));
  }

  // ⌘/ on Mac, Ctrl+/ elsewhere. Window-level keydown so it works
  // whether the editor or the source textarea has focus; gated on
  // event-target containment so multiple editors don't poach each
  // other's keystrokes.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== "/") return;
    const isMac = /Mac/.test(navigator.platform);
    if (!(isMac ? e.metaKey : e.ctrlKey)) return;
    if (e.shiftKey || e.altKey) return;
    const t = e.target as Element | null;
    if (!t) return;
    if (!editorHost.contains(t) && t !== sourceTextarea) return;
    e.preventDefault();
    if (inSource) exitSource();
    else enterSource();
  };
  window.addEventListener("keydown", onKey);

  // Wire textarea focus/blur to the same callbacks as the editor.
  if (options.onFocus) {
    sourceTextarea.addEventListener("focus", () => options.onFocus!());
  }
  if (options.onBlur) {
    sourceTextarea.addEventListener("blur", () => options.onBlur!());
  }
  // Auto-grow the textarea as the user types so the page itself
  // owns the scroll, never the textarea.
  sourceTextarea.addEventListener("input", () => {
    autoSizeSource();
    emitChange(sourceTextarea.value);
    if (writingMode.typewriterMode) window.requestAnimationFrame(scrollTextareaCursorIntoView);
  });
  sourceTextarea.addEventListener("paste", (event) => {
    const data = event.clipboardData;
    if (!data || data.files.length > 0) return;
    const text = markdownFromClipboard(data);
    if (!text) return;
    event.preventDefault();
    const start = sourceTextarea.selectionStart ?? sourceTextarea.value.length;
    const end = sourceTextarea.selectionEnd ?? start;
    sourceTextarea.setRangeText(text, start, end, "end");
    autoSizeSource();
    emitChange(sourceTextarea.value);
    if (writingMode.typewriterMode) window.requestAnimationFrame(scrollTextareaCursorIntoView);
  });
  sourceTextarea.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    const start = sourceTextarea.selectionStart ?? sourceTextarea.value.length;
    const end = sourceTextarea.selectionEnd ?? start;
    if (event.shiftKey) {
      const lineStart = sourceTextarea.value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const remove = sourceTextarea.value.slice(lineStart, lineStart + 2) === "  "
        ? 2
        : sourceTextarea.value[lineStart] === "\t"
          ? 1
          : 0;
      if (remove > 0) {
        sourceTextarea.setRangeText("", lineStart, lineStart + remove, "start");
        const nextStart = Math.max(lineStart, start - remove);
        const nextEnd = Math.max(nextStart, end - remove);
        sourceTextarea.setSelectionRange(nextStart, nextEnd);
      }
    } else {
      sourceTextarea.setRangeText("  ", start, end, "end");
    }
    autoSizeSource();
    emitChange(sourceTextarea.value);
  });

  view = buildView(options.initialContent ?? "");

  function activeRangeText(): string {
    if (inSource) {
      const start = sourceTextarea.selectionStart ?? 0;
      const end = sourceTextarea.selectionEnd ?? start;
      return sourceTextarea.value.slice(start, end);
    }
    const { from, to } = view.state.selection;
    return view.state.doc.textBetween(from, to, "\n", "\n");
  }

  function replaceActiveText(text: string, select: "start" | "end" | "all" = "end"): void {
    if (inSource) {
      const start = sourceTextarea.selectionStart ?? sourceTextarea.value.length;
      const end = sourceTextarea.selectionEnd ?? start;
      sourceTextarea.setRangeText(text, start, end, select === "all" ? "select" : select);
      autoSizeSource();
      emitChange(sourceTextarea.value);
      sourceTextarea.focus();
      return;
    }
    const { from, to } = view.state.selection;
    let tr = view.state.tr.insertText(text, from, to).scrollIntoView();
    const insertedTo = from + text.length;
    if (select === "all") {
      tr = tr.setSelection(TextSelection.create(tr.doc, from, insertedTo));
    } else if (select === "start") {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(from)));
    } else {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertedTo)));
    }
    view.dispatch(tr);
    view.focus();
  }

  function wrapActiveText(open: string, close: string, placeholder: string): boolean {
    const selected = activeRangeText();
    const body = selected || placeholder;
    replaceActiveText(`${open}${body}${close}`, selected ? "end" : "all");
    if (!selected) {
      const selection = inSource ? sourceTextarea.selectionStart ?? 0 : view.state.selection.from;
      const from = Math.max(0, selection + open.length);
      const to = from + body.length;
      if (inSource) sourceTextarea.setSelectionRange(from, to);
      else view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
    }
    return true;
  }

  function mutateCurrentMarkdownLine(f: (line: string) => string): boolean {
    const md = inSource ? sourceTextarea.value : markdownFromDoc(view.state.doc);
    const offset = inSource
      ? sourceTextarea.selectionStart ?? md.length
      : renderedCursorToMdOffset();
    const lineStart = md.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
    const nextNewline = md.indexOf("\n", offset);
    const lineEnd = nextNewline < 0 ? md.length : nextNewline;
    const line = md.slice(lineStart, lineEnd);
    const nextLine = f(line);
    if (nextLine === line) return true;
    const nextMd = `${md.slice(0, lineStart)}${nextLine}${md.slice(lineEnd)}`;
    const nextOffset = offset + (nextLine.length - line.length);
    if (inSource) {
      sourceTextarea.value = nextMd;
      autoSizeSource();
      const clamped = Math.max(0, Math.min(nextOffset, nextMd.length));
      sourceTextarea.setSelectionRange(clamped, clamped);
      emitChange(sourceTextarea.value);
      sourceTextarea.focus();
      return true;
    }
    rebuild(nextMd);
    const target = Math.min(mdOffsetToRenderedPos(nextMd, Math.max(0, nextOffset)), view.state.doc.content.size);
    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(target))).scrollIntoView());
    } catch {}
    view.focus();
    emitChange(() => markdownFromDoc(view.state.doc));
    return true;
  }

  function runLineCommand(command: EditorCommand): boolean {
    const heading = command.match(/^heading-([1-6])$/);
    if (heading) {
      const level = Number(heading[1]);
      return mutateCurrentMarkdownLine((line) => {
        const body = line.replace(/^\s{0,3}#{1,6}\s+/, "");
        return `${"#".repeat(level)} ${body}`;
      });
    }
    if (command === "blockquote") {
      return mutateCurrentMarkdownLine((line) => line.startsWith("> ") ? line : `> ${line}`);
    }
    if (command === "bullet-list") {
      return mutateCurrentMarkdownLine((line) => `- ${line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|- \[[ xX]\]\s+)/, "")}`);
    }
    if (command === "ordered-list") {
      return mutateCurrentMarkdownLine((line) => `1. ${line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|- \[[ xX]\]\s+)/, "")}`);
    }
    if (command === "task-list") {
      return mutateCurrentMarkdownLine((line) => `- [ ] ${line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|- \[[ xX]\]\s+)/, "")}`);
    }
    return false;
  }

  function codeBlockAtSelection(): string | null {
    if (inSource) return null;
    const pos = view.state.selection.from;
    const $pos = view.state.doc.resolve(pos);
    for (let depth = $pos.depth; depth >= 0; depth--) {
      const node = $pos.node(depth);
      if (node.type.name === "code_block") return node.textContent;
    }
    return null;
  }

  function applyWritingMode(): void {
    wrap.classList.toggle("typora-web-focus-mode", writingMode.focusMode);
    wrap.classList.toggle("typora-web-typewriter-mode", writingMode.typewriterMode);
    view.dispatch(view.state.tr.setMeta(writingModeKey, writingMode));
    host.dispatchEvent(
      new CustomEvent("typora-web:writing-mode", {
        bubbles: true,
        detail: { ...writingMode },
      }),
    );
  }

  return {
    getMarkdown(): string {
      return inSource ? sourceTextarea.value : markdownFromDoc(view.state.doc);
    },
    getHTML(): string {
      return inSource ? markdownToHTML(sourceTextarea.value) : cleanEditorHTML(view.dom);
    },
    setMarkdown(md: string): void {
      if (inSource) {
        sourceTextarea.value = md;
        sourceValueOnEnter = md;
        autoSizeSource();
      } else {
        rebuild(md);
      }
    },
    insertText(text: string, deleteBefore = 0): { from: number; to: number } {
      if (inSource) {
        const start = sourceTextarea.selectionStart ?? sourceTextarea.value.length;
        const end = sourceTextarea.selectionEnd ?? start;
        const replaceStart = Math.max(0, start - deleteBefore);
        sourceTextarea.setRangeText(text, replaceStart, end, "end");
        autoSizeSource();
        sourceTextarea.focus();
        emitChange(sourceTextarea.value);
        return { from: replaceStart, to: replaceStart + text.length };
      } else {
        const { from, to } = view.state.selection;
        const replaceStart = Math.max(0, from - deleteBefore);
        view.dispatch(
          view.state.tr
            .insertText(text, replaceStart, to)
            .scrollIntoView(),
        );
        view.focus();
        return { from: replaceStart, to: replaceStart + text.length };
      }
    },
    setSelection(from: number, to = from): void {
      if (inSource) {
        const max = sourceTextarea.value.length;
        sourceTextarea.setSelectionRange(
          Math.max(0, Math.min(from, max)),
          Math.max(0, Math.min(to, max)),
        );
        sourceTextarea.focus();
      } else {
        const doc = view.state.doc;
        const start = Math.max(0, Math.min(from, doc.content.size));
        const end = Math.max(0, Math.min(to, doc.content.size));
        try {
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.create(doc, start, end))
              .scrollIntoView(),
          );
        } catch {
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.near(doc.resolve(start)))
              .scrollIntoView(),
          );
        }
        view.focus();
      }
    },
    getSelection(): { from: number; to: number } {
      if (inSource) {
        return {
          from: sourceTextarea.selectionStart ?? 0,
          to: sourceTextarea.selectionEnd ?? sourceTextarea.selectionStart ?? 0,
        };
      }
      return { from: view.state.selection.from, to: view.state.selection.to };
    },
    revealCursor(): void {
      revealAndFlashActiveCursor();
    },
    textBetween(from: number, to: number): string {
      if (inSource) {
        const start = Math.max(0, Math.min(from, sourceTextarea.value.length));
        const end = Math.max(0, Math.min(to, sourceTextarea.value.length));
        return sourceTextarea.value.slice(start, end);
      }
      const max = view.state.doc.content.size;
      const start = Math.max(0, Math.min(from, max));
      const end = Math.max(0, Math.min(to, max));
      return view.state.doc.textBetween(start, end, "\n", "\n");
    },
    replaceRange(from: number, to: number, text: string, select = "end"): { from: number; to: number } {
      if (inSource) {
        const max = sourceTextarea.value.length;
        const start = Math.max(0, Math.min(from, max));
        const end = Math.max(0, Math.min(to, max));
        sourceTextarea.setRangeText(text, start, end, select === "all" ? "select" : select);
        autoSizeSource();
        sourceTextarea.focus();
        emitChange(sourceTextarea.value);
        return { from: start, to: start + text.length };
      }
      const max = view.state.doc.content.size;
      const start = Math.max(0, Math.min(from, max));
      const end = Math.max(0, Math.min(to, max));
      view.dispatch(view.state.tr.insertText(text, start, end).scrollIntoView());
      const inserted = { from: start, to: start + text.length };
      const selectionFrom = select === "start" ? inserted.from : inserted.to;
      const selectionTo = select === "all" ? inserted.from : selectionFrom;
      if (select === "all") {
        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.create(view.state.doc, inserted.from, inserted.to))
            .scrollIntoView(),
        );
      } else {
        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.near(view.state.doc.resolve(selectionTo)))
            .scrollIntoView(),
        );
      }
      return inserted;
    },
    undo(): boolean {
      if (inSource) {
        sourceTextarea.focus();
        return document.execCommand("undo");
      }
      return undo(view.state, view.dispatch, view);
    },
    redo(): boolean {
      if (inSource) {
        sourceTextarea.focus();
        return document.execCommand("redo");
      }
      return redo(view.state, view.dispatch, view);
    },
    runCommand(command: EditorCommand, value = ""): boolean {
      if (command === "bold") return wrapActiveText("**", "**", "bold");
      if (command === "italic") return wrapActiveText("*", "*", "italic");
      if (command === "code") return wrapActiveText("`", "`", "code");
      if (command === "link") {
        const selected = activeRangeText() || "link";
        const href = value || "https://";
        replaceActiveText(`[${selected}](${href})`, "end");
        return true;
      }
      if (command === "code-block") {
        const selected = activeRangeText();
        replaceActiveText(`\`\`\`${value || ""}\n${selected}\n\`\`\``, selected ? "end" : "all");
        return true;
      }
      if (command === "copy-code") {
        const text = codeBlockAtSelection();
        if (text == null) return false;
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(text);
          return true;
        }
        return false;
      }
      return runLineCommand(command);
    },
    setWritingMode(options: WritingModeOptions): void {
      writingMode = {
        focusMode: options.focusMode ?? writingMode.focusMode,
        typewriterMode: options.typewriterMode ?? writingMode.typewriterMode,
      };
      applyWritingMode();
      if (writingMode.typewriterMode) revealAndFlashActiveCursor();
    },
    cursorContext(maxChars = 500) {
      if (inSource) {
        const pos = sourceTextarea.selectionStart ?? sourceTextarea.value.length;
        const rect = caretRectInTextarea(pos);
        const contextStart = Math.max(0, pos - maxChars);
        return {
          before: sourceTextarea.value.slice(contextStart, pos),
          after: sourceTextarea.value.slice(pos, pos + maxChars),
          rect,
          rectAtOffset: (offset: number) => caretRectInTextarea(contextStart + offset),
        };
      }
      const sel = view.state.selection;
      const rect = (() => {
        try {
          const r = view.coordsAtPos(sel.from);
          return { left: r.left, top: r.top, bottom: r.bottom };
        } catch {
          return null;
        }
      })();
      const $from = sel.$from;
      const contextStart = Math.max(0, $from.parentOffset - maxChars);
      const parentStart = sel.from - $from.parentOffset;
      const before = $from.parent.textBetween(
        contextStart,
        $from.parentOffset,
        "\n",
        "\n",
      );
      const after = $from.parent.textBetween(
        $from.parentOffset,
        Math.min($from.parent.content.size, $from.parentOffset + maxChars),
        "\n",
        "\n",
      );
      return {
        before,
        after,
        rect,
        rectAtOffset: (offset: number) => {
          try {
            const r = view.coordsAtPos(parentStart + contextStart + offset);
            return { left: r.left, top: r.top, bottom: r.bottom };
          } catch {
            return null;
          }
        },
      };
    },
    toggleSource(): void {
      if (inSource) exitSource();
      else enterSource();
    },
    isSourceMode(): boolean {
      return inSource;
    },
    focus(): void {
      if (inSource) sourceTextarea.focus();
      else view.focus();
    },
    destroy(): void {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(caretFlashTimer);
      cancelMarkdownPrewarm();
      view.destroy();
      caretFlash.remove();
      wrap.remove();
    },
    get view() {
      return view;
    },
  };
}
