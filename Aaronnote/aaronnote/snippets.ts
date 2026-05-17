import type { Editor } from "../src/lib.ts";
import type { EditorView } from "prosemirror-view";
import type { SnippetSummary } from "./types.ts";

type SnippetTarget = {
  kind: "org-title";
  blockPos: number;
};

export type SnippetTabstop = {
  index: number;
  from: number;
  to: number;
  primary: boolean;
  target?: SnippetTarget;
};

type ParsedSnippet = {
  text: string;
  tabstops: SnippetTabstop[];
};

type SnippetFrame = {
  stops: SnippetTabstop[];
  order: number[];
  cursor: number;
  activeIndex: number | null;
};

type OrgEnvSnippet = {
  kind: string;
  titleFrom: number | null;
  titleTo: number | null;
  contentStart: number;
  contentEnd: number;
  closeFrom: number;
};

function escapeRegExp(src: string): string {
  return src.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function normalizeSnippetBody(body: string): string {
  return body.replace(/(^|\n)([ \t]*\$\$[\s\S]*?\n[ \t]*\$\$)\n(\$0)$/, "$1$2$3");
}

function parseOrgEnvSnippetText(text: string): OrgEnvSnippet | null {
  const open = text.match(/^#\+begin(?:_|\s+)([A-Za-z][\w-]*)(?:\s+([^\n]*?))?[ \t]*\n/i);
  if (!open) return null;
  const kind = open[1]!.toLowerCase();
  const closeRe = new RegExp(`\\n[ \\t]*#\\+end(?:_|\\s+)${escapeRegExp(kind)}[ \\t]*(?:\\n|$)`, "gi");
  let close: RegExpExecArray | null = null;
  let next: RegExpExecArray | null;
  while ((next = closeRe.exec(text))) close = next;
  if (!close || close.index == null) return null;

  const title = open[2] ?? "";
  const titleStart = title ? open[0].indexOf(title) : -1;
  return {
    kind,
    titleFrom: titleStart >= 0 ? titleStart : null,
    titleTo: titleStart >= 0 ? titleStart + title.length : null,
    contentStart: open[0].length,
    contentEnd: close.index,
    closeFrom: close.index + 1,
  };
}

function editorView(editor: Editor): EditorView | null {
  return (editor as { view?: EditorView }).view ?? null;
}

function sortedStopIndexes(stops: SnippetTabstop[]): number[] {
  const indexes = [...new Set(stops.map((stop) => stop.index))];
  return indexes.sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });
}

function mapPointThroughReplacement(point: number, from: number, to: number, newSize: number): number {
  const delta = newSize - (to - from);
  if (point <= from) return point;
  if (point >= to) return point + delta;
  return from + newSize;
}

function mapSelectionThroughReplacement(
  selection: { from: number; to: number },
  from: number,
  to: number,
  newSize: number,
): { from: number; to: number } {
  return {
    from: mapPointThroughReplacement(selection.from, from, to, newSize),
    to: mapPointThroughReplacement(selection.to, from, to, newSize),
  };
}

export function expandSnippetBody(snippet: SnippetSummary): ParsedSnippet {
  const body = normalizeSnippetBody(snippet.body ?? "");
  const values = new Map<number, string>();
  const tabstops: SnippetTabstop[] = [];
  let text = "";
  let i = 0;

  function valueFor(index: number, fallback: string): string {
    if (!values.has(index)) values.set(index, fallback);
    return values.get(index) ?? "";
  }

  function pushTabstop(index: number, value: string): void {
    const from = text.length;
    text += value;
    tabstops.push({ index, from, to: text.length, primary: false });
  }

  while (i < body.length) {
    const rest = body.slice(i);
    const choice = rest.match(/^\$\{(\d+)\|([^}]*)\|\}/);
    if (choice) {
      const index = Number(choice[1]);
      const options = choice[2].split(",").map((x) => x.trim()).filter(Boolean);
      pushTabstop(index, valueFor(index, options[0] ?? ""));
      i += choice[0].length;
      continue;
    }
    const placeholder = rest.match(/^\$\{(\d+):([^}]*)\}/);
    if (placeholder) {
      const index = Number(placeholder[1]);
      pushTabstop(index, valueFor(index, placeholder[2]));
      i += placeholder[0].length;
      continue;
    }
    const braced = rest.match(/^\$\{(\d+)\}/);
    if (braced) {
      const index = Number(braced[1]);
      pushTabstop(index, valueFor(index, ""));
      i += braced[0].length;
      continue;
    }
    const plain = rest.match(/^\$(\d+)/);
    if (plain) {
      const index = Number(plain[1]);
      pushTabstop(index, index === 0 ? "" : valueFor(index, ""));
      i += plain[0].length;
      continue;
    }
    text += body[i];
    i++;
  }

  const seen = new Set<number>();
  for (const stop of tabstops) {
    if (!seen.has(stop.index)) {
      stop.primary = true;
      seen.add(stop.index);
    }
  }

  return { text, tabstops };
}

export class SnippetSession {
  private frames: SnippetFrame[] = [];
  private readonly editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  clear(): void {
    this.frames = [];
  }

  active(): boolean {
    return this.frames.length > 0;
  }

  insert(snippet: SnippetSummary, deleteBefore = 0): boolean {
    const { text, tabstops } = expandSnippetBody(snippet);
    if (!text) return false;
    const parent = this.topFrame();
    if (parent) this.syncActive(parent, false);
    const selection = this.editor.getSelection();
    const replaceFrom = Math.max(0, selection.from - deleteBefore);
    const replaceTo = selection.to;
    const inserted = this.editor.insertText(text, deleteBefore);
    this.mapReplacement(replaceFrom, replaceTo, inserted.to - inserted.from);
    const stops = this.mapInsertedStops(text, tabstops, inserted.from);
    const frame: SnippetFrame = {
      stops: stops.map((stop) => ({
        ...stop,
      })),
      order: sortedStopIndexes(tabstops),
      cursor: -1,
      activeIndex: null,
    };
    this.frames.push(frame);
    if (!this.next()) this.frames.pop();
    return true;
  }

  next(): boolean {
    let childCompleted = false;
    while (this.frames.length > 0) {
      const frame = this.topFrame()!;
      this.syncActive(frame, childCompleted);
      childCompleted = false;
      frame.cursor += 1;
      if (frame.cursor >= frame.order.length) {
        this.frames.pop();
        childCompleted = true;
        continue;
      }
      const index = frame.order[frame.cursor]!;
      const target = frame.stops.find((stop) => stop.index === index && stop.primary)
        ?? frame.stops.find((stop) => stop.index === index);
      if (!target) {
        this.frames.pop();
        childCompleted = true;
        continue;
      }
      frame.activeIndex = index;
      this.selectStop(target);
      return true;
    }
    return false;
  }

  previous(): boolean {
    while (this.frames.length > 0) {
      const frame = this.topFrame()!;
      this.syncActive(frame, false);
      frame.cursor -= 1;
      if (frame.cursor < 0) {
        frame.cursor = -1;
        frame.activeIndex = null;
        return false;
      }
      const index = frame.order[frame.cursor]!;
      const target = frame.stops.find((stop) => stop.index === index && stop.primary)
        ?? frame.stops.find((stop) => stop.index === index);
      if (!target) continue;
      frame.activeIndex = index;
      this.selectStop(target);
      return true;
    }
    return false;
  }

  private topFrame(): SnippetFrame | null {
    return this.frames[this.frames.length - 1] ?? null;
  }

  private syncActive(frame: SnippetFrame, preferStoredEnd: boolean): void {
    if (frame.activeIndex == null) return;
    const primary = frame.stops.find((stop) => stop.index === frame.activeIndex && stop.primary);
    if (!primary) return;
    if (primary.target?.kind === "org-title") return;

    const selection = this.editor.getSelection();
    let restoreSelection = selection;
    const selectionEnd = Math.max(selection.from, selection.to);
    const selectionInsidePrimary = selection.from >= primary.from && selectionEnd <= primary.to;
    const replacementEnd = preferStoredEnd
      ? primary.to
      : selectionInsidePrimary
        ? selectionEnd
        : Math.max(primary.to, selectionEnd);
    const value = this.editor.textBetween(primary.from, replacementEnd);
    const oldTo = primary.to;
    const oldSize = oldTo - primary.from;
    const newSize = value.length;
    const delta = newSize - oldSize;
    primary.to = primary.from + newSize;

    if (delta !== 0) this.shiftStopsAfter(primary.from, delta, primary);

    const mirrors = frame.stops
      .filter((stop) => stop.index === frame.activeIndex && stop !== primary)
      .sort((a, b) => b.from - a.from);
    for (const mirror of mirrors) {
      const mirrorOldSize = mirror.to - mirror.from;
      const oldMirrorFrom = mirror.from;
      const oldMirrorTo = mirror.to;
      const inserted = this.editor.replaceRange(mirror.from, mirror.to, value, "end");
      const mirrorDelta = value.length - mirrorOldSize;
      mirror.from = inserted.from;
      mirror.to = inserted.to;
      if (mirrorDelta !== 0) {
        restoreSelection = mapSelectionThroughReplacement(restoreSelection, oldMirrorFrom, oldMirrorTo, value.length);
        this.mapReplacement(oldMirrorFrom, oldMirrorTo, value.length, mirror);
      }
    }
    this.editor.setSelection(restoreSelection.from, restoreSelection.to);
  }

  private shiftStopsAfter(anchor: number, delta: number, except: SnippetTabstop): void {
    for (const frame of this.frames) {
      for (const stop of frame.stops) {
        if (stop === except) continue;
        if (stop.from > anchor) {
          stop.from += delta;
          stop.to += delta;
        } else if (stop.to > anchor) {
          stop.to += delta;
        }
      }
    }
  }

  private mapReplacement(from: number, to: number, newSize: number, except?: SnippetTabstop): void {
    const delta = newSize - (to - from);
    for (const frame of this.frames) {
      for (const stop of frame.stops) {
        if (stop === except) continue;
        if (stop.to <= from) continue;
        if (stop.from >= to) {
          stop.from += delta;
          stop.to += delta;
          continue;
        }
        stop.from = Math.min(stop.from, from);
        stop.to = Math.max(stop.from + newSize, stop.to + delta);
      }
    }
  }

  private selectStop(stop: SnippetTabstop): void {
    if (stop.target?.kind === "org-title") {
      const view = editorView(this.editor);
      const dom = view?.nodeDOM(stop.target.blockPos);
      const input = dom instanceof HTMLElement
        ? dom.querySelector<HTMLInputElement>(".org-env-heading-title")
        : null;
      if (input) {
        input.focus();
        input.setSelectionRange(0, input.value.length);
        return;
      }
    }
    this.editor.setSelection(stop.from, stop.to);
  }

  private mapInsertedStops(
    text: string,
    tabstops: SnippetTabstop[],
    insertedFrom: number,
  ): SnippetTabstop[] {
    const org = parseOrgEnvSnippetText(text);
    if (!org) {
      return tabstops.map((stop) => ({
        ...stop,
        from: insertedFrom + stop.from,
        to: insertedFrom + stop.to,
      }));
    }

    const view = editorView(this.editor);
    const hit = view ? this.activeOrgEnvBlock(view, org.kind) : null;
    if (!hit) {
      return tabstops.map((stop) => ({
        ...stop,
        from: insertedFrom + stop.from,
        to: insertedFrom + stop.to,
      }));
    }

    const blockStart = hit.blockPos + 1;
    const contentTextStart = this.firstOrgEnvTextblockStart(view!, hit.blockPos) ?? blockStart;
    let exitPos: number | null = null;
    const ensureExitPos = (): number => {
      if (exitPos != null) return exitPos;
      exitPos = this.ensureParagraphAfterOrgBlock(view!, hit.blockPos);
      return exitPos;
    };

    return tabstops.map((stop) => {
      if (
        org.titleFrom != null
        && org.titleTo != null
        && stop.from >= org.titleFrom
        && stop.to <= org.titleTo
      ) {
        return {
          ...stop,
          from: blockStart,
          to: blockStart,
          target: { kind: "org-title", blockPos: hit.blockPos },
        };
      }
      if (stop.from >= org.contentStart && stop.to <= org.contentEnd) {
        return {
          ...stop,
          from: contentTextStart + (stop.from - org.contentStart),
          to: contentTextStart + (stop.to - org.contentStart),
        };
      }
      if (stop.index === 0 && stop.from >= org.closeFrom) {
        const pos = ensureExitPos();
        return { ...stop, from: pos, to: pos };
      }
      return {
        ...stop,
        from: insertedFrom + stop.from,
        to: insertedFrom + stop.to,
      };
    });
  }

  private firstOrgEnvTextblockStart(view: EditorView, blockPos: number): number | null {
    const node = view.state.doc.nodeAt(blockPos);
    if (!node) return null;
    let found: number | null = null;
    node.descendants((child, pos) => {
      if (!child.isTextblock) return true;
      found = blockPos + pos + 2;
      return false;
    });
    return found;
  }

  private activeOrgEnvBlock(
    view: EditorView,
    kind: string,
  ): { blockPos: number } | null {
    const { selection, doc } = view.state;
    const $from = selection.$from;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "org_env_block" && String(node.attrs.kind || "").toLowerCase() === kind) {
        return { blockPos: $from.before(depth) };
      }
    }

    let found: { blockPos: number } | null = null;
    doc.descendants((node, pos) => {
      if (found) return false;
      if (node.type.name === "org_env_block" && String(node.attrs.kind || "").toLowerCase() === kind) {
        found = { blockPos: pos };
        return false;
      }
      return true;
    });
    return found;
  }

  private ensureParagraphAfterOrgBlock(view: EditorView, blockPos: number): number {
    const { state } = view;
    const node = state.doc.nodeAt(blockPos);
    if (!node) return Math.min(blockPos + 1, state.doc.content.size);
    const blockEnd = blockPos + node.nodeSize;
    const next = blockEnd < state.doc.content.size ? state.doc.nodeAt(blockEnd) : null;
    if (next?.type.name !== "paragraph") {
      view.dispatch(state.tr.insert(blockEnd, state.schema.nodes.paragraph.create()));
    }
    return blockEnd + 1;
  }
}

export function snippetLabel(snippet: SnippetSummary): string {
  return snippet.key || snippet.name || "snippet";
}

export function snippetDetail(snippet: SnippetSummary): string {
  return [snippet.name, snippet.mode, snippet.group].filter(Boolean).join(" / ");
}

export function snippetScore(snippet: SnippetSummary, query: string): number {
  const key = (snippet.key ?? "").toLowerCase();
  const name = (snippet.name ?? "").toLowerCase();
  const mode = (snippet.mode ?? "").toLowerCase();
  const group = (snippet.group ?? "").toLowerCase();
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (key.includes(query)) return 3;
  if (name.includes(query)) return 4;
  if (mode.includes(query) || group.includes(query)) return 5;
  return Number.POSITIVE_INFINITY;
}
