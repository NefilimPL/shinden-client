import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyUserAnimeListFilters,
  countUserAnimeListStatuses,
  statusCountKey,
  userAnimeListStatusOptions,
} from "../src/lib/userAnimeLists.ts";

function item(overrides = {}) {
  return {
    titleId: 1,
    name: "Alpha",
    url: "https://shinden.pl/series/1",
    image_url: "",
    anime_type: "TV",
    rating: "7,50",
    episodes: "1/12",
    description: "",
    watchStatus: "in progress",
    isFavourite: 0,
    watchedEpisodesCount: 1,
    totalEpisodes: 12,
    releaseYear: 2024,
    tags: ["Akcja"],
    ageRating: "R13+",
    active: true,
    updatedAtMs: 100,
    ...overrides,
  };
}

test("filters user anime lists by title status type and release year", () => {
  const items = [
    item({ titleId: 1, name: "Alpha Fire", anime_type: "TV", watchStatus: "completed", releaseYear: 2024 }),
    item({ titleId: 2, name: "Beta Wind", anime_type: "Movie", watchStatus: "plan", releaseYear: 2022 }),
    item({ titleId: 3, name: "Gamma Fire", anime_type: "TV", watchStatus: "completed", releaseYear: 2018 }),
  ];

  const result = applyUserAnimeListFilters(items, {
    query: "fire",
    status: "completed",
    animeType: "TV",
    releaseYearFrom: 2020,
    releaseYearTo: 2025,
    tag: "",
    excludeTag: false,
    ageRating: "",
    sortKey: "title",
  });

  assert.deepEqual(result.map((anime) => anime.titleId), [1]);
});

test("sorts by numeric rating descending", () => {
  const items = [
    item({ titleId: 1, name: "Lower", rating: "7,10" }),
    item({ titleId: 2, name: "Higher", rating: "8.30" }),
    item({ titleId: 3, name: "Missing", rating: "" }),
  ];

  const result = applyUserAnimeListFilters(items, {
    query: "",
    status: "all",
    animeType: "",
    releaseYearFrom: null,
    releaseYearTo: null,
    tag: "",
    excludeTag: false,
    ageRating: "",
    sortKey: "rating",
  });

  assert.deepEqual(result.map((anime) => anime.titleId), [2, 1, 3]);
});

test("sorts by unwatched progress descending", () => {
  const items = [
    item({ titleId: 1, watchedEpisodesCount: 10, totalEpisodes: 12 }),
    item({ titleId: 2, watchedEpisodesCount: 1, totalEpisodes: 12 }),
    item({ titleId: 3, watchedEpisodesCount: 5, totalEpisodes: null }),
  ];

  const result = applyUserAnimeListFilters(items, {
    query: "",
    status: "all",
    animeType: "",
    releaseYearFrom: null,
    releaseYearTo: null,
    tag: "",
    excludeTag: false,
    ageRating: "",
    sortKey: "progress",
  });

  assert.deepEqual(result.map((anime) => anime.titleId), [2, 1, 3]);
});

test("maps status filters to count keys and labels", () => {
  assert.equal(statusCountKey("in progress"), "inProgress");
  assert.equal(statusCountKey("completed"), "completed");
  assert.equal(statusCountKey("all"), "all");

  assert.deepEqual(
    userAnimeListStatusOptions.map((option) => option.value),
    ["all", "in progress", "completed", "skip", "hold", "dropped", "plan"],
  );
});

test("counts active user anime list statuses", () => {
  const counts = countUserAnimeListStatuses([
    item({ titleId: 1, watchStatus: "in progress", active: true }),
    item({ titleId: 2, watchStatus: "completed", active: true }),
    item({ titleId: 3, watchStatus: "completed", active: true }),
    item({ titleId: 4, watchStatus: "plan", active: false }),
    item({ titleId: 5, watchStatus: "no", active: true }),
  ]);

  assert.equal(counts.inProgress, 1);
  assert.equal(counts.completed, 2);
  assert.equal(counts.plan, 0);
  assert.equal(counts.all, 4);
});

test("filters by tag and age rating when details metadata is cached", () => {
  const items = [
    item({ titleId: 1, tags: ["Komedia", "Fantasy"], ageRating: "R17+" }),
    item({ titleId: 2, tags: ["Dramat"], ageRating: "R13+" }),
    item({ titleId: 3, tags: ["Fantasy"], ageRating: null }),
  ];

  const result = applyUserAnimeListFilters(items, {
    query: "",
    status: "all",
    animeType: "",
    releaseYearFrom: null,
    releaseYearTo: null,
    tag: "Fantasy",
    excludeTag: false,
    ageRating: "R17+",
    sortKey: "title",
  });

  assert.deepEqual(result.map((anime) => anime.titleId), [1]);
});

test("can exclude a selected tag", () => {
  const items = [
    item({ titleId: 1, tags: ["Komedia"] }),
    item({ titleId: 2, tags: ["Dramat"] }),
  ];

  const result = applyUserAnimeListFilters(items, {
    query: "",
    status: "all",
    animeType: "",
    releaseYearFrom: null,
    releaseYearTo: null,
    tag: "Komedia",
    excludeTag: true,
    ageRating: "",
    sortKey: "title",
  });

  assert.deepEqual(result.map((anime) => anime.titleId), [2]);
});
