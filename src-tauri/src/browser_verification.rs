use shinden_pl_api::client_backend::ShindenClientBackend;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const WINDOW_LABEL: &str = "shinden-verification";
const SHINDEN_URL: &str = "https://shinden.pl/";

fn is_verification_url(url: &tauri::Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("shinden.pl")
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none()
}

#[tauri::command]
pub async fn open_shinden_verification(app: AppHandle) -> Result<(), String> {
    // WebView2 creation/cookie access must not block the main event thread.
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
            window.show().map_err(|error| error.to_string())?;
            return window.set_focus().map_err(|error| error.to_string());
        }

        WebviewWindowBuilder::new(
            &app,
            WINDOW_LABEL,
            WebviewUrl::External(
                SHINDEN_URL
                    .parse()
                    .map_err(|_| "Nieprawidłowy adres Shinden")?,
            ),
        )
        .title("Shinden — weryfikacja połączenia")
        .inner_size(1000.0, 750.0)
        // This remote page gets no application capabilities or custom IPC bridge.
        .on_navigation(is_verification_url)
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .build()
        .map(|_| ())
        .map_err(|error| format!("Nie udało się otworzyć okna Shinden: {error}"))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn complete_shinden_verification(
    app: AppHandle,
    state: tauri::State<'_, ShindenClientBackend>,
) -> Result<(), String> {
    let window = app
        .get_webview_window(WINDOW_LABEL)
        .ok_or("Otwórz okno weryfikacji i przejdź weryfikację Shinden.")?;
    let browser = window.clone();
    let (user_agent, clearance) = tauri::async_runtime::spawn_blocking(move || {
        let url = browser.url().map_err(|error| error.to_string())?;
        if !is_verification_url(&url) {
            return Err("Okno weryfikacji nie wyświetla zaufanej strony Shinden.".to_string());
        }
        let (sender, receiver) = mpsc::sync_channel(1);
        browser
            .eval_with_callback("navigator.userAgent", move |value| {
                let _ = sender.try_send(value);
            })
            .map_err(|error| error.to_string())?;
        let value = receiver
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| "Nie udało się odczytać danych przeglądarki. Spróbuj ponownie.")?;
        let user_agent: String = serde_json::from_str(&value)
            .map_err(|_| "Nie udało się odczytać identyfikatora przeglądarki.")?;
        let cookies = browser
            .cookies_for_url(SHINDEN_URL.parse().unwrap())
            .map_err(|error| error.to_string())?;
        let clearance = cookies
            .into_iter()
            .find(|cookie| cookie.name() == "cf_clearance" && !cookie.value().is_empty())
            .ok_or(
                "Brak potwierdzenia Cloudflare. Dokończ weryfikację w otwartym oknie Shinden.",
            )?;
        Ok::<_, String>((user_agent, clearance.to_string()))
    })
    .await
    .map_err(|error| error.to_string())??;

    state.import_browser_clearance(&user_agent, &clearance)?;
    // Never declare success just because the browser issued a cookie.
    state.test_connection().await?;
    let _ = window.close();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_verification_url;

    #[test]
    fn verification_stays_on_the_trusted_https_origin() {
        assert!(is_verification_url(
            &"https://shinden.pl/main/login".parse().unwrap()
        ));
        for url in [
            "http://shinden.pl/",
            "https://shinden.pl.evil.test/",
            "https://evil.test/?shinden.pl",
            "https://shinden.pl:8443/",
            "https://user:password@shinden.pl/",
            "https://lista.shinden.pl/",
        ] {
            assert!(!is_verification_url(&url.parse().unwrap()), "{url}");
        }
    }
}
