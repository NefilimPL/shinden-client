import assert from "node:assert/strict";
import test from "node:test";

import { createTitleTabCloseController } from "../src/lib/titleTabCloseInteraction.ts";

test("close control consumes its event before requesting a tab close", async () => {
  let prevented = false;
  let stopped = false;
  let closed = 0;
  const controller = createTitleTabCloseController();

  const handled = await controller.close({
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      stopped = true;
    },
  }, 71632, async () => {
    closed += 1;
  });

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(closed, 1);
});

test("close control suppresses a second request while the first is pending", async () => {
  const controller = createTitleTabCloseController();
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const event = { preventDefault() {}, stopPropagation() {} };

  const first = controller.close(event, 71632, async () => {
    calls += 1;
    await pending;
  });
  const second = await controller.close(event, 71632, async () => {
    calls += 1;
  });
  release();
  const firstHandled = await first;

  assert.equal(firstHandled, true);
  assert.equal(second, false);
  assert.equal(calls, 1);
});
