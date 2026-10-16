use shinden_pl_api::client::BROWSER_VERIFICATION_REQUIRED;
use shinden_pl_api::client_backend::ShindenClientBackend;
use tauri::http::{Request, Response, StatusCode};
use tauri::{Emitter, Manager};

pub struct ImageProxyToken(String);

impl ImageProxyToken {
    pub fn new() -> Result<Self, String> {
        let mut random = [0u8; 32];
        getrandom::fill(&mut random).map_err(|error| error.to_string())?;
        Ok(Self(
            random.iter().map(|byte| format!("{byte:02x}")).collect(),
        ))
    }
}

#[tauri::command]
pub fn get_image_proxy_token(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, ImageProxyToken>,
) -> Result<String, String> {
    if window.label() != "main" {
        return Err("Image loader unavailable".into());
    }
    Ok(state.0.clone())
}

fn image_source(request: &Request<Vec<u8>>, token: &str) -> Result<String, StatusCode> {
    if request.method() != tauri::http::Method::GET {
        return Err(StatusCode::METHOD_NOT_ALLOWED);
    }
    let url = tauri::Url::parse(&request.uri().to_string()).map_err(|_| StatusCode::BAD_REQUEST)?;
    let tokens: Vec<_> = url
        .query_pairs()
        .filter(|(key, _)| key == "token")
        .collect();
    if tokens.len() != 1 || tokens[0].1 != token {
        return Err(StatusCode::FORBIDDEN);
    }
    let sources: Vec<_> = url.query_pairs().filter(|(key, _)| key == "url").collect();
    if sources.len() != 1 || sources[0].1.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(sources[0].1.to_string())
}

pub fn handle_request(
    context: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let source = if context.webview_label() == "main" {
        image_source(&request, &context.app_handle().state::<ImageProxyToken>().0)
    } else {
        Err(StatusCode::FORBIDDEN)
    };
    let source = match source {
        Ok(source) => source,
        Err(status) => {
            responder.respond(Response::builder().status(status).body(Vec::new()).unwrap());
            return;
        }
    };
    let app = context.app_handle().clone();
    tauri::async_runtime::spawn(async move {
        let state = app.state::<ShindenClientBackend>();
        let response = match state.get_image(&source).await {
            Ok(image) => Response::builder()
                .header("Content-Type", image.content_type)
                .header("Cache-Control", "private, max-age=300")
                .header("X-Content-Type-Options", "nosniff")
                .header("Referrer-Policy", "no-referrer")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .body(image.bytes)
                .unwrap(),
            Err(error) => {
                if error.contains(BROWSER_VERIFICATION_REQUIRED) {
                    let _ = app.emit_to("main", "shinden-browser-verification-required", ());
                }
                // Don't expose authenticated image URLs or remote HTML to the webview.
                Response::builder()
                    .status(StatusCode::BAD_GATEWAY)
                    .header("Cache-Control", "no-store")
                    .body(Vec::new())
                    .unwrap()
            }
        };
        responder.respond(response);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_protocol_decodes_the_complete_source_url() {
        let request = Request::builder().uri("http://shinden-image.localhost/image?token=secret&url=https%3A%2F%2Fshinden.pl%2Favatar.jpg%3Fsize%3D32%26v%3D2").body(Vec::new()).unwrap();
        assert_eq!(
            image_source(&request, "secret").unwrap(),
            "https://shinden.pl/avatar.jpg?size=32&v=2"
        );
    }

    #[test]
    fn image_protocol_rejects_missing_ambiguous_and_non_get_requests() {
        for uri in [
            "http://shinden-image.localhost/image?token=secret",
            "http://shinden-image.localhost/image?token=secret&url=",
            "http://shinden-image.localhost/image?token=secret&url=a&url=b",
        ] {
            let request = Request::builder().uri(uri).body(Vec::new()).unwrap();
            assert_eq!(
                image_source(&request, "secret"),
                Err(StatusCode::BAD_REQUEST)
            );
        }
        let request = Request::builder()
            .method("POST")
            .uri("http://shinden-image.localhost/image?url=a")
            .body(Vec::new())
            .unwrap();
        assert_eq!(
            image_source(&request, "secret"),
            Err(StatusCode::METHOD_NOT_ALLOWED)
        );
    }

    #[test]
    fn third_party_frames_cannot_trigger_authenticated_image_requests() {
        for query in [
            "url=https://shinden.pl/main/logout",
            "token=wrong&url=a",
            "token=secret&token=wrong&url=a",
        ] {
            let request = Request::builder()
                .uri(format!("http://shinden-image.localhost/image?{query}"))
                .body(Vec::new())
                .unwrap();
            assert_eq!(image_source(&request, "secret"), Err(StatusCode::FORBIDDEN));
        }
    }
}
