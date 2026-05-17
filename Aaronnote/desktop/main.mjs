import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

import { startAaronnoteServer } from "../server/aaronnote-server.mjs";

const desktopDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(desktopDir, "..");
const isPackaged = app.isPackaged;
const staticDir = isPackaged
  ? join(app.getAppPath(), "dist", "aaronnote")
  : join(projectDir, "dist", "aaronnote");
const publishJsDir = isPackaged
  ? join(process.resourcesPath, "js")
  : resolve(projectDir, "..", "js");
const noteRoot = process.env.AARONNOTE_ROOT || join(homedir(), "HC", "Org", "roam");

let serverHandle = null;
let mainWindow = null;
let pendingOpenFile = process.argv.slice(1).find((arg) => /\.(?:md|markdown)$/i.test(arg)) || "";
let allowQuit = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.exit(0);

function shouldOwnShortcut(input) {
  if (input.alt || input.control) return false;
  if (!input.meta) return false;
  return ["l", "w"].includes(input.key.toLowerCase());
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

function createNewWindow() {
  if (!serverHandle) return;
  createWindow(serverHandle.url, { primary: false });
}

function dispatchKeyScript(key) {
  return `document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, metaKey: true, bubbles: true }))`;
}

function dispatchCommandScript(command) {
  return `window.dispatchEvent(new CustomEvent('aaronnote:command', { detail: { command: ${JSON.stringify(command)} } }))`;
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
        click: () => void shell.openPath(join(noteRoot, "roam.db")),
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
      { type: "separator" },
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
      {
        label: "Toggle TOC",
        accelerator: "Alt+T",
        click: () => runInWindow("document.querySelector('.aaronnote-floating-toc > button')?.click()"),
      },
      { type: "separator" },
      { role: "reload" },
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
