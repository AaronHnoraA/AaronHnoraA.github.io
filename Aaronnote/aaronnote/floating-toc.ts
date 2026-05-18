import type { Editor } from "../src/lib.ts";
import type { NoteSummary } from "./types.ts";

type OpenNoteOptions = { newWindow?: boolean; equationTag?: string };

export type FloatingTocPanel = {
  update: () => void;
  toggle: () => void;
};

export function createFloatingTocPanel(options: {
  toc: HTMLElement;
  toggleButton: HTMLButtonElement;
  list: HTMLElement;
  editor: Editor;
  getNotes: () => NoteSummary[];
  getCurrentFile: () => string;
  resolveNoteRef: (ref: string) => NoteSummary | undefined;
  openNote: (note: NoteSummary, options?: OpenNoteOptions) => void;
}): FloatingTocPanel {
  let renderKey = "";

  function editorHeadings(): Array<{ level: number; text: string; pos: number }> {
    const headings: Array<{ level: number; text: string; pos: number }> = [];
    options.editor.view.state.doc.descendants((node, pos) => {
      if (node.type.name !== "heading") return true;
      const level = Number(node.attrs.level || 1);
      headings.push({
        level: Number.isFinite(level) ? level : 1,
        text: node.textContent.trim() || "Untitled",
        pos: pos + 1,
      });
      return false;
    });
    return headings;
  }

  function renderRelatedNotes(parent: DocumentFragment | HTMLElement, currentNote: NoteSummary | undefined): void {
    if (!currentNote) return;
    const notes = options.getNotes();
    const byId = new Map(notes.map((note) => [note.id, note]));
    const sections: Array<[string, string[]]> = [
      ["Links", currentNote.refs ?? []],
      ["Backlinks", currentNote.backlinks ?? []],
    ];
    for (const [label, ids] of sections) {
      const resolved = ids
        .map((id) => byId.get(id) || options.resolveNoteRef(id))
        .filter((note): note is NoteSummary => Boolean(note?.file));
      if (resolved.length === 0) continue;
      const head = document.createElement("div");
      head.className = "aaronnote-toc-section";
      head.textContent = label;
      parent.appendChild(head);
      for (const note of resolved) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "aaronnote-toc-item aaronnote-toc-related";
        button.style.setProperty("--toc-depth", "0");
        button.textContent = note.title || note.id || note.file || "Untitled";
        button.title = note.file || note.title || "";
        button.addEventListener("click", (event) => options.openNote(note, { newWindow: event.altKey || event.metaKey }));
        parent.appendChild(button);
      }
    }
  }

  function update(): void {
    const notes = options.getNotes();
    const headings = editorHeadings();
    const selectionPos = options.editor.view.state.selection.from;
    const activeIndex = headings.reduce((active, heading, index) => heading.pos <= selectionPos ? index : active, -1);
    const currentNote = notes.find((note) => note.file === options.getCurrentFile());
    const relatedIds = [...(currentNote?.refs ?? []), ...(currentNote?.backlinks ?? [])];
    const key = `${activeIndex}\n${currentNote?.id ?? ""}\n${relatedIds.join(",")}\n${headings.map((h) => `${h.level}:${h.pos}:${h.text}`).join("\n")}`;
    if (key === renderKey) return;
    renderKey = key;
    const frag = document.createDocumentFragment();
    const relatedCount = relatedIds.length;
    options.toggleButton.textContent = headings.length > 0 ? `TOC ${headings.length}` : "TOC";
    if (headings.length === 0 && relatedIds.length === 0) {
      const empty = document.createElement("div");
      empty.className = "aaronnote-toc-empty";
      empty.textContent = "No headings";
      frag.appendChild(empty);
      options.list.replaceChildren(frag);
      return;
    }
    const status = document.createElement("div");
    status.className = "aaronnote-toc-status";
    status.textContent = relatedCount > 0
      ? `${headings.length} headings · ${relatedCount} links`
      : `${headings.length} headings`;
    frag.appendChild(status);
    headings.forEach((heading, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === activeIndex ? "aaronnote-toc-item is-active" : "aaronnote-toc-item";
      button.style.setProperty("--toc-depth", String(Math.max(0, heading.level - 1)));
      button.dataset.level = String(heading.level);
      button.title = heading.text;
      if (index === activeIndex) button.setAttribute("aria-current", "location");
      button.textContent = heading.text;
      button.addEventListener("click", () => {
        options.editor.setSelection(heading.pos);
        options.editor.focus();
      });
      frag.appendChild(button);
    });
    renderRelatedNotes(frag, currentNote);
    options.list.replaceChildren(frag);
  }

  function toggle(): void {
    options.toc.classList.toggle("is-collapsed");
    options.toggleButton.setAttribute("aria-expanded", options.toc.classList.contains("is-collapsed") ? "false" : "true");
  }

  return { update, toggle };
}
