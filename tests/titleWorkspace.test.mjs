import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activateTitleSession,
  closeTitleSession,
  createTitleWorkspaceState,
  openTitleSession,
  parseWorkspacePreferences,
  saveBaseViewContext,
  setWorkspaceLayout,
  updateActiveTitleSession,
  workspacePreferencesForStorage,
} from "../src/lib/titleWorkspace.ts";

import { titleTabPresentation } from "../src/lib/titleTabPresentation.ts";
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
  assert.deepEqual(reopened.state.activeTab, { kind: "title", titleId: 71632 });
});

test("none layout does not create a title session", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const result = openTitleSession({ ...opened, layout: "none" }, enen).state;

  assert.deepEqual(result.tabs.map((tab) => tab.titleId), [71632]);
  assert.deepEqual(result.activeTab, { kind: "title", titleId: 71632 });
});

test("switching to none layout clears title sessions and selects the base tab", () => {

  const twoTabs = openTitleSession(
    openTitleSession(createTitleWorkspaceState(), kokoore).state,
    enen,
  ).state;
  const hidden = setWorkspaceLayout(activateTitleSession(twoTabs, 71632), "none");

  assert.deepEqual(hidden.tabs, []);
  assert.deepEqual(hidden.activeTab, { kind: "base" });
});
test("closing the active card selects its nearest neighbor and final close empties the workspace", () => {
  const twoTabs = openTitleSession(
    openTitleSession(createTitleWorkspaceState(), kokoore).state,
    enen,
  ).state;
  const afterFirstClose = closeTitleSession(activateTitleSession(twoTabs, 71632), 71632);
  const afterFinalClose = closeTitleSession(afterFirstClose, 59922);

  assert.deepEqual(afterFirstClose.activeTab, { kind: "title", titleId: 59922 });
  assert.deepEqual(afterFinalClose.tabs, []);
  assert.deepEqual(afterFinalClose.activeTab, { kind: "base" });
});

test("closing the final title keeps the last base view context", () => {
  const withBaseView = saveBaseViewContext(createTitleWorkspaceState(), {
    id: "watchlist",
    scrollY: 380,
    state: {},
  });
  const opened = openTitleSession(withBaseView, kokoore).state;
  const closed = closeTitleSession(opened, kokoore.titleId);

  assert.deepEqual(closed.activeTab, { kind: "base" });
  assert.deepEqual(closed.baseView, { id: "watchlist", scrollY: 380, state: {} });
});

test("workspace preferences never include transient title or base sessions", () => {
  const withBaseView = saveBaseViewContext(createTitleWorkspaceState(), {
    id: "watchlist",
    scrollY: 380,
    state: {},
  });
  const state = openTitleSession(withBaseView, kokoore).state;

  assert.deepEqual(workspacePreferencesForStorage(state), {
    layout: "vertical",
    fullscreenPresentation: "immersive",
  });
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

  assert.deepEqual(restored.activeTab, { kind: "title", titleId: 71632 });
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

test("keeps horizontal active card labels visible while compacting inactive cards", () => {
  assert.deepEqual(titleTabPresentation("vertical", false, false), {
    showImage: true,
    showLabel: false,
    showClose: false,
  });
  assert.deepEqual(titleTabPresentation("horizontal", false, true), {
    showImage: true,
    showLabel: false,
    showClose: true,
  });
  assert.deepEqual(titleTabPresentation("horizontal", true, true), {
    showImage: true,
    showLabel: true,
    showClose: true,
  });
});

test("shows the vertical card close control only for the active title", () => {
  assert.equal(titleTabPresentation("vertical", false, false).showClose, false);
  assert.equal(titleTabPresentation("vertical", true, false).showClose, true);
  assert.equal(titleTabPresentation("horizontal", false, false).showClose, true);
});
