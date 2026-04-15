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
        Ok(content) => {
            // Check if users array is empty
            Ok(!content.contains("\"password\""))
        }
        Err(_) => Ok(true), // File doesn't exist = fresh install
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_daemon,
            get_config_path,
            is_fresh_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
