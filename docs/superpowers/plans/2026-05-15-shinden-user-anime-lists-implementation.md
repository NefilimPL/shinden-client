# Shinden User Anime Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cached browser for the logged-in user's main Shinden anime lists with local filters and a manual metadata refresh.

**Architecture:** The Rust backend will add a persistent user-list cache and expose it through a new Tauri command. The Svelte frontend will render a dedicated account list route, filter cached items locally, and reuse the existing episode navigation and status update behavior.

**Tech Stack:** Rust, serde, reqwest, Tauri commands, Svelte 5, TypeScript, Tailwind/DaisyUI.

---

## File Structure

- Modify `F:/_Github/shinden-pl-api-rs/src/client_backend.rs`: add cache structs, merge helpers, command methods, and tests.
- Modify `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs`: add JSON contract coverage for the new list payload.
- Modify `src-tauri/src/lib.rs`: expose backend methods as Tauri commands.
- Modify `src/lib/types.ts`: add frontend types for user anime lists and filters.
- Create `src/lib/userAnimeLists.ts`: pure filtering and sorting helpers that can be tested without Svelte.
- Create `tests/userAnimeLists.test.mjs`: Node tests for frontend filtering and sorting behavior.
- Modify `src/routes/account/+page.svelte`: add logged-in entry point to the list browser.
- Create `src/routes/account/lists/+page.svelte`: render cached list browser UI.

## Task 1: Backend Contract and Cache Merge Tests

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/client_backend.rs`
- Modify: `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs`

- [ ] **Step 1: Write failing backend unit tests**

Add tests in the existing `client_backend::tests` module that assert:

```rust
#[test]
fn user_list_normal_sync_preserves_cached_metadata_and_updates_status() {
    let mut cache = UserAnimeListCache::default();
    cache.items.insert(
        "59922".to_string(),
        cached_user_anime_fixture(59922, "Old Title", "in progress", true),
    );

    let incoming = vec![watching_item_fixture(59922, Some("completed"), Some(1), Some(24))];
    let items = merge_user_anime_list_cache(&mut cache, incoming, false, 10_000);

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].name, "Old Title");
    assert_eq!(items[0].watch_status, "completed");
    assert_eq!(items[0].total_episodes, Some(24));
    assert_eq!(items[0].updated_at_ms, 10_000);
}

#[test]
fn user_list_force_refresh_overwrites_cached_metadata() {
    let mut cache = UserAnimeListCache::default();
    cache.items.insert(
        "59922".to_string(),
        cached_user_anime_fixture(59922, "Old Title", "in progress", true),
    );

    let mut incoming = watching_item_fixture(59922, Some("completed"), Some(1), Some(12));
    incoming.title = "Fresh Title".to_string();
    let items = merge_user_anime_list_cache(&mut cache, vec![incoming], true, 10_000);

    assert_eq!(items[0].name, "Fresh Title");
    assert_eq!(items[0].watch_status, "completed");
}

#[test]
fn user_list_sync_inserts_new_titles_and_hides_removed_titles() {
    let mut cache = UserAnimeListCache::default();
    cache.items.insert(
        "1".to_string(),
        cached_user_anime_fixture(1, "Removed", "completed", true),
    );

    let items = merge_user_anime_list_cache(
        &mut cache,
        vec![watching_item_fixture(2, Some("plan"), Some(0), Some(12))],
        false,
        10_000,
    );

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].title_id, 2);
    assert!(!cache.items.get("1").expect("cached item").active);
}
```

- [ ] **Step 2: Write failing contract test**

Extend `frontend_contract_types_keep_expected_json_shape` with:

```rust
let user_list_item = UserAnimeListItem {
    title_id: 59922,
    name: "Enen no Shouboutai".to_string(),
    url: "https://shinden.pl/series/59922".to_string(),
    image_url: "https://cdn.shinden.eu/cdn1/images/genuine/59922.jpg".to_string(),
    anime_type: "TV".to_string(),
    rating: "8.10".to_string(),
    episodes: "2/12".to_string(),
    description: "Fire force".to_string(),
    watch_status: "in progress".to_string(),
    is_favourite: 1,
    watched_episodes_count: 2,
    total_episodes: Some(12),
    release_year: Some(2025),
    active: true,
    updated_at_ms: 10,
};
let payload = UserAnimeListsPayload {
    items: vec![user_list_item],
    counts: UserAnimeListCounts {
        in_progress: 1,
        completed: 0,
        skip: 0,
        hold: 0,
        dropped: 0,
        plan: 0,
        all: 1,
    },
    refreshed_at_ms: Some(10),
    sync_error: None,
};
let json = serde_json::to_value(payload).expect("payload serializes");
assert_eq!(json["items"][0]["titleId"], 59922);
assert_eq!(json["items"][0]["watchStatus"], "in progress");
assert_eq!(json["items"][0]["releaseYear"], 2025);
assert_eq!(json["counts"]["inProgress"], 1);
assert_eq!(json["counts"]["all"], 1);
```

- [ ] **Step 3: Run tests to verify red**

Run: `cargo test user_list --lib`

Expected: FAIL because `UserAnimeListCache`, `UserAnimeListItem`, `UserAnimeListsPayload`, and `merge_user_anime_list_cache` do not exist.

## Task 2: Backend Cached List Implementation

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/client_backend.rs`
- Modify: `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs`

- [ ] **Step 1: Add backend models and cache helpers**

Implement serializable `UserAnimeListItem`, `UserAnimeListCounts`, `UserAnimeListsPayload`, `UserAnimeListCache`, load/save helpers, cache path, release-year extraction, merge helper, and counts helper.

- [ ] **Step 2: Add backend methods**

Add `get_user_anime_lists(force_refresh: Option<bool>)` to `ShindenClientBackend`. It should fetch all six statuses, merge with cache, save cache after a successful sync, and return cached data if sync fails but cache has active items.

- [ ] **Step 3: Verify backend tests green**

Run: `cargo test user_list --lib`

Expected: PASS.

## Task 3: Tauri Command and Frontend Types

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add Tauri command**

Expose:

```rust
#[tauri::command]
async fn get_user_anime_lists(
    state: tauri::State<'_, ShindenClientBackend>,
    force_refresh: Option<bool>,
) -> Result<UserAnimeListsPayload, String> {
    state.get_user_anime_lists(force_refresh).await
}
```

Register it in `tauri::generate_handler!`.

- [ ] **Step 2: Add TypeScript types**

Add `UserAnimeListItem`, `UserAnimeListCounts`, `UserAnimeListsPayload`, `UserAnimeListStatusFilter`, and `UserAnimeListFilters` matching the backend JSON names.

- [ ] **Step 3: Run Rust command compile check**

Run: `cargo test --manifest-path src-tauri/Cargo.toml get_user_anime_lists`

Expected: compile succeeds and no matching tests run, or matching tests pass.

## Task 4: Frontend Local Filtering Helpers

**Files:**
- Create: `src/lib/userAnimeLists.ts`
- Create: `tests/userAnimeLists.test.mjs`

- [ ] **Step 1: Write failing Node tests**

Test title search, status filtering, type filtering, release-year filtering, and sort by title/rating/progress.

- [ ] **Step 2: Run tests to verify red**

Run: `node --test tests/userAnimeLists.test.mjs`

Expected: FAIL because `src/lib/userAnimeLists.ts` does not exist or does not export the helpers.

- [ ] **Step 3: Implement helpers**

Export status labels, status filter options, `applyUserAnimeListFilters`, `sortUserAnimeListItems`, `statusCountKey`, and small formatting helpers as needed.

- [ ] **Step 4: Verify helper tests green**

Run: `node --test tests/userAnimeLists.test.mjs`

Expected: PASS.

## Task 5: Account Entry Point and List Page UI

**Files:**
- Modify: `src/routes/account/+page.svelte`
- Create: `src/routes/account/lists/+page.svelte`

- [ ] **Step 1: Add account entry point**

Add an action below the logged-in profile text and logout button that links to `/account/lists`.

- [ ] **Step 2: Build list browser page**

Implement loading state, cached payload load, refresh button with `forceRefresh: true`, sidebar filters, list counts, grid/list toggle, local filtering, status update select, and episode navigation.

- [ ] **Step 3: Run Svelte check**

Run: `npm.cmd run check`

Expected: 0 errors. Existing warnings may remain if unrelated.

## Task 6: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run backend focused tests**

Run: `cargo test user_list --lib`

Expected: PASS.

- [ ] **Step 2: Run frontend helper tests**

Run: `node --test tests/userAnimeLists.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run Svelte check**

Run: `npm.cmd run check`

Expected: 0 errors.

- [ ] **Step 4: Run broader Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS or report environment-specific Windows App Control blocking if it blocks generated test executables.

