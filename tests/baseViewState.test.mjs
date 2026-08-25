import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("base-view state effects do not track their own store writes", () => {
  for (const source of [
    "src/routes/watchlist/+page.svelte",
    "src/routes/search/+page.svelte",
    "src/routes/account/lists/+page.svelte",
    "src/routes/seasons/+page.svelte",
  ]) {
    const text = readFileSync(source, "utf8");
    assert.match(text, /untrack\(\(\) => titleWorkspace\.saveBaseView/);
  }
});
