import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileModule } from "svelte/compiler";
import ts from "typescript";

// Compile the real rune store; replace only the native IPC boundary and browser storage/timers.
async function withStore(options, run) {
  const title = {
    titleId: 1, name: "Alpha", url: "https://shinden.pl/series/1", image_url: "",
    watchStatus: "plan", active: true, releaseDate: null,
    anime_type: "TV", rating: "", episodes: "0/12", description: "", isFavourite: 0,
    watchedEpisodesCount: 0, totalEpisodes: 12, releaseYear: null, tags: [], ageRating: null, updatedAtMs: 0,
  };
  const stored = new Map();
  const timers = new Map();
  let timerId = 0;
  let episodes = options.initialEpisodes ?? [];
  const calls = [];
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  const key = `plannedNotificationTest${Math.random()}`;
  globalThis[key] = async (command) => {
    calls.push(command);
    switch (command) {
      case "get_user_anime_lists": return {
        items: [title], counts: { inProgress: 0, completed: 0, skip: 0, hold: 0, dropped: 0, plan: 1, all: 1 },
        refreshedAtMs: 0, syncError: null,
      };
      case "get_watching_cache_refresh_status": return {
        running: false, current: 0, total: 0, refreshed: 0, skipped: 0, failed: 0,
        currentTitle: "", lastFinishedAtMs: null, failures: [], lastError: null,
      };
      case "get_user_anime_list_refresh_status": return {
        running: false, current: 0, total: 0, remaining: 0, refreshed: 0, failed: 0,
        currentTitle: "", lastFinishedAtMs: null, lastError: null,
      };
      case "get_episodes_with_progress": return episodes;
      case "get_anime_details":
        if (options.statusError) throw new Error("offline");
        return {
          titleId: options.detailsTitleId ?? 1, watchStatus: options.watchStatus ?? "plan", userStatusLoaded: options.statusLoaded ?? true,
          titleType: "Anime", name: "Alpha", alternativeTitles: [], imageUrl: "", description: "",
          information: [], categories: [], relatedSeries: [], isFavourite: 0,
          communityRating: { overall: "", votes: "", story: "", graphics: "", music: "", characters: "" },
          userRatings: { story: 0, graphics: 0, music: 0, characters: 0, overall: 0 },
        };
      default: throw new Error(`Unexpected command: ${command}`);
    }
  };
  globalThis.window = {
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  globalThis.localStorage = {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) { stored.set(key, value); },
  };
  const source = readFileSync(new URL("../src/lib/plannedEpisodeNotificationStore.svelte.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
  let compiled = compileModule(js, { filename: "plannedEpisodeNotificationStore.svelte.js", generate: "client" }).js.code;
  compiled = compiled.replace(/(["'])svelte\/internal\/client\1/g, JSON.stringify(import.meta.resolve("svelte/internal/client")));
  compiled = compiled.replace(/(["'])\.\/shindenInvoke\.ts\1/g, JSON.stringify(`data:text/javascript,export const invoke = globalThis[${JSON.stringify(key)}]`));
  compiled = compiled.replace(/(["'])\$lib\/([^"']+)\1/g, (_, quote, path) => JSON.stringify(new URL(`../src/lib/${path}.ts`, import.meta.url).href));
  const { plannedEpisodeNotificationStore: store } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  async function tick() {
    const [id, callback] = timers.entries().next().value;
    timers.delete(id);
    callback();
    await settle();
  }
  try {
    store.start();
    await settle();
    await tick(); // Establish the pre-premiere baseline.
    episodes = (options.episodes ?? [{ title: "Odcinek 1", link: "/episode/1", episodeNo: 1, watched: false }])
      .map((episode) => ({ episodeId: episode.episodeNo, viewCount: 0, totalEpisodes: 12, isTrueFinalEpisode: false, ...episode }));
    // Make the next check due without depending on wall-clock delays.
    store.state.entries[1].nextCheckAtMs = 0;
    await tick();
    await run(store, calls);
  } finally {
    store.stop();
    globalThis.window = previousWindow;
    globalThis.localStorage = previousStorage;
    delete globalThis[key];
  }
}

test("a cached planned title whose live status changed does not create a premiere alert", async () => {
  for (const watchStatus of ["in progress", "completed", "hold", "skip", "dropped", "no"]) {
    await withStore({ watchStatus }, (store) => {
      assert.deepEqual(store.state.notifications, []);
      assert.equal(store.state.entries[1], undefined);
    });
  }
});

test("a premiere is notified when its live status is still planned", async () => {
  await withStore({}, (store, calls) => {
    assert.equal(store.state.notifications.length, 1);
    assert.equal(store.state.notifications[0].episodeNo, 1);
    assert.equal(calls.filter((command) => command === "get_anime_details").length, 1);
  });
});

test("an unavailable live status postpones the alert without consuming the premiere", async () => {
  for (const options of [{ statusLoaded: false }, { statusError: true }, { detailsTitleId: 2 }]) {
    await withStore(options, (store) => {
      assert.deepEqual(store.state.notifications, []);
      assert.equal(store.state.entries[1].lastEpisodeLink, null);
      assert.equal(store.state.entries[1].failures, 1);
    });
  }
});

test("watching the first episode cannot turn the second episode into a premiere", async () => {
  await withStore({ episodes: [
    { title: "Odcinek 1", link: "/episode/1", episodeNo: 1, watched: true },
    { title: "Odcinek 2", link: "/episode/2", episodeNo: 2, watched: false },
  ] }, (store) => {
    assert.deepEqual(store.state.notifications, []);
    assert.equal(store.state.entries[1].lastEpisodeLink, "/episode/1");
  });
});

test("a prologue episode zero does not consume the later episode one premiere", async () => {
  const prologue = {
    title: "Odcinek 0", link: "/episode/0", episodeNo: 0, watched: false,
    episodeId: 10, viewCount: 0, totalEpisodes: 12, isTrueFinalEpisode: false,
  };
  await withStore({ initialEpisodes: [prologue], episodes: [
    prologue,
    { title: "Odcinek 1", link: "/episode/1", episodeNo: 1, watched: false },
  ] }, (store) => {
    assert.equal(store.state.notifications.length, 1);
    assert.equal(store.state.notifications[0].episodeNo, 1);
  });
});
