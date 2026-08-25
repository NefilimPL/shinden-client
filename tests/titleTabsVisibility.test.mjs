import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("keeps the title tab rail visible outside an active title route", () => {
  const layout = readFileSync("src/routes/+layout.svelte", "utf8");

  assert.match(
    layout,
    /<TitleTabs \/>\s*\{#if isTitleRoute && titleWorkspace\.activeSession\}/,
  );
});
