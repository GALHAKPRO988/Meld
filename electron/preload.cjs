const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("meldUpdater", {
  installLatest: () => ipcRenderer.invoke("meld-updater:install-latest"),
  onDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("meld-updater:download-progress", listener);
    return () => ipcRenderer.removeListener("meld-updater:download-progress", listener);
  },
});
