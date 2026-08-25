import assert from "node:assert/strict";
import { test } from "node:test";

import {
  closeTitleSession,
  createTitleWorkspaceState,
  openTitleSession,
  setWorkspaceLayout,
} from "../src/lib/titleWorkspace.ts";

const firstTitle = {
  titleId: 71632,
  name: "Kokoore",
  imageUrl: "https://cdn.shinden.eu/cdn1/images/genuine/71632.jpg",
  seriesUrl: "https://shinden.pl/series/71632-kokoore",
  watchStatus: "in progress",
  isFavourite: 0,
  totalEpisodes: 12,
};

const secondTitle = {
  ...firstTitle,
  titleId: 59922,
  name: "Enen no Shouboutai",
  seriesUrl: "https://shinden.pl/series/59922-enen-no-shouboutai",
};

test("keeps the base tab selected when a title opens in the background", () => {
  const state = openTitleSession(createTitleWorkspaceState(), firstTitle, false).state;

  assert.deepEqual(state.activeTab, { kind: "base" });
  assert.deepEqual(state.tabs.map((tab) => tab.titleId), [71632]);
});

test("returns to the base tab after closing the final title", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), firstTitle, true).state;
  const closed = closeTitleSession(opened, firstTitle.titleId);

  assert.deepEqual(closed.activeTab, { kind: "base" });
  assert.deepEqual(closed.tabs, []);
});

test("does not create title tabs while the workspace layout is none", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), firstTitle, true).state;
  const hidden = setWorkspaceLayout(opened, "none");
  const attempted = openTitleSession(hidden, secondTitle, true).state;

  assert.deepEqual(hidden.tabs, []);
  assert.deepEqual(attempted.tabs, []);
  assert.deepEqual(attempted.activeTab, { kind: "base" });
});
