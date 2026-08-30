import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { compile } from "svelte/compiler";

import { enableIframeFullscreen } from "../src/lib/playerIframe.ts";

test("adds fullscreen permissions to an embedded player iframe", () => {
  const iframe = enableIframeFullscreen('<iframe src="https://player.example/embed/42"></iframe>');

  assert.match(iframe, /allowfullscreen/);
  assert.match(iframe, /allow="[^\"]*fullscreen/);
});

test("preserves a provider's inline styles outside fullscreen", () => {
  const iframe = enableIframeFullscreen('<iframe src="https://player.example/embed/42"></iframe>');

  assert.doesNotMatch(iframe, /outline:\s*none/);
});

test("keeps existing player styles while adding fullscreen permission", () => {
  const iframe = enableIframeFullscreen('<iframe style="opacity: 0.9" allow="autoplay" src="https://player.example/embed/42"></iframe>');

  assert.match(iframe, /style="opacity: 0.9"/);
  assert.match(iframe, /allow="autoplay; fullscreen"/);
  assert.match(iframe, /allowfullscreen/);
});

test("removes the iframe outline only while it is fullscreen", async () => {
  const source = await readFile(new URL("../src/routes/watching/+page.svelte", import.meta.url), "utf8");
  const { css } = compile(source, { generate: "client" });

  assert.match(css.code, /iframe:fullscreen\s*\{\s*outline:\s*none/);
});

test("does not duplicate an existing fullscreen permission", () => {
  const iframe = enableIframeFullscreen('<iframe allowfullscreen src="https://player.example/embed/42"></iframe>');

  assert.equal((iframe.match(/allowfullscreen/g) ?? []).length, 1);
});
