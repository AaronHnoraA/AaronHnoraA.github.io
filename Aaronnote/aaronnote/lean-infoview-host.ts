import { renderInfoview, type EditorApi, type InfoviewApi, defaultInfoviewConfig } from "@leanprover/infoview";
import { api } from "./api-client.ts";

type LeanInfoviewLocation = {
  uri: string;
  line: number;
  character: number;
};

type LeanOfficialInfoviewHost = {
  setLocation: (location: LeanInfoviewLocation | null) => void;
  hasContent: () => boolean;
  destroy: () => void;
};

type LeanOfficialInfoviewHostOptions = {
  showDocument?: (show: Parameters<EditorApi["showDocument"]>[0]) => Promise<void> | void;
  restartFile?: (uri: string) => Promise<void> | void;
  insertText?: (text: string, kind: Parameters<EditorApi["insertText"]>[1], pos?: Parameters<EditorApi["insertText"]>[2]) => Promise<void> | void;
  applyEdit?: (edit: Parameters<EditorApi["applyEdit"]>[0]) => Promise<void> | void;
};

type LeanNotification = {
  method?: string;
  params?: unknown;
};

function sameLocation(a: LeanInfoviewLocation | null, b: LeanInfoviewLocation | null): boolean {
  return a?.uri === b?.uri && a?.line === b?.line && a?.character === b?.character;
}

function asResult(raw: unknown): unknown {
  const value = raw as { ok?: boolean; result?: unknown; message?: string } | null;
  if (value?.ok === false) throw new Error(value.message || "Lean request failed");
  return value && "result" in value ? value.result : raw;
}

function normalizeInitializeResult(raw: unknown): { capabilities: Record<string, unknown>; serverInfo: { name: string; version: string } } {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const serverInfoValue = value.serverInfo && typeof value.serverInfo === "object"
    ? value.serverInfo as Record<string, unknown>
    : {};
  const version = String(serverInfoValue.version ?? "").trim();
  return {
    ...value,
    capabilities: value.capabilities && typeof value.capabilities === "object"
      ? value.capabilities as Record<string, unknown>
      : {},
    serverInfo: {
      name: String(serverInfoValue.name ?? "Lean"),
      version: /^\d+\.\d+\.\d+/.test(version) ? version : "4.0.0",
    },
  };
}

export function createLeanOfficialInfoviewHost(root: HTMLElement, options: LeanOfficialInfoviewHostOptions = {}): LeanOfficialInfoviewHost {
  const serverSubscriptions = new Map<string, number>();
  const clientSubscriptions = new Map<string, number>();
  let infoview: InfoviewApi | null = null;
  let current: LeanInfoviewLocation | null = null;
  let initialized = false;

  const editorApi: EditorApi = {
    async saveConfig() {},

    async sendClientRequest(_uri, method, params) {
      return asResult(await api.lean.lspRequest({ method, params, timeoutMs: 30_000 }));
    },

    async sendClientNotification(_uri, method, params) {
      await api.lean.lspNotify({ method, params });
    },

    async subscribeServerNotifications(method) {
      serverSubscriptions.set(method, (serverSubscriptions.get(method) ?? 0) + 1);
    },

    async unsubscribeServerNotifications(method) {
      const next = (serverSubscriptions.get(method) ?? 0) - 1;
      if (next > 0) serverSubscriptions.set(method, next);
      else serverSubscriptions.delete(method);
    },

    async subscribeClientNotifications(method) {
      clientSubscriptions.set(method, (clientSubscriptions.get(method) ?? 0) + 1);
    },

    async unsubscribeClientNotifications(method) {
      const next = (clientSubscriptions.get(method) ?? 0) - 1;
      if (next > 0) clientSubscriptions.set(method, next);
      else clientSubscriptions.delete(method);
    },

    async copyToClipboard(text) {
      await navigator.clipboard?.writeText(text);
    },

    async insertText(text, kind, pos) {
      await options.insertText?.(text, kind, pos);
    },

    async applyEdit(edit) {
      await options.applyEdit?.(edit);
    },

    async showDocument(show) {
      await options.showDocument?.(show);
    },

    async restartFile(uri) {
      await options.restartFile?.(String(uri ?? ""));
    },

    async createRpcSession(uri) {
      const raw = await api.lean.createRpcSession({ uri });
      const result = raw as { ok?: boolean; sessionId?: string; message?: string } | null;
      if (result?.ok === false || !result?.sessionId) throw new Error(result?.message || "Lean RPC session failed");
      return result.sessionId;
    },

    async closeRpcSession(sessionId) {
      await api.lean.closeRpcSession({ sessionId });
    },
  };

  try {
    infoview = renderInfoview(editorApi, root);
    void infoview.changedInfoviewConfig({
      ...defaultInfoviewConfig,
      expectedTypeVisibility: "Expanded by default",
      showGoalNames: true,
      emphasizeFirstGoal: true,
      showTooltipOnHover: false,
    });
    root.classList.add("lean-official-infoview--ready");
  } catch (err) {
    root.textContent = err instanceof Error ? err.message : "Lean infoview failed to load";
    root.classList.add("lean-official-infoview--error");
  }

  const unsubServer = api.lean.onNotification((raw) => {
    const data = raw as LeanNotification;
    const method = String(data.method ?? "");
    if (!method || !serverSubscriptions.has(method)) return;
    void infoview?.gotServerNotification(method, data.params);
  });

  const unsubClient = api.lean.onClientNotification((raw) => {
    const data = raw as LeanNotification;
    const method = String(data.method ?? "");
    if (!method || !clientSubscriptions.has(method)) return;
    void infoview?.sentClientNotification(method, data.params);
  });

  const markContentSoon = (): void => {
    window.setTimeout(() => {
      root.classList.toggle("lean-official-infoview--active", Boolean(root.textContent?.trim()));
    }, 120);
  };

  const restartInfoview = (initializeResult: unknown): void => {
    void infoview?.serverRestarted(normalizeInitializeResult(initializeResult)).then(markContentSoon).catch((err) => {
      root.classList.add("lean-official-infoview--error");
      root.textContent = err instanceof Error ? err.message : "Lean infoview failed to start";
    });
  };

  void api.lean.status().then((raw) => {
    const data = raw as { running?: boolean; initializeResult?: unknown };
    if (data?.running && data.initializeResult) restartInfoview(data.initializeResult);
  }).catch(() => {});

  const unsubStatus = api.lean.onStatus((raw) => {
    const data = raw as { message?: string; kind?: string; initializeResult?: unknown };
    if (data.kind === "Normal" || data.kind === "Ready") {
      if (data.initializeResult) restartInfoview(data.initializeResult);
    } else if (data.kind === "Inactive" || data.kind === "Error") {
      void infoview?.serverStopped({
        message: String(data.message ?? "Lean server stopped"),
        reason: String(data.kind ?? "stopped"),
      }).then(markContentSoon).catch(() => {});
    }
  });

  async function publishLocation(location: LeanInfoviewLocation): Promise<void> {
    if (!infoview) return;
    const loc = {
      uri: location.uri,
      range: {
        start: { line: location.line, character: location.character },
        end: { line: location.line, character: location.character },
      },
    };
    if (!initialized) {
      initialized = true;
      await infoview.initialize(loc);
    }
    await infoview.changedCursorLocation(loc);
    markContentSoon();
  }

  return {
    setLocation(location) {
      if (sameLocation(current, location)) return;
      current = location;
      if (location) void publishLocation(location).catch(() => {});
      else void infoview?.changedCursorLocation(undefined).catch(() => {});
    },
    hasContent() {
      return Boolean(root.textContent?.trim());
    },
    destroy() {
      unsubServer();
      unsubClient();
      unsubStatus();
      root.replaceChildren();
    },
  };
}
