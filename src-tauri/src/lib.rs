use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg(target_os = "windows")]
mod mouse_hook {
    use std::sync::atomic::{AtomicPtr, Ordering};
    use std::sync::OnceLock;
    use tauri::{AppHandle, Emitter};

    type HHOOK = *mut std::ffi::c_void;
    type HINSTANCE = *mut std::ffi::c_void;
    type LRESULT = isize;
    type WPARAM = usize;
    type LPARAM = isize;
    type HOOKPROC = unsafe extern "system" fn(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT;

    #[repr(C)]
    struct POINT {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    struct MSLLHOOKSTRUCT {
        pt: POINT,
        mouse_data: u32,
        flags: u32,
        time: u32,
        dw_extra_info: usize,
    }

    extern "system" {
        fn SetWindowsHookExW(id_hook: i32, lpfn: HOOKPROC, hmod: HINSTANCE, dw_thread_id: u32) -> HHOOK;
        fn UnhookWindowsHookEx(hhk: HHOOK) -> i32;
        fn CallNextHookEx(hhk: HHOOK, n_code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT;
        fn GetMessageW(lp_msg: *mut u8, hwnd: *mut std::ffi::c_void, w_msg_filter_min: u32, w_msg_filter_max: u32) -> i32;
    }

    const WH_MOUSE_LL: i32 = 14;
    const WM_RBUTTONDOWN: usize = 0x0204;
    const WM_MBUTTONDOWN: usize = 0x0207;
    const WM_XBUTTONDOWN: usize = 0x020B;
    const XBUTTON1: u32 = 0x0001;
    const XBUTTON2: u32 = 0x0002;

    static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
    static HOOK: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());

    unsafe extern "system" fn hook_callback(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            let hook_struct = &*(lparam as *const MSLLHOOKSTRUCT);
            let event_name = match wparam {
                WM_MBUTTONDOWN => Some("Mouse3"),
                WM_RBUTTONDOWN => Some("Mouse2"),
                WM_XBUTTONDOWN => {
                    let hi = (hook_struct.mouse_data >> 16) as u32;
                    if hi == XBUTTON1 {
                        Some("Mouse4")
                    } else if hi == XBUTTON2 {
                        Some("Mouse5")
                    } else {
                        None
                    }
                }
                _ => None,
            };

            if let Some(btn) = event_name {
                if let Some(app) = APP_HANDLE.get() {
                    let _ = app.emit("global-mouse-click", btn);
                }
            }
        }
        CallNextHookEx(HOOK.load(Ordering::SeqCst), code, wparam, lparam)
    }

    pub fn start_mouse_hook(app: AppHandle) {
        let _ = APP_HANDLE.set(app);
        std::thread::spawn(|| {
            unsafe {
                let hhook = SetWindowsHookExW(WH_MOUSE_LL, hook_callback, std::ptr::null_mut(), 0);
                if hhook.is_null() {
                    eprintln!("[MouseHook] Failed to install WH_MOUSE_LL hook");
                    return;
                }
                HOOK.store(hhook, Ordering::SeqCst);
                println!("[MouseHook] Global Windows mouse hook installed successfully");

                let mut msg = [0u8; 48];
                while GetMessageW(msg.as_mut_ptr(), std::ptr::null_mut(), 0, 0) > 0 {}

                UnhookWindowsHookEx(hhook);
                HOOK.store(std::ptr::null_mut(), Ordering::SeqCst);
            }
        });
    }
}

#[tauri::command]
fn is_desktop() -> bool {
    true
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) -> bool {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
            false
        } else {
            let _ = window.maximize();
            true
        }
    } else {
        false
    }
}

#[tauri::command]
fn is_window_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn start_drag(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn is_portable_mode() -> bool {
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_dir = exe_path.parent().unwrap_or(std::path::Path::new(""));
        let has_uninstaller = exe_dir.join("Uninstall VoiceChat.exe").exists()
            || exe_dir.join("Uninstall RVxis.exe").exists()
            || exe_dir.join("unins000.exe").exists();
        let path_str = exe_path.to_string_lossy().to_lowercase();
        let in_programs = path_str.contains("appdata\\local\\programs")
            || path_str.contains("program files");
        !has_uninstaller && !in_programs
    } else {
        true
    }
}

#[tauri::command]
async fn apply_portable_update(app: tauri::AppHandle, download_url: String) -> Result<(), String> {
    use futures_util::StreamExt;
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

    let current_exe = std::env::current_exe().map_err(|e| format!("Не удалось определить путь к приложению: {e}"))?;
    let parent_dir = current_exe.parent().ok_or("Не удалось определить папку приложения")?;
    let exe_name = current_exe.file_name().ok_or("Не удалось определить имя файла")?.to_string_lossy().to_string();
    let new_exe = parent_dir.join(format!("{exe_name}.new"));
    let old_exe = parent_dir.join(format!("{exe_name}.old"));

    // 1. Download new executable
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("Ошибка создания HTTP клиента: {e}"))?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Ошибка загрузки обновления: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Сервер вернул ошибку при загрузке: {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&new_exe)
        .await
        .map_err(|e| format!("Не удалось создать временный файл обновления: {e}"))?;

    let mut downloaded_bytes: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Ошибка получения данных: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Ошибка записи файла обновления: {e}"))?;
        downloaded_bytes += chunk.len() as u64;

        let _ = app.emit("portable-update-progress", serde_json::json!({
            "downloaded": downloaded_bytes,
            "total": total_bytes
        }));
    }

    file.flush()
        .await
        .map_err(|e| format!("Ошибка финализации файла: {e}"))?;
    drop(file);

    // 2. Perform atomic swap
    if old_exe.exists() {
        let _ = std::fs::remove_file(&old_exe);
    }

    std::fs::rename(&current_exe, &old_exe)
        .map_err(|e| format!("Не удалось переименовать текущий файл: {e}"))?;

    if let Err(e) = std::fs::rename(&new_exe, &current_exe) {
        // Rollback
        let _ = std::fs::rename(&old_exe, &current_exe);
        return Err(format!("Не удалось установить новый файл (выполнен откат): {e}"));
    }

    // 3. Launch the new executable
    std::process::Command::new(&current_exe)
        .spawn()
        .map_err(|e| format!("Не удалось запустить обновлённое приложение: {e}"))?;

    // 4. Background cleanup for .old file
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let old_path = old_exe.to_string_lossy().to_string();
        let _ = std::process::Command::new("cmd.exe")
            .args(["/C", "ping", "127.0.0.1", "-n", "3", ">", "NUL", "&", "del", "/f", "/q", &old_path])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn();
    }

    // 5. Exit old process
    std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Clean up any leftover .old file from previous portable update
            if let Ok(current_exe) = std::env::current_exe() {
                let exe_name = current_exe.file_name().unwrap_or_default().to_string_lossy();
                let old_exe = current_exe.with_file_name(format!("{exe_name}.old"));
                if old_exe.exists() {
                    let _ = std::fs::remove_file(old_exe);
                }
            }

            #[cfg(target_os = "windows")]
            {
                mouse_hook::start_mouse_hook(app.handle().clone());
            }

            // Build system tray menu
            let show_i = MenuItem::with_id(app, "show", "Показать RVxis", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Свернуть в трей", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Выйти", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("RVxis - Голосовой чат");

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                brain_hide(window);
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            is_desktop,
            is_portable_mode,
            apply_portable_update,
            minimize_window,
            toggle_maximize_window,
            is_window_maximized,
            close_window,
            start_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn brain_hide(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

