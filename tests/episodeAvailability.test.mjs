import assert from "node:assert/strict";
import { test } from "node:test";

import { episodeIsAvailableForFilter } from "../src/lib/episodeAvailability.ts";

test("matches player availability against the selected subtitle language", () => {
  const players = [{ lang_subs: "PL" }];
  assert.equal(episodeIsAvailableForFilter(players, { checkSubtitleAvailabilityOnline: true, subtitleLanguage: "PL", excludeAiSubtitles: false }), true);
  assert.equal(episodeIsAvailableForFilter(players, { checkSubtitleAvailabilityOnline: true, subtitleLanguage: "EN", excludeAiSubtitles: false }), false);
});

test("excludes iPL when the AI subtitle filter is enabled", () => {
  const filter = {
    checkSubtitleAvailabilityOnline: true,
    subtitleLanguage: "PL",
    excludeAiSubtitles: true,
  };
  assert.equal(episodeIsAvailableForFilter([{ lang_subs: "iPL" }], filter), false);
  assert.equal(episodeIsAvailableForFilter([{ lang_subs: "iPL" }, { lang_subs: "PL" }], filter), true);
});
