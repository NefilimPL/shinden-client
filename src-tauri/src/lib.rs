use scraper::{Html, Selector};
use shinden_pl_api::client::ShindenAPI;
use shinden_pl_api::models::{Anime, Episode, Player};

fn parse_watching_list(html: &str) -> Vec<Anime> {
    let doc = Html::parse_document(html);
    let div_row = Selector::parse(".div-row").unwrap();
    let h3 = Selector::parse("h3").unwrap();
    let a = Selector::parse("a").unwrap();
    let cover = Selector::parse(".cover-col a").unwrap();
    let kind = Selector::parse(".title-kind-col").unwrap();
    let episodes = Selector::parse(".episodes-col").unwrap();
    let rating = Selector::parse(".rate-top").unwrap();

    let mut result = Vec::new();

    for div in doc.select(&div_row) {
        let name_elem = div.select(&h3).next().and_then(|h| h.select(&a).next());

        let name = name_elem
            .map(|el| el.text().collect::<String>())
            .unwrap_or_default();

        let url = name_elem
            .and_then(|el| el.value().attr("href"))
            .unwrap_or("")
            .to_string();

        let img_href = div
            .select(&cover)
            .next()
            .and_then(|el| el.value().attr("href"))
            .unwrap_or("/res/other/placeholders/title/100x100.jpg");

        let full_url = format!("https://shinden.pl{}", url);
        let img_url = format!("https://shinden.pl{}", img_href);
        let anime_type = div
            .select(&kind)
            .next()
            .map(|k| k.text().collect::<String>())
            .unwrap_or_default();

        let ep_count = div
            .select(&episodes)
            .next()
            .map(|e| e.text().collect::<String>())
            .unwrap_or_default()
            .trim()
            .to_string();

        let rate = div
            .select(&rating)
            .next()
            .map(|r| r.text().collect::<String>())
            .unwrap_or_default();

        if !name.is_empty() {
            result.push(Anime {
                name,
                url: full_url,
                image_url: img_url,
                anime_type,
                rating: rate,
                episodes: ep_count,
                description: String::new(),
            });
        }
    }

    result
}

fn has_available_episodes(episodes: &str) -> bool {
    episodes
        .split('/')
        .next()
        .and_then(|value| value.trim().split_whitespace().next())
        .and_then(|value| value.parse::<u32>().ok())
        .map(|count| count > 0)
        .unwrap_or(false)
}
struct Api(ShindenAPI);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn test_connection(state: tauri::State<'_, Api>) -> Result<(), String> {
    match state.0.get_html("http://shinden.pl").await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}

#[tauri::command]
async fn search(state: tauri::State<'_, Api>, query: String) -> Result<Vec<Anime>, String> {
    state
        .0
        .search_anime(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_watching_anime(state: tauri::State<'_, Api>) -> Result<Vec<Anime>, String> {
    const WATCHING_URL: &str = "https://shinden.pl/user/watching";

    let html = state
        .0
        .get_html(WATCHING_URL)
        .await
        .map_err(|e| e.to_string())?;

    let parsed = parse_watching_list(&html);
    Ok(parsed
        .into_iter()
        .filter(|anime| has_available_episodes(&anime.episodes))
        .collect())
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
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn logout(state: tauri::State<'_, Api>) -> Result<(), String> {
    state.0.logout().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_user_name(state: tauri::State<'_, Api>) -> Result<Option<String>, String> {
    state.0.get_user_name().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_user_profile_image(state: tauri::State<'_, Api>) -> Result<Option<String>, String> {
    state
        .0
        .get_user_profile_image()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_episodes(state: tauri::State<'_, Api>, url: String) -> Result<Vec<Episode>, String> {
    state.0.get_episodes(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_players(state: tauri::State<'_, Api>, url: String) -> Result<Vec<Player>, String> {
    state.0.get_players(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_iframe(state: tauri::State<'_, Api>, id: String) -> Result<String, String> {
    state
        .0
        .get_player_iframe(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_cda_video(_state: tauri::State<'_, Api>, url: String) -> Result<String, String> {
    let url_clone = url.clone();
    tauri::async_runtime::spawn_blocking(move || {
        tauri::async_runtime::block_on(async {
            cda_dl::get_video_url(&url_clone)
                .await
                .map_err(|e| e.to_string())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .manage(Api(ShindenAPI::new().expect("Failed to create ShindenAPI")))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            test_connection,
            search,
            login,
            get_user_name,
            get_user_profile_image,
            logout,
            get_watching_anime,
            get_episodes,
            get_players,
            get_iframe,
            get_cda_video
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
