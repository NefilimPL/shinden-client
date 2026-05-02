# Shinden Watching List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local in-app `Ogladam` anime list for logged-in Shinden users.

**Architecture:** The Tauri backend fetches Shinden's existing list API, maps it into the app's existing anime-list shape, and exposes it through a local command. The Svelte frontend adds a route that reuses the existing list UI pattern and a navbar button shown only for logged-in users.

**Tech Stack:** Rust/Tauri, `reqwest`, `serde`, Svelte 5, SvelteKit static adapter, DaisyUI/Tailwind utility classes.

---

### Task 1: Backend List Mapping

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests**

Add tests in the existing `#[cfg(test)] mod tests`:

```rust
#[test]
fn extract_user_id_from_profile_links_finds_current_user_animelist() {
    let html = r#"
        <a href="https://lista.shinden.pl/animelist/31875-szypss">Lista Anime</a>
        <a href="/user/31875-szypss">Profil</a>
    "#;

    let user_id = extract_user_id_from_profile_html(html);

    assert_eq!(user_id.as_deref(), Some("31875"));
}

#[test]
fn map_watching_list_item_builds_series_and_cover_urls() {
    let item = WatchingListApiItem {
        title_id: 59922,
        title: "Enen no Shouboutai: San no Shou".to_string(),
        cover_id: Some(123456),
        anime_type: Some("TV".to_string()),
        summary_rating_total: Some("7.9000".to_string()),
        episodes: Some(12),
        watched_episodes_cnt: Some("3".to_string()),
        description_pl: Some("Opis".to_string()),
        description_en: None,
    };

    let anime = map_watching_list_item(item).expect("item should map");

    assert_eq!(anime.name, "Enen no Shouboutai: San no Shou");
    assert_eq!(anime.url, "https://shinden.pl/series/59922");
    assert_eq!(anime.image_url, "https://cdn.shinden.eu/cdn1/images/genuine/123456.jpg");
    assert_eq!(anime.anime_type, "TV");
    assert_eq!(anime.rating, "7,90");
    assert_eq!(anime.episodes, "3/12");
    assert_eq!(anime.description, "Opis");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml extract_user_id_from_profile_links_finds_current_user_animelist map_watching_list_item_builds_series_and_cover_urls`

Expected: FAIL because `extract_user_id_from_profile_html`, `WatchingListApiItem`, and `map_watching_list_item` do not exist.

- [ ] **Step 3: Implement minimal mapping code**

Add serializable API structs, `extract_user_id_from_profile_html`, `map_watching_list_item`, and helpers inside `src-tauri/src/lib.rs`. Keep helpers private except where tests need access inside the same module.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml extract_user_id_from_profile_links_finds_current_user_animelist map_watching_list_item_builds_series_and_cover_urls`

Expected: PASS.

### Task 2: Backend Command

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust test for page aggregation**

Add a pure test for the URL/page helper:

```rust
#[test]
fn watching_list_url_uses_in_progress_status() {
    let url = watching_list_url("31875", 100, 200);

    assert_eq!(
        url,
        "https://lista.shinden.pl/api/userlist/31875/anime/in-progress?limit=100&offset=200"
    );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml watching_list_url_uses_in_progress_status`

Expected: FAIL because `watching_list_url` does not exist.

- [ ] **Step 3: Implement local Tauri command**

Add `get_watching_anime`:

```rust
#[tauri::command]
async fn get_watching_anime(state: tauri::State<'_, Api>) -> Result<Vec<Anime>, String>
```

The command should:
- call `state.0.get_html("https://shinden.pl/user")`,
- extract the user id,
- fetch pages from `watching_list_url(user_id, 100, offset)`,
- stop when all items are loaded,
- map valid items to `Anime`,
- register in `tauri::generate_handler!`.

- [ ] **Step 4: Run backend tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

### Task 3: Frontend Route

**Files:**
- Create: `src/routes/watchlist/+page.svelte`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add frontend type support**

Reuse the existing `Anime` type. No new type is needed unless Svelte checks require one.

- [ ] **Step 2: Create route implementation**

Create `src/routes/watchlist/+page.svelte` that:
- imports `invoke`, `goto`, `Anime`, `globalStates`, `LoadingState`, `params`, `log`, `LogLevel`, and `Empty`,
- calls `invoke<Anime[]>("get_watching_anime")` on mount,
- shows existing skeletons while loading,
- renders `Lista ogladanych anime:` with rows like `src/routes/search/+page.svelte`,
- on click sets `params.seriesUrl = anime.url` and goes to `/episodes`.

- [ ] **Step 3: Run Svelte check**

Run: `npm run check`

Expected: PASS.

### Task 4: Navbar Entry

**Files:**
- Modify: `src/lib/Navbar.svelte`

- [ ] **Step 1: Add button before AccountButton**

Import `globalStates` and render:

```svelte
{#if globalStates.user.name}
    <li><a class="btn btn-ghost btn-sm" href="/watchlist">Ogladam</a></li>
{/if}
```

Place it immediately before `<AccountButton />`.

- [ ] **Step 2: Run Svelte check**

Run: `npm run check`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 3: Review working tree**

Run: `git diff --stat`

Expected: only the intended backend, frontend, and plan changes are present.

