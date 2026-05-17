const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("AaronnoteDesktop", {
  chooseNotePath(options = {}) {
    return ipcRenderer.invoke("aaronnote:choose-note-path", {
      suggestedPath: String(options.suggestedPath || ""),
      title: String(options.title || ""),
    });
  },
  trashNote(file = "") {
    return ipcRenderer.invoke("aaronnote:trash-note", String(file || ""));
  },
  exportPdf(options = {}) {
    return ipcRenderer.invoke("aaronnote:export-pdf", {
      file: String(options.file || ""),
      name: String(options.name || ""),
      document: String(options.document || ""),
    });
  },
});
