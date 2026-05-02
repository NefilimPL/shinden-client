use reqwest::header::ACCEPT;
use serde::{Deserialize, Serialize};
use shinden_pl_api::client::ShindenAPI;
use shinden_pl_api::models::{Anime, Episode, Player};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const WATCHING_LIST_PAGE_LIMIT: usize = 100;
const WATCHING_CACHE_TTL_MS: u64 = 30 * 60 * 1000;
const SHINDEN_TITLE_PLACEHOLDER: &str =
    "https://shinden.pl/res/other/placeholders/title/100x100.jpg";

struct Api(ShindenAPI, Mutex<WatchingCacheRefreshStatus>);

#[derive(Debug, Deserialize)]
struct WatchingListApiResponse {
    success: bool,
    result: WatchingListApiResult,
}

#[derive(Debug, Deserialize)]
struct WatchingListApiResult {
    count: usize,
    items: Vec<WatchingListApiItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WatchingListApiItem {
    title_id: u64,
    title: String,
    cover_id: Option<u64>,
    anime_type: Option<String>,
    summary_rating_total: Option<String>,
    episodes: Option<u32>,
    watched_episodes_cnt: Option<String>,
    description_pl: Option<String>,
    description_en: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct WatchingAnimeFilter {
    only_available_unwatched: Option<bool>,
    subtitle_language: Option<String>,
    check_subtitle_availability_online: Option<bool>,
}

impl WatchingAnimeFilter {
    fn only_available_unwatched(&self) -> bool {
        self.only_available_unwatched.unwrap_or(false)
    }

    fn subtitle_language(&self) -> &str {
        self.subtitle_language.as_deref().unwrap_or_default()
    }

    fn check_subtitle_availability_online(&self) -> bool {
        self.check_subtitle_availability_online.unwrap_or(false)
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct WatchingAvailabilityCache {
    entries: HashMap<String, WatchingAvailabilityCacheEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct WatchingAvailabilityCacheEntry {
    title_id: u64,
    watched_episodes_cnt: u32,
    total_episodes: Option<u32>,
    has_available_unwatched_episode: bool,
    subtitle_availability: HashMap<String, bool>,
    checked_at_ms: u64,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct WatchingCacheRefreshStatus {
    running: bool,
    current: usize,
    total: usize,
    refreshed: usize,
    skipped: usize,
    failed: usize,
    current_title: String,
    last_finished_at_ms: Option<u64>,
    last_error: Option<String>,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct WatchingCacheRefreshSummary {
    status: WatchingCacheRefreshStatus,
    already_running: bool,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn write_log(level: String, message: String) -> Result<(), String> {
    discard_log_path(append_project_log(&level, &message))
}

#[tauri::command]
async fn test_connection(state: tauri::State<'_, Api>) -> Result<(), String> {
    match state.0.get_html("http://shinden.pl").await {
        Ok(_) => Ok(()),
        Err(e) => Err(command_error(
            "test_connection",
            format!("Connection failed: {}", e),
        )),
    }
}

#[tauri::command]
async fn search(state: tauri::State<'_, Api>, query: String) -> Result<Vec<Anime>, String> {
    state
        .0
        .search_anime(&query)
        .await
        .map_err(|e| command_error("search", e))
}

#[tauri::command]
async fn get_watching_anime(
    state: tauri::State<'_, Api>,
    filter: Option<WatchingAnimeFilter>,
) -> Result<Vec<Anime>, String> {
    let filter = filter.unwrap_or_default();
    let cache = load_watching_availability_cache();
    let items = fetch_all_watching_items(&state.0).await?;

    Ok(items
        .into_iter()
        .filter(|item| watching_cache_filter_matches(item, &filter, &cache))
        .filter_map(map_watching_list_item)
        .collect())
}

#[tauri::command]
fn get_watching_cache_refresh_status(
    state: tauri::State<'_, Api>,
) -> Result<WatchingCacheRefreshStatus, String> {
    refresh_status_snapshot(&state.1)
}

#[tauri::command]
async fn refresh_watching_anime_cache(
    state: tauri::State<'_, Api>,
    filter: Option<WatchingAnimeFilter>,
    force: Option<bool>,
) -> Result<WatchingCacheRefreshSummary, String> {
    let filter = filter.unwrap_or_default();
    let force = force.unwrap_or(false);

    {
        let mut status = lock_refresh_status(&state.1)?;
        if status.running {
            return Ok(WatchingCacheRefreshSummary {
                status: status.clone(),
                already_running: true,
            });
        }

        *status = WatchingCacheRefreshStatus {
            running: true,
            current: 0,
            total: 0,
            refreshed: 0,
            skipped: 0,
            failed: 0,
            current_title: String::new(),
            last_finished_at_ms: status.last_finished_at_ms,
            last_error: None,
        };
    }

    let refresh_result = refresh_watching_cache_inner(&state.0, &state.1, &filter, force).await;

    match refresh_result {
        Ok(status) => Ok(WatchingCacheRefreshSummary {
            status,
            already_running: false,
        }),
        Err(error) => {
            update_refresh_status(&state.1, |status| {
                status.running = false;
                status.current_title.clear();
                status.last_finished_at_ms = Some(unix_timestamp_ms_u64());
                status.last_error = Some(error.clone());
            })?;
            Err(error)
        }
    }
}

async fn fetch_all_watching_items(api: &ShindenAPI) -> Result<Vec<WatchingListApiItem>, String> {
    let profile_html = api
        .get_html("https://shinden.pl/user")
        .await
        .map_err(|e| command_error("get_watching_anime profile", e))?;
    let user_id = extract_user_id_from_profile_html(&profile_html)
        .ok_or_else(|| command_error("get_watching_anime profile", "User is not logged in"))?;

    let mut offset = 0;
    let mut items = Vec::new();

    loop {
        let page = fetch_watching_list_page(api, &user_id, WATCHING_LIST_PAGE_LIMIT, offset).await?;
        let loaded = page.items.len();
        let total = page.count;

        items.extend(page.items);

        offset += loaded;
        if loaded == 0 || offset >= total {
            break;
        }
    }

    Ok(items)
}

#[tauri::command]
async fn login(
    state: tauri::State<'_, Api>,
    username: String,
    password: String,
) -> Result<(), String> {
    state
        .0
        .login(&username, &password)
        .await
        .map_err(|e| command_error("login", e))
}

#[tauri::command]
async fn logout(state: tauri::State<'_, Api>) -> Result<(), String> {
    state.0.logout().await.map_err(|e| command_error("logout", e))
}

#[tauri::command]
async fn get_user_name(state: tauri::State<'_, Api>) -> Result<Option<String>, String> {
    state
        .0
        .get_user_name()
        .await
        .map_err(|e| command_error("get_user_name", e))
}

#[tauri::command]
async fn get_user_profile_image(state: tauri::State<'_, Api>) -> Result<Option<String>, String> {
    state
        .0
        .get_user_profile_image()
        .await
        .map_err(|e| command_error("get_user_profile_image", e))
}

#[tauri::command]
async fn get_episodes(state: tauri::State<'_, Api>, url: String) -> Result<Vec<Episode>, String> {
    state
        .0
        .get_episodes(&url)
        .await
        .map_err(|e| command_error("get_episodes", e))
}

#[tauri::command]
async fn get_players(state: tauri::State<'_, Api>, url: String) -> Result<Vec<Player>, String> {
    state
        .0
        .get_players(&url)
        .await
        .map_err(|e| command_error("get_players", e))
}

#[tauri::command]
async fn get_iframe(state: tauri::State<'_, Api>, id: String) -> Result<String, String> {
    state
        .0
        .get_player_iframe(&id)
        .await
        .map_err(|e| command_error("get_iframe", e))
}

#[tauri::command]
async fn get_cda_video(_state: tauri::State<'_, Api>, url: String) -> Result<String, String> {
    let url_clone = url.clone();
    tauri::async_runtime::spawn_blocking(move || {
        tauri::async_runtime::block_on(async {
            cda_dl::get_video_url(&url_clone)
                .await
                .map_err(|e| command_error("get_cda_video", e))
        })
    })
    .await
    .map_err(|e| command_error("get_cda_video task", e))?
}

async fn fetch_watching_list_page(
    api: &ShindenAPI,
    user_id: &str,
    limit: usize,
    offset: usize,
) -> Result<WatchingListApiResult, String> {
    let url = watching_list_url(user_id, limit, offset);
    let response = api
        .client
        .get(&url)
        .header(ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| command_error("get_watching_anime request", e))?
        .error_for_status()
        .map_err(|e| command_error("get_watching_anime response", e))?;
    let payload = response
        .json::<WatchingListApiResponse>()
        .await
        .map_err(|e| command_error("get_watching_anime json", e))?;

    if !payload.success {
        return Err(command_error(
            "get_watching_anime json",
            "List API returned success=false",
        ));
    }

    Ok(payload.result)
}

async fn refresh_watching_cache_inner(
    api: &ShindenAPI,
    status: &Mutex<WatchingCacheRefreshStatus>,
    filter: &WatchingAnimeFilter,
    force: bool,
) -> Result<WatchingCacheRefreshStatus, String> {
    let items = fetch_all_watching_items(api).await?;
    let mut cache = load_watching_availability_cache();
    let subtitle_key = selected_subtitle_language_key(filter);
    let now_ms = unix_timestamp_ms_u64();

    update_refresh_status(status, |status| {
        status.total = items.len();
    })?;

    for (index, item) in items.iter().enumerate() {
        update_refresh_status(status, |status| {
            status.current = index + 1;
            status.current_title = item.title.clone();
        })?;

        if !has_unwatched_episodes(item) {
            update_refresh_status(status, |status| {
                status.skipped += 1;
            })?;
            continue;
        }

        let cache_key = watching_cache_key(item.title_id);
        if cache
            .entries
            .get(&cache_key)
            .is_some_and(|entry| {
                cache_entry_satisfies_refresh(
                    entry,
                    item,
                    subtitle_key.as_deref(),
                    now_ms,
                    force,
                )
            })
        {
            update_refresh_status(status, |status| {
                status.skipped += 1;
            })?;
            continue;
        }

        match scan_watching_item_availability(api, item, subtitle_key.as_deref()).await {
            Ok(entry) => {
                cache.entries.insert(cache_key, entry);
                save_watching_availability_cache(&cache)?;
                update_refresh_status(status, |status| {
                    status.refreshed += 1;
                })?;
            }
            Err(error) => {
                update_refresh_status(status, |status| {
                    status.failed += 1;
                    status.last_error = Some(error.clone());
                })?;
            }
        }
    }

    update_refresh_status(status, |status| {
        status.running = false;
        status.current_title.clear();
        status.last_finished_at_ms = Some(unix_timestamp_ms_u64());
    })?;

    refresh_status_snapshot(status)
}

async fn scan_watching_item_availability(
    api: &ShindenAPI,
    item: &WatchingListApiItem,
    subtitle_key: Option<&str>,
) -> Result<WatchingAvailabilityCacheEntry, String> {
    let series_url = series_url(item.title_id);
    let episodes = api
        .get_episodes(&series_url)
        .await
        .map_err(|e| command_error("get_watching_anime episodes", e))?;
    let watched_count = watched_episode_count(item) as usize;
    let mut has_available_unwatched_episode = false;
    let mut subtitle_availability = HashMap::new();

    for episode in episodes.into_iter().skip(watched_count) {
        let players = api
            .get_players(&episode.link)
            .await
            .map_err(|e| command_error("get_watching_anime players", e))?;

        if players.is_empty() {
            continue;
        }

        has_available_unwatched_episode = true;

        if let Some(key) = subtitle_key {
            if players
                .iter()
                .any(|player| subtitle_language_matches(&player.lang_subs, key))
            {
                subtitle_availability.insert(key.to_string(), true);
                break;
            }
        } else {
            break;
        }
    }

    if let Some(key) = subtitle_key {
        subtitle_availability.entry(key.to_string()).or_insert(false);
    }

    Ok(WatchingAvailabilityCacheEntry {
        title_id: item.title_id,
        watched_episodes_cnt: watched_episode_count(item),
        total_episodes: item.episodes,
        has_available_unwatched_episode,
        subtitle_availability,
        checked_at_ms: unix_timestamp_ms_u64(),
    })
}

fn watching_list_url(user_id: &str, limit: usize, offset: usize) -> String {
    format!(
        "https://lista.shinden.pl/api/userlist/{user_id}/anime/in-progress?limit={limit}&offset={offset}"
    )
}

fn series_url(title_id: u64) -> String {
    format!("https://shinden.pl/series/{title_id}")
}

fn extract_user_id_from_profile_html(html: &str) -> Option<String> {
    ["https://lista.shinden.pl/animelist/", "/animelist/"]
        .iter()
        .find_map(|marker| extract_ascii_digits_after(html, marker))
}

fn extract_ascii_digits_after(source: &str, marker: &str) -> Option<String> {
    let start = source.find(marker)? + marker.len();
    let digits: String = source[start..]
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect();

    if digits.is_empty() {
        None
    } else {
        Some(digits)
    }
}

fn map_watching_list_item(item: WatchingListApiItem) -> Option<Anime> {
    let name = item.title.trim().to_string();
    if name.is_empty() {
        return None;
    }

    Some(Anime {
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
    })
}

fn has_unwatched_episodes(item: &WatchingListApiItem) -> bool {
    match item.episodes {
        Some(total) => watched_episode_count(item) < total,
        None => true,
    }
}

fn watching_progress_filter_matches(
    item: &WatchingListApiItem,
    filter: &WatchingAnimeFilter,
) -> bool {
    !filter.only_available_unwatched() || has_unwatched_episodes(item)
}

fn watching_cache_filter_matches(
    item: &WatchingListApiItem,
    filter: &WatchingAnimeFilter,
    cache: &WatchingAvailabilityCache,
) -> bool {
    if !watching_progress_filter_matches(item, filter) {
        return false;
    }

    if !filter.only_available_unwatched() {
        return true;
    }

    let Some(entry) = cache.entries.get(&watching_cache_key(item.title_id)) else {
        return false;
    };

    if !cache_entry_matches_item(entry, item) || !entry.has_available_unwatched_episode {
        return false;
    }

    selected_subtitle_language_key(filter)
        .map(|key| {
            entry
                .subtitle_availability
                .get(&key)
                .copied()
                .unwrap_or(false)
        })
        .unwrap_or(true)
}

fn cache_entry_matches_item(
    entry: &WatchingAvailabilityCacheEntry,
    item: &WatchingListApiItem,
) -> bool {
    entry.title_id == item.title_id
        && entry.watched_episodes_cnt == watched_episode_count(item)
        && entry.total_episodes == item.episodes
}

fn cache_entry_satisfies_refresh(
    entry: &WatchingAvailabilityCacheEntry,
    item: &WatchingListApiItem,
    subtitle_key: Option<&str>,
    now_ms: u64,
    force: bool,
) -> bool {
    if force || !cache_entry_matches_item(entry, item) {
        return false;
    }

    if now_ms.saturating_sub(entry.checked_at_ms) > WATCHING_CACHE_TTL_MS {
        return false;
    }

    subtitle_key
        .map(|key| entry.subtitle_availability.contains_key(key))
        .unwrap_or(true)
}

fn selected_subtitle_language_key(filter: &WatchingAnimeFilter) -> Option<String> {
    if !filter.check_subtitle_availability_online() {
        return None;
    }

    let key = subtitle_language_key(filter.subtitle_language());
    if key.is_empty() || key == "any" {
        None
    } else {
        Some(key)
    }
}

fn watching_cache_key(title_id: u64) -> String {
    title_id.to_string()
}

fn watched_episode_count(item: &WatchingListApiItem) -> u32 {
    item.watched_episodes_cnt
        .as_deref()
        .and_then(|watched| watched.trim().parse::<u32>().ok())
        .unwrap_or_default()
}

fn subtitle_language_matches(player_lang_subs: &str, selected_language: &str) -> bool {
    let selected_language = selected_language.trim();
    if selected_language.is_empty() {
        return true;
    }

    let selected_key = subtitle_language_key(selected_language);
    if selected_key == "any" {
        return true;
    }

    let player_key = subtitle_language_key(player_lang_subs);
    player_key == selected_key
        || player_lang_subs
            .to_ascii_lowercase()
            .contains(&selected_language.to_ascii_lowercase())
}

fn subtitle_language_key(language: &str) -> String {
    let language = language.trim().to_ascii_lowercase();

    if language == "any"
        || language == "dowolny"
        || language == "dowolne"
        || language == "wszystkie"
    {
        return "any".to_string();
    }

    if language == "pl"
        || language.contains("pol")
        || language
            .split(|character: char| !character.is_ascii_alphanumeric())
            .any(|token| token == "pl")
    {
        return "pl".to_string();
    }

    if language == "en"
        || language == "eng"
        || language.contains("ang")
        || language.contains("english")
    {
        return "en".to_string();
    }

    if language == "jp"
        || language == "ja"
        || language.contains("jap")
        || language.contains("japo")
    {
        return "jp".to_string();
    }

    language
}

fn format_rating(raw_rating: Option<&str>) -> String {
    raw_rating
        .and_then(|rating| rating.parse::<f64>().ok())
        .map(|rating| format!("{rating:.2}").replace('.', ","))
        .unwrap_or_default()
}

fn format_episode_progress(watched: Option<&str>, total: Option<u32>) -> String {
    match (watched, total) {
        (Some(watched), Some(total)) => format!("{watched}/{total}"),
        (None, Some(total)) => format!("0/{total}"),
        (Some(watched), None) => watched.to_string(),
        (None, None) => String::new(),
    }
}

fn load_watching_availability_cache() -> WatchingAvailabilityCache {
    load_watching_availability_cache_from(&watching_availability_cache_path())
}

fn load_watching_availability_cache_from(path: &Path) -> WatchingAvailabilityCache {
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<WatchingAvailabilityCache>(&contents).ok())
        .unwrap_or_default()
}

fn save_watching_availability_cache(cache: &WatchingAvailabilityCache) -> Result<(), String> {
    save_watching_availability_cache_to(&watching_availability_cache_path(), cache)
        .map_err(|e| command_error("watching_cache save", e))
}

fn save_watching_availability_cache_to(
    path: &Path,
    cache: &WatchingAvailabilityCache,
) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let contents = serde_json::to_string_pretty(cache)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    fs::write(path, contents)
}

fn watching_availability_cache_path() -> PathBuf {
    resolve_project_cache_dir().join("watching-anime-cache.json")
}

fn lock_refresh_status(
    status: &Mutex<WatchingCacheRefreshStatus>,
) -> Result<std::sync::MutexGuard<'_, WatchingCacheRefreshStatus>, String> {
    status
        .lock()
        .map_err(|_| command_error("watching_cache status", "Status lock poisoned"))
}

fn refresh_status_snapshot(
    status: &Mutex<WatchingCacheRefreshStatus>,
) -> Result<WatchingCacheRefreshStatus, String> {
    Ok(lock_refresh_status(status)?.clone())
}

fn update_refresh_status<F>(
    status: &Mutex<WatchingCacheRefreshStatus>,
    update: F,
) -> Result<(), String>
where
    F: FnOnce(&mut WatchingCacheRefreshStatus),
{
    let mut status = lock_refresh_status(status)?;
    update(&mut status);
    Ok(())
}

fn command_error<E: ToString>(context: &str, error: E) -> String {
    let message = error.to_string();
    let _ = append_project_log("ERROR", &format!("{context}: {message}"));
    message
}

fn append_project_log(level: &str, message: &str) -> io::Result<PathBuf> {
    append_log_line(&resolve_project_log_dir(), level, message)
}

fn discard_log_path(result: io::Result<PathBuf>) -> Result<(), String> {
    result.map(|_| ()).map_err(|e| e.to_string())
}

fn append_log_line(log_dir: &Path, level: &str, message: &str) -> io::Result<PathBuf> {
    fs::create_dir_all(log_dir)?;
    let log_file = log_dir.join("shinden-client.log");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)?;
    writeln!(file, "{} [{level}] {message}", unix_timestamp_ms())?;
    Ok(log_file)
}

fn unix_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn unix_timestamp_ms_u64() -> u64 {
    unix_timestamp_ms().min(u64::MAX as u128) as u64
}

fn resolve_project_log_dir() -> PathBuf {
    if let Ok(path) = std::env::var("SHINDEN_CLIENT_LOG_DIR") {
        if !path.trim().is_empty() {
            return PathBuf::from(path);
        }
    }

    if let Some(root) = option_env!("SHINDEN_BUILD_PROJECT_ROOT") {
        let path = PathBuf::from(root);
        if is_project_root(&path) {
            return path.join("logs");
        }
    }

    let mut starts = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            starts.push(parent.to_path_buf());
        }
    }
    if let Ok(current_dir) = std::env::current_dir() {
        starts.push(current_dir);
    }

    for start in starts {
        if let Some(root) = find_project_root_from(&start) {
            return root.join("logs");
        }
    }

    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("logs")
}

fn resolve_project_cache_dir() -> PathBuf {
    if let Ok(path) = std::env::var("SHINDEN_CLIENT_CACHE_DIR") {
        if !path.trim().is_empty() {
            return PathBuf::from(path);
        }
    }

    if let Some(root) = option_env!("SHINDEN_BUILD_PROJECT_ROOT") {
        let path = PathBuf::from(root);
        if is_project_root(&path) {
            return path.join("cache");
        }
    }

    let mut starts = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            starts.push(parent.to_path_buf());
        }
    }
    if let Ok(current_dir) = std::env::current_dir() {
        starts.push(current_dir);
    }

    for start in starts {
        if let Some(root) = find_project_root_from(&start) {
            return root.join("cache");
        }
    }

    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("cache")
}

fn find_project_root_from(start: &Path) -> Option<PathBuf> {
    start.ancestors().find(|path| is_project_root(path)).map(PathBuf::from)
}

fn is_project_root(path: &Path) -> bool {
    path.join("package.json").is_file() && path.join("src-tauri").join("tauri.conf.json").is_file()
}

fn install_panic_logger() {
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let payload = panic_info
            .payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| panic_info.payload().downcast_ref::<String>().map(String::as_str))
            .unwrap_or("unknown panic payload");
        let location = panic_info
            .location()
            .map(|location| format!("{}:{}", location.file(), location.line()))
            .unwrap_or_else(|| "unknown location".to_string());
        let _ = append_project_log("PANIC", &format!("{payload} at {location}"));
        previous_hook(panic_info);
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_logger();

    let api = match ShindenAPI::new() {
        Ok(api) => api,
        Err(error) => {
            let _ = append_project_log("FATAL", &format!("Failed to create ShindenAPI: {error}"));
            panic!("Failed to create ShindenAPI: {error}");
        }
    };

    if let Err(error) = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .manage(Api(api, Mutex::new(WatchingCacheRefreshStatus::default())))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            write_log,
            test_connection,
            search,
            get_watching_anime,
            get_watching_cache_refresh_status,
            refresh_watching_anime_cache,
            login,
            get_user_name,
            get_user_profile_image,
            logout,
            get_episodes,
            get_players,
            get_iframe,
            get_cda_video
        ])
        .run(tauri::generate_context!())
    {
        let _ = append_project_log(
            "FATAL",
            &format!("error while running tauri application: {error}"),
        );
        panic!("error while running tauri application: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX_EPOCH")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "shinden_client_{}_{}_{}",
            name,
            std::process::id(),
            stamp
        ))
    }

    #[test]
    fn find_project_root_from_detects_repository_markers() {
        let root = unique_temp_dir("root_markers");
        let nested = root.join("src-tauri").join("target").join("release");
        fs::create_dir_all(&nested).expect("failed to create nested test directory");
        fs::write(root.join("package.json"), "{}").expect("failed to create package marker");
        fs::write(root.join("src-tauri").join("tauri.conf.json"), "{}")
            .expect("failed to create tauri marker");

        let found = find_project_root_from(&nested);

        assert_eq!(found.as_deref(), Some(root.as_path()));
        fs::remove_dir_all(root).expect("failed to remove test directory");
    }

    #[test]
    fn append_log_line_writes_exceptions_to_project_log_file() {
        let log_dir = unique_temp_dir("logs");

        let path = append_log_line(&log_dir, "ERROR", "example exception")
            .expect("failed to append log line");

        assert_eq!(path, log_dir.join("shinden-client.log"));
        let contents = fs::read_to_string(path).expect("failed to read log file");
        assert!(contents.contains("[ERROR] example exception"));
        fs::remove_dir_all(log_dir).expect("failed to remove log directory");
    }

    #[test]
    fn write_log_command_discards_log_file_path() {
        let result: Result<(), String> =
            discard_log_path(Ok(PathBuf::from("shinden-client.log")));

        assert_eq!(result, Ok(()));
    }

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
        assert_eq!(
            anime.image_url,
            "https://cdn.shinden.eu/cdn1/images/genuine/123456.jpg"
        );
        assert_eq!(anime.anime_type, "TV");
        assert_eq!(anime.rating, "7,90");
        assert_eq!(anime.episodes, "3/12");
        assert_eq!(anime.description, "Opis");
    }

    #[test]
    fn watching_list_url_uses_in_progress_status() {
        let url = watching_list_url("31875", 100, 200);

        assert_eq!(
            url,
            "https://lista.shinden.pl/api/userlist/31875/anime/in-progress?limit=100&offset=200"
        );
    }

    fn watching_item(watched: Option<&str>, episodes: Option<u32>) -> WatchingListApiItem {
        WatchingListApiItem {
            title_id: 59922,
            title: "Enen no Shouboutai: San no Shou".to_string(),
            cover_id: None,
            anime_type: None,
            summary_rating_total: None,
            episodes,
            watched_episodes_cnt: watched.map(str::to_string),
            description_pl: None,
            description_en: None,
        }
    }

    #[test]
    fn has_unwatched_episodes_compares_watched_count_to_total() {
        assert!(has_unwatched_episodes(&watching_item(Some("2"), Some(3))));
        assert!(!has_unwatched_episodes(&watching_item(Some("3"), Some(3))));
        assert!(has_unwatched_episodes(&watching_item(None, Some(1))));
    }

    #[test]
    fn subtitle_language_matches_common_aliases() {
        assert!(subtitle_language_matches("Polski", "PL"));
        assert!(subtitle_language_matches("Napisy PL", "polski"));
        assert!(subtitle_language_matches("English", "EN"));
        assert!(!subtitle_language_matches("Angielski", "PL"));
    }

    #[test]
    fn watching_progress_filter_includes_all_items_when_disabled() {
        let filter = WatchingAnimeFilter::default();

        assert!(watching_progress_filter_matches(
            &watching_item(Some("3"), Some(3)),
            &filter
        ));
    }

    #[test]
    fn watching_progress_filter_uses_local_unwatched_counts() {
        let filter = WatchingAnimeFilter {
            only_available_unwatched: Some(true),
            ..Default::default()
        };

        assert!(watching_progress_filter_matches(
            &watching_item(Some("2"), Some(3)),
            &filter
        ));
        assert!(!watching_progress_filter_matches(
            &watching_item(Some("3"), Some(3)),
            &filter
        ));
    }

    #[test]
    fn subtitle_availability_online_check_is_opt_in() {
        assert!(!WatchingAnimeFilter::default().check_subtitle_availability_online());

        let filter = WatchingAnimeFilter {
            check_subtitle_availability_online: Some(true),
            ..Default::default()
        };

        assert!(filter.check_subtitle_availability_online());
    }

    #[test]
    fn cache_filter_hides_items_without_confirmed_available_episode() {
        let item = watching_item(Some("2"), Some(3));
        let filter = WatchingAnimeFilter {
            only_available_unwatched: Some(true),
            ..Default::default()
        };
        let mut cache = WatchingAvailabilityCache::default();

        assert!(!watching_cache_filter_matches(&item, &filter, &cache));

        cache.entries.insert(
            "59922".to_string(),
            WatchingAvailabilityCacheEntry {
                title_id: 59922,
                watched_episodes_cnt: 2,
                total_episodes: Some(3),
                has_available_unwatched_episode: false,
                subtitle_availability: Default::default(),
                checked_at_ms: 1000,
            },
        );

        assert!(!watching_cache_filter_matches(&item, &filter, &cache));
    }

    #[test]
    fn cache_filter_uses_cached_subtitle_language_availability() {
        let item = watching_item(Some("2"), Some(3));
        let filter = WatchingAnimeFilter {
            only_available_unwatched: Some(true),
            check_subtitle_availability_online: Some(true),
            subtitle_language: Some("PL".to_string()),
        };
        let mut subtitle_availability = std::collections::HashMap::new();
        subtitle_availability.insert("pl".to_string(), true);
        let mut cache = WatchingAvailabilityCache::default();
        cache.entries.insert(
            "59922".to_string(),
            WatchingAvailabilityCacheEntry {
                title_id: 59922,
                watched_episodes_cnt: 2,
                total_episodes: Some(3),
                has_available_unwatched_episode: true,
                subtitle_availability,
                checked_at_ms: 1000,
            },
        );

        assert!(watching_cache_filter_matches(&item, &filter, &cache));

        let english_filter = WatchingAnimeFilter {
            only_available_unwatched: Some(true),
            check_subtitle_availability_online: Some(true),
            subtitle_language: Some("EN".to_string()),
        };

        assert!(!watching_cache_filter_matches(
            &item,
            &english_filter,
            &cache
        ));
    }

    #[test]
    fn fresh_cache_entry_skips_refresh_only_when_requested_language_is_cached() {
        let item = watching_item(Some("2"), Some(3));
        let mut subtitle_availability = std::collections::HashMap::new();
        subtitle_availability.insert("pl".to_string(), true);
        let entry = WatchingAvailabilityCacheEntry {
            title_id: 59922,
            watched_episodes_cnt: 2,
            total_episodes: Some(3),
            has_available_unwatched_episode: true,
            subtitle_availability,
            checked_at_ms: 10_000,
        };

        assert!(cache_entry_satisfies_refresh(
            &entry,
            &item,
            Some("pl"),
            10_500,
            false
        ));
        assert!(!cache_entry_satisfies_refresh(
            &entry,
            &item,
            Some("en"),
            10_500,
            false
        ));
        assert!(!cache_entry_satisfies_refresh(
            &entry,
            &item,
            Some("pl"),
            10_500,
            true
        ));
    }
}
