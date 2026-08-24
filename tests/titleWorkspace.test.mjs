import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activateTitleSession,
  closeTitleSession,
  createTitleWorkspaceState,
  openTitleSession,
  parseWorkspacePreferences,
  updateActiveTitleSession,
} from "../src/lib/titleWorkspace.ts";

const kokoore = {
  titleId: 71632,
  name: "Kokoore",
  imageUrl: "https://cdn.shinden.eu/cdn1/images/genuine/71632.jpg",
  seriesUrl: "https://shinden.pl/series/71632-kokoore",
  watchStatus: "in progress",
  isFavourite: 0,
  totalEpisodes: 12,
};

const enen = {
  ...kokoore,
  titleId: 59922,
  name: "Enen no Shouboutai",
  seriesUrl: "https://shinden.pl/series/59922-enen-no-shouboutai",
};

test("activates an already open title without duplicating its card", () => {
  const first = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const second = openTitleSession(first, enen).state;
  const reopened = openTitleSession(second, kokoore);

  assert.equal(reopened.created, false);
  assert.deepEqual(reopened.state.tabs.map((tab) => tab.titleId), [71632, 59922]);
  assert.equal(reopened.state.activeTitleId, 71632);
});

test("none layout replaces the active title session", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const result = openTitleSession({ ...opened, layout: "none" }, enen).state;

  assert.deepEqual(result.tabs.map((tab) => tab.titleId), [59922]);
  assert.equal(result.activeTitleId, 59922);
});

test("closing the active card selects its nearest neighbor and final close empties the workspace", () => {
  const twoTabs = openTitleSession(
    openTitleSession(createTitleWorkspaceState(), kokoore).state,
    enen,
  ).state;
  const afterFirstClose = closeTitleSession({ ...twoTabs, activeTitleId: 71632 }, 71632);
  const afterFinalClose = closeTitleSession(afterFirstClose, 59922);

  assert.equal(afterFirstClose.activeTitleId, 59922);
  assert.deepEqual(afterFinalClose.tabs, []);
  assert.equal(afterFinalClose.activeTitleId, null);
});

test("invalid persisted view preferences use the documented defaults", () => {
  assert.deepEqual(
    parseWorkspacePreferences('{"layout":"diagonal","fullscreenPresentation":"borderless"}'),
    { layout: "vertical", fullscreenPresentation: "immersive" },
  );
});

test("restores the selected title session including its player subview", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const player = updateActiveTitleSession(opened, {
    view: "watching",
    playerId: "online-77",
    currentEpisodeIndex: 3,
  });
  const withOther = openTitleSession(player, enen).state;
  const restored = activateTitleSession(withOther, 71632);

  assert.equal(restored.activeTitleId, 71632);
  assert.equal(restored.tabs[0].view, "watching");
  assert.equal(restored.tabs[0].playerId, "online-77");
  assert.equal(restored.tabs[0].currentEpisodeIndex, 3);
});

test("returns a player session to episodes without changing its title context", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const player = updateActiveTitleSession(opened, {
    view: "watching",
    playerId: "online-77",
    currentEpisodeIndex: 3,
  });
  const episodes = updateActiveTitleSession(player, { view: "episodes" });

  assert.equal(episodes.tabs[0].view, "episodes");
  assert.equal(episodes.tabs[0].titleId, 71632);
  assert.equal(episodes.tabs[0].seriesUrl, kokoore.seriesUrl);
  assert.equal(episodes.tabs[0].currentEpisodeIndex, 3);
});
