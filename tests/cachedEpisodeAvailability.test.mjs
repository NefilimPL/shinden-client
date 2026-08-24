import assert from "node:assert/strict";
import test from "node:test";

import { cachedEpisodeAvailabilityForFilter } from "../src/lib/cachedEpisodeAvailability.ts";

const polishAvailability = {
  hasPlayers: true,
  subtitleAvailability: {
    pl: true,
    "pl:human": true,
  },
};

test("uses the saved episode availability with the watchlist subtitle filter", () => {
  const snapshot = { "episode-1": polishAvailability };
  const filter = {
    onlyAvailableUnwatched: true,
    subtitleLanguage: "PL",
    checkSubtitleAvailabilityOnline: true,
    excludeAiSubtitles: true,
  };

  assert.equal(
    cachedEpisodeAvailabilityForFilter(snapshot, "episode-1", false, filter),
    "available",
  );
  assert.equal(
    cachedEpisodeAvailabilityForFilter(snapshot, "episode-1", true, filter),
    "unavailable",
  );
});

test("distinguishes an unknown episode from a cached unavailable episode", () => {
  const filter = {
    onlyAvailableUnwatched: false,
    subtitleLanguage: "PL",
    checkSubtitleAvailabilityOnline: false,
    excludeAiSubtitles: false,
  };

  assert.equal(cachedEpisodeAvailabilityForFilter({}, "missing", false, filter), "unknown");
  assert.equal(
    cachedEpisodeAvailabilityForFilter({ "episode-2": { hasPlayers: false, subtitleAvailability: {} } }, "episode-2", false, filter),
    "unavailable",
  );
});
