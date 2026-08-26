import assert from "node:assert/strict";
import { test } from "node:test";

import {
  restoreSearchResultState,
  searchResultState,
} from "../src/lib/searchResultState.ts";

test("restores the loaded search result page without another request", () => {
  const state = searchResultState([
    { name: "Alpha" },
    { name: "Beta" },
  ], 3, 8);

  assert.deepEqual(restoreSearchResultState(state), {
    result: [{ name: "Alpha" }, { name: "Beta" }],
    currentPage: 3,
    totalPages: 8,
  });
});

test("restores a completed search with no matching titles", () => {
  assert.deepEqual(restoreSearchResultState(searchResultState([], 1, 1)), {
    result: [],
    currentPage: 1,
    totalPages: 1,
  });
});

test("does not treat an unrelated base view state as saved search results", () => {
  assert.equal(restoreSearchResultState({ animeName: "Alpha" }), null);
});
