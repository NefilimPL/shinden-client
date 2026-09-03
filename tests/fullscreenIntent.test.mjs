import assert from "node:assert/strict";
import { test } from "node:test";

import { createWindowFullscreenIntent } from "../src/lib/windowFullscreenIntent.ts";

function createMockWindow({ fullscreen = false, maximized = false } = {}) {
  const calls = [];

  return {
    calls,
    window: {
      async setFullscreen(value) {
        calls.push(`fullscreen:${value}`);
        fullscreen = value;
      },
      async isFullscreen() {
        return fullscreen;
      },
      async isMaximized() {
        return maximized;
      },
      async maximize() {
        calls.push("maximize");
        maximized = true;
      },
      async unmaximize() {
        calls.push("unmaximize");
        maximized = false;
      },
    },
  };
}

test("toggling immersive presentation hides the taskbar with native fullscreen", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow();

  await intent.toggleWindowPresentation(mockWindow.window, "immersive");

  assert.deepEqual(mockWindow.calls, ["fullscreen:true"]);
  assert.equal(intent.isWindowFullscreenIntended(), true);
});

test("does not expose direct presentation application while an iframe can be fullscreen", () => {
  const intent = createWindowFullscreenIntent();

  assert.equal("applyWindowPresentation" in intent, false);
});

test("toggling taskbar presentation exits native fullscreen before maximizing", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow({ fullscreen: true });

  await intent.toggleWindowPresentation(mockWindow.window, "taskbar");

  assert.deepEqual(mockWindow.calls, ["fullscreen:false", "maximize"]);
  assert.equal(intent.isWindowFullscreenIntended(), false);
});

test("restores native fullscreen after a player exits only when the window left it", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow();

  intent.setIntendedFullscreen(true);

  const restored = await intent.restoreAfterElementFullscreenExit(mockWindow.window, null);

  assert.equal(restored, true);
  assert.deepEqual(mockWindow.calls, ["fullscreen:true"]);
});

test("does not reapply native fullscreen after a player exits when it is already active", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow({ fullscreen: true });

  intent.setIntendedFullscreen(true);

  const restored = await intent.restoreAfterElementFullscreenExit(mockWindow.window, null);

  assert.equal(restored, false);
  assert.deepEqual(mockWindow.calls, []);
});

test("does not restore fullscreen after a taskbar window toggle starts mid-restore", async () => {
  const intent = createWindowFullscreenIntent();
  let resolveFirstFullscreenCheck;
  let fullscreenChecks = 0;
  const calls = [];
  const appWindow = {
    async setFullscreen(value) {
      calls.push(`fullscreen:${value}`);
    },
    isFullscreen() {
      fullscreenChecks += 1;
      if (fullscreenChecks === 1) {
        return new Promise((resolve) => {
          resolveFirstFullscreenCheck = resolve;
        });
      }
      return Promise.resolve(false);
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

  intent.setIntendedFullscreen(true);
  const restoration = intent.restoreAfterElementFullscreenExit(appWindow, null);
  await Promise.resolve();

  const taskbar = intent.toggleWindowPresentation(appWindow, "taskbar");
  resolveFirstFullscreenCheck(false);

  assert.equal(await restoration, false);
  await taskbar;
  assert.deepEqual(calls, ["maximize"]);
});

test("reapplies immersive fullscreen after it supersedes an in-flight taskbar exit", async () => {
  const intent = createWindowFullscreenIntent();
  let fullscreen = true;
  let resolveFullscreenExit;
  const calls = [];
  const appWindow = {
    async setFullscreen(value) {
      calls.push(`fullscreen:${value}`);
      if (!value) {
        await new Promise((resolve) => {
          resolveFullscreenExit = resolve;
        });
      }
      fullscreen = value;
    },
    async isFullscreen() {
      return fullscreen;
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

  const taskbar = intent.toggleWindowPresentation(appWindow, "taskbar");
  for (let attempt = 0; attempt < 3 && !resolveFullscreenExit; attempt += 1) {
    await Promise.resolve();
  }
  assert.equal(typeof resolveFullscreenExit, "function");
  const immersive = intent.toggleWindowPresentation(appWindow, "immersive");

  resolveFullscreenExit();
  await Promise.all([taskbar, immersive]);

  assert.deepEqual(calls, ["fullscreen:false", "fullscreen:true"]);
});

test("does not restore the window while a player element remains fullscreen", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow();

  intent.setIntendedFullscreen(true);

  const restored = await intent.restoreAfterElementFullscreenExit(mockWindow.window, {});

  assert.equal(restored, false);
  assert.deepEqual(mockWindow.calls, []);
});
