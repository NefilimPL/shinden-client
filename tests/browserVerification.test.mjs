import assert from "node:assert/strict";
import { test } from "node:test";
import { invokeWithVerification } from "../src/lib/browserVerification.ts";

test("a Cloudflare response requests recovery and preserves the original failure", async () => {
  const error = "SHINDEN_BROWSER_VERIFICATION_REQUIRED: challenge";
  let required = false;
  let calls = 0;
  await assert.rejects(invokeWithVerification(async () => {
    calls++;
    throw error;
  }, () => { required = true; }), value => value === error);
  assert.equal(required, true);
  assert.equal(calls, 1, "Never replay writes or credentials automatically");
});

test("ordinary access denial does not trigger a verification loop", async () => {
  let required = false;
  await assert.rejects(invokeWithVerification(async () => {
    throw new Error("403 Forbidden");
  }, () => { required = true; }), /403 Forbidden/);
  assert.equal(required, false);
});

test("successful requests return their payload without opening recovery", async () => {
  let required = false;
  const payload = await invokeWithVerification(async () => ["anime"], () => { required = true; });
  assert.deepEqual(payload, ["anime"]);
  assert.equal(required, false);
});
