import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  openTitleOnAuxClick,
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

test("uses auxclick rather than mousedown for title interactions", () => {
  const source = readFileSync("src/lib/titleOpenInteraction.ts", "utf8");
  assert.doesNotMatch(source, /openTitleOnMouseDown/);
});

test("other auxiliary clicks do not open a title", () => {
  assert.equal(openTitleOnAuxClick({ button: 2, preventDefault() {} }, () => assert.fail()), false);
});
