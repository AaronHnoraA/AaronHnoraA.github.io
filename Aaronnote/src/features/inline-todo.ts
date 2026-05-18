import { markConsumed, type InlineSpan } from "../inline-parse.ts";
import { scanInlineCommands } from "../command-syntax.ts";
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
  meta: string;
};

function findTodos(text: string): TodoMatch[] {
  return scanInlineCommands(text, "todo").map((command) => ({
    fullFrom: command.fullFrom,
    fullTo: command.fullTo,
    contentFrom: command.contextFrom,
    contentTo: command.contextTo,
    status: normalizeTodoStatus(command.switchValue),
    content: command.context,
    meta: command.argsRaw,
  }));
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
        meta: match.meta,
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
            meta: match.meta,
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
        meta: { default: "" },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "span[data-inline-todo-mark]",
          getAttrs: (el) => ({
            status: normalizeTodoStatus((el as HTMLElement).getAttribute("data-status")),
            content: (el as HTMLElement).getAttribute("data-content") ?? "",
            meta: (el as HTMLElement).getAttribute("data-meta") ?? "",
          }),
        },
      ],
      toDOM: (mark) => [
        "span",
        {
          "data-inline-todo-mark": "",
          "data-status": mark.attrs.status,
          "data-content": mark.attrs.content,
          "data-meta": mark.attrs.meta,
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
