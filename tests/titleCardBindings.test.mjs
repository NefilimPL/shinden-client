import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const titleCardSources = [
  "src/lib/DiscoveryAnimeList.svelte",
  "src/routes/search/+page.svelte",
  "src/routes/watchlist/+page.svelte",
  "src/routes/account/lists/+page.svelte",
];

test("title cards use click and auxclick instead of mousedown", () => {
  for (const source of titleCardSources) {
    const text = readFileSync(source, "utf8");
    assert.match(text, /onauxclick=\{\(event\) => handleTitleAuxClick/);
    assert.doesNotMatch(text, /onmousedown=\{\(event\) => handleTitle/);
  }
});

test("related-series cards support background opening", () => {
  const panel = readFileSync("src/lib/AnimeDetailsPanel.svelte", "utf8");
  const episodePage = readFileSync("src/routes/episodes/+page.svelte", "utf8");

  assert.match(panel, /onauxclick=\{\(event\) => openTitleOnAuxClick/);
  assert.match(episodePage, /onOpenRelatedInBackground/);
  assert.match(episodePage, /openAnimeTitleInBackground/);
});
