import type { NoteSummary } from "./types.ts";
import { formatShortDateTime } from "./ui-format.ts";

type RecentNote = { file: string; openedAt: number };
type OpenNoteOptions = { newWindow?: boolean; equationTag?: string };
type RangerEntry =
  | { type: "dir"; path: string; label: string; count: number }
  | { type: "file"; note: NoteSummary; label: string; meta: string };
type SearchQuery = {
  terms: string[];
  tags: string[];
  aliases: string[];
  paths: string[];
  titles: string[];
  groups: string[];
  sections: string[];
};

export type FilesystemBrowser = {
  render: () => void;
  renderRecent: () => void;
  scheduleRender: () => void;
  collapseAll: () => void;
  expandAll: () => void;
  focus: () => void;
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "attachment";
}

function pathParts(path: string): string[] {
  return path.replace(/^\.\/?/, "").split(/[\\/]/).filter(Boolean);
}

function filesystemGroupFor(note: NoteSummary): string {
  return note.groupKey || (note.path || "").split(/[\\/]/).slice(0, -1).join("/") || "Root";
}

function groupLabel(group: string): string {
  if (!group || group === "Root") return "Root";
  return pathParts(group).at(-1) || group;
}

function groupParent(group: string): string {
  const parts = pathParts(group);
  if (parts.length <= 1) return "Root";
  return parts.slice(0, -1).join("/");
}

function normalizeDirectoryPath(dir: string): string {
  const parts = pathParts(dir);
  return parts.length ? parts.join("/") : "Root";
}

function isDirectChild(parent: string, child: string): boolean {
  if (child === "Root") return false;
  const parentParts = parent === "Root" ? [] : pathParts(parent);
  const childParts = pathParts(child);
  return childParts.length === parentParts.length + 1
    && parentParts.every((part, index) => childParts[index] === part);
}

function noteTitle(note: NoteSummary): string {
  return note.title || note.id || fileNameFromPath(note.file || note.path || "") || "Untitled";
}

function noteFileMeta(note: NoteSummary): string {
  if (note.tags?.length) return note.tags.slice(0, 4).map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return note.date || note.kind || note.section || note.source || (note.roam ? "roam" : "");
}

function normalizeSearchText(value: unknown): string {
  return String(value || "").toLowerCase();
}

function normalizeTag(value: unknown): string {
  return String(value || "").trim().replace(/^#/, "").toLowerCase();
}

function unquoteQueryValue(value: string): string {
  const text = String(value || "");
  if (text.length >= 2 && text.startsWith("\"") && text.endsWith("\"")) {
    return text.slice(1, -1).replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
  }
  return text;
}

function tokenizeQuery(text: string): string[] {
  const tokens: string[] = [];
  const pattern = /(#"(?:\\.|[^"\\])*")|([a-zA-Z]+:"(?:\\.|[^"\\])*")|("(?:\\.|[^"\\])*")|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(String(text || "")))) {
    if (match[1] !== undefined) tokens.push(match[1]);
    else if (match[2] !== undefined) tokens.push(match[2]);
    else if (match[3] !== undefined) tokens.push(unquoteQueryValue(match[3]));
    else if (match[4] !== undefined) tokens.push(match[4]);
  }
  return tokens.map((token) => token.trim()).filter(Boolean);
}

function uniqueSearchValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseSearchQuery(text: string): SearchQuery {
  const parsed: SearchQuery = {
    terms: [],
    tags: [],
    aliases: [],
    paths: [],
    titles: [],
    groups: [],
    sections: [],
  };
  for (const token of tokenizeQuery(text)) {
    if (token.startsWith("#") && token.length > 1) {
      const tag = normalizeTag(unquoteQueryValue(token.slice(1)));
      if (tag) parsed.tags.push(tag);
      continue;
    }

    const fieldMatch = token.match(/^([a-zA-Z]+):(.*)$/);
    if (!fieldMatch) {
      parsed.terms.push(normalizeSearchText(token));
      continue;
    }

    const field = fieldMatch[1]!.toLowerCase();
    const value = normalizeSearchText(unquoteQueryValue(fieldMatch[2] || ""));
    if (!value) continue;

    if (field === "tag" || field === "tags") parsed.tags.push(normalizeTag(value));
    else if (field === "alias" || field === "aliases" || field === "aka") parsed.aliases.push(value);
    else if (field === "path" || field === "file") parsed.paths.push(value);
    else if (field === "title") parsed.titles.push(value);
    else if (field === "group" || field === "folder") parsed.groups.push(value);
    else if (field === "section") parsed.sections.push(value);
    else parsed.terms.push(normalizeSearchText(token));
  }

  parsed.terms = uniqueSearchValues(parsed.terms);
  parsed.tags = uniqueSearchValues(parsed.tags);
  parsed.aliases = uniqueSearchValues(parsed.aliases);
  parsed.paths = uniqueSearchValues(parsed.paths);
  parsed.titles = uniqueSearchValues(parsed.titles);
  parsed.groups = uniqueSearchValues(parsed.groups);
  parsed.sections = uniqueSearchValues(parsed.sections);
  return parsed;
}

function includesAll(haystack: string, needles: readonly string[]): boolean {
  return needles.length === 0 || needles.every((needle) => haystack.includes(needle));
}

function listMatchesAll(values: readonly string[] | undefined, needles: readonly string[]): boolean {
  const normalized = (values ?? []).map(normalizeSearchText);
  return needles.length === 0 || needles.every((needle) =>
    normalized.some((value) => value === needle || value.includes(needle)));
}

function noteSearchText(note: NoteSummary, cache: WeakMap<NoteSummary, string>): string {
  const cached = cache.get(note);
  if (cached !== undefined) return cached;
  const text = [
    note.title,
    note.id,
    note.file,
    note.path,
    note.summary,
    note.ext,
    note.kind,
    note.date,
    note.groupKey,
    note.groupLabel,
    note.section,
    note.source,
    ...(note.aliases ?? []),
    ...(note.tags ?? []),
  ].filter((item): item is string => Boolean(item)).join(" ").toLowerCase();
  cache.set(note, text);
  return text;
}

function noteMatchesSearch(note: NoteSummary, query: SearchQuery, cache: WeakMap<NoteSummary, string>): boolean {
  const matchesText = includesAll(noteSearchText(note, cache), query.terms);
  const matchesTags = query.tags.length === 0
    || query.tags.every((tag) => (note.tags ?? []).map(normalizeTag).includes(tag));
  const matchesAliases = listMatchesAll(note.aliases, query.aliases);
  const matchesPath = includesAll(normalizeSearchText(`${note.path || ""} ${note.file || ""}`), query.paths);
  const matchesTitle = includesAll(normalizeSearchText(noteTitle(note)), query.titles);
  const matchesGroup = includesAll(normalizeSearchText(`${note.groupKey || ""} ${note.groupLabel || ""} ${filesystemGroupFor(note)}`), query.groups);
  const matchesSection = includesAll(normalizeSearchText(note.section), query.sections);
  return matchesText
    && matchesTags
    && matchesAliases
    && matchesPath
    && matchesTitle
    && matchesGroup
    && matchesSection;
}

function sortedNotes(items: NoteSummary[]): NoteSummary[] {
  return [...items].sort((a, b) =>
    noteTitle(a).localeCompare(noteTitle(b)) || String(a.file || "").localeCompare(String(b.file || "")));
}

function groupsFromNotes(notes: NoteSummary[]): Map<string, NoteSummary[]> {
  const groups = new Map<string, NoteSummary[]>();
  for (const note of notes) {
    const group = filesystemGroupFor(note);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(note);
  }
  return groups;
}

function allDirectoryGroups(groups: Map<string, NoteSummary[]>, extraDirs: Iterable<string> = []): string[] {
  const dirs = new Set<string>(["Root"]);
  for (const group of groups.keys()) {
    const parts = pathParts(group);
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  for (const dir of extraDirs) {
    const parts = pathParts(dir);
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  return [...dirs].sort((a, b) => {
    if (a === "Root") return -1;
    if (b === "Root") return 1;
    return a.localeCompare(b);
  });
}

function directoryCount(group: string, groups: Map<string, NoteSummary[]>): number {
  if (group === "Root") return [...groups.values()].reduce((total, items) => total + items.length, 0);
  const prefix = `${group}/`;
  return [...groups.entries()]
    .filter(([dir]) => dir === group || dir.startsWith(prefix))
    .reduce((total, [, items]) => total + items.length, 0);
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
  deleteNote?: (note: NoteSummary) => void;
  createNode?: () => void;
  createFolder?: (dir: string) => Promise<string | null | undefined>;
}): FilesystemBrowser {
  const searchRenderLimit = 240;
  const browseRenderLimit = 900;
  const searchCache = new WeakMap<NoteSummary, string>();
  let renderFrame = 0;
  let currentDir = "";
  let selectedFile = "";
  let selectedEntryId = "";
  let parentEntryId = "";
  let activePane: "parent" | "current" = "current";
  let lastFileClick = { id: "", at: 0 };
  const extraDirs = new Set<string>();

  function currentFilesystemGroup(notes: NoteSummary[]): string {
    const note = notes.find((item) => item.file === options.getCurrentFile());
    return note ? filesystemGroupFor(note) : "";
  }

  function renderNoteButton(note: NoteSummary, detail: string, extra?: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aaronnote-note";
    if (note.file && note.file === options.getCurrentFile()) button.classList.add("is-active");
    const title = document.createElement("strong");
    title.textContent = noteTitle(note);
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
    button.addEventListener("click", (event) => options.openNote(note, { newWindow: event.altKey || event.metaKey }));
    button.addEventListener("auxclick", (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      options.openNote(note, { newWindow: true });
    });
    return button;
  }

  function shouldOpenFileClick(entry: RangerEntry, event: MouseEvent): boolean {
    if (entry.type !== "file") return false;
    if (event.detail >= 2 || event.altKey || event.metaKey) return true;
    const id = entryId(entry);
    const now = Date.now();
    const repeated = lastFileClick.id === id && now - lastFileClick.at < 700;
    lastFileClick = { id, at: now };
    return repeated;
  }

  function directoryEntries(dir: string, groups: Map<string, NoteSummary[]>): RangerEntry[] {
    const dirs = allDirectoryGroups(groups, extraDirs)
      .filter((group) => isDirectChild(dir, group))
      .map((group) => ({
        type: "dir" as const,
        path: group,
        label: groupLabel(group),
        count: directoryCount(group, groups),
      }));
    const files = sortedNotes(groups.get(dir) ?? []).map((note) => ({
      type: "file" as const,
      note,
      label: noteTitle(note),
      meta: noteFileMeta(note) || fileNameFromPath(note.file || note.path || ""),
    }));
    return [...dirs, ...files];
  }

  function setCurrentSelection(entry: RangerEntry | null | undefined): void {
    selectedEntryId = entry ? entryId(entry) : "";
    selectedFile = entry?.type === "file" ? entry.note.file || "" : "";
  }

  function selectDirectory(dir: string, groups: Map<string, NoteSummary[]>, preferredEntryId = ""): void {
    currentDir = dir || "Root";
    const entries = directoryEntries(currentDir, groups);
    const next = (preferredEntryId ? entries.find((entry) => entryId(entry) === preferredEntryId) : null)
      ?? entries.find((entry) => entry.type === "file" && entry.note.file === selectedFile)
      ?? entries[0];
    setCurrentSelection(next);
  }

  function ensureSelection(groups: Map<string, NoteSummary[]>, shown: NoteSummary[], query: string): void {
    const current = shown.find((note) => note.file === options.getCurrentFile());
    if (!currentDir) currentDir = current ? filesystemGroupFor(current) : "Root";
    if (query) {
      if (!selectedFile || !shown.some((note) => note.file === selectedFile)) {
        selectedFile = current?.file || shown[0]?.file || "";
      }
      return;
    }
    if (!allDirectoryGroups(groups, extraDirs).includes(currentDir)) currentDir = "Root";
    const currentEntries = directoryEntries(currentDir, groups);
    if (!selectedEntryId || !currentEntries.some((entry) => entryId(entry) === selectedEntryId)) {
      const first = currentEntries.find((entry) => entry.type === "file" && entry.note.file === selectedFile)
        ?? currentEntries[0];
      setCurrentSelection(first);
    }
  }

  function selectedNoteFrom(entries: readonly RangerEntry[], shown: NoteSummary[]): NoteSummary | null {
    return entries.find((entry) => entry.type === "file" && entryId(entry) === selectedEntryId)?.note
      ?? shown.find((note) => note.file === selectedFile)
      ?? shown.find((note) => note.file === options.getCurrentFile())
      ?? shown[0]
      ?? null;
  }

  function entryId(entry: RangerEntry): string {
    return entry.type === "dir" ? `dir:${entry.path}` : `file:${entry.note.file || entry.note.path || entry.note.id || ""}`;
  }

  function renderRangerRow(optionsArg: {
    label: string;
    meta?: string;
    icon: string;
    active?: boolean;
    title?: string;
    onClick: (event: MouseEvent) => void;
    onDoubleClick?: (event: MouseEvent) => void;
    onAuxClick?: (event: MouseEvent) => void;
  }): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aaronnote-ranger-row";
    if (optionsArg.active) button.classList.add("is-active");
    button.title = optionsArg.title || optionsArg.label;
    const icon = document.createElement("span");
    icon.className = "aaronnote-ranger-icon";
    icon.textContent = optionsArg.icon;
    const label = document.createElement("strong");
    label.textContent = optionsArg.label;
    const meta = document.createElement("span");
    meta.className = "aaronnote-ranger-meta";
    meta.textContent = optionsArg.meta || "";
    button.append(icon, label, meta);
    button.addEventListener("click", optionsArg.onClick);
    if (optionsArg.onDoubleClick) button.addEventListener("dblclick", optionsArg.onDoubleClick);
    if (optionsArg.onAuxClick) button.addEventListener("auxclick", optionsArg.onAuxClick);
    return button;
  }

  function renderPreview(note: NoteSummary | null, query: string): HTMLElement {
    const preview = document.createElement("section");
    preview.className = "aaronnote-ranger-preview";
    if (!note) {
      const empty = document.createElement("div");
      empty.className = "aaronnote-empty";
      empty.textContent = "No preview";
      preview.appendChild(empty);
      return preview;
    }
    const badge = document.createElement("span");
    badge.className = "aaronnote-ranger-kind";
    badge.textContent = (note.ext || note.kind || (note.roam ? "roam" : "note")).toUpperCase().slice(0, 12);
    const title = document.createElement("h2");
    title.textContent = noteTitle(note);
    const path = document.createElement("p");
    path.className = "aaronnote-ranger-path";
    path.textContent = note.path || note.file || note.id || "";
    preview.append(badge, title, path);

    const stats = document.createElement("dl");
    const fields: Array<[string, string]> = [
      ["Folder", filesystemGroupFor(note)],
      ["Date", note.date || ""],
      ["Section", note.section || ""],
      ["Source", note.source || ""],
      ["Refs", note.refs?.length ? String(note.refs.length) : ""],
      ["Backlinks", note.backlinks?.length ? String(note.backlinks.length) : ""],
    ].filter(([, value]) => Boolean(value));
    for (const [key, value] of fields) {
      const dt = document.createElement("dt");
      dt.textContent = key;
      const dd = document.createElement("dd");
      dd.textContent = value;
      stats.append(dt, dd);
    }
    preview.appendChild(stats);

    if (note.summary) {
      const summary = document.createElement("p");
      summary.className = "aaronnote-ranger-summary";
      summary.textContent = note.summary;
      preview.appendChild(summary);
    }
    if (note.tags?.length) {
      const tags = document.createElement("div");
      tags.className = "aaronnote-ranger-tags";
      for (const tag of note.tags.slice(0, 12)) {
        const pill = document.createElement("span");
        pill.textContent = `#${tag.replace(/^#/, "")}`;
        tags.appendChild(pill);
      }
      preview.appendChild(tags);
    }
    const open = document.createElement("button");
    open.type = "button";
    open.className = "aaronnote-ranger-open";
    open.textContent = query ? "Open match" : "Open file";
    open.addEventListener("click", (event) => options.openNote(note, { newWindow: event.altKey || event.metaKey }));
    preview.appendChild(open);
    return preview;
  }

  function renderRecent(): void {
    const notes = options.getNotes();
    const byFile = new Map(notes.map((note) => [note.file, note]));
    const entries = options.getRecentNotes()
      .map((entry) => ({
        entry,
        note: byFile.get(entry.file) || { file: entry.file, path: entry.file, title: fileNameFromPath(entry.file), standalone: true },
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
    const activeElement = document.activeElement;
    const restoreRangerFocus = activeElement instanceof HTMLElement
      && options.noteList.contains(activeElement)
      && Boolean(activeElement.closest(".aaronnote-ranger"));
    const notes = options.getNotes();
    options.managementCount.textContent = `${notes.filter((note) => note.roam).length} / ${notes.length}`;
    renderRecent();
    const query = options.noteFilter.value.trim();
    const parsedQuery = parseSearchQuery(query);
    const filtered = notes.filter((note) => !query || noteMatchesSearch(note, parsedQuery, searchCache));
    const renderLimit = query ? searchRenderLimit : browseRenderLimit;
    const shown = filtered.slice(0, renderLimit);
    options.noteCount.textContent = query ? `${shown.length} / ${filtered.length} matches` : `${notes.length} notes`;

    const frag = document.createDocumentFragment();
    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "aaronnote-empty";
      empty.textContent = "No notes";
      frag.appendChild(empty);
      options.noteList.replaceChildren(frag);
      return;
    }

    const groups = groupsFromNotes(shown);
    ensureSelection(groups, shown, query);
    if (query) activePane = "current";
    const shell = document.createElement("div");
    shell.className = "aaronnote-ranger";
    shell.tabIndex = 0;
    const dirs = document.createElement("section");
    dirs.className = "aaronnote-ranger-pane aaronnote-ranger-dirs";
    const files = document.createElement("section");
    files.className = "aaronnote-ranger-pane aaronnote-ranger-files";

    const parentDir = groupParent(currentDir);
    const parentEntries = directoryEntries(parentDir, groups);
    const currentEntries: RangerEntry[] = query
      ? sortedNotes(shown).map((note) => ({ type: "file" as const, note, label: noteTitle(note), meta: filesystemGroupFor(note) }))
      : directoryEntries(currentDir, groups);
    if (!currentEntries.some((entry) => entryId(entry) === selectedEntryId)) {
      const first = currentEntries.find((entry) => entry.type === "file" && entry.note.file === selectedFile)
        ?? currentEntries[0];
      setCurrentSelection(first);
    }
    if (!parentEntries.some((entry) => entryId(entry) === parentEntryId)) {
      const currentDirEntry = parentEntries.find((entry) => entry.type === "dir" && entry.path === currentDir);
      parentEntryId = currentDirEntry ? entryId(currentDirEntry) : "";
    }

    for (const entry of parentEntries) {
      const active = activePane === "parent" && entryId(entry) === parentEntryId;
      dirs.appendChild(renderRangerRow({
        label: entry.label,
        meta: entry.type === "dir" ? String(entry.count) : entry.meta,
        icon: entry.type === "dir" ? ">" : ".",
        active,
        title: entry.type === "dir" ? entry.path : entry.note.file || "",
        onClick: (event) => {
          activePane = "parent";
          activateParentEntry(entry);
          if (shouldOpenFileClick(entry, event)) {
            options.openNote(entry.note, { newWindow: event.altKey || event.metaKey });
            return;
          }
          render();
        },
      }));
    }

    for (const entry of currentEntries) {
      const active = activePane === "current" && entryId(entry) === selectedEntryId;
      files.appendChild(renderRangerRow({
        label: entry.label,
        meta: entry.type === "dir" ? String(entry.count) : entry.meta,
        icon: entry.type === "dir" ? ">" : entry.note.file === options.getCurrentFile() ? "*" : ".",
        active,
        title: entry.type === "dir" ? entry.path : entry.note.file || entry.note.path || entry.note.id || "",
        onClick: (event) => {
          activePane = "current";
          if (entry.type === "dir") {
            selectDirectory(entry.path, groups);
            render();
          } else {
            setCurrentSelection(entry);
            if (shouldOpenFileClick(entry, event)) {
              options.openNote(entry.note, { newWindow: event.altKey || event.metaKey });
            }
            else render();
          }
        },
        onAuxClick: (event) => {
          if (event.button !== 1 || entry.type !== "file") return;
          event.preventDefault();
          setCurrentSelection(entry);
          options.openNote(entry.note, { newWindow: true });
        },
      }));
    }

    function nextEntry(entries: readonly RangerEntry[], currentId: string, delta: number): RangerEntry | null {
      if (entries.length === 0) return null;
      const index = entries.findIndex((entry) => entryId(entry) === currentId);
      const baseIndex = index >= 0 ? index : delta > 0 ? -1 : entries.length;
      const nextIndex = Math.max(0, Math.min(entries.length - 1, baseIndex + delta));
      return entries[nextIndex] ?? null;
    }

    function selectedEntry(): RangerEntry | null {
      return currentEntries.find((entry) => entryId(entry) === selectedEntryId) ?? currentEntries[0] ?? null;
    }

    function selectedParentEntry(): RangerEntry | null {
      return parentEntries.find((entry) => entryId(entry) === parentEntryId) ?? null;
    }

    function activeFileEntry(): Extract<RangerEntry, { type: "file" }> | null {
      const entry = activePane === "parent" ? selectedParentEntry() : selectedEntry();
      return entry?.type === "file" ? entry : null;
    }

    function activateParentEntry(entry: RangerEntry): void {
      parentEntryId = entryId(entry);
      if (entry.type === "dir") {
        selectDirectory(entry.path, groups);
      } else {
        setCurrentSelection(entry);
      }
    }

    function activateParentPane(): void {
      if (!parentEntryId) return;
      activePane = "parent";
      render();
    }

    function activateCurrentPane(): void {
      const entry = selectedParentEntry();
      if (entry?.type === "file") {
        selectDirectory(filesystemGroupFor(entry.note), groups, entryId(entry));
      }
      activePane = "current";
      render();
    }

    function moveUpDirectory(): void {
      const nextDir = groupParent(currentDir);
      if (nextDir === currentDir) return;
      const previousDir = currentDir;
      selectDirectory(nextDir, groups, `dir:${previousDir}`);
      const nextParentEntries = directoryEntries(groupParent(nextDir), groups);
      const nextParentId = `dir:${nextDir}`;
      parentEntryId = nextParentEntries.some((entry) => entryId(entry) === nextParentId) ? nextParentId : "";
      activePane = parentEntryId ? "parent" : "current";
      render();
    }

    function openSelected(event: KeyboardEvent): void {
      const entry = selectedEntry();
      if (!entry) return;
      if (entry.type === "dir") {
        selectDirectory(entry.path, groups);
        activePane = "current";
        render();
      } else {
        options.openNote(entry.note, { newWindow: event.altKey || event.metaKey });
      }
    }

    function moveCurrent(delta: number): void {
      const next = nextEntry(currentEntries, selectedEntryId, delta);
      if (!next) return;
      activePane = "current";
      setCurrentSelection(next);
      render();
    }

    function moveParent(delta: number): void {
      const next = nextEntry(parentEntries, parentEntryId, delta);
      if (!next) return;
      activePane = "parent";
      activateParentEntry(next);
      render();
    }

    function deleteSelectedFile(): void {
      const entry = activeFileEntry();
      if (!entry || !options.deleteNote) return;
      options.deleteNote(entry.note);
    }

    function createNodeFromRanger(): void {
      options.createNode?.();
    }

    async function createFolderFromRanger(): Promise<void> {
      if (!options.createFolder) return;
      const created = await options.createFolder(currentDir === "Root" ? "" : currentDir);
      if (!created) return;
      const dir = normalizeDirectoryPath(created);
      extraDirs.add(dir);
      selectDirectory(dir, groups);
      activePane = "current";
      render();
    }

    shell.addEventListener("keydown", (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if ((event.ctrlKey || event.metaKey) && key === "Enter") return;
      if ((event.ctrlKey || event.metaKey || event.altKey) && key !== "Enter") return;
      if (key === "ArrowLeft" || key === "h") {
        event.preventDefault();
        if (activePane === "current") activateParentPane();
        else moveUpDirectory();
      } else if (key === "ArrowRight" || key === "l" || key === "Enter") {
        event.preventDefault();
        if (activePane === "parent") activateCurrentPane();
        else openSelected(event);
      } else if (key === "ArrowUp" || key === "k") {
        event.preventDefault();
        if (activePane === "parent" || event.shiftKey) moveParent(-1);
        else moveCurrent(-1);
      } else if (key === "ArrowDown" || key === "j") {
        event.preventDefault();
        if (activePane === "parent" || event.shiftKey) moveParent(1);
        else moveCurrent(1);
      } else if (key === "PageUp" || key === "PageDown") {
        event.preventDefault();
        if (activePane === "parent" || event.shiftKey) moveParent(key === "PageDown" ? 8 : -8);
        else moveCurrent(key === "PageDown" ? 8 : -8);
      } else if (key === "d") {
        event.preventDefault();
        deleteSelectedFile();
      } else if (key === "n") {
        event.preventDefault();
        createNodeFromRanger();
      } else if (key === "a") {
        event.preventDefault();
        void createFolderFromRanger();
      }
    });

    const parentPreviewEntry = activePane === "parent" ? selectedParentEntry() : null;
    const previewNote = parentPreviewEntry?.type === "file"
      ? parentPreviewEntry.note
      : selectedNoteFrom(currentEntries, shown);
    shell.append(dirs, files, renderPreview(previewNote, query));
    frag.appendChild(shell);
    renderLimitMessage(frag, shown.length, filtered.length);
    options.noteList.replaceChildren(frag);
    if (restoreRangerFocus) {
      shell.focus({ preventScroll: true });
      shell.querySelector<HTMLElement>(".aaronnote-ranger-row.is-active")?.scrollIntoView({ block: "nearest" });
    }
  }

  function focus(): void {
    const target = options.noteList.querySelector<HTMLElement>(".aaronnote-ranger");
    target?.focus();
  }

  function scheduleRender(): void {
    window.cancelAnimationFrame(renderFrame);
    renderFrame = window.requestAnimationFrame(render);
  }

  function collapseAll(): void {
    currentDir = groupParent(currentDir || currentFilesystemGroup(options.getNotes()));
    selectedFile = "";
    render();
  }

  function expandAll(): void {
    const notes = options.getNotes();
    const current = notes.find((note) => note.file === options.getCurrentFile());
    if (current) {
      currentDir = filesystemGroupFor(current);
      selectedFile = current.file || "";
    }
    render();
  }

  return { render, renderRecent, scheduleRender, collapseAll, expandAll, focus };
}
