import assert from "node:assert/strict";
import test from "node:test";

import {
  emptyPlannedNotificationState,
  loadPlannedNotificationState,
  markNotificationsRead,
  nextCheckableTitle,
  recordCheckFailure,
  recordEpisodeSnapshot,
  reconcilePlannedTitles,
} from "../src/lib/plannedEpisodeNotifications.ts";

function planned(overrides = {}) {
  return {
    titleId: 1,
    name: "Alpha",
    url: "https://shinden.pl/series/1",
    image_url: "https://example.test/alpha.jpg",
    watchStatus: "plan",
    active: true,
    releaseDate: null,
    ...overrides,
  };
}

function episode(link, overrides = {}) {
  return {
    title: "Odcinek 1",
    link,
    episodeId: 1,
    episodeNo: 1,
    watched: false,
    viewCount: 0,
    totalEpisodes: null,
    isTrueFinalEpisode: false,
    ...overrides,
  };
}

test("does not schedule a title before its local release day", () => {
  const nowMs = Date.parse("2026-10-01T12:00:00");
  const state = reconcilePlannedTitles(
    emptyPlannedNotificationState(),
    [planned({ releaseDate: "2026-10-02" })],
    nowMs,
  );

  assert.equal(nextCheckableTitle(state, [planned({ releaseDate: "2026-10-02" })], nowMs), null);
});

test("first snapshot establishes a baseline without creating a notification", () => {
  const state = recordEpisodeSnapshot(
    reconcilePlannedTitles(emptyPlannedNotificationState(), [planned()], 1),
    planned(),
    episode("/episode/1"),
    1,
  );

  assert.equal(state.notifications.length, 0);
  assert.equal(state.entries[1].lastEpisodeLink, "/episode/1");
});

test("a changed first unwatched episode creates one unread notification", () => {
  let state = recordEpisodeSnapshot(
    reconcilePlannedTitles(emptyPlannedNotificationState(), [planned()], 1),
    planned(),
    episode("/episode/1"),
    1,
  );
  state = recordEpisodeSnapshot(state, planned(), episode("/episode/2", { title: "Odcinek 2" }), 2);

  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].episodeLink, "/episode/2");
  assert.equal(state.notifications[0].read, false);
});

test("removes titles that are no longer active planned anime", () => {
  const state = reconcilePlannedTitles(
    reconcilePlannedTitles(emptyPlannedNotificationState(), [planned()], 1),
    [planned({ watchStatus: "completed" })],
    2,
  );

  assert.deepEqual(state.entries, {});
});

test("keeps only the newest twenty notifications", () => {
  let state = reconcilePlannedTitles(
    emptyPlannedNotificationState(),
    Array.from({ length: 21 }, (_, index) => planned({ titleId: index + 1, name: `Anime ${index + 1}` })),
    1,
  );

  for (let index = 1; index <= 21; index += 1) {
    const title = planned({ titleId: index, name: `Anime ${index}` });
    state = recordEpisodeSnapshot(state, title, episode(`/episode/${index}`), index);
    state = recordEpisodeSnapshot(state, title, episode(`/episode/${index}-new`), index + 100);
  }

  assert.equal(state.notifications.length, 20);
  assert.equal(state.notifications[0].titleId, 21);
  assert.equal(state.notifications.at(-1)?.titleId, 2);
});

test("uses five seconds after a successful title check", () => {
  const state = recordEpisodeSnapshot(
    reconcilePlannedTitles(emptyPlannedNotificationState(), [planned()], 1),
    planned(),
    episode("/episode/1"),
    100,
  );

  assert.equal(state.entries[1].nextCheckAtMs, 5_100);
});

test("backs off failed checks exponentially and caps the delay", () => {
  let state = reconcilePlannedTitles(emptyPlannedNotificationState(), [planned()], 1);
  state = recordCheckFailure(state, 1, 100);
  assert.equal(state.entries[1].nextCheckAtMs, 5_100);
  state = recordCheckFailure(state, 1, 200);
  assert.equal(state.entries[1].nextCheckAtMs, 10_200);

  for (let index = 0; index < 10; index += 1) {
    state = recordCheckFailure(state, 1, 300);
  }
  assert.equal(state.entries[1].nextCheckAtMs, 1_800_300);
});

test("accepts Polish release dates and marks visible notifications as read", () => {
  const state = reconcilePlannedTitles(
    emptyPlannedNotificationState(),
    [planned({ releaseDate: "02.10.2026" })],
    Date.parse("2026-10-01T12:00:00"),
  );
  assert.equal(nextCheckableTitle(state, [planned({ releaseDate: "02.10.2026" })], Date.parse("2026-10-01T12:00:00")), null);

  let notified = recordEpisodeSnapshot(
    reconcilePlannedTitles(emptyPlannedNotificationState(), [planned()], 1),
    planned(),
    episode("/episode/1"),
    1,
  );
  notified = recordEpisodeSnapshot(notified, planned(), episode("/episode/2"), 2);
  assert.equal(markNotificationsRead(notified).notifications[0].read, true);
});

test("falls back to an empty state for malformed saved data", () => {
  assert.deepEqual(loadPlannedNotificationState("not-json"), emptyPlannedNotificationState());
});
