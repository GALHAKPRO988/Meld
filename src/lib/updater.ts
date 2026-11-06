import packageJson from "../../package.json";

export const UPDATE_REPO = "GALHAKPRO988/Meld";
export const APP_VERSION = packageJson.version;
export const UPDATE_AVAILABLE_EVENT = "meld:update-available";

export type Platform = "android" | "ios" | "windows" | "mac" | "linux" | "other";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

/** Compares "v1.2.3" style versions; >0 when a is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((n) => parseInt(n, 10) || 0);
  const pb = b
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function detectPlatform(ua: string, touchPoints = 0): Platform {
  if (/android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (/Mobile/i.test(ua) || touchPoints > 1))) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/mac os|macintosh/i.test(ua) && !/iphone|ipad/i.test(ua)) return "mac";
  if (/linux/i.test(ua)) return "linux";
  return "other";
}

const PATTERNS: Record<Platform, RegExp[]> = {
  android: [/\.apk$/i],
  ios: [],
  windows: [/\.exe$/i, /\.msi$/i],
  mac: [/\.dmg$/i, /\.pkg$/i],
  linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i],
  other: [],
};

/** Picks the installer for the user's device, in order of preference. */
export function pickAsset(assets: ReleaseAsset[], platform: Platform): ReleaseAsset | undefined {
  for (const re of PATTERNS[platform]) {
    const a = assets.find((x) => re.test(x.name));
    if (a) return a;
  }
  return undefined;
}

export interface UpdateInfo {
  version: string;
  url: string;
  pageUrl: string;
  platform: Platform;
}

export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
    cache: force ? "no-store" : "default",
  });
  if (!res.ok) throw new Error(`No se pudieron comprobar las actualizaciones (${res.status})`);
  const rel = (await res.json()) as { tag_name: string; html_url: string; assets: ReleaseAsset[] };
  if (compareVersions(rel.tag_name, APP_VERSION) <= 0) return null;
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const asset = pickAsset(rel.assets ?? [], platform);
  return {
    version: rel.tag_name,
    url: asset?.browser_download_url ?? rel.html_url,
    pageUrl: rel.html_url,
    platform,
  };
}

export async function loadChangelog(): Promise<string> {
  for (const p of ["/changelog/latest.md", "/changelog/lastest.md"]) {
    try {
      const r = await fetch(p, { cache: "no-store" });
      if (r.ok) return await r.text();
    } catch {
      /* try next */
    }
  }
  return "Sin notas para esta versión.";
}
