import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("player return button contains corrected copy", () => {
  const text = readFileSync("src/routes/watching/+page.svelte", "utf8");
  assert.match(text, /Wróć do anime/);
});
