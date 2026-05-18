type PluginSettings = Record<string, string | number | boolean>;
type Context = {
  id: string;
  root: HTMLElement;
  host: HTMLElement;
  currentFile: () => string;
  setStatus: (message: string) => void;
  onAction: (handler: (action: string) => void) => () => void;
  onSettingsChange: (handler: (settings: PluginSettings) => void) => () => void;
  getSettings: () => PluginSettings;
};
type RoamLookupResponse = {
  ok?: boolean;
  disabled?: boolean;
  sessionId?: string;
  answer?: string;
  message?: string;
  status?: string;
  busy?: boolean;
  closed?: boolean;
  idleMs?: number;
};

const defaultIdleMs = 60_000;

function numericSetting(value: string | number | boolean | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 10_000 ? n : fallback;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const msg = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String((msg as { message?: unknown }).message || res.statusText));
  return msg as T;
}

function appendMessage(list: HTMLElement, role: "user" | "assistant" | "system", text: string): HTMLElement {
  const item = document.createElement("article");
  item.className = `aaronnote-roamlookup-message is-${role}`;
  const label = document.createElement("strong");
  label.textContent = role === "user" ? "You" : role === "assistant" ? "RoamLookup" : "Status";
  const body = document.createElement("div");
  body.textContent = text;
  item.append(label, body);
  list.append(item);
  item.scrollIntoView({ block: "end" });
  return item;
}

export function setup(context: Context): () => void {
  const notesTabs = document.querySelector<HTMLElement>(".aaronnote-notes-tabs");
  const notesInner = document.querySelector<HTMLElement>(".aaronnote-notes-inner");
  const notesPage = document.querySelector<HTMLElement>("[data-notes-page]");
  if (!notesTabs || !notesInner) {
    context.setStatus("RoamLookup: notes page not found");
    return () => {};
  }

  let sessionId = "";
  let busy = false;
  let idleTimer = 0;
  let idleMs = numericSetting(context.getSettings().idleMs, defaultIdleMs);
  const cleanups: Array<() => void> = [];

  const style = document.createElement("style");
  style.textContent = `
.aaronnote-roamlookup-panel {
  display: grid;
  grid-template-rows: auto minmax(260px, 1fr) auto;
  min-height: min(720px, calc(100vh - 220px));
  gap: 12px;
}
.aaronnote-roamlookup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.aaronnote-roamlookup-head strong {
  color: var(--aaron-red-dark);
  font: 750 16px/1.2 var(--aaron-font-sans);
}
.aaronnote-roamlookup-head span {
  color: var(--aaron-muted);
  font-size: 12px;
}
.aaronnote-roamlookup-actions {
  display: flex;
  gap: 6px;
}
.aaronnote-roamlookup-panel button {
  min-height: 32px;
  border: 1px solid var(--aaron-paper-line);
  border-radius: 3px;
  padding: 0 10px;
  background: var(--aaron-paper);
  color: var(--aaron-ink);
  cursor: pointer;
}
.aaronnote-roamlookup-panel button:disabled {
  opacity: 0.55;
  cursor: default;
}
.aaronnote-roamlookup-log {
  overflow: auto;
  border: 1px solid var(--aaron-paper-line);
  background: var(--aaron-paper-soft);
  padding: 10px;
}
.aaronnote-roamlookup-message {
  display: grid;
  gap: 4px;
  margin: 0 0 10px;
  border-left: 3px solid var(--aaron-paper-line);
  padding: 7px 9px;
  background: var(--aaron-paper);
}
.aaronnote-roamlookup-message.is-user {
  border-left-color: var(--aaron-red);
}
.aaronnote-roamlookup-message.is-assistant {
  border-left-color: #15803d;
}
.aaronnote-roamlookup-message.is-system {
  border-left-color: #a16207;
}
.aaronnote-roamlookup-message strong {
  color: var(--aaron-muted);
  font-size: 11px;
}
.aaronnote-roamlookup-message div {
  white-space: pre-wrap;
  color: var(--aaron-ink);
  font: 13px/1.55 var(--aaron-font-sans);
}
.aaronnote-roamlookup-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}
.aaronnote-roamlookup-form textarea {
  width: 100%;
  min-height: 74px;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid var(--aaron-paper-line);
  border-radius: 3px;
  padding: 9px 10px;
  background: var(--aaron-paper);
  color: var(--aaron-ink);
  font: 13px/1.45 var(--aaron-font-sans);
}
`;
  document.head.appendChild(style);

  const tab = document.createElement("button");
  tab.type = "button";
  tab.dataset.notesTab = "roamlookup";
  tab.textContent = "Roam lookup";

  const panel = document.createElement("div");
  panel.dataset.notesPanel = "roamlookup";
  panel.className = "aaronnote-roamlookup-panel";
  panel.hidden = true;

  const head = document.createElement("header");
  head.className = "aaronnote-roamlookup-head";
  const titleBox = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Roam lookup";
  const status = document.createElement("span");
  status.textContent = "Not started";
  titleBox.append(title, status);
  const actions = document.createElement("div");
  actions.className = "aaronnote-roamlookup-actions";
  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.textContent = "Start";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  actions.append(startButton, closeButton);
  head.append(titleBox, actions);

  const log = document.createElement("div");
  log.className = "aaronnote-roamlookup-log";
  const form = document.createElement("form");
  form.className = "aaronnote-roamlookup-form";
  const input = document.createElement("textarea");
  input.placeholder = "Ask the knowledge base";
  const sendButton = document.createElement("button");
  sendButton.type = "submit";
  sendButton.textContent = "Ask";
  form.append(input, sendButton);
  panel.append(head, log, form);

  notesTabs.append(tab);
  notesInner.append(panel);

  function setUiStatus(text: string): void {
    status.textContent = text;
    context.setStatus(`RoamLookup: ${text}`);
  }

  function resetIdle(): void {
    window.clearTimeout(idleTimer);
    if (!sessionId) return;
    idleTimer = window.setTimeout(() => {
      if (busy) {
        resetIdle();
        return;
      }
      void closeSession("Idle timeout");
    }, idleMs);
  }

  async function startSession(): Promise<void> {
    resetIdle();
    if (sessionId) return;
    setUiStatus("Starting");
    const res = await postJson<RoamLookupResponse>("/api/roamlookup/start", { file: context.currentFile() });
    if (res.disabled) throw new Error(res.message || "RoamLookup disabled");
    sessionId = res.sessionId || "";
    idleMs = numericSetting(res.idleMs ?? idleMs, idleMs);
    setUiStatus(res.status || "Ready");
    resetIdle();
  }

  async function closeSession(reason = "Closed"): Promise<void> {
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    const current = sessionId;
    sessionId = "";
    busy = false;
    if (current) {
      await postJson<RoamLookupResponse>("/api/roamlookup/close", { sessionId: current }).catch(() => ({}));
    }
    setUiStatus(reason);
  }

  function showPanel(): void {
    if (notesPage?.hidden) {
      window.dispatchEvent(new CustomEvent("aaronnote:command", { detail: { command: "open-filesystem" } }));
    }
    document.querySelectorAll<HTMLButtonElement>("[data-notes-tab]").forEach((button) => {
      button.classList.toggle("is-active", button === tab);
    });
    document.querySelectorAll<HTMLElement>("[data-notes-panel]").forEach((candidate) => {
      candidate.hidden = candidate !== panel;
    });
    void startSession().then(() => input.focus()).catch((err) => {
      appendMessage(log, "system", err instanceof Error ? err.message : "RoamLookup failed");
      setUiStatus("Failed");
    });
  }

  async function submitQuery(): Promise<void> {
    const query = input.value.trim();
    if (!query || busy) return;
    await startSession();
    resetIdle();
    appendMessage(log, "user", query);
    input.value = "";
    busy = true;
    sendButton.disabled = true;
    const pending = appendMessage(log, "system", "Running");
    setUiStatus("Running");
    try {
      const res = await postJson<RoamLookupResponse>("/api/roamlookup/query", { sessionId, query });
      pending.remove();
      if (res.sessionId) sessionId = res.sessionId;
      appendMessage(log, "assistant", res.answer || res.message || "No answer");
      setUiStatus(res.status || "Ready");
    } catch (err) {
      pending.remove();
      appendMessage(log, "system", err instanceof Error ? err.message : "RoamLookup failed");
      setUiStatus("Failed");
    } finally {
      busy = false;
      sendButton.disabled = false;
      resetIdle();
      input.focus();
    }
  }

  const tabClick = (event: MouseEvent): void => {
    event.preventDefault();
    showPanel();
  };
  tab.addEventListener("click", tabClick);
  cleanups.push(() => tab.removeEventListener("click", tabClick));

  const hideOnBuiltInTab = (event: Event): void => {
    if ((event.currentTarget as HTMLElement | null) === tab) return;
    panel.hidden = true;
    tab.classList.remove("is-active");
  };
  document.querySelectorAll<HTMLButtonElement>("[data-notes-tab]").forEach((button) => {
    if (button === tab) return;
    button.addEventListener("click", hideOnBuiltInTab);
    cleanups.push(() => button.removeEventListener("click", hideOnBuiltInTab));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-action='notes'], [data-action='agenda']").forEach((button) => {
    button.addEventListener("click", hideOnBuiltInTab);
    cleanups.push(() => button.removeEventListener("click", hideOnBuiltInTab));
  });

  startButton.addEventListener("click", () => {
    void startSession().catch((err) => {
      appendMessage(log, "system", err instanceof Error ? err.message : "RoamLookup failed");
      setUiStatus("Failed");
    });
  });
  closeButton.addEventListener("click", () => void closeSession("Closed"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitQuery();
  });
  input.addEventListener("input", resetIdle);
  input.addEventListener("keydown", (event) => {
    resetIdle();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submitQuery();
    }
  });

  cleanups.push(context.onSettingsChange((settings) => {
    idleMs = numericSetting(settings.idleMs, defaultIdleMs);
    resetIdle();
  }));
  cleanups.push(context.onAction((action) => {
    if (action === "open") showPanel();
    if (action === "close") void closeSession("Closed");
  }));

  return () => {
    void closeSession("Closed");
    cleanups.splice(0).forEach((cleanup) => cleanup());
    tab.remove();
    panel.remove();
    style.remove();
  };
}
