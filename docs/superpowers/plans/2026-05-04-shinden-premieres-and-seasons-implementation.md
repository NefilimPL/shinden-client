# Shinden Premieres And Seasons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Shinden `/main` premieres to the home page and a separate seasons browser with status controls and Shinden links.

**Architecture:** The Rust Tauri backend will expose discovery commands that fetch Shinden HTML, parse rows into a shared discovery model, and enrich rows with the user's existing Shinden status data when available. The Svelte frontend will reuse one compact discovery-list component for home premieres and season results, keeping status writes on the existing `update_anime_status` command.

**Tech Stack:** Tauri 2, Rust, `shinden-pl-api`, Svelte 5, SvelteKit, DaisyUI, existing app state in `src/lib/global.svelte.ts`.

---

## File Structure

- Modify `src-tauri/src/lib.rs`
  - Add the discovery DTO.
  - Add Shinden URL builders.
  - Add parsing helpers for `/main` and season pages.
  - Add `get_main_premieres` and `get_season_anime` commands.
  - Register commands in `tauri::generate_handler!`.
  - Add Rust unit tests near existing tests.
- Modify `src/lib/types.ts`
  - Add `DiscoveryAnime`, `SeasonSlug`, and `SeasonOption`.
  - Keep `SearchAnime` unchanged for search callers except shared fields.
- Create `src/lib/DiscoveryAnimeList.svelte`
  - Shared compact list UI.
  - Handles status changes, app episode navigation, and external Shinden links.
- Modify `src/routes/+page.svelte`
  - Load `/main` premieres after connection succeeds.
  - Render the shared list below search.
  - Add a small `Sezony` button next to the search form.
- Create `src/routes/seasons/+page.svelte`
  - Year input, season selector, load action, result list.
  - Defaults to the current year and a season inferred from the current month.
- Optional cleanup after implementation
  - Leave `.superpowers/` untracked. It was created only by the failed visual companion attempt.

---

### Task 1: Backend Discovery Model And URL Builders

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add failing tests for season URL helpers**

Add these tests inside the existing `#[cfg(test)] mod tests` in `src-tauri/src/lib.rs`:

```rust
#[test]
fn season_page_url_uses_explicit_year_and_slug() {
    assert_eq!(
        season_page_url(Some(2026), "winter"),
        "https://shinden.pl/series/season/2026/winter"
    );
}

#[test]
fn season_page_url_can_use_current_shortcut() {
    assert_eq!(
        season_page_url(None, "current"),
        "https://shinden.pl/series/season/current"
    );
}

#[test]
fn normalize_season_slug_accepts_polish_aliases() {
    assert_eq!(normalize_season_slug("zima").as_deref(), Some("winter"));
    assert_eq!(normalize_season_slug("wiosna").as_deref(), Some("spring"));
    assert_eq!(normalize_season_slug("lato").as_deref(), Some("summer"));
    assert_eq!(normalize_season_slug("jesien").as_deref(), Some("fall"));
    assert_eq!(normalize_season_slug("jesień").as_deref(), Some("fall"));
}
```

- [ ] **Step 2: Run Rust tests and verify they fail**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml season_page_url normalize_season_slug
```

Expected: fails because `season_page_url` and `normalize_season_slug` do not exist yet.

- [ ] **Step 3: Add constants, DTO, and URL helpers**

Add near the existing constants and DTO structs in `src-tauri/src/lib.rs`:

```rust
const SHINDEN_MAIN_URL: &str = "https://shinden.pl/main";
const SHINDEN_SEASON_CURRENT_URL: &str = "https://shinden.pl/series/season/current";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DiscoveryAnime {
    name: String,
    url: String,
    image_url: String,
    anime_type: String,
    rating: String,
    episodes: String,
    description: String,
    title_id: Option<u64>,
    watch_status: String,
    is_favourite: u8,
    total_episodes: Option<u32>,
    source_label: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct DiscoveryAnimeBase {
    name: String,
    url: String,
    image_url: String,
    anime_type: String,
    rating: String,
    episodes: String,
    description: String,
    title_id: Option<u64>,
    total_episodes: Option<u32>,
    source_label: Option<String>,
}
```

Add near the existing URL helpers:

```rust
fn season_page_url(year: Option<u16>, season: &str) -> String {
    let normalized = normalize_season_slug(season).unwrap_or_else(|| "current".to_string());
    if normalized == "current" {
        SHINDEN_SEASON_CURRENT_URL.to_string()
    } else {
        let year = year.unwrap_or(2026);
        format!("https://shinden.pl/series/season/{year}/{normalized}")
    }
}

fn normalize_season_slug(season: &str) -> Option<String> {
    let normalized = season
        .trim()
        .to_ascii_lowercase()
        .replace('ą', "a")
        .replace('ę', "e")
        .replace('ó', "o")
        .replace('ś', "s")
        .replace('ł', "l")
        .replace('ż', "z")
        .replace('ź', "z")
        .replace('ć', "c")
        .replace('ń', "n");

    match normalized.as_str() {
        "current" | "obecny" | "aktualny" => Some("current".to_string()),
        "winter" | "zima" => Some("winter".to_string()),
        "spring" | "wiosna" => Some("spring".to_string()),
        "summer" | "lato" => Some("summer".to_string()),
        "fall" | "autumn" | "jesien" => Some("fall".to_string()),
        _ => None,
    }
}
```

- [ ] **Step 4: Run Rust tests and verify they pass**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml season_page_url normalize_season_slug
```

Expected: the three new URL tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- src-tauri/src/lib.rs
git commit -m "feat: add Shinden discovery URL helpers"
```

---

### Task 2: Backend HTML Parsing Helpers

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add failing parser tests**

Add these tests inside `#[cfg(test)] mod tests`:

```rust
#[test]
fn parse_main_premieres_extracts_series_links() {
    let html = r#"
        <section id="premieres">
            <a class="cover" href="/series/59922-enen-no-shouboutai-san-no-shou-part-2">
                <img src="https://cdn.shinden.eu/cdn1/images/genuine/59922.jpg" alt="Enen no Shouboutai: San no Shou Part 2">
            </a>
            <a href="/series/59922-enen-no-shouboutai-san-no-shou-part-2">Enen no Shouboutai: San no Shou Part 2</a>
            <span>Odcinek 1</span>
        </section>
    "#;

    let rows = parse_main_premieres_html(html);

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].title_id, Some(59922));
    assert_eq!(rows[0].name, "Enen no Shouboutai: San no Shou Part 2");
    assert_eq!(
        rows[0].url,
        "https://shinden.pl/series/59922-enen-no-shouboutai-san-no-shou-part-2"
    );
    assert_eq!(rows[0].source_label.as_deref(), Some("Odcinek 1"));
}

#[test]
fn parse_season_anime_extracts_title_rows() {
    let html = r#"
        <article>
            <h3><a href="/series/60001-jujutsu-kaisen-shimetsu-kaiyuu-zenpen">Jujutsu Kaisen: Shimetsu Kaiyuu - Zenpen</a></h3>
            <img src="https://cdn.shinden.eu/cdn1/images/genuine/60001.jpg" alt="">
            <p>TV 12ep</p>
            <strong>8,7</strong>
        </article>
    "#;

    let rows = parse_season_anime_html(html);

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].title_id, Some(60001));
    assert_eq!(rows[0].name, "Jujutsu Kaisen: Shimetsu Kaiyuu - Zenpen");
    assert_eq!(rows[0].anime_type, "TV");
    assert_eq!(rows[0].episodes, "12ep");
    assert_eq!(rows[0].rating, "8,7");
}
```

- [ ] **Step 2: Run parser tests and verify they fail**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml parse_main_premieres parse_season_anime
```

Expected: fails because parser functions do not exist.

- [ ] **Step 3: Add small string parsing helpers**

Add near existing string helpers such as `extract_ascii_digits_after`:

```rust
fn absolute_shinden_url(url: &str) -> String {
    let trimmed = html_unescape(url.trim());
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        trimmed
    } else if trimmed.starts_with("//") {
        format!("https:{trimmed}")
    } else if trimmed.starts_with('/') {
        format!("https://shinden.pl{trimmed}")
    } else {
        format!("https://shinden.pl/{trimmed}")
    }
}

fn html_unescape(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .to_string()
}

fn strip_html_tags(value: &str) -> String {
    let mut output = String::new();
    let mut inside_tag = false;
    for character in value.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => output.push(character),
            _ => {}
        }
    }
    html_unescape(output.split_whitespace().collect::<Vec<_>>().join(" ").as_str())
}

fn extract_attr(tag: &str, attr: &str) -> Option<String> {
    let marker = format!("{attr}=\"");
    if let Some(start) = tag.find(&marker) {
        let value_start = start + marker.len();
        return tag[value_start..]
            .split('"')
            .next()
            .map(html_unescape)
            .filter(|value| !value.is_empty());
    }

    let marker = format!("{attr}='");
    let start = tag.find(&marker)?;
    let value_start = start + marker.len();
    tag[value_start..]
        .split('\'')
        .next()
        .map(html_unescape)
        .filter(|value| !value.is_empty())
}

fn compact_text(value: &str) -> String {
    strip_html_tags(value)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
```

- [ ] **Step 4: Add discovery row parsers**

Add after the helpers from Step 3:

```rust
fn parse_main_premieres_html(html: &str) -> Vec<DiscoveryAnimeBase> {
    parse_discovery_links(html, true)
}

fn parse_season_anime_html(html: &str) -> Vec<DiscoveryAnimeBase> {
    parse_discovery_links(html, false)
}

fn parse_discovery_links(html: &str, include_source_label: bool) -> Vec<DiscoveryAnimeBase> {
    let mut rows = Vec::new();
    let mut seen = std::collections::HashMap::<u64, usize>::new();
    let mut offset = 0;

    while let Some(anchor_start_relative) = html[offset..].find("<a") {
        let anchor_start = offset + anchor_start_relative;
        let Some(open_end_relative) = html[anchor_start..].find('>') else {
            break;
        };
        let open_end = anchor_start + open_end_relative;
        let open_tag = &html[anchor_start..=open_end];
        let Some(href) = extract_attr(open_tag, "href") else {
            offset = open_end + 1;
            continue;
        };
        let title_id = title_id_from_series_url(&href).and_then(|value| value.parse::<u64>().ok());
        let Some(title_id) = title_id else {
            offset = open_end + 1;
            continue;
        };

        let Some(close_relative) = html[open_end + 1..].find("</a>") else {
            break;
        };
        let close = open_end + 1 + close_relative;
        let anchor_body = &html[open_end + 1..close];
        let mut name = compact_text(anchor_body);
        let mut image_url = extract_first_image_src(anchor_body).unwrap_or_default();

        if name.is_empty() {
            name = extract_first_image_alt(anchor_body).unwrap_or_default();
        }
        if name.is_empty() {
            offset = close + 4;
            continue;
        }

        if image_url.is_empty() {
            image_url = extract_nearby_image_src(html, anchor_start, close)
                .unwrap_or_else(|| SHINDEN_TITLE_PLACEHOLDER.to_string());
        }

        let context = nearby_context(html, anchor_start, close);
        let (anime_type, episodes) = extract_type_and_episodes(&context);
        let source_label = include_source_label
            .then(|| extract_episode_label(&context))
            .flatten();

        let row = DiscoveryAnimeBase {
            name,
            url: absolute_shinden_url(&href),
            image_url: if image_url.is_empty() {
                SHINDEN_TITLE_PLACEHOLDER.to_string()
            } else {
                absolute_shinden_url(&image_url)
            },
            anime_type,
            rating: extract_rating(&context),
            episodes,
            description: String::new(),
            title_id: Some(title_id),
            total_episodes: extract_total_episodes(&context),
            source_label,
        };

        if let Some(existing_index) = seen.get(&title_id).copied() {
            if rows[existing_index].source_label.is_none() && row.source_label.is_some() {
                rows[existing_index].source_label = row.source_label;
            }
        } else {
            seen.insert(title_id, rows.len());
            rows.push(row);
        }

        offset = close + 4;
    }

    rows
}
```

- [ ] **Step 5: Add metadata extraction helpers**

Add after `parse_discovery_links`:

```rust
fn extract_first_image_src(html: &str) -> Option<String> {
    let img_start = html.find("<img")?;
    let img_end = img_start + html[img_start..].find('>')?;
    extract_attr(&html[img_start..=img_end], "src")
}

fn extract_first_image_alt(html: &str) -> Option<String> {
    let img_start = html.find("<img")?;
    let img_end = img_start + html[img_start..].find('>')?;
    extract_attr(&html[img_start..=img_end], "alt")
}

fn extract_nearby_image_src(html: &str, start: usize, end: usize) -> Option<String> {
    let context = nearby_context(html, start, end);
    extract_first_image_src(&context)
}

fn nearby_context(html: &str, start: usize, end: usize) -> String {
    let context_start = start.saturating_sub(900);
    let context_end = (end + 900).min(html.len());
    html[context_start..context_end].to_string()
}

fn extract_type_and_episodes(context: &str) -> (String, String) {
    for anime_type in ["TV", "ONA", "OVA", "Movie", "Special", "Music"] {
        if let Some(index) = context.find(anime_type) {
            let after = &context[index + anime_type.len()..];
            let compact = compact_text(after);
            if let Some(token) = compact
                .split_whitespace()
                .find(|token| token.ends_with("ep") || token.ends_with("odc"))
            {
                return (anime_type.to_string(), token.to_string());
            }
            return (anime_type.to_string(), String::new());
        }
    }

    (String::new(), String::new())
}

fn extract_total_episodes(context: &str) -> Option<u32> {
    let (_, episodes) = extract_type_and_episodes(context);
    let digits: String = episodes.chars().take_while(|character| character.is_ascii_digit()).collect();
    digits.parse::<u32>().ok()
}

fn extract_episode_label(context: &str) -> Option<String> {
    let compact = compact_text(context);
    let lower = compact.to_ascii_lowercase();
    let marker = "odcinek ";
    let start = lower.find(marker)? + marker.len();
    let number: String = lower[start..]
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect();

    if number.is_empty() {
        None
    } else {
        Some(format!("Odcinek {number}"))
    }
}

fn extract_rating(context: &str) -> String {
    let compact = compact_text(context);
    compact
        .split_whitespace()
        .find(|token| {
            let mut parts = token.split(',');
            parts
                .next()
                .is_some_and(|part| part.len() <= 2 && part.chars().all(|character| character.is_ascii_digit()))
                && parts
                    .next()
                    .is_some_and(|part| part.len() == 1 && part.chars().all(|character| character.is_ascii_digit()))
        })
        .unwrap_or_default()
        .to_string()
}
```

- [ ] **Step 6: Run parser tests and verify they pass**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml parse_main_premieres parse_season_anime
```

Expected: both parser tests pass.

- [ ] **Step 7: Commit**

```powershell
git add -- src-tauri/src/lib.rs
git commit -m "feat: parse Shinden discovery pages"
```

---

### Task 3: Backend Discovery Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add failing enrichment test**

Add this test inside `#[cfg(test)] mod tests`:

```rust
#[test]
fn map_discovery_anime_results_uses_matching_status() {
    let rows = vec![DiscoveryAnimeBase {
        name: "Anime 59922".to_string(),
        url: "https://shinden.pl/series/59922-anime".to_string(),
        image_url: SHINDEN_TITLE_PLACEHOLDER.to_string(),
        anime_type: "TV".to_string(),
        rating: "8,1".to_string(),
        episodes: "12ep".to_string(),
        description: String::new(),
        title_id: Some(59922),
        total_episodes: Some(12),
        source_label: Some("Odcinek 1".to_string()),
    }];
    let watching_items = vec![WatchingListApiItem {
        title_id: 59922,
        watch_status: Some("plan".to_string()),
        is_favourite: Some(1),
        title: "Anime 59922".to_string(),
        cover_id: None,
        anime_type: Some("TV".to_string()),
        summary_rating_total: Some("8.1".to_string()),
        episodes: Some(12),
        watched_episodes_cnt: Some("0".to_string()),
        description_pl: None,
        description_en: None,
    }];

    let mapped = map_discovery_anime_results(rows, watching_items);

    assert_eq!(mapped[0].watch_status, "plan");
    assert_eq!(mapped[0].is_favourite, 1);
    assert_eq!(mapped[0].total_episodes, Some(12));
}
```

- [ ] **Step 2: Run the enrichment test and verify it fails**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml map_discovery_anime_results_uses_matching_status
```

Expected: fails because `map_discovery_anime_results` does not exist.

- [ ] **Step 3: Add status enrichment mapping**

Add near `map_search_anime_results`:

```rust
fn map_discovery_anime_results(
    rows: Vec<DiscoveryAnimeBase>,
    watching_items: Vec<WatchingListApiItem>,
) -> Vec<DiscoveryAnime> {
    let watching_by_title_id: HashMap<u64, WatchingListApiItem> = watching_items
        .into_iter()
        .map(|item| (item.title_id, item))
        .collect();

    rows.into_iter()
        .map(|row| map_discovery_anime_details(row, &watching_by_title_id))
        .collect()
}

fn map_discovery_anime_details(
    row: DiscoveryAnimeBase,
    watching_by_title_id: &HashMap<u64, WatchingListApiItem>,
) -> DiscoveryAnime {
    let watching_item = row
        .title_id
        .and_then(|title_id| watching_by_title_id.get(&title_id));

    DiscoveryAnime {
        name: row.name,
        url: row.url,
        image_url: row.image_url,
        anime_type: row.anime_type,
        rating: row.rating,
        episodes: row.episodes,
        description: row.description,
        title_id: row.title_id,
        watch_status: watching_item
            .and_then(|item| item.watch_status.clone())
            .unwrap_or_else(|| "no".to_string()),
        is_favourite: watching_item
            .and_then(|item| item.is_favourite)
            .unwrap_or_default(),
        total_episodes: row
            .total_episodes
            .or_else(|| watching_item.and_then(|item| item.episodes)),
        source_label: row.source_label,
    }
}
```

- [ ] **Step 4: Add backend commands**

Add near the existing `search` command:

```rust
#[tauri::command]
async fn get_main_premieres(state: tauri::State<'_, Api>) -> Result<Vec<DiscoveryAnime>, String> {
    let html = state
        .0
        .get_html(SHINDEN_MAIN_URL)
        .await
        .map_err(|e| command_error("get_main_premieres", e))?;

    let watching_items = fetch_all_userlist_items(&state.0, &state.2)
        .await
        .unwrap_or_default();

    Ok(map_discovery_anime_results(
        parse_main_premieres_html(&html),
        watching_items,
    ))
}

#[tauri::command]
async fn get_season_anime(
    state: tauri::State<'_, Api>,
    year: Option<u16>,
    season: String,
) -> Result<Vec<DiscoveryAnime>, String> {
    let url = season_page_url(year, &season);
    let html = state
        .0
        .get_html(&url)
        .await
        .map_err(|e| command_error("get_season_anime", e))?;

    let watching_items = fetch_all_userlist_items(&state.0, &state.2)
        .await
        .unwrap_or_default();

    Ok(map_discovery_anime_results(
        parse_season_anime_html(&html),
        watching_items,
    ))
}
```

- [ ] **Step 5: Register commands**

Add `get_main_premieres` and `get_season_anime` to the `tauri::generate_handler!` list:

```rust
get_main_premieres,
get_season_anime,
```

- [ ] **Step 6: Run backend tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all targeted tests pass.

- [ ] **Step 7: Commit**

```powershell
git add -- src-tauri/src/lib.rs
git commit -m "feat: expose Shinden discovery commands"
```

---

### Task 4: Frontend Types And Shared Discovery List Component

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/DiscoveryAnimeList.svelte`

- [ ] **Step 1: Add frontend discovery types**

In `src/lib/types.ts`, add after `SearchAnime`:

```ts
export type DiscoveryAnime = Anime & {
    titleId: number | null;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    totalEpisodes: number | null;
    sourceLabel: string | null;
};

export type SeasonSlug = "current" | "winter" | "spring" | "summer" | "fall";

export type SeasonOption = {
    value: SeasonSlug;
    label: string;
};
```

- [ ] **Step 2: Create the shared component**

Create `src/lib/DiscoveryAnimeList.svelte`:

```svelte
<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { goto } from "$app/navigation";
    import { openUrl } from "@tauri-apps/plugin-opener";
    import type { AnimeWatchStatus, DiscoveryAnime } from "$lib/types";
    import { globalStates, params } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import { animeStatusOptions, titleIdFromSeriesUrl } from "$lib/shindenProgress";
    import Empty from "$lib/Empty.svelte";

    let {
        items,
        heading,
        emptyLabel = "Brak pozycji",
    }: {
        items: DiscoveryAnime[];
        heading: string;
        emptyLabel?: string;
    } = $props();

    let displayItems: DiscoveryAnime[] = $state([]);
    let statusUpdateInProgress: number | null = $state(null);

    $effect(() => {
        displayItems = items.map((item) => ({ ...item }));
    });

    function statusTitleId(anime: DiscoveryAnime) {
        return anime.titleId ?? titleIdFromSeriesUrl(anime.url);
    }

    async function updateStatus(anime: DiscoveryAnime, status: AnimeWatchStatus) {
        const titleId = statusTitleId(anime);
        if (!titleId || anime.watchStatus === status) {
            return;
        }

        try {
            statusUpdateInProgress = titleId;
            await invoke("update_anime_status", {
                titleId,
                status,
                isFavourite: anime.isFavourite,
            });
            displayItems = displayItems.map((item) =>
                item === anime ? { ...item, titleId, watchStatus: status } : item,
            );
            log(LogLevel.SUCCESS, `Zmieniono status anime: ${anime.name}`);
        } catch (e) {
            log(LogLevel.ERROR, `Nie udalo sie zapisac statusu anime w Shinden: ${e}`);
        } finally {
            statusUpdateInProgress = null;
        }
    }

    async function handleStatusChange(anime: DiscoveryAnime, event: Event) {
        const select = event.currentTarget as HTMLSelectElement;
        const status = select.value as AnimeWatchStatus;
        await updateStatus(anime, status);
        select.value = anime.watchStatus;
    }

    async function openInApp(anime: DiscoveryAnime) {
        const titleId = statusTitleId(anime);
        if (!titleId) {
            return;
        }

        params.seriesUrl = anime.url;
        params.titleId = titleId;
        params.animeWatchStatus = anime.watchStatus;
        params.animeIsFavourite = anime.isFavourite;
        params.animeTotalEpisodes = anime.totalEpisodes;
        params.episodeProgress = [];
        params.currentEpisodeIndex = -1;
        await goto("/episodes");
    }

    async function openOnShinden(anime: DiscoveryAnime) {
        try {
            await openUrl(anime.url);
        } catch (e) {
            log(LogLevel.ERROR, `Nie udalo sie otworzyc linku Shinden: ${e}`);
        }
    }
</script>

{#if displayItems.length > 0}
    <ul class="list bg-base-100 rounded-box shadow-md">
        <li class="p-4 pb-2 text-xs opacity-60 tracking-wide">{heading}</li>

        {#each displayItems as anime}
            <li class="list-row flex items-center justify-between">
                <div class="text-4xl font-thin opacity-30 tabular-nums">
                    {anime.rating || "-"}
                </div>
                <div>
                    <img class="w-12 rounded-box object-fill shadow-sm" src={anime.image_url} alt="anime" />
                </div>
                <div class="list-col-grow flex-1 min-w-0">
                    <div class="truncate">{anime.name}</div>
                    <div class="text-xs uppercase font-semibold opacity-60 truncate">
                        {anime.anime_type || "anime"}
                        {#if anime.episodes}
                            <span class="normal-case"> | {anime.episodes}</span>
                        {/if}
                        {#if anime.sourceLabel}
                            <span class="normal-case"> | {anime.sourceLabel}</span>
                        {/if}
                    </div>
                </div>

                {#if globalStates.user.name !== null && statusTitleId(anime)}
                    <select
                        class="select select-bordered select-sm w-36"
                        value={anime.watchStatus}
                        disabled={statusUpdateInProgress === statusTitleId(anime)}
                        aria-label="status anime"
                        onchange={(event) => { void handleStatusChange(anime, event); }}
                    >
                        <option value="no">Brak statusu</option>
                        {#each animeStatusOptions as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                {/if}

                <button
                    class="btn btn-square btn-ghost"
                    aria-label="otworz na Shinden"
                    title="Otworz na Shinden"
                    onclick={() => { void openOnShinden(anime); }}
                >
                    <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                            <path d="M14 3h7v7"></path>
                            <path d="M10 14 21 3"></path>
                            <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>
                        </g>
                    </svg>
                </button>

                <button
                    class="btn btn-square btn-ghost"
                    aria-label="odcinki"
                    disabled={!statusTitleId(anime)}
                    onclick={() => { void openInApp(anime); }}
                >
                    <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                            <path d="M6 3L20 12 6 21 6 3z"></path>
                        </g>
                    </svg>
                </button>
            </li>
        {/each}
    </ul>
{:else}
    <div class="bg-base-100 rounded-box shadow-md p-4">
        <Empty />
        <p class="text-xs opacity-60 text-center mt-2">{emptyLabel}</p>
    </div>
{/if}
```

- [ ] **Step 3: Run Svelte check and fix import name if needed**

Run:

```powershell
npm run check
```

Expected: if `@tauri-apps/plugin-opener` does not export `openUrl`, update the import to the exported function shown by the type error and keep the component API unchanged.

- [ ] **Step 4: Commit**

```powershell
git add -- src/lib/types.ts src/lib/DiscoveryAnimeList.svelte
git commit -m "feat: add discovery anime list component"
```

---

### Task 5: Home Page Premieres

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Update imports and state**

Replace the `<script>` block imports and local state in `src/routes/+page.svelte` with:

```svelte
<script lang="ts">
    import { globalStates, LoadingState, params } from "$lib/global.svelte.js";
    import { onMount } from "svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import { goto } from "$app/navigation";
    import type { DiscoveryAnime } from "$lib/types";
    import DiscoveryAnimeList from "$lib/DiscoveryAnimeList.svelte";

    let animeName: string = $state("");
    let premieres: DiscoveryAnime[] = $state([]);
    let premieresLoading = $state(false);

    globalStates.loadingState = LoadingState.LOADING;

    onMount(async () => {
        try {
            log(LogLevel.INFO, "Testing connection to http://shinden.pl");
            await invoke("test_connection");
            globalStates.loadingState = LoadingState.OK;
            log(LogLevel.SUCCESS, "Connection to http://shinden.pl established");
            await loadPremieres();
        } catch (error) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, "Error connection to http://shinden.pl");
        }
    });

    async function loadPremieres() {
        try {
            premieresLoading = true;
            premieres = await invoke<DiscoveryAnime[]>("get_main_premieres");
            log(LogLevel.SUCCESS, "Loaded Shinden premieres");
        } catch (e) {
            premieres = [];
            log(LogLevel.WARNING, `Nie udalo sie zaladowac nowosci Shinden: ${e}`);
        } finally {
            premieresLoading = false;
        }
    }

    function handleButton(event: Event) {
        event.preventDefault();
        params.animeName = animeName;
        goto("/search");
    }

    async function openSeasons() {
        await goto("/seasons");
    }
</script>
```

- [ ] **Step 2: Replace the home markup**

Replace the current markup in `src/routes/+page.svelte` with:

```svelte
<div class="min-h-full bg-base-100 p-4">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <section class="flex flex-col gap-6 rounded-box bg-base-100 py-4 md:flex-row md:items-center">
            <img
                src="/bg.jpg"
                class="w-full max-w-sm rounded-lg object-cover shadow-2xl"
                alt="anime"
            />
            <div class="flex flex-1 flex-col gap-4">
                <div>
                    <h1 class="text-5xl font-bold">Wyszukaj ulubione anime</h1>
                    <p class="py-6">Na co masz dzis ochote?</p>
                </div>

                <form class="join w-full" onsubmit={handleButton}>
                    <label class="input join-item w-full">
                        <svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2.5" fill="none" stroke="currentColor">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.3-4.3"></path>
                            </g>
                        </svg>
                        <input type="search" required bind:value={animeName} />
                    </label>
                    <button class="btn btn-primary join-item">Szukaj</button>
                    <button
                        type="button"
                        class="btn btn-ghost join-item"
                        aria-label="sezony"
                        onclick={() => { void openSeasons(); }}
                    >
                        Sezony
                    </button>
                </form>
            </div>
        </section>

        {#if premieresLoading}
            <div class="flex w-full flex-col gap-4">
                <div class="skeleton h-24 w-full"></div>
                <div class="skeleton h-24 w-full"></div>
                <div class="skeleton h-24 w-full"></div>
            </div>
        {:else}
            <DiscoveryAnimeList
                items={premieres}
                heading="Nowosci z Shinden:"
                emptyLabel="Nie znaleziono nowosci na stronie glownej Shinden."
            />
        {/if}
    </div>
</div>
```

- [ ] **Step 3: Run Svelte check**

Run:

```powershell
npm run check
```

Expected: Svelte check passes for the modified home page.

- [ ] **Step 4: Commit**

```powershell
git add -- src/routes/+page.svelte
git commit -m "feat: show Shinden premieres on home page"
```

---

### Task 6: Seasons Route

**Files:**
- Create: `src/routes/seasons/+page.svelte`

- [ ] **Step 1: Create the seasons route**

Create `src/routes/seasons/+page.svelte`:

```svelte
<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import type { DiscoveryAnime, SeasonOption, SeasonSlug } from "$lib/types";
    import { globalStates, LoadingState } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import DiscoveryAnimeList from "$lib/DiscoveryAnimeList.svelte";

    const seasonOptions: SeasonOption[] = [
        { value: "current", label: "Obecny sezon" },
        { value: "winter", label: "Zima" },
        { value: "spring", label: "Wiosna" },
        { value: "summer", label: "Lato" },
        { value: "fall", label: "Jesien" },
    ];

    let year = $state(new Date().getFullYear());
    let season: SeasonSlug = $state(defaultSeasonSlug());
    let result: DiscoveryAnime[] = $state([]);
    let loading = $state(false);

    onMount(() => {
        void loadSeasonAnime();
    });

    function defaultSeasonSlug(): SeasonSlug {
        const month = new Date().getMonth() + 1;
        if (month <= 3) return "winter";
        if (month <= 6) return "spring";
        if (month <= 9) return "summer";
        return "fall";
    }

    async function loadSeasonAnime() {
        try {
            loading = true;
            globalStates.loadingState = LoadingState.LOADING;
            result = await invoke<DiscoveryAnime[]>("get_season_anime", {
                year: season === "current" ? null : year,
                season,
            });
            globalStates.loadingState = result.length > 0 ? LoadingState.OK : LoadingState.WARNING;
            log(LogLevel.SUCCESS, "Loaded Shinden season anime");
        } catch (e) {
            result = [];
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `Nie udalo sie zaladowac sezonu Shinden: ${e}`);
        } finally {
            loading = false;
        }
    }
</script>

<div class="flex h-full w-full flex-col gap-3 overflow-y-scroll p-4">
    <section class="flex flex-col gap-3 bg-base-100 rounded-box shadow-md p-4">
        <div>
            <div class="text-xs opacity-60 tracking-wide uppercase">Sezony anime</div>
            <div class="text-sm opacity-80">Przegladaj sezonowe listy z Shinden i oznaczaj statusy.</div>
        </div>

        <div class="flex flex-wrap items-end gap-2">
            <label class="form-control w-32">
                <span class="label-text mb-1">Rok</span>
                <input
                    class="input input-bordered"
                    type="number"
                    min="2000"
                    max="2100"
                    bind:value={year}
                    disabled={season === "current"}
                />
            </label>

            <label class="form-control w-44">
                <span class="label-text mb-1">Sezon</span>
                <select class="select select-bordered" bind:value={season}>
                    {#each seasonOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </label>

            <button
                class="btn btn-primary"
                disabled={loading}
                onclick={() => { void loadSeasonAnime(); }}
            >
                Wczytaj
            </button>
        </div>
    </section>

    {#if loading}
        <div class="flex w-full flex-col gap-4">
            <div class="skeleton h-24 w-full"></div>
            <div class="skeleton h-24 w-full"></div>
            <div class="skeleton h-24 w-full"></div>
        </div>
    {:else}
        <DiscoveryAnimeList
            items={result}
            heading="Anime sezonowe:"
            emptyLabel="Nie znaleziono anime dla wybranego sezonu."
        />
    {/if}
</div>
```

- [ ] **Step 2: Run Svelte check**

Run:

```powershell
npm run check
```

Expected: Svelte check passes for the new route.

- [ ] **Step 3: Commit**

```powershell
git add -- src/routes/seasons/+page.svelte
git commit -m "feat: add Shinden seasons browser"
```

---

### Task 7: Full Verification And Polish

**Files:**
- Modify only files with verification failures.

- [ ] **Step 1: Run frontend type check**

Run:

```powershell
npm run check
```

Expected: command exits with code 0.

- [ ] **Step 2: Run Rust tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all Rust tests pass.

- [ ] **Step 3: Inspect git status**

Run:

```powershell
git status --short
```

Expected: only intended source changes are present. `.superpowers/` may appear untracked and should not be added.

- [ ] **Step 4: Manual smoke test**

Run the app with the existing project workflow:

```powershell
npm run tauri dev
```

Manual checks:

- Home page still searches normally.
- Home page renders `Nowosci z Shinden` or a graceful empty/warning state.
- `Sezony` opens `/seasons`.
- Choosing a season loads rows or a graceful empty/warning state.
- Logged-in status selects call `update_anime_status`.
- The app-open button navigates to `/episodes`.
- The Shinden-link button opens the Shinden anime page externally.

- [ ] **Step 5: Final commit for verification fixes if needed**

If Step 1 or Step 2 required code fixes, commit them:

```powershell
git add -- src src-tauri
git commit -m "fix: polish Shinden discovery flow"
```

If no fixes were needed, do not create an empty commit.
