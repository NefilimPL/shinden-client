import assert from "node:assert/strict";
import { test } from "node:test";

import { createWindowFullscreenIntent } from "../src/lib/windowFullscreenIntent.ts";

test("clears window fullscreen intent after a player exits element fullscreen", () => {
  const intent = createWindowFullscreenIntent();

  intent.setIntendedFullscreen(true);
  assert.equal(intent.isWindowFullscreenIntended(), true);

  intent.handlePlayerFullscreenChange(null);

  assert.equal(intent.isWindowFullscreenIntended(), false);
});

test("keeps window fullscreen intent while the player element is fullscreen", () => {
  const intent = createWindowFullscreenIntent();

  intent.setIntendedFullscreen(true);

  intent.handlePlayerFullscreenChange({});

  assert.equal(intent.isWindowFullscreenIntended(), true);
});

test("taskbar presentation maximizes instead of enabling native fullscreen", async () => {
  const intent = createWindowFullscreenIntent();
  const calls = [];
  const appWindow = {
    async setFullscreen(value) {
      calls.push(`fullscreen:${value}`);
    },
    async isFullscreen() {
      return false;
    },
    async isMaximized() {
      return false;
    },
    async maximize() {
      calls.push("maximize");
    },
    async unmaximize() {
      calls.push("unmaximize");
    },
  };

  await intent.toggleWindowPresentation(appWindow, "taskbar");

test("taskbar presentation exits native fullscreen before maximizing", async () => {
  const intent = createWindowFullscreenIntent();
  const calls = [];
  const appWindow = {
    async setFullscreen(value) {
      calls.push(`fullscreen:${value}`);
    },
    async isFullscreen() {
      return true;
    },
    async isMaximized() {
      return false;
    },
    async maximize() {
      calls.push("maximize");
    },
    async unmaximize() {
      calls.push("unmaximize");
    },
  };

  await intent.toggleWindowPresentation(appWindow, "taskbar");

  assert.deepEqual(calls, ["fullscreen:false", "maximize"]);
});

  assert.deepEqual(calls, ["maximize"]);
});
