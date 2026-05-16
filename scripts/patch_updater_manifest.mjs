import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function patchUpdaterManifestVersion(manifestPath, updaterVersion) {
  const version = String(updaterVersion ?? "").trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z._-]*)?$/.test(version)) {
    throw new Error(`Invalid updater manifest version: ${updaterVersion}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

const isDirectRun = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectRun) {
  const [, , manifestPath, updaterVersion] = process.argv;
  if (!manifestPath || !updaterVersion) {
    throw new Error("Usage: node scripts/patch_updater_manifest.mjs <latest.json> <updater-version>");
  }

  patchUpdaterManifestVersion(manifestPath, updaterVersion);
  console.log(`Patched ${manifestPath} updater version to ${updaterVersion}`);
}
