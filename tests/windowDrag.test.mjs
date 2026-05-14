import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldStartTouchWindowDrag } from "../src/lib/windowDrag.ts";

function targetMatching({ inDragRegion = true, interactive = false } = {}) {
  return {
    closest(selector) {
      if (selector.includes("data-tauri-drag-region")) {
        return inDragRegion ? {} : null;
      }

      return interactive ? {} : null;
    }
  };
}

function pointerEvent(overrides = {}) {
  return {
    button: 0,
    defaultPrevented: false,
    isPrimary: true,
    pointerType: "touch",
    target: targetMatching(),
    ...overrides
  };
}

test("starts window dragging for a primary touch on a non-interactive drag region", () => {
  assert.equal(shouldStartTouchWindowDrag(pointerEvent()), true);
});

test("does not start touch window dragging for mouse input", () => {
  assert.equal(shouldStartTouchWindowDrag(pointerEvent({ pointerType: "mouse" })), false);
});

test("does not start touch window dragging from interactive navbar controls", () => {
  assert.equal(
    shouldStartTouchWindowDrag(pointerEvent({ target: targetMatching({ interactive: true }) })),
    false
  );
});

test("does not start touch window dragging outside a drag region", () => {
  assert.equal(
    shouldStartTouchWindowDrag(pointerEvent({ target: targetMatching({ inDragRegion: false }) })),
    false
  );
});

test("does not start touch window dragging for prevented or secondary touch events", () => {
  assert.equal(shouldStartTouchWindowDrag(pointerEvent({ defaultPrevented: true })), false);
  assert.equal(shouldStartTouchWindowDrag(pointerEvent({ isPrimary: false })), false);
});
