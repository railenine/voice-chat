mod portable_security;
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
async fn apply_portable_update(
    app: tauri::AppHandle,
    download_url: String,
    expected_sha256: Option<String>,
    expected_size: Option<u64>,
    signature: String,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use sha2::{Digest, Sha256};
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

    portable_security::ensure_updates_enabled()?;
    let _guard = portable_security::UpdateGuard::acquire()?;
    if !download_url.starts_with("https://") || signature.trim().is_empty() {
        return Err("Обновление требует HTTPS и подписи издателя".into());
    }
    if !expected_sha256.as_ref().is_some_and(|h| h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit()))
        || !expected_size.is_some_and(|n| n >= 3 * 1024 * 1024 && n <= portable_security::MAX_UPDATE_BYTES) {
        return Err("Обновление требует корректных размера и SHA-256".into());
    }
    let current_exe = std::env::current_exe().map_err(|e| format!("Не удалось определить путь к приложению: {e}"))?;
    let parent_dir = current_exe.parent().ok_or("Не удалось определить папку приложения")?;
    let exe_name = current_exe.file_name().ok_or("Не удалось определить имя файла")?.to_string_lossy().to_string();
    let tmp_exe = parent_dir.join(format!("{exe_name}.update.tmp"));
    let old_exe = parent_dir.join(format!("{exe_name}.old"));

    // Clean up any stale temp file from previous failed attempts
    if tmp_exe.exists() {
        let _ = std::fs::remove_file(&tmp_exe);
    }

    // 1. Download new executable with streaming hash calculation
    let client = reqwest::Client::builder()
        .https_only(true)
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(180))
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
    let mut file = tokio::fs::File::create(&tmp_exe)
        .await
        .map_err(|e| format!("Не удалось создать временный файл обновления: {e}"))?;

    let mut downloaded_bytes: u64 = 0;
    let mut hasher = Sha256::new();
    let mut first_bytes = Vec::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| {
            let _ = std::fs::remove_file(&tmp_exe);
            format!("Ошибка получения данных: {e}")
        })?;

        if first_bytes.len() < 2 {
            let needed = 2 - first_bytes.len();
            first_bytes.extend_from_slice(&chunk[..std::cmp::min(needed, chunk.len())]);
        }

        if downloaded_bytes + chunk.len() as u64 > expected_size.unwrap() {
            drop(file);
            let _ = std::fs::remove_file(&tmp_exe);
            return Err("Превышен допустимый размер обновления".into());
        }
        hasher.update(&chunk);

        file.write_all(&chunk)
            .await
            .map_err(|e| {
                let _ = std::fs::remove_file(&tmp_exe);
                format!("Ошибка записи файла обновления: {e}")
            })?;
        downloaded_bytes += chunk.len() as u64;

        let _ = app.emit("portable-update-progress", serde_json::json!({
            "downloaded": downloaded_bytes,
            "total": total_bytes
        }));
    }

    file.flush()
        .await
        .map_err(|e| {
            let _ = std::fs::remove_file(&tmp_exe);
            format!("Ошибка финализации файла: {e}")
        })?;
    drop(file);

    // 2. Strict Validations before touching active executable
    // 2.1 File size sanity check (valid RVxis Windows PE binary is >= 3 MB)
    if downloaded_bytes < 3 * 1024 * 1024 {
        let _ = std::fs::remove_file(&tmp_exe);
        return Err(format!(
            "Скачанный файл повреждён или не является бинарником программы (размер: {downloaded_bytes} байт)"
        ));
    }

    // 2.2 Windows PE Header magic check (MZ = 0x4D, 0x5A)
    if first_bytes.len() < 2 || first_bytes[0] != 0x4D || first_bytes[1] != 0x5A {
        let _ = std::fs::remove_file(&tmp_exe);
        return Err("Скачанный файл не является корректным исполняемым файлом Windows (отсутствует PE-сигнатура MZ)".into());
    }

    // 2.3 Expected size check if provided by manifest
    if let Some(exp_size) = expected_size {
        if exp_size > 0 && downloaded_bytes != exp_size {
            let _ = std::fs::remove_file(&tmp_exe);
            return Err(format!(
                "Размер файла ({downloaded_bytes} байт) не совпадает с заявленным в манифесте ({exp_size} байт)"
            ));
        }
    }

    // 2.4 Cryptographic SHA-256 Checksum Verification
    let computed_hash = format!("{:x}", hasher.finalize());
    if let Some(ref exp_hash) = expected_sha256 {
        let exp_clean = exp_hash.trim().to_lowercase();
        if !exp_clean.is_empty() && !computed_hash.eq_ignore_ascii_case(&exp_clean) {
            let _ = std::fs::remove_file(&tmp_exe);
            return Err(format!(
                "Контрольная сумма SHA-256 не совпала! Обновление отклонено (факт: {computed_hash}, ожидалось: {exp_clean})"
            ));
        }
    }

    if let Err(error) = portable_security::verify_download(&tmp_exe, &signature) {
        let _ = std::fs::remove_file(&tmp_exe);
        return Err(error);
    }

    // 3. Replace only verified bytes; restore the previous binary on launch failure.
    if old_exe.exists() {
        let _ = std::fs::remove_file(&old_exe);
    }

    std::fs::rename(&current_exe, &old_exe)
        .map_err(|e| {
            let _ = std::fs::remove_file(&tmp_exe);
            format!("Не удалось переименовать текущий файл (проверьте права доступа): {e}")
        })?;

    if let Err(e) = std::fs::rename(&tmp_exe, &current_exe) {
        // Rollback immediately
        let _ = std::fs::rename(&old_exe, &current_exe);
        let _ = std::fs::remove_file(&tmp_exe);
        return Err(format!("Не удалось установить новый файл (выполнен автоматический откат): {e}"));
    }

    // 4. Launch the verified executable, rolling back if spawning fails.
    if let Err(error) = std::process::Command::new(&current_exe).spawn() {
        let _ = std::fs::rename(&current_exe, &tmp_exe);
        let rollback = std::fs::rename(&old_exe, &current_exe);
        let _ = std::fs::remove_file(&tmp_exe);
        return Err(format!("Не удалось запустить обновление: {error}; откат: {rollback:?}"));
    }
    // The next successfully started app removes .old; no shell cleanup commands.

    // 6. Exit old process cleanly
    std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    #[cfg(not(feature = "staging"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    builder
        .setup(|app| {
            // Clean up any leftover .old and .update.tmp files from previous portable updates
            if let Ok(current_exe) = std::env::current_exe() {
                let exe_name = current_exe.file_name().unwrap_or_default().to_string_lossy();
                let old_exe = current_exe.with_file_name(format!("{exe_name}.old"));
                let tmp_exe = current_exe.with_file_name(format!("{exe_name}.update.tmp"));
                let legacy_new_exe = current_exe.with_file_name(format!("{exe_name}.new"));
                if old_exe.exists() {
                    let _ = std::fs::remove_file(old_exe);
                }
                if tmp_exe.exists() {
                    let _ = std::fs::remove_file(tmp_exe);
                }
                if legacy_new_exe.exists() {
                    let _ = std::fs::remove_file(legacy_new_exe);
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

