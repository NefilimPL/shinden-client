import assert from "node:assert/strict";
import { test } from "node:test";

import * as playerIframe from "../src/lib/playerIframe.ts";

const { enableIframeFullscreen } = playerIframe;

test("adds fullscreen permissions to an embedded player iframe", () => {
  const iframe = enableIframeFullscreen('<iframe src="https://player.example/embed/42"></iframe>');

  assert.match(iframe, /allowfullscreen/);
  assert.match(iframe, /allow="[^\"]*fullscreen/);
});

test("delegates fullscreen after an embedded player navigates to another host", () => {
  const iframe = enableIframeFullscreen('<iframe src="https://redirector.example/embed/42"></iframe>');

  assert.match(iframe, /allow="fullscreen \*; autoplay; encrypted-media"/);
});

test("widens an existing fullscreen permission to cover a redirected player", () => {
  const iframe = enableIframeFullscreen('<iframe allow="autoplay; fullscreen" src="https://redirector.example/embed/42"></iframe>');

  assert.match(iframe, /allow="autoplay; fullscreen \*"/);
});

test("requests fullscreen for the player container so the app controls remain available", async () => {
  let requested = 0;
  const requestedFullscreen = await playerIframe.requestEmbeddedPlayerFullscreen({
    async requestFullscreen() {
      requested += 1;
    },
  });

  assert.equal(requestedFullscreen, true);
  assert.equal(requested, 1);
});

test("exits fullscreen only when it belongs to the app player container", async () => {
  let exits = 0;
  const playerContainer = {};
  const exitedFullscreen = await playerIframe.exitEmbeddedPlayerFullscreen({
    fullscreenElement: playerContainer,
    async exitFullscreen() {
      exits += 1;
    },
  }, playerContainer);

  assert.equal(exitedFullscreen, true);
  assert.equal(exits, 1);
});

test("does not close fullscreen owned by an embedded provider", async () => {
  let exits = 0;
  const playerContainer = {};
  const exitedFullscreen = await playerIframe.exitEmbeddedPlayerFullscreen({
    fullscreenElement: {},
    async exitFullscreen() {
      exits += 1;
    },
  }, playerContainer);

  assert.equal(exitedFullscreen, false);
  assert.equal(exits, 0);
});

test("does not duplicate an existing fullscreen permission", () => {
  const iframe = enableIframeFullscreen('<iframe allowfullscreen src="https://player.example/embed/42"></iframe>');

  assert.equal((iframe.match(/allowfullscreen/g) ?? []).length, 1);
});
