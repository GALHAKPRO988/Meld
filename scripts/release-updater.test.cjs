const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const {
  downloadWindowsInstaller,
  selectWindowsInstaller,
} = require("../electron/release-updater.cjs");

function makeRelease(bytes = Buffer.from("installer")) {
  const version = "1.0.2";
  return {
    tag_name: `v${version}`,
    assets: [
      {
        name: `Meld-Setup_v${version}.exe`,
        browser_download_url: `https://github.com/GALHAKPRO988/Meld/releases/download/v${version}/Meld-Setup_v${version}.exe`,
        size: bytes.length,
        digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      },
    ],
  };
}

test("selects only the Windows installer for a newer release", () => {
  const release = makeRelease();
  assert.equal(selectWindowsInstaller(release, "1.0.1").asset.name, "Meld-Setup_v1.0.2.exe");
  assert.equal(selectWindowsInstaller(release, "1.0.2"), null);
  assert.throws(
    () => selectWindowsInstaller({ ...release, assets: [] }, "1.0.1"),
    /no contiene el instalador/,
  );
});

test("downloads and verifies the Windows installer before reporting completion", async () => {
  const bytes = Buffer.from("verified installer");
  const release = makeRelease(bytes);
  const asset = release.assets[0];
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "meld-updater-test-"));
  const destination = path.join(directory, asset.name);
  const originalFetch = global.fetch;
  const progress = [];

  global.fetch = async () => new Response(bytes);
  try {
    await downloadWindowsInstaller(asset, destination, (percent) => progress.push(percent));
    assert.deepEqual(await fs.readFile(destination), bytes);
    assert.equal(progress.at(-1), 100);
  } finally {
    global.fetch = originalFetch;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("removes a downloaded installer when its checksum does not match", async () => {
  const bytes = Buffer.from("tampered installer");
  const asset = makeRelease(Buffer.from("expected installer")).assets[0];
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "meld-updater-test-"));
  const destination = path.join(directory, asset.name);
  const originalFetch = global.fetch;

  global.fetch = async () => new Response(bytes);
  try {
    await assert.rejects(
      downloadWindowsInstaller(asset, destination, () => {}),
      /SHA-256/,
    );
    await assert.rejects(fs.access(destination), { code: "ENOENT" });
  } finally {
    global.fetch = originalFetch;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
