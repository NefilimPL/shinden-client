import assert from "node:assert/strict";
import test from "node:test";

import { closeNavigationTarget } from "../src/lib/titleTabCloseNavigation.ts";

const nextSession = {
  titleId: 59922,
  name: "Enen no Shouboutai",
  imageUrl: "https://cdn.shinden.eu/cdn1/images/genuine/59922.jpg",
  seriesUrl: "https://shinden.pl/series/59922-enen-no-shouboutai",
  watchStatus: "in progress",
  isFavourite: 0,
  totalEpisodes: 12,
  view: "watching",
  playersUrl: "https://example.test/player",
  playerId: "online-77",
  episodeProgress: [],
  currentEpisodeIndex: 3,
};

test("does not navigate after closing an inactive or absent title", () => {
  assert.deepEqual(closeNavigationTarget({
    closed: true,
    wasActive: false,
    nextSession,
  }), { kind: "none" });

  assert.deepEqual(closeNavigationTarget({
    closed: false,
    wasActive: false,
    nextSession,
  }), { kind: "none" });
});

test("navigates to the transition's exact next title session", () => {
  assert.deepEqual(closeNavigationTarget({
    closed: true,
    wasActive: true,
    nextSession,
  }), { kind: "title", session: nextSession });
});

test("navigates to the base view after the final active title closes", () => {
  assert.deepEqual(closeNavigationTarget({
    closed: true,
    wasActive: true,
    nextSession: null,
  }), { kind: "base" });
});
