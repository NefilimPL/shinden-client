import assert from "node:assert/strict";
import { test } from "node:test";

import { playerLoadErrorMessage } from "../src/lib/playerLoadError.ts";

test("explains a forbidden Shinden player response without exposing its request URL", () => {
  const message = playerLoadErrorMessage(
    "HTTP status client error (403 Forbidden) for url (https://api4.shinden.pl/xhr/1895906/player_show?auth=secret)",
  );

  assert.equal(message, "Shinden odmówił dostępu do odtwarzacza. Wybierz inny serwer lub spróbuj ponownie za chwilę.");
  assert.doesNotMatch(message, /https?:\/\//);
});
