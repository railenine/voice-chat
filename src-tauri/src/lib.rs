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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                mouse_hook::start_mouse_hook(app.handle().clone());
            }

            // Build system tray menu
            let show_i = MenuItem::with_id(app, "show", "Показать VoiceChat", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Свернуть в трей", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Выйти", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("VoiceChat - Голосовой чат");

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
                                let _ = window.hide();
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
            minimize_window,
            toggle_maximize_window,
            is_window_maximized,
            close_window,
            start_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
