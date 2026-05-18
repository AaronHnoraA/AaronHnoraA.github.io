import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import { execFile } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { promisify } from "node:util";

import { startAaronnoteServer } from "../server/aaronnote-server.mjs";

const desktopDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(desktopDir, "..");
const noteRoot = process.env.AARONNOTE_ROOT || join(homedir(), "HC", "Org", "roam");
const workspaceRoot = process.env.AARONNOTE_WORKSPACE_ROOT
  ? resolve(process.env.AARONNOTE_WORKSPACE_ROOT)
  : resolve(noteRoot, "..");
const publishScript = join(workspaceRoot, "bin", "publish-site");
const pdfPublishRoot = join(workspaceRoot, "public", ".export");
const execFileAsync = promisify(execFile);
const isPackaged = app.isPackaged;
const staticDir = isPackaged
  ? join(app.getAppPath(), "dist", "aaronnote")
  : join(projectDir, "dist", "aaronnote");
const publishJsDir = isPackaged
  ? join(process.resourcesPath, "js")
  : resolve(projectDir, "..", "js");

let serverHandle = null;
let mainWindow = null;
let pendingOpenFile = process.argv.slice(1).find((arg) => /\.(?:md|markdown)$/i.test(arg)) || "";
let allowQuit = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.exit(0);

function shouldOwnShortcut(input) {
  if (input.alt || input.control) return false;
  if (!input.meta) return false;
  return ["l", "r", "w"].includes(input.key.toLowerCase());
}

function inside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
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

function createWindow(url, options = {}) {
  const win = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 920,
    minHeight: 640,
    title: "AaronNote",
    autoHideMenuBar: false,
    backgroundColor: "#eeeae1",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(desktopDir, "preload.cjs"),
      sandbox: true,
    },
  });
  if (options.primary !== false) mainWindow = win;

  const appBaseUrl = serverHandle?.url || url;
  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith(appBaseUrl)) {
      createWindow(targetUrl, { primary: false, exactUrl: true });
      return { action: "deny" };
    }
    void shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl.startsWith(appBaseUrl)) return;
    event.preventDefault();
    void shell.openExternal(targetUrl);
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (shouldOwnShortcut(input)) event.preventDefault();
  });
  win.on("close", async (event) => {
    if (allowQuit || win.aaronnoteAllowClose) return;
    event.preventDefault();
    if (!confirmWindowClose(win)) return;
    win.aaronnoteAllowClose = true;
    await flushRendererState(win);
    win.close();
  });

  void win.loadURL(options.exactUrl ? url : urlForFile(url, pendingOpenFile));
  if (options.primary !== false) pendingOpenFile = "";
  return win;
}

function urlForFile(baseUrl, file = "") {
  if (!file) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("file", resolve(file));
  return url.toString();
}

function runInWindow(script) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!win || win.isDestroyed()) return;
  void win.webContents.executeJavaScript(script, true);
}

async function reloadCurrentWindow() {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!win || win.isDestroyed()) return;
  await flushRendererState(win);
  const file = await win.webContents.executeJavaScript(
    "window.AaronnoteCurrentFile?.() || new URL(window.location.href).searchParams.get('file') || ''",
    true,
  ).catch(() => "");
  if (serverHandle?.url && file) {
    await win.loadURL(urlForFile(serverHandle.url, String(file)));
    return;
  }
  win.webContents.reload();
}

function createNewWindow() {
  if (!serverHandle) return;
  createWindow(serverHandle.url, { primary: false });
}

async function openRoamDb() {
  if (serverHandle?.url) {
    await fetch(new URL("/api/roamdb/sync", serverHandle.url)).catch(() => {});
  }
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
  if (!mainWindow || mainWindow.isDestroyed() || !serverHandle) return;
  const result = await dialog.showOpenDialog(mainWindow, {
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
  void mainWindow.loadURL(urlForFile(serverHandle.url, file));
}

ipcMain.handle("aaronnote:choose-note-path", async (_event, options = {}) => {
  const suggestedPath = typeof options.suggestedPath === "string" && options.suggestedPath.trim()
    ? options.suggestedPath.trim()
    : "untitled.md";
  const defaultPath = resolve(noteRoot, suggestedPath);
  const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
    title: typeof options.title === "string" ? options.title : "Choose Note Path",
    defaultPath,
    properties: ["createDirectory", "showOverwriteConfirmation"],
    filters: [
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
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
    });
    await writeFile(result.filePath, pdf);
    return { ok: true, file: result.filePath, message: `Exported ${result.filePath}` };
  } finally {
    printWindow.destroy();
  }
});

function openFileInWindow(file) {
  const resolved = resolve(file);
  pendingOpenFile = resolved;
  if (!serverHandle) return;
  if (!mainWindow || mainWindow.isDestroyed()) createWindow(serverHandle.url);
  else {
    mainWindow.show();
    mainWindow.focus();
    void mainWindow.loadURL(urlForFile(serverHandle.url, resolved));
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
      {
        label: "Open Roam Folder",
        click: () => void shell.openPath(noteRoot),
      },
      {
        label: "Open Database Link",
        click: () => void openRoamDb(),
      },
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
        label: "New Note...",
        accelerator: "CmdOrCtrl+Shift+N",
        click: () => runInWindow(dispatchCommandScript("new-node")),
      },
      {
        label: "Delete Current Note",
        accelerator: "CmdOrCtrl+Backspace",
        click: () => runInWindow(dispatchCommandScript("delete-node")),
      },
      {
        label: "Close Window",
        accelerator: "CmdOrCtrl+W",
        click: () => {
          const win = BrowserWindow.getFocusedWindow() || mainWindow;
          win?.close();
        },
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
    ],
  },
  {
    label: "Note",
    submenu: [
      {
        label: "Sync Roam DB",
        click: () => runInWindow(dispatchCommandScript("sync-roamdb")),
      },
      {
        label: "Reload Snippets",
        accelerator: "CmdOrCtrl+Shift+R",
        click: () => runInWindow(dispatchCommandScript("reload-snippets")),
      },
      {
        label: "Plugin Manager",
        click: () => runInWindow(dispatchCommandScript("open-plugin-manager")),
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
      { type: "separator" },
      {
        label: "Insert Block...",
        accelerator: "Cmd+Enter",
        click: () => runInWindow(dispatchCommandScript("open-block-menu")),
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
        label: "Add Tag",
        click: () => runInWindow(dispatchCommandScript("add-tag")),
      },
      {
        label: "Tag Manager",
        accelerator: "CmdOrCtrl+T",
        click: () => runInWindow(dispatchCommandScript("tag-manager")),
      },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
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
      { role: "resetZoom", accelerator: "CmdOrCtrl+0" },
      { role: "zoomIn", accelerator: "CmdOrCtrl+=" },
      { role: "zoomOut", accelerator: "CmdOrCtrl+-" },
      {
        label: "Toggle TOC",
        accelerator: "Alt+T",
        click: () => runInWindow("document.querySelector('.aaronnote-floating-toc > button')?.click()"),
      },
      { type: "separator" },
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
  }
});

app.whenReady().then(async () => {
  serverHandle = await startAaronnoteServer({
    host: "127.0.0.1",
    port: Number(process.env.AARONNOTE_PORT || 0),
    root: noteRoot,
    workspaceRoot,
    staticDir,
    publishJsDir,
  });
  createWindow(serverHandle.url);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverHandle) createWindow(serverHandle.url);
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
  void serverHandle?.close?.();
});
