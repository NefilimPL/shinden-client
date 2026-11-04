import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "svelte/compiler";
import ts from "typescript";

// Run the actual route loader with only native IPC and its other loaders replaced.
function routeLoader(failEpisodes) {
  const component = readFileSync("src/routes/episodes/+page.svelte", "utf8");
  const { instance } = parse(component, { modern: true });
  const source = component.slice(instance.content.start, instance.content.end);
  const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
  const loader = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "loadEpisodes");
  const js = ts.transpileModule(loader.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
  const calls = [];
  const globalStates = { loadingState: "old" };
  const params = { titleId: 45666, seriesUrl: "https://shinden.pl/series/45666", episodeProgress: [{ title: "stale" }] };
  const run = new Function("invoke", "loadAnimeDetails", "loadEpisodeAvailability", "globalStates", "params", `
    const LoadingState = { LOADING: "loading", OK: "ok", ERROR: "error" };
    const LogLevel = {}; const log = () => {};
    let episodes = [{ title: "stale" }]; let episodesError = null;
    ${js}
    return { loadEpisodes, snapshot: () => ({ episodes, episodesError }) };
  `)(async () => {
    if (failEpisodes) throw new Error("episodes offline");
    return [{ title: "Odcinek 1", link: "/episode/1" }];
  }, async () => { calls.push("details"); }, async () => { calls.push("availability"); }, globalStates, params);
  return { ...run, calls, globalStates, params };
}

test("episode failure still loads the anime description and exposes a retryable error", async () => {
  const route = routeLoader(true);
  await route.loadEpisodes();
  assert.ok(route.calls.includes("details"));
  assert.equal(route.globalStates.loadingState, "ok");
  assert.deepEqual(route.snapshot().episodes, []);
  assert.deepEqual(route.params.episodeProgress, []);
  assert.match(route.snapshot().episodesError, /episodes offline/);
});

test("successful episode loading preserves progress and loads the description", async () => {
  const route = routeLoader(false);
  await route.loadEpisodes();
  assert.equal(route.globalStates.loadingState, "ok");
  assert.equal(route.snapshot().episodes.length, 1);
  assert.deepEqual(route.params.episodeProgress, route.snapshot().episodes);
  assert.equal(route.snapshot().episodesError, null);
  assert.ok(route.calls.includes("details"));
});
