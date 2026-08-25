import assert from "node:assert/strict";
import { test } from "node:test";

import { enableIframeFullscreen } from "../src/lib/playerIframe.ts";

test("adds fullscreen permissions to an embedded player iframe", () => {
  const iframe = enableIframeFullscreen('<iframe src="https://player.example/embed/42"></iframe>');

  assert.match(iframe, /allowfullscreen/);
  assert.match(iframe, /allow="[^\"]*fullscreen/);
});

test("does not duplicate an existing fullscreen permission", () => {
  const iframe = enableIframeFullscreen('<iframe allowfullscreen src="https://player.example/embed/42"></iframe>');

  assert.equal((iframe.match(/allowfullscreen/g) ?? []).length, 1);
});
