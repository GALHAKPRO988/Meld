const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");

const RELEASE_API = "https://api.github.com/repos/GALHAKPRO988/Meld/releases/latest";
const RELEASE_DOWNLOAD_PREFIX = "https://github.com/GALHAKPRO988/Meld/releases/download/";

function compareVersions(a, b) {
  const left = a
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => parseInt(part, 10) || 0);
  const right = b
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function selectWindowsInstaller(release, currentVersion) {
  if (
    !release ||
    typeof release.tag_name !== "string" ||
    compareVersions(release.tag_name, currentVersion) <= 0
  ) {
    return null;
  }

  const versionMatch = /^v?(\d+\.\d+\.\d+)$/i.exec(release.tag_name);
  if (!versionMatch)
    throw new Error(
      `La etiqueta de release ${release.tag_name} no tiene un formato de versión válido.`,
    );
  const version = versionMatch[1];
  const asset = release.assets?.find(
    (candidate) => candidate.name === `Meld-Setup_v${version}.exe`,
  );
  if (!asset)
    throw new Error(
      `La release ${release.tag_name} no contiene el instalador de Windows esperado.`,
    );
  if (!/^sha256:[a-f0-9]{64}$/i.test(asset.digest ?? "")) {
    throw new Error(
      `La release ${release.tag_name} no incluye un SHA-256 válido para el instalador de Windows.`,
    );
  }
  if (
    typeof asset.browser_download_url !== "string" ||
    !asset.browser_download_url.startsWith(RELEASE_DOWNLOAD_PREFIX)
  ) {
    throw new Error("La URL del instalador de Windows no pertenece a la release oficial de Meld.");
  }

  return { version, asset };
}

async function fetchLatestWindowsInstaller(currentVersion) {
  const response = await fetch(RELEASE_API, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Meld-Updater" },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`No se pudo consultar la última release de Meld (HTTP ${response.status}).`);
  return selectWindowsInstaller(await response.json(), currentVersion);
}

async function downloadWindowsInstaller(asset, destination, onProgress) {
  const response = await fetch(asset.browser_download_url);
  if (!response.ok)
    throw new Error(`No se pudo descargar el instalador de Windows (HTTP ${response.status}).`);
  if (!response.body) throw new Error("La descarga del instalador no devolvió ningún archivo.");

  const hash = createHash("sha256");
  const total = Number(asset.size) || Number(response.headers.get("content-length")) || 0;
  let downloaded = 0;
  let handle;

  try {
    handle = await fs.open(destination, "wx");
    for await (const chunk of response.body) {
      await handle.writeFile(chunk);
      hash.update(chunk);
      downloaded += chunk.byteLength;
      onProgress(total ? Math.min(99, (downloaded / total) * 100) : 0);
    }
    await handle.close();
    handle = undefined;

    const expectedHash = asset.digest.slice("sha256:".length).toLowerCase();
    if (hash.digest("hex") !== expectedHash) {
      throw new Error("La verificación SHA-256 del instalador falló; no se instalará el archivo.");
    }
    onProgress(100);
  } catch (error) {
    if (handle) await handle.close();
    await fs.rm(destination, { force: true });
    throw error;
  }
}

module.exports = {
  compareVersions,
  downloadWindowsInstaller,
  fetchLatestWindowsInstaller,
  selectWindowsInstaller,
};
