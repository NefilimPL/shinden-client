import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  defaultSearchFilters,
  filterSearchAnime,
  hasAdvancedSearchFilters,
  searchFilterRequest,
  setSearchTagSelection,
} from "../src/lib/searchFilters.ts";

const anime = (name, anime_type, rating) => ({ name, anime_type, rating });

test("filters search results by minimum rating without discarding missing ratings", () => {
  const results = [
    anime("Alpha", "TV", "8,25"),
    anime("Beta", "Movie", "8.50"),
    anime("Gamma", "TV", "6,00"),
    anime("Delta", "ONA", ""),
  ];

  assert.deepEqual(
    filterSearchAnime(results, { ...defaultSearchFilters, minimumRating: 7 }),
    [results[0], results[1], results[3]],
  );
});

test("builds a Shinden request from active tag selections", () => {
  const filters = {
    ...defaultSearchFilters,
    letter: "A",
    tags: [
      { tagId: 5, mode: "include" },
      { tagId: 39, mode: "exclude" },
    ],
  };

  assert.equal(hasAdvancedSearchFilters(filters), true);
  assert.deepEqual(searchFilterRequest(filters, "  Alpha  "), {
    query: "Alpha",
    genresType: "all",
    letter: "A",
    tags: filters.tags,
  });
});

test("replaces an existing tag selection instead of duplicating it", () => {
  assert.deepEqual(
    setSearchTagSelection([{ tagId: 5, mode: "include" }], 5, "exclude"),
    [{ tagId: 5, mode: "exclude" }],
  );
});

test("homepage loads the Shinden filter catalog only when filters are opened", () => {
  const source = readFileSync("src/routes/+page.svelte", "utf8");

  assert.match(source, /invoke<SearchFilterCatalog>\("get_search_filter_catalog"\)/);
  assert.match(source, /async function toggleSearchFilters\(\)/);
  const onMountBody = source.slice(source.indexOf("onMount("), source.indexOf("function loadViewMode"));
  assert.doesNotMatch(onMountBody, /get_search_filter_catalog/);
});
