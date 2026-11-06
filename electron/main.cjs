const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { pathToFileURL } = require("node:url");

// IndexedDB and localStorage are scoped to the origin, including its port.
const port = 41731;
let mainWindow;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on("download-progress", (progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("meld-updater:download-progress", { percent: progress.percent });
  }
});
autoUpdater.on("error", (error) => {
  console.error("No se pudo actualizar Meld:", error);
});

ipcMain.handle("meld-updater:install-latest", async (event) => {
  if (event.sender !== mainWindow?.webContents) throw new Error("Solicitud de actualización no autorizada.");
  if (!app.isPackaged || process.platform !== "win32") {
    throw new Error("La instalación automática solo está disponible en la aplicación de Windows.");
  }

  const result = await autoUpdater.checkForUpdates();
  if (!result?.isUpdateAvailable) return false;

  await autoUpdater.downloadUpdate();
  autoUpdater.quitAndInstall(true, true);
  return true;
});

function getRuntimeRoot() {
  const appPath = app.getAppPath();
  return appPath.endsWith(".asar") ? `${appPath}.unpacked` : appPath;
}

async function waitForServer(url) {
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok && !(await response.text()).includes("<title>Meld</title>")) {
        throw new Error(`El puerto local ${port} ya está ocupado por otro servicio.`);
      }
      if (!response.ok) {
        lastError = new Error(`El servidor local respondió con el estado ${response.status}.`);
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes("ya está ocupado")) throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error(`El servidor local de Meld no respondió en 30 segundos: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function createWindow() {
  const runtimeRoot = getRuntimeRoot();
  const url = `http://127.0.0.1:${port}`;
  process.env.NITRO_HOST = "127.0.0.1";
  process.env.NITRO_PORT = String(port);

  const serverEntry = path.join(runtimeRoot, ".output/server/index.mjs");
  await import(pathToFileURL(serverEntry).href);
  await waitForServer(url);

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1200, Math.round(screenWidth * 0.9));
  const height = Math.min(800, Math.round(screenHeight * 0.9));

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(360, width),
    minHeight: Math.min(480, height),
    center: true,
    icon: path.join(runtimeRoot, "build/icon.ico"),
    backgroundColor: "#171717",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  await mainWindow.loadURL(url);
}

app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("No se pudo iniciar Meld:", error);
    dialog.showErrorBox("No se pudo iniciar Meld", message);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
