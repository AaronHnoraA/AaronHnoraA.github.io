import { markConsumed, type InlineSpan } from "../inline-parse.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";

const TODO_STATUSES = ["todo", "doing", "done", "blocked"] as const;
type TodoStatus = (typeof TODO_STATUSES)[number];

function normalizeTodoStatus(raw: string | null | undefined): TodoStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "" || value === " " || value === "open" || value === "unchecked") return "todo";
  if (value === "~" || value === "-" || value === "wip" || value === "active") return "doing";
  if (value === "x" || value === "checked" || value === "complete") return "done";
  if (value === "!" || value === "block") return "blocked";
  return TODO_STATUSES.includes(value as TodoStatus) ? (value as TodoStatus) : "todo";
}

type TodoMatch = {
  fullFrom: number;
  fullTo: number;
  contentFrom: number;
  contentTo: number;
  status: TodoStatus;
  content: string;
};

function findTodoClose(text: string, openBracket: number): number {
  for (let i = openBracket + 1; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") return -1;
    if (ch === "]") return i;
  }
  return -1;
}

function findTodos(text: string): TodoMatch[] {
  const matches: TodoMatch[] = [];
  const re = /@@todo(?:\(([^)\n]*)\))?\s+\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const fullFrom = m.index;
    const openBracket = re.lastIndex - 1;
    const close = findTodoClose(text, openBracket);
    if (close < 0) continue;
    matches.push({
      fullFrom,
      fullTo: close + 1,
      contentFrom: openBracket + 1,
      contentTo: close,
      status: normalizeTodoStatus(m[1]),
      content: text.slice(openBracket + 1, close),
    });
    re.lastIndex = close + 1;
  }
  return matches;
}

const scan: InlineFeatureSpec["scan"] = (text, consumed) => {
  const out: InlineSpan[] = [];
  for (const match of findTodos(text)) {
    let blocked = false;
    for (let i = match.fullFrom; i < match.fullTo; i++) {
      if (consumed[i]) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    markConsumed(consumed, match.fullFrom, match.fullTo);
    out.push({
      type: "inline_todo",
      from: match.contentFrom,
      to: match.contentTo,
      openFrom: match.fullFrom,
      openTo: match.contentFrom,
      closeFrom: match.contentTo,
      closeTo: match.fullTo,
      attrs: {
        status: match.status,
        content: match.content,
      },
      delimRanges: [
        {
          from: match.fullFrom,
          to: match.fullTo,
          softInside: true,
          className: "todo-source-hidden",
        },
      ],
      widgetDecorations: [
        {
          pos: match.fullFrom,
          when: "outside",
          kind: "inline-todo",
          attrs: {
            status: match.status,
            content: match.content,
          },
          side: -1,
        },
      ],
    });
  }
  return out;
};

export const inlineTodo: FeatureSpec = {
  name: "inline-todo",

  marks: {
    inline_todo: {
      attrs: {
        status: { default: "todo" },
        content: { default: "" },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "span[data-inline-todo-mark]",
          getAttrs: (el) => ({
            status: normalizeTodoStatus((el as HTMLElement).getAttribute("data-status")),
            content: (el as HTMLElement).getAttribute("data-content") ?? "",
          }),
        },
      ],
      toDOM: (mark) => [
        "span",
        {
          "data-inline-todo-mark": "",
          "data-status": mark.attrs.status,
          "data-content": mark.attrs.content,
        },
        0,
      ],
    },
  },

  markDelims: {
    inline_todo: { open: "", close: "" },
  },

  inline: {
    priority: 2.9,
    scan,
    markNames: ["inline_todo"],
    extRanges: (parent) => findTodos(parent.textContent).map((todo) => [todo.fullFrom, todo.fullTo]),
  },
};
