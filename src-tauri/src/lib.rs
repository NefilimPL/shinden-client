use shinden_pl_api::client_backend::{
    append_project_log, command_error, DiscoveryAnime, EpisodeProgress, SearchAnime,
    ShindenClientBackend, WatchingAnime, WatchingAnimeFilter, WatchingCacheRefreshStatus,
    WatchingCacheRefreshSummary,
};
use shinden_pl_api::details::{AnimeDetails, AnimeRatingUpdate};
use shinden_pl_api::models::{Episode, Player};

mod updater_commands;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn write_log(
    state: tauri::State<'_, ShindenClientBackend>,
    level: String,
    message: String,
) -> Result<(), String> {
    state.write_log(level, message)
}

#[tauri::command]
async fn test_connection(state: tauri::State<'_, ShindenClientBackend>) -> Result<(), String> {
    state.test_connection().await
}

#[tauri::command]
async fn search(
    state: tauri::State<'_, ShindenClientBackend>,
    query: String,
) -> Result<Vec<SearchAnime>, String> {
    state.search(query).await
}

#[tauri::command]
async fn get_main_premieres(
    state: tauri::State<'_, ShindenClientBackend>,
) -> Result<Vec<DiscoveryAnime>, String> {
    state.get_main_premieres().await
}

#[tauri::command]
async fn get_season_anime(
    state: tauri::State<'_, ShindenClientBackend>,
    year: Option<u16>,
    season: String,
) -> Result<Vec<DiscoveryAnime>, String> {
    state.get_season_anime(year, season).await
}

#[tauri::command]
async fn get_anime_details(
    state: tauri::State<'_, ShindenClientBackend>,
    url: String,
) -> Result<AnimeDetails, String> {
    state.get_anime_details(url).await
}

#[tauri::command]
async fn get_watching_anime(
    state: tauri::State<'_, ShindenClientBackend>,
    filter: Option<WatchingAnimeFilter>,
) -> Result<Vec<WatchingAnime>, String> {
    state.get_watching_anime(filter).await
}

#[tauri::command]
async fn get_episodes_with_progress(
    state: tauri::State<'_, ShindenClientBackend>,
    url: String,
    title_id: Option<u64>,
    total_episodes: Option<u32>,
) -> Result<Vec<EpisodeProgress>, String> {
    state
        .get_episodes_with_progress(url, title_id, total_episodes)
        .await
}

#[tauri::command]
async fn update_anime_status(
    state: tauri::State<'_, ShindenClientBackend>,
    title_id: u64,
    status: Option<String>,
    is_favourite: Option<u8>,
) -> Result<(), String> {
    state
        .update_anime_status(title_id, status, is_favourite)
        .await
}

#[tauri::command]
async fn update_anime_rating(
    state: tauri::State<'_, ShindenClientBackend>,
    update: AnimeRatingUpdate,
) -> Result<(), String> {
    state.update_anime_rating(update).await
}

#[tauri::command]
async fn mark_episode_watched(
    state: tauri::State<'_, ShindenClientBackend>,
    title_id: u64,
    episode_id: u64,
    created_time: String,
) -> Result<(), String> {
    state
        .mark_episode_watched(title_id, episode_id, created_time)
        .await
}

#[tauri::command]
async fn mark_episode_unwatched(
    state: tauri::State<'_, ShindenClientBackend>,
    title_id: u64,
    episode_id: u64,
    created_time: String,
) -> Result<(), String> {
    state
        .mark_episode_unwatched(title_id, episode_id, created_time)
        .await
}

#[tauri::command]
fn get_watching_cache_refresh_status(
    state: tauri::State<'_, ShindenClientBackend>,
) -> Result<WatchingCacheRefreshStatus, String> {
    state.get_watching_cache_refresh_status()
}

#[tauri::command]
async fn refresh_watching_anime_cache(
    state: tauri::State<'_, ShindenClientBackend>,
    filter: Option<WatchingAnimeFilter>,
    force: Option<bool>,
) -> Result<WatchingCacheRefreshSummary, String> {
    state.refresh_watching_anime_cache(filter, force).await
}

#[tauri::command]
async fn refresh_watching_anime_cache_item(
    state: tauri::State<'_, ShindenClientBackend>,
    title_id: u64,
    filter: Option<WatchingAnimeFilter>,
    force: Option<bool>,
) -> Result<WatchingCacheRefreshSummary, String> {
    state
        .refresh_watching_anime_cache_item(title_id, filter, force)
        .await
}

#[tauri::command]
async fn login(
    state: tauri::State<'_, ShindenClientBackend>,
    username: String,
    password: String,
) -> Result<(), String> {
    state.login(username, password).await
}

#[tauri::command]
async fn logout(state: tauri::State<'_, ShindenClientBackend>) -> Result<(), String> {
    state.logout().await
}

#[tauri::command]
async fn get_user_name(
    state: tauri::State<'_, ShindenClientBackend>,
) -> Result<Option<String>, String> {
    state.get_user_name().await
}

#[tauri::command]
async fn get_user_profile_image(
    state: tauri::State<'_, ShindenClientBackend>,
) -> Result<Option<String>, String> {
    state.get_user_profile_image().await
}

#[tauri::command]
async fn get_episodes(
    state: tauri::State<'_, ShindenClientBackend>,
    url: String,
) -> Result<Vec<Episode>, String> {
    state.get_episodes(url).await
}

#[tauri::command]
async fn get_players(
    state: tauri::State<'_, ShindenClientBackend>,
    url: String,
) -> Result<Vec<Player>, String> {
    state.get_players(url).await
}

#[tauri::command]
async fn get_iframe(
    state: tauri::State<'_, ShindenClientBackend>,
    id: String,
) -> Result<String, String> {
    state.get_iframe(id).await
}

#[tauri::command]
async fn get_cda_video(url: String) -> Result<String, String> {
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

#[tauri::command]
async fn install_update_from_manifest(
    app: tauri::AppHandle,
    tag: String,
) -> Result<(), String> {
    updater_commands::install_update_from_manifest(app, tag).await
}

fn install_panic_logger() {
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let payload = panic_info
            .payload()
            .downcast_ref::<&str>()
            .map(|message| (*message).to_string())
            .or_else(|| {
                panic_info
                    .payload()
                    .downcast_ref::<String>()
                    .map(Clone::clone)
            })
            .unwrap_or_else(|| "panic payload unavailable".to_string());
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

    let backend = match ShindenClientBackend::new() {
        Ok(backend) => backend,
        Err(error) => {
            let _ = append_project_log("FATAL", &error);
            panic!("{error}");
        }
    };

    if let Err(error) = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .manage(backend)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            write_log,
            test_connection,
            search,
            get_main_premieres,
            get_season_anime,
            get_anime_details,
            get_watching_anime,
            get_episodes_with_progress,
            update_anime_status,
            update_anime_rating,
            mark_episode_watched,
            mark_episode_unwatched,
            get_watching_cache_refresh_status,
            refresh_watching_anime_cache,
            refresh_watching_anime_cache_item,
            login,
            logout,
            get_user_name,
            get_user_profile_image,
            get_episodes,
            get_players,
            get_iframe,
            get_cda_video,
            install_update_from_manifest
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
mod updater_command_tests {
    use super::updater_commands::{release_manifest_endpoint, release_version_from_tag};

    #[test]
    fn release_manifest_endpoint_accepts_known_release_tags() {
        assert_eq!(
            release_manifest_endpoint("V4.0.5").unwrap(),
            "https://github.com/NefilimPL/shinden-client/releases/download/V4.0.5/latest.json"
        );
        assert_eq!(release_version_from_tag("app-v4.0.3").unwrap(), "4.0.3");
    }

    #[test]
    fn release_manifest_endpoint_rejects_invalid_release_tags() {
        assert!(release_manifest_endpoint("../V4.0.5").is_err());
        assert!(release_manifest_endpoint("nightly").is_err());
        assert!(release_manifest_endpoint("").is_err());
    }
}
