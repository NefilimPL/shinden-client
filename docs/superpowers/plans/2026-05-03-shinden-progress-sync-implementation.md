# Shinden Progress Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Shinden-backed anime status changes, watched episode badges, watched episode writes, and player episode navigation.

**Architecture:** The Tauri backend owns all Shinden HTTP reads and writes so cookies stay in one place. The frontend carries selected anime and episode context through the existing `params` state, then calls local Tauri commands for watched/status writes. Final-episode completion is guarded by `episodeNo === totalEpisodes`, never by "last loaded" or "last available stream".

**Tech Stack:** Rust/Tauri, `reqwest`, `serde`, Svelte 5, SvelteKit static adapter, DaisyUI/Tailwind utility classes.

---

## File Structure

- Modify `src-tauri/src/lib.rs`: Shinden list item model, episode progress model, endpoint helpers, commands, and Rust unit tests.
- Modify `src/lib/types.ts`: frontend types for richer watchlist rows and episode progress.
- Modify `src/lib/global.svelte.ts`: selected anime and selected episode navigation context.
- Create `src/lib/shindenProgress.ts`: status options, status labels, title id parsing, and Shinden timestamp formatting.
- Modify `src/routes/watchlist/+page.svelte`: status select, richer row data, and context handoff to episodes.
- Modify `src/routes/episodes/+page.svelte`: watched badges, mark-watched row action, and context handoff to players.
- Modify `src/routes/watching/+page.svelte`: player action bar for mark watched, next, and previous.
- Leave `src/routes/players/+page.svelte` and `src/lib/PlayerListElement.svelte` structurally unchanged; they keep using `params.playersUrl` and `params.playerId`.

---

### Task 1: Backend Watchlist Model And Status Helpers

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests**

Add these tests inside the existing `#[cfg(test)] mod tests`:

```rust
#[test]
fn shinden_watch_status_value_maps_ui_and_api_values() {
    assert_eq!(
        shinden_watch_status_value(Some("inProgress")).unwrap(),
        Some("in progress")
    );
    assert_eq!(
        shinden_watch_status_value(Some("in progress")).unwrap(),
        Some("in progress")
    );
    assert_eq!(
        shinden_watch_status_value(Some("completed")).unwrap(),
        Some("completed")
    );
    assert_eq!(
        shinden_watch_status_value(Some("skip")).unwrap(),
        Some("skip")
    );
    assert_eq!(
        shinden_watch_status_value(Some("hold")).unwrap(),
        Some("hold")
    );
    assert_eq!(
        shinden_watch_status_value(Some("dropped")).unwrap(),
        Some("dropped")
    );
    assert_eq!(
        shinden_watch_status_value(Some("plan")).unwrap(),
        Some("plan")
    );
    assert_eq!(shinden_watch_status_value(Some("no")).unwrap(), None);
    assert_eq!(shinden_watch_status_value(None).unwrap(), None);
}

#[test]
fn shinden_watch_status_value_rejects_unknown_status() {
    let result = shinden_watch_status_value(Some("watching-but-weird"));

    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Unsupported anime status"));
}

#[test]
fn watch_status_list_slug_maps_shinden_values() {
    assert_eq!(watch_status_list_slug("in progress"), "in-progress");
    assert_eq!(watch_status_list_slug("completed"), "completed");
    assert_eq!(watch_status_list_slug("skip"), "skip");
    assert_eq!(watch_status_list_slug("hold"), "hold");
    assert_eq!(watch_status_list_slug("dropped"), "dropped");
    assert_eq!(watch_status_list_slug("plan"), "plan");
}

#[test]
fn map_watching_list_item_details_preserves_status_progress_and_favourite() {
    let item = WatchingListApiItem {
        title_id: 59922,
        watch_status: Some("in progress".to_string()),
        is_favourite: Some(1),
        title: "Enen no Shouboutai: San no Shou".to_string(),
        cover_id: Some(123456),
        anime_type: Some("TV".to_string()),
        summary_rating_total: Some("7.9000".to_string()),
        episodes: Some(12),
        watched_episodes_cnt: Some("3".to_string()),
        description_pl: Some("Opis".to_string()),
        description_en: None,
    };

    let anime = map_watching_list_item_details(item).expect("item should map");

    assert_eq!(anime.title_id, 59922);
    assert_eq!(anime.watch_status, "in progress");
    assert_eq!(anime.is_favourite, 1);
    assert_eq!(anime.name, "Enen no Shouboutai: San no Shou");
    assert_eq!(anime.url, "https://shinden.pl/series/59922");
    assert_eq!(anime.rating, "7,90");
    assert_eq!(anime.episodes, "3/12");
    assert_eq!(anime.watched_episodes_count, 3);
    assert_eq!(anime.total_episodes, Some(12));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml shinden_watch_status_value_maps_ui_and_api_values shinden_watch_status_value_rejects_unknown_status watch_status_list_slug_maps_shinden_values map_watching_list_item_details_preserves_status_progress_and_favourite
```

Expected: FAIL because `shinden_watch_status_value`, `watch_status_list_slug`, `map_watching_list_item_details`, and the new fields do not exist.

- [ ] **Step 3: Add backend model and helpers**

In `src-tauri/src/lib.rs`, update `WatchingListApiItem`:

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WatchingListApiItem {
    title_id: u64,
    watch_status: Option<String>,
    is_favourite: Option<u8>,
    title: String,
    cover_id: Option<u64>,
    anime_type: Option<String>,
    summary_rating_total: Option<String>,
    episodes: Option<u32>,
    watched_episodes_cnt: Option<String>,
    description_pl: Option<String>,
    description_en: Option<String>,
}
```

Add the richer frontend model near the cache status structs:

```rust
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WatchingAnime {
    title_id: u64,
    name: String,
    url: String,
    image_url: String,
    anime_type: String,
    rating: String,
    episodes: String,
    description: String,
    watch_status: String,
    is_favourite: u8,
    watched_episodes_count: u32,
    total_episodes: Option<u32>,
}
```

Add helpers near the current `map_watching_list_item` helper:

```rust
fn shinden_watch_status_value(status: Option<&str>) -> Result<Option<&'static str>, String> {
    let Some(status) = status else {
        return Ok(None);
    };

    let normalized = status.trim().to_ascii_lowercase().replace('_', " ");
    match normalized.as_str() {
        "" | "no" | "none" | "null" => Ok(None),
        "in progress" | "inprogress" | "watching" | "ogladam" => Ok(Some("in progress")),
        "completed" | "obejrzane" => Ok(Some("completed")),
        "skip" | "pomijam" => Ok(Some("skip")),
        "hold" | "wstrzymane" => Ok(Some("hold")),
        "dropped" | "porzucone" => Ok(Some("dropped")),
        "plan" | "planuje" => Ok(Some("plan")),
        _ => Err(format!("Unsupported anime status: {status}")),
    }
}

fn watch_status_list_slug(status: &str) -> &'static str {
    match status.trim().to_ascii_lowercase().as_str() {
        "in progress" | "in-progress" | "inprogress" => "in-progress",
        "completed" => "completed",
        "skip" => "skip",
        "hold" => "hold",
        "dropped" => "dropped",
        "plan" => "plan",
        _ => "in-progress",
    }
}

fn map_watching_list_item_details(item: WatchingListApiItem) -> Option<WatchingAnime> {
    let name = item.title.trim().to_string();
    if name.is_empty() {
        return None;
    }

    let watched_episodes_count = watched_episode_count(&item);
    let watch_status = item
        .watch_status
        .as_deref()
        .unwrap_or("in progress")
        .to_string();

    Some(WatchingAnime {
        title_id: item.title_id,
        name,
        url: series_url(item.title_id),
        image_url: item
            .cover_id
            .map(|cover_id| format!("https://cdn.shinden.eu/cdn1/images/genuine/{cover_id}.jpg"))
            .unwrap_or_else(|| SHINDEN_TITLE_PLACEHOLDER.to_string()),
        anime_type: item.anime_type.unwrap_or_default(),
        rating: format_rating(item.summary_rating_total.as_deref()),
        episodes: format_episode_progress(item.watched_episodes_cnt.as_deref(), item.episodes),
        description: item.description_pl.or(item.description_en).unwrap_or_default(),
        watch_status,
        is_favourite: item.is_favourite.unwrap_or_default(),
        watched_episodes_count,
        total_episodes: item.episodes,
    })
}
```

Update `map_watching_list_item` to keep existing tests working:

```rust
fn map_watching_list_item(item: WatchingListApiItem) -> Option<Anime> {
    map_watching_list_item_details(item).map(|item| Anime {
        name: item.name,
        url: item.url,
        image_url: item.image_url,
        anime_type: item.anime_type,
        rating: item.rating,
        episodes: item.episodes,
        description: item.description,
    })
}
```

Update all test `WatchingListApiItem` constructors to include:

```rust
watch_status: Some("in progress".to_string()),
is_favourite: Some(0),
```

- [ ] **Step 4: Return richer watchlist rows**

Change the command signature and mapping:

```rust
#[tauri::command]
async fn get_watching_anime(
    state: tauri::State<'_, Api>,
    filter: Option<WatchingAnimeFilter>,
) -> Result<Vec<WatchingAnime>, String> {
    let filter = filter.unwrap_or_default();
    let cache = load_watching_availability_cache();
    let items = fetch_all_watching_items(&state.0).await?;

    Ok(items
        .into_iter()
        .filter(|item| watching_cache_filter_matches(item, &filter, &cache))
        .filter_map(map_watching_list_item_details)
        .collect())
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml shinden_watch_status_value_maps_ui_and_api_values shinden_watch_status_value_rejects_unknown_status watch_status_list_slug_maps_shinden_values map_watching_list_item_details_preserves_status_progress_and_favourite map_watching_list_item_builds_series_and_cover_urls
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add Shinden watchlist progress model"
```

---

### Task 2: Backend Episode Progress Read And Merge

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests**

Add these tests:

```rust
#[test]
fn title_id_from_series_url_extracts_numeric_id() {
    assert_eq!(
        title_id_from_series_url("https://shinden.pl/series/59922-enen-no-shouboutai")
            .as_deref(),
        Some("59922")
    );
    assert_eq!(
        title_id_from_series_url("https://shinden.pl/series/59922").as_deref(),
        Some("59922")
    );
    assert_eq!(title_id_from_series_url("https://shinden.pl/titles/abc"), None);
}

#[test]
fn true_final_episode_requires_known_total_episode_count() {
    assert!(is_true_final_episode(12, Some(12)));
    assert!(!is_true_final_episode(10, Some(12)));
    assert!(!is_true_final_episode(10, None));
}

#[test]
fn true_final_episode_ignores_last_loaded_episode_when_total_is_larger() {
    let playback = vec![
        Episode {
            title: "Episode 9".to_string(),
            link: "https://shinden.pl/episode/9".to_string(),
        },
        Episode {
            title: "Episode 10".to_string(),
            link: "https://shinden.pl/episode/10".to_string(),
        },
    ];
    let progress = vec![TitleEpisodeApiItem {
        episode_id: 100,
        episode_no: 10,
        is_filer: Some(0),
        watched: None,
        title_pl: None,
        title_en: None,
        title_official: None,
    }];

    let merged = merge_episode_progress(playback, progress, Some(12));

    assert_eq!(merged[1].episode_no, 10);
    assert!(!merged[1].is_true_final_episode);
}

#[test]
fn merge_episode_progress_marks_watched_rows_by_episode_number() {
    let playback = vec![
        Episode {
            title: "Playback one".to_string(),
            link: "https://shinden.pl/episode/1".to_string(),
        },
        Episode {
            title: "Playback two".to_string(),
            link: "https://shinden.pl/episode/2".to_string(),
        },
    ];
    let progress = vec![TitleEpisodeApiItem {
        episode_id: 168519,
        episode_no: 2,
        is_filer: Some(0),
        watched: Some(TitleEpisodeWatchedApiItem {
            episode_id: 168519,
            view_cnt: 1,
            created_time: Some("2022-07-28T00:33:32.000Z".to_string()),
        }),
        title_pl: Some(TitleEpisodeTitleApiItem {
            lang: "pl".to_string(),
            episode_id: 168519,
            title: "Polski tytul".to_string(),
            title_type: "national".to_string(),
        }),
        title_en: None,
        title_official: None,
    }];

    let merged = merge_episode_progress(playback, progress, Some(2));

    assert_eq!(merged[0].episode_no, 1);
    assert_eq!(merged[0].episode_id, None);
    assert!(!merged[0].watched);
    assert_eq!(merged[1].episode_id, Some(168519));
    assert_eq!(merged[1].title, "Playback two");
    assert!(merged[1].watched);
    assert_eq!(merged[1].view_count, 1);
    assert!(merged[1].is_true_final_episode);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml title_id_from_series_url_extracts_numeric_id true_final_episode_requires_known_total_episode_count true_final_episode_ignores_last_loaded_episode_when_total_is_larger merge_episode_progress_marks_watched_rows_by_episode_number
```

Expected: FAIL because the episode progress structs and helpers do not exist.

- [ ] **Step 3: Add episode progress structs**

Add near other API response structs:

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TitleEpisodesApiResponse {
    success: bool,
    message: Option<String>,
    result: TitleEpisodesApiResult,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TitleEpisodesApiResult {
    count: u32,
    items: Vec<TitleEpisodeApiItem>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TitleEpisodeApiItem {
    episode_id: u64,
    episode_no: u32,
    is_filer: Option<u8>,
    watched: Option<TitleEpisodeWatchedApiItem>,
    title_pl: Option<TitleEpisodeTitleApiItem>,
    title_en: Option<TitleEpisodeTitleApiItem>,
    title_official: Option<TitleEpisodeTitleApiItem>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TitleEpisodeWatchedApiItem {
    episode_id: u64,
    view_cnt: u32,
    created_time: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TitleEpisodeTitleApiItem {
    lang: String,
    episode_id: u64,
    title: String,
    title_type: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct EpisodeProgress {
    title: String,
    link: String,
    episode_id: Option<u64>,
    episode_no: u32,
    watched: bool,
    view_count: u32,
    total_episodes: Option<u32>,
    is_true_final_episode: bool,
}
```

- [ ] **Step 4: Add pure merge helpers**

Add near `series_url`:

```rust
fn title_id_from_series_url(url: &str) -> Option<String> {
    let marker = "/series/";
    let start = url.find(marker)? + marker.len();
    let digits: String = url[start..]
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect();

    if digits.is_empty() {
        None
    } else {
        Some(digits)
    }
}

fn title_episodes_url(title_id: u64, user_id: &str) -> String {
    format!("https://lista.shinden.pl/api/title-episodes/{title_id}/{user_id}")
}

fn is_true_final_episode(episode_no: u32, total_episodes: Option<u32>) -> bool {
    total_episodes
        .map(|total| total > 0 && episode_no == total)
        .unwrap_or(false)
}

fn merge_episode_progress(
    playback_episodes: Vec<Episode>,
    progress_episodes: Vec<TitleEpisodeApiItem>,
    total_episodes: Option<u32>,
) -> Vec<EpisodeProgress> {
    let progress_by_number: HashMap<u32, TitleEpisodeApiItem> = progress_episodes
        .into_iter()
        .map(|episode| (episode.episode_no, episode))
        .collect();

    playback_episodes
        .into_iter()
        .enumerate()
        .map(|(index, episode)| {
            let fallback_episode_no = (index + 1).min(u32::MAX as usize) as u32;
            let progress = progress_by_number.get(&fallback_episode_no);
            let episode_no = progress
                .map(|progress| progress.episode_no)
                .unwrap_or(fallback_episode_no);
            let watched = progress.and_then(|progress| progress.watched.as_ref());

            EpisodeProgress {
                title: episode.title,
                link: episode.link,
                episode_id: progress.map(|progress| progress.episode_id),
                episode_no,
                watched: watched.is_some(),
                view_count: watched.map(|watched| watched.view_cnt).unwrap_or_default(),
                total_episodes,
                is_true_final_episode: is_true_final_episode(episode_no, total_episodes),
            }
        })
        .collect()
}
```

- [ ] **Step 5: Add read command**

Add:

```rust
async fn fetch_current_user_id(api: &ShindenAPI, context: &str) -> Result<String, String> {
    let profile_html = api
        .get_html("https://shinden.pl/user")
        .await
        .map_err(|e| command_error(format!("{context} profile").as_str(), e))?;

    extract_user_id_from_profile_html(&profile_html)
        .ok_or_else(|| command_error(format!("{context} profile").as_str(), "User is not logged in"))
}

async fn fetch_title_episode_progress(
    api: &ShindenAPI,
    title_id: u64,
    user_id: &str,
) -> Result<Vec<TitleEpisodeApiItem>, String> {
    let response = api
        .client
        .get(title_episodes_url(title_id, user_id))
        .header(ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| command_error("title_episodes request", e))?
        .error_for_status()
        .map_err(|e| command_error("title_episodes response", e))?;

    let payload = response
        .json::<TitleEpisodesApiResponse>()
        .await
        .map_err(|e| command_error("title_episodes json", e))?;

    if !payload.success {
        return Err(command_error(
            "title_episodes json",
            payload.message.unwrap_or_else(|| "List API returned success=false".to_string()),
        ));
    }

    Ok(payload.result.items)
}

#[tauri::command]
async fn get_episodes_with_progress(
    state: tauri::State<'_, Api>,
    url: String,
    title_id: Option<u64>,
    total_episodes: Option<u32>,
) -> Result<Vec<EpisodeProgress>, String> {
    let playback_episodes = state
        .0
        .get_episodes(&url)
        .await
        .map_err(|e| command_error("get_episodes_with_progress playback", e))?;

    let Some(title_id) = title_id.or_else(|| {
        title_id_from_series_url(&url).and_then(|title_id| title_id.parse::<u64>().ok())
    }) else {
        return Ok(merge_episode_progress(playback_episodes, Vec::new(), total_episodes));
    };

    let progress_episodes = match fetch_current_user_id(&state.0, "get_episodes_with_progress").await {
        Ok(user_id) => fetch_title_episode_progress(&state.0, title_id, &user_id)
            .await
            .unwrap_or_else(|error| {
                let _ = command_error("get_episodes_with_progress progress fallback", error);
                Vec::new()
            }),
        Err(error) => {
            let _ = command_error("get_episodes_with_progress user fallback", error);
            Vec::new()
        }
    };

    Ok(merge_episode_progress(
        playback_episodes,
        progress_episodes,
        total_episodes,
    ))
}
```

Register `get_episodes_with_progress` in `tauri::generate_handler!`.

- [ ] **Step 6: Reuse current user id helper**

Update `fetch_all_watching_items` to call:

```rust
let user_id = fetch_current_user_id(api, "get_watching_anime").await?;
```

Remove the duplicated profile HTML extraction from that function.

- [ ] **Step 7: Run tests to verify they pass**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml title_id_from_series_url_extracts_numeric_id true_final_episode_requires_known_total_episode_count true_final_episode_ignores_last_loaded_episode_when_total_is_larger merge_episode_progress_marks_watched_rows_by_episode_number
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: read Shinden episode progress"
```

---

### Task 3: Backend Shinden Write Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests**

Add:

```rust
#[test]
fn title_status_payload_serializes_shinden_status_change() {
    let payload = build_title_status_payload(59922, Some("completed"), Some(1))
        .expect("payload should build");
    let value = serde_json::to_value(payload).expect("payload should serialize");

    assert_eq!(value["input"][0]["titleId"], 59922);
    assert_eq!(value["input"][0]["watchStatus"], "completed");
    assert_eq!(value["input"][0]["isFavourite"], 1);
    assert_eq!(value["input"][0]["priority"], 0);
    assert_eq!(value["input"][0]["recommend"], 0);
}

#[test]
fn title_status_payload_serializes_no_status_as_null() {
    let payload = build_title_status_payload(59922, Some("no"), None)
        .expect("payload should build");
    let value = serde_json::to_value(payload).expect("payload should serialize");

    assert!(value["input"][0]["watchStatus"].is_null());
    assert_eq!(value["input"][0]["isFavourite"], 0);
}

#[test]
fn watched_episode_payload_serializes_single_episode() {
    let payload = build_watched_episode_payload(
        59922,
        168519,
        "2026-05-03 00:45:10".to_string(),
    );
    let value = serde_json::to_value(payload).expect("payload should serialize");

    assert_eq!(value["titleId"], 59922);
    assert_eq!(value["episodes"][0]["episodeId"], 168519);
    assert_eq!(value["episodes"][0]["viewCnt"], 1);
    assert_eq!(value["episodes"][0]["createdTime"], "2026-05-03 00:45:10");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml title_status_payload_serializes_shinden_status_change title_status_payload_serializes_no_status_as_null watched_episode_payload_serializes_single_episode
```

Expected: FAIL because payload structs and builders do not exist.

- [ ] **Step 3: Add payload and response structs**

Add:

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TitleStatusChangePayload {
    input: Vec<TitleStatusChangeInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TitleStatusChangeInput {
    title_id: u64,
    watch_status: Option<&'static str>,
    is_favourite: u8,
    priority: u8,
    recommend: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WatchedEpisodesChangePayload {
    title_id: u64,
    episodes: Vec<WatchedEpisodeChangeInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WatchedEpisodeChangeInput {
    episode_id: u64,
    view_cnt: u32,
    created_time: String,
}

#[derive(Debug, Deserialize)]
struct ShindenWriteResponse {
    success: bool,
    message: Option<String>,
}
```

- [ ] **Step 4: Add payload builders and write helper**

Add:

```rust
fn build_title_status_payload(
    title_id: u64,
    status: Option<&str>,
    is_favourite: Option<u8>,
) -> Result<TitleStatusChangePayload, String> {
    Ok(TitleStatusChangePayload {
        input: vec![TitleStatusChangeInput {
            title_id,
            watch_status: shinden_watch_status_value(status)?,
            is_favourite: is_favourite.unwrap_or_default(),
            priority: 0,
            recommend: 0,
        }],
    })
}

fn build_watched_episode_payload(
    title_id: u64,
    episode_id: u64,
    created_time: String,
) -> WatchedEpisodesChangePayload {
    WatchedEpisodesChangePayload {
        title_id,
        episodes: vec![WatchedEpisodeChangeInput {
            episode_id,
            view_cnt: 1,
            created_time,
        }],
    }
}

async fn post_shinden_json<T: Serialize>(
    api: &ShindenAPI,
    url: &str,
    payload: &T,
    context: &str,
) -> Result<(), String> {
    let response = api
        .client
        .post(url)
        .header(ACCEPT, "application/json")
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(payload)
        .send()
        .await
        .map_err(|e| command_error(format!("{context} request").as_str(), e))?
        .error_for_status()
        .map_err(|e| command_error(format!("{context} response").as_str(), e))?;

    let payload = response
        .json::<ShindenWriteResponse>()
        .await
        .map_err(|e| command_error(format!("{context} json").as_str(), e))?;

    if payload.success {
        Ok(())
    } else {
        Err(command_error(
            format!("{context} json").as_str(),
            payload.message.unwrap_or_else(|| "Shinden returned success=false".to_string()),
        ))
    }
}
```

- [ ] **Step 5: Add Tauri write commands**

Add:

```rust
#[tauri::command]
async fn update_anime_status(
    state: tauri::State<'_, Api>,
    title_id: u64,
    status: Option<String>,
    is_favourite: Option<u8>,
) -> Result<(), String> {
    let payload = build_title_status_payload(title_id, status.as_deref(), is_favourite)?;
    post_shinden_json(
        &state.0,
        "https://lista.shinden.pl/api/title-status-change",
        &payload,
        "update_anime_status",
    )
    .await
}

#[tauri::command]
async fn mark_episode_watched(
    state: tauri::State<'_, Api>,
    title_id: u64,
    episode_id: u64,
    created_time: String,
) -> Result<(), String> {
    let payload = build_watched_episode_payload(title_id, episode_id, created_time);
    post_shinden_json(
        &state.0,
        "https://lista.shinden.pl/api/title-watched-episodes-change",
        &payload,
        "mark_episode_watched",
    )
    .await
}
```

Register `update_anime_status` and `mark_episode_watched` in `tauri::generate_handler!`.

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml title_status_payload_serializes_shinden_status_change title_status_payload_serializes_no_status_as_null watched_episode_payload_serializes_single_episode
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: write Shinden anime progress"
```

---

### Task 4: Frontend Types And Shared Helpers

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/global.svelte.ts`
- Create: `src/lib/shindenProgress.ts`

- [ ] **Step 1: Add frontend progress types**

In `src/lib/types.ts`, append:

```ts
export type AnimeWatchStatus =
    | "in progress"
    | "completed"
    | "skip"
    | "hold"
    | "dropped"
    | "plan"
    | "no";

export type WatchingAnime = Anime & {
    titleId: number;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    watchedEpisodesCount: number;
    totalEpisodes: number | null;
};

export type EpisodeProgress = Episode & {
    episodeId: number | null;
    episodeNo: number;
    watched: boolean;
    viewCount: number;
    totalEpisodes: number | null;
    isTrueFinalEpisode: boolean;
};
```

- [ ] **Step 2: Add global selected anime and episode context**

In `src/lib/global.svelte.ts`, change the `params` type to:

```ts
export const params: {
    animeName: string;
    seriesUrl: string;
    playersUrl: string;
    playerId: string;
    titleId: number | null;
    animeWatchStatus: string;
    animeIsFavourite: number;
    animeTotalEpisodes: number | null;
    episodeProgress: EpisodeProgress[];
    currentEpisodeIndex: number;
} = $state({
    animeName: "",
    seriesUrl: "",
    playersUrl: "",
    playerId: "",
    titleId: null,
    animeWatchStatus: "",
    animeIsFavourite: 0,
    animeTotalEpisodes: null,
    episodeProgress: [],
    currentEpisodeIndex: -1,
})
```

Add the import at the top:

```ts
import type {EpisodeProgress, User} from "$lib/types";
```

- [ ] **Step 3: Create shared progress helper**

Create `src/lib/shindenProgress.ts`:

```ts
import type {AnimeWatchStatus} from "$lib/types";

export const animeStatusOptions: Array<{ value: AnimeWatchStatus; label: string }> = [
    { value: "in progress", label: "Ogladam" },
    { value: "completed", label: "Obejrzane" },
    { value: "skip", label: "Pomijam" },
    { value: "hold", label: "Wstrzymane" },
    { value: "dropped", label: "Porzucone" },
    { value: "plan", label: "Planuje" },
];

export function animeStatusLabel(status: string) {
    return animeStatusOptions.find((option) => option.value === status)?.label ?? "Brak";
}

export function titleIdFromSeriesUrl(url: string): number | null {
    const match = url.match(/\/series\/(\d+)/);
    if (!match) {
        return null;
    }

    const titleId = Number(match[1]);
    return Number.isFinite(titleId) ? titleId : null;
}

export function formatShindenCreatedTime(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join("-") + " " + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join(":");
}
```

- [ ] **Step 4: Run Svelte check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/global.svelte.ts src/lib/shindenProgress.ts
git commit -m "feat: add frontend Shinden progress context"
```

---

### Task 5: Watchlist Status UI

**Files:**
- Modify: `src/routes/watchlist/+page.svelte`

- [ ] **Step 1: Update imports and state types**

Change the type import:

```ts
import type {AnimeWatchStatus, WatchingAnime} from "$lib/types";
```

Add:

```ts
import { animeStatusOptions, titleIdFromSeriesUrl } from "$lib/shindenProgress";
```

Change:

```ts
let result: WatchingAnime[] = $state([]);
let statusUpdateInProgress: number | null = $state(null);
```

- [ ] **Step 2: Change watchlist invoke type**

In `loadWatchingAnime`, change:

```ts
result = await invoke<WatchingAnime[]>("get_watching_anime", {
    filter: {
        onlyAvailableUnwatched,
        subtitleLanguage,
        checkSubtitleAvailabilityOnline,
        excludeAiSubtitles,
    },
});
```

- [ ] **Step 3: Add status update handler**

Add below `applySettings`:

```ts
async function updateStatus(anime: WatchingAnime, status: AnimeWatchStatus) {
    if (anime.watchStatus === status) {
        return;
    }

    try {
        statusUpdateInProgress = anime.titleId;
        await invoke("update_anime_status", {
            titleId: anime.titleId,
            status,
            isFavourite: anime.isFavourite,
        });

        anime.watchStatus = status;
        result = status === "in progress"
            ? [...result]
            : result.filter((item) => item.titleId !== anime.titleId);
        log(LogLevel.SUCCESS, `Zmieniono status anime: ${anime.name}`);
    } catch (e) {
        log(LogLevel.ERROR, `Error updating anime status: ${e}`);
    } finally {
        statusUpdateInProgress = null;
    }
}
```

- [ ] **Step 4: Store richer route context**

Replace `handleButton` with:

```ts
async function handleButton(anime: WatchingAnime) {
    params.seriesUrl = anime.url;
    params.titleId = anime.titleId || titleIdFromSeriesUrl(anime.url);
    params.animeWatchStatus = anime.watchStatus;
    params.animeIsFavourite = anime.isFavourite;
    params.animeTotalEpisodes = anime.totalEpisodes;
    params.episodeProgress = [];
    params.currentEpisodeIndex = -1;
    await goto("/episodes");
}
```

- [ ] **Step 5: Add select to each row**

In the row, before the play/open button, add:

```svelte
<select
    class="select select-bordered select-sm w-36"
    value={anime.watchStatus}
    disabled={statusUpdateInProgress === anime.titleId}
    aria-label="status anime"
    onchange={(event) => {
        const status = (event.currentTarget as HTMLSelectElement).value as AnimeWatchStatus;
        void updateStatus(anime, status);
    }}
>
    {#each animeStatusOptions as option}
        <option value={option.value}>{option.label}</option>
    {/each}
</select>
```

Change the open button call:

```svelte
onclick={async () => { await handleButton(anime); }}
```

- [ ] **Step 6: Run Svelte check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/watchlist/+page.svelte
git commit -m "feat: change Shinden anime status from watchlist"
```

---

### Task 6: Episode List Watched State UI

**Files:**
- Modify: `src/routes/episodes/+page.svelte`

- [ ] **Step 1: Update imports and state**

Change the type import:

```ts
import type {EpisodeProgress} from "$lib/types";
```

Add:

```ts
import { formatShindenCreatedTime, titleIdFromSeriesUrl } from "$lib/shindenProgress";
```

Change state:

```ts
let episodes: EpisodeProgress[] = $state([]);
let watchedUpdateInProgress: number | null = $state(null);
```

- [ ] **Step 2: Load merged episode progress**

Replace the invoke in `onMount`:

```ts
if (!params.titleId) {
    params.titleId = titleIdFromSeriesUrl(params.seriesUrl);
}

episodes = await invoke<EpisodeProgress[]>("get_episodes_with_progress", {
    url: params.seriesUrl,
    titleId: params.titleId,
    totalEpisodes: params.animeTotalEpisodes,
});

params.episodeProgress = episodes;
```

- [ ] **Step 3: Add mark watched handler**

Add:

```ts
async function markEpisodeWatched(episode: EpisodeProgress) {
    if (!params.titleId || !episode.episodeId || episode.watched) {
        return;
    }

    try {
        watchedUpdateInProgress = episode.episodeId;
        await invoke("mark_episode_watched", {
            titleId: params.titleId,
            episodeId: episode.episodeId,
            createdTime: formatShindenCreatedTime(new Date()),
        });

        episode.watched = true;
        episode.viewCount = Math.max(episode.viewCount, 1);
        episodes = [...episodes];
        params.episodeProgress = episodes;
        log(LogLevel.SUCCESS, `Oznaczono odcinek ${episode.episodeNo} jako obejrzany`);
    } catch (e) {
        log(LogLevel.ERROR, `Error marking episode watched: ${e}`);
    } finally {
        watchedUpdateInProgress = null;
    }
}
```

- [ ] **Step 4: Store selected episode context before player selection**

Replace `handleButton`:

```ts
async function handleButton(episode: EpisodeProgress, index: number) {
    params.playersUrl = episode.link;
    params.episodeProgress = episodes;
    params.currentEpisodeIndex = index;
    await goto("/players");
}
```

- [ ] **Step 5: Render watched badge and mark button**

Inside the row, after the title block and before the play button, add:

```svelte
<div class="flex shrink-0 items-center gap-2">
    <span class={`badge ${episode.watched ? "badge-success" : "badge-ghost"}`}>
        {episode.watched ? "Obejrzany" : "Nieobejrzany"}
    </span>

    <button
        class="btn btn-sm btn-ghost"
        disabled={episode.watched || !episode.episodeId || watchedUpdateInProgress === episode.episodeId}
        onclick={() => { void markEpisodeWatched(episode); }}
    >
        Oznacz
    </button>
</div>
```

Change the play button:

```svelte
onclick={async() => { await handleButton(episode, i) }}
```

- [ ] **Step 6: Run Svelte check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/episodes/+page.svelte
git commit -m "feat: show and update watched episodes"
```

---

### Task 7: Player Episode Navigation Actions

**Files:**
- Modify: `src/routes/watching/+page.svelte`

- [ ] **Step 1: Update imports and state**

Add imports:

```ts
import { goto } from "$app/navigation";
import { formatShindenCreatedTime } from "$lib/shindenProgress";
import type { EpisodeProgress } from "$lib/types";
```

Add state near other `$state` declarations:

```ts
let progressWriteInProgress = $state(false);
```

- [ ] **Step 2: Add context helpers**

Add in the script:

```ts
function currentEpisode(): EpisodeProgress | null {
    return params.episodeProgress[params.currentEpisodeIndex] ?? null;
}

function previousEpisode(): EpisodeProgress | null {
    return params.currentEpisodeIndex > 0
        ? params.episodeProgress[params.currentEpisodeIndex - 1]
        : null;
}

function nextEpisode(): EpisodeProgress | null {
    return params.currentEpisodeIndex >= 0 && params.currentEpisodeIndex < params.episodeProgress.length - 1
        ? params.episodeProgress[params.currentEpisodeIndex + 1]
        : null;
}

function primaryProgressLabel() {
    const episode = currentEpisode();
    if (!episode) {
        return "Oznacz jako obejrzane";
    }

    return episode.isTrueFinalEpisode || !nextEpisode()
        ? "Oznacz jako obejrzane"
        : "Oznacz jako obejrzane i przejdz dalej";
}
```

- [ ] **Step 3: Add navigation helpers**

Add:

```ts
async function goToEpisode(episode: EpisodeProgress) {
    const index = params.episodeProgress.findIndex((item) => item.link === episode.link);
    if (index < 0) {
        return;
    }

    params.currentEpisodeIndex = index;
    params.playersUrl = episode.link;
    params.playerId = "";
    await goto("/players");
}

async function markCurrentEpisodeWatched() {
    const episode = currentEpisode();
    if (!episode || !params.titleId || !episode.episodeId || episode.watched) {
        return;
    }

    await invoke("mark_episode_watched", {
        titleId: params.titleId,
        episodeId: episode.episodeId,
        createdTime: formatShindenCreatedTime(new Date()),
    });

    episode.watched = true;
    episode.viewCount = Math.max(episode.viewCount, 1);
    params.episodeProgress = [...params.episodeProgress];
}

async function handlePrimaryProgressAction() {
    const episode = currentEpisode();
    if (!episode) {
        return;
    }

    try {
        progressWriteInProgress = true;
        await markCurrentEpisodeWatched();

        if (episode.isTrueFinalEpisode && params.titleId) {
            await invoke("update_anime_status", {
                titleId: params.titleId,
                status: "completed",
                isFavourite: params.animeIsFavourite,
            });
            params.animeWatchStatus = "completed";
            log(LogLevel.SUCCESS, "Oznaczono anime jako obejrzane");
            return;
        }

        const next = nextEpisode();
        if (next) {
            await goToEpisode(next);
        }
    } catch (e) {
        log(LogLevel.ERROR, `Error updating current episode progress: ${e}`);
    } finally {
        progressWriteInProgress = false;
    }
}
```

- [ ] **Step 4: Render action bar once below player content**

Add this block inside the outer `<div class="h-full w-full flex items-center justify-center">`, after the existing player content but still inside the top-level wrapper:

```svelte
{#if globalStates.loadingState === LoadingState.OK && currentEpisode()}
    <div class="fixed bottom-4 left-4 right-4 z-20 flex flex-col sm:flex-row items-center justify-center gap-2 rounded-box bg-base-300/95 border border-base-content/10 p-3 shadow-xl">
        <button
            class="btn btn-primary btn-sm w-full sm:w-auto"
            disabled={progressWriteInProgress || !currentEpisode()?.episodeId}
            onclick={() => { void handlePrimaryProgressAction(); }}
        >
            {primaryProgressLabel()}
        </button>

        {#if nextEpisode()}
            <button
                class="btn btn-ghost btn-sm w-full sm:w-auto"
                disabled={progressWriteInProgress}
                onclick={() => {
                    const episode = nextEpisode();
                    if (episode) void goToEpisode(episode);
                }}
            >
                Przejdz dalej
            </button>
        {/if}

        {#if previousEpisode()}
            <button
                class="btn btn-ghost btn-sm w-full sm:w-auto"
                disabled={progressWriteInProgress}
                onclick={() => {
                    const episode = previousEpisode();
                    if (episode) void goToEpisode(episode);
                }}
            >
                Do poprzedniego odcinka
            </button>
        {/if}
    </div>
{/if}
```

- [ ] **Step 5: Add bottom padding to player layout**

Change built-in and iframe content wrappers from:

```svelte
<div class="w-full h-full p-4 md:p-6 flex flex-col items-center justify-center gap-4">
```

and:

```svelte
<div class="w-full h-full p-4 md:p-6 flex items-center justify-center">
```

to:

```svelte
<div class="w-full h-full p-4 pb-28 md:p-6 md:pb-28 flex flex-col items-center justify-center gap-4">
```

and:

```svelte
<div class="w-full h-full p-4 pb-28 md:p-6 md:pb-28 flex items-center justify-center">
```

- [ ] **Step 6: Run Svelte check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/watching/+page.svelte
git commit -m "feat: add episode navigation actions"
```

---

### Task 8: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: PASS. If `cargo` is unavailable on this machine, record the exact shell error in the final response.

- [ ] **Step 2: Run frontend checks**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 3: Review final diff**

Run:

```bash
git diff --stat HEAD~7..HEAD
```

Expected: changes are limited to:

```text
docs/superpowers/plans/2026-05-03-shinden-progress-sync-implementation.md
src-tauri/src/lib.rs
src/lib/types.ts
src/lib/global.svelte.ts
src/lib/shindenProgress.ts
src/routes/watchlist/+page.svelte
src/routes/episodes/+page.svelte
src/routes/watching/+page.svelte
```

- [ ] **Step 4: Manual smoke test in the app**

Run the app:

```bash
npm run tauri dev
```

Expected manual flow:

- Log in.
- Open `Ogladam`.
- Change one row status to another Shinden status and verify the command succeeds.
- Open an anime with known `totalEpisodes`.
- Confirm watched badges appear on `/episodes`.
- Mark a middle episode watched and confirm only that episode changes.
- Open a non-final episode with a next episode and confirm the primary player button says `Oznacz jako obejrzane i przejdz dalej`.
- Open the last loaded episode of a title where `episodeNo < totalEpisodes` and confirm the primary player button says `Oznacz jako obejrzane` and does not mark the anime completed.
- Open the true final episode where `episodeNo === totalEpisodes` and confirm the primary player button says `Oznacz jako obejrzane` and marks the anime status as `completed`.

- [ ] **Step 5: Commit final verification note if code changed after fixes**

If verification required code fixes, commit them:

```bash
git add src-tauri/src/lib.rs src/lib/types.ts src/lib/global.svelte.ts src/lib/shindenProgress.ts src/routes/watchlist/+page.svelte src/routes/episodes/+page.svelte src/routes/watching/+page.svelte
git commit -m "fix: stabilize Shinden progress sync"
```

If no fixes were needed, do not create an empty commit.
