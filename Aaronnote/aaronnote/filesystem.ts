import type { NoteSummary } from "./types.ts";
import { formatShortDateTime } from "./ui-format.ts";

type RecentNote = { file: string; openedAt: number };
type OpenNoteOptions = { newWindow?: boolean; equationTag?: string };

export type FilesystemBrowser = {
  render: () => void;
  renderRecent: () => void;
  scheduleRender: () => void;
  collapseAll: () => void;
  expandAll: () => void;
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "attachment";
}

function filesystemGroupFor(note: NoteSummary): string {
  return note.groupKey || (note.path || "").split(/[\\/]/).slice(0, -1).join("/") || "Root";
}

function noteSearchText(note: NoteSummary, cache: WeakMap<NoteSummary, string>): string {
  const cached = cache.get(note);
  if (cached !== undefined) return cached;
  const text = [
    note.title,
    note.id,
    note.file,
    note.path,
    note.ext,
    note.kind,
    note.date,
    note.groupKey,
    note.groupLabel,
    note.section,
    note.source,
    ...(note.aliases ?? []),
    ...(note.tags ?? []),
  ]
    .filter((item): item is string => Boolean(item))
    .join(" ")
    .toLowerCase();
  cache.set(note, text);
  return text;
}

function noteFileMeta(note: NoteSummary): string {
  if (note.tags?.length) return note.tags.slice(0, 4).map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return note.date || note.kind || note.section || note.source || (note.roam ? "roam" : "");
}

function filesystemGroupKeys(notes: NoteSummary[]): string[] {
  return [...new Set(notes.map(filesystemGroupFor))].sort((a, b) => a.localeCompare(b));
}

function loadCollapsedNoteGroups(storageKey: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function createFilesystemBrowser(options: {
  noteList: HTMLElement;
  recentList: HTMLElement;
  noteFilter: HTMLInputElement;
  noteCount: HTMLElement;
  managementCount: HTMLElement;
  getNotes: () => NoteSummary[];
  getRecentNotes: () => RecentNote[];
  getCurrentFile: () => string;
  openNote: (note: NoteSummary, options?: OpenNoteOptions) => void;
}): FilesystemBrowser {
  const collapseStorageKey = "aaronnote.filesystem.collapsed";
  const autoCollapseThreshold = 80;
  const searchRenderLimit = 240;
  const browseRenderLimit = 900;
  const searchCache = new WeakMap<NoteSummary, string>();
  let collapsedGroups = loadCollapsedNoteGroups(collapseStorageKey);
  let collapseInitialized = window.localStorage.getItem(collapseStorageKey) != null;
  let renderFrame = 0;

  function saveCollapsedNoteGroups(): void {
    try {
      window.localStorage.setItem(collapseStorageKey, JSON.stringify([...collapsedGroups].sort()));
    } catch {}
  }

  function currentFilesystemGroup(notes: NoteSummary[]): string {
    const note = notes.find((item) => item.file === options.getCurrentFile());
    return note ? filesystemGroupFor(note) : "";
  }

  function initializeFilesystemCollapse(notes: NoteSummary[], groups: Iterable<string>): void {
    if (collapseInitialized) return;
    collapseInitialized = true;
    if (notes.length <= autoCollapseThreshold) return;
    const currentGroup = currentFilesystemGroup(notes);
    collapsedGroups = new Set([...groups].filter((group) => group !== currentGroup));
    saveCollapsedNoteGroups();
  }

  function setGroupCollapsed(group: string, collapsed: boolean): void {
    collapseInitialized = true;
    if (collapsed) collapsedGroups.add(group);
    else collapsedGroups.delete(group);
    saveCollapsedNoteGroups();
    render();
  }

  function renderNoteButton(
    note: NoteSummary,
    detail: string,
    extra?: string,
    optionsArg: { fileRow?: boolean } = {},
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aaronnote-note";
    if (note.file && note.file === options.getCurrentFile()) button.classList.add("is-active");
    if (optionsArg.fileRow) {
      const ext = (note.ext || note.file?.split(".").pop() || "").toUpperCase();
      const badge = document.createElement("span");
      badge.className = "aaronnote-note-ext";
      badge.textContent = ext ? ext.slice(0, 8) : "NOTE";
      button.appendChild(badge);
    }
    const title = document.createElement("strong");
    title.textContent = note.title || note.id || note.file || "Untitled";
    const detailEl = document.createElement("span");
    detailEl.textContent = detail;
    button.append(title, detailEl);
    if (extra) {
      const extraEl = document.createElement("span");
      extraEl.className = "aaronnote-note-extra";
      extraEl.textContent = extra;
      button.appendChild(extraEl);
    }
    button.title = note.file || "";
    button.addEventListener("click", (event) => {
      options.openNote(note, { newWindow: event.altKey || event.metaKey });
    });
    return button;
  }

  function renderRecent(): void {
    const notes = options.getNotes();
    const byFile = new Map(notes.map((note) => [note.file, note]));
    const entries = options.getRecentNotes()
      .map((entry) => ({
        entry,
        note: byFile.get(entry.file) || {
          file: entry.file,
          path: entry.file,
          title: fileNameFromPath(entry.file),
          standalone: true,
        },
      }))
      .filter((item): item is { entry: RecentNote; note: NoteSummary } => Boolean(item.note?.file));

    const frag = document.createDocumentFragment();
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "aaronnote-empty";
      empty.textContent = "No recent notes";
      frag.appendChild(empty);
      options.recentList.replaceChildren(frag);
      return;
    }
    for (const { entry, note } of entries) {
      frag.appendChild(renderNoteButton(note, note.standalone ? "Standalone Markdown" : note.path || note.id || "", formatShortDateTime(entry.openedAt)));
    }
    options.recentList.replaceChildren(frag);
  }

  function renderLimitMessage(parent: DocumentFragment, shownCount: number, totalCount: number): void {
    if (shownCount >= totalCount) return;
    const message = document.createElement("div");
    message.className = "aaronnote-files-limit";
    message.textContent = `Showing ${shownCount} of ${totalCount}. Refine the filter to narrow the list.`;
    parent.appendChild(message);
  }

  function render(): void {
    const notes = options.getNotes();
    options.managementCount.textContent = `${notes.filter((note) => note.roam).length} / ${notes.length}`;
    renderRecent();
    const query = options.noteFilter.value.trim().toLowerCase();
    const filtered = notes.filter((note) => {
      return !query || noteSearchText(note, searchCache).includes(query);
    });
    initializeFilesystemCollapse(notes, filesystemGroupKeys(notes));
    const renderLimit = query ? searchRenderLimit : browseRenderLimit;
    const shown = filtered.slice(0, renderLimit);
    options.noteCount.textContent = query
      ? `${shown.length} / ${filtered.length} matches`
      : `${notes.length} notes`;

    const frag = document.createDocumentFragment();
    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "aaronnote-empty";
      empty.textContent = "No notes";
      frag.appendChild(empty);
      options.noteList.replaceChildren(frag);
      return;
    }
    const groups = new Map<string, NoteSummary[]>();
    for (const note of shown) {
      const group = filesystemGroupFor(note);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(note);
    }
    for (const [group, items] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const collapsed = !query && collapsedGroups.has(group);
      const heading = document.createElement("button");
      heading.type = "button";
      heading.className = "aaronnote-note-group";
      heading.setAttribute("aria-expanded", collapsed ? "false" : "true");
      const marker = document.createElement("span");
      marker.className = "aaronnote-note-group-marker";
      marker.textContent = collapsed ? ">" : "v";
      const label = document.createElement("strong");
      label.textContent = group.replace(/^\.\/?/, "") || "Root";
      const count = document.createElement("span");
      count.textContent = String(items.length);
      heading.append(marker, label, count);
      heading.addEventListener("click", () => setGroupCollapsed(group, !collapsed));
      frag.appendChild(heading);
      if (collapsed) continue;
      for (const note of items.sort((a, b) => String(a.title).localeCompare(String(b.title)))) {
        frag.appendChild(renderNoteButton(note, note.path || note.id || "", noteFileMeta(note), { fileRow: true }));
      }
    }
    renderLimitMessage(frag, shown.length, filtered.length);
    options.noteList.replaceChildren(frag);
  }

  function scheduleRender(): void {
    window.cancelAnimationFrame(renderFrame);
    renderFrame = window.requestAnimationFrame(render);
  }

  function collapseAll(): void {
    collapseInitialized = true;
    collapsedGroups = new Set(filesystemGroupKeys(options.getNotes()));
    saveCollapsedNoteGroups();
    render();
  }

  function expandAll(): void {
    collapseInitialized = true;
    collapsedGroups = new Set();
    saveCollapsedNoteGroups();
    render();
  }

  return { render, renderRecent, scheduleRender, collapseAll, expandAll };
}
