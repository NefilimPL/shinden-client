import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("fullscreen preference menu does not control the native window", () => {
  const source = readFileSync("src/lib/ViewMenu.svelte", "utf8");

  assert.match(
    source,
    /function setFullscreenPresentation\(presentation: FullscreenPresentation\)\s*\{\s*titleWorkspace\.setFullscreenPresentation\(presentation\);\s*\}/,
  );
  assert.doesNotMatch(source, /@tauri-apps\/api\/window|windowFullscreenIntent/);
});
