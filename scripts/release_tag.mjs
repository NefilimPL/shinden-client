import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_TAG_PATTERN =
  /^(?:app-)?v\.?(?<version>\d+\.\d+\.\d+)(?:-(?<suffix>[0-9A-Za-z][0-9A-Za-z._-]*))?$/i;

export function parseReleaseTag(tag, defaultBackendRef = "Main") {
  const displayVersion = String(tag ?? "").trim();
  const match = RELEASE_TAG_PATTERN.exec(displayVersion);

  if (!match?.groups) {
    throw new Error(
      `Release tag '${displayVersion}' is not a valid release tag. Expected v4.0.7 or v4.0.7-dev.`
    );
  }

  const appVersion = match.groups.version;
  const suffix = match.groups.suffix;
  const fallbackBackendRef = String(defaultBackendRef || "Main").trim() || "Main";

  return {
    appVersion,
    backendRef: suffix ?? fallbackBackendRef,
    displayVersion,
    hasBackendSuffix: Boolean(suffix),
    updaterVersion: suffix ? `${appVersion}-${suffix}` : appVersion
  };
}

function writeGithubEnv(githubEnvPath, values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  appendFileSync(githubEnvPath, `${lines.join("\n")}\n`, "utf8");
}

export function applyReleaseVersion({
  root = process.cwd(),
  tag = process.env.RELEASE_TAG,
  defaultBackendRef = process.env.BACKEND_REF || "Main",
  githubEnvPath = process.env.GITHUB_ENV
} = {}) {
  if (!tag || !String(tag).trim()) {
    throw new Error("Release tag is required.");
  }

  const parsed = parseReleaseTag(tag, defaultBackendRef);

  const tauriConfigPath = join(root, "src-tauri", "tauri.conf.json");
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
  tauriConfig.version = parsed.appVersion;
  writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`, "utf8");

  const cargoManifestPath = join(root, "src-tauri", "Cargo.toml");
  const cargoManifest = readFileSync(cargoManifestPath, "utf8");
  const rewrittenCargoManifest = cargoManifest.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${parsed.appVersion}"`
  );

  if (rewrittenCargoManifest === cargoManifest) {
    throw new Error(`Could not find package version in ${cargoManifestPath}.`);
  }

  writeFileSync(cargoManifestPath, rewrittenCargoManifest, "utf8");

  if (githubEnvPath) {
    writeGithubEnv(githubEnvPath, {
      APP_VERSION: parsed.appVersion,
      BACKEND_REF: parsed.backendRef,
      RELEASE_DISPLAY_VERSION: parsed.displayVersion,
      UPDATER_VERSION: parsed.updaterVersion
    });
  }

  return parsed;
}

const isDirectRun = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectRun) {
  const parsed = applyReleaseVersion();
  console.log(`Release tag: ${parsed.displayVersion}`);
  console.log(`App version: ${parsed.appVersion}`);
  console.log(`Updater version: ${parsed.updaterVersion}`);
  console.log(`Backend ref: ${parsed.backendRef}`);
}
