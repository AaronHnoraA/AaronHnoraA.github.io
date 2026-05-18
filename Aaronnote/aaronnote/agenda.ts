import type { NoteSummary } from "./types.ts";
import { formatShortDateTime } from "./ui-format.ts";

export type AgendaTodo = {
  id: string;
  status: "todo" | "doing" | "done" | "blocked";
  text: string;
  args?: Record<string, string>;
  meta?: string;
  ddl?: string;
  source: string;
  index: number;
  line: number;
  column: number;
  context: string;
  file: string;
  path?: string;
  noteKey?: string;
  noteId?: string;
  noteTitle?: string;
  noteDate?: string;
  groupKey?: string;
  groupLabel?: string;
  updatedAt: number;
};

type OpenNoteOptions = { newWindow?: boolean; equationTag?: string };
type TodoFocus = { file: string; source: string; index?: number };
type AgendaGroup = "status" | "ddl" | "file" | "time";

export type AgendaManager = {
  load: (force?: boolean) => Promise<void>;
  render: () => void;
  scheduleRender: () => void;
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "attachment";
}

function agendaStatusRank(status: AgendaTodo["status"]): number {
  return ({ blocked: 0, doing: 1, todo: 2, done: 3 } as Record<AgendaTodo["status"], number>)[status] ?? 9;
}

function ddlTime(todo: AgendaTodo): number {
  const raw = String(todo.ddl || "").trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(raw);
  const time = date.getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function todayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function ddlLabel(todo: AgendaTodo): string {
  const raw = String(todo.ddl || "").trim();
  if (!raw) return "No DDL";
  const time = ddlTime(todo);
  if (!Number.isFinite(time)) return `DDL ${raw}`;
  const day = Math.floor((time - todayStart()) / 86_400_000);
  if (day < 0) return "Overdue";
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow";
  if (day <= 7) return "Next 7 days";
  return "Later";
}

export function createAgendaManager(options: {
  filter: HTMLInputElement;
  sort: HTMLSelectElement;
  group: HTMLSelectElement;
  done: HTMLInputElement;
  count: HTMLElement;
  list: HTMLElement;
  getNotes: () => NoteSummary[];
  getCurrentFile: () => string;
  setStatus: (text: string) => void;
  setPendingTodoFocus: (focus: TodoFocus) => void;
  showEditorPage: () => void;
  jumpToTodoSource: (source: string, preferredIndex?: number) => boolean;
  openNote: (note: NoteSummary, options?: OpenNoteOptions) => void;
}): AgendaManager {
  let todos: AgendaTodo[] = [];
  let loading = false;
  let renderFrame = 0;

  function shownTodos(): AgendaTodo[] {
    const query = options.filter.value.trim().toLowerCase();
    const includeDone = options.done.checked;
    const shown = todos.filter((todo) => {
      if (!includeDone && todo.status === "done") return false;
      const haystack = [
        todo.status,
        todo.text,
        todo.ddl,
        todo.meta,
        todo.context,
        todo.noteTitle,
        todo.path,
        todo.file,
        todo.groupLabel,
      ].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });
    const sort = options.sort.value;
    return shown.sort((a, b) => {
      if (sort === "ddl") {
        return ddlTime(a) - ddlTime(b)
          || agendaStatusRank(a.status) - agendaStatusRank(b.status)
          || b.updatedAt - a.updatedAt
          || String(a.noteTitle).localeCompare(String(b.noteTitle));
      }
      if (sort === "file") {
        return String(a.path || a.file).localeCompare(String(b.path || b.file))
          || a.line - b.line
          || ddlTime(a) - ddlTime(b)
          || agendaStatusRank(a.status) - agendaStatusRank(b.status);
      }
      if (sort === "time") {
        return b.updatedAt - a.updatedAt
          || ddlTime(a) - ddlTime(b)
          || agendaStatusRank(a.status) - agendaStatusRank(b.status)
          || String(a.noteTitle).localeCompare(String(b.noteTitle));
      }
      return agendaStatusRank(a.status) - agendaStatusRank(b.status)
        || ddlTime(a) - ddlTime(b)
        || b.updatedAt - a.updatedAt
        || String(a.noteTitle).localeCompare(String(b.noteTitle));
    });
  }

  async function load(force = false): Promise<void> {
    if (loading) return;
    if (!force && todos.length > 0) {
      render();
      return;
    }
    loading = true;
    options.count.textContent = "Loading";
    try {
      const res = await fetch("/api/todos");
      const msg = await res.json() as { todos?: AgendaTodo[]; message?: string };
      if (!res.ok || !Array.isArray(msg.todos)) throw new Error(msg.message || "Todo scan failed");
      todos = msg.todos;
      render();
    } catch (err) {
      const empty = document.createElement("div");
      empty.className = "aaronnote-empty";
      empty.textContent = err instanceof Error ? err.message : "Todo scan failed";
      options.list.replaceChildren(empty);
      options.count.textContent = "Failed";
    } finally {
      loading = false;
    }
  }

  function scheduleRender(): void {
    window.cancelAnimationFrame(renderFrame);
    renderFrame = window.requestAnimationFrame(render);
  }

  function render(): void {
    const shown = shownTodos();
    const active = shown.filter((todo) => todo.status !== "done").length;
    const done = todos.filter((todo) => todo.status === "done").length;
    options.count.textContent = `${shown.length} shown · ${active} active${done ? ` · ${done} done` : ""}`;
    const frag = document.createDocumentFragment();
    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "aaronnote-empty";
      empty.textContent = todos.length === 0 ? "No todos indexed" : "No todos match the current filters";
      frag.appendChild(empty);
      options.list.replaceChildren(frag);
      return;
    }
    let lastGroup = "";
    const groupFor = (todo: AgendaTodo): string => {
      const group = options.group.value as AgendaGroup;
      if (group === "ddl") return ddlLabel(todo);
      if (group === "file") return todo.path || todo.file || "Scratch";
      if (group === "time") return formatShortDateTime(todo.updatedAt).split(",")[0] || "Undated";
      return todo.status.toUpperCase();
    };
    for (const todo of shown) {
      const group = groupFor(todo);
      if (group !== lastGroup) {
        lastGroup = group;
        const heading = document.createElement("div");
        heading.className = "aaronnote-agenda-group";
        heading.textContent = group;
        frag.appendChild(heading);
      }
      frag.appendChild(renderTodo(todo));
    }
    options.list.replaceChildren(frag);
  }

  function renderTodo(todo: AgendaTodo): HTMLElement {
    const item = document.createElement("article");
    item.className = "aaronnote-agenda-item";
    item.dataset.status = todo.status;
    item.dataset.ddl = todo.ddl ? "true" : "false";

    const status = document.createElement("span");
    status.className = "aaronnote-agenda-status";
    status.dataset.status = todo.status;
    status.textContent = todo.status.toUpperCase();

    const main = document.createElement("div");
    main.className = "aaronnote-agenda-main";
    const titleRow = document.createElement("div");
    titleRow.className = "aaronnote-agenda-title-row";
    const title = document.createElement("button");
    title.type = "button";
    title.className = "aaronnote-agenda-title";
    title.textContent = todo.text || "(empty todo)";
    title.addEventListener("click", (event) => focusTodo(todo, { newWindow: event.altKey || event.metaKey }));
    titleRow.append(title);
    if (todo.ddl) {
      const ddl = document.createElement("span");
      ddl.className = "aaronnote-agenda-ddl";
      ddl.textContent = `DDL ${todo.ddl}`;
      titleRow.append(ddl);
    }
    const meta = document.createElement("div");
    meta.className = "aaronnote-agenda-meta";
    meta.textContent = `${todo.noteTitle || fileNameFromPath(todo.file)} · ${todo.path || todo.file}:${todo.line}${todo.updatedAt ? ` · ${formatShortDateTime(todo.updatedAt)}` : ""}`;
    const context = document.createElement("div");
    context.className = "aaronnote-agenda-context";
    context.textContent = todo.context || todo.source;
    main.append(titleRow, meta, context);

    const actions = document.createElement("div");
    actions.className = "aaronnote-agenda-actions";
    const focus = document.createElement("button");
    focus.type = "button";
    focus.textContent = "Focus";
    focus.addEventListener("click", () => focusTodo(todo));
    actions.append(focus);

    item.append(status, main, actions);
    return item;
  }

  function focusTodo(todo: AgendaTodo, openOptions: { newWindow?: boolean } = {}): void {
    if (!todo.file) return;
    const note = options.getNotes().find((item) => item.file === todo.file) || {
      file: todo.file,
      path: todo.path || todo.file,
      title: todo.noteTitle || fileNameFromPath(todo.file),
      standalone: true,
    };
    options.setPendingTodoFocus({ file: todo.file, source: todo.source, index: todo.index });
    if (todo.file === options.getCurrentFile() && !openOptions.newWindow) {
      options.showEditorPage();
      if (!options.jumpToTodoSource(todo.source, todo.index)) options.setStatus("Todo source not found");
      return;
    }
    options.openNote(note, openOptions);
  }

  return { load, render, scheduleRender };
}
