import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { applyReleaseVersion, parseReleaseTag } from "../scripts/release_tag.mjs";

test("parseReleaseTag uses Main fallback when tag has no backend suffix", () => {
  assert.deepEqual(parseReleaseTag("v4.0.7", "Main"), {
    appVersion: "4.0.7",
    backendRef: "Main",
    displayVersion: "v4.0.7",
    hasBackendSuffix: false
  });
});

test("parseReleaseTag treats suffix as backend ref and keeps numeric app version", () => {
  assert.deepEqual(parseReleaseTag("app-v4.0.7-dev", "Main"), {
    appVersion: "4.0.7",
    backendRef: "dev",
    displayVersion: "app-v4.0.7-dev",
    hasBackendSuffix: true
  });
});

test("parseReleaseTag accepts dotted v prefix used by release tags", () => {
  assert.deepEqual(parseReleaseTag("v.4.0.7-preview", "Main"), {
    appVersion: "4.0.7",
    backendRef: "preview",
    displayVersion: "v.4.0.7-preview",
    hasBackendSuffix: true
  });
});

test("parseReleaseTag rejects tags without a numeric version core", () => {
  assert.throws(() => parseReleaseTag("nightly", "Main"), /valid release tag/);
  assert.throws(() => parseReleaseTag("v4.0.7-feature/dev", "Main"), /valid release tag/);
});

test("applyReleaseVersion writes numeric app version and env values", () => {
  const root = mkdtempSync(join(tmpdir(), "shinden-release-tag-"));
  const tauriConfigPath = join(root, "src-tauri", "tauri.conf.json");
  const cargoManifestPath = join(root, "src-tauri", "Cargo.toml");
  const githubEnvPath = join(root, "github.env");

  mkdirSync(join(root, "src-tauri"), { recursive: true });
  writeFileSync(tauriConfigPath, JSON.stringify({ version: "4.0.3" }), "utf8");
  writeFileSync(cargoManifestPath, '[package]\nname = "ShindenClient"\nversion = "4.0.3"\n', "utf8");

  applyReleaseVersion({
    root,
    tag: "v4.0.7-dev",
    defaultBackendRef: "Main",
    githubEnvPath
  });

  assert.equal(JSON.parse(readFileSync(tauriConfigPath, "utf8")).version, "4.0.7");
  assert.match(readFileSync(cargoManifestPath, "utf8"), /version = "4\.0\.7"/);
  assert.equal(
    readFileSync(githubEnvPath, "utf8"),
    "APP_VERSION=4.0.7\nBACKEND_REF=dev\nRELEASE_DISPLAY_VERSION=v4.0.7-dev\n"
  );
});

test("workflow delegates release version parsing to the tested node script", () => {
  const workflow = readFileSync(new URL("../.github/workflows/main.yml", import.meta.url), "utf8");

  assert.match(workflow, /node scripts\/release_tag\.mjs/);
  assert.doesNotMatch(workflow, /\$version = \$tag -replace/);
});
