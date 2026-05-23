use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

pub const UPDATE_PROGRESS_EVENT: &str = "shinden-update-progress";

#[derive(Clone, serde::Serialize)]
struct UpdateProgressPayload {
    version: String,
    downloaded: u64,
    total: Option<u64>,
    percent: Option<f64>,
    finished: bool,
}

fn strip_release_prefix(tag: &str) -> &str {
    let lower = tag.to_ascii_lowercase();

    if lower.starts_with("app-v.") {
        &tag[6..]
    } else if lower.starts_with("app-v") {
        &tag[5..]
    } else if lower.starts_with("v.") {
        &tag[2..]
    } else if lower.starts_with('v') {
        &tag[1..]
    } else {
        tag
    }
}

fn is_safe_backend_suffix(suffix: &str) -> bool {
    !suffix.is_empty()
        && suffix.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        })
}

pub(crate) fn release_version_from_tag(tag: &str) -> Result<String, String> {
    let tag = tag.trim();
    let version_with_suffix = strip_release_prefix(tag);
    let (version, suffix) = version_with_suffix
        .split_once('-')
        .map(|(version, suffix)| (version, Some(suffix)))
        .unwrap_or((version_with_suffix, None));

    let parts: Vec<&str> = version.split('.').collect();
    let has_semver_core = parts.len() == 3
        && parts.iter().all(|part| {
            !part.is_empty() && part.chars().all(|character| character.is_ascii_digit())
        });
    let has_safe_suffix = suffix.map_or(true, is_safe_backend_suffix);

    if has_semver_core && has_safe_suffix {
        Ok(version.to_string())
    } else {
        Err(format!("Nieprawidlowy tag wersji: {tag}"))
    }
}

pub(crate) fn release_manifest_versions_from_tag(tag: &str) -> Result<Vec<String>, String> {
    let tag = tag.trim();
    let version = release_version_from_tag(tag)?;
    let version_with_suffix = strip_release_prefix(tag);

    if version_with_suffix == version {
        Ok(vec![version])
    } else {
        Ok(vec![version, version_with_suffix.to_string()])
    }
}

pub(crate) fn release_manifest_endpoint(tag: &str) -> Result<String, String> {
    let tag = tag.trim();
    if tag.is_empty()
        || tag.len() > 80
        || !tag.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        })
    {
        return Err(format!("Nieprawidlowy tag wersji: {tag}"));
    }

    release_version_from_tag(tag)?;

    Ok(format!(
        "https://github.com/NefilimPL/shinden-client/releases/download/{tag}/latest.json"
    ))
}

fn emit_update_progress(
    app: &AppHandle,
    version: &str,
    downloaded: u64,
    total: Option<u64>,
    finished: bool,
) {
    let percent = total
        .filter(|total| *total > 0)
        .map(|total| ((downloaded as f64 / total as f64) * 100.0).min(100.0));

    let _ = app.emit(
        UPDATE_PROGRESS_EVENT,
        UpdateProgressPayload {
            version: version.to_string(),
            downloaded,
            total,
            percent,
            finished,
        },
    );
}

pub async fn install_update_from_manifest(app: AppHandle, tag: String) -> Result<(), String> {
    let endpoint = release_manifest_endpoint(&tag)?;
    let expected_versions = release_manifest_versions_from_tag(&tag)?;
    let endpoint = endpoint
        .parse()
        .map_err(|error| format!("Nie mozna odczytac endpointu aktualizacji: {error}"))?;

    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|error| format!("Nie mozna przygotowac aktualizatora: {error}"))?
        .version_comparator(move |_current_version, remote_release| {
            let remote_version = remote_release.version.to_string();
            expected_versions
                .iter()
                .any(|expected_version| expected_version == &remote_version)
        })
        .build()
        .map_err(|error| format!("Nie mozna przygotowac aktualizatora: {error}"))?;

    let update = updater
        .check()
        .await
        .map_err(|error| format!("Nie udalo sie sprawdzic wybranej aktualizacji: {error}"))?
        .ok_or_else(|| format!("Wybrana wersja {tag} nie jest dostepna dla tej aplikacji."))?;

    let version = update.version.clone();
    let downloaded = Arc::new(AtomicU64::new(0));
    emit_update_progress(&app, &version, 0, None, false);

    update
        .download_and_install(
            {
                let app = app.clone();
                let version = version.clone();
                let downloaded = Arc::clone(&downloaded);
                move |chunk_length, total| {
                    let downloaded = downloaded
                        .fetch_add(chunk_length as u64, Ordering::Relaxed)
                        .saturating_add(chunk_length as u64);
                    emit_update_progress(&app, &version, downloaded, total, false);
                }
            },
            {
                let app = app.clone();
                let version = version.clone();
                let downloaded = Arc::clone(&downloaded);
                move || {
                    let downloaded = downloaded.load(Ordering::Relaxed);
                    emit_update_progress(&app, &version, downloaded, Some(downloaded), true);
                }
            },
        )
        .await
        .map_err(|error| format!("Nie udalo sie pobrac lub zainstalowac aktualizacji: {error}"))?;

    app.restart();
}
