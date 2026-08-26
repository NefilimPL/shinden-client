import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  baseViewForPath,
  baseViewForPathWithPreservedState,
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

test("keeps the current search state when saving its updated scroll position", () => {
  const context = baseViewForPathWithPreservedState(
    "/search",
    { id: "search", scrollY: 120, state: { animeName: "Alpha", result: [{ name: "Alpha" }] } },
    640,
  );

  assert.deepEqual(context, {
    id: "search",
    scrollY: 640,
    state: { animeName: "Alpha", result: [{ name: "Alpha" }] },
  });
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

test("search tracks loaded results before saving its base-view state", () => {
  const source = readFileSync("src/routes/search/+page.svelte", "utf8");
  const effect = source.slice(source.indexOf("$effect(() =>"), source.indexOf("function restoreBaseState"));

  assert.match(effect, /const nextState = \{[\s\S]*\.\.\.searchResultState\(result, currentPage, totalPages\)/);
  assert.match(effect, /untrack\(\(\) => titleWorkspace\.saveBaseView\(baseViewForPath\("\/search", nextState, 0\)\)\)/);
});
