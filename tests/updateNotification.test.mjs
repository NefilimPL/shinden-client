import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compile, compileModule } from "svelte/compiler";
import { render } from "svelte/server";
import ts from "typescript";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

// Keep the real store and button; replace only native IPC and logging.
async function withUpdater(run) {
  const key = `updateNotificationTest${Math.random()}`;
  const native = { result: null, error: null, calls: 0, closed: 0 };
  globalThis[key] = async () => {
    native.calls += 1;
    if (native.error) throw native.error;
    return native.result;
  };
  const source = readFileSync(new URL("../src/lib/updater.svelte.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  }).outputText;
  let compiled = compileModule(js, { filename: "updater.svelte.js", generate: "client" }).js.code;
  compiled = compiled.replace(/(["'])svelte\/internal\/client\1/g, JSON.stringify(import.meta.resolve("svelte/internal/client")));
  const replacements = {
    "./shindenInvoke.ts": moduleUrl("export const invoke = async () => {};"),
    "@tauri-apps/api/event": moduleUrl("export const listen = async () => () => {};"),
    "@tauri-apps/plugin-updater": moduleUrl(`export const check = globalThis[${JSON.stringify(key)}];`),
    "$lib/logs/logs.svelte": moduleUrl("export const log = () => {}; export const LogLevel = { ERROR: 0, INFO: 1 };"),
    "$lib/updateReleases": new URL("../src/lib/updateReleases.ts", import.meta.url).href,
  };
  for (const [from, to] of Object.entries(replacements)) {
    compiled = compiled.replaceAll(JSON.stringify(from), JSON.stringify(to));
  }
  const storeUrl = moduleUrl(compiled);
  const store = await import(storeUrl);
  async function componentHtml(path) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    let js = compile(source, { filename: path, generate: "server" }).js.code;
    js = js.replace(/(["'])(svelte(?:\/[^"']+)?)\1/g, (_, quote, path) => JSON.stringify(import.meta.resolve(path)));
    js = js.replace(/(["'])\$lib\/updater.svelte\1/g, JSON.stringify(storeUrl));
    const { default: Component } = await import(moduleUrl(js));
    return () => render(Component).body;
  }
  const buttonHtml = await componentHtml("../src/lib/logs/UpdateButton.svelte");
  const notificationHtml = await componentHtml("../src/lib/UpdateNotification.svelte");
  function available(body = "- Poprawiono odtwarzanie\n- Dodano powiadomienia") {
    return {
      rid: 1, available: true, currentVersion: "4.0.3", version: "4.0.5",
      date: "2026-10-16T10:00:00Z", body, rawJson: {},
      async close() { native.closed += 1; },
    };
  }
  try {
    await run(store, native, buttonHtml, available, notificationHtml);
  } finally {
    delete globalThis[key];
  }
}

test("the update dot is absent before checking and when no newer version exists", async () => {
  await withUpdater(async (store, native, buttonHtml) => {
    assert.doesNotMatch(buttonHtml(), /class="status\b/);
    assert.equal(await store.checkUpdate(), false);
    assert.equal(store.status.updateState, store.UpdateState.NOT_AVAILABLE);
    assert.equal(store.status.availableUpdate, null);
    assert.doesNotMatch(buttonHtml(), /class="status\b/);
  });
});

test("a confirmed update shows the dot and preserves its version and changelog", async () => {
  await withUpdater(async (store, native, buttonHtml, available) => {
    native.result = available();
    assert.equal(await store.checkUpdate(), true);
    assert.deepEqual({ ...store.status.availableUpdate }, {
      version: "4.0.5", currentVersion: "4.0.3",
      notes: "- Poprawiono odtwarzanie\n- Dodano powiadomienia",
    });
    assert.match(buttonHtml(), /class="status status-success"/);
    assert.equal(store.status.startupUpdate, null, "manual checks must not open the startup dialog");
    assert.equal(native.closed, 1, "release the unused native updater resource");
  });
});

test("startup checks once and dismissing the dialog keeps the update dot", async () => {
  await withUpdater(async (store, native, buttonHtml, available) => {
    native.result = available();
    await Promise.all([store.checkUpdateOnStartup(), store.checkUpdateOnStartup()]);
    assert.equal(native.calls, 1);
    assert.equal(store.status.startupUpdate?.version, "4.0.5");
    assert.equal(store.status.startupUpdate?.notes, "- Poprawiono odtwarzanie\n- Dodano powiadomienia");
    store.dismissStartupUpdate();
    await store.checkUpdateOnStartup();
    assert.equal(store.status.startupUpdate, null);
    assert.equal(native.calls, 1);
    assert.match(buttonHtml(), /class="status status-success"/);
  });
});

test("startup without an update or with a network error shows neither dot nor dialog", async () => {
  for (const error of [null, new Error("offline")]) {
    await withUpdater(async (store, native, buttonHtml) => {
      native.error = error;
      await store.checkUpdateOnStartup();
      assert.equal(store.status.startupUpdate, null);
      assert.equal(store.status.availableUpdate, null);
      assert.doesNotMatch(buttonHtml(), /class="status\b/);
      assert.equal(store.status.updateState, error ? store.UpdateState.ERROR : store.UpdateState.NOT_AVAILABLE);
    });
  }
});

test("a later negative result or error clears previously detected update details", async () => {
  for (const error of [null, new Error("offline")]) {
    await withUpdater(async (store, native, buttonHtml, available) => {
      native.result = available(undefined);
      await store.checkUpdate();
      native.result = null;
      native.error = error;
      if (error) await assert.rejects(store.checkUpdate(), /offline/);
      else await store.checkUpdate();
      assert.equal(store.status.availableUpdate, null);
      assert.doesNotMatch(buttonHtml(), /class="status\b/);
    });
  }
});

for (const script of [
  "<script>alert('test')</script>",
  "<SCRIPT>alert('test')</SCRIPT>",
  '<ScRiPt src="https://example.com/test.js"></ScRiPt>',
  "<script\n type=module>alert('test')</script>",
]) {
  test(`the startup dialog escapes ${JSON.stringify(script)} and links to updates`, async () => {
    await withUpdater(async (store, native, buttonHtml, available, notificationHtml) => {
      native.result = available(`- Poprawiono odtwarzanie\n${script}`);
      await store.checkUpdateOnStartup();
      const html = notificationHtml();
      assert.match(html, /4\.0\.5/);
      assert.match(html, /4\.0\.3/);
      assert.match(html, /- Poprawiono odtwarzanie/);
      assert.doesNotMatch(html, /<script\b/i);
      assert.ok(html.includes(script.replaceAll("&", "&amp;").replaceAll("<", "&lt;")), "notes must remain visible as escaped text");
      assert.match(html, /href="\/info"/);
      store.dismissStartupUpdate();
      assert.doesNotMatch(notificationHtml(), /- Poprawiono odtwarzanie/);
    });
  });
}

test("a release without notes still opens the update notification with a fallback", async () => {
  await withUpdater(async (store, native, buttonHtml, available, notificationHtml) => {
    native.result = available("  \n  ");
    await store.checkUpdateOnStartup();
    assert.equal(store.status.startupUpdate?.notes, "");
    assert.match(notificationHtml(), /Autor wydania nie udostępnił listy zmian/);
  });
});
