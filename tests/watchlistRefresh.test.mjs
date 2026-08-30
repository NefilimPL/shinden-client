import assert from "node:assert/strict";
import test from "node:test";

import { watchlistFilterWithStoredSettings } from "../src/lib/watchlistRefresh.ts";

test("uses saved watchlist filters instead of stale tab state", () => {
  const staleTabFilter = {
    onlyAvailableUnwatched: false,
    subtitleLanguage: "PL",
    checkSubtitleAvailabilityOnline: false,
    excludeAiSubtitles: false,
  };

  const savedFilter = watchlistFilterWithStoredSettings(JSON.stringify({
    onlyAvailableUnwatched: true,
    subtitleLanguage: "PL",
    checkSubtitleAvailabilityOnline: true,
    excludeAiSubtitles: true,
  }), staleTabFilter);

  assert.deepEqual(savedFilter, {
    onlyAvailableUnwatched: true,
    subtitleLanguage: "PL",
    checkSubtitleAvailabilityOnline: true,
    excludeAiSubtitles: true,
  });
});
