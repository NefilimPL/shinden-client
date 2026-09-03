import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("notification bell exposes an accessible reduced-motion history panel", () => {
  assert.equal(existsSync("src/lib/NotificationBell.svelte"), true);
  const source = readFileSync("src/lib/NotificationBell.svelte", "utf8");

  assert.match(source, /aria-label="Powiadomienia"/);
  assert.match(source, /notifications\.slice\(0, 20\)/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /markRead/);
});
