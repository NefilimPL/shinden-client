use shinden_pl_api::client_backend::{ImportSummary, ShindenClientBackend};
use shinden_pl_api::local_library::LibraryState;
use shinden_pl_api::public_users::PublicUser;
use tauri::Manager;

pub(crate) fn close_shinden_windows(app: &tauri::AppHandle) -> Result<(), String> {
    for label in ["shinden-login", "shinden-verification"] {
        if let Some(window) = app.get_webview_window(label) {
            window.close().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_library_state(
    state: tauri::State<'_, ShindenClientBackend>,
) -> Result<LibraryState, String> {
    state.get_library_state()
}

#[tauri::command]
pub fn select_library_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, ShindenClientBackend>,
    profile_id: String,
) -> Result<LibraryState, String> {
    close_shinden_windows(&app)?;
    state.select_library_profile(profile_id)
}

#[tauri::command]
pub fn set_library_preferences(
    app: tauri::AppHandle,
    state: tauri::State<'_, ShindenClientBackend>,
    network_enabled: bool,
    import_enabled: bool,
) -> Result<LibraryState, String> {
    if !network_enabled {
        close_shinden_windows(&app)?;
    }
    state.set_library_preferences(network_enabled, import_enabled)
}

#[tauri::command]
pub async fn search_public_users(
    state: tauri::State<'_, ShindenClientBackend>,
    query: String,
) -> Result<Vec<PublicUser>, String> {
    state.search_public_users(query).await
}

#[tauri::command]
pub async fn import_public_user(
    state: tauri::State<'_, ShindenClientBackend>,
    profile_url: String,
) -> Result<ImportSummary, String> {
    state.import_public_user(profile_url).await
}
