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

/// Register aurora:// and magnet: protocol handlers
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

        let (key, _) = hkcu.create_subkey("Software\\Classes\\aurora").map_err(|e| e.to_string())?;
        key.set_value("", &"URL:Aurora Protocol").map_err(|e| e.to_string())?;
        key.set_value("URL Protocol", &"").map_err(|e| e.to_string())?;
        let (cmd, _) = hkcu.create_subkey("Software\\Classes\\aurora\\shell\\open\\command").map_err(|e| e.to_string())?;
        cmd.set_value("", &format!("\"{}\" --uri \"%1\"", exe_path)).map_err(|e| e.to_string())?;

        if hkcu.open_subkey("Software\\Classes\\magnet").is_err() {
            let (mk, _) = hkcu.create_subkey("Software\\Classes\\magnet").map_err(|e| e.to_string())?;
            mk.set_value("", &"URL:Magnet Protocol").map_err(|e| e.to_string())?;
            mk.set_value("URL Protocol", &"").map_err(|e| e.to_string())?;
            let (mc, _) = hkcu.create_subkey("Software\\Classes\\magnet\\shell\\open\\command").map_err(|e| e.to_string())?;
            mc.set_value("", &format!("\"{}\" --uri \"%1\"", exe_path)).map_err(|e| e.to_string())?;
        }

        Ok(true)
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(false) }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _: Result<(), _> = w.show();
        let _: Result<(), _> = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let _ = register_uri_scheme();

            // System tray with menu
            let show_item = tauri::menu::MenuItem::with_id(app, "show", "Open Aurora", true, None::<&str>)?;
            let quit_item = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = tauri::menu::Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("Aurora — DC++ for Yggdrasil")
                .on_menu_event(|app: &tauri::AppHandle, event: tauri::menu::MenuEvent| {
                    match event.id.as_ref() {
                        "show" => show_main_window(app),
                        "quit" => std::process::exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: tauri::tray::TrayIconEvent| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up, ..
                    } = event {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ : Result<(), _> = window.hide();
            }
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
