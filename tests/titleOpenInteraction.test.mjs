import assert from "node:assert/strict";
import test from "node:test";

import {
  openTitleOnAuxClick,
  openTitleOnMouseDown,
} from "../src/lib/titleOpenInteraction.ts";

test("middle mouse click prevents browser default and opens the title", () => {
  let prevented = false;
  let opened = 0;

  const handled = openTitleOnAuxClick({
    button: 1,
    preventDefault() {
      prevented = true;
    },
  }, () => opened += 1);

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.equal(opened, 1);
});

test("middle mouse down opens the title before WebView auxiliary-click handling", () => {
  let prevented = false;
  let opened = 0;

  const handled = openTitleOnMouseDown({
    button: 1,
    preventDefault() {
      prevented = true;
    },
  }, () => {
      opened += 1;
    });

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.equal(opened, 1);
});

test("other auxiliary clicks do not open a title", () => {
  assert.equal(openTitleOnAuxClick({ button: 2, preventDefault() {} }, () => assert.fail()), false);
});
