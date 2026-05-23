/**
 * Lean 4 LSP client for Aaronnote.
 *
 * Spawns `lake serve` (or `lean --server` as fallback) in the notes root,
 * manages virtual Lean documents keyed by note path, and surfaces
 * diagnostics / goal state back to the renderer via push notifications.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { LspClient } from "./lsp-base.mjs";
import { writeMirror, deleteMirror, renameMirror, leanMirrorPath } from "./lean-mirror.mjs";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let leanClient = null;
let notesRoot = "";
let diagnosticsCache = new Map(); // leanPath → diagnostics array
let progressCache = new Map();    // leanPath → fileProgress params
let openCount = 0;
let idleTimer = null;
let pushDiagnostics = null; // injected by desktop/main.mjs
let pushProgress = null;
let pushStatus = null;
let leanLog = [];

function log(type, data = {}) {
  leanLog.push({ type, ...data, ts: Date.now() });
  if (leanLog.length > 300) leanLog = leanLog.slice(-300);
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function leanEnvPath(base = process.env.PATH || "") {
  const extras = [
    join(homedir(), ".elan", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ];
  const parts = String(base).split(":").filter(Boolean);
  for (const e of extras) {
    if (!parts.includes(e)) parts.push(e);
  }
  return parts.join(":");
}

function findExecutable(names) {
  const PATH = leanEnvPath();
  for (const name of names) {
    for (const dir of PATH.split(":")) {
      const full = join(dir, name);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// LeanLspClient
// ---------------------------------------------------------------------------

class LeanLspClient extends LspClient {
  constructor(root) {
    super();
    this.root = root;
    this.status = { message: "Not started", kind: "Inactive", busy: false };
    this.ready = null;
    this.documents = new Map(); // leanPath → { version, content }
  }

  setStatus(message, kind = "Normal", busy = false) {
    this.status = { message, kind, busy };
    pushStatus?.({ ...this.status });
  }

  onStderr(msg) {
    log("lean-stderr", { message: msg });
  }

  onError(err) {
    log("lean-error", { message: err.message });
    this.setStatus(err.message, "Error", false);
  }

  onExit(code, signal) {
    log("lean-exit", { code, signal });
    this.setStatus(`Lean server exited (${signal ?? code ?? "unknown"})`, "Error", false);
    this.documents.clear();
    openCount = 0;
  }

  handleNotification(method, params) {
    if (method === "textDocument/publishDiagnostics") {
      const uri = params?.uri ?? "";
      diagnosticsCache.set(uri, params?.diagnostics ?? []);
      log("lean-diagnostics", { uri, count: (params?.diagnostics ?? []).length });
      pushDiagnostics?.({ uri, diagnostics: params?.diagnostics ?? [] });
      return;
    }
    if (method === "$/lean/fileProgress") {
      const uri = params?.textDocument?.uri ?? "";
      progressCache.set(uri, params?.processing ?? []);
      pushProgress?.({ uri, processing: params?.processing ?? [] });
      return;
    }
    if (method === "window/logMessage") {
      const msg = params?.message ?? "";
      if (msg) log("lean-log", { message: msg });
      return;
    }
    // log unknown $/lean/* notifications for future debugging
    if (method.startsWith("$/lean/")) {
      log("lean-notification", { method, params });
    }
  }

  handleServerRequest(id, method, params) {
    if (method === "window/showMessageRequest") {
      const actions = Array.isArray(params?.actions) ? params.actions : [];
      this.respond(id, actions[0] ?? null);
      return;
    }
    if (method === "workspace/configuration") {
      const items = Array.isArray(params?.items) ? params.items : [];
      this.respond(id, items.map(() => ({})));
      return;
    }
    this.respond(id, null);
  }

  async ensureReady() {
    if (this.ready) return this.ready;
    this.ready = this._start();
    return this.ready;
  }

  async _start() {
    this.setStatus("Starting...", "Normal", true);
    log("lean-start", { root: this.root });

    const lake = findExecutable(["lake"]);
    const lean = findExecutable(["lean"]);

    let command, args;
    if (lake) {
      command = lake; args = ["serve", "--"];
    } else if (lean) {
      command = lean; args = ["--server"];
    } else {
      const msg = "Lean not found. Install via elan: https://github.com/leanprover/elan";
      this.setStatus(msg, "Error", false);
      throw new Error(msg);
    }

    log("lean-spawn", { command, args, cwd: this.root });
    this.spawnProcess(command, args, {
      cwd: this.root,
      env: { ...process.env, PATH: leanEnvPath() },
    });

    await this._initialize();
    this.setStatus("Ready", "Normal", false);
    log("lean-ready");
  }

  async _initialize() {
    const rootUri = pathToFileURL(this.root).href;
    await this.request("initialize", {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: "AaronNotes" }],
      capabilities: {
        workspace: { workspaceFolders: true, configuration: true },
        window: { showDocument: { support: false } },
        textDocument: {
          synchronization: { dynamicRegistration: false, didSave: false },
          publishDiagnostics: { relatedInformation: true },
        },
      },
      initializationOptions: {
        editDelay: 0,
      },
    });
    this.notify("initialized", {});
  }

  // ---------------------------------------------------------------------------
  // Document management
  // ---------------------------------------------------------------------------

  openDocument(leanPath, leanText) {
    const uri = pathToFileURL(leanPath).href;
    const existing = this.documents.get(uri);
    if (existing) {
      if (existing.content !== leanText) {
        const version = existing.version + 1;
        this.documents.set(uri, { version, content: leanText });
        this.notify("textDocument/didChange", {
          textDocument: { uri, version },
          contentChanges: [{ text: leanText }],
        });
      }
      return;
    }
    const version = 1;
    this.documents.set(uri, { version, content: leanText });
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "lean4", version, text: leanText },
    });
  }

  changeDocument(leanPath, leanText) {
    const uri = pathToFileURL(leanPath).href;
    const existing = this.documents.get(uri);
    if (!existing) {
      this.openDocument(leanPath, leanText);
      return;
    }
    if (existing.content === leanText) return;
    const version = existing.version + 1;
    this.documents.set(uri, { version, content: leanText });
    this.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text: leanText }],
    });
  }

  closeDocument(leanPath) {
    const uri = pathToFileURL(leanPath).href;
    if (!this.documents.has(uri)) return;
    this.documents.delete(uri);
    diagnosticsCache.delete(uri);
    progressCache.delete(uri);
    this.notify("textDocument/didClose", { textDocument: { uri } });
  }

  async getGoals(leanPath, line, character) {
    await this.ensureReady();
    const uri = pathToFileURL(leanPath).href;
    try {
      const result = await this.request("$/lean/plainGoal", {
        textDocument: { uri },
        position: { line, character },
      }, 10_000);
      return result;
    } catch {
      return null;
    }
  }

  async getTermGoal(leanPath, line, character) {
    await this.ensureReady();
    const uri = pathToFileURL(leanPath).href;
    try {
      const result = await this.request("$/lean/plainTermGoal", {
        textDocument: { uri },
        position: { line, character },
      }, 10_000);
      return result;
    } catch {
      return null;
    }
  }

  async getHover(leanPath, line, character) {
    await this.ensureReady();
    const uri = pathToFileURL(leanPath).href;
    try {
      return await this.request("textDocument/hover", {
        textDocument: { uri },
        position: { line, character },
      }, 10_000);
    } catch {
      return null;
    }
  }

  diagnosticsFor(leanPath) {
    const uri = pathToFileURL(leanPath).href;
    return diagnosticsCache.get(uri) ?? [];
  }

  progressFor(leanPath) {
    const uri = pathToFileURL(leanPath).href;
    return progressCache.get(uri) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Idle reclaim
// ---------------------------------------------------------------------------

const IDLE_MS = Number(process.env.AARONNOTE_LEAN_IDLE_MS || 30_000);

function rescheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  if (openCount > 0) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (openCount > 0) return;
    log("lean-idle-shutdown");
    leanClient?.stop();
    leanClient = null;
  }, IDLE_MS);
}

// ---------------------------------------------------------------------------
// Public API  (called from handleLeanRequest)
// ---------------------------------------------------------------------------

function getClient() {
  if (!leanClient) leanClient = new LeanLspClient(notesRoot);
  return leanClient;
}

function hasLeanToolchain(root) {
  return existsSync(join(root, "lean-toolchain")) || existsSync(join(root, "lakefile.toml")) || existsSync(join(root, "lakefile.lean"));
}

export function setNotesRoot(root) {
  notesRoot = resolve(root);
}

export function registerLeanPushHandlers({ onDiagnostics, onProgress, onStatus } = {}) {
  pushDiagnostics = onDiagnostics ?? null;
  pushProgress = onProgress ?? null;
  pushStatus = onStatus ?? null;
}

export async function handleLeanRequest(action, body = {}) {
  // Initialize the notes root on first contact (desktop/main.mjs passes it via "init")
  if (action === "init") {
    const root = String(body.notesRoot || "");
    if (root) setNotesRoot(root);
    return { ok: true };
  }

  if (action === "status") {
    const client = leanClient;
    return {
      type: "lean-status",
      status: client?.status ?? { message: "Not started", kind: "Inactive", busy: false },
      running: Boolean(client?.running),
      notesRoot,
      hasToolchain: notesRoot ? hasLeanToolchain(notesRoot) : false,
    };
  }

  if (action === "log") {
    return { type: "lean-log", entries: leanLog.slice(-100) };
  }

  if (action === "stop") {
    leanClient?.stop();
    leanClient = null;
    return { ok: true };
  }

  if (!notesRoot) return { ok: false, message: "Notes root not set" };

  if (action === "open-note") {
    const { notePath, leanText, leanPath } = body;
    if (!notePath || !leanText || !leanPath) return { ok: false, message: "Missing params" };
    if (!hasLeanToolchain(notesRoot)) {
      return { ok: false, message: "No Lean toolchain found in notes root (add lean-toolchain + lakefile.toml)" };
    }
    await writeMirror(notePath, leanText, notesRoot);
    const client = getClient();
    await client.ensureReady();
    client.openDocument(leanPath, leanText);
    openCount++;
    rescheduleIdle();
    return { ok: true };
  }

  if (action === "change-note") {
    const { leanText, leanPath } = body;
    if (!leanText || !leanPath) return { ok: false, message: "Missing params" };
    const client = leanClient;
    if (!client?.running) return { ok: false, message: "Lean server not running" };
    client.changeDocument(leanPath, leanText);
    return { ok: true };
  }

  if (action === "close-note") {
    const { notePath, leanPath } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (client?.running) client.closeDocument(leanPath);
    openCount = Math.max(0, openCount - 1);
    rescheduleIdle();
    return { ok: true };
  }

  if (action === "save-note") {
    const { notePath, leanText } = body;
    if (!notePath || !leanText) return { ok: false, message: "Missing params" };
    await writeMirror(notePath, leanText, notesRoot);
    return { ok: true };
  }

  if (action === "delete-note") {
    const { notePath } = body;
    if (!notePath) return { ok: false, message: "Missing notePath" };
    await deleteMirror(notePath, notesRoot);
    return { ok: true };
  }

  if (action === "rename-note") {
    const { oldNotePath, newNotePath } = body;
    if (!oldNotePath || !newNotePath) return { ok: false, message: "Missing params" };
    await renameMirror(oldNotePath, newNotePath, notesRoot);
    return { ok: true };
  }

  if (action === "get-goals") {
    const { leanPath, line, character } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (!client?.running) return { ok: false, goals: null };
    const result = await client.getGoals(leanPath, Number(line ?? 0), Number(character ?? 0));
    return { ok: true, result };
  }

  if (action === "get-term-goal") {
    const { leanPath, line, character } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (!client?.running) return { ok: false, result: null };
    const result = await client.getTermGoal(leanPath, Number(line ?? 0), Number(character ?? 0));
    return { ok: true, result };
  }

  if (action === "get-hover") {
    const { leanPath, line, character } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (!client?.running) return { ok: false, result: null };
    const result = await client.getHover(leanPath, Number(line ?? 0), Number(character ?? 0));
    return { ok: true, result };
  }

  if (action === "get-diagnostics") {
    const { leanPath } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (!client) return { ok: true, diagnostics: [] };
    return { ok: true, diagnostics: client.diagnosticsFor(leanPath) };
  }

  return { ok: false, message: `Unknown Lean action: ${action}` };
}
