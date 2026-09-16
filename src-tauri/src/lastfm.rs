use crate::{CommandError, KEYRING_SERVICE};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const LASTFM_API_URL: &str = "https://ws.audioscrobbler.com/2.0/";
const LASTFM_API_KEY: &str = "802624099e59adcc599c9f6e6aa60371";
const LASTFM_SHARED_SECRET: &str = "186e5d4fa717d145ece7e50aff07757c";
const LASTFM_KEYRING_USER: &str = "lastfm-session-v1";
const LASTFM_SESSION_FILE: &str = "lastfm-session-v1.json";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredLastFmSession {
    username: String,
    session_key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFmAuthStart {
    token: String,
    auth_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFmSessionStatus {
    username: String,
}

#[derive(Deserialize)]
struct LastFmTokenResponse {
    token: String,
}

#[derive(Deserialize)]
struct LastFmSessionEnvelope {
    session: LastFmSessionResponse,
}

#[derive(Deserialize)]
struct LastFmSessionResponse {
    name: String,
    key: String,
}

#[derive(Deserialize)]
struct LastFmErrorResponse {
    error: Option<u32>,
    message: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFmTrackInput {
    artist: String,
    track: String,
    album: Option<String>,
    duration: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFmScrobbleInput {
    artist: String,
    track: String,
    album: Option<String>,
    duration: Option<u64>,
    timestamp: u64,
}

fn lastfm_session_file(app: &tauri::AppHandle) -> Result<PathBuf, CommandError> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(LASTFM_SESSION_FILE))
        .map_err(|error| CommandError {
            message: format!("application data directory unavailable: {error}"),
        })
}

fn configured_credentials() -> (&'static str, &'static str) {
    (LASTFM_API_KEY, LASTFM_SHARED_SECRET)
}

fn lastfm_keyring_entry() -> Result<keyring::Entry, CommandError> {
    keyring::Entry::new(KEYRING_SERVICE, LASTFM_KEYRING_USER).map_err(|error| CommandError {
        message: format!("Last.fm credential store unavailable: {error}"),
    })
}

fn load_stored_session(app: &tauri::AppHandle) -> Result<Option<StoredLastFmSession>, CommandError> {
    // 1. Try durable app_data_dir file first (guaranteed across Android & desktop restarts)
    if let Ok(path) = lastfm_session_file(app) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    if let Ok(session) = serde_json::from_str::<StoredLastFmSession>(trimmed) {
                        return Ok(Some(session));
                    }
                }
            }
        }
    }

    // 2. Fallback to OS keyring (if supported by OS, e.g. for desktop migration)
    if let Ok(entry) = lastfm_keyring_entry() {
        match entry.get_password() {
            Ok(session_json) => {
                if let Ok(session) = serde_json::from_str::<StoredLastFmSession>(&session_json) {
                    // Sync to file storage for future fast/resilient loads
                    if let Ok(path) = lastfm_session_file(app) {
                        if let Some(parent) = path.parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        let _ = fs::write(path, &session_json);
                    }
                    return Ok(Some(session));
                }
            }
            Err(keyring::Error::NoEntry) => {}
            Err(err) => {
                eprintln!("[internal][lastfm][warn] keyring load failed: {err}");
            }
        }
    }

    Ok(None)
}

fn save_stored_session(app: &tauri::AppHandle, session: &StoredLastFmSession) -> Result<(), CommandError> {
    let session_json = serde_json::to_string(session).map_err(|error| CommandError {
        message: format!("Last.fm session serialization failed: {error}"),
    })?;

    // Always save to app_data_dir file (guaranteed on Android & desktop)
    let path = lastfm_session_file(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| CommandError {
            message: format!("Last.fm session directory creation failed: {error}"),
        })?;
    }
    fs::write(&path, &session_json).map_err(|error| CommandError {
        message: format!("Last.fm session file save failed: {error}"),
    })?;

    // Also attempt keyring save if supported
    if let Ok(entry) = lastfm_keyring_entry() {
        let _ = entry.set_password(&session_json);
    }

    Ok(())
}

fn delete_stored_session(app: &tauri::AppHandle) -> Result<(), CommandError> {
    // Delete file
    if let Ok(path) = lastfm_session_file(app) {
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    // Delete keyring
    if let Ok(entry) = lastfm_keyring_entry() {
        let _ = entry.delete_credential();
    }

    Ok(())
}

fn api_signature(params: &BTreeMap<String, String>, shared_secret: &str) -> String {
    let mut payload = String::new();
    for (key, value) in params {
        payload.push_str(key);
        payload.push_str(value);
    }
    payload.push_str(shared_secret);
    format!("{:x}", md5::compute(payload))
}

async fn signed_lastfm_post<T: for<'de> Deserialize<'de>>(
    mut params: BTreeMap<String, String>,
) -> Result<T, CommandError> {
    let (api_key, shared_secret) = configured_credentials();
    params.insert("api_key".to_string(), api_key.to_string());
    let signature = api_signature(&params, shared_secret);
    params.insert("api_sig".to_string(), signature);
    params.insert("format".to_string(), "json".to_string());

    let response = reqwest::Client::new()
        .post(LASTFM_API_URL)
        .form(&params)
        .send()
        .await
        .map_err(|error| CommandError {
            message: format!("Last.fm request failed: {error}"),
        })?;
    let status = response.status();
    let bytes = response.bytes().await.map_err(|error| CommandError {
        message: format!("Last.fm response read failed: {error}"),
    })?;

    if !status.is_success() {
        if let Ok(error_response) = serde_json::from_slice::<LastFmErrorResponse>(&bytes) {
            return Err(CommandError {
                message: error_response
                    .message
                    .unwrap_or_else(|| format!("Last.fm returned HTTP {status}.")),
            });
        }
        return Err(CommandError {
            message: format!("Last.fm returned HTTP {status}."),
        });
    }

    if let Ok(error_response) = serde_json::from_slice::<LastFmErrorResponse>(&bytes) {
        if error_response.error.is_some() {
            return Err(CommandError {
                message: error_response
                    .message
                    .unwrap_or_else(|| "Last.fm rejected the request.".to_string()),
            });
        }
    }

    serde_json::from_slice(&bytes).map_err(|error| CommandError {
        message: format!("Last.fm response parse failed: {error}"),
    })
}

fn clean_metadata(value: String, label: &str) -> Result<String, CommandError> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Err(CommandError {
            message: format!("Last.fm {label} is required."),
        });
    }
    Ok(normalized)
}

#[tauri::command]
pub async fn lastfm_auth_token() -> Result<LastFmAuthStart, CommandError> {
    let (api_key, _) = configured_credentials();
    let mut params = BTreeMap::new();
    params.insert("method".to_string(), "auth.getToken".to_string());
    let response = signed_lastfm_post::<LastFmTokenResponse>(params).await?;
    Ok(LastFmAuthStart {
        auth_url: format!(
            "https://www.last.fm/api/auth/?api_key={}&token={}",
            api_key, response.token
        ),
        token: response.token,
    })
}

#[tauri::command]
pub async fn lastfm_complete_auth(
    app: tauri::AppHandle,
    token: String,
) -> Result<LastFmSessionStatus, CommandError> {
    let token = clean_metadata(token, "auth token")?;
    let mut params = BTreeMap::new();
    params.insert("method".to_string(), "auth.getSession".to_string());
    params.insert("token".to_string(), token);
    let response = signed_lastfm_post::<LastFmSessionEnvelope>(params).await?;
    let session = StoredLastFmSession {
        username: response.session.name,
        session_key: response.session.key,
    };
    save_stored_session(&app, &session)?;
    Ok(LastFmSessionStatus {
        username: session.username,
    })
}

#[tauri::command]
pub fn lastfm_get_session(app: tauri::AppHandle) -> Result<Option<LastFmSessionStatus>, CommandError> {
    Ok(load_stored_session(&app)?.map(|session| LastFmSessionStatus {
        username: session.username,
    }))
}

#[tauri::command]
pub fn lastfm_disconnect(app: tauri::AppHandle) -> Result<(), CommandError> {
    delete_stored_session(&app)
}

#[tauri::command]
pub async fn lastfm_update_now_playing(
    app: tauri::AppHandle,
    input: LastFmTrackInput,
) -> Result<(), CommandError> {
    let session = load_stored_session(&app)?.ok_or_else(|| CommandError {
        message: "Last.fm is not connected.".to_string(),
    })?;
    let mut params = BTreeMap::new();
    params.insert("method".to_string(), "track.updateNowPlaying".to_string());
    params.insert("sk".to_string(), session.session_key);
    params.insert(
        "artist".to_string(),
        clean_metadata(input.artist, "artist")?,
    );
    params.insert("track".to_string(), clean_metadata(input.track, "track")?);
    if let Some(album) = input.album {
        let album = album.split_whitespace().collect::<Vec<_>>().join(" ");
        if !album.is_empty() {
            params.insert("album".to_string(), album);
        }
    }
    if let Some(duration) = input.duration.filter(|duration| *duration > 0) {
        params.insert("duration".to_string(), duration.to_string());
    }
    let _ = signed_lastfm_post::<serde_json::Value>(params).await?;
    Ok(())
}

#[tauri::command]
pub async fn lastfm_scrobble(
    app: tauri::AppHandle,
    input: LastFmScrobbleInput,
) -> Result<(), CommandError> {
    let session = load_stored_session(&app)?.ok_or_else(|| CommandError {
        message: "Last.fm is not connected.".to_string(),
    })?;
    let mut params = BTreeMap::new();
    params.insert("method".to_string(), "track.scrobble".to_string());
    params.insert("sk".to_string(), session.session_key);
    params.insert(
        "artist[0]".to_string(),
        clean_metadata(input.artist, "artist")?,
    );
    params.insert(
        "track[0]".to_string(),
        clean_metadata(input.track, "track")?,
    );
    params.insert("timestamp[0]".to_string(), input.timestamp.to_string());
    if let Some(album) = input.album {
        let album = album.split_whitespace().collect::<Vec<_>>().join(" ");
        if !album.is_empty() {
            params.insert("album[0]".to_string(), album);
        }
    }
    if let Some(duration) = input.duration.filter(|duration| *duration > 0) {
        params.insert("duration[0]".to_string(), duration.to_string());
    }
    let _ = signed_lastfm_post::<serde_json::Value>(params).await?;
    Ok(())
}
