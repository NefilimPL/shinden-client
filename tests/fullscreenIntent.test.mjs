import assert from "node:assert/strict";
import { test } from "node:test";

import { createWindowFullscreenIntent } from "../src/lib/windowFullscreenIntent.ts";

function createMockWindow() {
  const calls = [];

  return {
    calls,
    window: {
      async setFullscreen(value) {
        calls.push(value);
      }
    }
  };
}

test("restores GUI fullscreen after a player fullscreen element exits", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow();

  intent.setIntendedFullscreen(true);

  const restored = await intent.restoreAfterElementFullscreenExit(mockWindow.window, null);

  assert.equal(restored, true);
  assert.deepEqual(mockWindow.calls, [true]);
});

test("does not restore GUI fullscreen when the user did not request it", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow();

  intent.setIntendedFullscreen(false);

  const restored = await intent.restoreAfterElementFullscreenExit(mockWindow.window, null);

  assert.equal(restored, false);
  assert.deepEqual(mockWindow.calls, []);
});

test("does not restore GUI fullscreen while a player element is still fullscreen", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow();

  intent.setIntendedFullscreen(true);

  const restored = await intent.restoreAfterElementFullscreenExit(mockWindow.window, {});

  assert.equal(restored, false);
  assert.deepEqual(mockWindow.calls, []);
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

  assert.deepEqual(calls, ["maximize"]);
});
