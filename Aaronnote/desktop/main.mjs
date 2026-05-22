import { app, BrowserWindow, Menu, Notification, dialog, ipcMain, shell, protocol, net, globalShortcut, powerMonitor } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { promisify } from "node:util";

import { saveNote } from "../server/lib/save.mjs";
import { commitRoam } from "../server/lib/roam-git.mjs";
import {
  bootstrapNote,
  readNote,
  notesIndexPayload,
  scanNotes,
  graphPayload,
  tagIndexPayload,
  pathSuggestionsForFile,
  syncRoamDb,
  queueRoamDbSync,
  runtimeDebugSnapshot,
  maybeScheduleWeeklyFullSync,
  fileHistory,
  restoreFileFromCommit,
  discardFileChanges,
  roamRepoStatus,
  roamRepoChanges,
  diffRoamFile,
  diffRoamCommit,
  pullRoam,
  pushRoam,
  repoHistory,
  roamNoteRoot,
  renameRoamTag,
  deleteRoamTag,
  roamTagOverlapReport,
  rewriteMarkdownPathReferences,
  getTodos,
  scanSnippets,
  scanTemplates,
} from "../server/lib/index.mjs";
import { configure, markNotesDirty } from "../server/lib/state.mjs";
import { storeAsset, storeAssetFromPath, scanUnusedAssets, trashUnusedAssets } from "../server/lib/assets.mjs";
import {
  createNode,
  createFolder,
  deleteNote,
  renameManagedPath,
  moveManagedPath,
  duplicateManagedFile,
  trashManagedPath,
} from "../server/lib/fs-ops.mjs";
import { updateCurrentNoteMeta } from "../server/lib/meta.mjs";
import { readRecentNotes, touchRecentNote, readCursorPositions, touchCursorPosition } from "../server/lib/session.mjs";
import { scanPlugins, readPluginOverrides, writePluginOverrides } from "../server/lib/plugins.mjs";
import { handleCopilotRequest } from "../server/lib/copilot.mjs";
import { handleRoamLookupRequest } from "../server/lib/roamlookup.mjs";
import { resolveMediaFile, fileContentType } from "../server/lib/media.mjs";

const desktopDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(desktopDir, "..");
const noteRoot = process.env.AARONNOTE_ROOT || join(homedir(), "HC", "Org", "roam");
const workspaceRoot = process.env.AARONNOTE_WORKSPACE_ROOT
  ? resolve(process.env.AARONNOTE_WORKSPACE_ROOT)
  : resolve(noteRoot, "..");
const publishScript = join(workspaceRoot, "bin", "publish-site");
const pdfPublishRoot = join(workspaceRoot, "public", ".export");
const execFileAsync = promisify(execFile);
const pluginRoot = process.env.AARONNOTE_PLUGIN_ROOT
  ? resolve(process.env.AARONNOTE_PLUGIN_ROOT)
  : join(workspaceRoot, "plugin");
const isPackaged = app.isPackaged;
const staticDir = isPackaged
  ? join(app.getAppPath(), "dist", "aaronnote")
  : join(projectDir, "dist", "aaronnote");
const devViteUrl = process.env.AARONNOTE_DEV_VITE_URL || "";
const publishJsDir = isPackaged
  ? join(process.resourcesPath, "js")
  : resolve(projectDir, "..", "js");
const liuGongQuanFontCandidates = [
  process.env.AARONNOTE_LIUGONGQUAN_FONT,
  join(homedir(), "Library", "Fonts", "方正柳公权楷书 简繁.TTF"),
  join(homedir(), "Library", "Fonts", "FZLiuGongQuanKaiShuJF.ttf"),
].filter(Boolean);

let mainWindow = null;
let debugPanel = null;
let pendingOpenFile = process.argv.slice(1).find((arg) => /\.(?:md|markdown)$/i.test(arg)) || "";
let allowQuit = false;

protocol.registerSchemesAsPrivileged([{
  scheme: "aaronnote-asset",
  privileges: {
    secure: true,
    standard: true,
    supportFetchAPI: true,
    stream: true,
    bypassCSP: true,
  },
}]);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.exit(0);

function shouldOwnShortcut(input) {
  if (input.alt || input.control) return false;
  if (!input.meta) return false;
  return ["j", "l", "r", "w"].includes(input.key.toLowerCase());
}

function historyShortcutCommand(input) {
  if (input.alt) return "";
  const key = String(input.key || "").toLowerCase();
  if (process.platform === "darwin" && input.control && !input.meta && key === "z") return "redo";
  const primary = (input.meta && !input.control) || (input.control && !input.meta);
  if (!primary) return "";
  if (key === "z" && input.shift) return "redo";
  if (key === "z" && !input.shift) return "undo";
  if (key === "y" && !input.shift) return "redo";
  return "";
}

const ZOOM_STEP = 0.5;
const DEFAULT_ZOOM_LEVEL = 2;
const ZOOM_MIN = -3;
const ZOOM_MAX = 3;
let desiredZoomLevel = DEFAULT_ZOOM_LEVEL;

function clampZoomLevel(level) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(level) || 0));
}

function appWindows() {
  return BrowserWindow.getAllWindows().filter((win) => win.aaronnoteAppWindow && !win.isDestroyed());
}

function applyZoom(win) {
  if (!win || win.isDestroyed()) return;
  if (win.webContents.isDestroyed()) return;
  win.webContents.setZoomLevel(desiredZoomLevel);
}

function scheduleApplyZoom(win) {
  applyZoom(win);
  setTimeout(() => applyZoom(win), 0);
  setTimeout(() => applyZoom(win), 80);
}

function applyZoomToAllWindows() {
  for (const win of appWindows()) scheduleApplyZoom(win);
}

function setDesiredZoomLevel(level) {
  desiredZoomLevel = clampZoomLevel(level);
  applyZoomToAllWindows();
}

function stepDesiredZoomLevel(delta) {
  setDesiredZoomLevel(desiredZoomLevel + delta);
}

function handleZoomShortcut(win, input) {
  if (!input.meta || input.alt || input.control) return false;
  if (input.type !== "keyDown") return false;
  const key = input.key;
  const isPlus = key === "=" || key === "+";
  const isMinus = key === "-" || key === "_";
  const isZero = key === "0";
  if (!isPlus && !isMinus && !isZero) return false;
  if (isZero) {
    setDesiredZoomLevel(DEFAULT_ZOOM_LEVEL);
  } else {
    stepDesiredZoomLevel(isPlus ? ZOOM_STEP : -ZOOM_STEP);
  }
  return true;
}

function handleFullscreenShortcut(win, input) {
  if (input.type !== "keyDown") return false;
  if (input.alt || input.control || input.meta || input.shift) return false;
  if (input.key !== "F11") return false;
  win.setFullScreen(!win.isFullScreen());
  return true;
}

function inside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function internalRendererUrl(targetUrl) {
  if (targetUrl.startsWith("aaronnote-asset:")) return true;
  if (rendererAppUrl(targetUrl)) return true;
  return false;
}

function rendererAppUrl(targetUrl) {
  if (devViteUrl && targetUrl.startsWith(devViteUrl)) return true;
  try {
    const url = new URL(targetUrl);
    if (url.protocol !== "file:") return false;
    return inside(fileURLToPath(url), resolve(staticDir));
  } catch {
    return false;
  }
}

function targetAppWindow() {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.aaronnoteAppWindow && !win.isDestroyed()) return win;
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  return null;
}

function errorPayload(err) {
  return {
    type: "error",
    ok: false,
    message: err instanceof Error ? err.message : String(err),
  };
}

function registerApiHandler(channel, handler) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      if (!debugPanel) return await handler(...args);
      return await debugPanel.trackTask(channel, () => handler(...args));
    } catch (err) {
      return errorPayload(err);
    }
  });
}

async function openDebugPanel() {
  if (!debugPanel) {
    const { createDebugPanel } = await import("./debug-panel.mjs");
    debugPanel = createDebugPanel({
      app,
      BrowserWindow,
      desktopDir,
      ipcMain,
      powerMonitor,
      runtimeSnapshot: runtimeDebugSnapshot,
      appWindows,
      onClose: () => {
        debugPanel = null;
      },
    });
  }
  debugPanel.show();
}

ipcMain.on("aaronnote:renderer-ready", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  win.aaronnoteRendererReady = true;
  applyZoom(win);
  flushPendingOpenFile(win);
});

function showTaskNotification(title, body) {
  try {
    if (!Notification.isSupported()) return;
    new Notification({ title, body }).show();
  } catch {}
}

async function notesListPayload(force = false) {
  if (force) markNotesDirty();
  return { type: "notes", ...await notesIndexPayload(), root: noteRoot };
}

async function roamSyncPayload(reload = false) {
  if (reload) markNotesDirty();
  const notes = await syncRoamDb();
  const index = await notesIndexPayload(notes);
  return { type: "notes", ...index, root: noteRoot, db: join(noteRoot, "roam.db") };
}

async function roamSyncFullPayload() {
  markNotesDirty();
  const notes = await syncRoamDb(null, { mode: "full" });
  const index = await notesIndexPayload(notes);
  return { type: "notes", ...index, root: noteRoot, db: join(noteRoot, "roam.db") };
}

async function templatesPayload(force = false) {
  return { type: "templates", templates: await scanTemplates({ force }) };
}

async function snippetsPayload(force = false) {
  return { type: "snippets", snippets: await scanSnippets({ force }) };
}

async function pluginsPayload(force = false) {
  return { type: "plugins", plugins: await scanPlugins({ force }), root: pluginRoot };
}

async function fileProtocolResponse(file) {
  const response = await net.fetch(pathToFileURL(file).toString());
  const headers = new Headers(response.headers);
  if (!headers.has("content-type")) headers.set("content-type", fileContentType(file));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFoundResponse(message = "Not found", status = 404) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function resolveAssetProtocolFile(requestUrl) {
  const url = new URL(requestUrl);
  const host = url.hostname;
  if (host === "media") {
    return resolveMediaFile(url.searchParams.get("file"), url.searchParams.get("base"));
  }
  if (host === "font") {
    const requested = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (requested && requested !== "FZLiuGongQuanKaiShuJF.ttf") throw new Error(`Unknown font: ${requested}`);
    const fontFile = liuGongQuanFontCandidates
      .map((file) => resolve(String(file)))
      .find((file) => existsSync(file));
    if (!fontFile) throw new Error("FZLiuGongQuanKaiShuJF font not found");
    return fontFile;
  }
  if (host === "kinds") {
    const root = resolve(workspaceRoot, "kinds");
    const requested = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const file = resolve(root, requested);
    if (!inside(file, root)) throw new Error(`Kind asset is outside kinds root: ${file}`);
    return file;
  }
  if (host === "roam-tools") {
    const name = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (name !== "knowledge.js" && name !== "graph.js") throw new Error(`Unknown roam tool: ${name}`);
    return resolve(publishJsDir, name);
  }
  throw new Error(`Unknown Aaronnote asset host: ${host}`);
}

function registerAssetProtocol() {
  protocol.handle("aaronnote-asset", async (request) => {
    try {
      const file = resolveAssetProtocolFile(request.url);
      return await fileProtocolResponse(file);
    } catch (err) {
      console.error("aaronnote-asset failed", request.url, err);
      return notFoundResponse(err instanceof Error ? err.message : String(err));
    }
  });
}

function registerApiIpc() {
  registerApiHandler("aaronnote:api:notes:bootstrap", (file) => bootstrapNote(file || undefined));
  registerApiHandler("aaronnote:api:notes:open", (file) => readNote(file));
  registerApiHandler("aaronnote:api:notes:list", (force) => notesListPayload(force === true));
  registerApiHandler("aaronnote:api:notes:save", (body) => saveNote(body || {}));
  registerApiHandler("aaronnote:api:notes:create-node", (draft) => createNode(draft || {}));
  registerApiHandler("aaronnote:api:notes:delete", (file) => deleteNote({ file }));
  registerApiHandler("aaronnote:api:notes:create-folder", (path) => createFolder({ path }));
  registerApiHandler("aaronnote:api:notes:path-suggestions", async (file) => ({ type: "path-suggestions", paths: await pathSuggestionsForFile(file || "") }));
  registerApiHandler("aaronnote:api:notes:roam-sync", (reload) => roamSyncPayload(reload === true));
  registerApiHandler("aaronnote:api:notes:roam-sync-full", () => roamSyncFullPayload());
  registerApiHandler("aaronnote:api:roam-tools:file-history", async (file) => {
    if (!file) throw Object.assign(new Error("Missing file"), { statusCode: 400 });
    const entries = await fileHistory(roamNoteRoot, file);
    return { type: "file-history", file, entries };
  });
  registerApiHandler("aaronnote:api:roam-tools:restore-file-version", async (body) => {
    const { file, sha } = body || {};
    if (!file || !sha) throw Object.assign(new Error("Missing file or sha"), { statusCode: 400 });
    await restoreFileFromCommit(roamNoteRoot, file, sha);
    markNotesDirty(file);
    queueRoamDbSync(null, [file]);
    const index = await notesIndexPayload();
    return { type: "notes", ...index, root: noteRoot, db: join(noteRoot, "roam.db"), restoredFile: file };
  });
  registerApiHandler("aaronnote:api:roam-tools:discard-file-changes", async (file) => {
    if (!file) throw Object.assign(new Error("Missing file"), { statusCode: 400 });
    const result = await discardFileChanges(roamNoteRoot, file);
    markNotesDirty(result.file || file);
    queueRoamDbSync(null, [result.file || file]);
    const index = await notesIndexPayload();
    return { type: "notes", ...index, root: noteRoot, db: join(noteRoot, "roam.db"), restoredFile: result.file || file, discarded: result.changed !== false };
  });
  registerApiHandler("aaronnote:api:roam-tools:repo-status", async () => {
    const status = await roamRepoStatus(roamNoteRoot);
    return { type: "roam-repo-status", ...status };
  });
  registerApiHandler("aaronnote:api:roam-tools:repo-history", async (limit) => {
    const entries = await repoHistory(roamNoteRoot, typeof limit === "number" ? limit : 30);
    return { type: "roam-repo-history", entries };
  });
  registerApiHandler("aaronnote:api:roam-tools:changes", async () => {
    const changes = await roamRepoChanges(roamNoteRoot);
    return { type: "roam-repo-changes", changes };
  });
  registerApiHandler("aaronnote:api:roam-tools:diff", async (body) => {
    const { file, path, scope, sha } = body || {};
    const target = file || path;
    if (!target) throw Object.assign(new Error("Missing file"), { statusCode: 400 });
    return { type: "roam-repo-diff", ...await diffRoamFile(roamNoteRoot, target, { scope, sha }) };
  });
  registerApiHandler("aaronnote:api:roam-tools:commit-diff", async (sha) => {
    const cleanSha = String(sha || "").trim();
    if (!cleanSha) throw Object.assign(new Error("Missing commit"), { statusCode: 400 });
    return { type: "roam-commit-diff", ...await diffRoamCommit(roamNoteRoot, cleanSha) };
  });
  registerApiHandler("aaronnote:api:roam-tools:pull", async () => {
    const output = await pullRoam(roamNoteRoot);
    markNotesDirty();
    return { type: "roam-pull-done", ok: true, output };
  });
  registerApiHandler("aaronnote:api:roam-tools:push", async () => {
    await pushRoam(roamNoteRoot);
    return { type: "roam-push-done", ok: true };
  });
  registerApiHandler("aaronnote:api:roam-tools:commit", async (message) => {
    const msg = typeof message === "string" && message.trim() ? message.trim() : `roam commit: ${new Date().toISOString()}`;
    const sha = await commitRoam(roamNoteRoot, msg);
    return { type: "roam-commit-done", ok: true, sha };
  });
  registerApiHandler("aaronnote:api:notes:templates", (force) => templatesPayload(force === true));
  registerApiHandler("aaronnote:api:notes:snippets", () => snippetsPayload(true));
  registerApiHandler("aaronnote:api:notes:todos", (file) => getTodos(file || undefined));
  registerApiHandler("aaronnote:api:notes:meta-add", (body) => updateCurrentNoteMeta(body || {}, "add"));
  registerApiHandler("aaronnote:api:roam-tools:rename-tag", (body) => renameRoamTag(body || {}));
  registerApiHandler("aaronnote:api:roam-tools:delete-tag", (body) => deleteRoamTag(body || {}));
  registerApiHandler("aaronnote:api:roam-tools:tag-overlap", () => roamTagOverlapReport());
  registerApiHandler("aaronnote:api:roam-tools:rewrite-path-refs", (body) => rewriteMarkdownPathReferences(body || {}));

  registerApiHandler("aaronnote:api:assets:upload", (body) => storeAsset(body || {}));
  registerApiHandler("aaronnote:api:assets:store-from-path", (body) => storeAssetFromPath(body || {}));
  registerApiHandler("aaronnote:api:assets:scan-orphans", async () => ({ type: "unused-assets", assets: await scanUnusedAssets(), root: noteRoot }));
  registerApiHandler("aaronnote:api:assets:trash-orphans", async (files) => {
    try {
      return await trashUnusedAssets({ files });
    } catch (err) {
      showTaskNotification("AaronNote", err instanceof Error
        ? `Move unused assets to Trash failed: ${err.message}`
        : "Move unused assets to Trash failed.");
      throw err;
    }
  });

  registerApiHandler("aaronnote:api:session:recent", async () => ({ type: "recent", recent: await readRecentNotes() }));
  registerApiHandler("aaronnote:api:session:touch-recent", async (file, openedAt) => ({
    type: "recent",
    recent: await touchRecentNote(String(file || ""), Number(openedAt) || Date.now()),
  }));
  registerApiHandler("aaronnote:api:session:positions", async () => ({ type: "positions", positions: await readCursorPositions() }));
  registerApiHandler("aaronnote:api:session:save-position", async (position) => ({
    type: "positions",
    positions: await touchCursorPosition(position || {}),
  }));

  registerApiHandler("aaronnote:api:plugins:list", () => pluginsPayload(false));
  registerApiHandler("aaronnote:api:plugins:overrides", async () => ({ type: "plugin-overrides", overrides: await readPluginOverrides() }));
  registerApiHandler("aaronnote:api:plugins:save-overrides", async (overrides) => ({ type: "plugin-overrides", overrides: await writePluginOverrides(overrides) }));

  registerApiHandler("aaronnote:api:fs:rename", (body) => renameManagedPath(body || {}));
  registerApiHandler("aaronnote:api:fs:move", (body) => moveManagedPath(body || {}));
  registerApiHandler("aaronnote:api:fs:duplicate", (body) => duplicateManagedFile(body || {}));
  registerApiHandler("aaronnote:api:fs:trash", (body) => trashManagedPath(body || {}));
  registerApiHandler("aaronnote:api:meta:add", (body) => updateCurrentNoteMeta(body || {}, "add"));
  registerApiHandler("aaronnote:api:meta:remove", (body) => updateCurrentNoteMeta(body || {}, "remove"));
  registerApiHandler("aaronnote:api:meta:tag", (body) => updateCurrentNoteMeta(body || {}, "tag"));
  registerApiHandler("aaronnote:api:meta:hide-roam", (body) => updateCurrentNoteMeta(body || {}, "hide-roam"));
  registerApiHandler("aaronnote:api:meta:activate-roam", (body) => updateCurrentNoteMeta(body || {}, "activate-roam"));
  registerApiHandler("aaronnote:api:shell:show-in-folder", (file) => {
    const target = resolveShellPath(file);
    shell.showItemInFolder(target);
    return { ok: true, file: target };
  });
  registerApiHandler("aaronnote:api:shell:open-path", async (file) => {
    const target = resolveShellPath(file);
    const message = await shell.openPath(target);
    return message ? { ok: false, file: target, message } : { ok: true, file: target };
  });
  registerApiHandler("aaronnote:api:shell:show-attachment-menu", (file, base) => {
    const target = resolveMediaFile(file, base);
    Menu.buildFromTemplate([
      {
        label: "System Open",
        click: () => void shell.openPath(target),
      },
    ]).popup();
    return { ok: true, file: target };
  });
  registerApiHandler("aaronnote:api:copilot:request", (action, body) => handleCopilotRequest(String(action || ""), body || {}));
  registerApiHandler("aaronnote:api:roamlookup:request", (action, body) => handleRoamLookupRequest(String(action || ""), body || {}));
  registerApiHandler("aaronnote:api:graph", async () => graphPayload(await scanNotes()));
  registerApiHandler("aaronnote:api:tags", async () => tagIndexPayload(await scanNotes()));
}

function resolveShellPath(file) {
  const raw = String(file || "").trim();
  if (!raw || raw === "Root") return noteRoot;
  return resolve(raw.startsWith("/") ? raw : join(noteRoot, raw));
}

async function flushRendererState(win) {
  if (!win || win.isDestroyed()) return;
  await win.webContents.executeJavaScript(
    "window.dispatchEvent(new CustomEvent('aaronnote:command', { detail: { command: 'flush-state' } })); true",
    true,
  ).catch(() => {});
}

function confirmWindowClose(win) {
  const openWindows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  if (openWindows.length <= 1) {
    dialog.showMessageBoxSync(win, {
      type: "info",
      buttons: ["Keep Open"],
      defaultId: 0,
      title: "Keep Last Window Open",
      message: "AaronNote keeps the last window open.",
      detail: "Use Cmd+Q to quit the app.",
      noLink: true,
    });
    return false;
  }
  const choice = dialog.showMessageBoxSync(win, {
    type: "question",
    buttons: ["Cancel", "Close"],
    defaultId: 0,
    cancelId: 0,
    title: "Close AaronNote?",
    message: "Close this AaronNote window?",
    detail: "Current cursor position and pending edits will be flushed before closing.",
    noLink: true,
  });
  return choice === 1;
}

function confirmQuit() {
  const choice = dialog.showMessageBoxSync(mainWindow ?? undefined, {
    type: "question",
    buttons: ["Cancel", "Quit"],
    defaultId: 0,
    cancelId: 0,
    title: "Quit AaronNote?",
    message: "Quit AaronNote?",
    detail: "Current cursor position and pending edits will be flushed before quitting.",
    noLink: true,
  });
  return choice === 1;
}

async function loadRenderer(win, file = "") {
  const resolvedFile = file ? resolve(file) : "";
  if (devViteUrl) {
    await win.loadURL(urlForFile(devViteUrl, resolvedFile));
    scheduleApplyZoom(win);
    return;
  }
  const query = resolvedFile ? { file: resolvedFile } : undefined;
  await win.loadFile(join(staticDir, "index.html"), query ? { query } : undefined);
  scheduleApplyZoom(win);
}

async function loadRendererUrl(win, targetUrl) {
  await win.loadURL(targetUrl);
  scheduleApplyZoom(win);
}

function createWindow(options = {}) {
  const win = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 920,
    minHeight: 640,
    title: "AaronNote",
    autoHideMenuBar: false,
    backgroundColor: "#eeeae1",
    fullscreen: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(desktopDir, "preload.cjs"),
      sandbox: true,
    },
  });
  if (options.primary !== false) mainWindow = win;
  win.aaronnoteAppWindow = true;
  win.aaronnoteRendererReady = false;
  win.aaronnotePendingOpenFile = "";
  debugPanel?.observeWindow(win);
  scheduleApplyZoom(win);
  win.on("focus", () => scheduleApplyZoom(win));
  win.on("show", () => scheduleApplyZoom(win));
  win.on("restore", () => scheduleApplyZoom(win));
  win.on("enter-full-screen", () => scheduleApplyZoom(win));
  win.on("leave-full-screen", () => scheduleApplyZoom(win));
  win.webContents.on("dom-ready", () => scheduleApplyZoom(win));
  win.webContents.on("did-finish-load", () => {
    scheduleApplyZoom(win);
    flushPendingOpenFile(win);
  });
  win.webContents.on("did-navigate", () => scheduleApplyZoom(win));
  win.webContents.on("zoom-changed", (event, zoomDirection) => {
    event.preventDefault();
    stepDesiredZoomLevel(zoomDirection === "in" ? ZOOM_STEP : -ZOOM_STEP);
  });

  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (rendererAppUrl(targetUrl)) {
      createWindow({ primary: false, url: targetUrl });
      return { action: "deny" };
    }
    if (targetUrl.startsWith("aaronnote-asset:")) {
      return { action: "deny" };
    }
    void shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, targetUrl) => {
    if (internalRendererUrl(targetUrl)) return;
    event.preventDefault();
    void shell.openExternal(targetUrl);
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (handleFullscreenShortcut(win, input)) {
      event.preventDefault();
      return;
    }
    if (handleZoomShortcut(win, input)) {
      event.preventDefault();
      return;
    }
    const historyCommand = historyShortcutCommand(input);
    if (historyCommand) {
      event.preventDefault();
      if (input.type === "keyDown") {
        runInSpecificWindow(win, dispatchCommandScript(historyCommand));
      }
      return;
    }
    if (shouldOwnShortcut(input)) {
      event.preventDefault();
      if (input.type === "keyDown" && input.key.toLowerCase() === "j") {
        runInWindow(dispatchCommandScript("jump-stack"));
      } else if (input.type === "keyDown" && input.key.toLowerCase() === "w") {
        closeCurrentWindow();
      }
    }
  });
  win.on("close", async (event) => {
    if (allowQuit || win.aaronnoteAllowClose) return;
    event.preventDefault();
    if (!confirmWindowClose(win)) return;
    win.aaronnoteAllowClose = true;
    await flushRendererState(win);
    win.close();
  });

  const targetUrl = typeof options.url === "string" && rendererAppUrl(options.url) ? options.url : "";
  void (targetUrl ? loadRendererUrl(win, targetUrl) : loadRenderer(win, pendingOpenFile));
  if (options.primary !== false) pendingOpenFile = "";
  return win;
}

function urlForFile(baseUrl, file = "") {
  if (!file) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("file", resolve(file));
  return url.toString();
}

function sendOpenFileToWindow(win, file) {
  const resolved = resolve(file);
  if (!win || win.isDestroyed()) return;
  if (!win.aaronnoteRendererReady) {
    win.aaronnotePendingOpenFile = resolved;
    return;
  }
  win.webContents.send("aaronnote:open-file", resolved);
}

function flushPendingOpenFile(win) {
  if (!win || win.isDestroyed() || !win.aaronnoteRendererReady) return;
  const file = win.aaronnotePendingOpenFile;
  if (!file) return;
  win.aaronnotePendingOpenFile = "";
  sendOpenFileToWindow(win, file);
}

function runInWindow(script) {
  const win = targetAppWindow();
  if (!win || win.isDestroyed()) return;
  void win.webContents.executeJavaScript(script, true);
}

function runInSpecificWindow(win, script) {
  if (!win || win.isDestroyed()) return;
  void win.webContents.executeJavaScript(script, true);
}

function focusAndRunCommand(command) {
  let win = mainWindow;
  const script = dispatchCommandScript(command);
  if (!win || win.isDestroyed()) {
    win = createWindow();
    win.webContents.once("did-finish-load", () => {
      win.show();
      win.focus();
      runInSpecificWindow(win, script);
    });
    return;
  }
  win.show();
  win.focus();
  runInSpecificWindow(win, script);
}

function registerGlobalShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+N", () => {
    focusAndRunCommand("new-markdown-note");
  });
}

function closeCurrentWindow() {
  const win = targetAppWindow();
  if (!win || win.isDestroyed()) return;
  win.close();
}

async function reloadCurrentWindow() {
  const win = targetAppWindow();
  if (!win || win.isDestroyed()) return;
  await flushRendererState(win);
  const file = await win.webContents.executeJavaScript(
    "window.AaronnoteCurrentFile?.() || new URL(window.location.href).searchParams.get('file') || ''",
    true,
  ).catch(() => "");
  if (file) {
    sendOpenFileToWindow(win, String(file));
    return;
  }
  win.webContents.reload();
}

function createNewWindow() {
  createWindow({ primary: false });
}

async function openRoamDb() {
  await roamSyncPayload().catch(() => {});
  await shell.openPath(join(noteRoot, "roam.db"));
}

function dispatchKeyScript(key) {
  return `document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, metaKey: true, bubbles: true }))`;
}

function dispatchCommandScript(command) {
  return `window.dispatchEvent(new CustomEvent('aaronnote:command', { detail: { command: ${JSON.stringify(command)} } }))`;
}

function pdfNameForFile(file, fallback = "Aaronnote.pdf") {
  const raw = String(file || fallback).split(/[\\/]/).pop() || fallback;
  const stem = raw.replace(/\.[^.]+$/, "") || "Aaronnote";
  return `${stem}.pdf`.replace(/[/:]/g, "-");
}

function publishedHtmlForFile(file) {
  const resolved = resolve(String(file || ""));
  if (!inside(resolved, workspaceRoot)) {
    throw new Error(`Cannot publish PDF for file outside workspace: ${resolved}`);
  }
  const rel = relative(workspaceRoot, resolved);
  if (!/\.(?:md|markdown)$/i.test(rel)) {
    throw new Error(`PDF export requires a Markdown note: ${resolved}`);
  }
  return join(pdfPublishRoot, rel.replace(/\.(?:md|markdown)$/i, ".html"));
}

async function publishNoteHtmlForPdf(file) {
  const resolved = resolve(String(file || ""));
  const htmlFile = publishedHtmlForFile(resolved);
  await execFileAsync(publishScript, [
    "--note",
    resolved,
    "--include-private",
    "--format",
    "pdf",
    "--output-root",
    pdfPublishRoot,
  ], {
    cwd: workspaceRoot,
    env: process.env,
    maxBuffer: 1024 * 1024 * 16,
  });
  await access(htmlFile);
  return htmlFile;
}

async function waitForPrintableAssets(win) {
  await win.webContents.executeJavaScript(`
    Promise.race([
      (async () => {
        if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
        const images = Array.from(document.images || []);
        await Promise.all(images.map((img) => img.complete ? true : new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        })));
        return true;
      })(),
      new Promise((resolve) => setTimeout(() => resolve(true), 2500)),
    ])
  `, true).catch(() => {});
}

async function chooseAndOpenMarkdown() {
  const win = targetAppWindow();
  if (!win) return;
  const result = await dialog.showOpenDialog(win, {
    title: "Open Markdown Note",
    defaultPath: noteRoot,
    properties: ["openFile"],
    filters: [
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  const file = result.filePaths[0];
  if (!file) return;
  sendOpenFileToWindow(win, file);
}

ipcMain.handle("aaronnote:choose-note-path", async (event, options = {}) => {
  const mode = options.mode === "directory" ? "directory" : "file";
  const suggestedPath = typeof options.suggestedPath === "string" && options.suggestedPath.trim()
    ? options.suggestedPath.trim()
    : mode === "directory" ? "." : "untitled.md";
  const defaultPath = resolve(noteRoot, suggestedPath);
  const owner = BrowserWindow.fromWebContents(event.sender) || targetAppWindow() || undefined;
  if (mode === "directory") {
    const dialogOptions = {
      title: typeof options.title === "string" ? options.title : "Choose Folder",
      defaultPath,
      properties: ["openDirectory", "createDirectory"],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    const picked = result.filePaths[0];
    if (result.canceled || !picked) return "";
    const rel = relative(noteRoot, resolve(picked));
    if (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "") return rel.replace(/\\/g, "/");
    if (rel === "") return ".";
    return picked;
  }
  const dialogOptions = {
    title: typeof options.title === "string" ? options.title : "Choose Note Path",
    defaultPath,
    properties: ["createDirectory", "showOverwriteConfirmation"],
    filters: [
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "All Files", extensions: ["*"] },
    ],
  };
  const result = owner
    ? await dialog.showSaveDialog(owner, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) return "";
  const rel = relative(noteRoot, resolve(result.filePath));
  if (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "") return rel.replace(/\\/g, "/");
  return result.filePath;
});

ipcMain.handle("aaronnote:trash-note", async (_event, file = "") => {
  const resolved = resolve(String(file || ""));
  if (!inside(resolved, noteRoot)) {
    throw new Error(`File is outside note root: ${resolved}`);
  }
  await shell.trashItem(resolved);
  return { ok: true, file: resolved };
});

ipcMain.handle("aaronnote:export-pdf", async (event, options = {}) => {
  const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow || undefined;
  const suggestedName = pdfNameForFile(options.name || options.file);
  const dialogOptions = {
    title: "Export PDF",
    defaultPath: join(homedir(), "Desktop", suggestedName),
    properties: ["createDirectory", "showOverwriteConfirmation"],
    filters: [
      { name: "PDF", extensions: ["pdf"] },
      { name: "All Files", extensions: ["*"] },
    ],
  };
  const result = owner
    ? await dialog.showSaveDialog(owner, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true, message: "Export canceled" };
  }

  const printWindow = new BrowserWindow({
    show: false,
    width: 960,
    height: 1280,
    backgroundColor: "#f7f4ed",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    const htmlFile = await publishNoteHtmlForPdf(options.file || "");
    await printWindow.loadFile(htmlFile);
    await waitForPrintableAssets(printWindow);
    const pdf = await printWindow.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 0.7,
    });
    await writeFile(result.filePath, pdf);
    return { ok: true, file: result.filePath, message: `Exported ${result.filePath}` };
  } catch (err) {
    showTaskNotification("AaronNote", err instanceof Error
      ? `Export ${basename(result.filePath)} failed: ${err.message}`
      : `Export ${basename(result.filePath)} failed.`);
    throw err;
  } finally {
    printWindow.destroy();
  }
});

function openFileInWindow(file) {
  const resolved = resolve(file);
  pendingOpenFile = resolved;
  if (!app.isReady()) return;
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  else {
    mainWindow.show();
    mainWindow.focus();
    scheduleApplyZoom(mainWindow);
    sendOpenFileToWindow(mainWindow, resolved);
    pendingOpenFile = "";
  }
}

function buildMenu() {
  return Menu.buildFromTemplate([
  {
    label: "AaronNote",
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "File",
    submenu: [
      {
        label: "Open Markdown...",
        accelerator: "CmdOrCtrl+O",
        click: () => void chooseAndOpenMarkdown(),
      },
      {
        label: "New Window",
        accelerator: "CmdOrCtrl+N",
        click: () => createNewWindow(),
      },
      {
        label: "New Markdown Note...",
        accelerator: "CmdOrCtrl+Shift+N",
        click: () => runInWindow(dispatchCommandScript("new-markdown-note")),
      },
      {
        label: "Delete Current Note",
        accelerator: "CmdOrCtrl+Backspace",
        click: () => runInWindow(dispatchCommandScript("delete-node")),
      },
      { type: "separator" },
      {
        label: "Save",
        accelerator: "CmdOrCtrl+S",
        click: () => runInWindow(dispatchKeyScript("s")),
      },
      {
        label: "Export PDF",
        accelerator: "CmdOrCtrl+P",
        click: () => runInWindow(dispatchKeyScript("p")),
      },
      { type: "separator" },
      {
        label: "Close Window",
        accelerator: "CmdOrCtrl+W",
        click: () => closeCurrentWindow(),
      },
    ],
  },
  {
    label: "Roam",
    submenu: [
      {
        label: "Open Roam Folder",
        click: () => void shell.openPath(noteRoot),
      },
      {
        label: "Open Roam Database",
        click: () => void openRoamDb(),
      },
      { type: "separator" },
      {
        label: "New Roam Note...",
        accelerator: "CmdOrCtrl+Alt+N",
        click: () => runInWindow(dispatchCommandScript("new-roam-node")),
      },
      {
        label: "Open Today's Daily Note",
        click: () => runInWindow(dispatchCommandScript("open-today-daily")),
      },
      {
        label: "Open Roam Node",
        click: () => runInWindow(dispatchCommandScript("open-roam-node")),
      },
      {
        label: "Open Roam Graph",
        click: () => runInWindow(dispatchCommandScript("open-roam-graph")),
      },
      {
        label: "Sync Roam DB",
        click: () => runInWindow(dispatchCommandScript("sync-roamdb")),
      },
      {
        label: "Force Full Refresh Roam DB",
        click: () => runInWindow(dispatchCommandScript("sync-roamdb-full")),
      },
      { type: "separator" },
      {
        label: "Generate or Copy Roam ID",
        click: () => runInWindow(dispatchCommandScript("ensure-roam-id")),
      },
      {
        label: "Insert Roam Idlink",
        click: () => runInWindow(dispatchCommandScript("insert-roam-idlink")),
      },
      {
        label: "Quick Add Meta",
        accelerator: "CmdOrCtrl+Shift+M",
        click: () => runInWindow(dispatchCommandScript("add-meta")),
      },
      {
        label: "Unregister Meta",
        accelerator: "CmdOrCtrl+Shift+U",
        click: () => runInWindow(dispatchCommandScript("remove-meta")),
      },
      {
        label: "Hide Current Note from Roam",
        click: () => runInWindow(dispatchCommandScript("hide-roam")),
      },
      {
        label: "Activate Current Note in Roam",
        click: () => runInWindow(dispatchCommandScript("activate-roam")),
      },
      {
        label: "Restore Current File from Commit…",
        click: () => runInWindow(dispatchCommandScript("roam-restore-file-version")),
      },
      { type: "separator" },
      {
        label: "Roam Git Log",
        click: () => runInWindow(dispatchCommandScript("roam-git-log")),
      },
      {
        label: "Roam Git Status",
        click: () => runInWindow(dispatchCommandScript("roam-git-status")),
      },
      {
        label: "Commit Roam Now…",
        click: () => runInWindow(dispatchCommandScript("roam-commit-now")),
      },
      {
        label: "Push Roam to Remote",
        click: () => runInWindow(dispatchCommandScript("roam-push")),
      },
      { type: "separator" },
      {
        label: "Insert Inline Tag",
        click: () => runInWindow(dispatchCommandScript("insert-inline-tag")),
      },
      {
        label: "Manage Note Tags",
        click: () => runInWindow(dispatchCommandScript("manage-note-tags")),
      },
      {
        label: "Tag Context",
        accelerator: "CmdOrCtrl+T",
        click: () => runInWindow(dispatchCommandScript("tag-context")),
      },
    ],
  },
  {
    label: "Note",
    submenu: [
      {
        label: "Insert Block...",
        accelerator: "Cmd+Enter",
        click: () => runInWindow(dispatchCommandScript("open-block-menu")),
      },
    ],
  },
  {
    label: "Snippets",
    submenu: [
      {
        label: "Reload Snippets",
        accelerator: "CmdOrCtrl+Shift+R",
        click: () => runInWindow(dispatchCommandScript("reload-snippets")),
      },
      {
        label: "Enable Snippet Suggestions",
        click: () => runInWindow(dispatchCommandScript("enable-snippet-suggestions")),
      },
      {
        label: "Disable Snippet Suggestions",
        click: () => runInWindow(dispatchCommandScript("disable-snippet-suggestions")),
      },
      {
        label: "Reset Snippet Suggestions",
        click: () => runInWindow(dispatchCommandScript("reset-snippet-suggestions")),
      },
    ],
  },
  {
    label: "Tools",
    submenu: [
      {
        label: "Plugin Manager",
        click: () => runInWindow(dispatchCommandScript("open-plugin-manager")),
      },
    ],
  },
  {
    label: "Debug",
    submenu: [
      {
        label: "Open Monitor",
        click: () => void openDebugPanel(),
      },
    ],
  },
  {
    label: "Edit",
    submenu: [
      {
        label: "Undo",
        accelerator: "CmdOrCtrl+Z",
        click: () => runInWindow(dispatchCommandScript("undo")),
      },
      {
        label: "Redo",
        accelerator: process.platform === "darwin" ? "Ctrl+Z" : "CmdOrCtrl+Shift+Z",
        click: () => runInWindow(dispatchCommandScript("redo")),
      },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      {
        label: "Toggle Source",
        accelerator: "CmdOrCtrl+/",
        click: () => runInWindow(dispatchCommandScript("toggle-source")),
      },
      { type: "separator" },
      {
        label: "Reset Zoom",
        accelerator: "CmdOrCtrl+0",
        click: () => setDesiredZoomLevel(DEFAULT_ZOOM_LEVEL),
      },
      {
        label: "Zoom In",
        accelerator: "CmdOrCtrl+=",
        click: () => stepDesiredZoomLevel(ZOOM_STEP),
      },
      {
        label: "Zoom Out",
        accelerator: "CmdOrCtrl+-",
        click: () => stepDesiredZoomLevel(-ZOOM_STEP),
      },
      {
        label: "Toggle TOC",
        accelerator: "Alt+T",
        click: () => runInWindow("document.querySelector('.aaronnote-floating-toc > button')?.click()"),
      },
      { type: "separator" },
      {
        label: "Toggle Full Screen",
        accelerator: "F11",
        click: () => {
          const win = targetAppWindow();
          if (!win) return;
          win.setFullScreen(!win.isFullScreen());
        },
      },
      {
        label: "Reload Current Note",
        accelerator: "CmdOrCtrl+R",
        click: () => void reloadCurrentWindow(),
      },
      { role: "toggleDevTools" },
      { role: "togglefullscreen" },
    ],
  },
  {
    label: "Navigate",
    submenu: [
      {
        label: "Notes",
        accelerator: "CmdOrCtrl+1",
        click: () => runInWindow("document.querySelector('[data-action=notes]')?.click()"),
      },
      {
        label: "Filesystem",
        accelerator: "Ctrl+Enter",
        click: () => runInWindow(dispatchCommandScript("open-filesystem")),
      },
      {
        label: "Editor",
        accelerator: "CmdOrCtrl+2",
        click: () => runInWindow("document.querySelector('[data-action=editor],[data-action=editor-inline]')?.click()"),
      },
      {
        label: "Jump Stack",
        accelerator: "CmdOrCtrl+J",
        click: () => runInWindow(dispatchCommandScript("jump-stack")),
      },
      {
        label: "Snippet Next Field",
        accelerator: "CmdOrCtrl+]",
        click: () => runInWindow(dispatchKeyScript("]")),
      },
      {
        label: "Snippet Previous Field",
        accelerator: "CmdOrCtrl+[",
        click: () => runInWindow(dispatchKeyScript("[")),
      },
    ],
  },
]);
}

Menu.setApplicationMenu(buildMenu());

app.on("open-file", (event, file) => {
  event.preventDefault();
  openFileInWindow(file);
});

app.on("second-instance", (_event, argv) => {
  const file = argv.find((arg) => /\.(?:md|markdown)$/i.test(arg));
  if (file) {
    openFileInWindow(file);
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    scheduleApplyZoom(mainWindow);
  }
});

app.whenReady().then(async () => {
  configure({
    root: noteRoot,
    workspaceRoot,
    publishJsDir,
    pluginRoot,
  });
  registerAssetProtocol();
  registerApiIpc();
  registerGlobalShortcuts();
  createWindow();
  setTimeout(() => {
    void maybeScheduleWeeklyFullSync().catch((err) => {
      console.error("[roam-sync] weekly full-sync check failed:", err?.message || err);
    });
  }, 30_000);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else applyZoomToAllWindows();
});

app.on("before-quit", async (event) => {
  if (allowQuit) return;
  event.preventDefault();
  if (!confirmQuit()) return;
  allowQuit = true;
  await Promise.all(BrowserWindow.getAllWindows().map(flushRendererState));
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
