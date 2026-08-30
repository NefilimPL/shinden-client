import assert from "node:assert/strict";
import { test } from "node:test";

import { requestEmbeddedPlayerFullscreen } from "../src/lib/playerFullscreen.ts";

test("requests native fullscreen for the embedded player iframe", async () => {
  let requested = 0;
  const container = {
    querySelector(selector) {
      assert.equal(selector, "iframe");
      return {
        async requestFullscreen() {
          requested += 1;
        },
      };
    },
  };

  const fullscreenRequested = await requestEmbeddedPlayerFullscreen(container);

  assert.equal(fullscreenRequested, true);
  assert.equal(requested, 1);
});

test("does nothing when the player iframe is unavailable", async () => {
  const fullscreenRequested = await requestEmbeddedPlayerFullscreen({
    querySelector() {
      return null;
    },
  });

  assert.equal(fullscreenRequested, false);
});
