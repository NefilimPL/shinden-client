import assert from "node:assert/strict";
import { test } from "node:test";

import * as windowDrag from "../src/lib/windowDrag.ts";
const { shouldStartTouchWindowDrag } = windowDrag;

function targetMatching({ inDragRegion = true, interactive = false, interactiveTag = "" } = {}) {
  return {
    closest(selector) {
      if (selector.includes("data-window-drag-region")) {
        return inDragRegion ? {} : null;
      }

      return interactive || (interactiveTag && selector.split(",").includes(interactiveTag)) ? {} : null;
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

test("mouse and touch use the same window restoration before dragging", () => {
  assert.equal(windowDrag.shouldStartWindowDrag(pointerEvent({ pointerType: "mouse" })), true);
  assert.equal(windowDrag.shouldStartWindowDrag(pointerEvent()), true);
  assert.equal(windowDrag.shouldStartWindowDrag(pointerEvent({ button: 2 })), false);
  assert.equal(windowDrag.shouldStartWindowDrag(pointerEvent({ target: targetMatching({ interactive: true }) })), false);
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

test("menu summaries and checkbox labels remain interactive for mouse dragging", () => {
  for (const interactiveTag of ["summary", "label"]) {
    assert.equal(windowDrag.shouldStartWindowDrag(pointerEvent({
      pointerType: "mouse", target: targetMatching({ interactiveTag }),
    })), false);
  }
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
