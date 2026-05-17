import { markConsumed, type InlineSpan } from "../inline-parse.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";
import { Plugin, TextSelection } from "prosemirror-state";

function countBackslashesBefore(src: string, pos: number): number {
  let count = 0;
  for (let i = pos - 1; i >= 0 && src.charCodeAt(i) === 0x5c; i--) count++;
  return count;
}

function escaped(src: string, pos: number): boolean {
  return countBackslashesBefore(src, pos) % 2 === 1;
}

function validContent(delimiter: "$" | "$$", content: string): boolean {
  if (delimiter === "$$") return false;
  return content.trim().length > 0 && !content.includes("\n");
}

function lineStart(text: string, pos: number): number {
  const index = text.lastIndexOf("\n", Math.max(0, pos - 1));
  return index < 0 ? 0 : index + 1;
}

function lineEnd(text: string, pos: number): number {
  const index = text.indexOf("\n", pos);
  return index < 0 ? text.length : index;
}

function onlySpace(text: string, from: number, to: number): boolean {
  return /^[ \t]*$/.test(text.slice(from, to));
}

function adjacentDollar(text: string, pos: number): boolean {
  return text[pos - 1] === "$" || text[pos + 1] === "$";
}

function isDoubleDollarAt(text: string, pos: number): boolean {
  return (
    text.slice(pos, pos + 2) === "$$" &&
    !escaped(text, pos)
  );
}

function isDisplayOpen(text: string, openFrom: number): boolean {
  return (
    isDoubleDollarAt(text, openFrom) &&
    onlySpace(text, lineStart(text, openFrom), openFrom) &&
    onlySpace(text, openFrom + 2, lineEnd(text, openFrom + 2))
  );
}

function isDisplayClose(text: string, closeFrom: number): boolean {
  const closeTo = closeFrom + 2;
  return (
    isDoubleDollarAt(text, closeFrom) &&
    onlySpace(text, lineStart(text, closeFrom), closeFrom) &&
    onlySpace(text, closeTo, lineEnd(text, closeTo))
  );
}

function scanMathRuns(text: string, consumed: Uint8Array): InlineSpan[] {
  const out: InlineSpan[] = [];
  for (let openFrom = 0; openFrom < text.length; openFrom++) {
    if (consumed[openFrom] || !isDisplayOpen(text, openFrom)) continue;
    const openTo = openFrom + 2;
    const bodyFrom = openTo;
    let closeFrom = -1;
    for (let j = bodyFrom; j < text.length; j++) {
      if (consumed[j] || text[j] !== "$") continue;
      if (j === openFrom) continue;
      if (!isDisplayClose(text, j)) continue;
      closeFrom = j;
      break;
    }
    if (closeFrom < 0) continue;
    const closeTo = closeFrom + 2;
    let blocked = false;
    for (let j = openFrom; j < closeTo; j++) {
      if (consumed[j]) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    const rawTex = text.slice(bodyFrom, closeFrom);
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
      attrs: { tex, delimiter: "$$", display: true },
      delimRanges: [{
        from: lineStart(text, openFrom),
        to: closeTo,
        softInside: true,
        className: "math-source-hidden",
      }],
      widgetDecorations: tex ? [
        { pos: openFrom, when: "outside", kind: "math-render", attrs: { tex, display: "1" }, side: -1 },
      ] : [],
    });
    openFrom = closeTo - 1;
  }
  for (let i = 0; i < text.length; i++) {
    if (consumed[i] || text[i] !== "$" || escaped(text, i)) continue;

    const delimiter: "$" | "$$" = text[i + 1] === "$" && !consumed[i + 1] ? "$$" : "$";
    if (delimiter === "$$") continue;
    if (adjacentDollar(text, i)) continue;
    const delimLen = delimiter.length;
    const openFrom = i;
    const openTo = openFrom + delimLen;
    let closeFrom = -1;
    let closeTo = -1;

    for (let j = openTo; j < text.length; j++) {
      if (delimiter === "$" && text[j] === "\n") break;
      if (consumed[j]) continue;
      if (text.slice(j, j + delimLen) !== delimiter || escaped(text, j)) continue;
      if (delimiter === "$" && adjacentDollar(text, j)) continue;
      closeFrom = j;
      closeTo = j + delimLen;
      break;
    }
    if (closeFrom < 0) continue;

    let blocked = false;
    for (let j = openFrom; j < closeTo; j++) {
      if (consumed[j]) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const rawTex = text.slice(openTo, closeFrom);
    if (!validContent(delimiter, rawTex)) continue;

    const display = false;
    const tex = rawTex.trim();
    const [hideFrom, hideTo] = [openFrom, closeTo];
    markConsumed(consumed, openFrom, closeTo);
    out.push({
      type: "math",
      from: openTo,
      to: closeFrom,
      openFrom,
      openTo,
      closeFrom,
      closeTo,
      attrs: { tex, delimiter, display },
      delimRanges: [{
        from: hideFrom,
        to: hideTo,
        softInside: true,
        className: display ? "math-source-hidden" : undefined,
      }],
      widgetDecorations: [
        {
          pos: openFrom,
          when: "outside",
          kind: "math-render",
          attrs: { tex, display: display ? "1" : "0" },
          side: -1,
        },
      ],
    });
    i = closeTo - 1;
  }
  return out;
}

function mathExtRanges(parent: Parameters<InlineFeatureSpec["extRanges"]>[0]): Array<[number, number]> {
  const consumed = new Uint8Array(parent.textContent.length);
  return scanMathRuns(parent.textContent, consumed).map((span) => [
    span.openFrom,
    span.closeTo,
  ]);
}

function displayMathRangeAtOffset(text: string, offset: number): { openFrom: number; openTo: number; closeFrom: number; closeTo: number } | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "$" || !isDisplayOpen(text, i)) continue;
    const openFrom = i;
    const openTo = openFrom + 2;
    if (openTo > offset) break;
    const searchFrom = openTo;
    for (let closeFrom = searchFrom; closeFrom < text.length; closeFrom++) {
      if (!isDisplayClose(text, closeFrom)) continue;
      if (offset > openFrom && offset <= closeFrom) return { openFrom, openTo, closeFrom, closeTo: closeFrom + 2 };
      break;
    }
  }
  return null;
}

export const math: FeatureSpec = {
  name: "math",

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

  markDelims: {
    math: { open: "", close: "" },
  },

  inline: {
    priority: 0.75,
    scan: scanMathRuns,
    markNames: ["math"],
    extRanges: mathExtRanges,
  },

  plugins: () => [
    new Plugin({
      props: {
        handleTextInput(view, from, to, text) {
          if (from !== to || text.includes("\n")) return false;
          const $from = view.state.doc.resolve(from);
          if (!$from.parent.isTextblock) return false;
          const range = displayMathRangeAtOffset($from.parent.textContent, $from.parentOffset);
          if (!range || $from.parentOffset !== range.closeFrom) return false;
          const tr = view.state.tr.insertText(`${text}\n`, from, to);
          tr.setSelection(TextSelection.create(tr.doc, from + text.length));
          view.dispatch(tr.scrollIntoView());
          return true;
        },
      },
    }),
  ],

  keymap: () => ({
    Enter: (state, dispatch) => {
      const sel = state.selection;
      const { $from, $to } = sel;
      if ($from.parent !== $to.parent || !$from.parent.isTextblock) return false;
      const range = displayMathRangeAtOffset($from.parent.textContent, $from.parentOffset);
      if (!range) return false;
      if (dispatch) {
        const tr = state.tr;
        tr.insertText("\n", sel.from, sel.to);
        dispatch(tr.scrollIntoView());
      }
      return true;
    },
  }),
};
