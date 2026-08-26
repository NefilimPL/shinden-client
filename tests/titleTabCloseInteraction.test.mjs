import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../src/lib/titleTabCloseInteraction.ts", import.meta.url);
const closeInteraction = await import(moduleUrl).catch(() => ({}));

test("close control consumes the click and closes its title", () => {
  let prevented = false;
  let stopped = false;
  let closed = 0;

  assert.equal(typeof closeInteraction.closeTitleTabFromControl, "function");

  const handled = closeInteraction.closeTitleTabFromControl({
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      stopped = true;
    },
  }, () => closed += 1);

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(closed, 1);
});
