import { StateField, type ChangeSet, type EditorState, type Extension, type Text } from "@codemirror/state";

import { scanInlineCommands } from "../command-syntax.ts";

export type MarkdownHeading = {
  level: number;
  text: string;
  pos: number;
};

export type InlineTagAnchor = {
  tag: string;
  pos: number;
  to: number;
  lineFrom: number;
};

export type TocIndex = {
  headings: MarkdownHeading[];
  anchors: InlineTagAnchor[];
  headingSignature: string;
  anchorSignature: string;
  hasFences: boolean;
  fenceRanges: Array<{ from: number; to: number }>;
};

type LineScan = {
  heading: MarkdownHeading | null;
  anchors: InlineTagAnchor[];
  fenceToggle: boolean;
};

const FENCE_LINE_RE = /^\s*(```|~~~)/;

function headingFromLine(text: string, from: number): MarkdownHeading | null {
  const match = text.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
  if (!match) return null;
  const rawText = match[2] ?? "";
  return {
    level: match[1]!.length,
    text: rawText.trim() || "Untitled",
    pos: from + Math.max(0, text.indexOf(rawText)),
  };
}

function inlineCodeRanges(line: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const re = /`[^`\n]*`/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }
  return ranges;
}

function overlapsRange(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}

function scanLine(text: string, from: number, inFence: boolean): LineScan {
  const fenceToggle = FENCE_LINE_RE.test(text);
  if (inFence || fenceToggle) return { heading: headingFromLine(text, from), anchors: [], fenceToggle };

  const anchors: InlineTagAnchor[] = [];
  const codeRanges = inlineCodeRanges(text);
  for (const command of scanInlineCommands(text, "tag")) {
    if (overlapsRange(command.fullFrom, command.fullTo, codeRanges)) continue;
    const tag = command.context.trim().replace(/^#/, "");
    if (!tag) continue;
    anchors.push({
      tag,
      pos: from + command.contextFrom,
      to: from + command.contextTo,
      lineFrom: from,
    });
  }

  return { heading: headingFromLine(text, from), anchors, fenceToggle };
}

function sortHeadings(items: MarkdownHeading[]): MarkdownHeading[] {
  return items.sort((a, b) => a.pos - b.pos || a.level - b.level || a.text.localeCompare(b.text));
}

function sortAnchors(items: InlineTagAnchor[]): InlineTagAnchor[] {
  return items.sort((a, b) => a.pos - b.pos || a.to - b.to || a.tag.localeCompare(b.tag));
}

function headingSignature(headings: readonly MarkdownHeading[]): string {
  return headings.map((heading) => `${heading.level}:${heading.pos}:${heading.text}`).join("\n");
}

function anchorSignature(anchors: readonly InlineTagAnchor[]): string {
  return anchors.map((anchor) => `${anchor.lineFrom}:${anchor.pos}:${anchor.tag}`).join("\n");
}

function buildTocIndex(
  headings: MarkdownHeading[],
  anchors: InlineTagAnchor[],
  fenceRanges: Array<{ from: number; to: number }>,
): TocIndex {
  const sortedHeadings = sortHeadings(headings);
  const sortedAnchors = sortAnchors(anchors);
  return {
    headings: sortedHeadings,
    anchors: sortedAnchors,
    headingSignature: headingSignature(sortedHeadings),
    anchorSignature: anchorSignature(sortedAnchors),
    hasFences: fenceRanges.length > 0,
    fenceRanges,
  };
}

export function markdownHeadingsFromText(doc: Text): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  for (let lineNo = 1; lineNo <= doc.lines; lineNo += 1) {
    const line = doc.line(lineNo);
    const heading = headingFromLine(line.text, line.from);
    if (heading) headings.push(heading);
  }
  return headings;
}

function linesFromString(markdown: string): Array<{ text: string; from: number }> {
  const lines: Array<{ text: string; from: number }> = [];
  let from = 0;
  for (const text of markdown.split("\n")) {
    const clean = text.endsWith("\r") ? text.slice(0, -1) : text;
    lines.push({ text: clean, from });
    from += text.length + 1;
  }
  return lines;
}

export function inlineTagAnchorsFromText(doc: Text | string): InlineTagAnchor[] {
  const anchors: InlineTagAnchor[] = [];
  let inFence = false;
  const pushLine = (text: string, from: number): void => {
    const scan = scanLine(text, from, inFence);
    anchors.push(...scan.anchors);
    if (scan.fenceToggle) inFence = !inFence;
  };

  if (typeof doc === "string") {
    for (const line of linesFromString(doc)) pushLine(line.text, line.from);
    return anchors;
  }

  for (let lineNo = 1; lineNo <= doc.lines; lineNo += 1) {
    const line = doc.line(lineNo);
    pushLine(line.text, line.from);
  }
  return anchors;
}

function collectTocIndex(doc: Text): TocIndex {
  const headings: MarkdownHeading[] = [];
  const anchors: InlineTagAnchor[] = [];
  const fenceRanges: Array<{ from: number; to: number }> = [];
  let inFence = false;
  let fenceFrom = -1;

  for (let lineNo = 1; lineNo <= doc.lines; lineNo += 1) {
    const line = doc.line(lineNo);
    const scan = scanLine(line.text, line.from, inFence);
    if (scan.heading) headings.push(scan.heading);
    anchors.push(...scan.anchors);
    if (scan.fenceToggle) {
      if (!inFence) {
        fenceFrom = line.from;
      } else if (fenceFrom >= 0) {
        fenceRanges.push({ from: fenceFrom, to: line.to });
        fenceFrom = -1;
      }
      inFence = !inFence;
    }
  }
  if (inFence && fenceFrom >= 0) fenceRanges.push({ from: fenceFrom, to: doc.length });

  return buildTocIndex(headings, anchors, fenceRanges);
}

function changedRange(changes: ChangeSet): {
  oldFrom: number;
  oldTo: number;
  newFrom: number;
  newTo: number;
  textTouchesFence: boolean;
} | null {
  let oldFrom = Number.POSITIVE_INFINITY;
  let oldTo = 0;
  let newFrom = Number.POSITIVE_INFINITY;
  let newTo = 0;
  let textTouchesFence = false;

  const textContainsFenceLine = (text: string): boolean => (
    text.split("\n").some((line) => FENCE_LINE_RE.test(line))
  );

  changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    oldFrom = Math.min(oldFrom, fromA);
    oldTo = Math.max(oldTo, toA);
    newFrom = Math.min(newFrom, fromB);
    newTo = Math.max(newTo, toB);
    const insertedText = inserted.toString();
    if (textContainsFenceLine(insertedText)) textTouchesFence = true;
  });

  if (!Number.isFinite(oldFrom)) return null;
  return { oldFrom, oldTo, newFrom, newTo, textTouchesFence };
}

function lineWindow(doc: Text, from: number, to: number): { from: number; to: number; startLine: number; endLine: number } {
  const start = doc.lineAt(Math.max(0, Math.min(from, doc.length)));
  const endPos = Math.max(0, Math.min(to, doc.length));
  const end = doc.lineAt(endPos);
  return {
    from: start.from,
    to: end.to,
    startLine: start.number,
    endLine: end.number,
  };
}

function oldWindowTouchesFence(doc: Text, window: { startLine: number; endLine: number }): boolean {
  for (let lineNo = window.startLine; lineNo <= window.endLine; lineNo += 1) {
    if (FENCE_LINE_RE.test(doc.line(lineNo).text)) return true;
  }
  return false;
}

function lineInsideFence(from: number, to: number, fenceRanges: readonly { from: number; to: number }[]): boolean {
  return fenceRanges.some((range) => from >= range.from && to <= range.to);
}

function mapFenceRange(range: { from: number; to: number }, changes: ChangeSet): { from: number; to: number } {
  return {
    from: changes.mapPos(range.from, -1),
    to: changes.mapPos(range.to, 1),
  };
}

function mapHeading(heading: MarkdownHeading, changes: ChangeSet): MarkdownHeading {
  return { ...heading, pos: changes.mapPos(heading.pos, 1) };
}

function mapAnchor(anchor: InlineTagAnchor, changes: ChangeSet): InlineTagAnchor {
  return {
    ...anchor,
    pos: changes.mapPos(anchor.pos, 1),
    to: changes.mapPos(anchor.to, 1),
    lineFrom: changes.mapPos(anchor.lineFrom, 1),
  };
}

function patchTocIndex(index: TocIndex, startDoc: Text, nextDoc: Text, changes: ChangeSet): TocIndex | null {
  const range = changedRange(changes);
  if (!range) return index;
  if (range.textTouchesFence) return null;

  const oldWindow = lineWindow(startDoc, range.oldFrom, range.oldTo);
  if (oldWindowTouchesFence(startDoc, oldWindow)) return null;
  const nextWindow = lineWindow(nextDoc, range.newFrom, range.newTo);
  const nextFenceRanges = index.fenceRanges.map((fenceRange) => mapFenceRange(fenceRange, changes));

  const headings = index.headings
    .filter((heading) => heading.pos < oldWindow.from || heading.pos > oldWindow.to)
    .map((heading) => mapHeading(heading, changes));
  const anchors = index.anchors
    .filter((anchor) => anchor.lineFrom < oldWindow.from || anchor.lineFrom > oldWindow.to)
    .map((anchor) => mapAnchor(anchor, changes));

  for (let lineNo = nextWindow.startLine; lineNo <= nextWindow.endLine; lineNo += 1) {
    const line = nextDoc.line(lineNo);
    const scan = scanLine(line.text, line.from, lineInsideFence(line.from, line.to, nextFenceRanges));
    if (scan.fenceToggle) return null;
    if (scan.heading) headings.push(scan.heading);
    anchors.push(...scan.anchors);
  }

  return buildTocIndex(headings, anchors, nextFenceRanges);
}

const tocIndexField = StateField.define<TocIndex>({
  create: (state) => collectTocIndex(state.doc),
  update(index, tr) {
    if (!tr.docChanged) return index;
    return patchTocIndex(index, tr.startState.doc, tr.state.doc, tr.changes)
      ?? collectTocIndex(tr.state.doc);
  },
});

export const tocIndexExtension: Extension = tocIndexField;

export function tocIndexFromState(state: EditorState): TocIndex {
  return state.field(tocIndexField, false) ?? collectTocIndex(state.doc);
}
