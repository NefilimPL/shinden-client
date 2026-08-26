import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("registers advanced search commands in Tauri", () => {
  const source = readFileSync("src-tauri/src/lib.rs", "utf8");

  assert.match(source, /async fn get_search_filter_catalog/);
  assert.match(source, /async fn search_with_filters/);
  assert.match(source, /get_search_filter_catalog,/);
  assert.match(source, /search_with_filters,/);
});
