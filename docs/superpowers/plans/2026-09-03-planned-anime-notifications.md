# Planned Anime Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a bell and a persistent history of newly available first unwatched episodes for anime in the user's `plan` list, without competing with foreground work.

**Architecture:** The API backend will expose the cached release date with every user-list item. A Svelte notification scheduler persists a small queue in `localStorage`, makes one Tauri call at a time at five-second intervals, and defers titles until their release date. The native shell persists the close-to-tray preference and owns tray actions; the Svelte layout starts/stops the scheduler and the navbar renders its state.

**Tech Stack:** Svelte 5/SvelteKit, TypeScript, Tauri 2.11, Rust, serde, Node test runner, Cargo tests.

**Spec:** `docs/superpowers/specs/2026-09-03-plan-notifications-design.md`

## Global Constraints

- Keep all feature work on the `dev` branch in both repositories.
- Check only one planned title at a time; retain a five-second minimum interval between background checks.
- Never query an episode list before a valid future release date's local calendar day.
- Do not fetch episode players; compare only the first unwatched episode returned by `get_episodes_with_progress`.
- Preserve at most 20 local notifications and deduplicate by title ID plus episode link.
- Pause the notification runner while either existing background-cache refresh reports `running: true`.
- The close-to-tray preference defaults to false; with false, close exits; with true, close hides and the tray menu can explicitly exit.
- Respect `prefers-reduced-motion`; all malformed local state must safely fall back to defaults.

---

## File Structure

| File | Responsibility |
|---|---|
| `F:/_Github/shinden-pl-api-rs/src/client_backend.rs` | Serialize and cache the exact release date in `UserAnimeListItem`. |
| `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs` | Lock down the new frontend JSON contract. |
| `src/lib/plannedEpisodeNotifications.ts` | Pure persisted-state, date, scheduling, deduplication, and history helpers. |
| `src/lib/plannedEpisodeNotificationStore.svelte.ts` | Svelte state and the single-request background runner. |
| `src/lib/NotificationBell.svelte` | Bell button, unread badge, accessible popover, and notification list. |
| `src/lib/ViewMenu.svelte` | Expose the persisted close-to-tray control. |
| `src/lib/types.ts` | Add `releaseDate` to the frontend user-list contract. |
| `src/routes/+layout.svelte` | Start the runner only for a logged-in user and dispose it on teardown. |
| `src/lib/Navbar.svelte` | Mount the bell beside account/update controls. |
| `src-tauri/src/lib.rs` | Persist and apply close-to-tray state, create the tray menu, and add commands. |
| `tests/plannedEpisodeNotifications.test.mjs` | Unit tests for all scheduler decisions and persisted-state transformations. |
| `tests/notificationBell.test.mjs` | Source-level/component contract tests matching the repository's current Svelte test style. |

### Task 1: Expose release dates through the API cache

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/client_backend.rs:292-321, 2813-2834, 3061-3075`
- Modify: `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs:92-143`
- Modify: `src/lib/types.ts:109-126`
- Test: `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs`

**Interfaces:**
- Produces `UserAnimeListItem.release_date: Option<String>` serialized as `releaseDate` and frontend `UserAnimeListItem.releaseDate: string | null`.
- Consumed by `plannedEpisodeNotifications.reconcilePlannedTitles` in Task 2.

- [ ] **Step 1: Write the failing Rust contract assertion**

Add the field to the test fixture and assert the camel-cased JSON key:

```rust
release_date: Some("2026-10-02".to_string()),
// after serializing payload:
assert_eq!(json["items"][0]["releaseDate"], "2026-10-02");
```

- [ ] **Step 2: Run the contract test and verify failure**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml frontend_contract_types_keep_expected_json_shape`

Expected: compilation failure because `UserAnimeListItem` has no `release_date` field.

- [ ] **Step 3: Add and populate the persisted backend property**

In `UserAnimeListItem`, add:

```rust
#[serde(default, rename = "releaseDate")]
pub release_date: Option<String>,
```

In `map_user_anime_list_item`, copy `item.release_date.clone()`. Update every in-repository `UserAnimeListItem { ... }` fixture with `release_date: None`. In `apply_user_anime_details_to_item`, retain an existing API date; only replace an empty value with a normalized `DD.MM.YYYY` value from an `AnimeDetails.information` row whose normalized label is `data emisji` (`YYYY-MM-DD` output).

- [ ] **Step 4: Add the TypeScript contract field**

Add `releaseDate: string | null;` directly after `releaseYear` in `src/lib/types.ts`. Existing cache payloads without the field must be accepted by assigning `null` at the consumer boundary, not by making the new public type optional.

- [ ] **Step 5: Run focused verification**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml frontend_contract_types_keep_expected_json_shape`

Expected: PASS, including `releaseDate` serialization.

- [ ] **Step 6: Commit the API contract change**

```powershell
git -C F:/_Github/shinden-pl-api-rs add -- src/client_backend.rs tests/client_backend_contract.rs
git -C F:/_Github/shinden-pl-api-rs commit -m "feat: expose user-list release dates"
git add -- src/lib/types.ts
git commit -m "feat: add release date to user-list contract"
```

### Task 2: Build and test the persistent scheduler model

**Files:**
- Create: `src/lib/plannedEpisodeNotifications.ts`
- Create: `tests/plannedEpisodeNotifications.test.mjs`

**Interfaces:**
- Consumes `Pick<UserAnimeListItem, "titleId" | "name" | "url" | "image_url" | "releaseDate" | "watchStatus" | "active">` and `EpisodeProgress`.
- Produces `PlannedNotificationState`, `reconcilePlannedTitles(state, titles, nowMs)`, `nextCheckableTitle(state, nowMs)`, `recordEpisodeSnapshot(state, title, episode, nowMs)`, `markNotificationsRead(state)`, `loadPlannedNotificationState(raw)`, and `savePlannedNotificationState(state)`.
- Consumed by the Svelte runner in Task 3 and bell in Task 4.

- [ ] **Step 1: Write failing pure-function tests**

Create tests for all observable rules:

```js
test("does not schedule a title before its local release day", () => {
  const state = reconcilePlannedTitles(emptyState(), [planned({ releaseDate: "2026-10-02" })], Date.parse("2026-10-01T12:00:00"));
  assert.equal(nextCheckableTitle(state, Date.parse("2026-10-01T12:00:00")), null);
});

test("first snapshot establishes a baseline without creating a notification", () => {
  const state = recordEpisodeSnapshot(emptyState(), planned(), episode("/episode/1"), 1);
  assert.equal(state.notifications.length, 0);
});

test("a changed first unwatched episode creates one unread notification", () => {
  let state = recordEpisodeSnapshot(emptyState(), planned(), episode("/episode/1"), 1);
  state = recordEpisodeSnapshot(state, planned(), episode("/episode/2"), 2);
  assert.equal(state.notifications[0].episodeLink, "/episode/2");
  assert.equal(state.notifications[0].read, false);
});
```

Also test malformed JSON fallback, removal when status stops being `plan`, 20-item history trimming, five-second `nextCheckAtMs`, exponential failure delay, date parser support for `YYYY-MM-DD` and `DD.MM.YYYY`, and read marking.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/plannedEpisodeNotifications.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal deterministic state module**

Use the storage key `shinden:planned-episode-notifications:v1`. Define state as:

```ts
type PlannedNotificationState = {
  entries: Record<number, { lastEpisodeLink: string | null; initialized: boolean; nextCheckAtMs: number; failures: number }>;
  cursor: number;
  notifications: PlannedEpisodeNotification[];
};
```

`reconcilePlannedTitles` keeps only active `watchStatus === "plan"` titles. `nextCheckableTitle` rotates from `cursor`, skips entries whose `nextCheckAtMs > nowMs`, and sets a valid future `releaseDate` entry's `nextCheckAtMs` to the start of that local day without fetching it. `recordEpisodeSnapshot` creates a notification only after `initialized` is true and its episode link changes; unshift then slice to 20. `recordCheckFailure` sets `nextCheckAtMs` to `nowMs + min(30 * 60_000, 5_000 * 2 ** failures)`.

- [ ] **Step 4: Run focused tests and static checking**

Run: `node --test tests/plannedEpisodeNotifications.test.mjs; npm run check`

Expected: all scheduler tests pass and Svelte/TypeScript has no error.

- [ ] **Step 5: Commit the model**

```powershell
git add -- src/lib/plannedEpisodeNotifications.ts tests/plannedEpisodeNotifications.test.mjs
git commit -m "feat: add planned episode notification scheduler"
```

### Task 3: Add the cooperative Svelte background runner

**Files:**
- Create: `src/lib/plannedEpisodeNotificationStore.svelte.ts`
- Modify: `src/routes/+layout.svelte:1-34`
- Test: `tests/plannedEpisodeNotifications.test.mjs`

**Interfaces:**
- Consumes Task 2 helpers, `get_user_anime_lists`, `get_episodes_with_progress`, `get_watching_cache_refresh_status`, and `get_user_anime_list_refresh_status`.
- Produces singleton `plannedEpisodeNotificationStore` with `state`, `start()`, `stop()`, `refreshNow()`, and `markRead()`.
- Consumed by `NotificationBell.svelte` in Task 4.

- [ ] **Step 1: Extend the test with runner selection seams**

Export `shouldRunPlannedCheck({ watchingRefreshRunning, userListRefreshRunning, userLoggedIn })`. Add tests that return false whenever either refresh is running and true only for a logged-in idle session.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/plannedEpisodeNotifications.test.mjs`

Expected: FAIL because `shouldRunPlannedCheck` is not exported.

- [ ] **Step 3: Implement one-at-a-time runner behavior**

`start()` must install only one timer. It immediately refreshes the cached user-list payload with `forceRefresh: false`, reconciles titles, then schedules one tick. Every tick must:

```ts
const [watchingStatus, listStatus] = await Promise.all([
  invoke<WatchingCacheRefreshStatus>("get_watching_cache_refresh_status"),
  invoke<UserAnimeListRefreshStatus>("get_user_anime_list_refresh_status"),
]);
if (!shouldRunPlannedCheck({ watchingRefreshRunning: watchingStatus.running, userListRefreshRunning: listStatus.running, userLoggedIn: Boolean(globalStates.user.name) })) return;
```

When idle, select exactly one title, invoke `get_episodes_with_progress` with its `url`, `titleId`, `totalEpisodes: null`, and `titleName`, choose the first `episode.watched === false`, then record the snapshot. Always persist after selection, success, or failure. Schedule the next tick no earlier than five seconds after the current tick completes; on a complete skipped pass use the same interval rather than a busy loop. Do not issue a second title request until the previous promise settles. `stop()` clears timers and makes future completions no-ops.

In `+layout.svelte`, start only after `globalStates.user.name` exists and invoke `stop()` when logout/destroy occurs, parallel to the watchlist background refresh lifecycle.

- [ ] **Step 4: Run tests and type check**

Run: `node --test tests/plannedEpisodeNotifications.test.mjs; npm run check`

Expected: PASS.

- [ ] **Step 5: Commit the runner integration**

```powershell
git add -- src/lib/plannedEpisodeNotificationStore.svelte.ts src/routes/+layout.svelte tests/plannedEpisodeNotifications.test.mjs
git commit -m "feat: check planned anime episodes in background"
```

### Task 4: Render the bell and notification history

**Files:**
- Create: `src/lib/NotificationBell.svelte`
- Modify: `src/lib/Navbar.svelte:1-89`
- Create: `tests/notificationBell.test.mjs`

**Interfaces:**
- Consumes `plannedEpisodeNotificationStore.state`, `plannedEpisodeNotificationStore.markRead()`, and `openAnimeTitle`.
- Produces an accessible `button[aria-label="Powiadomienia"]` and a 20-item popover history.

- [ ] **Step 1: Write a failing component contract test**

```js
const source = readFileSync("src/lib/NotificationBell.svelte", "utf8");
assert.match(source, /aria-label="Powiadomienia"/);
assert.match(source, /notifications\.slice\(0, 20\)/);
assert.match(source, /prefers-reduced-motion/);
assert.match(source, /markRead/);
```

- [ ] **Step 2: Run it and verify failure**

Run: `node --test tests/notificationBell.test.mjs`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component and mount it**

Use a `details.dropdown.dropdown-end` pattern consistent with `ViewMenu.svelte`. The summary is a circular bell SVG button. Compute unread count from `state.notifications`; show a numeric badge only when positive. Add the `notification-pulse` class only with unread items and neutralize its animation inside `@media (prefers-reduced-motion: reduce)`. On toggle-open call `markRead()`. Render image, title, episode title/number, and localized detection time for each `notifications.slice(0, 20)` entry. Clicking a row calls `openAnimeTitle({ titleId, animeName, seriesUrl, animeWatchStatus: "plan", animeIsFavourite: 0, animeTotalEpisodes: null })` and closes the popover. Mount `<NotificationBell />` immediately before `<AccountButton />` in `Navbar.svelte`.

- [ ] **Step 4: Run component and existing UI tests**

Run: `node --test tests/notificationBell.test.mjs tests/viewMenuFullscreen.test.mjs; npm run check`

Expected: PASS.

- [ ] **Step 5: Commit the bell UI**

```powershell
git add -- src/lib/NotificationBell.svelte src/lib/Navbar.svelte tests/notificationBell.test.mjs
git commit -m "feat: show planned episode notifications"
```

### Task 5: Implement close-to-tray preference and native tray controls

**Files:**
- Modify: `src-tauri/src/lib.rs:1-12, 300-360`
- Modify: `src/lib/ViewMenu.svelte:1-83`
- Test: `src-tauri/src/lib.rs` unit-test module
- Test: `tests/notificationBell.test.mjs`

**Interfaces:**
- Produces Tauri commands `get_close_to_tray_enabled() -> Result<bool, String>` and `set_close_to_tray_enabled(enabled: bool) -> Result<(), String>`.
- Produces native `TrayPreferences` app state with persistent `close_to_tray` bool and functions `should_hide_to_tray` and `show_main_window`.
- Consumed by the settings control and Tauri window close event.

- [ ] **Step 1: Write failing native preference tests**

Add pure unit tests:

```rust
#[test]
fn close_to_tray_defaults_to_exiting() {
    assert!(!should_hide_to_tray(false));
}

#[test]
fn close_to_tray_hides_only_when_enabled() {
    assert!(should_hide_to_tray(true));
}
```

Add a source-contract assertion that `ViewMenu.svelte` invokes both native command names and renders `Zamykaj do zasobnika systemowego`.

- [ ] **Step 2: Run tests and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml close_to_tray; node --test tests/notificationBell.test.mjs`

Expected: FAIL because the helper, commands, and control do not yet exist.

- [ ] **Step 3: Implement native persistence, tray, and close interception**

Define serializable `TrayPreferences { close_to_tray: bool }` and managed state backed by `Mutex<TrayPreferences>`. Load/save it as `tray-preferences.json` in Tauri's app-local-data directory; unreadable/missing data returns the default false. Register both commands in `invoke_handler`.

During `.setup`, build a `tauri::menu::Menu` with menu IDs `show` and `quit`, create `TrayIconBuilder::with_id("main")` using `app.default_window_icon()`, and handle `show` by calling `show()` then `set_focus()` on `app.get_webview_window("main")`; handle `quit` with `app.exit(0)`. Add an `on_window_event` handler for `WindowEvent::CloseRequested`: if `should_hide_to_tray(current_preference)` is true, call `api.prevent_close()` and `window.hide()`; otherwise leave the event unmodified so the process exits. Keep the built tray icon alive in application state.

In `ViewMenu.svelte`, load the native boolean in `onMount`; render the checkbox under a new `Aplikacja` separator; its change invokes `set_close_to_tray_enabled` and rolls back the checkbox if the command rejects.

- [ ] **Step 4: Run native and frontend tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml close_to_tray; node --test tests/notificationBell.test.mjs; npm run check`

Expected: PASS.

- [ ] **Step 5: Commit tray support**

```powershell
git add -- src-tauri/src/lib.rs src/lib/ViewMenu.svelte tests/notificationBell.test.mjs
git commit -m "feat: support closing to system tray"
```

### Task 6: Run full verification and review the combined change

**Files:**
- Verify: both repositories' changed files and test suites

**Interfaces:**
- Verifies the frontend/backend `releaseDate` contract, the scheduler, bell, and tray close behavior together.

- [ ] **Step 1: Run all frontend checks**

Run: `npm run check; node --test tests/*.test.mjs`

Expected: all tests pass with no Svelte diagnostics.

- [ ] **Step 2: Run all Rust checks**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml; cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all backend and Tauri tests pass.

- [ ] **Step 3: Inspect final diffs and status**

Run: `git diff --check; git status --short; git -C F:/_Github/shinden-pl-api-rs diff --check; git -C F:/_Github/shinden-pl-api-rs status --short`

Expected: no whitespace errors and only intentional, committed changes.

- [ ] **Step 4: Commit any verification-only correction**

If the verification commands required a code correction, commit exactly those corrected files with a message naming the fixed behavior. If no correction was needed, do not create an empty commit.
