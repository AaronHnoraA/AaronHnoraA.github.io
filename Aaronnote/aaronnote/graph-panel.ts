import type { NoteSummary } from "./types.ts";

type GraphApi = { destroy?: () => void; setVisibleKeys?: (keys: string[]) => void };

export type GraphPanel = {
  dispose: () => void;
  render: () => void;
  scheduleRender: (delay?: number) => void;
};

function noteKey(note: NoteSummary): string {
  return note.key || note.id || note.path || note.file || "";
}

function roamNotes(notes: NoteSummary[]): NoteSummary[] {
  return notes.filter((note) => note.roam);
}

function loadScriptOnce(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

function renderError(host: HTMLElement, message: string): void {
  const empty = document.createElement("div");
  empty.className = "aaronnote-empty";
  empty.textContent = message;
  host.replaceChildren(empty);
}

export function createGraphPanel(options: {
  page: HTMLElement;
  filter: HTMLInputElement;
  stats: HTMLElement;
  canvas: HTMLElement;
  focusPanel: HTMLElement;
  getNotes: () => NoteSummary[];
  openNote: (note: NoteSummary) => void;
}): GraphPanel {
  let api: GraphApi | null = null;
  let scriptsReady: Promise<void> | null = null;
  let renderTimer = 0;
  let dataKey = "";

  function visibleNotes(): NoteSummary[] {
    const query = options.filter.value.trim().toLowerCase();
    return roamNotes(options.getNotes()).filter((note) => {
      const haystack = [
        note.title,
        note.id,
        note.path,
        note.groupLabel,
        note.summary,
        ...(note.tags ?? []),
        ...(note.aliases ?? []),
      ].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });
  }

  async function ensureScripts(): Promise<void> {
    if (scriptsReady) return scriptsReady;
    scriptsReady = (async () => {
      await loadScriptOnce("https://d3js.org/d3.v7.min.js");
      await loadScriptOnce("/roam-tools/knowledge.js");
      await loadScriptOnce("/roam-tools/graph.js");
    })();
    return scriptsReady;
  }

  function updatePublishData(): void {
    const graphNotes = roamNotes(options.getNotes());
    window.SITE_DATA = {
      meta: {
        generatedAt: new Date().toISOString(),
        noteCount: graphNotes.length,
        tagCount: new Set(graphNotes.flatMap((note) => note.tags ?? [])).size,
      },
      notes: graphNotes.map((note) => ({
        ...note,
        key: noteKey(note),
        link: note.link || note.path || "#",
        refs: note.refs ?? [],
        backlinks: note.backlinks ?? [],
        tags: note.tags ?? [],
        aliases: note.aliases ?? [],
      })),
    };
  }

  function currentDataKey(): string {
    return roamNotes(options.getNotes())
      .map((note) => [
        noteKey(note),
        note.title ?? "",
        note.path ?? "",
        (note.refs ?? []).join(","),
        (note.backlinks ?? []).join(","),
        (note.tags ?? []).join(","),
        (note.aliases ?? []).join(","),
      ].join("\t"))
      .join("\n");
  }

  function render(): void {
    window.clearTimeout(renderTimer);
    const nextDataKey = currentDataKey();
    updatePublishData();
    const shown = visibleNotes();
    const visibleKeys = shown.map(noteKey);
    options.stats.textContent = `${shown.length} nodes`;
    if (api?.setVisibleKeys && dataKey === nextDataKey) {
      api.setVisibleKeys(visibleKeys);
      return;
    }
    void ensureScripts()
      .then(() => {
        if (options.page.hidden) return;
        if (!window.initKnowledgeGraph) throw new Error("Publish graph is unavailable");
        window.buildKnowledgeData?.();
        api?.destroy?.();
        dataKey = nextDataKey;
        api = window.initKnowledgeGraph({
          knowledge: window.KNOWLEDGE_DATA,
          container: options.canvas,
          focusPanel: options.focusPanel,
          toolbar: true,
          emptyMessage: "Select a node.",
          listenForGlobalFilters: false,
          dispatchTagEvents: false,
          onNoteOpen(note: NoteSummary) {
            const target = options.getNotes().find((item) => noteKey(item) === noteKey(note) || item.id === note.id);
            if (target) options.openNote(target);
          },
          initialVisibleKeys: visibleKeys,
        });
      })
      .catch((err) => {
        renderError(options.canvas, err instanceof Error ? err.message : "Graph failed");
      });
  }

  function scheduleRender(delay = 120): void {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, delay);
  }

  function dispose(): void {
    window.clearTimeout(renderTimer);
    api?.destroy?.();
    api = null;
    dataKey = "";
    options.canvas.replaceChildren();
    options.focusPanel.replaceChildren();
  }

  return { dispose, render, scheduleRender };
}
