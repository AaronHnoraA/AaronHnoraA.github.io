/**
 * Lean 4 LSP client for Aaronnote.
 *
 * Spawns `lake serve` (or `lean --server` as fallback) in the notes root,
 * manages virtual Lean documents keyed by note path, and surfaces
 * diagnostics / goal state back to the renderer via push notifications.
 */
import { existsSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { LspClient } from "./lsp-base.mjs";
import { writeMirror, deleteMirror, renameMirror } from "./lean-mirror.mjs";
import {
  ensureLeanRegion,
  normalizeLeanTag,
  readLeanRegion,
  updateLeanRegion,
} from "./lean-region.mjs";

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
let pushLog = null;
let pushSemanticTokens = null;
let leanLog = [];
let cacheTask = null;
let cacheStatus = { state: "idle", message: "Mathlib cache idle", startedAt: 0, finishedAt: 0, code: null, projectDir: "" };

function log(type, data = {}) {
  const entry = { type, ...data, ts: Date.now() };
  leanLog.push(entry);
  if (leanLog.length > 300) leanLog = leanLog.slice(-300);
  pushLog?.(entry);
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

function runCommand(command, args, { cwd, env, timeoutMs = 0, logType = "lean-command" } = {}) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(command, args, {
      cwd: cwd ?? process.cwd(),
      env: env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        log(`${logType}-timeout`, { command, args, cwd, timeoutMs });
        try { proc.kill("SIGTERM"); } catch {}
      }, timeoutMs);
    }
    proc.stdout.on("data", (chunk) => {
      const text = String(chunk || "");
      stdout += text;
      const line = text.trim();
      if (line) log(`${logType}-stdout`, { message: line.slice(0, 500) });
    });
    proc.stderr.on("data", (chunk) => {
      const text = String(chunk || "");
      stderr += text;
      const line = text.trim();
      if (line) log(`${logType}-stderr`, { message: line.slice(0, 500) });
    });
    proc.once("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    proc.once("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolvePromise({ code, signal, stdout, stderr });
      } else {
        const err = new Error(`${command} ${args.join(" ")} failed (${signal ?? code ?? "unknown"})`);
        err.code = code;
        err.signal = signal;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Incremental diff helper (line-granularity)
// ---------------------------------------------------------------------------

function computeLineDiff(oldText, newText) {
  if (oldText === newText) return null;
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  let prefixLines = 0;
  while (prefixLines < oldLines.length && prefixLines < newLines.length &&
         oldLines[prefixLines] === newLines[prefixLines]) {
    prefixLines++;
  }

  let oldSuffix = oldLines.length;
  let newSuffix = newLines.length;
  while (oldSuffix > prefixLines && newSuffix > prefixLines &&
         oldLines[oldSuffix - 1] === newLines[newSuffix - 1]) {
    oldSuffix--;
    newSuffix--;
  }

  const endLine = oldSuffix < oldLines.length ? oldSuffix : oldLines.length - 1;
  const endChar = oldSuffix < oldLines.length ? 0 : (oldLines[oldLines.length - 1] ?? "").length;
  const newChunk = newLines.slice(prefixLines, newSuffix).join("\n");
  const text = oldSuffix < oldLines.length ? newChunk + "\n" : newChunk;

  return {
    range: { start: { line: prefixLines, character: 0 }, end: { line: endLine, character: endChar } },
    text,
  };
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
    this.initialized = false;
    this.semanticTokensLegend = null;
    this.semanticTokenTimers = new Map();
    this.documents = new Map(); // leanPath → { version, content }
  }

  setStatus(message, kind = "Normal", busy = false) {
    this.status = { message, kind, busy };
    pushStatus?.({ ...this.status });
    log("lean-status", { message, kind, busy });
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
      const diagnostics = params?.diagnostics ?? [];
      diagnosticsCache.set(uri, diagnostics);
      log("lean-diagnostics", { uri, count: diagnostics.length });
      pushDiagnostics?.({ uri, diagnostics });
      this.scheduleSemanticTokensForUri(uri, 250);
      return;
    }
    if (method === "$/lean/fileProgress") {
      const uri = params?.textDocument?.uri ?? "";
      progressCache.set(uri, params?.processing ?? []);
      pushProgress?.({ uri, processing: params?.processing ?? [] });
      this.scheduleSemanticTokensForUri(uri, 250);
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
    const p = this._start();
    this.ready = p;
    p.catch(() => {
      if (this.ready === p) this.ready = null;
    });
    return p;
  }

  async _start() {
    this.setStatus("Starting...", "Normal", true);
    log("lean-start", { root: this.root });

    this.setStatus("Finding Lean toolchain...", "Busy", true);
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

    const cwd = leanProjectDir(this.root);
    if (lake) {
      this.setStatus("Checking Lake packages...", "Busy", true);
      const repaired = await repairCorruptLakePackages(cwd);
      if (repaired > 0) {
        this.setStatus(`Repaired ${repaired} Lake package cache${repaired === 1 ? "" : "s"}...`, "Busy", true);
      }
    }
    this.setStatus(lake ? "Starting lake serve..." : "Starting lean --server...", "Busy", true);
    log("lean-spawn", { command, args, cwd });
    this.spawnProcess(command, args, {
      cwd,
      env: { ...process.env, PATH: leanEnvPath() },
    });

    this.setStatus("Waiting for Lean initialize...", "Busy", true);
    await this._initialize();
    this.setStatus("Ready", "Normal", false);
    log("lean-ready");
  }

  async _initialize() {
    const rootUri = pathToFileURL(leanProjectDir(this.root)).href;
    // Use a long timeout: first-run `lake serve` downloads all packages before responding.
    const result = await this.request("initialize", {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: "AaronNotes" }],
      capabilities: {
        workspace: { workspaceFolders: true, configuration: true },
        window: { showDocument: { support: false } },
        textDocument: {
          synchronization: { dynamicRegistration: false, didSave: false },
          publishDiagnostics: { relatedInformation: true },
          semanticTokens: {
            dynamicRegistration: false,
            requests: { full: true, range: false },
            tokenTypes: [
              "namespace", "type", "class", "enum", "interface", "struct", "typeParameter",
              "parameter", "variable", "property", "enumMember", "event", "function", "method",
              "macro", "keyword", "modifier", "comment", "string", "number", "regexp", "operator",
              "decorator",
            ],
            tokenModifiers: [
              "declaration", "definition", "readonly", "static", "deprecated", "abstract",
              "async", "modification", "documentation", "defaultLibrary",
            ],
            formats: ["relative"],
            overlappingTokenSupport: false,
            multilineTokenSupport: true,
          },
        },
      },
      initializationOptions: {
        editDelay: 0,
      },
    }, 0);  // no timeout — first-run lake serve can take minutes downloading packages
    this.semanticTokensLegend = result?.capabilities?.semanticTokensProvider?.legend ?? null;
    log("lean-semantic-tokens", {
      available: Boolean(this.semanticTokensLegend),
      tokenTypes: this.semanticTokensLegend?.tokenTypes?.length ?? 0,
    });
    this.notify("initialized", {});
    this.initialized = true;
  }

  // ---------------------------------------------------------------------------
  // Document management
  // ---------------------------------------------------------------------------

  openDocument(leanPath, leanText) {
    if (!this.initialized) return false;
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
      return false;
    }
    const version = 1;
    this.documents.set(uri, { version, content: leanText });
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "lean4", version, text: leanText },
    });
    this.scheduleSemanticTokens(leanPath);
    return true;
  }

  changeDocument(leanPath, leanText) {
    if (!this.initialized) return;
    const uri = pathToFileURL(leanPath).href;
    const existing = this.documents.get(uri);
    if (!existing) {
      this.openDocument(leanPath, leanText);
      return;
    }
    if (existing.content === leanText) return;
    const version = existing.version + 1;
    const diff = computeLineDiff(existing.content, leanText);
    this.documents.set(uri, { version, content: leanText });
    this.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: diff ? [diff] : [{ text: leanText }],
    });
    this.scheduleSemanticTokens(leanPath);
  }

  closeDocument(leanPath) {
    const uri = pathToFileURL(leanPath).href;
    if (!this.documents.has(uri)) return false;
    this.documents.delete(uri);
    diagnosticsCache.delete(uri);
    progressCache.delete(uri);
    this.notify("textDocument/didClose", { textDocument: { uri } });
    return true;
  }

  scheduleSemanticTokens(leanPath, delay = 150) {
    this.scheduleSemanticTokensForUri(pathToFileURL(leanPath).href, delay);
  }

  scheduleSemanticTokensForUri(uri, delay = 150) {
    if (!this.semanticTokensLegend) return;
    if (!this.documents.has(uri)) return;
    const existing = this.semanticTokenTimers.get(uri);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.semanticTokenTimers.delete(uri);
      void this.refreshSemanticTokensForUri(uri);
    }, delay);
    this.semanticTokenTimers.set(uri, timer);
  }

  async refreshSemanticTokens(leanPath) {
    return this.refreshSemanticTokensForUri(pathToFileURL(leanPath).href);
  }

  async refreshSemanticTokensForUri(uri) {
    if (!this.semanticTokensLegend) return;
    if (!this.documents.has(uri)) return;
    try {
      const tokens = await this.request("textDocument/semanticTokens/full", {
        textDocument: { uri },
      }, 10_000);
      pushSemanticTokens?.({
        uri,
        legend: this.semanticTokensLegend,
        data: Array.isArray(tokens?.data) ? tokens.data : [],
      });
      log("lean-semantic-tokens-result", { uri, count: Array.isArray(tokens?.data) ? tokens.data.length / 5 : 0 });
    } catch (err) {
      log("lean-semantic-tokens-error", { message: String(err?.message || err) });
    }
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

  async getCompletions(leanPath, line, character) {
    await this.ensureReady();
    const uri = pathToFileURL(leanPath).href;
    try {
      return await this.request("textDocument/completion", {
        textDocument: { uri },
        position: { line, character },
        context: { triggerKind: 1 },
      }, 10_000);
    } catch {
      return null;
    }
  }

  async getDefinition(leanPath, line, character) {
    await this.ensureReady();
    const uri = pathToFileURL(leanPath).href;
    try {
      return await this.request("textDocument/definition", {
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

const IDLE_MS = Number(process.env.AARONNOTE_LEAN_IDLE_MS || 0);

function rescheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (openCount > 0) return;
  if (!Number.isFinite(IDLE_MS) || IDLE_MS <= 0) return;
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

/** Returns the Lake project root: notesRoot/.lean/ */
function leanProjectDir(root) {
  return join(root, ".lean");
}

async function readTextIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return "";
    throw err;
  }
}

const LEAN_PROJECT_TARGETS = new Map([
  ["info", 30_000],
  ["version", 30_000],
  ["update", 20 * 60_000],
  ["cache", 30 * 60_000],
  ["cache-force", 30 * 60_000],
  ["build", 60 * 60_000],
  ["clean", 10 * 60_000],
]);

async function runLeanProjectTarget(root, target) {
  const cleanTarget = String(target || "").trim();
  const timeoutMs = LEAN_PROJECT_TARGETS.get(cleanTarget);
  if (!timeoutMs) return { ok: false, message: `Unknown Lean target: ${cleanTarget}` };
  const make = findExecutable(["make"]);
  if (!make) return { ok: false, message: "make unavailable" };
  if (cacheTask) return cacheTask;

  const startedAt = Date.now();
  cacheStatus = { state: "running", message: `Running make ${cleanTarget}`, startedAt, finishedAt: 0, code: null, projectDir: leanProjectDir(root) };
  pushStatus?.({ message: cacheStatus.message, kind: "Busy", busy: true, cache: { ...cacheStatus } });
  log("lean-project-command-start", { command: make, target: cleanTarget, cwd: root });

  cacheTask = runCommand(make, [cleanTarget], {
    cwd: root,
    env: { ...process.env, PATH: leanEnvPath() },
    timeoutMs,
    logType: "lean-project-command",
  })
    .then((result) => {
      cacheStatus = { state: "ready", message: `make ${cleanTarget} finished`, startedAt, finishedAt: Date.now(), code: result.code, projectDir: leanProjectDir(root) };
      log("lean-project-command-done", { target: cleanTarget, code: result.code });
      return { ok: true, target: cleanTarget, message: cacheStatus.message, output: [result.stdout, result.stderr].filter(Boolean).join("\n") };
    })
    .catch((err) => {
      const message = String(err?.message || err);
      cacheStatus = { state: "error", message, startedAt, finishedAt: Date.now(), code: err?.code ?? null, projectDir: leanProjectDir(root) };
      log("lean-project-command-error", { target: cleanTarget, message, code: err?.code, signal: err?.signal });
      return { ok: false, target: cleanTarget, message, output: [err?.stdout, err?.stderr].filter(Boolean).join("\n") };
    })
    .finally(() => {
      cacheTask = null;
      pushStatus?.({ message: cacheStatus.message, kind: cacheStatus.state === "error" ? "Error" : "Normal", busy: false, cache: { ...cacheStatus } });
    });
  return cacheTask;
}

async function leanProjectInfo(root) {
  const projectRoot = leanProjectDir(root);
  const toolchain = (await readTextIfExists(join(projectRoot, "lean-toolchain"))).trim();
  const lakefileToml = await readTextIfExists(join(projectRoot, "lakefile.toml"));
  const lakefileLean = await readTextIfExists(join(projectRoot, "lakefile.lean"));
  const manifestText = await readTextIfExists(join(projectRoot, "lake-manifest.json"));
  let packages = [];
  try {
    const manifest = JSON.parse(manifestText || "{}");
    packages = Array.isArray(manifest.packages)
      ? manifest.packages.map((pkg) => ({
        name: String(pkg?.name ?? ""),
        inputRev: String(pkg?.inputRev ?? ""),
        rev: String(pkg?.rev ?? "").slice(0, 12),
      })).filter((pkg) => pkg.name)
      : [];
  } catch {}

  const lean = findExecutable(["lean"]);
  const lake = findExecutable(["lake"]);
  const version = async (command) => {
    if (!command) return "";
    try {
      const result = await runCommand(command, ["--version"], {
        cwd: projectRoot,
        env: { ...process.env, PATH: leanEnvPath() },
        timeoutMs: 10_000,
        logType: "lean-version",
      });
      return String(result.stdout || result.stderr).trim();
    } catch (err) {
      return String(err?.message || err);
    }
  };

  return {
    ok: true,
    notesRoot: root,
    projectRoot,
    toolchain,
    lakefile: lakefileToml ? "lakefile.toml" : lakefileLean ? "lakefile.lean" : "",
    hasMakefile: existsSync(join(root, "Makefile")),
    leanVersion: await version(lean),
    lakeVersion: await version(lake),
    packages,
    cache: { ...cacheStatus },
  };
}

async function repairCorruptLakePackages(projectDir) {
  const packagesDir = join(projectDir, ".lake", "packages");
  let entries = [];
  try {
    entries = await readdir(packagesDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let repaired = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(packagesDir, entry.name);
    let names = [];
    try {
      names = await readdir(pkgPath);
    } catch {
      continue;
    }
    const payload = names.filter((name) => name !== ".git" && name !== ".DS_Store");
    if (!names.includes(".git") || payload.length > 0) continue;
    log("lean-lake-repair", { package: entry.name, path: pkgPath, reason: "empty git worktree" });
    await rm(pkgPath, { recursive: true, force: true });
    repaired++;
  }
  if (repaired > 0) log("lean-lake-repair-done", { count: repaired });
  return repaired;
}

function hasLeanToolchain(root) {
  const proj = leanProjectDir(root);
  return existsSync(join(proj, "lean-toolchain")) ||
    existsSync(join(proj, "lakefile.toml")) ||
    existsSync(join(proj, "lakefile.lean")) ||
    existsSync(join(root, "lean-toolchain")) ||  // legacy: toolchain at notes root
    existsSync(join(root, "lakefile.toml"));
}

/**
 * If `filePath` is inside `notesRoot` but outside `notesRoot/.lean/`,
 * moves it into `.lean/` (preserving relative path) and creates a relative
 * symlink back at the original location.  Returns the new canonical path.
 */
async function migrateLeanFileIfNeeded(filePath, notesRoot) {
  const absFile = resolve(filePath);
  const absNotes = resolve(notesRoot);
  const absLean = resolve(leanProjectDir(notesRoot));

  // Not inside notesRoot, or already inside .lean/ — nothing to do
  if (!absFile.startsWith(absNotes + sep)) return absFile;
  if (absFile.startsWith(absLean + sep)) return absFile;

  const rel = relative(absNotes, absFile);
  const targetPath = join(absLean, rel);

  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await rename(absFile, targetPath);
    const symlinkTarget = relative(dirname(absFile), targetPath);
    await symlink(symlinkTarget, absFile);
    log("lean-migrate", { from: absFile, to: targetPath });
  } catch (err) {
    log("lean-migrate-error", { message: String(err?.message || err) });
    return absFile;
  }
  return targetPath;
}

// ---------------------------------------------------------------------------
// Region ordering helpers
// ---------------------------------------------------------------------------

const MARKDOWN_LEAN_TAG_RE = /^[ \t]*@@lean4[ \t]+\[([^\]\n]+)\]/gm;

function scanMarkdownLeanTagOrder(mdText) {
  const tags = [];
  let match;
  MARKDOWN_LEAN_TAG_RE.lastIndex = 0;
  while ((match = MARKDOWN_LEAN_TAG_RE.exec(mdText)) !== null) {
    const normalized = normalizeLeanTag(match[1] ?? "");
    if (normalized) tags.push(normalized);
  }
  return tags;
}

async function getRegionNeighbors(notePath, tag) {
  let mdText = "";
  try {
    mdText = await readFile(notePath, "utf8");
  } catch {
    return {};
  }
  const cleanTag = normalizeLeanTag(tag);
  const tags = scanMarkdownLeanTagOrder(mdText);
  const idx = tags.indexOf(cleanTag);
  if (idx < 0) return {};
  // afterTag = the tag that should come after the new region in the lean file
  // (insert before this tag's position so the order matches the note)
  const afterTag = tags[idx + 1] ?? "";
  // beforeTag = the tag that should come before the new region (fallback)
  const beforeTag = idx > 0 ? (tags[idx - 1] ?? "") : "";
  return { afterTag, beforeTag };
}

export function setNotesRoot(root) {
  notesRoot = resolve(root);
}

export function registerLeanPushHandlers({ onDiagnostics, onProgress, onStatus, onLog, onSemanticTokens } = {}) {
  pushDiagnostics = onDiagnostics ?? null;
  pushProgress = onProgress ?? null;
  pushStatus = onStatus ?? null;
  pushLog = onLog ?? null;
  pushSemanticTokens = onSemanticTokens ?? null;
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
      projectRoot: notesRoot ? leanProjectDir(notesRoot) : "",
      hasToolchain: notesRoot ? hasLeanToolchain(notesRoot) : false,
      cache: { ...cacheStatus },
    };
  }

  if (action === "log") {
    return { type: "lean-log", entries: leanLog.slice(-100) };
  }

  if (action === "stop") {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    openCount = 0;
    log("lean-stop");
    leanClient?.stop();
    leanClient = null;
    return { ok: true };
  }

  if (!notesRoot) return { ok: false, message: "Notes root not set" };

  if (action === "cache-status") {
    return { ok: true, cache: { ...cacheStatus }, projectRoot: leanProjectDir(notesRoot) };
  }

  if (action === "cache-get") {
    const result = await runLeanProjectTarget(notesRoot, body?.force === true ? "cache-force" : "cache");
    return { ...result, cache: { ...cacheStatus }, projectRoot: leanProjectDir(notesRoot) };
  }

  if (action === "project-info") {
    return leanProjectInfo(notesRoot);
  }

  if (action === "project-command") {
    const result = await runLeanProjectTarget(notesRoot, body?.target);
    return { ...result, cache: { ...cacheStatus }, projectRoot: leanProjectDir(notesRoot) };
  }

  if (action === "open-note") {
    const { notePath, leanText } = body;
    let { leanPath } = body;
    if (!notePath || typeof leanText !== "string" || !leanPath) return { ok: false, message: "Missing params" };
    log("lean-open-note", { notePath, leanPath, bytes: leanText.length });
    if (!hasLeanToolchain(notesRoot)) {
      log("lean-open-error", { message: "No Lean toolchain found", notesRoot });
      return { ok: false, message: "No Lean toolchain found in .lean/ (add lean-toolchain + lakefile.toml)" };
    }
    try {
      const isStandaloneLean = notePath.toLowerCase().endsWith(".lean");
      if (isStandaloneLean) {
        // Migrate stray .lean files into .lean/ and resolve to canonical path
        leanPath = await migrateLeanFileIfNeeded(leanPath, notesRoot);
        try { leanPath = realpathSync(leanPath); } catch {}
      } else {
        await writeMirror(notePath, leanText, notesRoot);
      }
      const client = getClient();
      await client.ensureReady();
      client.setStatus("Opening Lean document...", "Busy", true);
      if (client.openDocument(leanPath, leanText)) openCount++;
      client.setStatus("Ready", "Normal", false);
      rescheduleIdle();
      return { ok: true, leanPath };
    } catch (err) {
      const message = String(err?.message || err);
      log("lean-open-error", { notePath, leanPath, message });
      leanClient?.setStatus(message, "Error", false);
      throw err;
    }
  }

  if (action === "ensure-region") {
    const { notePath, tag } = body;
    if (!notePath || !tag) return { ok: false, message: "Missing params" };
    const neighbors = await getRegionNeighbors(String(notePath), String(tag));
    const result = await ensureLeanRegion({ notePath: String(notePath), notesRoot, tag: String(tag), ...neighbors });
    return { ok: true, ...result };
  }

  if (action === "read-region") {
    const { notePath, tag } = body;
    if (!notePath || !tag) return { ok: false, message: "Missing params" };
    const neighbors = await getRegionNeighbors(String(notePath), String(tag));
    const result = await readLeanRegion({ notePath: String(notePath), notesRoot, tag: String(tag), ...neighbors });
    return { ok: true, ...result };
  }

  if (action === "open-region-file") {
    const { notePath, tag } = body;
    if (!notePath || !tag) return { ok: false, message: "Missing params" };
    const neighbors = await getRegionNeighbors(String(notePath), String(tag));
    const result = await ensureLeanRegion({ notePath: String(notePath), notesRoot, tag: String(tag), ...neighbors });
    if (!hasLeanToolchain(notesRoot)) {
      return { ok: false, message: "No Lean toolchain found in .lean/ (add lean-toolchain + lakefile.toml)", ...result };
    }
    const client = getClient();
    await client.ensureReady();
    if (client.openDocument(result.leanPath, result.text)) openCount++;
    rescheduleIdle();
    return { ok: true, ...result };
  }

  if (action === "update-region") {
    const { notePath, tag, body: regionBody } = body;
    if (!notePath || !tag || typeof regionBody !== "string") return { ok: false, message: "Missing params" };
    const result = await updateLeanRegion({
      notePath: String(notePath),
      notesRoot,
      tag: String(tag),
      body: regionBody,
    });
    const client = leanClient;
    if (client?.running) {
      client.changeDocument(result.leanPath, result.text);
    }
    return { ok: true, ...result };
  }

  if (action === "get-region-meta") {
    const { notePath, tag } = body;
    if (!notePath || !tag) return { ok: false, message: "Missing params" };
    const result = await ensureLeanRegion({ notePath: String(notePath), notesRoot, tag: String(tag) });
    return {
      ok: true,
      leanPath: result.leanPath,
      tag: result.tag,
      region: result.region,
    };
  }

  if (action === "change-note") {
    const { notePath, leanText, leanPath } = body;
    if (typeof leanText !== "string" || !leanPath) return { ok: false, message: "Missing params" };
    const client = leanClient;
    if (!client?.running) {
      log("lean-change-error", { leanPath, message: "Lean server not running" });
      return { ok: false, message: "Lean server not running" };
    }
    client.changeDocument(leanPath, leanText);
    if (notePath && !String(notePath).toLowerCase().endsWith(".lean")) {
      try {
        await writeMirror(String(notePath), leanText, notesRoot);
      } catch (err) {
        const message = String(err?.message || err);
        log("lean-mirror-write-error", { notePath, leanPath, message });
        return { ok: false, message };
      }
    }
    return { ok: true };
  }

  if (action === "close-note") {
    const { notePath, leanPath } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (client?.running && client.closeDocument(leanPath)) {
      openCount = Math.max(0, openCount - 1);
    }
    rescheduleIdle();
    return { ok: true };
  }

  if (action === "save-note") {
    const { notePath, leanText } = body;
    if (!notePath || typeof leanText !== "string") return { ok: false, message: "Missing params" };
    if (!notePath.toLowerCase().endsWith(".lean")) {
      await writeMirror(notePath, leanText, notesRoot);
    }
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

  if (action === "get-completions") {
    const { leanPath, line, character } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (!client?.running) return { ok: false, result: null };
    const result = await client.getCompletions(leanPath, Number(line ?? 0), Number(character ?? 0));
    return { ok: true, result };
  }

  if (action === "get-definition") {
    const { leanPath, line, character } = body;
    if (!leanPath) return { ok: false, message: "Missing leanPath" };
    const client = leanClient;
    if (!client?.running) return { ok: false, result: null };
    const result = await client.getDefinition(leanPath, Number(line ?? 0), Number(character ?? 0));
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
