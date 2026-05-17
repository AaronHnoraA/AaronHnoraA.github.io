import { TextSelection } from "prosemirror-state";

import type { Editor } from "../src/lib.ts";

export type VimLiteMode = "insert" | "normal" | "visual" | "visual-line";

export type VimLiteController = {
  mode(): VimLiteMode;
  setMode(mode: VimLiteMode): void;
  handleKeyDown(event: KeyboardEvent): boolean;
};

type VimLiteOptions = {
  onModeChange?: (mode: VimLiteMode) => void;
  onUndo?: () => boolean;
  onRedo?: () => boolean;
};

type TextareaLineInfo = {
  start: number;
  end: number;
  column: number;
};

function hasCommandModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.altKey || event.ctrlKey;
}

function isEscape(event: KeyboardEvent): boolean {
  return event.key === "Escape" || (event.ctrlKey && event.key === "[");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sourceTextarea(host: HTMLElement): HTMLTextAreaElement | null {
  return host.querySelector<HTMLTextAreaElement>(".typora-web-source:not([hidden])");
}

function targetInEditor(host: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof Node && host.contains(target);
}

function sourceLineInfo(value: string, pos: number): TextareaLineInfo {
  const start = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const next = value.indexOf("\n", pos);
  const end = next < 0 ? value.length : next;
  return { start, end, column: pos - start };
}

function sourceLineRange(value: string, pos: number): { from: number; to: number; cursor: number } {
  const line = sourceLineInfo(value, clamp(pos, 0, value.length));
  const to = line.end < value.length ? line.end + 1 : line.end;
  return { from: line.start, to, cursor: line.start };
}

function sourceLineSelectionRange(value: string, anchor: number, head: number): { from: number; to: number } {
  const a = sourceLineRange(value, anchor);
  const h = sourceLineRange(value, head);
  return {
    from: Math.min(a.from, h.from),
    to: Math.max(a.to, h.to),
  };
}

function setSourcePos(textarea: HTMLTextAreaElement, pos: number): void {
  const clamped = clamp(pos, 0, textarea.value.length);
  textarea.setSelectionRange(clamped, clamped);
  textarea.focus();
}

function setSourceSelection(textarea: HTMLTextAreaElement, anchor: number, head: number): void {
  const max = textarea.value.length;
  textarea.setSelectionRange(clamp(Math.min(anchor, head), 0, max), clamp(Math.max(anchor, head), 0, max));
  textarea.focus();
}

function sourceMoveChar(textarea: HTMLTextAreaElement, dir: -1 | 1): void {
  setSourcePos(textarea, (textarea.selectionStart ?? 0) + dir);
}

function sourceMoveLine(textarea: HTMLTextAreaElement, dir: -1 | 1, goalColumn: number | null): number | null {
  const value = textarea.value;
  const pos = textarea.selectionStart ?? 0;
  const line = sourceLineInfo(value, pos);
  const desired = goalColumn ?? line.column;
  if (dir < 0) {
    if (line.start === 0) return desired;
    const prevEnd = line.start - 1;
    const prev = sourceLineInfo(value, prevEnd);
    setSourcePos(textarea, Math.min(prev.start + desired, prev.end));
    return desired;
  }
  if (line.end >= value.length) return desired;
  const nextStart = line.end + 1;
  const next = sourceLineInfo(value, nextStart);
  setSourcePos(textarea, Math.min(next.start + desired, next.end));
  return desired;
}

function sourceLineBoundary(textarea: HTMLTextAreaElement, which: "start" | "end"): void {
  const pos = textarea.selectionStart ?? 0;
  const line = sourceLineInfo(textarea.value, pos);
  setSourcePos(textarea, which === "start" ? line.start : line.end);
}

function wordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function sourceMoveWord(textarea: HTMLTextAreaElement, dir: -1 | 1): void {
  const value = textarea.value;
  let pos = textarea.selectionStart ?? 0;
  if (dir > 0) {
    while (pos < value.length && wordChar(value[pos] ?? "")) pos++;
    while (pos < value.length && !wordChar(value[pos] ?? "")) pos++;
  } else {
    pos = Math.max(0, pos - 1);
    while (pos > 0 && !wordChar(value[pos] ?? "")) pos--;
    while (pos > 0 && wordChar(value[pos - 1] ?? "")) pos--;
  }
  setSourcePos(textarea, pos);
}

function sourceDeleteChar(textarea: HTMLTextAreaElement): void {
  const pos = textarea.selectionStart ?? 0;
  if (pos >= textarea.value.length) return;
  textarea.setRangeText("", pos, pos + 1, "start");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function sourceDeleteLineRange(textarea: HTMLTextAreaElement): { from: number; to: number; text: string } | null {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const range = end > start
    ? { from: start, to: end }
    : sourceLineRange(textarea.value, start);
  if (range.from >= range.to) return null;
  return { ...range, text: textarea.value.slice(range.from, range.to) };
}

function sourceDeleteLine(textarea: HTMLTextAreaElement): string {
  const range = sourceDeleteLineRange(textarea);
  if (!range) return "";
  const fallbackPos = range.from > 0 && range.to >= textarea.value.length ? range.from - 1 : range.from;
  textarea.setRangeText("", range.from, range.to, "start");
  setSourcePos(textarea, fallbackPos);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  return range.text;
}

function sourceReplaceChar(textarea: HTMLTextAreaElement, ch: string): void {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const replaceEnd = end > start ? end : Math.min(start + 1, textarea.value.length);
  if (start >= replaceEnd) return;
  textarea.setRangeText(ch.repeat(Math.max(1, replaceEnd - start)), start, replaceEnd, "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function sourceInsertText(textarea: HTMLTextAreaElement, text: string, where: "before" | "after"): void {
  const pos = textarea.selectionStart ?? 0;
  const insertAt = where === "after" ? Math.min(textarea.value.length, pos + 1) : pos;
  textarea.setRangeText(text, insertAt, insertAt, "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function sourceOpenLine(textarea: HTMLTextAreaElement, where: "above" | "below"): void {
  const pos = textarea.selectionStart ?? 0;
  const line = sourceLineInfo(textarea.value, pos);
  const insertAt = where === "above" ? line.start : line.end;
  const text = where === "above" ? "\n" : "\n";
  textarea.setSelectionRange(insertAt, insertAt);
  textarea.setRangeText(text, insertAt, insertAt, "end");
  if (where === "above") setSourcePos(textarea, insertAt);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function pmSetPos(editor: Editor, pos: number, bias: -1 | 1 = 1): void {
  const view = editor.view;
  const doc = view.state.doc;
  const clamped = clamp(pos, 0, doc.content.size);
  const selection = TextSelection.near(doc.resolve(clamped), bias);
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
}

function pmSetSelection(editor: Editor, anchor: number, head: number): void {
  const view = editor.view;
  const doc = view.state.doc;
  const max = doc.content.size;
  const from = clamp(anchor, 0, max);
  const to = clamp(head, 0, max);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, from, to)).scrollIntoView());
  view.focus();
}

function pmBlockRangeAt(editor: Editor, pos: number): { from: number; to: number; cursor: number } {
  const doc = editor.view.state.doc;
  const $pos = doc.resolve(clamp(pos, 0, doc.content.size));
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).isBlock) {
      const from = $pos.before(depth);
      const to = $pos.after(depth);
      return { from, to, cursor: from + 1 };
    }
  }
  return { from: 0, to: doc.content.size, cursor: 0 };
}

function pmBlockSelectionRange(editor: Editor, anchor: number, head: number): { from: number; to: number } {
  const a = pmBlockRangeAt(editor, anchor);
  const h = pmBlockRangeAt(editor, head);
  return {
    from: Math.min(a.from, h.from),
    to: Math.max(a.to, h.to),
  };
}

function pmTextLineRangeAt(editor: Editor, pos: number): { from: number; to: number; cursor: number } | null {
  const doc = editor.view.state.doc;
  const $pos = doc.resolve(clamp(pos, 0, doc.content.size));
  if (!$pos.parent.isTextblock) return null;
  const text = $pos.parent.textContent;
  const offset = $pos.parentOffset;
  const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const nextBreak = text.indexOf("\n", offset);
  const lineEnd = nextBreak < 0 ? text.length : nextBreak;
  const start = $pos.start() + lineStart;
  const end = $pos.start() + (nextBreak < 0 ? lineEnd : lineEnd + 1);
  return { from: start, to: end, cursor: start };
}

function pmSourceLines(editor: Editor): Array<{ start: number; end: number; blockFrom: number; blockTo: number; wholeBlock: boolean }> {
  const lines: Array<{ start: number; end: number; blockFrom: number; blockTo: number; wholeBlock: boolean }> = [];
  editor.view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textContent;
    const parts = text.split("\n");
    let offset = 0;
    for (const part of parts) {
      const start = pos + 1 + offset;
      const end = start + part.length;
      lines.push({
        start,
        end,
        blockFrom: pos,
        blockTo: pos + node.nodeSize,
        wholeBlock: parts.length === 1,
      });
      offset += part.length + 1;
    }
    return false;
  });
  return lines;
}

function pmSourceLineRangeAt(editor: Editor, pos: number): { from: number; to: number; cursor: number; text: string } | null {
  const line = pmSourceLines(editor).find((item) => pos >= item.start && pos <= item.end);
  if (!line) return null;
  const from = line.wholeBlock ? line.blockFrom : line.start;
  const to = line.wholeBlock ? line.blockTo : line.end;
  const text = editor.view.state.doc.textBetween(from, to, "\n", "\n");
  return { from, to, cursor: from, text };
}

function pmMoveChar(editor: Editor, dir: -1 | 1): void {
  const selection = editor.view.state.selection;
  const pos = selection.empty
    ? selection.from + dir
    : (dir < 0 ? selection.from : selection.to);
  pmSetPos(editor, pos, dir);
}

function pmLineHeight(view: Editor["view"]): number {
  const raw = Number.parseFloat(window.getComputedStyle(view.dom).lineHeight);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

function rectCenterY(rect: { top: number; bottom: number }): number {
  return rect.top + (rect.bottom - rect.top) / 2;
}

function pmCoordsAt(view: Editor["view"], pos: number): { left: number; top: number; bottom: number } | null {
  try {
    return view.coordsAtPos(pos);
  } catch {
    return null;
  }
}

function pmVisualLineMoveTarget(
  editor: Editor,
  pos: number,
  dir: -1 | 1,
  goalX: number | null,
): { pos: number; goalX: number | null } {
  const view = editor.view;
  const docMax = view.state.doc.content.size;
  const clampedPos = clamp(pos, 0, docMax);
  const rect = pmCoordsAt(view, clampedPos);
  if (!rect) return { pos: clampedPos, goalX };

  const lineHeight = pmLineHeight(view);
  const x = goalX ?? rect.left;
  const startY = rectCenterY(rect);
  const xSamples = [x, x + 2, x - 2];

  for (let step = 0; step < 8; step++) {
    const y = startY + dir * lineHeight * (0.9 + step * 0.28);
    for (const sampleX of xSamples) {
      const found = view.posAtCoords({ left: sampleX, top: y });
      if (!found) continue;
      const next = clamp(found.pos, 0, docMax);
      if (next === clampedPos && step < 3) continue;
      const nextRect = pmCoordsAt(view, next);
      if (nextRect) {
        const delta = rectCenterY(nextRect) - startY;
        if (dir * delta <= 1 && next !== (dir > 0 ? docMax : 0)) continue;
      }
      return { pos: next, goalX: x };
    }
  }

  return { pos: clampedPos, goalX: x };
}

function pmMoveLine(editor: Editor, dir: -1 | 1, goalX: number | null): number | null {
  const view = editor.view;
  const cursor = view.state.selection.empty
    ? view.state.selection.from
    : (dir < 0 ? view.state.selection.from : view.state.selection.to);
  const target = pmVisualLineMoveTarget(editor, cursor, dir, goalX);
  if (target.pos !== cursor) pmSetPos(editor, target.pos, dir);
  return target.goalX;
}

function pmLineBoundary(editor: Editor, which: "start" | "end"): void {
  const { selection } = editor.view.state;
  const $from = selection.$from;
  if (!$from.parent.isTextblock) return;
  pmSetPos(editor, which === "start" ? $from.start() : $from.end(), which === "start" ? 1 : -1);
}

function pmDocBoundary(editor: Editor, which: "start" | "end"): void {
  pmSetPos(editor, which === "start" ? 0 : editor.view.state.doc.content.size, which === "start" ? 1 : -1);
}

function pmCharAt(editor: Editor, pos: number): string {
  const doc = editor.view.state.doc;
  if (pos < 0 || pos >= doc.content.size) return "";
  return doc.textBetween(pos, Math.min(pos + 1, doc.content.size), "\n", "\n").charAt(0);
}

function pmMoveWord(editor: Editor, dir: -1 | 1): void {
  const max = editor.view.state.doc.content.size;
  let pos = editor.view.state.selection.from;
  if (dir > 0) {
    while (pos < max && wordChar(pmCharAt(editor, pos))) pos++;
    while (pos < max && !wordChar(pmCharAt(editor, pos))) pos++;
  } else {
    pos = Math.max(0, pos - 1);
    while (pos > 0 && !wordChar(pmCharAt(editor, pos))) pos--;
    while (pos > 0 && wordChar(pmCharAt(editor, pos - 1))) pos--;
  }
  pmSetPos(editor, pos, dir);
}

function pmDeleteChar(editor: Editor): void {
  const view = editor.view;
  const { from, to } = view.state.selection;
  const end = from === to ? Math.min(from + 1, view.state.doc.content.size) : to;
  if (from >= end) return;
  view.dispatch(view.state.tr.delete(from, end).scrollIntoView());
  view.focus();
}

function pmDeleteLine(editor: Editor): string {
  const view = editor.view;
  const { from, to } = view.state.selection;
  const range = from < to
    ? { from, to, text: view.state.doc.textBetween(from, to, "\n", "\n") }
    : (pmSourceLineRangeAt(editor, from) ?? { ...pmBlockRangeAt(editor, from), text: view.state.doc.textBetween(pmBlockRangeAt(editor, from).from, pmBlockRangeAt(editor, from).to, "\n", "\n") });
  if (range.from >= range.to) return "";
  try {
    view.dispatch(view.state.tr.delete(range.from, range.to).scrollIntoView());
    const target = Math.min(range.from, view.state.doc.content.size);
    pmSetPos(editor, target);
  } catch {
    pmDeleteChar(editor);
  }
  return range.text;
}

function pmReplaceChar(editor: Editor, ch: string): void {
  const view = editor.view;
  const { from, to } = view.state.selection;
  const end = from === to ? Math.min(from + 1, view.state.doc.content.size) : to;
  if (from >= end) return;
  view.dispatch(view.state.tr.insertText(ch.repeat(Math.max(1, end - from)), from, end).scrollIntoView());
  view.focus();
}

function pmInsertText(editor: Editor, text: string, where: "before" | "after"): void {
  const view = editor.view;
  const pos = where === "after"
    ? Math.min(view.state.doc.content.size, view.state.selection.to + 1)
    : view.state.selection.from;
  view.dispatch(view.state.tr.insertText(text, pos, pos).scrollIntoView());
  view.focus();
}

function pmOpenLine(editor: Editor, where: "above" | "below"): void {
  const view = editor.view;
  const $from = view.state.selection.$from;
  if (!$from.parent.isTextblock) {
    pmSetPos(editor, view.state.selection.from);
    return;
  }
  const linePos = where === "above" ? $from.start() : $from.end();
  view.dispatch(view.state.tr.insertText("\n", linePos, linePos).scrollIntoView());
  pmSetPos(editor, where === "above" ? linePos : linePos + 1);
}

export function createVimLite(
  editor: Editor,
  host: HTMLElement,
  options: VimLiteOptions = {},
): VimLiteController {
  let mode: VimLiteMode = "insert";
  let sourceGoalColumn: number | null = null;
  let pmGoalX: number | null = null;
  let pending = "";
  let visualAnchor: number | null = null;
  let visualHead: number | null = null;
  let register = "";

  function yank(text: string): void {
    if (!text) return;
    register = text;
    void navigator.clipboard?.writeText(text).catch(() => {});
  }

  function resetMotionMemory(): void {
    sourceGoalColumn = null;
    pmGoalX = null;
  }

  function setMode(next: VimLiteMode): void {
    if (mode === next) return;
    mode = next;
    pending = "";
    visualAnchor = null;
    visualHead = null;
    resetMotionMemory();
    options.onModeChange?.(mode);
  }

  function withSurface(
    sourceAction: (textarea: HTMLTextAreaElement) => void,
    pmAction: () => void,
  ): void {
    const textarea = sourceTextarea(host);
    if (textarea) sourceAction(textarea);
    else pmAction();
  }

  function moveChar(dir: -1 | 1): void {
    resetMotionMemory();
    withSurface((textarea) => sourceMoveChar(textarea, dir), () => pmMoveChar(editor, dir));
  }

  function surfaceHead(): number {
    const textarea = sourceTextarea(host);
    if (textarea) return visualHead ?? textarea.selectionEnd ?? textarea.selectionStart ?? 0;
    return visualHead ?? editor.view.state.selection.to;
  }

  function setVisualHead(head: number): void {
    if (visualAnchor == null) visualAnchor = surfaceHead();
    visualHead = head;
    withSurface(
      (textarea) => setSourceSelection(textarea, visualAnchor!, visualHead!),
      () => pmSetSelection(editor, visualAnchor!, visualHead!),
    );
  }

  function enterVisual(): void {
    setMode("visual");
    visualAnchor = surfaceHead();
    visualHead = visualAnchor;
  }

  function enterVisualLine(): void {
    const head = surfaceHead();
    setMode("visual-line");
    visualAnchor = head;
    visualHead = head;
    withSurface(
      (textarea) => {
        const range = sourceLineSelectionRange(textarea.value, visualAnchor!, visualHead!);
        textarea.setSelectionRange(range.from, range.to);
        textarea.focus();
      },
      () => {
        const range = pmBlockSelectionRange(editor, visualAnchor!, visualHead!);
        pmSetSelection(editor, range.from, range.to);
      },
    );
  }

  function visualMoveChar(dir: -1 | 1): void {
    resetMotionMemory();
    withSurface(
      (textarea) => setVisualHead(clamp(surfaceHead() + dir, 0, textarea.value.length)),
      () => setVisualHead(clamp(surfaceHead() + dir, 0, editor.view.state.doc.content.size)),
    );
  }

  function visualMoveLine(dir: -1 | 1): void {
    withSurface(
      (textarea) => {
        const value = textarea.value;
        const pos = surfaceHead();
        const line = sourceLineInfo(value, pos);
        const desired = sourceGoalColumn ?? line.column;
        sourceGoalColumn = desired;
        if (dir < 0 && line.start > 0) {
          const prev = sourceLineInfo(value, line.start - 1);
          setVisualHead(Math.min(prev.start + desired, prev.end));
        } else if (dir > 0 && line.end < value.length) {
          const next = sourceLineInfo(value, line.end + 1);
          setVisualHead(Math.min(next.start + desired, next.end));
        }
      },
      () => {
        const target = pmVisualLineMoveTarget(editor, surfaceHead(), dir, pmGoalX);
        pmGoalX = target.goalX;
        setVisualHead(target.pos);
      },
    );
  }

  function visualLineMove(dir: -1 | 1): void {
    withSurface(
      (textarea) => {
        const value = textarea.value;
        const current = sourceLineRange(value, surfaceHead());
        let nextPos = dir > 0 ? current.to : Math.max(0, current.from - 1);
        if (dir > 0 && current.to >= value.length) nextPos = current.cursor;
        const next = sourceLineRange(value, nextPos);
        visualHead = next.cursor;
        const range = sourceLineSelectionRange(value, visualAnchor ?? next.cursor, visualHead);
        textarea.setSelectionRange(range.from, range.to);
        textarea.focus();
      },
      () => {
        const currentHead = surfaceHead();
        const lines = pmSourceLines(editor);
        const index = lines.findIndex((line) =>
          (currentHead >= line.start && currentHead <= line.end) ||
          (currentHead >= line.blockFrom && currentHead <= line.blockTo)
        );
        const target = index >= 0 ? lines[index + dir] : undefined;
        if (target) {
          visualHead = target.start;
        } else {
          const moved = pmVisualLineMoveTarget(editor, currentHead, dir, pmGoalX);
          pmGoalX = moved.goalX;
          visualHead = pmBlockRangeAt(editor, moved.pos).cursor;
        }
        const head = visualHead ?? surfaceHead();
        const range = pmBlockSelectionRange(editor, visualAnchor ?? head, head);
        pmSetSelection(editor, range.from, range.to);
      },
    );
  }

  function visualLineBoundary(which: "start" | "end"): void {
    resetMotionMemory();
    withSurface(
      (textarea) => {
        const line = sourceLineInfo(textarea.value, surfaceHead());
        setVisualHead(which === "start" ? line.start : line.end);
      },
      () => {
        const $pos = editor.view.state.doc.resolve(clamp(surfaceHead(), 0, editor.view.state.doc.content.size));
        if ($pos.parent.isTextblock) setVisualHead(which === "start" ? $pos.start() : $pos.end());
      },
    );
  }

  function visualMoveWord(dir: -1 | 1): void {
    resetMotionMemory();
    withSurface(
      (textarea) => {
        const value = textarea.value;
        let pos = surfaceHead();
        if (dir > 0) {
          while (pos < value.length && wordChar(value[pos] ?? "")) pos++;
          while (pos < value.length && !wordChar(value[pos] ?? "")) pos++;
        } else {
          pos = Math.max(0, pos - 1);
          while (pos > 0 && !wordChar(value[pos] ?? "")) pos--;
          while (pos > 0 && wordChar(value[pos - 1] ?? "")) pos--;
        }
        setVisualHead(pos);
      },
      () => {
        const max = editor.view.state.doc.content.size;
        let pos = surfaceHead();
        if (dir > 0) {
          while (pos < max && wordChar(pmCharAt(editor, pos))) pos++;
          while (pos < max && !wordChar(pmCharAt(editor, pos))) pos++;
        } else {
          pos = Math.max(0, pos - 1);
          while (pos > 0 && !wordChar(pmCharAt(editor, pos))) pos--;
          while (pos > 0 && wordChar(pmCharAt(editor, pos - 1))) pos--;
        }
        setVisualHead(pos);
      },
    );
  }

  function moveLine(dir: -1 | 1): void {
    withSurface(
      (textarea) => { sourceGoalColumn = sourceMoveLine(textarea, dir, sourceGoalColumn); },
      () => { pmGoalX = pmMoveLine(editor, dir, pmGoalX); },
    );
  }

  function moveLineBoundary(which: "start" | "end"): void {
    resetMotionMemory();
    withSurface((textarea) => sourceLineBoundary(textarea, which), () => pmLineBoundary(editor, which));
  }

  function moveWord(dir: -1 | 1): void {
    resetMotionMemory();
    withSurface((textarea) => sourceMoveWord(textarea, dir), () => pmMoveWord(editor, dir));
  }

  function deleteChar(): void {
    resetMotionMemory();
    withSurface(
      (textarea) => {
        const pos = textarea.selectionStart ?? 0;
        yank(textarea.value.slice(pos, Math.min(pos + 1, textarea.value.length)));
        sourceDeleteChar(textarea);
      },
      () => {
        const view = editor.view;
        const { from, to } = view.state.selection;
        const end = from === to ? Math.min(from + 1, view.state.doc.content.size) : to;
        yank(view.state.doc.textBetween(from, end, "\n", "\n"));
        pmDeleteChar(editor);
      },
    );
  }

  function deleteLine(): void {
    resetMotionMemory();
    withSurface(
      (textarea) => yank(sourceDeleteLine(textarea)),
      () => yank(pmDeleteLine(editor)),
    );
    setMode("normal");
  }

  function paste(where: "before" | "after"): void {
    if (!register) return;
    resetMotionMemory();
    withSurface(
      (textarea) => sourceInsertText(textarea, register, where),
      () => pmInsertText(editor, register, where),
    );
    setMode("normal");
  }

  function replaceChar(ch: string): void {
    resetMotionMemory();
    withSurface((textarea) => sourceReplaceChar(textarea, ch), () => pmReplaceChar(editor, ch));
    setMode("normal");
  }

  function openLine(where: "above" | "below"): void {
    resetMotionMemory();
    withSurface((textarea) => sourceOpenLine(textarea, where), () => pmOpenLine(editor, where));
    setMode("insert");
  }

  function appendChar(): void {
    moveChar(1);
    setMode("insert");
  }

  function normalCommand(key: string): boolean {
    if (pending === "d") {
      pending = "";
      if (key === "d") {
        deleteLine();
        return true;
      }
      return true;
    }
    if (pending === "r") {
      pending = "";
      if (key.length === 1) {
        replaceChar(key);
        return true;
      }
      return true;
    }
    if (pending === "g") {
      pending = "";
      if (key === "g") {
        resetMotionMemory();
        withSurface((textarea) => setSourcePos(textarea, 0), () => pmDocBoundary(editor, "start"));
        return true;
      }
      return true;
    }

    switch (key) {
      case "h":
      case "ArrowLeft":
      case "Backspace":
        moveChar(-1);
        return true;
      case "l":
      case "ArrowRight":
      case " ":
        moveChar(1);
        return true;
      case "j":
      case "ArrowDown":
        moveLine(1);
        return true;
      case "k":
      case "ArrowUp":
        moveLine(-1);
        return true;
      case "0":
        moveLineBoundary("start");
        return true;
      case "$":
        moveLineBoundary("end");
        return true;
      case "w":
        moveWord(1);
        return true;
      case "b":
        moveWord(-1);
        return true;
      case "u":
        return options.onUndo?.() ?? false;
      case "g":
        pending = "g";
        return true;
      case "G":
        resetMotionMemory();
        withSurface(
          (textarea) => setSourcePos(textarea, textarea.value.length),
          () => pmDocBoundary(editor, "end"),
        );
        return true;
      case "i":
        setMode("insert");
        return true;
      case "v":
        enterVisual();
        return true;
      case "V":
        enterVisualLine();
        return true;
      case "a":
        appendChar();
        return true;
      case "I":
        moveLineBoundary("start");
        setMode("insert");
        return true;
      case "A":
        moveLineBoundary("end");
        setMode("insert");
        return true;
      case "o":
        openLine("below");
        return true;
      case "O":
        openLine("above");
        return true;
      case "x":
      case "Delete":
        deleteChar();
        return true;
      case "p":
        paste("after");
        return true;
      case "P":
        paste("before");
        return true;
      case "r":
        pending = "r";
        return true;
      case "d":
        pending = "d";
        return true;
      case "Escape":
        setMode("normal");
        return true;
      default:
        pending = "";
        return key.length === 1;
    }
  }

  function visualCommand(key: string): boolean {
    if (pending === "d") {
      pending = "";
      if (key === "d") {
        deleteLine();
        return true;
      }
      return true;
    }
    if (pending === "r") {
      pending = "";
      if (key.length === 1) {
        replaceChar(key);
        return true;
      }
      setMode("normal");
      return true;
    }
    switch (key) {
      case "h":
      case "ArrowLeft":
      case "Backspace":
        visualMoveChar(-1);
        return true;
      case "l":
      case "ArrowRight":
      case " ":
        visualMoveChar(1);
        return true;
      case "j":
      case "ArrowDown":
        visualMoveLine(1);
        return true;
      case "k":
      case "ArrowUp":
        visualMoveLine(-1);
        return true;
      case "0":
        visualLineBoundary("start");
        return true;
      case "$":
        visualLineBoundary("end");
        return true;
      case "w":
        visualMoveWord(1);
        return true;
      case "b":
        visualMoveWord(-1);
        return true;
      case "x":
      case "Delete":
      case "d":
        deleteChar();
        setMode("normal");
        return true;
      case "r":
        pending = "r";
        return true;
      case "v":
      case "Escape":
        setMode("normal");
        return true;
      default:
        pending = "";
        return key.length === 1;
    }
  }

  function visualLineCommand(key: string): boolean {
    switch (key) {
      case "j":
      case "ArrowDown":
        visualLineMove(1);
        return true;
      case "k":
      case "ArrowUp":
        visualLineMove(-1);
        return true;
      case "x":
      case "d":
      case "Delete":
        deleteLine();
        return true;
      case "V":
      case "v":
      case "Escape":
        setMode("normal");
        return true;
      default:
        pending = "";
        return key.length === 1;
    }
  }

  return {
    mode: () => mode,
    setMode,
    handleKeyDown(event: KeyboardEvent): boolean {
      if (!targetInEditor(host, event.target)) return false;
      if (event.isComposing) return false;
      if (isEscape(event)) {
        event.preventDefault();
        setMode("normal");
        return true;
      }
      if (mode === "insert") {
        if (!hasCommandModifier(event) && !event.shiftKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          moveLine(event.key === "ArrowDown" ? 1 : -1);
          return true;
        }
        return false;
      }
      if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        return options.onRedo?.() ?? false;
      }
      if (hasCommandModifier(event)) return false;

      const handled = mode === "visual-line"
        ? visualLineCommand(event.key)
        : mode === "visual"
          ? visualCommand(event.key)
          : normalCommand(event.key);
      if (handled) event.preventDefault();
      return handled;
    },
  };
}
