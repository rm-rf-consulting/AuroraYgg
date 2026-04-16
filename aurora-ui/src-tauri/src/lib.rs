use tauri::Manager;

/// Check if the daemon is reachable on the given port
#[tauri::command]
async fn check_daemon(port: u16) -> Result<bool, String> {
    let url = format!("http://127.0.0.1:{}/api/v1/", port);
    match reqwest::get(&url).await {
        Ok(resp) => Ok(resp.status().is_client_error() || resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Get the config directory path (%APPDATA%\Aurora)
#[tauri::command]
fn get_config_path() -> Result<String, String> {
    let appdata = std::env::var("APPDATA").map_err(|e| e.to_string())?;
    Ok(format!("{}\\Aurora", appdata))
}

/// Check if this is a fresh install (no users configured)
#[tauri::command]
fn is_fresh_install() -> Result<bool, String> {
    let appdata = std::env::var("APPDATA").map_err(|e| e.to_string())?;
    let users_file = format!("{}\\Aurora\\web-users.json", appdata);

    match std::fs::read_to_string(&users_file) {
        Ok(content) => Ok(!content.contains("\"password\"")),
        Err(_) => Ok(true),
    }
}

/// Register aurora:// protocol handler in Windows registry
#[tauri::command]
fn register_uri_scheme() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let exe_path = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        // Register aurora:// protocol
        let (key, _) = hkcu
            .create_subkey("Software\\Classes\\aurora")
            .map_err(|e| e.to_string())?;
        key.set_value("", &"URL:Aurora Protocol")
            .map_err(|e| e.to_string())?;
        key.set_value("URL Protocol", &"")
            .map_err(|e| e.to_string())?;

        let (cmd_key, _) = hkcu
            .create_subkey("Software\\Classes\\aurora\\shell\\open\\command")
            .map_err(|e| e.to_string())?;
        cmd_key
            .set_value("", &format!("\"{}\" --uri \"%1\"", exe_path))
            .map_err(|e| e.to_string())?;

        // Also register magnet: if not already taken
        if hkcu.open_subkey("Software\\Classes\\magnet").is_err() {
            let (mag_key, _) = hkcu
                .create_subkey("Software\\Classes\\magnet")
                .map_err(|e| e.to_string())?;
            mag_key
                .set_value("", &"URL:Magnet Protocol")
                .map_err(|e| e.to_string())?;
            mag_key
                .set_value("URL Protocol", &"")
                .map_err(|e| e.to_string())?;

            let (mag_cmd, _) = hkcu
                .create_subkey("Software\\Classes\\magnet\\shell\\open\\command")
                .map_err(|e| e.to_string())?;
            mag_cmd
                .set_value("", &format!("\"{}\" --uri \"%1\"", exe_path))
                .map_err(|e| e.to_string())?;
        }

        Ok(true)
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Linux: create .desktop file with MimeType
        Ok(false)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Handle deep links (aurora://, magnet:)
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                app.handle().plugin(tauri_plugin_deep_link::init())?;
                app.listen("deep-link://new-url", move |event| {
                    log::info!("Deep link received: {:?}", event.payload());
                    // Send to frontend via event
                    let _ = handle.emit("uri-open", event.payload());
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_daemon,
            get_config_path,
            is_fresh_install,
            register_uri_scheme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
