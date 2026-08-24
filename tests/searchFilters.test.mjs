import assert from "node:assert/strict";
import { test } from "node:test";

import { filterSearchAnime } from "../src/lib/searchFilters.ts";

const anime = (name, anime_type, rating) => ({ name, anime_type, rating });

test("filters search results by production type and minimum rating", () => {
  const results = [
    anime("Alpha", "TV", "8,25"),
    anime("Beta", "Movie", "8.50"),
    anime("Gamma", "TV", "6,00"),
  ];

  assert.deepEqual(
    filterSearchAnime(results, { animeType: "TV", minimumRating: 7 }),
    [results[0]],
  );
});
