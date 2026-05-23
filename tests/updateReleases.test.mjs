import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareVersions,
  extractVersionFromTag,
  mapGitHubReleasesToUpdateVersions,
  selectDefaultReleaseVersion
} from "../src/lib/updateReleases.ts";

test("extractVersionFromTag returns numeric app version and accepts backend suffixes", () => {
  assert.equal(extractVersionFromTag("V4.0.5"), "4.0.5");
  assert.equal(extractVersionFromTag("v.4.0.4"), "4.0.4");
  assert.equal(extractVersionFromTag("app-v4.0.3"), "4.0.3");
  assert.equal(extractVersionFromTag("v4.0.7-dev"), "4.0.7");
  assert.equal(extractVersionFromTag("app-v4.0.7-preview"), "4.0.7");
  assert.equal(extractVersionFromTag("not-a-version"), null);
});

test("compareVersions sorts semantic versions newest first", () => {
  const versions = ["4.0.4", "4.1.0", "4.0.10", "3.9.9"];

  versions.sort((left, right) => compareVersions(right, left));

  assert.deepEqual(versions, ["4.1.0", "4.0.10", "4.0.4", "3.9.9"]);
});

test("mapGitHubReleasesToUpdateVersions keeps releases with latest manifests", () => {
  const releases = [
    {
      tag_name: "V4.0.5",
      name: "V4.0.5",
      prerelease: false,
      published_at: "2026-05-13T17:48:04Z",
      assets: [{ name: "latest.json", browser_download_url: "https://example.com/V4.0.5/latest.json" }]
    },
    {
      tag_name: "V4.0.4",
      name: "V4.0.4",
      prerelease: false,
      published_at: "2026-05-12T17:48:04Z",
      assets: [{ name: "Shinden.Client_4.0.4_x64-setup.exe", browser_download_url: "https://example.com/app.exe" }]
    },
    {
      tag_name: "nightly",
      name: "nightly",
      prerelease: true,
      published_at: "2026-05-14T17:48:04Z",
      assets: [{ name: "latest.json", browser_download_url: "https://example.com/nightly/latest.json" }]
    }
  ];

  assert.deepEqual(mapGitHubReleasesToUpdateVersions(releases), [
    {
      tagName: "V4.0.5",
      version: "4.0.5",
      name: "V4.0.5",
      displayName: "V4.0.5",
      manifestUrl: "https://example.com/V4.0.5/latest.json",
      publishedAt: "2026-05-13T17:48:04Z",
      prerelease: false
    }
  ]);
});

test("mapGitHubReleasesToUpdateVersions includes prereleases when they have updater manifests", () => {
  const releases = [
    {
      tag_name: "V4.1.0-beta.1",
      name: "V4.1.0-beta.1",
      prerelease: true,
      published_at: "2026-05-14T17:48:04Z",
      assets: [{ name: "latest.json", browser_download_url: "https://example.com/V4.1.0-beta.1/latest.json" }]
    }
  ];

  assert.deepEqual(mapGitHubReleasesToUpdateVersions(releases), [
    {
      tagName: "V4.1.0-beta.1",
      version: "4.1.0",
      name: "V4.1.0-beta.1",
      displayName: "V4.1.0-beta.1",
      manifestUrl: "https://example.com/V4.1.0-beta.1/latest.json",
      publishedAt: "2026-05-14T17:48:04Z",
      prerelease: true
    }
  ]);
});

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

test("selectDefaultReleaseVersion prefers the newest version when an update exists", () => {
  const versions = mapGitHubReleasesToUpdateVersions([
    {
      tag_name: "V4.0.4",
      name: "V4.0.4",
      prerelease: false,
      published_at: "2026-05-12T17:48:04Z",
      assets: [{ name: "latest.json", browser_download_url: "https://example.com/V4.0.4/latest.json" }]
    },
    {
      tag_name: "V4.0.5",
      name: "V4.0.5",
      prerelease: false,
      published_at: "2026-05-13T17:48:04Z",
      assets: [{ name: "latest.json", browser_download_url: "https://example.com/V4.0.5/latest.json" }]
    }
  ]);

  assert.equal(selectDefaultReleaseVersion(versions, "4.0.4")?.version, "4.0.5");
  assert.equal(selectDefaultReleaseVersion(versions, "4.0.5")?.version, "4.0.5");
});
