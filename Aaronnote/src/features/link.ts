import type { Mark } from "prosemirror-model";

import { markConsumed, type InlineSpan } from "../inline-parse.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";

// link in Typora-pilot (method B) mode.
//
// The source `[text](href "title")` lives verbatim in the textblock text:
//   open delim  = `[`             (1 char)
//   content     = text            (link mark covers this range)
//   close delim = `](href "title")` or `](href)`  (length depends on attrs)
//
// parseInline uses a small scanner — unlike the delim-run
// emphasis/code/strike path — because the close delim is asymmetric and
// carries data. It accepts balanced parentheses in destinations so
// note paths such as `ISO(202603)/meeting.md#eq-x` stay one href.

type LinkMatch = {
  start: number;
  end: number;
  labelFrom: number;
  labelTo: number;
  href: string;
  title: string | null;
};

function escapedAt(text: string, pos: number): boolean {
  let slashes = 0;
  for (let i = pos - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
}

function findLabelClose(text: string, open: number): number {
  let depth = 0;
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (ch === "[") {
      depth++;
      continue;
    }
    if (ch !== "]") continue;
    if (depth === 0) return i;
    depth--;
  }
  return -1;
}

function skipSpaces(text: string, pos: number): number {
  while (pos < text.length && /[ \t]/.test(text[pos]!)) pos++;
  return pos;
}

function parseTitle(text: string, pos: number): { title: string; end: number } | null {
  const quote = text[pos];
  if (quote !== '"') return null;
  let out = "";
  for (let i = pos + 1; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length) {
      out += ch + text[i + 1]!;
      i++;
      continue;
    }
    if (ch === quote) return { title: out, end: i + 1 };
    if (ch === "\n" || ch === "\r") return null;
    out += ch;
  }
  return null;
}

function parseDestination(text: string, pos: number): { href: string; title: string | null; end: number } | null {
  let cursor = skipSpaces(text, pos);
  let href = "";

  if (text[cursor] === ")") {
    return { href, title: null, end: cursor + 1 };
  }

  if (text[cursor] === "<") {
    let end = -1;
    for (let i = cursor + 1; i < text.length; i++) {
      const ch = text[i]!;
      if (ch === "\n" || ch === "\r") return null;
      if (ch === ">" && !escapedAt(text, i)) {
        end = i;
        break;
      }
    }
    if (end < 0) return null;
    href = text.slice(cursor + 1, end);
    cursor = end + 1;
  } else {
    const start = cursor;
    let depth = 0;
    for (; cursor < text.length; cursor++) {
      const ch = text[cursor]!;
      if (ch === "\n" || ch === "\r") return null;
      if (ch === "\\" && cursor + 1 < text.length) {
        cursor++;
        continue;
      }
      if (ch === "(") {
        depth++;
        continue;
      }
      if (ch === ")") {
        if (depth === 0) break;
        depth--;
        continue;
      }
      if (depth === 0 && /[ \t]/.test(ch)) break;
    }
    href = text.slice(start, cursor);
  }

  cursor = skipSpaces(text, cursor);
  let title: string | null = null;
  if (text[cursor] !== ")") {
    const parsedTitle = parseTitle(text, cursor);
    if (!parsedTitle) return null;
    title = parsedTitle.title;
    cursor = skipSpaces(text, parsedTitle.end);
  }
  if (text[cursor] !== ")") return null;
  return { href, title, end: cursor + 1 };
}

function findLinks(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[" || escapedAt(text, i)) continue;
    if (i > 0 && text[i - 1] === "!" && !escapedAt(text, i - 1)) continue;
    const labelClose = findLabelClose(text, i);
    if (labelClose < 0 || text[labelClose + 1] !== "(") continue;
    const dest = parseDestination(text, labelClose + 2);
    if (!dest) continue;
    matches.push({
      start: i,
      end: dest.end,
      labelFrom: i + 1,
      labelTo: labelClose,
      href: dest.href,
      title: dest.title,
    });
    i = dest.end - 1;
  }
  return matches;
}

const scan: InlineFeatureSpec["scan"] = (text, consumed) => {
  const out: InlineSpan[] = [];
  for (const match of findLinks(text)) {
    const fullStart = match.start;
    const fullEnd = match.end;
    const openFrom = fullStart;
    const openTo = fullStart + 1; // after `[`
    const contentFrom = openTo;
    const contentTo = match.labelTo;
    const closeFrom = contentTo;
    const closeTo = fullEnd;

    // Only the chrome (`[` and `](url "title")`) needs to be unclaimed.
    // The text portion may legitimately overlap with code / em / strong /
    // emoji etc. — those nest inside link text and must keep their
    // marks. Bail only when something else has consumed a chrome char.
    let blocked = false;
    for (let i = openFrom; i < openTo; i++) {
      if (consumed[i]) { blocked = true; break; }
    }
    if (!blocked) {
      for (let i = closeFrom; i < closeTo; i++) {
        if (consumed[i]) { blocked = true; break; }
      }
    }
    if (blocked) continue;

    // Claim chrome only; leave the text-portion bitmap untouched so
    // any earlier feature's spans there stay live.
    markConsumed(consumed, openFrom, openTo);
    markConsumed(consumed, closeFrom, closeTo);
    const href = match.href;
    const title = match.title;
    const span: InlineSpan = {
      type: "link",
      from: contentFrom,
      to: contentTo,
      openFrom,
      openTo,
      closeFrom,
      closeTo,
      attrs: { href, title },
    };
    // Empty link text would render as nothing if delims hid normally —
    // override the delim layout so the link stays visible/editable.
    if (match.labelFrom === match.labelTo) {
      if (href === "" || title !== null) {
        // [](): both delims forced visible. With a title we also fall
        // back to whole-close-delim visibility (no href promotion yet).
        span.delimRanges = [
          { from: openFrom, to: openTo, forceVisible: true },
          { from: closeFrom, to: closeTo, forceVisible: true },
        ];
      } else {
        // [](url): split close delim around href so the url shows as
        // link-styled visible text (mirrors autolink form).
        const hrefStart = closeFrom + 2; // after `](`
        const hrefEnd = closeTo - 1;     // before `)`
        span.delimRanges = [
          { from: openFrom, to: openTo, forceVisible: true },
          { from: closeFrom, to: hrefStart, forceVisible: true },
          { from: hrefEnd, to: closeTo, forceVisible: true },
        ];
        span.extraDecorations = [
          { from: hrefStart, to: hrefEnd, nodeName: "a", attrs: { href } },
        ];
      }
    }
    out.push(span);
  }
  return out;
};

function closeDelimText(mark: Mark): string {
  const href = String(mark.attrs.href ?? "");
  const title = mark.attrs.title as string | null;
  return title
    ? `](${href} "${title.replace(/"/g, '\\"')}")`
    : `](${href})`;
}

export const link: FeatureSpec = {
  name: "link",

  marks: {
    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs: (el) => ({
            href: (el as HTMLElement).getAttribute("href"),
            title: (el as HTMLElement).getAttribute("title"),
          }),
        },
      ],
      toDOM: (mark) => {
        const { href, title } = mark.attrs as { href: string; title: string | null };
        return ["a", title ? { href, title } : { href }, 0];
      },
    },
  },

  parserTokens: {
    link_open: (state, tok, schema) => {
      const href = tok.attrGet("href") ?? "";
      const title = tok.attrGet("title");
      state.addText("[");
      state.openMark(schema.marks.link.create({ href, title: title || null }));
    },
    link_close: (state, _tok, schema) => {
      const mark = state.topMark(schema.marks.link);
      state.closeMarkType(schema.marks.link);
      if (mark) state.addText(closeDelimText(mark));
    },
  },

  markDelims: {
    link: { open: "", close: "" },
  },

  inline: {
    // After emphasis/code/strike — link syntax `[`/`]`/`(` doesn't overlap
    // with *,`,~ anyway, but keeping priority highest (last) means a line
    // like `*[a](b)*` first claims the em pair and leaves link to pick up
    // the inner text.
    priority: 3,
    scan,
    markNames: ["link"],
    extRanges: (parent) => {
      const ranges: Array<[number, number]> = [];
      const linkType = parent.type.schema.marks.link;
      if (!linkType) return ranges;
      let start = -1;
      let currentMark: Mark | null = null;
      let off = 0;
      const flush = (end: number): void => {
        if (start < 0 || !currentMark) return;
        ranges.push([start - 1, end + closeDelimText(currentMark).length]);
        start = -1;
        currentMark = null;
      };
      parent.forEach((child) => {
        if (child.isText) {
          const m = child.marks.find((mk) => mk.type === linkType) ?? null;
          if (m) {
            if (start < 0) {
              start = off;
              currentMark = m;
            } else if (currentMark && !m.eq(currentMark)) {
              flush(off);
              start = off;
              currentMark = m;
            }
          } else {
            flush(off);
          }
        }
        off += child.nodeSize;
      });
      flush(off);
      return ranges;
    },
  },

};
