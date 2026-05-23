# Release Tag Backend Ref Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tags like `v4.0.7-dev` build app version `4.0.7` against backend branch `dev`, while unsuffixed tags keep the existing `Main` to `main` or `master` backend fallback and the full tag remains visible in the GUI update list.

**Architecture:** Move release tag parsing out of inline workflow PowerShell into a small dependency-free Node script that can be unit tested. Keep frontend update release mapping responsible for display labels and numeric version sorting. Keep Rust updater parsing responsible for safe manifest URLs and numeric version comparison.

**Tech Stack:** GitHub Actions, Node `node:test`, TypeScript/Svelte, Rust unit tests, Tauri updater.

---

## File Structure

- Create `scripts/release_tag.mjs`: parse release tags, apply the numeric app version to Tauri/Cargo manifests, and export `APP_VERSION`, `BACKEND_REF`, and `RELEASE_DISPLAY_VERSION` to `GITHUB_ENV`.
- Create `tests/releaseTag.test.mjs`: unit tests for release tag parsing and manifest rewriting behavior.
- Modify `.github/workflows/main.yml`: replace the inline PowerShell parser with `node scripts/release_tag.mjs`.
- Modify `src/lib/updateReleases.ts`: parse only the numeric version core and expose `displayName` for the full tag.
- Modify `cache/ts-tests/updateReleases.js`: keep the test copy in sync with `src/lib/updateReleases.ts`.
- Modify `tests/updateReleases.test.mjs`: cover suffixed tags and display labels.
- Modify `src/lib/updater.svelte.ts`: use `displayName` in user-visible updater messages and logs.
- Modify `src/routes/info/+page.svelte`: render the full tag label in the versions dropdown.
- Modify `src-tauri/src/updater_commands.rs`: parse suffixed tags to the numeric version core while keeping manifest URLs under the full tag.
- Modify `src-tauri/src/lib.rs`: extend Rust updater parser tests.

---

### Task 1: Add Tested Release Tag Parser for GitHub Actions

**Files:**
- Create: `scripts/release_tag.mjs`
- Create: `tests/releaseTag.test.mjs`

- [ ] **Step 1: Write the failing parser tests**

Add `tests/releaseTag.test.mjs`:

```js
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
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `node --test tests/releaseTag.test.mjs`

Expected: fail with `Cannot find module '../scripts/release_tag.mjs'`.

- [ ] **Step 3: Implement the parser and manifest writer**

Create `scripts/release_tag.mjs` with:

```js
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_TAG_PATTERN = /^(?:app-)?v\.?(?<version>\d+\.\d+\.\d+)(?:-(?<suffix>[0-9A-Za-z][0-9A-Za-z._-]*))?$/i;

export function parseReleaseTag(tag, defaultBackendRef = "Main") {
  const displayVersion = String(tag ?? "").trim();
  const match = RELEASE_TAG_PATTERN.exec(displayVersion);

  if (!match?.groups) {
    throw new Error(`Release tag '${displayVersion}' is not a valid release tag. Expected v4.0.7 or v4.0.7-dev.`);
  }

  const appVersion = match.groups.version;
  const suffix = match.groups.suffix;
  const fallbackBackendRef = String(defaultBackendRef || "Main").trim() || "Main";

  return {
    appVersion,
    backendRef: suffix ?? fallbackBackendRef,
    displayVersion,
    hasBackendSuffix: Boolean(suffix)
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
  const rewrittenCargoManifest = cargoManifest.replace(/^version\s*=\s*"[^"]+"/m, `version = "${parsed.appVersion}"`);
  if (rewrittenCargoManifest === cargoManifest) {
    throw new Error(`Could not find package version in ${cargoManifestPath}.`);
  }
  writeFileSync(cargoManifestPath, rewrittenCargoManifest, "utf8");

  if (githubEnvPath) {
    writeGithubEnv(githubEnvPath, {
      APP_VERSION: parsed.appVersion,
      BACKEND_REF: parsed.backendRef,
      RELEASE_DISPLAY_VERSION: parsed.displayVersion
    });
  }

  return parsed;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const parsed = applyReleaseVersion();
  console.log(`Release tag: ${parsed.displayVersion}`);
  console.log(`App version: ${parsed.appVersion}`);
  console.log(`Backend ref: ${parsed.backendRef}`);
}
```

- [ ] **Step 4: Run parser tests and verify GREEN**

Run: `node --test tests/releaseTag.test.mjs`

Expected: pass.

---

### Task 2: Wire GitHub Actions to the Parser

**Files:**
- Modify: `.github/workflows/main.yml`

- [ ] **Step 1: Write a workflow smoke assertion**

Add this test to `tests/releaseTag.test.mjs`:

```js
test("workflow delegates release version parsing to the tested node script", () => {
  const workflow = readFileSync(new URL("../.github/workflows/main.yml", import.meta.url), "utf8");

  assert.match(workflow, /node scripts\/release_tag\.mjs/);
  assert.doesNotMatch(workflow, /\$version = \$tag -replace/);
});
```

- [ ] **Step 2: Run workflow smoke test and verify RED**

Run: `node --test tests/releaseTag.test.mjs`

Expected: fail because the workflow still uses inline PowerShell parsing.

- [ ] **Step 3: Replace inline parsing step**

In `.github/workflows/main.yml`, replace the `Apply release version` PowerShell body with:

```yaml
      - name: Apply release version
        run: node scripts/release_tag.mjs
```

Leave the existing job-level `RELEASE_TAG` and `BACKEND_REF` environment values in place. The Node script will override `BACKEND_REF` for later steps only when the tag suffix asks for a backend branch.

- [ ] **Step 4: Run workflow smoke test and verify GREEN**

Run: `node --test tests/releaseTag.test.mjs`

Expected: pass.

---

### Task 3: Preserve Full Tag Labels in the GUI Update List

**Files:**
- Modify: `src/lib/updateReleases.ts`
- Modify: `cache/ts-tests/updateReleases.js`
- Modify: `tests/updateReleases.test.mjs`
- Modify: `src/lib/updater.svelte.ts`
- Modify: `src/routes/info/+page.svelte`

- [ ] **Step 1: Write failing update release tests**

Update `tests/updateReleases.test.mjs` so the extraction and mapping tests include:

```js
test("extractVersionFromTag returns numeric app version and accepts backend suffixes", () => {
  assert.equal(extractVersionFromTag("V4.0.5"), "4.0.5");
  assert.equal(extractVersionFromTag("v.4.0.4"), "4.0.4");
  assert.equal(extractVersionFromTag("app-v4.0.3"), "4.0.3");
  assert.equal(extractVersionFromTag("v4.0.7-dev"), "4.0.7");
  assert.equal(extractVersionFromTag("app-v4.0.7-preview"), "4.0.7");
  assert.equal(extractVersionFromTag("not-a-version"), null);
});
```

Update expected mapped releases to include:

```js
{
  tagName: "V4.0.5",
  version: "4.0.5",
  name: "V4.0.5",
  displayName: "V4.0.5",
  manifestUrl: "https://example.com/V4.0.5/latest.json",
  publishedAt: "2026-05-13T17:48:04Z",
  prerelease: false
}
```

Add a suffixed release mapping assertion:

```js
test("mapGitHubReleasesToUpdateVersions keeps full tag as display name", () => {
  const releases = [
    {
      tag_name: "v4.0.7-dev",
      name: "Shinden Client 4.0.7",
      prerelease: true,
      published_at: "2026-05-16T17:48:04Z",
      assets: [{ name: "latest.json", browser_download_url: "https://example.com/v4.0.7-dev/latest.json" }]
    }
  ];

  assert.deepEqual(mapGitHubReleasesToUpdateVersions(releases), [
    {
      tagName: "v4.0.7-dev",
      version: "4.0.7",
      name: "Shinden Client 4.0.7",
      displayName: "v4.0.7-dev",
      manifestUrl: "https://example.com/v4.0.7-dev/latest.json",
      publishedAt: "2026-05-16T17:48:04Z",
      prerelease: true
    }
  ]);
});
```

- [ ] **Step 2: Run update release tests and verify RED**

Run: `node --test tests/updateReleases.test.mjs`

Expected: fail because `extractVersionFromTag("v4.0.7-dev")` still returns `4.0.7-dev` and `displayName` does not exist.

- [ ] **Step 3: Update release mapping implementation**

In `src/lib/updateReleases.ts`, change tag extraction to use:

```ts
const RELEASE_TAG_PATTERN = /^(?:app-)?v\.?(\d+\.\d+\.\d+)(?:-[0-9A-Za-z][0-9A-Za-z._-]*)?$/i;

export function extractVersionFromTag(tagName: string): string | null {
    const match = RELEASE_TAG_PATTERN.exec(tagName.trim());
    return match?.[1] ?? null;
}
```

Add `displayName: string;` to `UpdateReleaseVersion`, and return `displayName: release.tag_name` from `mapGitHubReleasesToUpdateVersions`.

Apply the equivalent JavaScript changes to `cache/ts-tests/updateReleases.js`.

- [ ] **Step 4: Render display labels in GUI**

In `src/routes/info/+page.svelte`, change the option body to:

```svelte
{release.displayName}{release.version === version ? " - obecna" : ""}{release.prerelease ? " - prerelease" : ""}
```

In `src/lib/updater.svelte.ts`, use `selectedVersion.displayName` for user-visible selected-release messages:

```ts
await setUpdateState(UpdateState.CHECKING, `Przygotowywanie wersji ${selectedVersion.displayName}`);
log(LogLevel.INFO, `Installing update ${selectedVersion.displayName}`);
log(LogLevel.ERROR, `Update ${selectedVersion.displayName} failed: ${message}`);
```

- [ ] **Step 5: Run update release tests and verify GREEN**

Run: `node --test tests/updateReleases.test.mjs`

Expected: pass.

---

### Task 4: Parse Suffixed Tags Safely in Rust Updater

**Files:**
- Modify: `src-tauri/src/updater_commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests**

Extend `updater_command_tests` in `src-tauri/src/lib.rs`:

```rust
assert_eq!(release_version_from_tag("v4.0.7-dev").unwrap(), "4.0.7");
assert_eq!(release_version_from_tag("v.4.0.7-preview").unwrap(), "4.0.7");
assert_eq!(
    release_manifest_endpoint("v4.0.7-dev").unwrap(),
    "https://github.com/NefilimPL/shinden-client/releases/download/v4.0.7-dev/latest.json"
);
assert!(release_manifest_endpoint("v4.0.7-feature/dev").is_err());
```

- [ ] **Step 2: Run Rust tests and verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml updater_command_tests -- --nocapture`

Expected: fail because `release_version_from_tag("v4.0.7-dev")` returns `4.0.7-dev` and dotted `v.` is not accepted.

- [ ] **Step 3: Update Rust tag parser**

In `src-tauri/src/updater_commands.rs`, make `release_version_from_tag` strip `app-v`, `app-v.`, `v`, or `v.`, split at the first `-`, validate the `major.minor.patch` core, validate an optional suffix with ASCII letters, digits, dots, underscores, and hyphens, and return only the numeric core.

Keep `release_manifest_endpoint` validating the full tag path with ASCII letters, digits, dots, underscores, and hyphens before building the GitHub download URL.

- [ ] **Step 4: Run Rust tests and verify GREEN**

Run: `cargo test --manifest-path src-tauri/Cargo.toml updater_command_tests -- --nocapture`

Expected: pass.

---

### Task 5: Full Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run all focused Node tests**

Run: `node --test tests/releaseTag.test.mjs tests/updateReleases.test.mjs`

Expected: pass.

- [ ] **Step 2: Run Svelte/TypeScript check**

Run: `npm run check`

Expected: pass.

- [ ] **Step 3: Run focused Rust updater tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml updater_command_tests -- --nocapture`

Expected: pass.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --stat`

Expected: changes are limited to the release tag parser, workflow, update release display logic, Rust updater parser, tests, and this implementation plan.
