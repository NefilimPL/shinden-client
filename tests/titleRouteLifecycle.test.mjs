import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "svelte/compiler";

import {
  createTitleWorkspaceState,
  openTitleSession,
  updateActiveTitleSession,
} from "../src/lib/titleWorkspace.ts";

const source = readFileSync("src/routes/+layout.svelte", "utf8");
const layout = parse(source, { modern: true });

function findKeyBlock(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "KeyBlock") return node;
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = findKeyBlock(child);
      if (found) return found;
    }
  }
  return null;
}

// Evaluate the layout's actual component identity at the navigation boundary.
// Changing this identity before goto() remounts the OLD route with NEW params.
const { expression } = findKeyBlock(layout.fragment);
const keyExpression = source.slice(expression.start, expression.end);

const title = {
  titleId: 50472,
  name: "Devilman: Crybaby",
  imageUrl: "",
  seriesUrl: "https://shinden.pl/titles/50472-devilman-crybaby",
  watchStatus: "in progress",
  isFavourite: 0,
  totalEpisodes: 10,
};

function routeIdentity(state, pathname) {
  return runInNewContext(keyExpression, {
    titleWorkspace: {
      activeTitleId: state.activeTab.titleId,
      activeSession: state.tabs.find(tab => tab.titleId === state.activeTab.titleId),
    },
    page: { url: new URL(pathname, "https://client.test") },
  });
}

for (const [from, to] of [
  ["watching", "players"],
  ["players", "watching"],
  ["watching", "episodes"],
  ["episodes", "players"],
]) {
  test(`saving ${to} context does not remount the current ${from} route before navigation`, () => {
    const opened = openTitleSession(createTitleWorkspaceState(), title).state;
    const before = updateActiveTitleSession(opened, { view: from, playerId: "old-player" });
    const after = updateActiveTitleSession(before, { view: to, playerId: "" });

    assert.equal(routeIdentity(after, `/${from}`), routeIdentity(before, `/${from}`));
  });
}

test("switching titles still remounts the route to load the selected title", () => {
  const before = openTitleSession(createTitleWorkspaceState(), title).state;
  const after = openTitleSession(before, { ...title, titleId: 59922 }).state;

  assert.notEqual(routeIdentity(after, "/episodes"), routeIdentity(before, "/episodes"));
});
