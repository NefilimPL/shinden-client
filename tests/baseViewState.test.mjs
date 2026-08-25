import assert from "node:assert/strict";
import { test } from "node:test";

import {
  baseViewForPath,
  baseViewLabel,
  baseViewPath,
  normalizedBaseViewContext,
} from "../src/lib/baseViewState.ts";

test("maps seasons state and scroll to a restorable base context", () => {
  const context = baseViewForPath("/seasons", { year: 2026, season: "spring" }, 720);

  assert.deepEqual(context, {
    id: "seasons",
    scrollY: 720,
    state: { year: 2026, season: "spring" },
  });
  assert.equal(baseViewPath(context), "/seasons");
  assert.equal(baseViewLabel(context), "Sezony");
});

test("normalizes invalid base context", () => {
  assert.deepEqual(normalizedBaseViewContext({ id: "invalid", scrollY: -1, state: null }), {
    id: "watchlist",
    scrollY: 0,
    state: {},
  });
});
