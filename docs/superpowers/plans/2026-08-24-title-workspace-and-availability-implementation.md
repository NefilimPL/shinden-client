# Title Workspace and Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make title cards, canonical title URLs, full-screen presentation, and saved episode availability behave deterministically.

**Architecture:** The client keeps one in-memory base-view context alongside transient title sessions. The API resolves and persists canonical title URLs, and stores a complete availability snapshot per title so the episode page derives badges from one saved source of truth.

**Tech Stack:** Svelte 5/SvelteKit, TypeScript, Tauri 2, Node `node:test`, Rust, Tokio, Serde, Reqwest.

**Spec:** `docs/superpowers/specs/2026-08-24-title-workspace-and-availability-design.md`

## Global Constraints

- Work on the existing `dev` branches in `F:\_Github\shinden-client` and `F:\_Github\shinden-pl-api-rs`.
- Never persist title-card sessions or the base view to local storage.
- Do not synthesize a Shinden page URL from a title ID when a canonical URL can be resolved and cached.
- Display unknown availability separately from unavailable availability.
- Keep Polish UI copy as UTF-8 text and use SVG controls for the gear and close icons.
- Each behavior change follows red-green-refactor and is committed with its focused tests.

---

### Task 1: Add the transient base-view session to the workspace

**Files:**
- Modify: `src/lib/titleWorkspace.ts`
- Modify: `src/lib/titleWorkspace.svelte.ts`
- Modify: `src/lib/titleNavigation.ts`
- Modify: `src/routes/+layout.svelte`
- Test: `tests/titleWorkspace.test.mjs`

**Interfaces:**
- Consumes: `TitleWorkspaceState`, `openTitleSession`, `closeTitleSession`, and `titleWorkspace`.
- Produces: `BaseViewContext`, `saveBaseViewContext`, and `closeTitleSession` results that can restore the base route after the final title closes.

- [ ] **Step 1: Write the failing workspace tests**

```js
test("closing the final title restores the last base view context", () => {
  const withBase = saveBaseViewContext(createTitleWorkspaceState(), {
    path: "/watchlist",
    scrollY: 380,
  });
  const opened = openTitleSession(withBase, kokoore).state;
  const closed = closeTitleSession(opened, kokoore.titleId);

  assert.equal(closed.activeTitleId, null);
  assert.deepEqual(closed.baseView, { path: "/watchlist", scrollY: 380 });
});

test("opening titles never serializes base or title sessions as preferences", () => {
  const state = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  assert.deepEqual(workspacePreferencesForStorage(state), {
    layout: "vertical",
    fullscreenPresentation: "immersive",
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/titleWorkspace.test.mjs`

Expected: FAIL because the base-view API and preference serializer do not exist.

- [ ] **Step 3: Implement the minimal workspace state**

```ts
export type BaseViewContext = {
    path: "/" | "/watchlist";
    scrollY: number;
};

export type TitleWorkspaceState = TitleWorkspacePreferences & {
    baseView: BaseViewContext;
    tabs: TitleSession[];
    activeTitleId: number | null;
};

export function saveBaseViewContext(
    state: TitleWorkspaceState,
    baseView: BaseViewContext,
): TitleWorkspaceState {
    return { ...state, baseView };
}
```

Capture only `/` and `/watchlist` before title navigation. After the final title close, route to `baseView.path`, then restore `window.scrollTo({ top: baseView.scrollY })` after SvelteKit has rendered the base route. Keep `savePreferences` limited to layout and fullscreen presentation.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/titleWorkspace.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the workspace state change**

```powershell
git add -- src/lib/titleWorkspace.ts src/lib/titleWorkspace.svelte.ts src/lib/titleNavigation.ts src/routes/+layout.svelte tests/titleWorkspace.test.mjs
git commit -m "feat: restore the last base view after closing title tabs"
```

### Task 2: Correct title-tab controls, layering, mouse behavior, and taskbar presentation

**Files:**
- Modify: `src/lib/TitleTabs.svelte`
- Modify: `src/lib/ViewMenu.svelte`
- Modify: `src/lib/Console.svelte`
- Modify: `src/lib/titleTabPresentation.ts`
- Modify: `src/lib/windowFullscreenIntent.ts`
- Modify: `src-tauri/capabilities/default.json`
- Modify: title-opening components found by `rg -l "openAnimeTitle" src`
- Test: `tests/titleWorkspace.test.mjs`
- Test: `tests/fullscreenIntent.test.mjs`

**Interfaces:**
- Consumes: `titleWorkspace.open`, `openAnimeTitle`, `TitleTabPresentation`, and Tauri `WebviewWindow` methods.
- Produces: `openAnimeTitleFromAuxClick(event, input)` and a taskbar presentation that calls `setFullscreen(false)` before `maximize` or `unmaximize`.

- [ ] **Step 1: Write failing presentation and fullscreen tests**

```js
test("vertical tabs expose the close control only for the active tab", () => {
  assert.equal(titleTabPresentation("vertical", false, false).showClose, false);
  assert.equal(titleTabPresentation("vertical", true, false).showClose, true);
});

test("taskbar presentation exits fullscreen before maximizing", async () => {
  const calls = [];
  await createWindowFullscreenIntent().toggleWindowPresentation({
    async isFullscreen() { return true; },
    async setFullscreen(value) { calls.push(`fullscreen:${value}`); },
    async isMaximized() { return false; },
    async maximize() { calls.push("maximize"); },
    async unmaximize() { calls.push("unmaximize"); },
  }, "taskbar");
  assert.deepEqual(calls, ["fullscreen:false", "maximize"]);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `node --test tests/titleWorkspace.test.mjs tests/fullscreenIntent.test.mjs`

Expected: FAIL because `showClose` and the fullscreen transition contract are absent.

- [ ] **Step 3: Implement controls and mouse opening**

Add `showClose` to `TitleTabPresentation`; render the small inline SVG close button only when it is true. Render the gear as SVG in `ViewMenu.svelte`, fix the visible Polish labels, and lower the tab rail below the console overlay.

Extract an auxiliary-click handler that only handles `event.button === 1`, calls `event.preventDefault()`, and invokes `openAnimeTitle(input)`. Attach it to all existing cards, rows, and episode-open controls that already use `openAnimeTitle`.

Add `core:window:allow-maximize` and `core:window:allow-unmaximize` to the Tauri capability. Keep the taskbar path in `toggleWindowPresentation` as: exit fullscreen when needed, then inspect maximization and toggle it.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `node --test tests/titleWorkspace.test.mjs tests/fullscreenIntent.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the client-control change**

```powershell
git add -- src/lib/TitleTabs.svelte src/lib/ViewMenu.svelte src/lib/Console.svelte src/lib/titleTabPresentation.ts src/lib/windowFullscreenIntent.ts src-tauri/capabilities/default.json src tests/titleWorkspace.test.mjs tests/fullscreenIntent.test.mjs
git commit -m "fix: make title controls and taskbar presentation reliable"
```

### Task 3: Resolve and persist canonical Shinden URLs in the API

**Files:**
- Modify: `F:\_Github\shinden-pl-api-rs\src\client.rs`
- Modify: `F:\_Github\shinden-pl-api-rs\src\details.rs`
- Modify: `F:\_Github\shinden-pl-api-rs\src\episodes.rs`
- Modify: `F:\_Github\shinden-pl-api-rs\src\client_backend.rs`
- Test: `F:\_Github\shinden-pl-api-rs\tests\client_backend_contract.rs`
- Test: `F:\_Github\shinden-pl-api-rs\src\episodes.rs`

**Interfaces:**
- Consumes: `ShindenAPI::search_anime`, `WatchingListApiItem`, and `UserAnimeListItem`.
- Produces: `resolve_canonical_title_url(api, title_id, name) -> Result<String, String>` and canonical URLs stored on cached user-list rows.

- [ ] **Step 1: Write failing canonical-URL tests**

```rust
#[test]
fn selects_the_matching_canonical_url_for_bye_bye_earth_second_season() {
    let results = vec![
        anime_fixture("https://shinden.pl/series/69862-bye-bye-earth"),
        anime_fixture("https://shinden.pl/series/68581-bye-bye-earth-2nd-season"),
    ];

    assert_eq!(
        select_canonical_title_url(68581, results).as_deref(),
        Some("https://shinden.pl/series/68581-bye-bye-earth-2nd-season"),
    );
}

#[test]
fn resolves_short_title_paths_before_building_episode_paths() {
    assert!(requires_title_url_resolution("https://shinden.pl/titles/68581"));
    assert!(requires_title_url_resolution("https://shinden.pl/series/68581"));
}
```

- [ ] **Step 2: Run focused Cargo tests to verify they fail**

Run: `cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml canonical_url resolves_short_title_paths`

Expected: FAIL because canonical selection and `/titles/` short-path detection do not exist.

- [ ] **Step 3: Implement canonical URL resolution**

```rust
fn select_canonical_title_url(title_id: u64, results: Vec<Anime>) -> Option<String> {
    results.into_iter().find_map(|anime| {
        (title_id_from_series_url(&anime.url).as_deref() == Some(&title_id.to_string()))
            .then_some(anime.url)
    })
}
```

Resolve title-list rows through `search_anime(&item.title)` and select only a URL whose parsed ID equals `item.title_id`. Persist that URL to `UserAnimeListItem.url`. `get_watching_anime` loads the user-list cache and maps each live `WatchingListApiItem` through its cached canonical URL, falling back to a named unresolved state only when no cached URL exists. Short `/series/{id}` and `/titles/{id}` paths must be resolved before adding `/episodes`.

- [ ] **Step 4: Run focused Cargo tests to verify they pass**

Run: `cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml canonical_url resolves_short_title_paths`

Expected: PASS.

- [ ] **Step 5: Commit the API URL change**

```powershell
Set-Location F:\_Github\shinden-pl-api-rs
git add -- src/client.rs src/details.rs src/episodes.rs src/client_backend.rs tests/client_backend_contract.rs
git commit -m "fix: persist canonical title URLs for user lists"
```

### Task 4: Store complete episode-availability snapshots in the API

**Files:**
- Modify: `F:\_Github\shinden-pl-api-rs\src\client_backend.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `F:\_Github\shinden-pl-api-rs\src\client_backend.rs`

**Interfaces:**
- Consumes: `Episode`, `Player`, `WatchingAnimeFilter`, and `WatchingAvailabilityCacheEntry`.
- Produces: `CachedEpisodeAvailability`, `get_cached_episode_availability(title_id)`, and a complete title scan rather than a first-playable-episode scan.

- [ ] **Step 1: Write failing snapshot tests**

```rust
#[test]
fn cached_snapshot_retains_availability_for_every_episode() {
    let snapshot = build_cached_episode_snapshot(vec![
        episode_availability("/episode/1", ["PL"]),
        episode_availability("/episode/2", std::iter::empty()),
    ]);

    assert_eq!(snapshot.episodes.len(), 2);
    assert!(snapshot.episodes["/episode/1"].has_players);
    assert!(!snapshot.episodes["/episode/2"].has_players);
}

#[test]
fn missing_snapshot_is_unknown_not_unavailable() {
    assert_eq!(cached_episode_filter_match(None, "episode/1", &filter()), None);
}
```

- [ ] **Step 2: Run focused Cargo tests to verify they fail**

Run: `cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml cached_snapshot missing_snapshot`

Expected: FAIL because the cache only holds a title-level boolean.

- [ ] **Step 3: Implement the complete cache and command**

```rust
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct CachedEpisodeAvailability {
    has_players: bool,
    subtitle_availability: HashMap<String, bool>,
}
```

Extend `WatchingAvailabilityCacheEntry` with `episodes: HashMap<String, CachedEpisodeAvailability>`. Scan every episode, derive the title summary after scanning, and preserve `checked_at_ms`. Add `ShindenClientBackend::get_cached_episode_availability(title_id, watched_episodes_count, total_episodes)` that returns `Option<HashMap<String, CachedEpisodeAvailability>>` only when the cache entry still matches the requested progress and total. Register a thin `#[tauri::command]` wrapper in `src-tauri/src/lib.rs` and include it in `tauri::generate_handler!`. A cache miss returns `None`; it never returns a synthetic all-false map.

- [ ] **Step 4: Run focused Cargo tests to verify they pass**

Run: `cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml cached_snapshot missing_snapshot`

Expected: PASS.

- [ ] **Step 5: Commit the availability-cache API change**

```powershell
Set-Location F:\_Github\shinden-pl-api-rs
git add -- src/client_backend.rs

git commit -m "feat: cache availability for every watchlist episode"

Set-Location F:\_Github\shinden-client
git add -- src-tauri/src/lib.rs
git commit -m "feat: expose saved episode availability to the client"
```

### Task 5: Render cache-backed availability on the episode page

**Files:**
- Create: `src/lib/cachedEpisodeAvailability.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/routes/episodes/+page.svelte`
- Modify: `src/lib/watchlistRefresh.ts`
- Test: `tests/cachedEpisodeAvailability.test.mjs`

**Interfaces:**
- Consumes: the API cached-availability command and `WatchlistRefreshFilter`.
- Produces: `episodeAvailabilityState(snapshot, episode, filter): "available" | "unavailable" | "unknown"`.

- [ ] **Step 1: Write the failing badge-state test**

```js
test("returns unknown when no saved snapshot exists", () => {
  assert.equal(episodeAvailabilityState(null, "episode/5", defaultFilter), "unknown");
});

test("uses saved subtitle variants without issuing player requests", () => {
  const snapshot = { "episode/5": { hasPlayers: true, subtitleAvailability: { pl: true } } };
  assert.equal(episodeAvailabilityState(snapshot, "episode/5", defaultFilter), "available");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/cachedEpisodeAvailability.test.mjs`

Expected: FAIL because the state helper and cache type do not exist.

- [ ] **Step 3: Implement cache-first page loading**

```ts
export function episodeAvailabilityState(snapshot, episodeUrl, filter) {
    const entry = snapshot?.[episodeUrl];
    if (!entry) return "unknown";
    return episodeIsAvailableForFilter(entry, filter) ? "available" : "unavailable";
}
```

After loading episode progress, request the saved title snapshot. If it is absent, invoke the existing single-title cache refresh once, then load the saved snapshot. Render `Sprawdzam` while that request runs and `Nie sprawdzono` for a failed or missing entry. Remove the page-level `Promise.all(...get_players...)` fan-out.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/cachedEpisodeAvailability.test.mjs tests/episodeAvailability.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the cache-backed episode UI**

```powershell
git add -- src/lib/cachedEpisodeAvailability.ts src/lib/types.ts src/routes/episodes/+page.svelte src/lib/watchlistRefresh.ts tests/cachedEpisodeAvailability.test.mjs
git commit -m "feat: show saved episode availability consistently"
```

### Task 6: Read MPAA age ratings into user-list filters

**Files:**
- Modify: `F:\_Github\shinden-pl-api-rs\src\client_backend.rs`
- Test: `F:\_Github\shinden-pl-api-rs\src\client_backend.rs`

**Interfaces:**
- Consumes: `AnimeDetails.information`.
- Produces: `anime_detail_age_rating` values for labels `MPAA`, `Kategoria wiekowa`, and `Wiek`.

- [ ] **Step 1: Write the failing parser test**

```rust
#[test]
fn extracts_age_rating_from_mpaa_metadata() {
    let details = AnimeDetails {
        information: vec![AnimeInfoRow {
            label: "MPAA:".to_string(),
            value: "PG-13".to_string(),
        }],
        ..AnimeDetails::default()
    };

    assert_eq!(anime_detail_age_rating(&details).as_deref(), Some("PG-13"));
}
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml extracts_age_rating_from_mpaa_metadata`

Expected: FAIL because `anime_detail_age_rating` currently checks only labels containing `wiek`.

- [ ] **Step 3: Implement MPAA recognition**

```rust
let label = row.label.trim_end_matches(':').trim().to_ascii_lowercase();
label.contains("wiek") || label == "mpaa" || label.contains("age rating")
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml extracts_age_rating_from_mpaa_metadata`

Expected: PASS.

- [ ] **Step 5: Commit the metadata parser change**

```powershell
Set-Location F:\_Github\shinden-pl-api-rs
git add -- src/client_backend.rs
git commit -m "fix: populate age filters from MPAA metadata"
```

### Task 7: Run integration verification and build the desktop app

**Files:**
- Verify only: client and API working trees.

**Interfaces:**
- Consumes: all changes from Tasks 1–6.
- Produces: fresh test and build evidence for the two `dev` branches.

- [ ] **Step 1: Run the complete client test suite and checks**

Run: `npm.cmd test; npm.cmd run check`

Expected: all Node tests pass and Svelte check has no errors.

- [ ] **Step 2: Run the complete API test suite**

Run: `cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml`

Expected: all Rust tests pass.

- [ ] **Step 3: Build the actual desktop artifact from local API dev**

Run: `python scripts\build_exe.py --skip-install --backend-branch dev --no-copy`

Expected: logs show `Using local backend source: F:\_Github\shinden-pl-api-rs` and Tauri finishes the EXE and installers.

- [ ] **Step 4: Inspect final worktree states**

Run: `git status --short` in both repositories and `git diff --check` in both repositories.

Expected: only deliberate, committed changes; no temporary Cargo manifest, lockfile, or cache-backup modifications.
