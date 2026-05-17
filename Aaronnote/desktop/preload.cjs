const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("AaronnoteDesktop", {
  chooseNotePath(options = {}) {
    return ipcRenderer.invoke("aaronnote:choose-note-path", {
      suggestedPath: String(options.suggestedPath || ""),
      title: String(options.title || ""),
    });
  },
});
