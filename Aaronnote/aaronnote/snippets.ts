import type { Editor } from "../src/lib.ts";
import type { SnippetSummary } from "./types.ts";

export type SnippetTabstop = {
  index: number;
  from: number;
  to: number;
  primary: boolean;
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
  const body = snippet.body ?? "";
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
    const frame: SnippetFrame = {
      stops: tabstops.map((stop) => ({
        ...stop,
        from: inserted.from + stop.from,
        to: inserted.from + stop.to,
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
      this.editor.setSelection(target.from, target.to);
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
      this.editor.setSelection(target.from, target.to);
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
